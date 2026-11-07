// The browser suite's static server is `serve dist` (playwright.config.ts),
// and serve-handler 6.1.7 streams each file into its response with pipe(),
// which only unpipes the file when the response closes first. Every request
// a browser left before its file had all been sent, and every 304, kept a
// file descriptor open for good. A test that loads the app leaves about 87
// of the service worker's precache requests that way as its context
// closes, and on 7 Nov 2026 two of main's runs lost shard 4's server to
// EMFILE about 24 minutes in: every later navigation was refused. The repo
// patches serve-handler (patches/serve-handler@6.1.7.patch); these tests
// hold that every file it opens is closed with the response it was for.

import assert from 'node:assert/strict'
import { once } from 'node:events'
import { createReadStream, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import http from 'node:http'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

// serve-handler as serve loads it: the copy the browser suite's server runs
const require = createRequire(import.meta.url)
const handler = createRequire(require.resolve('serve/package.json'))(
  'serve-handler',
)

/** A file longer than the socket buffers hold, so a client can leave before it has it all. */
const BIG = 'big.bin'
const BIG_BYTES = 16 * 1024 * 1024

/**
 * Serves a folder with `big.bin` in it as `serve` does (ETags on), and keeps
 * every file stream the handler opens and each response's close.
 */
async function serveFolder(t) {
  const dir = mkdtempSync(join(tmpdir(), 'serve-file-streams-'))
  writeFileSync(join(dir, BIG), Buffer.alloc(BIG_BYTES, 7))
  const streams = []
  const closed = []
  const server = http.createServer((request, response) => {
    closed.push(new Promise((resolve) => response.once('close', resolve)))
    void handler(
      request,
      response,
      { public: dir, etag: true },
      {
        createReadStream: (path, options) => {
          const stream = createReadStream(path, options)
          streams.push(stream)
          return stream
        },
      },
    )
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  t.after(() => {
    server.close()
    rmSync(dir, { recursive: true, force: true })
  })
  const { port } = server.address()
  /**
   * Resolves once every response so far has closed, the tick after, and
   * every file stream the handler destroyed has closed its file. A stream
   * destroyed while its file was still opening, as a 304's can be, closes
   * once the open lands; until then the folder must stay, or the open lands
   * on a removed file after the test (seen under load on CI, 7 Nov 2026).
   * A stream nobody destroyed is not waited on: it stays open, and counts.
   */
  const settled = async () => {
    await Promise.all(closed)
    await new Promise((resolve) => setImmediate(resolve))
    await Promise.all(
      streams
        .filter((stream) => stream.destroyed && !stream.closed)
        .map((stream) => once(stream, 'close')),
    )
  }
  return { port, streams, settled }
}

/** A GET for big.bin; `leave` destroys it at its first chunk of body. */
function get(port, { leave = false, headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const request = http.get(
      { host: '127.0.0.1', port, path: `/${BIG}`, agent: false, headers },
      (response) => {
        if (leave) {
          response.once('data', () => {
            request.destroy()
            resolve(response)
          })
          return
        }
        response.resume()
        response.on('end', () => resolve(response))
      },
    )
    request.on('error', reject)
  })
}

const open = (streams) => streams.filter((s) => !s.destroyed).length

test('closes the file once it has all been sent', async (t) => {
  // Arrange
  const { port, streams, settled } = await serveFolder(t)

  // Act
  const response = await get(port)
  await settled()

  // Assert
  assert.equal(response.statusCode, 200)
  assert.ok(streams.length > 0)
  assert.equal(open(streams), 0)
})

test('closes the file when the client leaves before it has all been sent', async (t) => {
  // Arrange
  const { port, streams, settled } = await serveFolder(t)

  // Act
  const response = await get(port, { leave: true })
  await settled()

  // Assert
  assert.equal(response.statusCode, 200)
  assert.ok(streams.length > 0)
  assert.equal(open(streams), 0)
})

test('closes the file it opened for a 304', async (t) => {
  // Arrange
  const { port, streams, settled } = await serveFolder(t)
  const first = await get(port)
  const etag = first.headers.etag

  // Act
  const again = await get(port, { headers: { 'if-none-match': etag } })
  await settled()

  // Assert
  assert.ok(etag)
  assert.equal(again.statusCode, 304)
  assert.equal(open(streams), 0)
})
