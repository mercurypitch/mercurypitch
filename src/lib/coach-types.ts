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
//   screen and is not counted: the wait through a song. A do-step can name
//   other events that move it on as its own does, and events after which its
//   own can no longer come, which end the tour where it stands.
// - watch: something to look at or read later. The tour goes on.
//
// A step can also run something while it shows (`run`): Merc singing through
// the room, the way the rooms' demos do. And a tour's last stop can offer a
// second tour beside Done (`more`), which starts in its place.
//
// Tour content lives beside its room and imports only these types, so a
// room's tour costs its chunk a few hundred bytes of strings. They live in lib
// beside the event bus, so a room's feature writes its tour without importing
// the tours (src/features/tours) or loading the coach.

import type { CoachEventName } from '@/lib/coach-events'
import type { MercState } from '@/lib/merc/constants'
import type { TourKey } from '@/lib/tour-ids'

export type CoachStepKind = 'show' | 'do' | 'watch'

/** A wide screen's corner for a bubble with nothing to stand beside. */
export type CoachCorner = 'top-right' | 'bottom-right'

/**
 * What a step runs while it shows: Merc singing through the room. Started as
 * the step shows and stopped as it goes, however it goes (Next, Back, Skip,
 * End tour, the tour ending under it); `stop` puts back all it changed.
 */
export interface CoachStepRun {
  /** Merc's pose while it runs (he sings); null leaves the step's own. */
  pose: () => MercState | null
  /** A short line of what Merc is doing, read out politely; '' says nothing. */
  said: () => string
  /** Stops it and puts the room back as it found it. Safe to call twice. */
  stop: () => void
}

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
   * on screen that matches, and the bubble stands centred (a do-step's in a
   * corner). A target taller than most of the window is not ringed, and the
   * bubble stands in a corner, off it.
   */
  target?: string
  /**
   * That corner on a wide screen; bottom right unless the step names another.
   * Sing's line names the top right: bottom right would hide its lowest note
   * labels and the Monitor's status line, and the left corners the "now"
   * marker at the canvas's left edge (sing-tour.ts). Phones dock the bubble
   * instead.
   */
  corner?: CoachCorner
  /**
   * What the step says instead while its target is not on screen: a body
   * that names a control ("Tap Back") holds only while that control is there
   * to tap.
   */
  unseen?: string
  /**
   * What the step points at meanwhile, with its `unseen` line: Karaoke's
   * phone stop rings the stage's Back, and once Back has taken the stage
   * away, Add a song, which the layer scrolls into view. Its bubble docks as
   * any ringed step's does: `phoneCentred` is for the target itself.
   */
  unseenTarget?: string
  /**
   * On a phone, the bubble stands centred rather than docked: for a stop
   * over a stage whose own transport fills the foot of the window, where a
   * docked sheet would cover it. Its target must stand clear of the middle.
   */
  phoneCentred?: true
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
  /** Run while the step shows, from its first moment (see CoachStepRun). */
  run?: () => CoachStepRun
  /**
   * On a wide screen the bubble stands in its corner (`corner`) even with a
   * ring, rather than beside it: a stop whose ring is on a control while the
   * part of the page to watch is elsewhere (Merc's line on the Sing stage).
   */
  keepCorner?: true
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
  /**
   * Other events that move the step on as `waitFor` does: Karaoke's song
   * stopped with no score card to close, or the singer leaving the stage.
   */
  alsoFor?: readonly CoachEventName[]
  /**
   * Events after which `waitFor` can no longer come for this step: the tour
   * ends, an exit where it stands. Another song on Karaoke's stage is one, so
   * that song's score card never brings the last stop.
   */
  endsOn?: readonly CoachEventName[]
}

export type CoachStep = CoachShowStep | CoachDoStep

/** A second tour the last stop offers beside Done, started in its place. */
export interface CoachMore {
  /** The tour it starts, as its offer is named while its steps load. */
  key: TourKey
  /** What the offer says: "Show me more". */
  label: string
  /** Its steps, loaded on the tap, so no page's first paint carries them. */
  load: () => Promise<CoachTour>
}

export interface CoachTour {
  key: TourKey
  steps: readonly CoachStep[]
  /** Offered on the last stop beside Done; Done still ends the tour. */
  more?: CoachMore
}

/** What the bubble offers once a tour is done: the next thing to try. */
export interface CoachHandoff {
  title: string
  body: string
  go: () => void
}
