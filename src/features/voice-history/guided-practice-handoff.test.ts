// ============================================================
// Guided Practice Handoff tests — exact dose and one-time return context
// ============================================================

import { afterEach, describe, expect, it } from 'vitest'
import type { GuidedPracticeRecommendation, GuidedRetakeProtocol, } from '@/lib/guided-voice'
import { createPitchCentrePilotProtocol, PITCH_CENTRE_PILOT_RECOMMENDATION_RULES_V1, } from '@/lib/guided-voice'
import { armGuidedPracticeHandoff, clearGuidedPracticeHandoff, consumeGuidedPracticeReturn, currentGuidedPracticeLaunch, guidedPracticeLaunchFromRecommendation, returnFromGuidedPractice, } from './guided-practice-handoff'

const RETAKE = createPitchCentrePilotProtocol({
  comfortableRangeMidiCents: [4_800, 6_000],
  preferredMidiCents: 5_400,
}) as GuidedRetakeProtocol

afterEach(() => clearGuidedPracticeHandoff())

describe('guided practice handoff', () => {
  it('returns and consumes an armed retake once', () => {
    const value = {
      assessmentRunId: 'run-1',
      takeId: 'take-1',
      retake: RETAKE,
    }

    armGuidedPracticeHandoff(value)

    expect(currentGuidedPracticeLaunch()).toMatchObject({
      assessmentRunId: 'run-1',
      exercise: {
        exerciseId: 'pitch-hold',
        configuration: {
          configurationId: 'pitch-hold.guided-pitch-centre',
        },
      },
      dose: {
        durationMilliseconds: 5_000,
        repetitions: 3,
        sets: 1,
      },
      stopRuleId: 'guided.stop-on-discomfort-v1',
      targetMidiCents: 5_400,
      toleranceCents: 35,
    })
    expect(returnFromGuidedPractice()).toEqual(value)
    expect(currentGuidedPracticeLaunch()).toBeNull()
    expect(consumeGuidedPracticeReturn()).toEqual(value)
    expect(consumeGuidedPracticeReturn()).toBeNull()
  })

  it('does nothing when no guided practice is armed', () => {
    expect(returnFromGuidedPractice()).toBeNull()
    expect(consumeGuidedPracticeReturn()).toBeNull()
  })

  it('preserves the saved recommendation execution contract exactly', () => {
    const template =
      PITCH_CENTRE_PILOT_RECOMMENDATION_RULES_V1[1]!.recommendation
    const recommendation: GuidedPracticeRecommendation = {
      ...template,
      originatingAssessmentId: 'pitch-centre',
      originatingEvidenceIds: ['pitch-centre.evidence.settled-landings'],
      returnDestination: {
        kind: 'guided-focus-reading',
        assessmentRunId: 'run-saved',
      },
      retake: RETAKE,
    }

    const practice = guidedPracticeLaunchFromRecommendation(recommendation)
    armGuidedPracticeHandoff(
      {
        assessmentRunId: 'run-saved',
        takeId: 'take-saved',
        retake: RETAKE,
      },
      practice,
    )

    expect(currentGuidedPracticeLaunch()).toEqual({
      assessmentRunId: 'run-saved',
      exercise: recommendation.exercise,
      dose: recommendation.dose,
      stopRuleId: recommendation.stopRuleId,
      targetMidiCents: 5_400,
      toleranceCents: 35,
    })
  })
})
