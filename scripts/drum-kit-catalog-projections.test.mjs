import assert from 'node:assert/strict'
import test from 'node:test'
import { createDrumKitCatalogProjections, serializeDrumKitCatalogProjections, } from './drum-kit-catalog-projections.mjs'
import { packDrumKitRuntimeResource, unpackDrumKitRuntimeResource, } from '../src/features/drum-night/audio/drum-kit-runtime-codec.mjs'

const MP3_HASH = 'a'.repeat(64)
const OPUS_HASH = 'b'.repeat(64)

function resource(id, kitId, { power } = {}) {
  const slug = id.slice(id.indexOf(':') + 1)
  const mp3 = {
    path: `${kitId}/v1/${MP3_HASH.slice(0, 16)}-${slug}.mp3`,
    mimeType: 'audio/mpeg',
    encodedBytes: 1_000,
    sha256: MP3_HASH,
  }
  return {
    id,
    kitId,
    articulation: 'kick',
    gmKeys: [36],
    velocityMin: 1,
    velocityMax: 127,
    roundRobin: 1,
    chokeGroup: null,
    chokes: [],
    readiness: 'ready',
    ...mp3,
    ...(power === undefined ? {} : { power }),
    formats: {
      mp3,
      opus: {
        path: `${kitId}/v1/${OPUS_HASH.slice(0, 16)}-${slug}.opus`,
        mimeType: 'audio/ogg; codecs=opus',
        encodedBytes: 400,
        sha256: OPUS_HASH,
      },
    },
    playbackGain: 1,
    source: {
      commit: 'pinned',
      path: `source/${slug}.wav`,
      sha256: 'c'.repeat(64),
      transforms: 'audited',
    },
  }
}

function catalog() {
  const live = resource('live:kick-l1-rr1', 'live', { power: 0.8 })
  const classic = resource('classic-gm:kick-l1-rr1', 'classic-gm')
  const studio = resource('studio:kick-l1-rr1', 'studio')
  return {
    schemaVersion: 2,
    generatedBy: 'canonical-only',
    toolchain: { ffmpeg: 'pinned' },
    audio: { sampleRate: 44_100 },
    calibration: { maximumOnsetMs: 5 },
    kits: {
      muldjord: {
        version: 'v1',
        sampleStatus: 'ready',
        publishedEncodedBytes: 0,
        resources: [],
      },
      crocell: {
        version: 'v1',
        sampleStatus: 'ready',
        publishedEncodedBytes: 0,
        resources: [],
      },
      live: {
        version: 'v1',
        sampleStatus: 'ready',
        publishedEncodedBytes: live.encodedBytes,
        resources: [live],
      },
      'mercury-synth': {
        version: 'v1',
        sampleStatus: 'ready',
        publishedEncodedBytes: 0,
        resources: [],
      },
      studio: {
        version: 'v1',
        sampleStatus: 'ready',
        publishedEncodedBytes: studio.encodedBytes,
        resources: [studio],
        velcurve: {
          default: [
            [1, 0.1],
            [127, 1],
          ],
        },
      },
      'classic-gm': {
        version: 'v1',
        sampleStatus: 'ready',
        publishedEncodedBytes: classic.encodedBytes,
        resources: [classic],
      },
    },
  }
}

test('runtime projection retains playback metadata but excludes audit and format data', () => {
  const projections = createDrumKitCatalogProjections(catalog())
  const projected = unpackDrumKitRuntimeResource(
    projections.runtime.kits.live.resources[0],
    'live',
    'v1',
  )

  assert.deepEqual(Object.keys(projections.runtime.kits), [
    'mercury-synth',
    'classic-gm',
    'studio',
    'live',
    'muldjord',
    'crocell',
  ])
  assert.equal(projections.runtime.schemaVersion, 2)
  assert.equal(projections.runtime.catalogSchemaVersion, 2)
  assert.equal(projected.power, 0.8)
  assert.equal(projected.readiness, 'ready')
  assert.equal(projected.playbackGain, 1)
  assert.equal(projections.runtime.kits.live.sampleStatus, 'ready')
  assert.equal('source' in projected, false)
  assert.equal('formats' in projected, false)
  assert.equal('toolchain' in projections.runtime, false)
  assert.deepEqual(projections.runtime.kits.studio.velcurve, {
    default: [
      [1, 0.1],
      [127, 1],
    ],
  })
})

test('Opus projection has sorted exact resource closure and one shared MIME', () => {
  const projections = createDrumKitCatalogProjections(catalog())

  assert.equal(projections.opus.schemaVersion, 1)
  assert.equal(projections.opus.catalogSchemaVersion, 2)
  assert.equal(projections.opus.mimeType, 'audio/ogg; codecs=opus')
  assert.deepEqual(Object.keys(projections.opus.encodings), [
    'classic-gm:kick-l1-rr1',
    'live:kick-l1-rr1',
    'studio:kick-l1-rr1',
  ])
  assert.deepEqual(projections.opus.encodings['classic-gm:kick-l1-rr1'], {
    path: `classic-gm/v1/${OPUS_HASH.slice(0, 16)}-kick-l1-rr1.opus`,
    encodedBytes: 400,
    sha256: OPUS_HASH,
  })
})

test('projection serialization matches Prettier and is deterministic', async () => {
  const first = await serializeDrumKitCatalogProjections(catalog())
  const second = await serializeDrumKitCatalogProjections(catalog())

  assert.deepEqual(first, second)
  assert.equal(first.runtime.endsWith('\n'), true)
  assert.equal(first.opus.endsWith('\n'), true)
  assert.equal(first.runtime.includes('"gmKeys"'), false)
  assert.deepEqual(JSON.parse(first.runtime).kits.live.resources[0][2], [36])
})

test('projection rejects missing Opus and drifted MP3 aliases', () => {
  const missingOpus = catalog()
  delete missingOpus.kits.live.resources[0].formats.opus
  assert.throws(
    () => createDrumKitCatalogProjections(missingOpus),
    /Invalid Drum Night OPUS projection encoding/u,
  )

  const driftedMp3 = catalog()
  driftedMp3.kits.studio.resources[0].formats.mp3.encodedBytes += 1
  assert.throws(
    () => createDrumKitCatalogProjections(driftedMp3),
    /MP3 projection alias drifted/u,
  )
})

test('compact rows round-trip every playback field and reject unsafe identity or shape', () => {
  for (const power of [undefined, 0.8]) {
    const { source, formats, ...original } = resource(
      'live:kick-l1-rr1',
      'live',
      { power },
    )
    const row = packDrumKitRuntimeResource(original, 'live', 'v1')
    assert.deepEqual(unpackDrumKitRuntimeResource(row, 'live', 'v1'), original)
    assert.throws(
      () => unpackDrumKitRuntimeResource(row.slice(1), 'live', 'v1'),
      /resource row/,
    )
    assert.throws(
      () =>
        unpackDrumKitRuntimeResource(
          ['../escape', ...row.slice(1)],
          'live',
          'v1',
        ),
      /identity/,
    )
    assert.throws(
      () =>
        packDrumKitRuntimeResource(
          { ...original, path: 'other.mp3' },
          'live',
          'v1',
        ),
      /cannot be compacted/,
    )
    assert.ok(source && formats)
  }
})
