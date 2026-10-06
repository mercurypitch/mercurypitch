// Real HTTP delivery preserves APK bytes, installable names, resume requests and missing-file errors.
import fs from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createServer, type ViteDevServer } from 'vite'
import { afterAll, beforeAll, expect, it } from 'vitest'
import { glassPlaytestDownloads } from './glass-playtest-downloads'

let root: string
let server: ViteDevServer
let base: string
const bytes = Buffer.from('PK\u0003\u0004signed Android package fixture')
beforeAll(async () => {
  root = await fs.mkdtemp(join(tmpdir(), 'glass-apk-download-'))
  await fs.mkdir(join(root, '.cache/native-delivery'), { recursive: true })
  await fs.writeFile(
    join(root, '.cache/native-delivery/besidecue-build-832.apk'),
    bytes,
  )
  await fs.writeFile(join(root, 'index.html'), '<main>Preview</main>')
  server = await createServer({
    root,
    configFile: false,
    logLevel: 'silent',
    plugins: [glassPlaytestDownloads()],
    optimizeDeps: { noDiscovery: true },
    server: {
      host: '127.0.0.1',
      port: 0,
      hmr: false,
      watch: null,
      fs: { strict: true, allow: [root] },
    },
  })
  await server.listen()
  const address = server.httpServer!.address()
  if (!address || typeof address === 'string')
    throw new Error('No test listener')
  base = `http://127.0.0.1:${address.port}`
})
afterAll(async () => {
  await server?.close()
  await fs.rm(root, { recursive: true, force: true })
})
function request(path: string, init?: RequestInit) {
  return fetch(`${base}${path}`, {
    ...init,
    headers: { Connection: 'close', ...init?.headers },
    signal: AbortSignal.timeout(5000),
  })
}
const apkPath = '/.cache/native-delivery/besidecue-build-832.apk'
it.each(['GET', 'HEAD'])(
  'identifies an installable APK for %s, without an outer archive',
  async (method) => {
    const response = await request(`${apkPath}?download=1`, { method })
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe(
      'application/vnd.android.package-archive',
    )
    expect(response.headers.get('content-disposition')).toBe(
      'attachment; filename="besidecue-build-832.apk"',
    )
    expect(response.headers.get('x-content-type-options')).toBe('nosniff')
    expect(response.headers.get('content-length')).toBe(String(bytes.length))
    expect(Buffer.from(await response.arrayBuffer())).toEqual(
      method === 'HEAD' ? Buffer.alloc(0) : bytes,
    )
  },
)
it('keeps resumable downloads byte-correct', async () => {
  const response = await request(apkPath, { headers: { Range: 'bytes=4-11' } })
  expect(response.status).toBe(206)
  expect(response.headers.get('content-range')).toBe(
    `bytes 4-11/${bytes.length}`,
  )
  expect(response.headers.get('content-disposition')).toContain('.apk"')
  expect(Buffer.from(await response.arrayBuffer())).toEqual(
    bytes.subarray(4, 12),
  )
})
it('returns 404 for a missing build instead of downloading the app shell', async () => {
  const response = await request(
    '/.cache/native-delivery/besidecue-build-999.apk',
  )
  expect(response.status).toBe(404)
  expect(response.headers.get('content-disposition')).toBeNull()
  expect(await response.text()).not.toContain('<main>Preview</main>')
})
it('leaves ordinary preview documents inline', async () => {
  const response = await request('/index.html')
  expect(response.headers.get('content-type')).toContain('text/html')
  expect(response.headers.get('content-disposition')).toBeNull()
})
