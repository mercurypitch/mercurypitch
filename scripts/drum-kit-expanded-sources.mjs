// Pinned, bounded source readers for the recorded-bank expansion (never used by the app).
import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { crc32, inflateRawSync } from 'node:zlib'

export const MUL_SOURCE = Object.freeze({
  repository: 'sfzinstruments/DrumGizmo.MuldjordKit',
  commit: 'fc165714974aa843125ce88597f341b31376e1d5',
})
export const CRO_SOURCE =
  'https://drumgizmo.org/kits/CrocellKit/CrocellKit1_1.zip'
export const sha256 = (bytes) =>
  createHash('sha256').update(bytes).digest('hex')
const MAX_DOWNLOAD = 80_000_000

async function download(url, headers = {}, expectedLength) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(45_000),
    })
    if (response.status >= 500 && attempt < 2) {
      await response.body?.cancel()
      continue
    }
    if (!response.ok || (headers.Range && response.status !== 206)) {
      await response.body?.cancel()
      throw new Error(`Source HTTP ${response.status}: ${url}`)
    }
    const limit = expectedLength ?? MAX_DOWNLOAD
    if (Number(response.headers.get('content-length')) > limit) {
      await response.body?.cancel()
      throw new Error('Source exceeds declared download bound')
    }
    const chunks = []
    let length = 0
    for await (const chunk of response.body) {
      length += chunk.length
      if (length > limit)
        throw new Error('Source stream exceeds download bound')
      chunks.push(chunk)
    }
    if (expectedLength !== undefined && length !== expectedLength)
      throw new Error('Truncated source range')
    return Buffer.concat(chunks)
  }
  throw new Error('Source download exhausted retries')
}

function localPath(root, relative) {
  const path = resolve(root, relative)
  if (!path.startsWith(`${resolve(root)}/`))
    throw new Error('Unsafe source path')
  return path
}

function save(path, bytes) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, bytes)
}

export async function muldjordReader(auditionRoot) {
  const root = resolve(auditionRoot, 'sources/muldjord')
  const url = `https://api.github.com/repos/${MUL_SOURCE.repository}/git/trees/${MUL_SOURCE.commit}?recursive=1`
  // Revalidate the pinned tree once per preparation, then verify every blob.
  const bytes = await download(url)
  const tree = JSON.parse(bytes)
  if (tree.truncated || !Array.isArray(tree.tree))
    throw new Error('Incomplete Muldjord tree')
  const entries = new Map(
    tree.tree.filter((e) => e.type === 'blob').map((e) => [e.path, e]),
  )
  save(resolve(root, 'source-tree.json'), bytes)
  return {
    entries,
    async get(name) {
      const entry = entries.get(name)
      if (!entry || entry.size > MAX_DOWNLOAD)
        throw new Error(`Missing/oversize pinned blob: ${name}`)
      const path = localPath(root, name)
      const url = `https://raw.githubusercontent.com/${MUL_SOURCE.repository}/${MUL_SOURCE.commit}/${name.split('/').map(encodeURIComponent).join('/')}`
      const bytes = existsSync(path)
        ? readFileSync(path)
        : await download(url, {}, entry.size)
      const gitHash = createHash('sha1')
        .update(`blob ${bytes.length}\0`)
        .update(bytes)
        .digest('hex')
      if (gitHash !== entry.sha)
        throw new Error(`Pinned blob mismatch: ${name}`)
      save(path, bytes)
      return {
        path,
        source: {
          path: name,
          url,
          gitBlobSha1: entry.sha,
          sha256: sha256(bytes),
          bytes: bytes.length,
        },
      }
    },
  }
}

export function crocellReader(auditionRoot) {
  const root = resolve(auditionRoot, 'sources/crocell')
  const index = JSON.parse(readFileSync(resolve(root, 'archive-index.json')))
  if (index.url !== CRO_SOURCE || index.archiveBytes !== 5_646_502_341)
    throw new Error('Wrong Crocell edition')
  const entries = new Map(index.entries.map((e) => [e.name, e]))
  const range = (start, end) =>
    download(CRO_SOURCE, { Range: `bytes=${start}-${end}` }, end - start + 1)
  return {
    entries,
    async get(name) {
      const entry = entries.get(name)
      if (
        !entry ||
        entry.size > MAX_DOWNLOAD ||
        entry.uncompressed > 160_000_000
      )
        throw new Error(`Missing/oversize archive member: ${name}`)
      const path = localPath(root, name)
      let bytes
      if (existsSync(path)) bytes = readFileSync(path)
      else {
        const header = await range(entry.offset, entry.offset + 29)
        if (header.readUInt32LE(0) !== 0x04034b50)
          throw new Error('Bad ZIP local header')
        const start =
          entry.offset + 30 + header.readUInt16LE(26) + header.readUInt16LE(28)
        const data = await range(start, start + entry.size - 1)
        const method = header.readUInt16LE(8)
        if (![0, 8].includes(method))
          throw new Error('Unsupported ZIP compression')
        bytes =
          method === 8
            ? inflateRawSync(data, { maxOutputLength: entry.uncompressed })
            : data
      }
      if (
        bytes.length !== entry.uncompressed ||
        crc32(bytes).toString(16).padStart(8, '0') !== entry.crc32
      )
        throw new Error(`Crocell member integrity failed: ${name}`)
      save(path, bytes)
      return {
        path,
        source: {
          path: name,
          url: CRO_SOURCE,
          archiveMember: name,
          zipCrc32: entry.crc32,
          sha256: sha256(bytes),
          bytes: bytes.length,
        },
      }
    },
  }
}

export const xmlAttributes = (source) =>
  Object.fromEntries(
    [...source.matchAll(/(\w+)="([^"]*)"/g)].map((m) => [m[1], m[2]]),
  )

export function sfzLayers(source, macros) {
  const regions = [...source.matchAll(/<region>([^<]*)/g)].map((match) => {
    const values = Object.fromEntries(
      [...match[1].matchAll(/([\w$]+)=([^\s]+)/g)].map((m) => [
        m[1],
        macros[m[2]] ?? m[2],
      ]),
    )
    return {
      ...values,
      lovel: Number(values.lovel),
      hivel: Number(values.hivel),
    }
  })
  const layers = [...new Set(regions.map((r) => r.lovel))].sort((a, b) => a - b)
  if (
    !layers.length ||
    layers[0] !== 1 ||
    Math.max(...regions.map((r) => r.hivel)) !== 127
  )
    throw new Error('Incomplete SFZ velocity coverage')
  for (let index = 0; index < layers.length; index += 1) {
    const layer = regions.filter((r) => r.lovel === layers[index])
    const high = (layers[index + 1] ?? 128) - 1
    if (
      layer.some((r) => r.hivel !== high || !r.region_label) ||
      new Set(layer.map((r) => r.region_label)).size !== layer.length
    )
      throw new Error('Invalid or duplicated SFZ layer')
  }
  return layers.flatMap((low, index) =>
    regions
      .filter((r) => r.lovel === low)
      .slice(0, 2)
      .map((r, rr) => ({ ...r, layer: index + 1, roundRobin: rr + 1 })),
  )
}

export function powerLayers(samples) {
  const sorted = samples
    .filter((s) => Number(s.power) > 0)
    .sort((a, b) => Number(a.power) - Number(b.power))
  if (sorted.length < 6)
    throw new Error('Too few distinct Crocell strikes for three layers')
  return [
    [0.2, 1, 62],
    [0.55, 63, 102],
    [0.9, 103, 127],
  ].flatMap(([q, lovel, hivel], layer) => {
    const index = Math.max(
      layer * 2,
      Math.min(
        sorted.length - (3 - layer) * 2,
        Math.floor(q * (sorted.length - 1)),
      ),
    )
    return [0, 1].map((rr) => ({
      ...sorted[index + rr],
      lovel,
      hivel,
      layer: layer + 1,
      roundRobin: rr + 1,
    }))
  })
}
