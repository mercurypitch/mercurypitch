// ============================================================
// Survey timing — when it is fair to ask for feedback
// ============================================================
//
// Pure, so the "is this a good moment?" rules can be tested without a browser.
// App.tsx owns the reactive signals and feeds them in.
//
// Two separate questions, deliberately kept apart:
//
//   1. Has this person used the app enough to HAVE an opinion?  (earned)
//   2. Is right now a moment when a modal would not be rude?    (timing)
//
// Failing (1) means never ask yet. Failing (2) means ask later — the caller
// re-runs as signals change, so the prompt lands the moment they stop.

/** Cumulative foreground time before the survey is earned. */
export const SURVEY_MIN_USAGE_MS = 12 * 60_000

/**
 * Finished exercises or practice sessions before the survey is earned.
 *
 * Counts COMPLETIONS, not "activities": starting playback used to be enough,
 * which meant someone who pressed play twice and wandered off got asked what
 * they thought. Two finished runs is enough to have an opinion worth reading.
 */
export const SURVEY_MIN_COMPLETIONS = 2

export interface SurveyUsage {
  usageMs: number
  completions: number
  /** Dev escape hatch (localStorage pitchperfect_survey_force). */
  forced?: boolean
}

/** Has this person used the app enough that asking is fair? */
export function surveyUsageEarned(u: SurveyUsage): boolean {
  if (u.forced === true) return true
  return (
    u.usageMs >= SURVEY_MIN_USAGE_MS && u.completions >= SURVEY_MIN_COMPLETIONS
  )
}

export interface SurveyMoment {
  /** Playback running, mic capturing, or a practice session in progress. */
  practicing: boolean
  /** A tour, guide or walkthrough surface is up. */
  tourOpen: boolean
  /** A result, summary or celebration modal is up. */
  modalOpen: boolean
}

/**
 * Is right now a moment we can interrupt?
 *
 * Interrupting someone mid-exercise is the single worst time to ask: they are
 * singing, they cannot read it, and the reflex is to hit whatever dismisses it.
 * That is how a survey gets "answered" with nothing. The force flag does NOT
 * override this — a forced survey that covers a tour is still a bug.
 */
export function surveyMomentOk(m: SurveyMoment): boolean {
  return !m.practicing && !m.tourOpen && !m.modalOpen
}

/**
 * How long Skip stays inert after the modal appears.
 *
 * The modal can arrive while hands are already moving; without this, a click
 * that was meant for the app lands on Skip and the survey is gone for good
 * (it is once-per-browser). Long enough to break the reflex, short enough not
 * to feel like a dark pattern holding the UI hostage.
 */
export const SURVEY_SKIP_ARM_MS = 3000

/** Whole seconds left on the arming delay, for the button label. */
export function skipArmSecondsLeft(remainingMs: number): number {
  return Math.max(0, Math.ceil(remainingMs / 1000))
}

/** Does this response carry anything worth storing? */
export function surveyHasContent(a: {
  background?: string[]
  usage?: string[]
  featureRequest?: string
}): boolean {
  return (
    (a.background?.length ?? 0) > 0 ||
    (a.usage?.length ?? 0) > 0 ||
    (a.featureRequest ?? '').trim().length > 0
  )
}
