// ============================================================
// Encode Drum Night formats — maintain Opus siblings and catalog hashes
// ============================================================
//
// Default mode transactionally refreshes source/public catalog JSON and the
// two source-only runtime projections after assets encode. `--assets-only` is
// the migration bridge from schema 1; `--check` re-encodes all resources and
// byte-verifies every generated JSON file without modifying the repository.

import { existsSync, readFileSync, renameSync, rmSync, writeFileSync, } from 'node:fs'
import { dirname, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { serializeDrumKitCatalogProjections, serializeDrumKitGeneratedJson, } from './drum-kit-catalog-projections.mjs'
import { encodeDrumKitOpusCatalog, verifyDrumKitOpusCatalog, } from './drum-kit-opus.mjs'

const scriptDirectory = dirname(fileURLToPath(import.meta.url))
const repo = resolve(scriptDirectory, '..')
const publicRoot = resolve(repo, 'public/drum-night/kits')
const sourceCatalogPath = resolve(
  repo,
  'src/features/drum-night/audio/drum-kit-resources.generated.json',
)
const runtimeProjectionPath = resolve(
  repo,
  'src/features/drum-night/audio/drum-kit-runtime.generated.json',
)
const opusProjectionPath = resolve(
  repo,
  'src/features/drum-night/audio/drum-kit-opus.generated.json',
)
const publicCatalogPath = resolve(publicRoot, 'catalog.json')

const args = new Set(process.argv.slice(2))
const checkOnly = args.has('--check')
const assetsOnly = args.has('--assets-only')
const unknown = [...args].filter(
  (argument) => argument !== '--check' && argument !== '--assets-only',
)
if (unknown.length > 0 || (checkOnly && assetsOnly)) {
  throw new Error(
    'Usage: node scripts/encode-drum-kit-formats.mjs [--check|--assets-only]',
  )
}

function readCatalog() {
  if (!existsSync(sourceCatalogPath)) {
    throw new Error('Generated Drum Night kit catalog is missing')
  }
  return JSON.parse(readFileSync(sourceCatalogPath, 'utf8'))
}

function describeTotals(totalsByKit) {
  return Object.entries(totalsByKit)
    .map(
      ([kitId, totals]) =>
        `${kitId} ${totals.resources} files/${totals.encodedBytes} bytes`,
    )
    .join(', ')
}

function assertGeneratedFile(path, expected, label) {
  if (!existsSync(path) || readFileSync(path, 'utf8') !== expected) {
    throw new Error(`Generated Drum Night ${label} drifted`)
  }
}

async function verifyGeneratedJson(catalog) {
  const [serializedCatalog, projections] = await Promise.all([
    serializeDrumKitGeneratedJson(catalog),
    serializeDrumKitCatalogProjections(catalog),
  ])
  assertGeneratedFile(sourceCatalogPath, serializedCatalog, 'source catalog')
  assertGeneratedFile(publicCatalogPath, serializedCatalog, 'public catalog')
  assertGeneratedFile(
    runtimeProjectionPath,
    projections.runtime,
    'runtime projection',
  )
  assertGeneratedFile(opusProjectionPath, projections.opus, 'Opus projection')
}

function transactionallyWriteGeneratedFiles(files) {
  const staged = files.map(({ path, contents }) => ({
    path,
    contents,
    temporary: `${path}.tmp-${process.pid}`,
    backup: `${path}.backup-${process.pid}`,
    backedUp: false,
    installed: false,
  }))
  for (const file of staged) {
    if (existsSync(file.temporary) || existsSync(file.backup)) {
      throw new Error(
        `Refusing to overwrite Drum Night transaction file: ${file.path}`,
      )
    }
  }
  try {
    for (const file of staged) {
      writeFileSync(file.temporary, file.contents, { flag: 'wx' })
    }
    for (const file of staged) {
      if (!existsSync(file.path)) continue
      renameSync(file.path, file.backup)
      file.backedUp = true
    }
    for (const file of staged) {
      renameSync(file.temporary, file.path)
      file.installed = true
    }
  } catch (error) {
    for (const file of [...staged].reverse()) {
      if (file.installed === true && existsSync(file.path)) {
        renameSync(file.path, file.temporary)
      }
      if (file.backedUp === true && existsSync(file.backup)) {
        renameSync(file.backup, file.path)
      }
    }
    throw error
  } finally {
    for (const file of staged) {
      rmSync(file.temporary, { force: true })
      rmSync(file.backup, { force: true })
    }
  }
}

if (checkOnly) {
  const catalog = readCatalog()
  const totals = verifyDrumKitOpusCatalog(catalog, publicRoot)
  await verifyGeneratedJson(catalog)
  globalThis.console.log(
    `verified deterministic Drum Night Opus and runtime projections: ${describeTotals(totals)}`,
  )
  process.exit(0)
}

const result = encodeDrumKitOpusCatalog(readCatalog(), {
  inputRoot: publicRoot,
  outputRoot: publicRoot,
})
if (!assetsOnly) {
  const [serialized, projections] = await Promise.all([
    serializeDrumKitGeneratedJson(result.catalog),
    serializeDrumKitCatalogProjections(result.catalog),
  ])
  transactionallyWriteGeneratedFiles([
    { path: sourceCatalogPath, contents: serialized },
    { path: publicCatalogPath, contents: serialized },
    { path: runtimeProjectionPath, contents: projections.runtime },
    { path: opusProjectionPath, contents: projections.opus },
  ])
}
globalThis.console.log(
  `${assetsOnly ? 'encoded assets only' : 'encoded assets, catalog, and runtime projections'}: ${describeTotals(result.totalsByKit)}`,
)
