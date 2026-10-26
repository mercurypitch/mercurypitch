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
//   refused mic or a silent room never strands anyone. A step whose thing is
//   already done as it shows (the mic was on before the tour) does not wait,
//   and a step can name what going wrong sounds like (`mic-failed`) and the
//   line the bubble adds once it has. A quiet do-step waits with nothing on
//   screen and is not counted: the wait through a song.
// - watch: something to look at or read later. The tour goes on.
//
// Tour content lives beside its room and imports only these types, so a
// room's tour costs its chunk a few hundred bytes of strings. They live in lib
// beside the event bus, so a room's feature writes its tour without importing
// the tours (src/features/tours) or loading the coach.

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
   * A `[data-tour="..."]` (or `#id`) selector for what the step points at, or
   * a list of them where a phone and a wide screen draw the same control
   * apart: the first match laid out is used (find-target.ts). None, or nothing
   * on screen that matches, and the bubble stands centred.
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
  /**
   * Asked once, as the step shows: true when the singer has already done it,
   * so the step offers Next instead of waiting for an event that will not
   * come again.
   */
  doneAlready?: () => boolean
  /**
   * The event that says the singer tried and it failed, and the line the
   * bubble adds once it has come, until the step moves on. Skip stays.
   */
  failure?: { event: CoachEventName; aside: CoachAside }
  /**
   * A wait that draws nothing (no bubble, ring or dim) and is not counted in
   * "N of M": Karaoke Night's song, which needs the whole stage until the
   * score card closes. Its event moves the tour on at once; the title and
   * body name it for tests and the tour checks, and are never shown.
   */
  quiet?: true
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
