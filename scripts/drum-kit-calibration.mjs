// Drum kit calibration — deterministic policy over decoded one-shot measurements.
// ============================================================
//
// Audio decoding stays in the curator. This module owns the reviewable math:
// every resource aims independently at the target, safety limits win, and a
// weak sibling can never pull down the rest of its articulation.

import { DRUM_VELOCITY_CONTRACT_VERSION, drumVelocityContractSnapshot, resolveDrumHitGain, resolveDrumVelocityTarget, } from '../src/features/drum-night/audio/drum-velocity-contract.mjs'

export const DRUM_KIT_CALIBRATION_REPORT_SCHEMA_VERSION = 1

export const DRUM_KIT_CALIBRATION_POLICY = Object.freeze({
  targetTransientPeakDb: -9,
  targetToleranceDb: 1,
  maximumFullScalePeakDb: -6,
  maximumPlaybackGainDb: 12,
  maximumUnmeasuredNoiseBoostDb: 6,
  maximumAmplifiedNoiseDb: -54,
  minimumSignalToNoiseDb: 36,
  minimumReducedTransientPeakDb: -18,
  maximumLayerBoundaryDb: 2,
  maximumRoundRobinSpreadDb: 1.5,
  maximumPowerSpreadDb: 3,
  maximumCodecDeltaDb: 2,
})

const CODEC_DELTA_FIELDS = Object.freeze([
  'transientPeakDb',
  'fullPeakDb',
  'transientPowerDb',
])
const REPRESENTATIVE_VELOCITIES = Object.freeze([64, 100, 112, 127])

function round(value, digits = 4) {
  if (!Number.isFinite(value)) return null
  return Number(value.toFixed(digits))
}

function dbToGain(decibels) {
  return 10 ** (decibels / 20)
}

function gainToDb(gain) {
  if (!Number.isFinite(gain) || gain <= 0) return Number.NEGATIVE_INFINITY
  return 20 * Math.log10(gain)
}

function average(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function decodedValues(analysis, field) {
  return analysis.codecs === undefined
    ? [analysis[field]]
    : [analysis.codecs.mp3[field], analysis.codecs.opus[field]]
}

function decodedMidpoint(analysis, field) {
  const values = decodedValues(analysis, field)
  return (Math.min(...values) + Math.max(...values)) / 2
}

function groupResourcesByArticulation(resources) {
  const groups = new Map()
  for (const resource of resources) {
    const key = `${resource.kitId}:${resource.articulation}`
    const group = groups.get(key) ?? []
    group.push(resource)
    groups.set(key, group)
  }
  return [...groups].sort(([left], [right]) => left.localeCompare(right))
}

function assertAnalysis(resource) {
  const analysis = resource?.analysis
  for (const field of [
    'hardOnsetMs',
    'transientOnsetMs',
    'transientPeakDb',
    'fullPeakDb',
    'transientPowerDb',
  ]) {
    if (!Number.isFinite(analysis?.[field])) {
      throw new Error(
        `Missing Drum Night calibration measurement: ${resource?.id}:${field}`,
      )
    }
  }
  if (
    analysis.noiseFloorDb !== null &&
    analysis.noiseFloorDb !== undefined &&
    !Number.isFinite(analysis.noiseFloorDb)
  ) {
    throw new Error(`Invalid Drum Night noise measurement: ${resource.id}`)
  }
  if (analysis.codecs !== undefined) {
    for (const codec of ['mp3', 'opus']) {
      for (const field of [
        'hardOnsetMs',
        'transientOnsetMs',
        ...CODEC_DELTA_FIELDS,
      ]) {
        if (!Number.isFinite(analysis.codecs?.[codec]?.[field])) {
          throw new Error(
            `Missing Drum Night ${codec} measurement: ${resource.id}:${field}`,
          )
        }
      }
    }
    for (const field of CODEC_DELTA_FIELDS) {
      const expected = analysis.codecs.opus[field] - analysis.codecs.mp3[field]
      const delta = analysis.codecs.opusMinusMp3?.[field]
      if (!Number.isFinite(delta) || Math.abs(delta - expected) > 0.000_001) {
        throw new Error(
          `Invalid Drum Night codec evidence: ${resource.id}:${field}`,
        )
      }
    }
  }
}

function calibrateResource(resource, policy) {
  assertAnalysis(resource)
  const analysis = resource.analysis
  const decodedTransientPeakDbs = decodedValues(analysis, 'transientPeakDb')
  const calibrationTransientPeakDb = decodedMidpoint(
    analysis,
    'transientPeakDb',
  )
  const calibrationTransientPowerDb = decodedMidpoint(
    analysis,
    'transientPowerDb',
  )
  const maximumDecodedFullPeakDb = Math.max(
    ...decodedValues(analysis, 'fullPeakDb'),
  )
  const noiseFloorDb = Number.isFinite(analysis.noiseFloorDb)
    ? analysis.noiseFloorDb
    : null
  const signalToNoiseDb =
    noiseFloorDb === null ? null : analysis.transientPowerDb - noiseFloorDb
  const idealGainDb = policy.targetTransientPeakDb - calibrationTransientPeakDb
  const headroomGainLimitDb =
    policy.maximumFullScalePeakDb - maximumDecodedFullPeakDb
  const noiseGainLimitDb =
    noiseFloorDb === null
      ? policy.maximumUnmeasuredNoiseBoostDb
      : policy.maximumAmplifiedNoiseDb - noiseFloorDb
  const maximumSafeGainDb = Math.min(
    policy.maximumPlaybackGainDb,
    headroomGainLimitDb,
    noiseGainLimitDb,
  )
  const playbackGainDb = Math.max(
    -policy.maximumPlaybackGainDb,
    Math.min(idealGainDb, maximumSafeGainDb),
  )
  const achievedTransientPeakDbs = decodedTransientPeakDbs.map(
    (peakDb) => peakDb + playbackGainDb,
  )
  const achievedTransientPeakDb = calibrationTransientPeakDb + playbackGainDb
  const achievedFullPeakDb = maximumDecodedFullPeakDb + playbackGainDb
  const achievedPowerDb = calibrationTransientPowerDb + playbackGainDb
  const achievedNoiseFloorDb =
    noiseFloorDb === null ? null : noiseFloorDb + playbackGainDb
  const reasons = []

  if (analysis.hardOnsetMs > 5 || analysis.transientOnsetMs > 5) {
    reasons.push('onset')
  }
  if (
    signalToNoiseDb !== null &&
    signalToNoiseDb < policy.minimumSignalToNoiseDb
  ) {
    reasons.push('noise')
  }
  if (
    achievedNoiseFloorDb !== null &&
    achievedNoiseFloorDb > policy.maximumAmplifiedNoiseDb + 0.01
  ) {
    reasons.push('amplified-noise')
  }
  if (achievedFullPeakDb > policy.maximumFullScalePeakDb + 0.01) {
    reasons.push('headroom')
  }

  const targetErrorDb = achievedTransientPeakDb - policy.targetTransientPeakDb
  const maximumAbsoluteTargetErrorDb = Math.max(
    ...achievedTransientPeakDbs.map((peakDb) =>
      Math.abs(peakDb - policy.targetTransientPeakDb),
    ),
  )
  let readiness
  if (reasons.length > 0) {
    readiness = 'fallback'
  } else if (maximumAbsoluteTargetErrorDb <= policy.targetToleranceDb + 0.001) {
    readiness = 'ready'
  } else if (
    Math.min(...achievedTransientPeakDbs) >=
      policy.minimumReducedTransientPeakDb &&
    Math.max(...achievedTransientPeakDbs) <=
      policy.maximumFullScalePeakDb + policy.targetToleranceDb
  ) {
    readiness = 'reduced'
    reasons.push('safe-gain-limit')
  } else {
    readiness = 'fallback'
    reasons.push('outside-useful-output')
  }

  return {
    ...resource,
    playbackGain: Number(dbToGain(playbackGainDb).toFixed(8)),
    readiness,
    analysis: {
      ...analysis,
      noiseFloorDb,
    },
    calibration: {
      maximumDecodedFullPeakDb,
      calibrationTransientPeakDb,
      calibrationTransientPowerDb,
      idealGainDb,
      maximumSafeGainDb,
      playbackGainDb,
      achievedTransientPeakDb,
      achievedFullPeakDb,
      achievedPowerDb,
      achievedNoiseFloorDb,
      signalToNoiseDb,
      targetErrorDb,
      maximumAbsoluteTargetErrorDb,
      reasons,
    },
  }
}

function layerGate(group, policy) {
  const layers = [
    ...Object.values(
      Object.groupBy(
        group,
        (resource) => `${resource.velocityMin}:${resource.velocityMax}`,
      ),
    ),
  ].sort((left, right) => left[0].velocityMin - right[0].velocityMin)
  let maximumRoundRobinSpreadDb = 0
  let maximumLayerBoundaryDb = 0

  for (const layer of layers) {
    const peaks = layer.map(
      (resource) => resource.calibration.achievedTransientPeakDb,
    )
    maximumRoundRobinSpreadDb = Math.max(
      maximumRoundRobinSpreadDb,
      Math.max(...peaks) - Math.min(...peaks),
    )
  }
  for (let index = 1; index < layers.length; index += 1) {
    const lower = layers[index - 1]
    const upper = layers[index]
    const lowerPeak = average(
      lower.map(
        (resource) =>
          resource.calibration.achievedTransientPeakDb +
          gainToDb(
            resolveDrumVelocityTarget(
              resource.articulation,
              resource.velocityMax,
            ),
          ),
      ),
    )
    const upperPeak = average(
      upper.map(
        (resource) =>
          resource.calibration.achievedTransientPeakDb +
          gainToDb(
            resolveDrumVelocityTarget(
              resource.articulation,
              resource.velocityMin,
            ),
          ),
      ),
    )
    maximumLayerBoundaryDb = Math.max(
      maximumLayerBoundaryDb,
      Math.abs(upperPeak - lowerPeak),
    )
  }

  return {
    maximumRoundRobinSpreadDb,
    maximumLayerBoundaryDb,
    passed:
      maximumRoundRobinSpreadDb <= policy.maximumRoundRobinSpreadDb + 0.01 &&
      maximumLayerBoundaryDb <= policy.maximumLayerBoundaryDb + 0.01,
  }
}

function statusForResources(resources) {
  if (
    resources.some((resource) => resource.readiness === 'fallback') === true
  ) {
    return 'fallback'
  }
  if (resources.some((resource) => resource.readiness === 'reduced') === true) {
    return 'reduced'
  }
  return 'ready'
}

function reportResource(resource) {
  const achievedByVelocity = (baseTransientPeakDb) =>
    Object.fromEntries(
      REPRESENTATIVE_VELOCITIES.map((velocity) => [
        velocity,
        round(
          baseTransientPeakDb +
            resource.calibration.playbackGainDb +
            gainToDb(
              resolveDrumHitGain(
                resource.articulation,
                velocity,
                undefined,
                resource.power,
              ),
            ),
        ),
      ]),
    )
  const codecReport =
    resource.analysis.codecs !== undefined
      ? {
          codecs: {
            mp3: {
              ...Object.fromEntries(
                ['hardOnsetMs', 'transientOnsetMs', ...CODEC_DELTA_FIELDS].map(
                  (field) => [
                    field,
                    round(resource.analysis.codecs.mp3[field]),
                  ],
                ),
              ),
              achievedTransientPeakDb: round(
                resource.analysis.codecs.mp3.transientPeakDb +
                  resource.calibration.playbackGainDb,
              ),
              achievedFullPeakDb: round(
                resource.analysis.codecs.mp3.fullPeakDb +
                  resource.calibration.playbackGainDb,
              ),
              achievedTransientPeakDbByVelocity: achievedByVelocity(
                resource.analysis.codecs.mp3.transientPeakDb,
              ),
            },
            opus: {
              ...Object.fromEntries(
                ['hardOnsetMs', 'transientOnsetMs', ...CODEC_DELTA_FIELDS].map(
                  (field) => [
                    field,
                    round(resource.analysis.codecs.opus[field]),
                  ],
                ),
              ),
              achievedTransientPeakDb: round(
                resource.analysis.codecs.opus.transientPeakDb +
                  resource.calibration.playbackGainDb,
              ),
              achievedFullPeakDb: round(
                resource.analysis.codecs.opus.fullPeakDb +
                  resource.calibration.playbackGainDb,
              ),
              achievedTransientPeakDbByVelocity: achievedByVelocity(
                resource.analysis.codecs.opus.transientPeakDb,
              ),
            },
            opusMinusMp3: Object.fromEntries(
              CODEC_DELTA_FIELDS.map((field) => [
                field,
                round(resource.analysis.codecs.opusMinusMp3[field]),
              ]),
            ),
          },
        }
      : {}
  return {
    id: resource.id,
    articulation: resource.articulation,
    velocityRange: [resource.velocityMin, resource.velocityMax],
    roundRobin: resource.roundRobin,
    readiness: resource.readiness,
    source: {
      hardOnsetMs: round(resource.analysis.hardOnsetMs, 3),
      transientOnsetMs: round(resource.analysis.transientOnsetMs, 3),
      transientPeakDb: round(resource.analysis.transientPeakDb),
      fullPeakDb: round(resource.analysis.fullPeakDb),
      transientPowerDb: round(resource.analysis.transientPowerDb),
      noiseFloorDb: round(resource.analysis.noiseFloorDb),
    },
    calibration: {
      playbackGainDb: round(resource.calibration.playbackGainDb),
      calibrationTransientPeakDb: round(
        resource.calibration.calibrationTransientPeakDb,
      ),
      maximumDecodedFullPeakDb: round(
        resource.calibration.maximumDecodedFullPeakDb,
      ),
      maximumSafeGainDb: round(resource.calibration.maximumSafeGainDb),
      achievedTransientPeakDb: round(
        resource.calibration.achievedTransientPeakDb,
      ),
      achievedFullPeakDb: round(resource.calibration.achievedFullPeakDb),
      achievedPowerDb: round(resource.calibration.achievedPowerDb),
      achievedNoiseFloorDb: round(resource.calibration.achievedNoiseFloorDb),
      signalToNoiseDb: round(resource.calibration.signalToNoiseDb),
      targetErrorDb: round(resource.calibration.targetErrorDb),
      maximumAbsoluteTargetErrorDb: round(
        resource.calibration.maximumAbsoluteTargetErrorDb,
      ),
      reasons: [...resource.calibration.reasons],
      achievedTransientPeakDbByVelocity: achievedByVelocity(
        resource.calibration.calibrationTransientPeakDb,
      ),
    },
    ...codecReport,
    ...(resource.power === undefined
      ? {}
      : { normalizedPower: resource.power }),
  }
}

/** Calibrate metadata only; the licensed encoded bytes are never rewritten. */
export function calibrateDrumKitResources(
  inputResources,
  policy = DRUM_KIT_CALIBRATION_POLICY,
) {
  const resources = inputResources
    .map((resource) => calibrateResource(resource, policy))
    .sort((left, right) => left.id.localeCompare(right.id))
  const worstCodecDelta = resources
    .flatMap((resource) =>
      resource.analysis.codecs === undefined
        ? []
        : CODEC_DELTA_FIELDS.map((field) => ({
            id: resource.id,
            field,
            deltaDb: resource.analysis.codecs.opusMinusMp3[field],
          })),
    )
    .sort((left, right) => {
      const deltaOrder = Math.abs(right.deltaDb) - Math.abs(left.deltaDb)
      if (deltaOrder !== 0) return deltaOrder
      const idOrder = left.id.localeCompare(right.id)
      return idOrder !== 0 ? idOrder : left.field.localeCompare(right.field)
    })[0]
  if (
    worstCodecDelta !== undefined &&
    Math.abs(worstCodecDelta.deltaDb) > policy.maximumCodecDeltaDb + 0.001
  ) {
    throw new Error(
      `Drum Night codec output drift: ${worstCodecDelta.id}:${worstCodecDelta.field} ${worstCodecDelta.deltaDb.toFixed(4)} dB exceeds ${policy.maximumCodecDeltaDb.toFixed(2)} dB`,
    )
  }
  const articulationReports = []

  for (const [groupName, group] of groupResourcesByArticulation(resources)) {
    const gate = layerGate(group, policy)
    const achievedPowers = group.map(
      (resource) => resource.calibration.achievedPowerDb,
    )
    const maximumPowerDb = Math.max(...achievedPowers)
    const powerSpreadDb = maximumPowerDb - Math.min(...achievedPowers)
    const normalizedPowerById = new Map(
      group.map((resource) => [
        resource.id,
        Number(
          dbToGain(
            resource.calibration.achievedPowerDb - maximumPowerDb,
          ).toFixed(8),
        ),
      ]),
    )
    const selectable = group.every(
      (resource) => resource.readiness !== 'fallback',
    )
    const powerHeadroomPassed = group.every((resource) => {
      const normalizedPower = normalizedPowerById.get(resource.id)
      return (
        normalizedPower !== undefined &&
        resource.calibration.achievedFullPeakDb +
          gainToDb(
            resolveDrumHitGain(
              resource.articulation,
              127,
              undefined,
              normalizedPower,
            ),
          ) <=
          policy.maximumFullScalePeakDb + 0.01
      )
    })
    const publishPower =
      selectable === true &&
      gate.passed === true &&
      powerSpreadDb <= policy.maximumPowerSpreadDb + 0.01 &&
      powerHeadroomPassed === true

    for (const resource of group) {
      if (publishPower === true) {
        resource.power = normalizedPowerById.get(resource.id)
      } else {
        delete resource.power
      }
    }
    articulationReports.push({
      id: groupName,
      status: statusForResources(group),
      resourceCount: group.length,
      power:
        publishPower === true
          ? 'published'
          : selectable === false
            ? 'omitted-fallback'
            : gate.passed === false
              ? 'omitted-layer-gate'
              : powerHeadroomPassed === false
                ? 'omitted-headroom'
                : 'omitted-power-spread',
      powerSpreadDb: round(powerSpreadDb),
      maximumRoundRobinSpreadDb: round(gate.maximumRoundRobinSpreadDb),
      maximumLayerBoundaryDb: round(gate.maximumLayerBoundaryDb),
    })
  }

  const reportResources = resources.map(reportResource)
  const statusCounts = Object.fromEntries(
    ['ready', 'reduced', 'fallback'].map((status) => [
      status,
      resources.filter((resource) => resource.readiness === status).length,
    ]),
  )
  const report = {
    schemaVersion: DRUM_KIT_CALIBRATION_REPORT_SCHEMA_VERSION,
    generatedBy: 'scripts/curate-drum-night-kits.mjs',
    velocityContract: drumVelocityContractSnapshot(),
    policy: { ...policy },
    summary: {
      resourceCount: resources.length,
      ...statusCounts,
      poweredArticulations: articulationReports.filter(
        (articulation) => articulation.power === 'published',
      ).length,
      omittedPowerArticulations: articulationReports.filter(
        (articulation) => articulation.power !== 'published',
      ).length,
    },
    articulations: articulationReports,
    resources: reportResources,
  }

  return {
    resources,
    report,
    sampleStatus: statusForResources(resources),
  }
}

export function drumKitCalibrationMetadata(
  policy = DRUM_KIT_CALIBRATION_POLICY,
) {
  return {
    velocityContractVersion: DRUM_VELOCITY_CONTRACT_VERSION,
    ...policy,
  }
}

/** Remove measurement-only fields before resources enter the runtime catalog. */
export function projectCalibratedResources(resources) {
  return resources.map(
    ({ analysis: _analysis, calibration: _calibration, ...resource }) =>
      resource,
  )
}
