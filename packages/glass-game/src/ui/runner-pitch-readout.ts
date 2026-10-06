// Runner pitch readout — format judge-owned feedback without reclassifying the voice.
import type { RunnerTargetSnapshot } from '../runner/contracts'
import { runnerMidiName } from '../runner/notation'

/** Display span only. This does not set the singing tolerance. */
export const RUNNER_PITCH_RAIL_SPAN_CENTS = 600

export function runnerPitchReadout(
  target: Pick<RunnerTargetSnapshot, 'currentTargetMidi' | 'pitchFeedback'>,
) {
  const feedback = target.pitchFeedback
  return {
    state: feedback.state,
    targetLabel: runnerMidiName(
      feedback.comparedTargetMidi ?? target.currentTargetMidi,
    ).text,
    observedLabel:
      feedback.observedMidi === null
        ? null
        : runnerMidiName(feedback.observedMidi).text,
    correction: feedback.correction,
    cue:
      feedback.state === 'neutral'
        ? 'Listening'
        : feedback.state === 'accepted'
          ? 'Matched'
          : feedback.correction === 'higher'
            ? 'Sing higher'
            : 'Sing lower',
    markerTopPercent:
      feedback.errorCents === null
        ? null
        : Math.max(
            5,
            Math.min(
              95,
              feedback.state === 'accepted'
                ? 50
                : 50 -
                    (feedback.errorCents / RUNNER_PITCH_RAIL_SPAN_CENTS) * 90,
            ),
          ),
  }
}
