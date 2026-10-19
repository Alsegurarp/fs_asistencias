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
