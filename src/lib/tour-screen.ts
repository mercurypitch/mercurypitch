// ============================================================
// Tour screen: the page a tour shows, made ready before it points
// ============================================================
//
// A tour points at a page as it usually stands: the Exercises tour at the
// drill list, Merc's Sing tour at the pitch line. A singer can be somewhere
// else on that page when a tour is asked for (a drill open, the Notation
// view, Zen over everything), and the tour then pointed at things that were
// not there. Three kinds of somewhere else, and an answer for each:
//
// - Work that would be lost: a take still saving, a capture open in Voice
//   History. A tour that leaves the tab asks the app first, as any move to
//   another tab does (provideTourLeave): a save holds it, and Voice History
//   asks before its capture goes. A no starts nothing.
// - A detour is something the singer opened over the page a tour shows: a
//   drill, Zen, a challenge stage, an Ear Lab instrument. Closing it ends
//   what they were doing there, so the tour asks first ("Leave Long Note for
//   the Exercises tour?") and closes it only on a yes. The page that owns
//   one names it (provideTourDetour), and every door to a tour asks through
//   startWhenClear. A tab's first-visit offer is not made while one is open
//   (TourChipHost).
// - A setting is how the page is set to show: Melody or Notation, the control
//   bar hidden, Compose's editor view. Changing one ends nothing, so a step
//   names the settings it needs (`screen`), the tour sets them as that step
//   shows, and again on every later step that names them, and puts each back
//   the way the singer had it once the tour ends. The page that owns one says
//   how to set it (provideTourSetting).
//
// In lib with no imports but Solid's and types, so the stores, both tour
// engines and the pages reach it without importing one another.

import { createSignal, untrack } from 'solid-js'
import type { ActiveTab } from '@/types'

/** The settings a tour step can ask for, by the page that owns each. */
export type TourSettingName =
  /** Singing: the Melody view, where the pitch line is drawn (not Notation). */
  | 'sing.melody'
  /** Singing, wide screen: the floating control bar shown, not dismissed. */
  | 'sing.bar'
  /** Piano: the Melody view, with its falling notes (not Notation). */
  | 'piano.melody'
  /** Compose: an editor view with the piano roll and its toolbar groups. */
  | 'compose.piano-roll'
  /** Path: the Ascent, with its orbs (not the plain list). */
  | 'path.ascent'
  /** Community: a feed (Melodies or Sessions), with its search (not Profile). */
  | 'community.feed'

/**
 * Sets the page as a step needs it. Returns how to put it back, or null when
 * it was set so already and there is nothing to put back.
 */
export type TourSetting = () => (() => void) | null

const settings = new Map<TourSettingName, TourSetting>()

/** Says how to set `name`; returns how to take that back (a page that goes). */
export function provideTourSetting(
  name: TourSettingName,
  setting: TourSetting,
): () => void {
  settings.set(name, setting)
  return () => {
    if (settings.get(name) === setting) settings.delete(name)
  }
}

/**
 * Sets each of `names` for the step on screen. `undo` is the tour's own
 * record: the first time a setting changes in a tour, how to put it back is
 * kept there, so the end of the tour restores what the singer had, however
 * often a step set it again. True when anything changed, so an engine can
 * let the page draw before it looks for its target.
 */
export function applyTourSettings(
  names: readonly TourSettingName[] | undefined,
  undo: Map<TourSettingName, () => void>,
): boolean {
  let changed = false
  for (const name of names ?? []) {
    const back = untrack(() => settings.get(name)?.()) ?? null
    if (back === null) continue
    changed = true
    if (!undo.has(name)) undo.set(name, back)
  }
  return changed
}

/** Puts back everything a tour set, newest first, and forgets it. */
export function undoTourSettings(undo: Map<TourSettingName, () => void>): void {
  const backs = [...undo.values()].reverse()
  undo.clear()
  for (const back of backs) back()
}

/**
 * Asks whether a tour of `tabs` may leave the tab on screen, as any move to
 * another tab is asked: `done(true)` lets it go, `done(false)` keeps the
 * singer where they are (the app has said why).
 */
export type TourLeave = (
  tabs: readonly ActiveTab[],
  done: (ok: boolean) => void,
) => void

const freeToLeave: TourLeave = (_tabs, done) => done(true)
let leave: TourLeave = freeToLeave

/** Says how a tour asks to leave the tab; returns how to take that back. */
export function provideTourLeave(guard: TourLeave): () => void {
  leave = guard
  return () => {
    if (leave === guard) leave = freeToLeave
  }
}

/** Something open over the page a tour shows. */
export interface TourDetour {
  /** What it is, as the question names it: "Long Note", "Zen". */
  name: string
  /** Closes it, back to the page under it. Called only on a yes. */
  close: () => void
}

/**
 * What a page has open over the tour of `tab`, if anything. Read inside a
 * tracking scope (the first-visit offer watches it), so read signals.
 */
export type TourDetourCheck = (tab: ActiveTab) => TourDetour | null

const [checks, setChecks] = createSignal<readonly TourDetourCheck[]>([])

/** Names a detour a page can have open; returns how to take it back. */
export function provideTourDetour(check: TourDetourCheck): () => void {
  setChecks((all) => [...all, check])
  return () => setChecks((all) => all.filter((each) => each !== check))
}

/** What is open over the tours of `tabs`: each detour once. */
export function tourDetours(tabs: readonly ActiveTab[]): TourDetour[] {
  const found: TourDetour[] = []
  for (const check of checks()) {
    for (const tab of tabs) {
      const detour = check(tab)
      if (detour !== null) {
        found.push(detour)
        break
      }
    }
  }
  return found
}

/** The question a door asks before a tour closes what is open. */
export interface TourAsk {
  /** What closes, in the order the pages named them. */
  detours: readonly TourDetour[]
  /** The tour, as the question names it: "the Exercises tour". */
  tour: string
  /** Starts the tour, once the detours are closed. */
  go: () => void
}

const [ask, setAsk] = createSignal<TourAsk | null>(null)

/** The question on screen, if a door is asking one (TourScreenHost draws it). */
export const tourAsk = ask

/**
 * Starts a tour of `tabs` (`tour` names it for the question). First the app
 * says whether the singer may leave the tab on screen; then, with nothing
 * open over the tour's tabs, it starts at once, and with something open it
 * asks: on a yes (answerTourAsk) what is open closes and the tour starts, on
 * a no nothing changes.
 */
export function startWhenClear(
  tabs: readonly ActiveTab[],
  tour: string,
  start: () => void,
): void {
  leave(tabs, (ok) => {
    if (!ok) return
    const open = untrack(() => tourDetours(tabs))
    if (open.length === 0) start()
    else setAsk({ detours: open, tour, go: start })
  })
}

/** The singer's answer to the question on screen. */
export function answerTourAsk(yes: boolean): void {
  const asked = untrack(ask)
  setAsk(null)
  if (asked === null || !yes) return
  for (const detour of asked.detours) detour.close()
  asked.go()
}
