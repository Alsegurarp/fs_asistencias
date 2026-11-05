#!/usr/bin/env bash
# Copia externa diaria S3: verificar lectura antes de rotar las copias locales.
set -Eeuo pipefail
umask 077

SOURCE=${ZENIT_SOURCE:-/opt/.fastsolution/zenit/fuente}
LOCAL=${ZENIT_BACKUPS:?Defina ZENIT_BACKUPS}
BUCKET=${BACKUP_S3_BUCKET:?Defina BACKUP_S3_BUCKET}
INSTANCE=${ZENIT_INSTANCE_ID:?Defina ZENIT_INSTANCE_ID por cliente}
: "${BACKUP_RECIPIENT:?Defina la clave pública BACKUP_RECIPIENT}"
[[ "$SOURCE" = /* && "$LOCAL" = /* && "$LOCAL" != / && ! -L "$LOCAL" ]] || exit 1
[[ "$BUCKET" =~ ^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$ ]] || exit 1
[[ "$INSTANCE" =~ ^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$ ]] || exit 1
aws_options=(--no-cli-pager --cli-connect-timeout 15 --cli-read-timeout 300)
if [ -n "${BACKUP_S3_ENDPOINT:-}" ]; then
  [[ "$BACKUP_S3_ENDPOINT" = https://* ]] || exit 1
  aws_options+=(--endpoint-url "$BACKUP_S3_ENDPOINT")
fi
prefix="zenit/$INSTANCE/"
# No reemplazar reglas de un bucket compartido: exigir la regla del cliente ya aplicada.
rules=$(aws "${aws_options[@]}" s3api get-bucket-lifecycle-configuration --bucket "$BUCKET" \
  --query "length(Rules[?Status=='Enabled' && Filter.Prefix=='$prefix' && Expiration.Days==\`30\` && NoncurrentVersionExpiration.NoncurrentDays==\`30\`])" --output text)
[[ "$rules" = 1 ]] || { echo 'Falta la regla S3 de 30 días para esta instancia y sus versiones.' >&2; exit 1; }
export ZENIT_BACKUPS BACKUP_RECIPIENT
mkdir -p "$LOCAL"
# shortcut: un apagado forzado puede dejar el lock; retirarlo sólo tras comprobar que no hay ejecución activa.
mkdir "$LOCAL/.external.lock" || { echo 'Ya hay un respaldo en ejecución.' >&2; exit 1; }
trap 'rmdir "$LOCAL/.external.lock"' EXIT
started=$(date +%s)

output=$(docker compose --project-directory "$SOURCE" -f "$SOURCE/compose.yaml" \
  -f "$SOURCE/deploy/servidor/zenit/compose.yaml" \
  --env-file "$SOURCE/deploy/servidor/zenit/servidor.env" \
  --profile ops run --rm --no-deps backup)
printf '%s\n' "$output"
file=$(printf '%s\n' "$output" | sed -n 's/^RESPALDO CIFRADO: \([^;]*\); sha256 .*/\1/p')
[[ "$file" =~ ^zenit-[0-9]{8}T[0-9]{6}Z-[a-zA-Z0-9]+\.tar\.age$ ]] || { echo 'Falta el paquete publicado.' >&2; exit 1; }
[[ -f "$LOCAL/$file" && ! -L "$LOCAL/$file" && -s "$LOCAL/$file" ]] || exit 1
sha=$(sha256sum "$LOCAL/$file" | cut -d ' ' -f1)
object="s3://$BUCKET/$prefix$file"
aws "${aws_options[@]}" s3 cp "$LOCAL/$file" "$object" --only-show-errors --no-progress
# Verificar los bytes descargados funciona también con proveedores S3 sin ChecksumSHA256.
remote_sha=$(aws "${aws_options[@]}" s3 cp "$object" - --only-show-errors --no-progress | sha256sum | cut -d ' ' -f1)
[[ "$remote_sha" = "$sha" ]] || { echo 'La copia S3 no coincide con el ciphertext local.' >&2; exit 1; }
find "$LOCAL" -maxdepth 1 -type f -name 'zenit-*.tar.age' -mtime +29 ! -name "$file" -delete
printf '%s\n' "$(date -u +%FT%TZ) $object $sha" > "$LOCAL/.external-success.pending"
mv "$LOCAL/.external-success.pending" "$LOCAL/.external-success"
echo "COPIA EXTERNA CORRECTA: $file; duración $(( $(date +%s) - started )) s."
