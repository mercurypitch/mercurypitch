// ============================================================
// Lesson tour — the welcome tour: a spotlight, a card, five steps through the page
// ============================================================
//
// A chunk of its own, loaded when the tour starts (tour-gate.ts): nothing
// here is first-paint work. Its stylesheet travels inside it as a string and
// goes into the page as the tour first opens: a stylesheet file of its own
// would give every lesson page a list of two files to fetch with the tour,
// on its first paint, where it has none. From the kit it reads only its copy.
//
// It imports nothing from the gate either, though the gate holds the
// record's name and the top rule: importing anything the page has already
// loaded makes the chunk import the page's shared chunk, with that chunk's
// own imports, and the page then lists four files to fetch with the tour
// where it lists none. That costs every lesson page 89 bytes of first
// paint, where a copy here costs it nothing. So the record's name and
// version and the top rule are written here again, and tour.test.ts holds
// them to the gate's.
//
// The page dims around a rounded cutout over the step's target: one element
// whose huge box-shadow is the dim, placed from the target's box and moved
// whenever the page scrolls or resizes. A transparent sheet under the card
// takes every press on the page, the cutout included, and the rest of the
// page is inert while the tour is up, so only the card answers. The card
// is a dialog: focus moves into it, Tab stays in it, Escape closes it as
// Skip does, and focus goes back to where it was, the page to where it was
// scrolled. Each step's words are in a polite live region, so a screen
// reader says each new step.
//
// On a wide screen the card sits beside its target where there is room,
// and at the foot of the screen where there is none; on a phone it is
// docked at the foot, and the target is scrolled into the room above it.
// The page glides to each target, and the spotlight and the card with it;
// under reduced motion, or with the page's animations paused, the page
// moves at once. A glide passes every step on its
// way, so while the tour is up, and until the page has come to rest after
// it, <html> carries a class (`PAUSE`) that the kit reads before it counts
// anything as read (dom.ts `touring`): the step deck holds its step, and no
// step is remembered (position.ts). A class on the page is the one signal
// both sides can read without the chunk importing the kit.
//
// Merc and Tavi keep moving under step 1's spotlight: the dim is drawn over
// the page, which goes on rendering, and the tour never waits on their
// renderer. On a first visit the tour waits while another layer is open (a
// dialog such as the lesson menu, a film playing or full screen); a
// lesson page has no consent banner of its own, and the microphone is
// asked for only from a press on Sing it, which a page still at the top
// has not had. If the page has left the top by the time the layers close,
// the tour waits for another page.

import sheet from './lesson-tour.css?inline'
import type { TourStepCopy } from './tour-copy'
import { LISTENING_LESSONS, TOUR_STEPS, TOUR_WORDS } from './tour-copy'

/** A step as this page shows it: its words, and the targets that show here. */
export interface PageStep {
  readonly title: string
  readonly body: string
  readonly targets: readonly HTMLElement[]
}

export interface Box {
  readonly x: number
  readonly y: number
  readonly w: number
  readonly h: number
}

/** Where the card sits: beside its target, or docked at the foot of the screen. */
export type Side = 'right' | 'left' | 'below' | 'dock'

/** The space the target and card share: the viewport under the masthead. */
export interface Room {
  readonly w: number
  readonly h: number
  /** The masthead's foot: nothing is placed above it. */
  readonly top: number
}

const GAP = 14
const EDGE = 12
const PAD = 8
/** Under this width the card docks at the foot (lesson-tour.css says the same). */
const NARROW = '(max-width: 639px)'

/** Whether `el` is drawn: not hidden, not display: none, not visibility: hidden. */
export function shown(el: Element): boolean {
  return (
    el.closest('[hidden]') === null &&
    el.getClientRects().length > 0 &&
    window.getComputedStyle(el).visibility !== 'hidden'
  )
}

/** Each of a step's targets that shows on this page. */
export function targetsOf(
  step: TourStepCopy,
  root: ParentNode = document,
): HTMLElement[] {
  return step.targets
    .map((s) => root.querySelector<HTMLElement>(s))
    .filter((el): el is HTMLElement => el !== null && shown(el))
}

/** The tour as this page shows it: a step with no target showing is left out. */
export function pageSteps(
  lesson: number,
  root: ParentNode = document,
  steps: readonly TourStepCopy[] = TOUR_STEPS,
): PageStep[] {
  return steps.flatMap((step) => {
    const targets = targetsOf(step, root)
    if (targets.length === 0) return []
    const extra =
      step.listening !== undefined && LISTENING_LESSONS.includes(lesson)
        ? ` ${step.listening}`
        : ''
    return [{ title: step.title, body: step.body + extra, targets }]
  })
}

/** Whether another layer is up: an open dialog, a film playing, or anything full screen. */
export function layerOpen(doc: Document = document): boolean {
  return (
    doc.querySelector('dialog[open]') !== null ||
    doc.fullscreenElement != null ||
    Array.from(doc.querySelectorAll('video')).some((v) => !v.paused && !v.ended)
  )
}

/** The box around every one of `els`. */
export function boxOf(els: readonly Element[]): Box {
  const rs = els.map((el) => el.getBoundingClientRect())
  const x = Math.min(...rs.map((r) => r.left))
  const y = Math.min(...rs.map((r) => r.top))
  const w = Math.max(...rs.map((r) => r.right)) - x
  const h = Math.max(...rs.map((r) => r.bottom)) - y
  return { x, y, w, h }
}

/**
 * How far to scroll so the target shows in the space from `top` to
 * `bottom`: none if it shows whole already, else centred there, or its top
 * at the top of that space when it is taller than the space.
 */
export function scrollFor(box: Box, top: number, bottom: number): number {
  if (box.y >= top && box.y + box.h <= bottom) return 0
  const room = bottom - top
  const want = box.h > room ? top : top + (room - box.h) / 2
  return box.y - want
}

/**
 * The card's side on a wide screen: beside the target where it fits
 * (right, then left), else under it where the target and the card fit the
 * height together, else docked at the foot.
 */
export function sideFor(
  box: Box,
  card: { w: number; h: number },
  room: Room,
): Side {
  if (box.x + box.w + GAP + card.w <= room.w - EDGE) return 'right'
  if (box.x - GAP - card.w >= EDGE) return 'left'
  const tall = room.h - room.top - 2 * EDGE
  if (box.h + GAP + card.h <= tall) return 'below'
  return 'dock'
}

/**
 * How much of the screen's foot the card takes, which a target scrolled
 * into view must clear: the docked card on a phone with its margin, the
 * card and its gap under the target, or the docked card on a wide screen.
 */
export function footOf(side: Side, narrow: boolean, cardH: number): number {
  if (narrow) return cardH + EDGE
  if (side === 'below') return cardH + GAP
  return side === 'dock' ? cardH : 0
}

/** Where the card goes on its side of the target, kept on the screen. */
export function cardAt(
  side: Side,
  box: Box,
  card: { w: number; h: number },
  room: Room,
): { x: number; y: number } {
  const keepX = (x: number): number =>
    Math.max(EDGE, Math.min(x, room.w - card.w - EDGE))
  const keepY = (y: number): number =>
    Math.max(room.top + EDGE, Math.min(y, room.h - card.h - EDGE))
  const midY = box.y + box.h / 2 - card.h / 2
  switch (side) {
    case 'right':
      return { x: box.x + box.w + GAP, y: keepY(midY) }
    case 'left':
      return { x: box.x - GAP - card.w, y: keepY(midY) }
    case 'below':
      return {
        x: keepX(box.x + box.w / 2 - card.w / 2),
        y: keepY(box.y + box.h + GAP),
      }
    case 'dock':
      return { x: room.w - card.w - EDGE, y: room.h - card.h - EDGE }
  }
}

/** The buttons, links and fields in `root` that take Tab, in order. */
function tabStops(root: HTMLElement): HTMLElement[] {
  return Array.from(
    root.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], [tabindex="0"]',
    ),
  )
}

/**
 * Tab and Shift+Tab inside `root`: from the last stop to the first and back,
 * and into it from anywhere else. Returns whether it moved the focus.
 */
export function wrapTab(root: HTMLElement, e: KeyboardEvent): boolean {
  const stops = tabStops(root)
  if (stops.length === 0) return false
  const first = stops[0]
  const last = stops[stops.length - 1]
  const at = document.activeElement
  const inside = at instanceof Node && root.contains(at)
  if (!inside || (e.shiftKey ? at === first : at === last)) {
    ;(e.shiftKey ? last : first).focus()
    return true
  }
  return false
}

const wait = (ms: number): Promise<void> =>
  new Promise((resolve) => window.setTimeout(resolve, ms))

/** Under reduced motion the page moves at once, as lesson-tour.css stops the glides. */
const REDUCED = '(prefers-reduced-motion: reduce)'

/**
 * How the tour moves the page: smoothly, and at once under reduced motion
 * or with the page's animations paused. The motion switch keeps its own
 * choice (`fyp-motion`) and marks <html> `motion-paused` for it and for
 * reduced motion alike (motion-switch.ts); the class is read here rather
 * than the module imported (see the head of this file).
 */
const glide = (): ScrollBehavior =>
  window.matchMedia(REDUCED).matches ||
  document.documentElement.classList.contains('motion-paused')
    ? 'instant'
    : 'smooth'

/**
 * The class on <html> that pauses the kit's record of reading (dom.ts
 * `touring` reads it), written here rather than imported (see the head of
 * this file). On a wide screen the step deck follows the scroll and the kit
 * keeps the furthest step a viewer reaches (position.ts): unpaused, a glide
 * from the deck to Sing it passed every step, and the page remembered the
 * lesson read to its last step, "Continue: step 6", for a visitor who had
 * read none.
 */
const PAUSE = 'touring'

/** Stops a pause's lifting that is waiting for the page to come to rest. */
let resting = (): void => undefined

/**
 * Lifts the pause once the page has come to rest after the tour: the scroll
 * back to where the page was (`to`, or null for none) glides too, and
 * passes steps on its way. At rest is five frames in a row at one scroll,
 * at `to`; half a second still anywhere else, where a viewer's own scroll
 * stopped it; and 3 s at the most, since a hidden page draws no frames.
 */
function liftPauseAtRest(to: number | null): void {
  resting()
  let y = Number.NaN
  let still = 0
  let frame = 0
  const lift = (): void => {
    resting()
    document.documentElement.classList.remove(PAUSE)
  }
  const cap = window.setTimeout(lift, 3000)
  const tick = (): void => {
    still = window.scrollY === y ? still + 1 : 0
    y = window.scrollY
    const there = to === null || Math.abs(y - to) < 2
    if (still >= (there ? 5 : 30)) lift()
    else frame = window.requestAnimationFrame(tick)
  }
  frame = window.requestAnimationFrame(tick)
  resting = () => {
    window.cancelAnimationFrame(frame)
    window.clearTimeout(cap)
    resting = () => undefined
  }
}

/** The tour now up, so a second start does nothing. */
let running: { close: () => void } | null = null

/** Closes the tour if it is up (tests, and a page leaving). */
export function closeTour(): void {
  running?.close()
}

/**
 * The record the gate reads, and the gate's top rule (tour-gate.ts), kept
 * here rather than imported (see the head of this file).
 */
export const RECORD = { key: 'fyp-tour', version: '1' } as const
export const atTop = (): boolean =>
  window.location.hash.length < 2 && window.scrollY < 40

/** Writes the record that the tour was closed, so it is not offered again. */
function record(): void {
  try {
    window.localStorage.setItem(RECORD.key, RECORD.version)
  } catch {
    // the tour may come back once: better than a page that stops
  }
}

/**
 * Whether this browser has closed this version of the tour: on Lessons 1
 * and 2 a replay can open and close it while a first visit's waits for the
 * opening (opening-hold.ts).
 */
function seen(): boolean {
  try {
    return window.localStorage.getItem(RECORD.key) === RECORD.version
  } catch {
    return false
  }
}

/** The tour's stylesheet, put into the page once. */
function style(): void {
  if (document.getElementById('tourSheet') !== null) return
  const el = document.createElement('style')
  el.id = 'tourSheet'
  el.textContent = sheet
  document.head.appendChild(el)
}

/**
 * Runs the tour from step 1 on lesson `lesson`'s page. A first visit's tour
 * waits for any open layer to close and starts only if the page is still at
 * the top and the tour not closed meanwhile; a replay (`replay`, the lesson
 * menu's or the question mark's) starts at once.
 */
export async function runTour(lesson: number, replay: boolean): Promise<void> {
  if (running !== null) return
  if (!replay) {
    while (layerOpen()) await wait(400)
    if (!atTop() || running !== null || seen()) return
  }
  const steps = pageSteps(lesson)
  if (steps.length === 0) return
  style()
  running = open(steps)
}

/** Opens the tour on `steps`; null when it could not, the page given back as it was. */
function open(steps: readonly PageStep[]): { close: () => void } | null {
  const back = document.activeElement
  const startY = window.scrollY
  const narrow = window.matchMedia(NARROW)

  const root = document.createElement('div')
  root.className = 'tour'
  root.innerHTML = `<div class="tour-sheet"></div><div class="tour-spot" aria-hidden="true"></div><div class="tour-card" role="dialog" aria-modal="true" aria-labelledby="tourTitle" aria-describedby="tourBody"><button class="btn icon tour-x" type="button" aria-label="${TOUR_WORDS.close}"><svg class="ico" aria-hidden="true"><use href="#i-x"/></svg></button><div class="tour-words" aria-live="polite"><p class="tour-count"></p><h2 class="tour-title" id="tourTitle"></h2><p class="tour-body" id="tourBody"></p></div><div class="tour-nav"><button class="btn sm tour-skip" type="button">${TOUR_WORDS.skip}</button><button class="btn sm" type="button" data-tour-back>${TOUR_WORDS.back}</button><button class="btn sm primary" type="button" data-tour-next></button></div></div>`
  const pick = <T extends HTMLElement>(s: string): T =>
    root.querySelector<T>(s) as T
  const spot = pick('.tour-spot')
  const card = pick('.tour-card')
  const count = pick('.tour-count')
  const title = pick('.tour-title')
  const body = pick('.tour-body')
  const backBtn = pick<HTMLButtonElement>('[data-tour-back]')
  const nextBtn = pick<HTMLButtonElement>('[data-tour-next]')

  // everything else on the page stays drawn, and out of reach
  const quiet = Array.from(document.body.children).filter(
    (el) => !el.hasAttribute('inert'),
  )
  quiet.forEach((el) => el.setAttribute('inert', ''))
  document.body.appendChild(root)
  // nothing the page does while the tour is up counts as reading (`PAUSE`)
  resting()
  document.documentElement.classList.add(PAUSE)

  let at = 0
  let side: Side = 'dock'
  let frame = 0
  let settling = 0
  let moving = 0
  // the page can move under a still target as it settles: fonts, a toy sizing itself
  const watcher =
    typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(() => later())

  const room = (): Room => ({
    w: document.documentElement.clientWidth,
    h: window.innerHeight,
    top: Math.max(
      0,
      document.getElementById('mast')?.getBoundingClientRect().bottom ?? 0,
    ),
  })

  /** The spotlight and the card, from where the target is now; returns the cutout's corners. */
  function place(): string {
    frame = 0
    const targets = steps[at].targets.filter(
      (el) => el.isConnected && shown(el),
    )
    const r = room()
    if (targets.length === 0) {
      spot.hidden = true
      card.classList.add('is-dock')
      return ''
    }
    spot.hidden = false
    const b = boxOf(targets)
    // the cutout, kept to the screen: a tall target is lit as far as it shows
    const x0 = Math.max(b.x - PAD, -PAD)
    const y0 = Math.max(b.y - PAD, -PAD)
    const x1 = Math.min(b.x + b.w + PAD, r.w + PAD)
    const y1 = Math.min(b.y + b.h + PAD, r.h + PAD)
    spot.style.transform = `translate(${x0}px, ${y0}px)`
    spot.style.width = `${Math.max(0, x1 - x0)}px`
    spot.style.height = `${Math.max(0, y1 - y0)}px`
    card.classList.toggle('is-dock', side === 'dock')
    if (side === 'dock') {
      card.style.removeProperty('left')
      card.style.removeProperty('top')
    } else {
      const c = cardAt(
        side,
        b,
        { w: card.offsetWidth, h: card.offsetHeight },
        r,
      )
      card.style.left = `${Math.round(c.x)}px`
      card.style.top = `${Math.round(c.y)}px`
    }
    return `${x0} ${y0} ${x1} ${y1}`
  }

  const later = (): void => {
    if (frame === 0) frame = window.requestAnimationFrame(place)
  }

  /** Whether one of the page's own animations is moving the step's target, as a reveal does. */
  const stirring = (): boolean =>
    'getAnimations' in document &&
    document.getAnimations().some((a) => {
      const el = a.effect instanceof KeyframeEffect ? a.effect.target : null
      return (
        a.playState === 'running' &&
        el !== null &&
        steps[at].targets.some((t) => el.contains(t))
      )
    })

  /**
   * Places the spotlight every frame until the target holds still: a
   * section's reveal plays as it scrolls in and moves its box, and nothing
   * tells the page when a transform has ended. It stops once the target has
   * kept its place for 12 frames with no animation on it, or after 5 s.
   */
  function settle(): void {
    window.cancelAnimationFrame(settling)
    const until = window.performance.now() + 5000
    let was = ''
    let still = 0
    const tick = (): void => {
      const now = place()
      still = now === was && !stirring() ? still + 1 : 0
      was = now
      settling =
        still < 12 && window.performance.now() < until
          ? window.requestAnimationFrame(tick)
          : 0
    }
    settling = window.requestAnimationFrame(tick)
  }

  /**
   * Picks the card's side for the step showing and lights its target;
   * `scroll` also brings the target into view (a step change, not a resize).
   */
  function layout(scroll: boolean): void {
    const targets = steps[at].targets.filter(
      (el) => el.isConnected && shown(el),
    )
    const r = room()
    const size = { w: card.offsetWidth, h: card.offsetHeight }
    let delta = 0
    if (targets.length > 0) {
      const b = boxOf(targets)
      // the masthead stays put as the page scrolls: a step there needs none
      const pinned = targets.every((el) => el.closest('#mast') !== null)
      side = narrow.matches ? 'dock' : sideFor(b, size, r)
      const foot = footOf(side, narrow.matches, size.h)
      if (scroll && !pinned)
        delta = scrollFor(b, r.top + EDGE, r.h - EDGE - foot)
    } else side = 'dock'
    root.dataset.side = side
    if (delta !== 0)
      window.scrollTo({ top: window.scrollY + delta, behavior: glide() })
    place()
  }

  /** Shows step `n`: its words, then its target brought into view and lit. */
  function show(n: number): void {
    at = Math.max(0, Math.min(n, steps.length - 1))
    const step = steps[at]
    count.textContent = TOUR_WORDS.count(at + 1, steps.length)
    title.textContent = step.title
    body.textContent = step.body
    nextBtn.textContent =
      at === steps.length - 1 ? TOUR_WORDS.done : TOUR_WORDS.next
    const wasBack = document.activeElement === backBtn
    backBtn.disabled = at === 0
    if (wasBack && backBtn.disabled) nextBtn.focus()
    root.classList.add('is-moving')
    window.clearTimeout(moving)
    moving = window.setTimeout(() => root.classList.remove('is-moving'), 450)
    layout(true)
    settle()
  }

  /**
   * Takes the tour down and gives the page back: nothing inert, the focus
   * and the scroll back where they were, and reading counted again once the
   * page has come to rest.
   */
  function teardown(): void {
    window.removeEventListener('keydown', onKey, true)
    window.removeEventListener('keyup', hush, true)
    window.removeEventListener('scroll', later)
    window.removeEventListener('resize', onResize)
    watcher?.disconnect()
    window.cancelAnimationFrame(frame)
    window.cancelAnimationFrame(settling)
    root.remove()
    quiet.forEach((el) => el.removeAttribute('inert'))
    running = null
    window.clearTimeout(moving)
    if (back instanceof HTMLElement && back !== document.body)
      back.focus({ preventScroll: true })
    const to = window.scrollY === startY ? null : startY
    if (to !== null) window.scrollTo({ top: to, behavior: glide() })
    liftPauseAtRest(to)
  }

  function close(): void {
    teardown()
    record()
  }

  function next(): void {
    if (at === steps.length - 1) close()
    else show(at + 1)
  }

  // the page beneath hears no key while the tour is up
  const hush = (e: Event): void => e.stopPropagation()

  function onKey(e: KeyboardEvent): void {
    hush(e)
    if (e.key === 'Escape') {
      e.preventDefault()
      close()
    } else if (e.key === 'Tab') {
      if (wrapTab(card, e)) e.preventDefault()
    } else if (e.key === 'Enter') {
      // a button in the card takes its own Enter: Back goes back, Skip skips
      if (e.target instanceof HTMLButtonElement && card.contains(e.target))
        return
      e.preventDefault()
      next()
    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      next()
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      show(at - 1)
    }
  }

  const onResize = (): void => layout(false)

  try {
    backBtn.addEventListener('click', () => show(at - 1))
    nextBtn.addEventListener('click', next)
    pick('.tour-skip').addEventListener('click', close)
    pick('.tour-x').addEventListener('click', close)
    window.addEventListener('keydown', onKey, true)
    window.addEventListener('keyup', hush, true)
    window.addEventListener('scroll', later, { passive: true })
    window.addEventListener('resize', onResize)
    watcher?.observe(document.body)

    show(0)
    nextBtn.focus({ preventScroll: true })
  } catch {
    // a tour that cannot open gives the page back, reading counted again,
    // and writes no record, so another page offers it
    teardown()
    return null
  }
  return { close }
}
