#!/usr/bin/env bash
# Transporte simulado; comprueba rotación real en directorios desechables, sin red.
set -Eeuo pipefail
work=$(mktemp -d)
trap 'rm -rf -- "$work"' EXIT
mkdir -p "$work/bin" "$work/local" "$work/remote"
export ZENIT_SOURCE=/fixture ZENIT_BACKUPS="$work/local"
export BACKUP_S3_BUCKET=fixture-bucket ZENIT_INSTANCE_ID=cliente-a BACKUP_RECIPIENT=fixture
export FIXTURE_REMOTE="$work/remote"
export FIXTURE_FILE=zenit-20261105T020000Z-fixture.tar.age
cat > "$work/bin/docker" <<'MOCK'
#!/usr/bin/env bash
set -eu
test "${FIXTURE_FAIL:-}" != backup
printf 'ciphertext fixture' > "$ZENIT_BACKUPS/$FIXTURE_FILE"
echo "RESPALDO CIFRADO: $FIXTURE_FILE; sha256 fixture."
MOCK
cat > "$work/bin/aws" <<'MOCK'
#!/usr/bin/env bash
set -eu
while [ "$1" != s3 ] && [ "$1" != s3api ]; do shift; done
if [ "$1" = s3api ]; then
  test "${FIXTURE_FAIL:-}" != lifecycle
  case "$*" in *"Filter.Prefix=='zenit/cliente-a/'"*) ;; *) exit 1 ;; esac
  echo "${FIXTURE_RULES:-1}"
elif [ "$3" = "s3://$BACKUP_S3_BUCKET/zenit/$ZENIT_INSTANCE_ID/$FIXTURE_FILE" ]; then
  test "${FIXTURE_FAIL:-}" != download
  test "$4" = -
  cat "$FIXTURE_REMOTE/$FIXTURE_FILE"
  if [ "${FIXTURE_FAIL:-}" = checksum ]; then echo altered; fi
else
  test "${FIXTURE_FAIL:-}" != upload
  test "$4" = "s3://$BACKUP_S3_BUCKET/zenit/$ZENIT_INSTANCE_ID/$FIXTURE_FILE"
  cp "$3" "$FIXTURE_REMOTE/$FIXTURE_FILE"
fi
MOCK
chmod 700 "$work/bin/"*
export PATH="$work/bin:$PATH"
script=${1:?Indique respaldo.sh}
bash -n "$script"
for failure in lifecycle backup upload download checksum; do
  printf old > "$ZENIT_BACKUPS/zenit-old.tar.age"
  printf old > "$FIXTURE_REMOTE/zenit-old.tar.age"
  touch -d "@$(( $(date +%s) - 31 * 86400 ))" "$ZENIT_BACKUPS/zenit-old.tar.age" "$FIXTURE_REMOTE/zenit-old.tar.age"
  if FIXTURE_FAIL=$failure bash "$script" > "$work/output" 2>&1; then
    echo "Aceptó fallo de $failure" >&2; exit 1
  fi
  test -f "$ZENIT_BACKUPS/zenit-old.tar.age"
  test -f "$FIXTURE_REMOTE/zenit-old.tar.age"
  test ! -e "$ZENIT_BACKUPS/.external-success"
  test ! -d "$ZENIT_BACKUPS/.external.lock"
done
for rules in 0 2; do
  if FIXTURE_RULES=$rules bash "$script" > "$work/output" 2>&1; then
    echo 'Aceptó política de retención ausente o ambigua' >&2; exit 1
  fi
done
printf unrelated > "$ZENIT_BACKUPS/other.tar.age"
touch -d "@$(( $(date +%s) - 31 * 86400 ))" "$ZENIT_BACKUPS/other.tar.age"
printf recent > "$ZENIT_BACKUPS/zenit-recent.tar.age"
touch -d "@$(( $(date +%s) - 29 * 86400 ))" "$ZENIT_BACKUPS/zenit-recent.tar.age"
bash "$script" > "$work/output"
test -s "$FIXTURE_REMOTE/$FIXTURE_FILE"
cmp "$ZENIT_BACKUPS/$FIXTURE_FILE" "$FIXTURE_REMOTE/$FIXTURE_FILE"
test -e "$FIXTURE_REMOTE/zenit-old.tar.age"
test ! -e "$ZENIT_BACKUPS/zenit-old.tar.age"
test -e "$ZENIT_BACKUPS/other.tar.age"
test -e "$ZENIT_BACKUPS/zenit-recent.tar.age"
test -s "$ZENIT_BACKUPS/.external-success"
for invalid in / '../cliente' 'otro;cliente' 'cliente/con/ruta'; do
  if ZENIT_INSTANCE_ID="$invalid" bash "$script" > "$work/output" 2>&1; then
    echo 'Aceptó destino inseguro' >&2; exit 1
  fi
done
mkdir "$ZENIT_BACKUPS/.external.lock"
if bash "$script" > "$work/output" 2>&1; then echo 'Aceptó concurrencia' >&2; exit 1; fi
if BACKUP_S3_ENDPOINT=http://insecure.invalid bash "$script" > "$work/output" 2>&1; then
  echo 'Aceptó endpoint sin TLS' >&2; exit 1
fi
echo 'AUTOPRUEBA EXTERNA CORRECTA: S3, huella, fallos, retención, aislamiento y exclusión mutua.'
