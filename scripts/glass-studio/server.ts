// Private studio bridge — fixed-root static files and bounded, read-only course compilation.

import { createServer, type IncomingMessage, type ServerResponse, } from 'node:http'
import { readFile, realpath } from 'node:fs/promises'
import { extname, relative, resolve, sep } from 'node:path'
import { CLOUDWAY_STUDIO_LIMITS, cloudwayStudioCatalog, compileStudioDocument, summarizeStudioDocument, } from '../../packages/glass-game/src/authoring/cloudway-studio.ts'

class RequestError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

function send(res: ServerResponse, status: number, value: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(value))
}

async function body(req: IncomingMessage): Promise<unknown> {
  if (req.headers['content-type']?.split(';')[0].trim() !== 'application/json')
    throw new RequestError(415, 'Send a JSON course document.')
  const chunks: Buffer[] = []
  let size = 0
  await new Promise<void>((done, reject) => {
    req.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size > CLOUDWAY_STUDIO_LIMITS.maxBytes) {
        chunks.length = 0
        reject(new RequestError(413, 'Course document is too large.'))
      } else chunks.push(chunk)
    })
    req.on('end', done)
    req.on('error', reject)
    req.on('aborted', () =>
      reject(new RequestError(400, 'Upload interrupted.')),
    )
  })
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    throw new RequestError(400, 'Course document is not valid JSON.')
  }
}

const types: Readonly<Record<string, string>> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
}

export interface StudioServerOptions {
  /** Explicit private editor directory. Requests can never select another root. */
  root: string
  /** Exact hostnames/IPs; the listening socket's port is checked independently. */
  hosts?: readonly string[]
}

/** No CORS, writes, command execution or arbitrary filesystem/API proxying. */
export async function createStudioServer(options: StudioServerOptions) {
  const root = await realpath(options.root)
  const hosts = new Set(options.hosts ?? ['127.0.0.1', 'localhost', '[::1]'])
  const server = createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store')
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin')
    res.setHeader(
      'Content-Security-Policy',
      "frame-ancestors 'none'; object-src 'none'",
    )
    try {
      const address = server.address()
      const port = typeof address === 'object' && address ? address.port : 0
      const origin = new URL(`http://${req.headers.host ?? ''}`)
      if (!hosts.has(origin.hostname) || Number(origin.port || '80') !== port)
        throw new RequestError(403, 'Unknown studio host.')
      if (req.headers.origin && req.headers.origin !== origin.origin)
        throw new RequestError(403, 'Use the studio from its own browser tab.')
      const url = new URL(req.url ?? '/', origin)
      if (req.method === 'GET' && url.pathname === '/api/catalog') {
        send(res, 200, cloudwayStudioCatalog())
        return
      }
      if (
        req.method === 'POST' &&
        ['/api/validate', '/api/compile'].includes(url.pathname)
      ) {
        const source = await body(req)
        try {
          send(
            res,
            200,
            url.pathname === '/api/compile'
              ? { ok: true, levels: compileStudioDocument(source) }
              : { ok: true, courses: summarizeStudioDocument(source) },
          )
        } catch (error) {
          send(res, 422, {
            ok: false,
            error:
              error instanceof Error
                ? error.message
                : 'Invalid course document.',
          })
        }
        return
      }
      if (url.pathname.startsWith('/api/'))
        throw new RequestError(404, 'Unknown studio operation.')
      if (req.method !== 'GET' && req.method !== 'HEAD')
        throw new RequestError(405, 'Only reading studio files is allowed.')
      let pathname: string
      try {
        pathname = decodeURIComponent(url.pathname)
      } catch {
        throw new RequestError(400, 'Invalid file path.')
      }
      const filename = resolve(
        root,
        `.${pathname === '/' ? '/index.html' : pathname}`,
      )
      const inside = relative(root, filename)
      if (
        inside.startsWith(`..${sep}`) ||
        inside === '..' ||
        inside.includes('\0')
      )
        throw new RequestError(404, 'Studio file not found.')
      let actual: string
      try {
        actual = await realpath(filename)
      } catch {
        throw new RequestError(404, 'Studio file not found.')
      }
      const resolved = relative(root, actual)
      if (
        resolved.startsWith(`..${sep}`) ||
        resolved === '..' ||
        !types[extname(actual)]
      )
        throw new RequestError(404, 'Studio file not found.')
      const data = await readFile(actual)
      res.writeHead(200, { 'Content-Type': types[extname(actual)]! })
      res.end(req.method === 'HEAD' ? undefined : data)
    } catch (error) {
      send(res, error instanceof RequestError ? error.status : 400, {
        ok: false,
        error:
          error instanceof RequestError
            ? error.message
            : 'The studio could not read that request.',
      })
    }
  })
  server.requestTimeout = 15_000
  server.headersTimeout = 10_000
  return server
}
