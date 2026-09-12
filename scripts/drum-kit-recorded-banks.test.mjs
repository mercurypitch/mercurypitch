// Recorded bank tests — pinned licences, public source evidence and fail-closed input hashes.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import test from 'node:test'
import { assertRecordedKitNotices, RECORDED_KIT_RECIPES, RECORDED_KIT_ZONES, resolveRecordedMix, } from './drum-kit-recorded-banks.mjs'

test('pins the selected editions and retains public microphone provenance without private paths', () => {
  assert.equal(
    RECORDED_KIT_RECIPES.muldjord.source.commit,
    'fc165714974aa843125ce88597f341b31376e1d5',
  )
  assert.equal(RECORDED_KIT_RECIPES.crocell.source.version, 'CrocellKit1_1')
  assert.equal(RECORDED_KIT_RECIPES.muldjord.mixes.length, 111)
  assert.equal(RECORDED_KIT_RECIPES.crocell.mixes.length, 107)
  assert.doesNotMatch(
    JSON.stringify(RECORDED_KIT_RECIPES),
    /\/home\/|\/tmp\/|file:\/\//,
  )
  for (const recipe of Object.values(RECORDED_KIT_RECIPES)) {
    assert.deepEqual(recipe.velcurve, [
      [1, 1],
      [127, 1],
    ])
    assert.ok(
      recipe.mixes.every(
        (mix) =>
          mix.provenance.mix.length > 0 && /^[a-f0-9]{64}$/.test(mix.sha256),
      ),
    )
  }
  assertRecordedKitNotices()
})

test('refuses missing, corrupted or escaped approved masters rather than encoding arbitrary files', () => {
  const root = mkdtempSync(resolve(tmpdir(), 'recorded-bank-test-'))
  try {
    const zone = { ...RECORDED_KIT_ZONES[0] }
    assert.throws(() => resolveRecordedMix(zone), /DRUM_AUDITION_ROOT/)
    assert.throws(
      () =>
        resolveRecordedMix({ ...zone, preparedPath: '../outside.wav' }, root),
      /Unsafe recorded mix/,
    )
    const bytes = Buffer.from('test fixture, not audio')
    mkdirSync(resolve(root, 'samples/muldjord'), { recursive: true })
    writeFileSync(resolve(root, zone.preparedPath), bytes)
    assert.throws(() => resolveRecordedMix(zone, root), /SHA-256 mismatch/)
    zone.sourceSha256 = createHash('sha256').update(bytes).digest('hex')
    assert.equal(
      resolveRecordedMix(zone, root),
      resolve(root, zone.preparedPath),
    )
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
