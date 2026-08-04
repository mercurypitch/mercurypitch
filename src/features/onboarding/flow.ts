// ============================================================
// First Light — the beat graph (pure)
// ============================================================
//
// The onboarding is an ordered list of beats, not all of which
// apply to every visitor: the voiceprint pair only runs on the full
// track, and there is nothing to "keep" if nothing was measured.
// Keeping the traversal pure makes every skip rule testable without
// mounting a component.
//
// See docs/plans/onboarding-first-light.md.

/**
 * The seven beats, in the order they are walked.
 *
 * `keep` sits BEFORE `map`, which the plan originally had the other way
 * round. The Map's entire job is to send someone into a room, so an ask
 * placed after it either never fires (they clicked a room and left) or
 * interrupts them on their way out — and interrupting is the wall this
 * flow exists to avoid. Asking while the twin portrait is still on
 * screen is both the stronger moment and the politer one, and it leaves
 * the Map as the last thing they see either way.
 */
export const BEAT_ORDER = [
  'sky',
  'first-light',
  'fork',
  'prints',
  'voiceprint',
  'twin',
  'keep',
  'map',
] as const

export type Beat = (typeof BEAT_ORDER)[number]

/**
 * `short` is the ~25s spine everyone walks; `full` adds the ~90s
 * voiceprint fork; `gallery` is what the fork offers instead of `full`
 * to someone who has already mapped their voice — their existing
 * voiceprints, shown at full size, rather than a second measurement
 * they did not ask for. Null until the visitor chooses at the fork.
 */
export type OnboardingTrack = 'short' | 'full' | 'gallery'

export interface FlowState {
  track: OnboardingTrack | null
  /** True once a voiceprint has actually been measured IN THIS RUN. */
  hasVoiceprint: boolean
  /** True once the visitor has refused (or cannot use) the microphone. */
  micDenied: boolean
  /**
   * Voiceprints this visitor already had before the flow opened. The
   * fork reads this to stop offering "map my whole voice" to someone
   * who has done exactly that, four times.
   */
  savedPrints: number
}

/**
 * Whether a beat applies at all to this visitor. Separate from whether
 * the app can currently render it (see `available` in `nextBeat`) —
 * that is a build-phase concern, this is a product rule.
 */
export function isBeatApplicable(beat: Beat, state: FlowState): boolean {
  if (state.micDenied) {
    // Every remaining beat except the Map needs a working microphone.
    // Offering "map my whole voice" to someone who just refused the mic
    // is the kind of thing that makes a product feel like it wasn't
    // paying attention.
    return beat === 'map'
  }
  switch (beat) {
    // The voiceprint pair is the opt-in fork.
    case 'voiceprint':
    case 'twin':
      return state.track === 'full'
    // Only ever reached by choosing it, and only offered when there is
    // something in it. An empty gallery is not a beat.
    case 'prints':
      return state.track === 'gallery' && state.savedPrints > 0
    // Nothing measured means nothing worth offering to keep. Asking
    // anyway is the generic "sign up!" wall this flow exists to avoid.
    case 'keep':
      return state.hasVoiceprint
    default:
      return true
  }
}

/**
 * The next beat to show, or `null` when the flow is over and the
 * visitor should be handed to the app.
 *
 * `available` is the set of beats the caller can actually render. It
 * exists so beats can land phase by phase without the traversal
 * needing to know which ones are built yet — an unbuilt beat is
 * skipped exactly like an inapplicable one.
 */
export function nextBeat(
  current: Beat,
  state: FlowState,
  available: ReadonlySet<Beat>,
): Beat | null {
  const index = BEAT_ORDER.indexOf(current)
  for (let i = index + 1; i < BEAT_ORDER.length; i++) {
    const beat = BEAT_ORDER[i]
    if (isBeatApplicable(beat, state) && available.has(beat)) return beat
  }
  return null
}

/** The first beat the flow can show — `null` if none is renderable. */
export function firstBeat(
  state: FlowState,
  available: ReadonlySet<Beat>,
): Beat | null {
  for (const beat of BEAT_ORDER) {
    if (isBeatApplicable(beat, state) && available.has(beat)) return beat
  }
  return null
}

/**
 * The beats this visitor will actually see, in order. Both the progress
 * hairline and the sky's beads are cuts of this one list, which is why
 * it is a function rather than two near-identical filters.
 */
export function walkedBeats(
  state: FlowState,
  available: ReadonlySet<Beat>,
): Beat[] {
  return BEAT_ORDER.filter(
    (beat) => isBeatApplicable(beat, state) && available.has(beat),
  )
}

/**
 * Progress through the beats this visitor will actually see, 0–1.
 * Drives the thin progress hairline in the frame; a visitor on the
 * short track should not see a bar that stalls at 40%.
 */
export function beatProgress(
  current: Beat,
  state: FlowState,
  available: ReadonlySet<Beat>,
): number {
  const walked = walkedBeats(state, available)
  if (walked.length <= 1) return 1
  const index = walked.indexOf(current)
  if (index < 0) return 0
  return index / (walked.length - 1)
}
