// Guitar Night phrase-review copy turns measured facts into one calm next step.
// ============================================================

import type { GuitarPhraseReview, GuitarPhraseUnavailableMetric, } from '@/lib/guitar/guitar-phrase-review'
import type { GuitarTakeSnapshot } from '@/lib/guitar/guitar-take-recorder'
import type { GuitarInputHealthReading } from '@/lib/guitar/input-events'
import type { GuitarNightDoctorView } from './GuitarNightJamDoctor'
import { SCORE_ROOM_MAX_TEMPO, SCORE_ROOM_MIN_TEMPO, } from './useGuitarNightScoreRoomController'

function compactNumber(value: number): string {
  return Number.isInteger(value)
    ? String(value)
    : value.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')
}

export function guitarPhraseAnchorLabel(
  review: GuitarPhraseReview,
  tempoBpm: number,
): string {
  const start = review.range.startBeat + 1
  const length = review.range.endBeat - review.range.startBeat
  return `Beat ${compactNumber(start)} · ${compactNumber(length)} ${length === 1 ? 'beat' : 'beats'} · ${Math.round(tempoBpm)} BPM`
}

/** Reduce the take-owned health counters to one conservative review gate. */
export function retainedTakeHealth(
  take: GuitarTakeSnapshot,
): GuitarInputHealthReading | null {
  const health = take.inputHealth
  if (health.readings === 0) return null
  if (health.states.clipping > 0) {
    return {
      state: 'clipping',
      hint: 'The input clipped during this take.',
    }
  }
  if (
    health.states.noisy >= 3 &&
    health.states.noisy / health.readings >= 0.2
  ) {
    return {
      state: 'noisy',
      hint: 'The room competed with the guitar during this take.',
    }
  }
  if (
    take.events.length === 0 &&
    health.states.silent + health.states.quiet === health.readings
  ) {
    return { state: 'silent', hint: 'No usable guitar signal came through.' }
  }
  if (health.states.good > 0) {
    return { state: 'good', hint: 'Input level was usable.' }
  }
  if (health.states.hot > 0) {
    return { state: 'hot', hint: 'The input ran close to clipping.' }
  }
  return { state: 'quiet', hint: 'The input was quiet but usable.' }
}

function signedMilliseconds(value: number): string {
  if (value === 0) return '0 ms'
  const rounded = Math.round(Math.abs(value))
  return `${value < 0 ? '−' : '+'}${rounded} ms`
}

function firstUnavailable(
  review: GuitarPhraseReview,
): GuitarPhraseUnavailableMetric | null {
  const candidates = [
    review.metrics.calibratedOffset,
    review.metrics.timingConsistency,
    review.metrics.pitchRelationship,
  ]
  return (
    candidates.find(
      (metric): metric is GuitarPhraseUnavailableMetric =>
        metric.status === 'unavailable',
    ) ?? null
  )
}

function headline(review: GuitarPhraseReview): {
  headline: string
  detail: string
} {
  const unavailableMetric = firstUnavailable(review)
  const unavailableReason = unavailableMetric?.reason
  if (review.attackCount === 0 || unavailableReason === 'input-silent') {
    return {
      headline: 'No notes heard.',
      detail:
        'The range stayed open, but no fresh attack reached the review window. Check the input, then try the same phrase again.',
    }
  }
  if (
    unavailableReason === 'input-clipping' ||
    unavailableReason === 'input-noisy'
  ) {
    return {
      headline: 'The input needs a cleaner signal.',
      detail: unavailableMetric?.detail ?? 'Try the phrase again.',
    }
  }
  if (
    unavailableReason === 'partial-take' ||
    unavailableReason === 'take-not-completed'
  ) {
    return {
      headline: 'This review ended before the phrase did.',
      detail:
        'Only the part that reached this device is retained. Future note starts were not counted against the take.',
    }
  }

  const pitch = review.metrics.pitchRelationship
  if (pitch.status === 'available' && pitch.value.differentMidiEvents > 0) {
    return {
      headline: 'Some clear note starts differ from the tab.',
      detail: `${pitch.value.exactMidiMatches} of ${pitch.value.comparedEvents} clear, aligned note starts carried the authored pitch.`,
    }
  }

  const offset = review.metrics.calibratedOffset
  if (offset.status === 'available') {
    const amount = Math.abs(offset.value.medianOffsetMs)
    if (amount <= 20) {
      return {
        headline: 'The phrase sits close to the beat.',
        detail: `${offset.value.matchedAttacks} latency-compensated note starts support this calibrated estimate.`,
      }
    }
    return {
      headline: `The phrase lands ${Math.round(amount)} ms ${offset.value.direction}.`,
      detail: `${offset.value.matchedAttacks} latency-compensated note starts support this calibrated estimate.`,
    }
  }

  const consistency = review.metrics.timingConsistency
  if (consistency.status === 'available') {
    const steady = consistency.value.medianAbsoluteDeviationMs <= 30
    return {
      headline: steady
        ? 'The pulse stayed together.'
        : 'The spacing moves between note starts.',
      detail: `${consistency.value.matchedAttacks} exact-clock note starts were aligned to this range.`,
    }
  }

  if (pitch.status === 'available' && pitch.value.differentMidiEvents === 0) {
    return {
      headline: 'The clear note starts agree with the tab.',
      detail: `${pitch.value.comparedEvents} aligned note starts were clear enough to compare by pitch.`,
    }
  }
  return {
    headline: 'Take ready to review.',
    detail:
      'The captured evidence is kept visible, and anything this take cannot support is named below.',
  }
}

function recoveryDetail(review: GuitarPhraseReview, tempoBpm: number): string {
  switch (review.recovery.kind) {
    case 'calibrate':
      return 'Calibration clicks, then the same phrase and count-in.'
    case 'slow-down': {
      const recoveryTempo = Math.min(
        SCORE_ROOM_MAX_TEMPO,
        Math.max(
          SCORE_ROOM_MIN_TEMPO,
          Math.round(tempoBpm * review.recovery.tempoScale),
        ),
      )
      return `${recoveryTempo} BPM · same range`
    }
    case 'shorten-range':
      return 'A shorter range keeps the next take focused.'
    case 'choose-range':
      return 'Move to the next authored note start.'
    case 'replay':
      return `${review.recovery.countInBeats}-beat count-in · guide stays silent`
  }
}

export function guitarPhraseDoctorView(
  review: GuitarPhraseReview,
  tempoBpm: number,
  comparison?: string,
): GuitarNightDoctorView {
  const primary = headline(review)
  const evidence: GuitarNightDoctorView['evidence'][number][] = [
    {
      label: 'Note starts',
      value: `${review.attackCount} heard · ${review.targetCount} authored`,
      detail:
        'Counts only; this tab does not retain pick-versus-legato intent.',
    },
  ]

  const offset = review.metrics.calibratedOffset
  if (offset.status === 'available') {
    evidence.push({
      label: 'Median timing',
      value: signedMilliseconds(offset.value.medianOffsetMs),
      detail: `Calibrated estimate across ${offset.value.matchedAttacks} matched note starts.`,
    })
  }
  const consistency = review.metrics.timingConsistency
  if (consistency.status === 'available') {
    evidence.push({
      label: 'Timing spread',
      value: `±${Math.round(consistency.value.medianAbsoluteDeviationMs)} ms`,
      detail: `Relative variation across ${consistency.value.matchedAttacks} exact-clock matches.`,
    })
  }
  const pitch = review.metrics.pitchRelationship
  if (pitch.status === 'available') {
    evidence.push({
      label: 'Clear pitches',
      value: `${pitch.value.exactMidiMatches} of ${pitch.value.comparedEvents}`,
      detail: 'Same MIDI pitch at aligned, clarity-qualified note starts.',
    })
  }

  const unavailableReasons = new Set<string>()
  const primaryUnavailable = firstUnavailable(review)
  if (primaryUnavailable !== null) {
    unavailableReasons.add(primaryUnavailable.detail)
  }
  unavailableReasons.add(review.metrics.attackCompleteness.detail)
  unavailableReasons.add(
    'Sustain and pitch stability need release and continuous pitch evidence.',
  )

  return {
    anchorLabel: guitarPhraseAnchorLabel(review, tempoBpm),
    headline: primary.headline,
    detail: primary.detail,
    evidence,
    unavailableReasons: [...unavailableReasons],
    comparison,
    recoveryLabel: review.recovery.label,
    recoveryDetail: recoveryDetail(review, tempoBpm),
    privacyCopy:
      'Only this compact review is saved on this device. Microphone audio and the event stream are not saved.',
  }
}
