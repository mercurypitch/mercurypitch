// ============================================================
// Guided Practice Handoff — local return path from a focus reading
// ============================================================
//
// A recommendation can temporarily send the singer to an exercise. This
// store carries the immutable retake protocol back to Hear Yourself without
// persisting navigation state or weakening the protocol comparison contract.

import { createSignal } from 'solid-js'
import type { GuidedPracticeLaunchConfig } from '@/features/exercises/types'
import type { GuidedPracticeRecommendation, GuidedRetakeProtocol, } from '@/lib/guided-voice'
import { isPitchCentrePilotProtocol, PITCH_CENTRE_PILOT_RECOMMENDATION_RULES_V1, PITCH_CENTRE_PILOT_THRESHOLDS_V1, } from '@/lib/guided-voice'

export interface GuidedPracticeHandoff {
  assessmentRunId: string
  takeId: string | null
  retake: GuidedRetakeProtocol
}

interface GuidedPracticeHandoffState extends GuidedPracticeHandoff {
  phase: 'practising' | 'returned'
  practice: GuidedPracticeLaunchConfig | null
}

const [handoff, setHandoff] = createSignal<GuidedPracticeHandoffState | null>(
  null,
)

function withoutPhase(
  value: GuidedPracticeHandoffState,
): GuidedPracticeHandoff {
  return {
    assessmentRunId: value.assessmentRunId,
    takeId: value.takeId,
    retake: value.retake,
  }
}

export function armGuidedPracticeHandoff(
  value: GuidedPracticeHandoff,
  practice?: GuidedPracticeLaunchConfig,
): void {
  setHandoff({
    ...value,
    phase: 'practising',
    practice: practice ?? pitchCentrePracticeFor(value),
  })
}

/** Keep the executable slice of a persisted recommendation intact in transit. */
export function guidedPracticeLaunchFromRecommendation(
  recommendation: GuidedPracticeRecommendation,
): GuidedPracticeLaunchConfig {
  const targetMidiCents = pitchCentreTargetMidiCents(recommendation.retake)
  if (targetMidiCents === null) {
    throw new Error('Guided Pitch Hold launch has an unsupported protocol')
  }
  return {
    assessmentRunId: recommendation.returnDestination.assessmentRunId,
    exercise: recommendation.exercise,
    dose: recommendation.dose,
    stopRuleId: recommendation.stopRuleId,
    targetMidiCents,
    toleranceCents:
      PITCH_CENTRE_PILOT_THRESHOLDS_V1.measurement.settleToleranceCents,
  }
}

/**
 * Read the launch-scoped prescription while App is mounting the exercise.
 * The same handoff signal owns navigation and dose context; there is no
 * parallel store that could outlive or disagree with it.
 */
export function currentGuidedPracticeLaunch(): GuidedPracticeLaunchConfig | null {
  const current = handoff()
  if (current === null || current.phase !== 'practising') return null
  return current.practice
}

/** Mark an armed guided exercise as complete and return its immutable context. */
export function returnFromGuidedPractice(): GuidedPracticeHandoff | null {
  const current = handoff()
  if (current === null || current.phase !== 'practising') return null

  setHandoff({ ...current, phase: 'returned' })
  return withoutPhase(current)
}

/** Consume the return once Hear Yourself is ready to present the retake path. */
export function consumeGuidedPracticeReturn(): GuidedPracticeHandoff | null {
  const current = handoff()
  if (current === null || current.phase !== 'returned') return null

  setHandoff(null)
  return withoutPhase(current)
}

export function clearGuidedPracticeHandoff(): void {
  setHandoff(null)
}

function pitchCentrePracticeFor(
  value: GuidedPracticeHandoff,
): GuidedPracticeLaunchConfig | null {
  const targetMidiCents = pitchCentreTargetMidiCents(value.retake)
  if (targetMidiCents === null) return null

  // Both reviewed Pitch Centre outcomes intentionally share one bounded
  // Pitch Hold execution contract; only their evidence-linked rationale
  // differs. That lets the immediate Keep & Practise route recover the exact
  // dose even though its legacy handoff call only carries the retake protocol.
  const template = PITCH_CENTRE_PILOT_RECOMMENDATION_RULES_V1[0]?.recommendation
  if (template === undefined) return null
  return {
    assessmentRunId: value.assessmentRunId,
    exercise: template.exercise,
    dose: template.dose,
    stopRuleId: template.stopRuleId,
    targetMidiCents,
    toleranceCents:
      PITCH_CENTRE_PILOT_THRESHOLDS_V1.measurement.settleToleranceCents,
  }
}

function pitchCentreTargetMidiCents(
  retake: Readonly<GuidedRetakeProtocol>,
): number | null {
  if (!isPitchCentrePilotProtocol(retake)) return null
  const fittedCentre = retake.task.parameters.fittedCentreMidiCents
  return typeof fittedCentre === 'number' && Number.isSafeInteger(fittedCentre)
    ? fittedCentre
    : null
}
