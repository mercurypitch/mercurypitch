// ============================================================
// Playtest mounts — cold Vite requests through explicitly linked private galleries
// ============================================================

import fs from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { createServer, type ViteDevServer } from 'vite'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { glassPlaytestFileRoots } from './glass-playtest-files'

let fixture: string
let workspace: string
let appRoot: string
let gallery: string
let archive: string
const servers: ViteDevServer[] = []

function seed(path: string, content: string): void {
  fs.mkdirSync(dirname(path), { recursive: true })
  fs.writeFileSync(path, content)
}

beforeEach(() => {
  fixture = fs.mkdtempSync(join(tmpdir(), 'glass-playtest-mounts-'))
  workspace = join(fixture, 'workspace')
  appRoot = join(workspace, 'app')
  gallery = join(fixture, 'private-gallery')
  archive = join(fixture, 'archive')
  seed(join(workspace, 'package.json'), '{"private":true,"workspaces":["app"]}')
  seed(join(appRoot, 'index.html'), '<main>Playtest</main>')
  for (const [directory, marker] of [
    [appRoot, 'app-renderer'],
    [fixture, 'unrelated-renderer'],
  ]) {
    seed(
      join(directory, 'node_modules/three/package.json'),
      '{"name":"three","type":"module","exports":"./index.mjs"}',
    )
    seed(
      join(directory, 'node_modules/three/index.mjs'),
      `export const renderer = "${marker}";`,
    )
  }
})

afterEach(async () => {
  vi.restoreAllMocks()
  await Promise.all(servers.splice(0).map((server) => server.close()))
  fs.rmSync(fixture, { recursive: true, force: true })
})

function mountGallery(): void {
  seed(join(gallery, 'core.mjs'), 'export const title = "Cold gallery";')
  seed(
    join(gallery, 'preview.mjs'),
    'import { title } from "./core.mjs"; import { renderer } from "three"; document.title = title + renderer;',
  )
  seed(
    join(gallery, 'index.html'),
    '<script type="module" src="./preview.mjs?v=1"></script>',
  )
  seed(join(archive, 'model.glb'), 'local model bytes')
  fs.mkdirSync(join(appRoot, '.cache'), { recursive: true })
  fs.symlinkSync(gallery, join(appRoot, '.cache', 'gallery'), 'dir')
  fs.symlinkSync(archive, join(gallery, 'assets'), 'dir')
}

async function coldServer(allow: string[]): Promise<ViteDevServer> {
  const server = await createServer({
    root: appRoot,
    configFile: false,
    logLevel: 'silent',
    resolve: { dedupe: ['three'] },
    optimizeDeps: { noDiscovery: true, include: [] },
    server: {
      host: '127.0.0.1',
      port: 0,
      strictPort: true,
      hmr: false,
      watch: null,
      fs: { strict: true, allow },
    },
  })
  servers.push(server)
  await server.listen()
  return server
}

async function request(
  server: ViteDevServer,
  pathname: string,
): Promise<Response> {
  const address = server.httpServer?.address()
  if (!address || typeof address === 'string')
    throw new Error('No test HTTP listener')
  return fetch(`http://127.0.0.1:${address.port}${pathname}`, {
    headers: { Connection: 'close' },
    signal: AbortSignal.timeout(5000),
  })
}

describe('playtest file boundaries', () => {
  it('retains the workspace when no private cache exists', () => {
    expect(glassPlaytestFileRoots(appRoot)).toEqual([workspace])
  })

  it('allows mounted directories and their assets, without walking other links', () => {
    mountGallery()
    seed(
      join(fixture, 'unmounted', 'secret.mjs'),
      'export const secret = true;',
    )
    fs.symlinkSync(
      join(fixture, 'unmounted'),
      join(gallery, 'other-link'),
      'dir',
    )
    seed(
      join(appRoot, '.cache', 'local-gallery', 'index.html'),
      '<main>Local</main>',
    )
    seed(join(appRoot, '.cache', 'note.txt'), 'not a directory')
    fs.symlinkSync(
      join(appRoot, '.cache', 'note.txt'),
      join(appRoot, '.cache', 'file-link'),
    )
    fs.symlinkSync(
      join(fixture, 'missing'),
      join(appRoot, '.cache', 'broken'),
      'dir',
    )
    expect(glassPlaytestFileRoots(appRoot).sort()).toEqual(
      [
        workspace,
        gallery,
        archive,
        join(appRoot, '.cache', 'local-gallery'),
      ].sort(),
    )
  })

  it('accepts a gallery with a missing or broken optional assets mount', () => {
    mountGallery()
    fs.unlinkSync(join(gallery, 'assets'))
    expect(glassPlaytestFileRoots(appRoot)).toEqual([workspace, gallery])
    fs.symlinkSync(
      join(fixture, 'missing-assets'),
      join(gallery, 'assets'),
      'dir',
    )
    expect(glassPlaytestFileRoots(appRoot)).toEqual([workspace, gallery])
  })

  it('surfaces filesystem permission errors instead of masking a broken mount', () => {
    const error = Object.assign(new Error('Cannot inspect cache'), {
      code: 'EACCES',
    })
    vi.spyOn(fs, 'readdirSync').mockImplementation(() => {
      throw error
    })
    expect(() => glassPlaytestFileRoots(appRoot)).toThrow(error)
  })

  it('surfaces mount resolution failures other than a missing link', () => {
    mountGallery()
    fs.symlinkSync('cycle', join(appRoot, '.cache', 'cycle'), 'dir')
    expect(() => glassPlaytestFileRoots(appRoot)).toThrow(/ELOOP/)
  })
})

describe('cold Vite gallery transforms', () => {
  it('reproduces the former missing-file error despite an existing symlink target', async () => {
    mountGallery()
    const server = await coldServer([workspace])
    await expect(
      server.transformRequest('/.cache/gallery/preview.mjs?v=1'),
    ).rejects.toThrow('Failed to load url')
    expect(fs.existsSync(join(gallery, 'preview.mjs'))).toBe(true)
    expect(
      (await request(server, `/@fs${gallery}/preview.mjs?v=1`)).status,
    ).toBe(403)
  })

  it('transforms the first query-string request on repeated fresh starts and keeps unrelated files denied', async () => {
    mountGallery()
    seed(
      join(fixture, 'unmounted', 'secret.mjs'),
      'export const secret = true;',
    )
    for (let start = 0; start < 2; start++) {
      const server = await coldServer(glassPlaytestFileRoots(appRoot))
      // No HTML or alternate import may prime Vite's safeModulePaths first.
      const response = await request(server, '/.cache/gallery/preview.mjs?v=1')
      expect(response.status).toBe(200)
      const module = await response.text()
      expect(module).toContain(`/@fs${gallery}/core.mjs`)
      expect(module).toContain('/node_modules/three/index.mjs')
      expect(
        await (await request(server, '/node_modules/three/index.mjs')).text(),
      ).toContain('app-renderer')
      expect((await request(server, `/@fs${gallery}/core.mjs`)).status).toBe(
        200,
      )
      expect(
        await (await request(server, `/@fs${archive}/model.glb?v=1`)).text(),
      ).toBe('local model bytes')
      expect(
        (await request(server, `/@fs${fixture}/unmounted/secret.mjs`)).status,
      ).toBe(403)
      expect((await request(server, '/.cache/gallery/index.html')).status).toBe(
        200,
      )
      await server.close()
      servers.splice(servers.indexOf(server), 1)
    }
  })
})
