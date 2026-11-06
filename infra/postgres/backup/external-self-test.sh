#!/usr/bin/env bash
# Transporte simulado; comprueba rotación real en directorios desechables, sin red.
set -Eeuo pipefail
work=$(mktemp -d)
trap 'rm -rf -- "$work"' EXIT
mkdir -p "$work/bin" "$work/local" "$work/remote"
export ZENIT_SOURCE=/fixture ZENIT_BACKUPS="$work/local"
export BACKUP_S3_BUCKET=fixture-bucket AWS_DEFAULT_REGION=us-east-2 ZENIT_INSTANCE_ID=cliente-a BACKUP_RECIPIENT=fixture
export FIXTURE_REMOTE="$work/remote" FIXTURE_POLICY="$work/policy.json"
export FIXTURE_FILE=zenit-20261105T020000Z-fixture.tar.age
export FIXTURE_STAT=$(command -v stat)
cat > "$work/bin/docker" <<'MOCK'
#!/usr/bin/env bash
set -eu
test "${FIXTURE_FAIL:-}" != backup
printf 'ciphertext fixture' > "$ZENIT_BACKUPS/$FIXTURE_FILE"
echo "RESPALDO CIFRADO: $FIXTURE_FILE; sha256 fixture."
MOCK
cat > "$work/bin/stat" <<'MOCK'
#!/usr/bin/env bash
set -eu
if [ "${FIXTURE_FAIL:-}" = large ]; then
  echo 5368709121
elif [ -n "${FIXTURE_SIZE:-}" ]; then
  echo "$FIXTURE_SIZE"
else
  exec "$FIXTURE_STAT" "$@"
fi
MOCK
cat > "$work/bin/aws" <<'MOCK'
#!/usr/bin/env bash
set -eu
test "$1" = --region && test "$2" = us-east-2
while [ "$1" != s3 ] && [ "$1" != s3api ]; do shift; done
if [ "$1" = s3 ]; then
  test "$2" = cp && test "$3" = "s3://$BACKUP_S3_BUCKET/zenit/$ZENIT_INSTANCE_ID/$FIXTURE_FILE" && test "$4" = -
  test "${FIXTURE_FAIL:-}" != download
  cat "$FIXTURE_REMOTE/$FIXTURE_FILE"
  if [ "${FIXTURE_FAIL:-}" = checksum ]; then echo altered; fi
elif [ "$2" = get-bucket-lifecycle-configuration ]; then
  test "$3" = --bucket && test "$4" = "$BACKUP_S3_BUCKET"
  test "${FIXTURE_FAIL:-}" != lifecycle
  cat "$FIXTURE_POLICY"
elif [ "$2" = put-object ]; then
  printf called > "$FIXTURE_REMOTE/upload-attempt"
  test "${FIXTURE_FAIL:-}" != upload
  test "$3" = --bucket && test "$4" = "$BACKUP_S3_BUCKET"
  test "$5" = --key && test "$6" = "zenit/$ZENIT_INSTANCE_ID/$FIXTURE_FILE"
  test "$7" = --body && test "$8" = "$ZENIT_BACKUPS/$FIXTURE_FILE"
  test "$9" = --if-none-match && test "${10}" = '*'
  test ! -e "$FIXTURE_REMOTE/$FIXTURE_FILE"
  cp "$8" "$FIXTURE_REMOTE/$FIXTURE_FILE"
else
  exit 1
fi
MOCK
chmod 700 "$work/bin/"*
export PATH="$work/bin:$PATH"
script=${1:?Indique respaldo.sh}
bash -n "$script"
python3 - "$FIXTURE_POLICY" <<'PY'
import json, sys
rules = [
    {"Status": "Enabled", "Filter": {"Prefix": "zenit/cliente-a/"}, "Expiration": {"Days": 30}, "NoncurrentVersionExpiration": {"NoncurrentDays": 30}},
    {"Status": "Enabled", "Filter": {"Prefix": "otra-instancia/"}, "Expiration": {"Days": 10}},
    {"Status": "Disabled", "Filter": {}, "Expiration": {"Days": 1}},
]
with open(sys.argv[1], "w") as target:
    json.dump({"Rules": rules}, target)
PY
cp "$FIXTURE_POLICY" "$work/valid.json"
for failure in lifecycle backup upload download checksum exists large; do
  rm -f "$FIXTURE_REMOTE/$FIXTURE_FILE" "$FIXTURE_REMOTE/upload-attempt"
  printf old > "$ZENIT_BACKUPS/zenit-old.tar.age"
  printf old > "$FIXTURE_REMOTE/zenit-old.tar.age"
  touch -d "@$(( $(date +%s) - 31 * 86400 ))" "$ZENIT_BACKUPS/zenit-old.tar.age" "$FIXTURE_REMOTE/zenit-old.tar.age"
  if [ "$failure" = exists ]; then printf previous > "$FIXTURE_REMOTE/$FIXTURE_FILE"; fi
  if FIXTURE_FAIL=$failure bash "$script" > "$work/output" 2>&1; then
    echo "Aceptó fallo de $failure" >&2; exit 1
  fi
  if [ "$failure" = exists ]; then test "$(cat "$FIXTURE_REMOTE/$FIXTURE_FILE")" = previous; fi
  if [ "$failure" = large ]; then
    test ! -e "$FIXTURE_REMOTE/upload-attempt"
    grep -q 'supera 5 GiB' "$work/output"
  fi
  test -f "$ZENIT_BACKUPS/zenit-old.tar.age"
  test -f "$FIXTURE_REMOTE/zenit-old.tar.age"
  test ! -e "$ZENIT_BACKUPS/.external-success"
  test ! -d "$ZENIT_BACKUPS/.external.lock"
done
for policy in missing duplicate wrong-prefix early broad-delete broad-and-delete malformed-prefix incomplete versions disabled invalid-json; do
  python3 - "$work/valid.json" "$FIXTURE_POLICY" "$policy" <<'PY'
import json, sys
with open(sys.argv[1]) as source:
    metadata = json.load(source)
rules = metadata["Rules"]
case = sys.argv[3]
if case == "missing": rules[0].pop("NoncurrentVersionExpiration")
elif case == "duplicate": rules.append(rules[0])
elif case == "wrong-prefix": rules[0]["Filter"]["Prefix"] = "zenit/otro-cliente/"
elif case == "early": rules[0]["Expiration"]["Days"] = 29
elif case == "broad-delete": rules.append({"Status": "Enabled", "Prefix": "", "Expiration": {"Days": 1}})
elif case == "broad-and-delete": rules.append({"Status": "Enabled", "Filter": {"And": {"Prefix": "zenit/", "Tags": [{"Key": "x", "Value": "y"}]}}, "Expiration": {"Days": 1}})
elif case == "malformed-prefix": rules.append({"Status": "Enabled", "Filter": {"Prefix": []}, "Expiration": {"Days": 1}})
elif case == "incomplete": rules[0]["Filter"] = {"And": {"Prefix": "zenit/cliente-a/", "Tags": [{"Key": "x", "Value": "y"}]}}
elif case == "versions": rules[0]["NoncurrentVersionExpiration"]["NewerNoncurrentVersions"] = 10
elif case == "disabled": rules[0]["Status"] = "Disabled"
with open(sys.argv[2], "w") as target:
    target.write("not json" if case == "invalid-json" else json.dumps(metadata))
PY
  if bash "$script" > "$work/output" 2>&1; then
    echo "Aceptó política S3 incorrecta: $policy" >&2; exit 1
  fi
  test -f "$ZENIT_BACKUPS/zenit-old.tar.age"
  test ! -e "$ZENIT_BACKUPS/.external-success"
done
cp "$work/valid.json" "$FIXTURE_POLICY"
rm -f "$FIXTURE_REMOTE/$FIXTURE_FILE"
printf unrelated > "$ZENIT_BACKUPS/other.tar.age"
touch -d "@$(( $(date +%s) - 31 * 86400 ))" "$ZENIT_BACKUPS/other.tar.age"
printf recent > "$ZENIT_BACKUPS/zenit-recent.tar.age"
touch -d "@$(( $(date +%s) - 29 * 86400 ))" "$ZENIT_BACKUPS/zenit-recent.tar.age"
FIXTURE_SIZE=5368709120 bash "$script" > "$work/output"
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
for invalid in s3://fixture 'bucket/con/ruta' 'bucket;comando'; do
  if BACKUP_S3_BUCKET="$invalid" bash "$script" > "$work/output" 2>&1; then
    echo 'Aceptó bucket inseguro' >&2; exit 1
  fi
done
if env -u BACKUP_S3_BUCKET BACKUP_GCS_BUCKET=fixture-bucket bash "$script" > "$work/output" 2>&1; then
  echo 'Aceptó configuración GCS anterior como si fuera AWS S3' >&2; exit 1
fi
mkdir "$ZENIT_BACKUPS/.external.lock"
if bash "$script" > "$work/output" 2>&1; then echo 'Aceptó concurrencia' >&2; exit 1; fi
echo 'AUTOPRUEBA EXTERNA CORRECTA: AWS S3, carga condicional, límite 5 GiB, huella, fallos, retención por prefijo, aislamiento y exclusión mutua.'
