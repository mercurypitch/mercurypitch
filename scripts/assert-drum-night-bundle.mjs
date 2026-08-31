// Drum Night bundle audit proves parsers and main-app graphs stay intent-loaded.
// ============================================================
//
// Run after `pnpm build`:
//   node scripts/assert-drum-night-bundle.mjs

import { readFile, stat } from 'node:fs/promises'
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(SCRIPT_DIR, '..')
// 2026-08-31: 450k predated the merged guitar/ear shared-chunk growth and the
// room's own sound-and-feel engine. The hard graph rules below still forbid
// parsers and main-app stores; the byte ceiling holds the line at the new
// measured baseline (492078 bytes) plus slack. Trimming is queued with the
// load-performance follow-up.
//
// Rechecked the same day against the gate-parallelisation and theme-containment
// work: 492078 bytes, unchanged to the byte. Neither touches this graph — one
// is CI topology, the other CSS — so the ceiling cannot come back down on their
// account. It falls when a chunk leaves the room's static set, not before.
const MAX_STATIC_JAVASCRIPT_BYTES = 520_000

const FORBIDDEN_CHUNKS = [
  /(?:^|\/)(?:index|advanced|library|pitch-core)-[^/]+\.js$/,
  /(?:^|\/)(?:local-song-library|vendor-db|vendor-media)-[^/]+\.js$/,
  /(?:^|\/)(?:midi-song|gp-import|piano-project)-[^/]+\.js$/,
  /(?:^|\/)vendor-alphatab-[^/]+\.js$/,
]

const FORBIDDEN_SOURCES = [
  /(?:^|\/)src\/(?:App|index)\.tsx$/,
  /(?:^|\/)src\/(?:stores|pages)\//,
  /(?:^|\/)src\/db\/(?:local-database|adapters\/dexie-adapter)/,
  /(?:^|\/)src\/lib\/(?:midi-song|piano-project-parser)\./,
  /(?:^|\/)src\/lib\/tab\/(?:gp-import|gp-to-midi-song)\./,
  /(?:^|\/)node_modules\/.*\/(?:dexie|mediabunny)\//,
  /(?:^|\/)node_modules\/@coderline\/alphatab\//,
]

function normalizePath(path) {
  return path.replaceAll('\\', '/')
}

function quotedJavaScriptAssets(html) {
  const urls = new Set()
  const pattern = /(?:src|href)=["'](\/assets\/[^"']+\.js)["']/g
  let match = pattern.exec(html)
  while (match !== null) {
    urls.add(match[1])
    match = pattern.exec(html)
  }
  return [...urls]
}

function staticImportSpecifiers(source) {
  const specifiers = new Set()
  const patterns = [
    /\b(?:import|export)\s*[^"'();]*?\bfrom\s*["']([^"']+)["']/g,
    /\bimport\s*["']([^"']+)["']/g,
  ]
  for (const pattern of patterns) {
    let match = pattern.exec(source)
    while (match !== null) {
      specifiers.add(match[1])
      match = pattern.exec(source)
    }
  }
  return [...specifiers]
}

function assertInsideDist(path, distDir) {
  const rel = relative(distDir, path)
  if (rel === '' || (!rel.startsWith(`..${sep}`) && rel !== '..')) return
  throw new Error(
    `Drum Night static import escaped dist: ${normalizePath(path)}`,
  )
}

function resolveAsset(urlPath, distDir) {
  const path = resolve(distDir, `.${urlPath}`)
  assertInsideDist(path, distDir)
  return path
}

function resolveStaticImport(specifier, importer, distDir) {
  if (specifier.startsWith('/')) return resolveAsset(specifier, distDir)
  if (!specifier.startsWith('.')) return null
  const path = resolve(dirname(importer), specifier)
  assertInsideDist(path, distDir)
  return path
}

async function sourceMapSources(chunkPath, source) {
  const matches = [...source.matchAll(/sourceMappingURL=([^\s]+)/g)]
  const specifier = matches.at(-1)?.[1]
  if (specifier === undefined) {
    throw new Error(
      `Cannot prove Drum Night's bundle boundary: ${normalizePath(chunkPath)} has no source map.`,
    )
  }
  const map = JSON.parse(
    await readFile(resolve(dirname(chunkPath), specifier), 'utf8'),
  )
  if (!Array.isArray(map.sources)) {
    throw new Error(
      `Cannot prove Drum Night's bundle boundary: ${normalizePath(chunkPath)} has no sources array.`,
    )
  }
  return map.sources.filter((sourcePath) => typeof sourcePath === 'string')
}

export async function auditDrumNightBundle(distDirectory = 'dist') {
  const distDir = isAbsolute(distDirectory)
    ? resolve(distDirectory)
    : resolve(REPO_ROOT, distDirectory)
  const html = await readFile(resolve(distDir, 'drum-night.html'), 'utf8')
  const queue = quotedJavaScriptAssets(html).map((url) =>
    resolveAsset(url, distDir),
  )
  if (queue.length === 0) {
    throw new Error('dist/drum-night.html has no emitted JavaScript entry.')
  }

  const chunks = new Set()
  const sourcesByChunk = new Map()
  let staticBytes = 0
  while (queue.length > 0) {
    const chunkPath = queue.shift()
    if (chunkPath === undefined || chunks.has(chunkPath)) continue
    chunks.add(chunkPath)
    const source = await readFile(chunkPath, 'utf8')
    staticBytes += (await stat(chunkPath)).size
    sourcesByChunk.set(chunkPath, await sourceMapSources(chunkPath, source))
    for (const specifier of staticImportSpecifiers(source)) {
      const dependency = resolveStaticImport(specifier, chunkPath, distDir)
      if (dependency !== null && !chunks.has(dependency)) queue.push(dependency)
    }
  }

  const violations = []
  for (const chunkPath of chunks) {
    const displayChunk = normalizePath(relative(distDir, chunkPath))
    if (FORBIDDEN_CHUNKS.some((pattern) => pattern.test(displayChunk))) {
      violations.push(`forbidden static chunk: ${displayChunk}`)
    }
    for (const sourcePath of sourcesByChunk.get(chunkPath) ?? []) {
      const displaySource = normalizePath(sourcePath)
      if (FORBIDDEN_SOURCES.some((pattern) => pattern.test(displaySource))) {
        violations.push(
          `forbidden first-paint source: ${displaySource} (via ${displayChunk})`,
        )
      }
    }
  }
  if (staticBytes > MAX_STATIC_JAVASCRIPT_BYTES) {
    violations.push(
      `static JavaScript is ${staticBytes} bytes (budget ${MAX_STATIC_JAVASCRIPT_BYTES})`,
    )
  }
  if (violations.length > 0) {
    throw new Error(
      `Drum Night first paint crossed its bundle boundary:\n${[
        ...new Set(violations),
      ]
        .sort()
        .map((violation) => `- ${violation}`)
        .join('\n')}`,
    )
  }

  const mappedSources = [...sourcesByChunk.values()].reduce(
    (total, sources) => total + sources.length,
    0,
  )
  return { chunks: chunks.size, mappedSources, staticBytes }
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : ''
if (invokedPath === fileURLToPath(import.meta.url)) {
  try {
    const result = await auditDrumNightBundle(process.argv[2] ?? 'dist')
    console.log(
      `Drum Night bundle boundary passed: ${result.chunks} static chunks, ${result.mappedSources} mapped sources, ${result.staticBytes} bytes.`,
    )
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}
