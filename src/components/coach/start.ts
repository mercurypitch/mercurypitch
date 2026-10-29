// ============================================================
// Coach start — runs a Merc tour, loading the coach on the first one
// ============================================================
//
// The one door to the coach, and the only part of it a page imports
// statically: the runner, the layer and Merc's renderer load when a tour
// starts (or earlier, from warmCoach), so no page's first paint carries them.
//
// - One tour at a time. Starting one ends the tour on screen first, with
//   'exit', and a tour still loading when another starts never shows.
// - coachActive() names the tour from the moment it is asked for until its
//   layer is gone, its hand-over included, so a host that offers tours
//   (the chip, the legacy walkthrough) waits for it.
// - The layer mounts in a #coach-root of its own on <body>, outside #app,
//   which a full-screen stage makes inert while it is up.
// - Focus goes back when the layer goes, however the tour ended (Done, End
//   tour, Escape, a tab change): to what had it as the tour was asked for,
//   if that is still in the page to take it, else to the page's main
//   heading, which is focusable only while it holds focus: the main one the
//   singer can see (drawn, and on top at its middle), so not the rail's
//   card under Karaoke's phone stage. Only focus the
//   tour had: in its layer, or fallen to the page itself. A tour that ends
//   while the singer is busy in the page (a quiet wait has no bubble) leaves
//   their focus where it is.
// - "Show me more". A tour that offers another (`more`) shows it beside Done
//   on its last stop. A tap ends this tour done, with no hand-over, and
//   starts that one in its place once its steps have loaded (they load on the
//   tap): its own runner and layer, the same screen and the same hand-over at
//   its end, and the focus to give back that this one held. coachActive()
//   names it meanwhile, so nothing lands in the gap; ended meanwhile (a tab
//   change), or with steps that did not arrive, it never shows, and focus
//   goes back as it would have.
// - How the page was set for the steps (a step's `screen`: Melody, not
//   Notation) is put back once the tour ends, and not between a tour and the
//   one "Show me more" starts, which would set it again a moment later: one
//   record goes down the chain, put back when its last tour goes, or when
//   the next does not come.
//
// The coach is shared UI: the app's tours, the plan's showcase and Karaoke
// Night, a document of its own, all run tours on it, so it lives in
// components and imports no feature.

import { coachActive, setCoachActive } from '@/lib/coach-state'
import type { CoachHandoff, CoachMore, CoachTour } from '@/lib/coach-types'
import type { TourSettingName } from '@/lib/tour-screen'
import { undoTourSettings } from '@/lib/tour-screen'
import type { CoachEnd } from './runner'

export interface CoachHandle {
  /** Ends the tour now: an exit where it stands, or the hand-over closed. */
  end(): void
  /** Settles once the layer is gone, with how the tour itself ended. */
  ended: Promise<CoachEnd>
}

export interface CoachStartOptions {
  /** A phone's layout: a sheet above the tab bar, and the phone's steps. */
  phone?: boolean
  /** What the bubble offers once the tour is done. */
  handoff?: () => CoachHandoff | null
  onEnd?: (result: CoachEnd) => void
}

export const COACH_ROOT_ID = 'coach-root'

const loadCoach = () =>
  Promise.all([import('./runner'), import('./CoachLayer')])

let generation = 0
let running: CoachHandle | null = null
/** Where focus stood when the tour on screen was asked for. */
let runningFocus: HTMLElement | null = null

/** What has focus now in the page: not the page itself, nor a bubble. */
function focusedNow(): HTMLElement | null {
  const el = document.activeElement
  if (!(el instanceof HTMLElement) || el === document.body) return null
  return el.closest(`#${COACH_ROOT_ID}`) === null ? el : null
}

const HEADINGS = 'h1, h2, h3, [role="heading"]'

const levelOf = (el: HTMLElement): number => {
  const aria = Number(el.getAttribute('aria-level'))
  if (aria > 0) return aria
  const tag = /^H([1-6])$/.exec(el.tagName)
  return tag === null ? 2 : Number(tag[1])
}

/**
 * True when the singer can see `el`: drawn (not hidden, not faded out) and
 * what lies at its own middle in the window, so not under a stage or sheet.
 */
function inSight(el: HTMLElement): boolean {
  const drawn =
    typeof el.checkVisibility !== 'function' ||
    el.checkVisibility({ opacityProperty: true, visibilityProperty: true })
  const r = el.getBoundingClientRect()
  const x = r.left + r.width / 2
  const y = r.top + r.height / 2
  const inWindow =
    r.width > 0 &&
    r.height > 0 &&
    x >= 0 &&
    y >= 0 &&
    x < window.innerWidth &&
    y < window.innerHeight
  if (!drawn || !inWindow || typeof document.elementFromPoint !== 'function') {
    return false
  }
  const top = document.elementFromPoint(x, y)
  return top !== null && el.contains(top)
}

/**
 * The page's headings, its main one first: one the singer can see before
 * one they cannot, then the highest level, and at a level the one in <main>.
 * Karaoke Night with a song on its stage shows no h1 (its page h1 is not
 * laid out), so there it is the song's title: the mixer's on a wide screen,
 * the phone stage's own on a phone, where the stage covers the rail's.
 */
function mainHeadings(): HTMLElement[] {
  const all = [...document.querySelectorAll<HTMLElement>(HEADINGS)].filter(
    (el) => el.closest(`[inert], [hidden], #${COACH_ROOT_ID}`) === null,
  )
  const rank = (el: HTMLElement): number =>
    (inSight(el) ? 0 : 100) +
    levelOf(el) * 2 +
    (el.closest('main') === null ? 1 : 0)
  return all
    .map((el, order) => ({ el, order, rank: rank(el) }))
    .sort((a, b) => a.rank - b.rank || a.order - b.order)
    .map(({ el }) => el)
}

/**
 * Focus back to `before` if the page still has it to take, else to its main
 * heading: the first that takes focus (one not laid out does not).
 */
function giveFocusBack(before: HTMLElement | null): void {
  if (
    before !== null &&
    before.isConnected &&
    before.closest('[inert]') === null
  ) {
    before.focus({ preventScroll: true })
    if (document.activeElement === before) return
  }
  for (const heading of mainHeadings()) {
    const added = !heading.hasAttribute('tabindex')
    if (added) heading.setAttribute('tabindex', '-1')
    heading.focus({ preventScroll: true })
    if (document.activeElement === heading) {
      if (added) {
        heading.addEventListener(
          'blur',
          () => heading.removeAttribute('tabindex'),
          { once: true },
        )
      }
      return
    }
    if (added) heading.removeAttribute('tabindex')
  }
}

/** Focus is the tour's to give back: in its layer, or fallen to the page itself. */
function tourHadFocus(root: HTMLElement): boolean {
  const el = document.activeElement
  return el === null || el === document.body || root.contains(el)
}

/** Fetches the coach and Merc's renderer ahead of a tour, without starting one. */
export function warmCoach(): void {
  void loadCoach().catch(() => undefined)
  void import('@/lib/merc/stage').catch(() => undefined)
}

/**
 * Ends the Merc tour on screen as an exit, where it stands, and drops one
 * still loading before it shows. For a page that moves on under a tour: a
 * tab change, or the legacy spotlight starting.
 */
export function endCoachTour(): void {
  if (running !== null) {
    running.end()
    return
  }
  if (coachActive() !== null) {
    generation += 1
    setCoachActive(null)
  }
}

const over = (result: CoachEnd, onEnd?: (r: CoachEnd) => void): CoachHandle => {
  onEnd?.(result)
  return { end: () => undefined, ended: Promise.resolve(result) }
}

/** How a chain of tours set the page for its steps, to put back at its end. */
type ScreenRecord = Map<TourSettingName, () => void>

export async function startCoachTour(
  tour: CoachTour,
  opts: CoachStartOptions = {},
): Promise<CoachHandle> {
  // A tour that replaces one on screen gives focus back where that one found it.
  return runTour(
    tour,
    opts,
    focusedNow() ?? (running !== null ? runningFocus : null),
    new Map(),
  )
}

/**
 * Starts `tour`, giving focus back to `before` when its layer goes, with
 * `settings` the chain's record of how its steps set the page.
 */
async function runTour(
  tour: CoachTour,
  opts: CoachStartOptions,
  before: HTMLElement | null,
  settings: ScreenRecord,
): Promise<CoachHandle> {
  running?.end()
  running = null
  const mine = ++generation
  setCoachActive(tour.key)

  let modules: Awaited<ReturnType<typeof loadCoach>>
  try {
    modules = await loadCoach()
  } catch (error) {
    if (mine === generation) setCoachActive(null)
    undoTourSettings(settings)
    throw error
  }
  // Another tour was asked for while this one loaded: it never shows.
  if (mine !== generation) {
    undoTourSettings(settings)
    return over('exit', opts.onEnd)
  }
  const [{ createCoachRunner }, { mountCoachLayer }] = modules

  const runner = createCoachRunner(tour, { phone: opts.phone })
  if (runner.ended() !== null) {
    setCoachActive(null)
    undoTourSettings(settings)
    return over(runner.ended() ?? 'done', opts.onEnd)
  }

  let settle!: (r: CoachEnd) => void
  const ended = new Promise<CoachEnd>((resolve) => {
    settle = resolve
  })
  const root = document.createElement('div')
  root.id = COACH_ROOT_ID
  document.body.append(root)

  let closed = false
  // "Show me more" was tapped: the tour it offers comes in this one's place,
  // its steps loading since the tap.
  let goingOn: { more: CoachMore; steps: Promise<CoachTour> } | null = null
  let unmount: () => void = () => undefined
  const close = (): void => {
    if (closed) return
    closed = true
    runner.dispose()
    if (running === handle) {
      running = null
      runningFocus = null
    }
    const next = goingOn
    if (mine === generation) setCoachActive(next?.more.key ?? null)
    // The layer asks for its own close from inside its effects; unmount
    // after they have run, then give focus back, or hand it on.
    queueMicrotask(() => {
      const ours = tourHadFocus(root)
      unmount()
      root.remove()
      if (next !== null && mine === generation) {
        goOn(next.steps, opts, ours ? before : null, settings)
      } else {
        undoTourSettings(settings)
        if (ours) giveFocusBack(before)
      }
    })
    // How the tour itself ended: done, even after a hand-over the singer
    // put off; an exit, if it never got that far.
    const result = runner.ended() ?? 'exit'
    opts.onEnd?.(result)
    settle(result)
  }

  const handle: CoachHandle = {
    end() {
      if (closed) return
      if (runner.ended() === null) runner.exit()
      close()
    },
    ended,
  }
  running = handle
  runningFocus = before
  const more = tour.more
  unmount = mountCoachLayer(root, {
    runner,
    phone: opts.phone === true,
    // Done gives the hand-over; "Show me more" hands on to its tour instead.
    handoff: () => (goingOn === null ? (opts.handoff?.() ?? null) : null),
    onClose: close,
    settings,
    ...(more === undefined
      ? {}
      : {
          more: {
            label: more.label,
            go: () => {
              if (closed || goingOn !== null) return
              goingOn = { more, steps: more.load() }
              runner.next()
            },
          },
        }),
  })
  return handle
}

/**
 * Starts the tour "Show me more" asked for once its `steps` have loaded,
 * unless another tour, or none (endCoachTour), was asked for meanwhile. One
 * that does not arrive lets go of coachActive and gives focus back.
 */
function goOn(
  steps: Promise<CoachTour>,
  opts: CoachStartOptions,
  before: HTMLElement | null,
  settings: ScreenRecord,
): void {
  const asked = generation
  const gaveUp = (): void => {
    giveFocusBack(before)
  }
  void steps.then(
    (next) => {
      if (asked !== generation) {
        undoTourSettings(settings)
        return
      }
      // runTour lets go of coachActive, and puts the page back, itself if
      // the coach does not load.
      void runTour(next, opts, before, settings).catch(gaveUp)
    },
    () => {
      undoTourSettings(settings)
      if (asked !== generation) return
      setCoachActive(null)
      gaveUp()
    },
  )
}
