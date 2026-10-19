// ============================================================
// The Warm-up's reads for its card: whether today counts
// ============================================================
//
// The card reads the Warm-up's store, not its path: "Warmed up today" once
// the end was reached today with a stop finished (DESIGN-warm-up.md §8,
// N11). The week's seven dots join it with the synced days (PR 13e). It
// opens on no note of its own (each stop finds its own), keeps no best,
// and has no demo of its own.

import { warmedUpToday } from '@/features/warm-up/warm-up-store'

export interface WarmEntry {
  note: () => string | null
  progress: () => string | null
  demoAutoPlays: () => boolean
}

/** The card's line once today counts. */
export const WARMED_UP_TODAY = 'Warmed up today'

/** Reactive reads: each call reads the store as it is now. */
export function warmEntry(): WarmEntry {
  return {
    note: () => null,
    progress: () => (warmedUpToday() ? WARMED_UP_TODAY : null),
    demoAutoPlays: () => false,
  }
}
