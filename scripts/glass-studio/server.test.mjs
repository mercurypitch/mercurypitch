// Studio HTTP tests — real sockets prove host, origin, file boundary and compiler contracts.
import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { mkdtemp, writeFile, symlink, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { once } from 'node:events'
import { request } from 'node:http'
import { createStudioServer } from './server.ts'

let root, server, origin
before(async () => {
  root = await mkdtemp(join(tmpdir(), 'glass-studio-test-'))
  await writeFile(join(root, 'index.html'), '<h1>Private editor</h1>')
  await symlink('/etc/hosts', join(root, 'escape.json'))
  server = await createStudioServer({ root })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  origin = `http://127.0.0.1:${server.address().port}`
})
after(async () => {
  server.closeAllConnections()
  await new Promise((resolve) => server.close(resolve))
  await rm(root, { recursive: true, force: true })
})

test('serves the fixed private root and real compiler catalogue', async () => {
  assert.match(await (await fetch(origin)).text(), /Private editor/)
  const catalog = await (await fetch(`${origin}/api/catalog`)).json()
  assert.equal(catalog.schema, 'mercurypitch.cloudway-studio-catalog')
  for (const operation of ['validate', 'compile']) {
    const response = await fetch(`${origin}/api/${operation}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin },
      body: JSON.stringify(catalog.examples[0].document),
    })
    assert.equal(response.status, 200)
    const result = await response.json()
    assert.equal(result.ok, true)
    assert.equal(
      (result.levels ?? result.courses)[0].id,
      'cloudway-thawing-song-audition',
    )
  }
})

test('rejects unknown hosts, cross-origin posts, writes and escaping symlinks', async () => {
  // Fetch normalizes Host; use the real HTTP boundary for the DNS-rebinding case.
  const status = await new Promise((resolve, reject) => {
    const req = request(
      `${origin}/api/catalog`,
      { headers: { host: 'evil.test' } },
      (res) => {
        res.resume()
        resolve(res.statusCode)
      },
    )
    req.on('error', reject)
    req.end()
  })
  assert.equal(status, 403)
  assert.equal(
    (
      await fetch(`${origin}/api/validate`, {
        method: 'POST',
        headers: { origin: 'https://evil.test' },
      })
    ).status,
    403,
  )
  assert.equal(
    (await fetch(`${origin}/index.html`, { method: 'PUT', body: 'changed' }))
      .status,
    405,
  )
  assert.equal((await fetch(`${origin}/escape.json`)).status, 404)
  assert.equal((await fetch(`${origin}/api/write`)).status, 404)
  assert.match(await (await fetch(origin)).text(), /Private editor/)
})

test('distinguishes invalid JSON, oversize documents and compiler rejection', async () => {
  const post = (body) =>
    fetch(`${origin}/api/validate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
    })
  assert.equal((await post('{')).status, 400)
  assert.equal((await post(' '.repeat(1_000_001))).status, 413)
  const invalid = await post('{}')
  assert.equal(invalid.status, 422)
  assert.match((await invalid.json()).error, /courses/)
  assert.equal(
    (await fetch(`${origin}/api/validate`, { method: 'POST', body: '{}' }))
      .status,
    415,
  )
})
