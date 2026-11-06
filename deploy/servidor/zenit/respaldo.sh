#!/usr/bin/env bash
# Copia externa diaria AWS S3: verificar lectura antes de rotar copias locales.
set -Eeuo pipefail
umask 077

SOURCE=${ZENIT_SOURCE:-/opt/.fastsolution/zenit/fuente}
LOCAL=${ZENIT_BACKUPS:?Defina ZENIT_BACKUPS}
BUCKET=${BACKUP_S3_BUCKET:?Defina BACKUP_S3_BUCKET (nombre del bucket AWS S3, sin s3://)}
INSTANCE=${ZENIT_INSTANCE_ID:?Defina ZENIT_INSTANCE_ID por cliente}
: "${BACKUP_RECIPIENT:?Defina la clave pública BACKUP_RECIPIENT}"
: "${AWS_DEFAULT_REGION:?Defina AWS_DEFAULT_REGION}"
[[ "$SOURCE" = /* && "$LOCAL" = /* && "$LOCAL" != / && ! -L "$LOCAL" ]] || exit 1
[[ "$BUCKET" =~ ^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$ ]] || exit 1
[[ "$INSTANCE" =~ ^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$ ]] || exit 1
prefix="zenit/$INSTANCE/"
aws_options=(--region "$AWS_DEFAULT_REGION" --no-cli-pager --no-cli-auto-prompt --cli-connect-timeout 15 --cli-read-timeout 300)
# No reemplazar reglas de un bucket compartido: exigir la regla del cliente ya aplicada.
metadata=$(aws "${aws_options[@]}" s3api get-bucket-lifecycle-configuration --bucket "$BUCKET" --output json)
printf '%s' "$metadata" | python3 -c '
import json, sys
prefix = sys.argv[1]
rules = json.load(sys.stdin).get("Rules", [])
deletions = []
for rule in rules:
    if rule.get("Status") != "Enabled" or not any(key in rule for key in ("Expiration", "NoncurrentVersionExpiration")):
        continue
    selection = rule.get("Filter", {})
    if not isinstance(selection, dict) or ("Filter" in rule and "Prefix" in rule):
        sys.exit("Filtro S3 inválido o ambiguo.")
    part = rule.get("Prefix", selection.get("Prefix", selection.get("And", {}).get("Prefix", "")))
    if not isinstance(part, str):
        sys.exit("El prefijo S3 debe ser texto.")
    if prefix.startswith(part) or part.startswith(prefix):
        deletions.append(rule)
if len(deletions) != 1 or deletions[0].get("Filter") != {"Prefix": prefix} or \
        deletions[0].get("Expiration") != {"Days": 30} or \
        deletions[0].get("NoncurrentVersionExpiration") != {"NoncurrentDays": 30}:
    sys.exit("Falta la regla S3 exacta de 30 días para el prefijo y sus versiones, o hay borrados superpuestos.")
' "$prefix"
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
# shortcut: PUT condicional admite hasta 5 GiB; usar multipart condicional antes de superar este tamaño.
size=$(stat -c %s "$LOCAL/$file")
[[ "$size" -le 5368709120 ]] || { echo 'El respaldo supera 5 GiB; requiere multipart condicional y no se envía ni rota.' >&2; exit 1; }
sha=$(sha256sum "$LOCAL/$file" | cut -d ' ' -f1)
object="s3://$BUCKET/$prefix$file"
aws "${aws_options[@]}" s3api put-object --bucket "$BUCKET" --key "$prefix$file" --body "$LOCAL/$file" --if-none-match '*' --output json > /dev/null
remote_sha=$(aws "${aws_options[@]}" s3 cp "$object" - --only-show-errors --no-progress | sha256sum | cut -d ' ' -f1)
[[ "$remote_sha" = "$sha" ]] || { echo 'La copia S3 no coincide con el ciphertext local.' >&2; exit 1; }
find "$LOCAL" -maxdepth 1 -type f -name 'zenit-*.tar.age' -mtime +29 ! -name "$file" -delete
printf '%s\n' "$(date -u +%FT%TZ) $object $sha" > "$LOCAL/.external-success.pending"
mv "$LOCAL/.external-success.pending" "$LOCAL/.external-success"
echo "COPIA EXTERNA CORRECTA: $file; duración $(( $(date +%s) - started )) s."
