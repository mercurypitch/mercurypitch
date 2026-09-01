// ============================================================
// Drum kit Opus pipeline — deterministic MP3-to-Opus catalog enrichment
// ============================================================
//
// The checked-in MP3 remains the audited compatibility source. This module
// creates a content-hashed Ogg Opus sibling for every sampled resource and can
// re-encode the complete set to prove that the committed catalog is exact.

import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { copyFileSync, existsSync, lstatSync, mkdtempSync, readdirSync, readFileSync, rmSync, } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative, resolve, sep } from 'node:path'

export const DRUM_KIT_OPUS_MIME_TYPE = 'audio/ogg; codecs=opus'
export const DRUM_KIT_OPUS_BITRATE = '64k'
export const DRUM_KIT_OPUS_SAMPLE_RATE = 48_000
export const DRUM_KIT_OPUS_CHANNELS = 2
export const DRUM_KIT_OPUS_FFMPEG_VERSION = 'n9.0.1'

const OPUS_EXTENSION = '.opus'
const HASHED_MP3_PATH =
  /^(classic-gm|studio|live)\/v[1-9]\d*\/[a-f0-9]{16}-([a-z0-9-]+)\.mp3$/
const HASHED_OPUS_PATH =
  /^(classic-gm|studio|live)\/v[1-9]\d*\/[a-f0-9]{16}-[a-z0-9-]+\.opus$/
const SHA256 = /^[a-f0-9]{64}$/
const MAXIMUM_ENCODED_RESOURCE_BYTES = 2 * 1024 * 1024

function sha256(data) {
  return createHash('sha256').update(data).digest('hex')
}

function commandOutput(command, args) {
  return execFileSync(command, args, {
    encoding: 'utf8',
    maxBuffer: 4 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

export function assertDrumKitOpusToolchain() {
  const output = commandOutput('ffmpeg', ['-version'])
  const version = /^ffmpeg version (\S+)/.exec(output)?.[1]
  if (version !== DRUM_KIT_OPUS_FFMPEG_VERSION) {
    throw new Error(
      `Drum Night Opus toolchain mismatch: expected ffmpeg ${DRUM_KIT_OPUS_FFMPEG_VERSION}; received ${String(version)}`,
    )
  }
}

function safeAssetPath(root, relativePath, extension) {
  const rootPrefix = `${resolve(root)}${sep}`
  const path = resolve(root, relativePath)
  if (
    !path.startsWith(rootPrefix) ||
    relativePath.endsWith(extension) !== true ||
    relativePath.includes('\\') === true
  ) {
    throw new Error(`Unsafe Drum Night format path: ${relativePath}`)
  }
  return path
}

function assertRegularFile(path, label) {
  if (
    !existsSync(path) ||
    !lstatSync(path).isFile() ||
    lstatSync(path).isSymbolicLink()
  ) {
    throw new Error(`Missing or unsafe Drum Night ${label}: ${path}`)
  }
}

function encodeOpus(inputPath, outputPath) {
  execFileSync(
    'ffmpeg',
    [
      '-hide_banner',
      '-loglevel',
      'error',
      '-nostdin',
      '-y',
      '-i',
      inputPath,
      '-map_metadata',
      '-1',
      '-vn',
      '-ar',
      String(DRUM_KIT_OPUS_SAMPLE_RATE),
      '-ac',
      String(DRUM_KIT_OPUS_CHANNELS),
      '-codec:a',
      'libopus',
      '-application',
      'audio',
      '-frame_duration',
      '20',
      '-vbr',
      'on',
      '-compression_level',
      '10',
      '-b:a',
      DRUM_KIT_OPUS_BITRATE,
      '-fflags',
      '+bitexact',
      '-flags:a',
      '+bitexact',
      outputPath,
    ],
    { stdio: ['ignore', 'pipe', 'pipe'] },
  )
}

function sampledResources(catalog) {
  const kits = catalog?.kits
  if (typeof kits !== 'object' || kits === null) {
    throw new Error('Drum Night catalog has no kit map')
  }
  return Object.entries(kits).flatMap(([kitId, kit]) => {
    if (kitId === 'mercury-synth' || kitId === 'circuit') return []
    if (!Array.isArray(kit?.resources)) {
      throw new Error(`Drum Night kit has no resource list: ${kitId}`)
    }
    return kit.resources.map((resource) => ({ kitId, resource }))
  })
}

function mp3Encoding(resource) {
  const alias = {
    path: resource.path,
    mimeType: resource.mimeType,
    encodedBytes: resource.encodedBytes,
    sha256: resource.sha256,
  }
  if (
    !HASHED_MP3_PATH.test(alias.path) ||
    alias.mimeType !== 'audio/mpeg' ||
    !Number.isSafeInteger(alias.encodedBytes) ||
    alias.encodedBytes <= 0 ||
    !SHA256.test(alias.sha256)
  ) {
    throw new Error(`Invalid Drum Night MP3 alias: ${resource.id}`)
  }
  return alias
}

function assertMp3Bytes(resource, inputRoot) {
  const mp3 = mp3Encoding(resource)
  const path = safeAssetPath(inputRoot, mp3.path, '.mp3')
  assertRegularFile(path, 'MP3 source')
  const data = readFileSync(path)
  if (data.byteLength !== mp3.encodedBytes || sha256(data) !== mp3.sha256) {
    throw new Error(`Drum Night MP3 alias does not match bytes: ${resource.id}`)
  }
  return { mp3, path }
}

function opusRelativePath(mp3Path, opusSha256) {
  const match = HASHED_MP3_PATH.exec(mp3Path)
  if (match === null) throw new Error(`Invalid Drum Night MP3 path: ${mp3Path}`)
  const directory = dirname(mp3Path).replaceAll('\\', '/')
  return `${directory}/${opusSha256.slice(0, 16)}-${match[2]}${OPUS_EXTENSION}`
}

function installContentHashedAsset(stagedPath, destination, expectedSha256) {
  if (existsSync(destination)) {
    assertRegularFile(destination, 'Opus asset')
    if (sha256(readFileSync(destination)) !== expectedSha256) {
      throw new Error(
        `Refusing to overwrite mismatched Opus asset: ${destination}`,
      )
    }
    return
  }
  copyFileSync(stagedPath, destination, 0)
}

function enrichResource(resource, opus) {
  const mp3 = mp3Encoding(resource)
  const existingFlac = resource.formats?.flac
  const formats =
    existingFlac === undefined
      ? { mp3, opus }
      : { mp3, opus, flac: existingFlac }
  const { playbackGain, source, ...beforeTail } = resource
  return { ...beforeTail, formats, playbackGain, source }
}

function withFormatMetadata(catalog) {
  return {
    ...catalog,
    schemaVersion: 2,
    audio: {
      ...catalog.audio,
      formats: {
        mp3: {
          mimeType: 'audio/mpeg',
          sampleRate: catalog.audio?.sampleRate,
          channels: catalog.audio?.channels,
          bitrate: catalog.audio?.bitrate,
        },
        opus: {
          mimeType: DRUM_KIT_OPUS_MIME_TYPE,
          sampleRate: DRUM_KIT_OPUS_SAMPLE_RATE,
          channels: DRUM_KIT_OPUS_CHANNELS,
          bitrate: DRUM_KIT_OPUS_BITRATE,
          vbr: true,
          application: 'audio',
          frameDurationMs: 20,
        },
      },
    },
  }
}

function collectFiles(directory) {
  if (!existsSync(directory)) return []
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name)
    if (entry.isSymbolicLink()) {
      throw new Error(
        `Symlinks are forbidden in Drum Night kit assets: ${path}`,
      )
    }
    if (entry.isDirectory()) return collectFiles(path)
    return entry.isFile() ? [path] : []
  })
}

function assertExactOpusClosure(catalog, outputRoot) {
  const resources = sampledResources(catalog)
  const expected = new Set(
    resources.map(({ resource }) => resource.formats?.opus?.path),
  )
  if (expected.has(undefined)) {
    throw new Error('A sampled Drum Night resource is missing its Opus format')
  }
  if (expected.size !== resources.length) {
    throw new Error('Duplicate Drum Night Opus asset path')
  }
  const actual = collectFiles(outputRoot)
    .filter((path) => path.endsWith(OPUS_EXTENSION))
    .map((path) => relative(outputRoot, path).replaceAll('\\', '/'))
  const unexpected = actual.filter((path) => !expected.has(path))
  const missing = [...expected].filter(
    (path) => typeof path === 'string' && actual.includes(path) === false,
  )
  if (unexpected.length > 0 || missing.length > 0) {
    throw new Error(
      `Drum Night Opus closure mismatch: missing ${missing.length === 0 ? 'none' : missing.join(', ')}; unexpected ${unexpected.length === 0 ? 'none' : unexpected.join(', ')}`,
    )
  }
}

export function encodeDrumKitOpusCatalog(
  catalog,
  { inputRoot, outputRoot = inputRoot, installAssets = true } = {},
) {
  if (inputRoot === undefined)
    throw new Error('Drum Night MP3 root is required')
  assertDrumKitOpusToolchain()
  const workDirectory = mkdtempSync(join(tmpdir(), 'mercurypitch-drum-opus-'))
  const formatByResourceId = new Map()
  const generatedPaths = new Set()
  const totalsByKit = {}
  try {
    const entries = sampledResources(catalog)
    for (let index = 0; index < entries.length; index += 1) {
      const { kitId, resource } = entries[index]
      const { path: inputPath } = assertMp3Bytes(resource, inputRoot)
      const stagedPath = resolve(workDirectory, `${index}.opus`)
      encodeOpus(inputPath, stagedPath)
      const encoded = readFileSync(stagedPath)
      if (
        encoded.byteLength <= 0 ||
        encoded.byteLength > MAXIMUM_ENCODED_RESOURCE_BYTES ||
        encoded.subarray(0, 4).toString('ascii') !== 'OggS'
      ) {
        throw new Error(`Invalid generated Drum Night Opus: ${resource.id}`)
      }
      const encodedSha256 = sha256(encoded)
      const relativePath = opusRelativePath(resource.path, encodedSha256)
      if (!HASHED_OPUS_PATH.test(relativePath)) {
        throw new Error(
          `Invalid generated Drum Night Opus path: ${relativePath}`,
        )
      }
      if (
        formatByResourceId.has(resource.id) ||
        generatedPaths.has(relativePath)
      ) {
        throw new Error(`Duplicate generated Drum Night Opus: ${resource.id}`)
      }
      const opus = {
        path: relativePath,
        mimeType: DRUM_KIT_OPUS_MIME_TYPE,
        encodedBytes: encoded.byteLength,
        sha256: encodedSha256,
      }
      formatByResourceId.set(resource.id, opus)
      generatedPaths.add(relativePath)
      const totals = totalsByKit[kitId] ?? { resources: 0, encodedBytes: 0 }
      totals.resources += 1
      totals.encodedBytes += encoded.byteLength
      totalsByKit[kitId] = totals
      if (installAssets) {
        const destination = safeAssetPath(
          outputRoot,
          relativePath,
          OPUS_EXTENSION,
        )
        installContentHashedAsset(stagedPath, destination, encodedSha256)
      }
    }
  } finally {
    rmSync(workDirectory, { recursive: true, force: true })
  }

  const nextCatalog = withFormatMetadata({
    ...catalog,
    kits: Object.fromEntries(
      Object.entries(catalog.kits).map(([kitId, kit]) => [
        kitId,
        {
          ...kit,
          resources: kit.resources.map((resource) => {
            const opus = formatByResourceId.get(resource.id)
            return opus === undefined
              ? resource
              : enrichResource(resource, opus)
          }),
        },
      ]),
    ),
  })
  if (installAssets) assertExactOpusClosure(nextCatalog, outputRoot)
  return { catalog: nextCatalog, totalsByKit }
}

export function verifyDrumKitOpusCatalog(catalog, outputRoot) {
  if (catalog.schemaVersion !== 2) {
    throw new Error('Drum Night Opus delivery requires catalog schema 2')
  }
  const regenerated = encodeDrumKitOpusCatalog(catalog, {
    inputRoot: outputRoot,
    installAssets: false,
  })
  for (const { resource } of sampledResources(catalog)) {
    const expectedMp3 = mp3Encoding(resource)
    if (JSON.stringify(resource.formats?.mp3) !== JSON.stringify(expectedMp3)) {
      throw new Error(`Drum Night MP3 format alias drifted: ${resource.id}`)
    }
    const expected = regenerated.catalog.kits[resource.kitId].resources.find(
      (candidate) => candidate.id === resource.id,
    )?.formats?.opus
    const actual = resource.formats?.opus
    if (
      expected === undefined ||
      actual === undefined ||
      JSON.stringify(actual) !== JSON.stringify(expected)
    ) {
      throw new Error(`Drum Night Opus manifest drifted: ${resource.id}`)
    }
    const path = safeAssetPath(outputRoot, actual.path, OPUS_EXTENSION)
    assertRegularFile(path, 'Opus asset')
    const data = readFileSync(path)
    if (
      data.byteLength !== actual.encodedBytes ||
      sha256(data) !== actual.sha256
    ) {
      throw new Error(`Drum Night Opus bytes drifted: ${resource.id}`)
    }
  }
  assertExactOpusClosure(catalog, outputRoot)
  return regenerated.totalsByKit
}
