// Recorded-kit calibration tests — keep authored strike dynamics without a second velocity taper.
import assert from 'node:assert/strict'
import test from 'node:test'
import { calibrateDrumKitResources } from './drum-kit-calibration.mjs'

function strike(kitId, layer, peak) {
  return {
    id: `${kitId}:snare-l${layer}-rr1`,
    kitId,
    articulation: 'snare',
    velocityMin: layer === 1 ? 1 : 81,
    velocityMax: layer === 1 ? 80 : 127,
    roundRobin: 1,
    analysis: {
      hardOnsetMs: 1,
      transientOnsetMs: 2,
      transientPeakDb: peak,
      fullPeakDb: peak,
      transientPowerDb: peak - 4,
      noiseFloorDb: null,
    },
  }
}

const recorded = {
  muldjord: {
    gainDb: -4,
    velcurve: [
      [1, 1],
      [127, 1],
    ],
  },
}

test('preserves soft/hard dynamics and reports the same runtime gain at every velocity', () => {
  const result = calibrateDrumKitResources(
    [strike('muldjord', 1, -27), strike('muldjord', 2, -6)],
    undefined,
    recorded,
  )

  assert.deepEqual(
    result.resources.map((r) => r.calibration.playbackGainDb),
    [-4, -4],
  )
  assert.deepEqual(
    result.resources.map((r) => r.readiness),
    ['ready', 'ready'],
  )
  assert.ok(result.resources.every((r) => !('power' in r)))
  assert.deepEqual(
    result.report.resources[0].calibration.achievedTransientPeakDbByVelocity,
    { 64: -31, 100: -31, 112: -31, 127: -31 },
  )
  assert.equal(
    result.report.articulations[0].power,
    'omitted-recorded-dynamics',
  )
})

test('still rejects recorded banks whose requested gain would clip or over-amplify unknown noise', () => {
  assert.throws(
    () =>
      calibrateDrumKitResources([strike('muldjord', 1, -2)], undefined, {
        muldjord: { ...recorded.muldjord, gainDb: 6 },
      }),
    /recorded.*gain/i,
  )
  assert.throws(
    () =>
      calibrateDrumKitResources([strike('muldjord', 1, -30)], undefined, {
        muldjord: { ...recorded.muldjord, gainDb: 9 },
      }),
    /recorded.*gain/i,
  )
})

test('does not change independent legacy calibration in a mixed catalogue', () => {
  const old = strike('studio', 1, -12)
  const expected = calibrateDrumKitResources([old])
  const mixed = calibrateDrumKitResources(
    [old, strike('muldjord', 1, -20)],
    undefined,
    recorded,
  )
  assert.deepEqual(
    mixed.resources.find((r) => r.kitId === 'studio'),
    expected.resources[0],
  )
  assert.deepEqual(
    mixed.report.resources.find((r) => r.id === old.id),
    expected.report.resources[0],
  )
})
