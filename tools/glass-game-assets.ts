// ============================================================
// Glassworks asset staging — serve one canonical source tree to root web builds
// ============================================================
//
// The large gallery assets remain checked in once under Beside Cue. Root web
// builds copy only the shared manifest allowlist, while dev serves those same
// bytes directly and never writes a duplicate into public/.

import { GLASS_GAME_REQUIRED_FILES } from '@irchiinnuss/glass-game/assets'
import { closeSync, copyFileSync, createReadStream, existsSync, mkdirSync, openSync, readSync, statSync, } from 'node:fs'
import { dirname, extname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Plugin, ResolvedConfig } from 'vite'

const CONTENT_TYPES: Readonly<Record<string, string>> = {
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.bin': 'application/octet-stream',
  '.hdr': 'application/octet-stream',
  '.json': 'application/json; charset=utf-8',
  '.mp3': 'audio/mpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
}

const GIT_LFS_POINTER_HEADER = 'version https://git-lfs.github.com/spec/v1'
// Cloudflare Workers static assets are limited to 25 MiB per file. Keep the
// same delivery valid locally and in CI before an upload is attempted.
const MAX_STATIC_ASSET_BYTES = 25 * 1024 * 1024

function isGitLfsPointer(path: string): boolean {
  const descriptor = openSync(path, 'r')
  const probe = Buffer.alloc(GIT_LFS_POINTER_HEADER.length)
  try {
    const bytesRead = readSync(descriptor, probe, 0, probe.length, 0)
    return (
      probe.subarray(0, bytesRead).toString('utf8') === GIT_LFS_POINTER_HEADER
    )
  } finally {
    closeSync(descriptor)
  }
}

export function stageGlassGameAssets(
  sourceDirectory: string,
  outputDirectory: string,
  files: readonly string[] = GLASS_GAME_REQUIRED_FILES,
): void {
  for (const file of files) {
    const source = resolve(sourceDirectory, file)
    if (
      !existsSync(source) ||
      !statSync(source).isFile() ||
      statSync(source).size === 0
    )
      throw new Error(`Glassworks source asset is missing: ${file}`)
    if (isGitLfsPointer(source))
      throw new Error(`Glassworks source asset is a Git LFS pointer: ${file}`)
    if (statSync(source).size > MAX_STATIC_ASSET_BYTES)
      throw new Error(
        `Glassworks source asset exceeds the 25 MiB hosting limit: ${file}`,
      )
    const target = resolve(outputDirectory, file)
    mkdirSync(dirname(target), { recursive: true })
    copyFileSync(source, target)
  }
}

export function glassGameAssetsPlugin(options?: {
  sourceDirectory?: string
}): Plugin {
  const sourceDirectory =
    options?.sourceDirectory ??
    fileURLToPath(new URL('../apps/beside-cue/public/games/', import.meta.url))
  const allowed = new Set(GLASS_GAME_REQUIRED_FILES)
  let config: ResolvedConfig

  return {
    name: 'mercurypitch:glass-game-assets',
    configResolved(resolved) {
      config = resolved
    },
    configureServer(server) {
      server.middlewares.use('/glass-game-assets', (request, response) => {
        let file: string
        try {
          file = decodeURIComponent(
            (request.url ?? '').split('?')[0] ?? '',
          ).replace(/^\/+/, '')
        } catch {
          response.statusCode = 400
          response.end('Invalid asset path')
          return
        }
        if (!allowed.has(file)) {
          response.statusCode = 404
          response.end('Asset unavailable')
          return
        }
        const source = resolve(sourceDirectory, file)
        if (!existsSync(source) || !statSync(source).isFile()) {
          response.statusCode = 404
          response.end('Asset unavailable')
          return
        }
        response.setHeader(
          'Content-Type',
          CONTENT_TYPES[extname(file)] ?? 'application/octet-stream',
        )
        createReadStream(source).pipe(response)
      })
    },
    writeBundle(options) {
      stageGlassGameAssets(
        sourceDirectory,
        resolve(
          config.root,
          options.dir ?? config.build.outDir,
          'glass-game-assets',
        ),
      )
    },
  }
}
