import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import test from 'node:test'

// Requiere: docker build -t fastsolution-despliegue:1 deploy/servidor/herramienta
function run(script) {
  const result = spawnSync('docker', ['run', '--rm', '--network', 'none', '--read-only',
    '--cap-drop=ALL', '--security-opt=no-new-privileges:true', '--tmpfs',
    '/tmp:uid=10001,gid=10001,mode=1777', '--entrypoint', 'sh',
    'fastsolution-despliegue:1', '-c', script], { encoding: 'utf8', timeout: 30000 })
  assert.ifError(result.error)
  assert.equal(result.status, 0, result.stdout + result.stderr)
  return result.stdout + result.stderr
}

test('herramienta sin privilegios, con curl corregido y utilidades de despliegue', () => {
  const output = run('set -e; test "$(id -u)" = 10001; bash -n /usr/local/bin/herramienta; curl --version; ssh -V; rsync --version')
  assert.match(output, /curl 8\.23\.0 /)
  assert.doesNotMatch(output, /libssh2/)
  assert.match(output, /OpenSSH_/)
  assert.match(output, /rsync\s+version/)
})

test('comprobar acepta HTTP correcto y rechaza una respuesta distinta', () => {
  const output = run(`set -e
    for n in 1 2; do
      printf 'HTTP/1.1 200 OK\r\nContent-Length: 5\r\nConnection: close\r\n\r\nZenit' | nc -l -p 18081 > /dev/null
    done &
    server=$!
    trap 'kill "$server" 2>/dev/null || true' EXIT
    set +e
    printf 'GET http://127.0.0.1:18081 200 Zenit\nGET http://127.0.0.1:18081 418\n' | /usr/local/bin/herramienta comprobar
    result=$?
    test "$result" = 1`)
  assert.match(output, /bien\s+200 GET/)
  assert.match(output, /respondió 200, se esperaba 418/)
})
