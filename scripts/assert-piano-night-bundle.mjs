// Piano Night bundle audit proves the standalone entry stays outside heavy app graphs.
// ============================================================
//
// Run after `pnpm build`:
//   node scripts/assert-piano-night-bundle.mjs
//
// Chunk names alone are not evidence: Rollup may co-locate an unexpected
// module inside an innocently named shared chunk. This audit starts at the
// emitted Piano Night document, follows only static ESM edges, then checks
// every source listed by those chunks' source maps. Dynamic imports are
// deliberately outside the graph so intent-loaded Score or workbench code can
// remain available without becoming first-paint work.

import { readFile, stat } from 'node:fs/promises'
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(SCRIPT_DIR, '..')

const FORBIDDEN_SOURCES = [
  {
    label: 'main application entry',
    pattern: /(?:^|\/)src\/(?:App|index)\.tsx$/,
  },
  {
    label: 'main application store',
    pattern: /(?:^|\/)src\/stores\//,
  },
  {
    label: 'main application page',
    pattern: /(?:^|\/)src\/pages\//,
  },
  {
    label: 'VexFlow or notation renderer',
    pattern:
      /(?:^|\/)(?:node_modules\/.*\/vexflow\/|src\/(?:components\/SheetMusicView|lib\/sheet-music-(?:fonts|renderer))\.)/i,
  },
  {
    label: 'soundbank parser or installer',
    pattern:
      /(?:^|\/)src\/.*(?:soundbank|bank-parser|mercury-bank|sfz-parser|sf2-parser)/i,
  },
  {
    label: 'arranger implementation',
    pattern: /(?:^|\/)src\/.*arranger/i,
  },
]

const FORBIDDEN_CHUNK_NAMES = [
  {
    label: 'main application entry chunk',
    pattern: /(?:^|\/)index-[^/]+\.js$/,
  },
  {
    label: 'VexFlow chunk',
    pattern: /(?:^|\/)vendor-vexflow-[^/]+\.js$/i,
  },
  {
    label: 'soundbank parser or installer chunk',
    pattern: /(?:soundbank|bank-parser|mercury-bank|sfz-parser|sf2-parser)/i,
  },
  {
    label: 'arranger chunk',
    pattern: /arranger/i,
  },
]

function normalizePath(path) {
  return path.replaceAll('\\', '/')
}

function quotedAssetUrls(html) {
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
  const fromPattern =
    /\b(?:import|export)\s*[^"'();]*?\bfrom\s*["']([^"']+)["']/g
  const sideEffectPattern = /\bimport\s*["']([^"']+)["']/g

  for (const pattern of [fromPattern, sideEffectPattern]) {
    let match = pattern.exec(source)
    while (match !== null) {
      specifiers.add(match[1])
      match = pattern.exec(source)
    }
  }

  return [...specifiers]
}

function sourceMapSpecifier(source) {
  const matches = [...source.matchAll(/sourceMappingURL=([^\s]+)/g)]
  return matches.at(-1)?.[1] ?? null
}

function assertInsideDist(path, distDir) {
  const rel = relative(distDir, path)
  if (rel === '' || (!rel.startsWith(`..${sep}`) && rel !== '..')) return
  throw new Error(`Static import escaped dist: ${normalizePath(path)}`)
}

function resolveEntryAsset(urlPath, distDir) {
  const path = resolve(distDir, `.${urlPath}`)
  assertInsideDist(path, distDir)
  return path
}

function resolveStaticImport(specifier, importer, distDir) {
  if (specifier.startsWith('/')) return resolveEntryAsset(specifier, distDir)
  if (!specifier.startsWith('.')) return null

  const path = resolve(dirname(importer), specifier)
  assertInsideDist(path, distDir)
  return path
}

async function readSourceMap(chunkPath, source) {
  const specifier = sourceMapSpecifier(source)
  if (specifier === null) {
    throw new Error(
      `Cannot prove Piano Night's bundle boundary: ${normalizePath(chunkPath)} has no source map.`,
    )
  }

  const mapPath = resolve(dirname(chunkPath), specifier)
  const map = JSON.parse(await readFile(mapPath, 'utf8'))
  if (!Array.isArray(map.sources)) {
    throw new Error(
      `Cannot prove Piano Night's bundle boundary: ${normalizePath(mapPath)} has no sources array.`,
    )
  }
  return map.sources.filter((entry) => typeof entry === 'string')
}

export async function auditPianoNightBundle(distDirectory = 'dist') {
  const distDir = isAbsolute(distDirectory)
    ? resolve(distDirectory)
    : resolve(REPO_ROOT, distDirectory)
  const documentPath = resolve(distDir, 'piano-night.html')
  const html = await readFile(documentPath, 'utf8')
  const roots = quotedAssetUrls(html).map((url) =>
    resolveEntryAsset(url, distDir),
  )

  if (roots.length === 0) {
    throw new Error('dist/piano-night.html has no emitted JavaScript entry.')
  }

  const queue = [...roots]
  const chunks = new Set()
  const sourcesByChunk = new Map()
  let staticBytes = 0

  while (queue.length > 0) {
    const chunkPath = queue.shift()
    if (chunkPath === undefined || chunks.has(chunkPath)) continue
    chunks.add(chunkPath)

    const source = await readFile(chunkPath, 'utf8')
    staticBytes += (await stat(chunkPath)).size
    sourcesByChunk.set(chunkPath, await readSourceMap(chunkPath, source))

    for (const specifier of staticImportSpecifiers(source)) {
      const dependency = resolveStaticImport(specifier, chunkPath, distDir)
      if (dependency !== null && !chunks.has(dependency)) queue.push(dependency)
    }
  }

  const violations = []
  for (const chunkPath of chunks) {
    const displayChunk = normalizePath(relative(distDir, chunkPath))
    for (const rule of FORBIDDEN_CHUNK_NAMES) {
      if (rule.pattern.test(displayChunk)) {
        violations.push(`${rule.label}: ${displayChunk}`)
      }
    }

    for (const source of sourcesByChunk.get(chunkPath) ?? []) {
      const displaySource = normalizePath(source)
      for (const rule of FORBIDDEN_SOURCES) {
        if (rule.pattern.test(displaySource)) {
          violations.push(
            `${rule.label}: ${displaySource} (via ${displayChunk})`,
          )
        }
      }
    }
  }

  if (violations.length > 0) {
    throw new Error(
      `Piano Night first-paint bundle crossed forbidden boundaries:\n${[
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
    const result = await auditPianoNightBundle(process.argv[2] ?? 'dist')
    console.log(
      `Piano Night bundle boundary passed: ${result.chunks} static chunks, ${result.mappedSources} mapped sources, ${result.staticBytes} bytes.`,
    )
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}
