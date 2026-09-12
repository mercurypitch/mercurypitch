// Expanded-source selection tests — complete velocities, real strikes and fail-closed maps.
import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { crc32 } from 'node:zlib'
import { CRO_SOURCE, crocellReader, powerLayers, sfzLayers, sha256, } from './drum-kit-expanded-sources.mjs'

test('keeps every SFZ velocity band, but only genuine distinct repeated strikes', () => {
  const regions = sfzLayers(
    `
    <region> lovel=$low hivel=63 region_label=1 seq_position=1
    <region> lovel=$low hivel=63 region_label=2 seq_position=2
    <region> lovel=$low hivel=63 region_label=3 seq_position=3
    <region> lovel=64 hivel=127 region_label=4 seq_position=1
  `,
    { $low: '1' },
  )
  assert.deepEqual(
    regions.map((r) => [r.region_label, r.layer, r.roundRobin]),
    [
      ['1', 1, 1],
      ['2', 1, 2],
      ['4', 2, 1],
    ],
  )
  assert.deepEqual(
    regions.map((r) => [r.lovel, r.hivel]),
    [
      [1, 63],
      [1, 63],
      [64, 127],
    ],
  )
  for (const text of [
    '<region> lovel=1 hivel=60 region_label=1 <region> lovel=64 hivel=127 region_label=2',
    '<region> lovel=1 hivel=127 region_label=1 <region> lovel=1 hivel=127 region_label=1',
    '<region> lovel=2 hivel=127 region_label=1',
  ])
    assert.throws(() => sfzLayers(text, {}), /SFZ/)
})

test('Crocell power quantiles select six distinct hits even for a small source pool', () => {
  for (const count of [6, 7, 11, 50]) {
    const rows = powerLayers(
      Array.from({ length: count }, (_, i) => ({
        name: `hit-${i}`,
        power: i + 1,
      })),
    )
    assert.equal(new Set(rows.map((r) => r.name)).size, 6)
    assert.deepEqual(
      rows.map((r) => r.roundRobin),
      [1, 2, 1, 2, 1, 2],
    )
    for (let velocity = 1; velocity <= 127; velocity += 1)
      assert.equal(
        rows.filter((r) => r.lovel <= velocity && r.hivel >= velocity).length,
        2,
      )
  }
  assert.throws(() => powerLayers([{ power: 0 }, { power: 1 }]), /Too few/)
})

test('cached Crocell members still require the pinned edition, size and CRC', async (t) => {
  const root = mkdtempSync(join(tmpdir(), 'drum-expanded-source-test-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const cache = join(root, 'sources/crocell')
  mkdirSync(cache, { recursive: true })
  const bytes = Buffer.from('source bytes for integrity checks')
  const entry = {
    name: 'strike.wav',
    size: bytes.length,
    uncompressed: bytes.length,
    crc32: crc32(bytes).toString(16).padStart(8, '0'),
  }
  const index = {
    url: CRO_SOURCE,
    archiveBytes: 5_646_502_341,
    entries: [entry, { ...entry, name: '../escape.wav' }],
  }
  const indexPath = join(cache, 'archive-index.json')
  const samplePath = join(cache, entry.name)
  writeFileSync(indexPath, JSON.stringify(index))
  writeFileSync(samplePath, bytes)
  const reader = crocellReader(root)
  const result = await reader.get(entry.name)
  assert.equal(result.source.sha256, sha256(bytes))
  await assert.rejects(reader.get('../escape.wav'), /Unsafe source path/)
  await assert.rejects(reader.get('missing.wav'), /Missing/)

  writeFileSync(samplePath, Buffer.alloc(bytes.length))
  await assert.rejects(reader.get(entry.name), /integrity failed/)
  writeFileSync(samplePath, bytes.subarray(1))
  await assert.rejects(reader.get(entry.name), /integrity failed/)
  writeFileSync(indexPath, JSON.stringify({ ...index, archiveBytes: 1 }))
  assert.throws(() => crocellReader(root), /Wrong Crocell edition/)
})
