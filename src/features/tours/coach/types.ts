// ============================================================
// Coach types — what a Merc tour is made of
// ============================================================
//
// A tour is at most four steps, each one of three kinds:
//
// - show: Merc points at something and says what it is. Next moves on.
// - do: Merc asks the singer to do something (sing a note, start a song) and
//   waits for it. The app tells the coach it happened through the event bus
//   (src/lib/coach-events.ts), so a do-step names the event it waits for, and
//   the type makes that name required. Skip stays open the whole time, so a
//   refused mic or a silent room never strands anyone.
// - watch: something to look at or read later. The tour goes on.
//
// Tour content lives beside its room and imports only these types, so a
// room's tour costs its chunk a few hundred bytes of strings.

import type { CoachEventName } from '@/lib/coach-events'
import type { MercState } from '@/lib/merc/constants'
import type { TourKey } from '@/lib/tour-ids'

export type CoachStepKind = 'show' | 'do' | 'watch'

/** A line under a step's body, worked out when the step shows: a price, a balance. */
export interface CoachAside {
  title: string
  sub: string
}

interface CoachStepBase {
  /** Stable within its tour; tests and the tour checks name steps by it. */
  id: string
  title: string
  body: string
  /**
   * A `[data-tour="..."]` (or `#id`) selector for what the step points at.
   * None, or nothing on screen that matches, and the bubble stands centred.
   */
  target?: string
  /** Merc's pose while the step shows. */
  merc: MercState
  /** A lesson that explains the step, opened in a new tab. */
  lesson?: { href: string; title: string }
  /** A sound the singer can tap to hear: the note to copy. Never autoplayed. */
  sound?: 'hold-tone'
  /** Only on this kind of screen; the other one never sees the step. */
  viewport?: 'phone' | 'desktop'
  /** A line under the body, read when the step shows; null shows nothing. */
  aside?: () => CoachAside | null
}

export interface CoachShowStep extends CoachStepBase {
  kind: 'show' | 'watch'
  waitFor?: undefined
}

export interface CoachDoStep extends CoachStepBase {
  kind: 'do'
  /** What the singer has to do before the step moves on by itself. */
  waitFor: CoachEventName
}

export type CoachStep = CoachShowStep | CoachDoStep

export interface CoachTour {
  key: TourKey
  steps: readonly CoachStep[]
}

/** What the bubble offers once a tour is done: the next thing to try. */
export interface CoachHandoff {
  title: string
  body: string
  go: () => void
}
