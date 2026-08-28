// ============================================================
// Pitch Centre pilot protocol — exact-register route fitting and validation
// ============================================================
//
// Protocol creation and recognition live at one boundary so persisted takes
// can be checked against the same deterministic route the recorder authored.

import { buildGuidedComparisonFingerprint } from './comparison'
import type { GuidedRetakeProtocol, GuidedTaskConfiguration } from './contracts'
import { PITCH_CENTRE_PILOT_IDENTITY_V1, PITCH_CENTRE_PILOT_THRESHOLDS_V1, } from './pitch-centre-assessment-policy'
import type { CreatePitchCentrePilotProtocolInput } from './pitch-centre-assessment-types'
import { freezeDeep, sameJsonValue } from './pitch-centre-assessment-utils'

function requireSafeMidiCents(label: string, value: number): void {
  if (!Number.isSafeInteger(value)) {
    throw new Error(`Pitch Centre ${label} must use integer MIDI-cents`)
  }
}

/**
 * Fit the three-note pilot route to a declared comfortable range. Targets are
 * authored semitones and never octave-folded during either fitting or scoring.
 */
export function createPitchCentrePilotProtocol(
  input: CreatePitchCentrePilotProtocolInput,
): Readonly<GuidedRetakeProtocol> {
  const [rangeLow, rangeHigh] = input.comfortableRangeMidiCents
  requireSafeMidiCents('range floor', rangeLow)
  requireSafeMidiCents('range ceiling', rangeHigh)
  requireSafeMidiCents('preferred note', input.preferredMidiCents)
  if (
    rangeHigh - rangeLow <
    PITCH_CENTRE_PILOT_THRESHOLDS_V1.minimumComfortableSpanMidiCents
  ) {
    throw new Error('Pitch Centre comfortable range is too narrow for pilot')
  }

  const lowerOffset = Math.abs(
    PITCH_CENTRE_PILOT_THRESHOLDS_V1.targetOffsetsMidiCents[0],
  )
  const upperOffset = PITCH_CENTRE_PILOT_THRESHOLDS_V1.targetOffsetsMidiCents[2]
  const minimumCentre = Math.ceil((rangeLow + lowerOffset) / 100) * 100
  const maximumCentre = Math.floor((rangeHigh - upperOffset) / 100) * 100
  if (minimumCentre > maximumCentre) {
    throw new Error(
      'Pitch Centre comfortable range contains no three-note pilot route',
    )
  }

  const preferredSemitone = Math.round(input.preferredMidiCents / 100) * 100
  const fittedCentreMidiCents = Math.min(
    maximumCentre,
    Math.max(minimumCentre, preferredSemitone),
  )
  const targetMidiCents =
    PITCH_CENTRE_PILOT_THRESHOLDS_V1.targetOffsetsMidiCents.map(
      (offset) => fittedCentreMidiCents + offset,
    )
  const task: GuidedTaskConfiguration = {
    taskId: 'pitch-centre.pilot-three-landings',
    cueId: 'pitch-centre.cue.hear-then-land',
    comfortableRangeMidiCents: [rangeLow, rangeHigh],
    targetMidiCents,
    tempoBpm: null,
    durationMilliseconds:
      PITCH_CENTRE_PILOT_THRESHOLDS_V1.landingWindowMilliseconds *
      PITCH_CENTRE_PILOT_THRESHOLDS_V1.repetitions,
    repetitions: PITCH_CENTRE_PILOT_THRESHOLDS_V1.repetitions,
    parameters: {
      fittedCentreMidiCents,
      preferredMidiCents: input.preferredMidiCents,
      landingWindowMilliseconds:
        PITCH_CENTRE_PILOT_THRESHOLDS_V1.landingWindowMilliseconds,
      routeOffsetsMidiCents: [
        ...PITCH_CENTRE_PILOT_THRESHOLDS_V1.targetOffsetsMidiCents,
      ],
      exactRegister: true,
      octaveFold: false,
      vowel: 'ah',
    },
  }
  const comparisonFingerprint = buildGuidedComparisonFingerprint({
    identity: PITCH_CENTRE_PILOT_IDENTITY_V1,
    task,
  })

  return freezeDeep({
    identity: { ...PITCH_CENTRE_PILOT_IDENTITY_V1 },
    task,
    comparisonFingerprint,
  })
}

/** Accept only the exact versioned task produced by the Pitch Centre pilot. */
export function isPitchCentrePilotProtocol(
  protocol: Readonly<GuidedRetakeProtocol>,
): boolean {
  try {
    const range = protocol.task.comfortableRangeMidiCents
    const preferred = protocol.task.parameters.preferredMidiCents
    if (
      range === null ||
      typeof preferred !== 'number' ||
      !Number.isSafeInteger(preferred)
    ) {
      return false
    }
    const expected = createPitchCentrePilotProtocol({
      comfortableRangeMidiCents: [range[0], range[1]],
      preferredMidiCents: preferred,
    })
    return (
      sameJsonValue(protocol, expected) &&
      protocol.comparisonFingerprint === expected.comparisonFingerprint &&
      protocol.comparisonFingerprint ===
        buildGuidedComparisonFingerprint({
          identity: protocol.identity,
          task: protocol.task,
        })
    )
  } catch {
    return false
  }
}
