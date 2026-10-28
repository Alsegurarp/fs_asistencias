import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const line = readFileSync(new URL('../../compose.yaml', import.meta.url), 'utf8').split('\n').find(line => line.includes('GET /health/ready'))
const command = JSON.parse(line.trim().slice('test: '.length))[3].replaceAll('$$', '$')
const predicate = command.split('>&3 && ')[1]
assert.ok(predicate)
for (const [status, healthy] of [[200, true], [503, false]]) {
  test(`readiness HTTP ${status}: no confunde un componente UP con la salud global`, { skip: !process.env.IDENTITY_TEST_SECRETOS }, () => {
    const body = JSON.stringify({ status: healthy ? 'UP' : 'DOWN', checks: [{ status: 'UP' }] }, null, 2)
    const response = `HTTP/1.1 ${status} Test\r\nContent-Type: application/json\r\n\r\n${body}\n`
    const result = spawnSync('docker', ['run', '--rm', '-i', '--network', 'none', '--read-only', '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges', '--entrypoint', 'bash', 'zenit-identity-check-keycloak', '-c', `exec 3<&0; ${predicate}`], { input: response, encoding: 'utf8', timeout: 15000 })
    assert.ifError(result.error)
    assert.equal(result.status, healthy ? 0 : 1, result.stderr)
  })
}

test('runtime sin privilegios conserva Java, certificados y Guava corregidos', {
  skip: !process.env.IDENTITY_TEST_SECRETOS,
}, () => {
  const result = spawnSync('docker', ['run', '--rm', '--network', 'none', '--read-only', '--tmpfs', '/tmp', '--cap-drop', 'ALL',
    '--security-opt', 'no-new-privileges', '--entrypoint', 'bash', 'zenit-identity-check-keycloak', '-ec',
    'test "$(id -u)" = 1000; java -version; sha256sum "$JAVA_HOME/lib/security/blocked.certs"; test "$(find /opt/keycloak/lib/lib/main -name "com.google.guava.guava-*.jar" | wc -l)" = 1; sha256sum /opt/keycloak/lib/lib/main/com.google.guava.guava-33.6.0-jre.jar'],
  { encoding: 'utf8', timeout: 15000 })
  assert.ifError(result.error)
  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stderr, /java version "25\.0\.5\.0\.2"/)
  // Lista completa publicada en https://docs.azul.com/core/emudhra-workaround.html.
  assert.equal(result.stdout.trim().split(/\s+/)[0], '2596bb6dda83c66d96c5a252d7b2ae1f24cc1ae3f1890223b4f3591a8d52bf10')
  assert.equal(result.stdout.trim().split('\n')[1].split(/\s+/)[0], 'b530942257fb935f8b2cfaa5f8eb5bd59c555fd8e8d01b8ce98912e077ea606c')
})
