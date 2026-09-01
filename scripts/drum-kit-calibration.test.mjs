import assert from 'node:assert/strict'
import test from 'node:test'
import { calibrateDrumKitResources, drumKitCalibrationMetadata, projectCalibratedResources, } from './drum-kit-calibration.mjs'

function resource(
  id,
  transientPeakDb,
  {
    fullPeakDb = transientPeakDb,
    transientPowerDb = transientPeakDb - 3,
    noiseFloorDb = -72,
    velocityMin = 1,
    velocityMax = 127,
    roundRobin = 1,
  } = {},
) {
  return {
    id,
    kitId: 'studio',
    articulation: 'kick',
    velocityMin,
    velocityMax,
    roundRobin,
    analysis: {
      hardOnsetMs: 1,
      transientOnsetMs: 2,
      transientPeakDb,
      fullPeakDb,
      transientPowerDb,
      noiseFloorDb,
    },
  }
}

test('calibrates each resource independently so a weak sibling cannot lower another', () => {
  const result = calibrateDrumKitResources([
    resource('studio:kick-l1-rr1', -12),
    resource('studio:kick-l1-rr2', -22, { noiseFloorDb: null }),
  ])
  const strong = result.resources[0]
  const weak = result.resources[1]

  assert.equal(strong.calibration.playbackGainDb, 3)
  assert.equal(strong.calibration.achievedTransientPeakDb, -9)
  assert.equal(strong.readiness, 'ready')
  assert.equal(weak.calibration.playbackGainDb, 6)
  assert.equal(weak.calibration.achievedTransientPeakDb, -16)
  assert.equal(weak.readiness, 'reduced')
  assert.equal(result.sampleStatus, 'reduced')
  assert.equal('power' in strong, false)
  assert.equal('power' in weak, false)
})

test('marks unsafe noisy material fallback instead of hiding it with gain', () => {
  const result = calibrateDrumKitResources([
    resource('studio:kick-l1-rr1', -24, {
      transientPowerDb: -28,
      noiseFloorDb: -48,
    }),
  ])
  const calibrated = result.resources[0]

  assert.equal(calibrated.readiness, 'fallback')
  assert.equal(calibrated.calibration.reasons.includes('noise'), true)
  assert.ok(calibrated.calibration.playbackGainDb <= -6)
  assert.ok(calibrated.calibration.achievedNoiseFloorDb <= -54)
})

test('records decoded codec evidence and rejects output drift', () => {
  const compared = resource('studio:kick-l1-rr1', -12)
  compared.analysis.codecs = {
    mp3: {
      hardOnsetMs: 1,
      transientOnsetMs: 2,
      transientPeakDb: -12,
      fullPeakDb: -11.8,
      transientPowerDb: -15,
    },
    opus: {
      hardOnsetMs: 1,
      transientOnsetMs: 2,
      transientPeakDb: -11.8,
      fullPeakDb: -11.6,
      transientPowerDb: -14.9,
    },
    opusMinusMp3: {
      transientPeakDb: 0.2,
      fullPeakDb: 0.2,
      transientPowerDb: 0.1,
    },
  }
  const result = calibrateDrumKitResources([compared])

  assert.deepEqual(result.report.resources[0].codecs.opusMinusMp3, {
    transientPeakDb: 0.2,
    fullPeakDb: 0.2,
    transientPowerDb: 0.1,
  })

  const drifted = JSON.parse(JSON.stringify(compared))
  drifted.analysis.codecs.opus.transientPeakDb = -9.9
  drifted.analysis.codecs.opusMinusMp3.transientPeakDb = 2.1
  assert.throws(
    () => calibrateDrumKitResources([drifted]),
    /codec output drift/,
  )
})

test('uses the hottest decoded codec to enforce the full-scale headroom ceiling', () => {
  const compared = resource('studio:kick-l1-rr1', -9, {
    fullPeakDb: -6,
  })
  compared.analysis.codecs = {
    mp3: {
      hardOnsetMs: 1,
      transientOnsetMs: 2,
      transientPeakDb: -9,
      fullPeakDb: -6,
      transientPowerDb: -12,
    },
    opus: {
      hardOnsetMs: 1,
      transientOnsetMs: 2,
      transientPeakDb: -7.1,
      fullPeakDb: -4.1,
      transientPowerDb: -10.1,
    },
    opusMinusMp3: {
      transientPeakDb: 1.9,
      fullPeakDb: 1.9,
      transientPowerDb: 1.9,
    },
  }

  const calibrated = calibrateDrumKitResources([compared]).resources[0]

  assert.equal(calibrated.calibration.maximumDecodedFullPeakDb, -4.1)
  assert.ok(Math.abs(calibrated.calibration.playbackGainDb + 1.9) < 0.000_001)
  assert.ok(calibrated.calibration.achievedFullPeakDb <= -6)
  assert.equal(calibrated.readiness, 'reduced')
})

test('centres shared gain across codecs and reports both runtime outputs', () => {
  const compared = resource('studio:kick-l1-rr1', -9)
  compared.analysis.codecs = {
    mp3: {
      hardOnsetMs: 1,
      transientOnsetMs: 2,
      transientPeakDb: -9,
      fullPeakDb: -8,
      transientPowerDb: -12,
    },
    opus: {
      hardOnsetMs: 1,
      transientOnsetMs: 2,
      transientPeakDb: -10.6,
      fullPeakDb: -9.4,
      transientPowerDb: -13.6,
    },
    opusMinusMp3: {
      transientPeakDb: -1.6,
      fullPeakDb: -1.4,
      transientPowerDb: -1.6,
    },
  }

  const result = calibrateDrumKitResources([compared])
  const calibrated = result.resources[0]
  const report = result.report.resources[0]

  assert.ok(Math.abs(calibrated.calibration.playbackGainDb - 0.8) < 0.000_001)
  assert.equal(calibrated.readiness, 'ready')
  assert.ok(
    Math.abs(calibrated.calibration.maximumAbsoluteTargetErrorDb - 0.8) <
      0.000_001,
  )
  assert.equal(report.codecs.mp3.achievedTransientPeakDb, -8.2)
  assert.equal(report.codecs.opus.achievedTransientPeakDb, -9.8)
  assert.equal(
    report.codecs.opus.achievedTransientPeakDbByVelocity['127'],
    -9.8,
  )
})

test('publishes normalized power only when the complete articulation passes', () => {
  const passing = calibrateDrumKitResources([
    resource('studio:kick-l1-rr1', -12, { transientPowerDb: -16 }),
    resource('studio:kick-l1-rr2', -12, { transientPowerDb: -18 }),
  ])

  assert.equal(passing.report.articulations[0].power, 'published')
  assert.equal(passing.resources[0].power, 1)
  assert.ok(passing.resources[1].power > 0.79)
  assert.ok(passing.resources[1].power < 0.8)

  const spread = calibrateDrumKitResources([
    resource('studio:kick-l1-rr1', -12, { transientPowerDb: -16 }),
    resource('studio:kick-l1-rr2', -12, { transientPowerDb: -20 }),
  ])
  assert.equal(spread.report.articulations[0].power, 'omitted-power-spread')
  assert.equal(
    spread.resources.some((item) => 'power' in item),
    false,
  )

  const unsafeCorrection = calibrateDrumKitResources([
    resource('studio:kick-l1-rr1', -9, {
      fullPeakDb: -6,
      transientPowerDb: -12,
    }),
    resource('studio:kick-l1-rr2', -9, {
      fullPeakDb: -6,
      transientPowerDb: -15,
      roundRobin: 2,
    }),
  ])
  assert.equal(
    unsafeCorrection.report.articulations[0].power,
    'omitted-headroom',
  )
  assert.equal(
    unsafeCorrection.resources.some((item) => 'power' in item),
    false,
  )
})

test('report and runtime projection are deterministic and measurement-free', () => {
  const input = [
    resource('studio:kick-l1-rr2', -12, { roundRobin: 2 }),
    resource('studio:kick-l1-rr1', -12),
  ]
  const first = calibrateDrumKitResources(input)
  const second = calibrateDrumKitResources([...input].reverse())

  assert.deepEqual(first.report, second.report)
  assert.deepEqual(
    first.resources.map((item) => item.id),
    ['studio:kick-l1-rr1', 'studio:kick-l1-rr2'],
  )
  const projected = projectCalibratedResources(first.resources)
  assert.equal(
    projected.some((item) => 'analysis' in item),
    false,
  )
  assert.equal(
    projected.some((item) => 'calibration' in item),
    false,
  )
  assert.equal(drumKitCalibrationMetadata().velocityContractVersion, 1)
})
