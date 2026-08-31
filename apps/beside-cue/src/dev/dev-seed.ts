// ============================================================
// Dev seed — boot straight to HOME with a plan already saved
// ============================================================
//
// Only reachable from an `import.meta.env.DEV` branch (see
// `dev-seed-flag.ts`). It writes what a finished first run would have
// written: one active cue, and the onboarding marked seen — so the games
// and every post-setup screen are one load away instead of a walk through
// the intro. The plan text is obviously placeholder, never a real person's
// words.

import type { BesideCueRepository, BesideCueStateV1, } from '@irchiinnuss/beside-cue-core'
import { activateCue, createCue, createInitialState, } from '@irchiinnuss/beside-cue-core'
import type { CinematicOnboardingPreferenceStore } from '../onboarding/cinematic-onboarding-preference'

const SEED_CUE_ID = 'dev-seed-cue'

export interface DevSeedOptions {
  readonly repository: BesideCueRepository
  readonly onboardingPreferences: CinematicOnboardingPreferenceStore
  readonly onboardingRevision: string
  readonly now?: () => Date
}

/** Seeds a first-run-complete device. Returns true when it wrote state,
 * false when the device already had a plan and was left untouched. */
export async function seedDevState(options: DevSeedOptions): Promise<boolean> {
  const now = options.now ?? ((): Date => new Date())
  options.onboardingPreferences.write(
    options.onboardingRevision,
    'dismissed',
    now,
  )
  const stored: BesideCueStateV1 | null = await options.repository.loadState()
  if (stored !== null && stored.cues.length > 0) return false

  const at = now().toISOString()
  const created = createCue(stored ?? createInitialState(), {
    id: SEED_CUE_ID,
    pullText: 'Endless scrolling',
    bSideText: 'Walk to the end of the street',
    at,
  })
  await options.repository.saveState(
    activateCue(created.state, SEED_CUE_ID, at).state,
  )
  return true
}
