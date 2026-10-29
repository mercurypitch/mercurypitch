// ============================================================
// CoachLayer — Merc's bubble, and the ring around what he points at
// ============================================================
//
// Drawn over the page, never instead of it: the layer lets every tap through
// except on the bubble, so a do-step's target stays live under its ring. The
// runner (runner.ts) says which step is on screen; this file only draws it.
//
// - Where the bubble stands. On a wide screen it stands beside the ring: below
//   the target, else above it, else at its side. On a phone it is a sheet
//   docked above the foot of the window (the tab bar, the cookie banner and
//   the confirm-email pill, as the toasts stand: lib/foot-space.ts), and it
//   moves to the top when that would cover the target; a stop over a stage
//   whose transport fills the foot of the window can ask to stand centred
//   instead (Karaoke Night's last). A target that is not there (not mounted
//   yet, or under a full-screen stage, which makes the page inert) gets no
//   ring, and the bubble stands centred, or in a corner for a do-step; a step
//   whose body names its target says its `unseen` line meanwhile, and rings
//   its `unseenTarget` if it names one (Karaoke's Add a song, once the
//   phone stage's Back has gone). A target out of the window is scrolled
//   into it once, smoothly unless the singer asks for less motion. One
//   taller than RING_MAX_SHARE of the window gets no ring and no
//   dim either, since it would ring the page, and on a wide screen the bubble
//   stands in a corner, never over the middle of it: the bottom right, or the
//   corner the step names (Sing's line, which keeps its labels and the
//   Monitor's status line clear at the top right). The layer keeps looking
//   every TRACK_MS while a step shows, so a target that mounts late, or moves,
//   is found and ringed.
// - Words that do not fit. The bubble is capped (CoachLayer.module.css), and
//   its words scroll in a box of their own above its buttons, which stay in
//   view with End tour however tall the words grow. While some are below the
//   box's foot the bubble says so (`data-more`, which fades it); each step
//   starts them at the top. From the bubble the keys that scroll a box scroll
//   them, and the box adds no Tab stop: a press on it focuses the bubble.
// - Its height. It sits over the app's stages, rails and sheets and under its
//   modals (z 900, below --z-modal's 1000). Not every dialog is a modal at
//   that height: Karaoke's score card is one over the phone stage (z 1000),
//   but on a wide screen it is an overlay inside the mixer (z 100), under
//   the coach. So no stop is drawn while it can be up: the wait through the
//   song is a quiet step, which draws nothing (no bubble, ring or dim), and
//   the stop after it shows once the card has closed. The toasts and the
//   cookie banner are above the coach.
// - Focus and keys. Focus moves to the bubble on each step, which a screen
//   reader reads by its title, and the title and body are a polite live
//   region besides. The bubble is not modal: the page stays live, and Tab
//   leaves it. On a ringed step Tab from its last control goes to the
//   target (its first control, if it is not one itself), and Shift+Tab from
//   there comes back; start.ts gives focus back to the page when the layer
//   goes. While focus is inside the bubble, though, no key reaches the app's
//   window shortcuts, where Space would start playback and Escape would close
//   the sidebar: Escape ends the tour, Enter and the right arrow go on from a
//   show or watch step, and the left arrow goes back. The listener is native
//   (`on:keydown`), because a host above (First Light, the plan layer) may
//   stop keys before Solid's delegated handlers on the document hear them
//   (src/tests/trap-key-handlers.test.ts).
// - A refused mic. A do-step that names a failure (Sing's mic: `mic-failed`)
//   adds its line under the body once that comes, inside the live region, so
//   it is read out; Skip and End tour stay where they were.
// - Sound only from a tap. A "hold-tone" step offers "Play the note" and
//   plays it on a context of its own, made on that tap, which the layer closes
//   when it goes. While it plays, the button, Merc and a line say so, and a
//   line after it says how to hear it (hold-tone.ts). The line stands under
//   the button, which never moves as it comes and goes (ToneStop.tsx).
// - A step that runs something (`run`: Merc singing through the room) starts
//   it as it shows and stops it as it goes, however it goes. While it runs,
//   Merc takes its pose, its line of what he does is read in the live region,
//   and the ring pulses (not under reduced motion). A step that keeps its
//   corner (`keepCorner`) stands there on a wide screen with its ring too.
// - "Show me more". A tour that offers another (`more`) shows it beside Done
//   on its last stop; start.ts starts that tour in this one's place.

import type { JSX } from 'solid-js'
import { createComponent, createEffect, createMemo, createSignal, on, onCleanup, onMount, Show, untrack, } from 'solid-js'
import { render } from 'solid-js/web'
import { X } from '@/components/icons'
import { MercPresence } from '@/components/room-kit/MercPresence'
import { prefersReducedMotion } from '@/components/room-kit/reduced-motion'
import type { CoachAside, CoachCorner, CoachHandoff, CoachStep, CoachStepRun, } from '@/lib/coach-types'
import type { MercState } from '@/lib/merc/constants'
import { stillFor } from '@/lib/merc/stills'
import type { TourSettingName } from '@/lib/tour-screen'
import { applyTourSettings } from '@/lib/tour-screen'
import styles from './CoachLayer.module.css'
import { findTarget } from './find-target'
import type { HoldTone } from './hold-tone'
import { createHoldTone } from './hold-tone'
import type { CoachRunner, CoachSnapshot } from './runner'
import { isQuiet } from './runner'
import { ToneStop } from './ToneStop'

/** A target taller than this share of the window gets no ring: it would ring the page. */
export const RING_MAX_SHARE = 0.7
/** How often a showing step looks for its target again, in ms. */
export const TRACK_MS = 300
const GAP = 12
const MARGIN = 16
const BUBBLE_MAX_W = 360
/** The words' box's padding at its foot, room for a focus ring (CoachLayer.module.css). */
const WORDS_PAD = 4
/** How far an arrow key scrolls the words, and a page key's share of their box: a browser's. */
const LINE_PX = 40
const PAGE_SHARE = 0.875
const FOCUSABLE =
  'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export interface CoachLayerProps {
  runner: CoachRunner
  phone: boolean
  /** What to offer once the tour is done; null offers nothing. */
  handoff?: () => CoachHandoff | null
  /** The layer is finished with: the host unmounts it. */
  onClose: () => void
  /** The tour's offer of another, beside Done on its last stop (start.ts). */
  more?: { label: string; go: () => void }
  /**
   * How the tour set the page for its steps (step.screen), kept by start.ts
   * so it is put back once the tour, and any it hands on to, has ended.
   */
  settings?: Map<TourSettingName, () => void>
}

interface Box {
  top: number
  left: number
  width: number
  height: number
}

type Place = 'near' | 'centre' | 'corner' | 'dock-bottom' | 'dock-top'

const sameBox = (a: Box | null, b: Box | null): boolean =>
  a === b ||
  (a !== null &&
    b !== null &&
    a.top === b.top &&
    a.left === b.left &&
    a.width === b.width &&
    a.height === b.height)

/** A step's target as found: the element, and its box or 'tall'. */
interface Sighting {
  el: HTMLElement
  box: Box | 'tall'
  /** The step's `unseenTarget`, standing in for a target not on screen. */
  standIn: boolean
}

/**
 * The target of `step`, else its stand-in, and the box to ring; 'tall' for
 * one taller than RING_MAX_SHARE of the window, which is not ringed; null for
 * none. Scrolls each one out of view into it, once (`scrolled`).
 */
function sight(step: CoachStep, scrolled: Set<HTMLElement>): Sighting | null {
  const own = step.target === undefined ? null : findTarget(step.target)
  const standIn =
    own === null && step.unseenTarget !== undefined
      ? findTarget(step.unseenTarget)
      : null
  const el = own ?? standIn
  if (el === null) return null
  let r = el.getBoundingClientRect()
  if (r.height > window.innerHeight * RING_MAX_SHARE) {
    return { el, box: 'tall', standIn: standIn !== null }
  }
  const outOfView = r.bottom < 0 || r.top > window.innerHeight
  if (
    outOfView &&
    !scrolled.has(el) &&
    typeof el.scrollIntoView === 'function'
  ) {
    scrolled.add(el)
    el.scrollIntoView({
      block: 'center',
      behavior: prefersReducedMotion() ? 'instant' : 'smooth',
    })
    r = el.getBoundingClientRect()
  }
  return {
    el,
    box: { top: r.top, left: r.left, width: r.width, height: r.height },
    standIn: standIn !== null,
  }
}

/** Where focus goes in a ringed target: itself if it is a control, else its first. */
function entryOf(el: HTMLElement): HTMLElement | null {
  return el.matches(FOCUSABLE) ? el : el.querySelector<HTMLElement>(FOCUSABLE)
}

/** The room the foot of the window holds (the toasts' floor), in px. */
function footFloor(): number {
  const style = document.documentElement.style
  const px = (name: string): number =>
    Number.parseFloat(style.getPropertyValue(name)) || 0
  return Math.max(
    px('--tabbar-space'),
    px('--consent-banner-space'),
    px('--verify-banner-space'),
  )
}

const clamp = (value: number, low: number, high: number): number =>
  Math.min(Math.max(value, low), Math.max(low, high))

/** How far each key that scrolls a box moves it, given its page. */
const SCROLL_KEYS: Partial<Record<string, (page: number) => number>> = {
  ArrowDown: () => LINE_PX,
  ArrowUp: () => -LINE_PX,
  PageDown: (page) => page,
  PageUp: (page) => -page,
  End: () => Infinity,
  Home: () => -Infinity,
}

/** Where the event's key scrolls `box` to, as a browser scrolls one; null for a key that scrolls nothing. */
function scrolledTop(event: KeyboardEvent, box: HTMLElement): number | null {
  const name =
    event.key === ' ' ? (event.shiftKey ? 'PageUp' : 'PageDown') : event.key
  const by = SCROLL_KEYS[name]
  if (by === undefined) return null
  const top = box.scrollTop + by(box.clientHeight * PAGE_SHARE)
  return clamp(top, 0, box.scrollHeight - box.clientHeight)
}

/** Where a wide screen's bubble of `size` stands beside `ring`: below, above, then a side. */
function besideRing(ring: Box, size: { w: number; h: number }): Box {
  const vw = window.innerWidth
  const vh = window.innerHeight
  const left = clamp(
    ring.left + ring.width / 2 - size.w / 2,
    MARGIN,
    vw - size.w - MARGIN,
  )
  const below = ring.top + ring.height + GAP
  if (below + size.h <= vh - MARGIN)
    return { top: below, left, width: size.w, height: size.h }
  const above = ring.top - GAP - size.h
  if (above >= MARGIN)
    return { top: above, left, width: size.w, height: size.h }
  const top = clamp(
    ring.top + ring.height / 2 - size.h / 2,
    MARGIN,
    vh - size.h - MARGIN,
  )
  const right = ring.left + ring.width + GAP
  const side =
    right + size.w <= vw - MARGIN
      ? right
      : Math.max(MARGIN, ring.left - GAP - size.w)
  return { top, left: side, width: size.w, height: size.h }
}

export function CoachLayer(props: CoachLayerProps): JSX.Element {
  const snapshot = (): CoachSnapshot | null => props.runner.snapshot()
  // The step itself, apart from the celebration flag: what to ring and focus.
  const step = createMemo(() => snapshot()?.step)
  // A quiet step draws nothing at all while the singer gets on with it.
  const quietStep = createMemo(() => isQuiet(step()))
  const [ring, setRing] = createSignal<Box | null>(null)
  // The step's target is there but too tall to ring: keep the bubble off it.
  const [tall, setTall] = createSignal(false)
  // What is ringed is the step's stand-in for a target not on screen.
  const [standIn, setStandIn] = createSignal(false)
  const [size, setSize] = createSignal({ w: BUBBLE_MAX_W, h: 0 })
  const [handoff, setHandoff] = createSignal<CoachHandoff | null>(null)
  // What the step on screen runs (Merc singing), while it runs.
  const [run, setRun] = createSignal<CoachStepRun | null>(null)
  // Some of the words are below the foot of their box.
  const [more, setMore] = createSignal(false)
  let bubble: HTMLDivElement | undefined
  // The step's words, in the box that scrolls them when they do not fit.
  let words: HTMLDivElement | undefined
  // The element under the ring, for Tab into it and Shift+Tab back.
  let ringed: HTMLElement | null = null
  const tone = createHoldTone()

  const pose = (): MercState => {
    const at = snapshot()
    if (at === null || at.celebrating) return 'celebrate'
    // he sings the note with the speaker, so a muted one still shows it
    if (tone.playing() !== null) return 'sing'
    const running = run()?.pose() ?? null
    if (running !== null) return running
    return at.waiting ? 'listen' : at.step.merc
  }

  // The foot of the words' box past its padding: is there more under it?
  const markMore = (): void => {
    const box = words
    setMore(
      box !== undefined &&
        box.scrollHeight - box.clientHeight - box.scrollTop > WORDS_PAD + 1,
    )
  }

  // The words' box takes no focus of its own: its tabindex keeps a browser
  // from making it a Tab stop, and a press on it focuses the bubble.
  const wordsRef = (el: HTMLDivElement): void => {
    words = el
    el.addEventListener('scroll', markMore, { passive: true })
    el.addEventListener('focus', () => bubble?.focus({ preventScroll: true }))
    // A line the step adds (the note's, Merc's) can take them past it at once.
    const grown = new MutationObserver(markMore)
    grown.observe(el, { childList: true, subtree: true, characterData: true })
    onCleanup(() => grown.disconnect())
  }

  const measureBubble = (): void => {
    if (bubble === undefined) return
    const next = {
      w: bubble.offsetWidth || BUBBLE_MAX_W,
      h: bubble.offsetHeight,
    }
    const last = untrack(size)
    if (next.w !== last.w || next.h !== last.h) setSize(next)
    markMore()
  }

  // A do-step with nothing to ring leaves the bubble up for as long as the
  // singer is busy, so it stands aside: in a corner of a wide screen, and at
  // the top of a phone, off the transport at its foot.
  const asideForWork = (): boolean => snapshot()?.step.kind === 'do'

  const place = (): Place => {
    const r = ring()
    if (props.phone) {
      if (step()?.phoneCentred === true && !standIn()) return 'centre'
      if (r === null) return asideForWork() ? 'dock-top' : 'dock-bottom'
      const sheetTop = window.innerHeight - footFloor() - GAP - size().h
      return r.top + r.height + GAP > sheetTop ? 'dock-top' : 'dock-bottom'
    }
    if (r !== null) return step()?.keepCorner === true ? 'corner' : 'near'
    // A target too tall to ring is still what the step is about, so the
    // bubble keeps off its middle, whatever the step's kind.
    return tall() || asideForWork() ? 'corner' : 'centre'
  }

  const corner = (): CoachCorner | undefined =>
    place() === 'corner' ? (step()?.corner ?? 'bottom-right') : undefined

  // A body that names its target ("Tap Back") holds only while the target is
  // on screen; until then, or once it has gone, the step says its unseen line,
  // its stand-in ringed or not.
  const body = (): string => {
    const shown = step()
    if (shown === undefined) return ''
    const seen = (ring() !== null || tall()) && !standIn()
    return !seen && shown.unseen !== undefined ? shown.unseen : shown.body
  }

  const bubbleStyle = (): JSX.CSSProperties => {
    const r = ring()
    if (place() !== 'near' || r === null) return {}
    const box = besideRing(r, size())
    return { top: `${box.top}px`, left: `${box.left}px` }
  }

  const focusBubble = (): void => {
    queueMicrotask(() => bubble?.focus({ preventScroll: true }))
  }

  // Each step: find its target now and every TRACK_MS while it shows, and on
  // every resize and scroll, so a late or moving target is ringed where it is.
  createEffect(
    on(step, (shown) => {
      tone.reset()
      if (shown === undefined || isQuiet(shown)) {
        ringed = null
        setRing(null)
        setTall(false)
        setStandIn(false)
        return
      }
      // A step's words start at its title, wherever the last one's were.
      if (words !== undefined) words.scrollTop = 0
      // The page set as the step needs it (Melody, not Notation); it draws
      // after this effect, so the target is looked for again once it has.
      const set =
        props.settings !== undefined &&
        applyTourSettings(shown.screen, props.settings)
      let live = true
      const scrolled = new Set<HTMLElement>()
      const track = (): void => {
        const found = sight(shown, scrolled)
        const next = found === null || found.box === 'tall' ? null : found.box
        ringed = next === null ? null : (found?.el ?? null)
        if (!sameBox(untrack(ring), next)) setRing(next)
        setTall(found?.box === 'tall')
        setStandIn(found?.standIn === true)
        measureBubble()
      }
      track()
      if (set) {
        queueMicrotask(() => {
          if (live) track()
        })
      }
      focusBubble()
      // What the step runs while it shows, stopped as it goes.
      const running = shown.run?.() ?? null
      setRun(running)
      const timer = setInterval(track, TRACK_MS)
      window.addEventListener('resize', track)
      window.addEventListener('scroll', track, { capture: true, passive: true })
      onCleanup(() => {
        live = false
        clearInterval(timer)
        window.removeEventListener('resize', track)
        window.removeEventListener('scroll', track, { capture: true })
        running?.stop()
        setRun(null)
      })
    }),
  )

  // The end: a done tour may hand over to what comes next; otherwise, or
  // after an exit, the layer is finished.
  createEffect(
    on(
      () => props.runner.ended(),
      (result) => {
        if (result === null) return
        tone.reset()
        const next =
          result === 'done' ? (untrack(() => props.handoff?.()) ?? null) : null
        if (next === null) {
          props.onClose()
          return
        }
        setHandoff(next)
        focusBubble()
        queueMicrotask(markMore)
      },
    ),
  )

  const end = (): void => {
    if (handoff() !== null) props.onClose()
    else props.runner.exit()
  }

  const go = (): void => {
    const next = handoff()
    props.onClose()
    next?.go()
  }

  const lastControl = (): HTMLElement | null => {
    const all = bubble?.querySelectorAll<HTMLElement>(FOCUSABLE)
    return all === undefined || all.length === 0 ? null : all[all.length - 1]
  }

  // Tab from the bubble's last control into the ringed target, in place of
  // the browser's move to whatever follows the layer on <body>.
  const tabIntoTarget = (event: KeyboardEvent): void => {
    if (event.shiftKey || ringed === null) return
    if (event.target !== lastControl()) return
    const entry = entryOf(ringed)
    entry?.focus({ preventScroll: true })
    if (entry !== null && document.activeElement === entry) {
      event.preventDefault()
    }
  }

  // Shift+Tab from the ringed target comes back to the bubble's last control.
  const tabBackToBubble = (event: KeyboardEvent): void => {
    if (event.key !== 'Tab' || !event.shiftKey || ringed === null) return
    const entry = entryOf(ringed)
    const last = lastControl()
    if (entry === null || event.target !== entry || last === null) return
    event.preventDefault()
    last.focus({ preventScroll: true })
  }
  document.addEventListener('keydown', tabBackToBubble, true)
  onCleanup(() =>
    document.removeEventListener('keydown', tabBackToBubble, true),
  )

  // From the bubble, a key that scrolls a box scrolls words that do not fit,
  // as it scrolled the bubble when words and buttons scrolled together.
  const scrollWords = (event: KeyboardEvent): boolean => {
    const box = words
    if (box === undefined || box.scrollHeight <= box.clientHeight) return false
    const top = scrolledTop(event, box)
    if (top === null) return false
    event.preventDefault()
    box.scrollTop = top
    return true
  }

  const onKey = (event: KeyboardEvent): void => {
    // Inside the bubble, no key reaches the app's shortcuts on the window.
    event.stopPropagation()
    if (event.key === 'Tab') {
      tabIntoTarget(event)
      return
    }
    if (event.key === 'Escape') {
      event.preventDefault()
      end()
      return
    }
    if (event.target === bubble && scrollWords(event)) return
    const at = snapshot()
    if (at === null) return
    // Enter on a button or the lesson link is theirs.
    const forward =
      event.key === 'ArrowRight' ||
      (event.key === 'Enter' && event.target === bubble)
    if (forward) {
      // A do-step still waiting ignores it (runner.ts): Skip is its way on.
      event.preventDefault()
      props.runner.next()
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault()
      props.runner.back()
    }
  }

  onMount(measureBubble)
  onCleanup(() => tone.close())

  return (
    <div class={styles.layer} data-testid="coach-layer">
      <Show when={!quietStep()}>
        <Show when={ring()}>
          {(box) => (
            <div
              class={styles.ring}
              classList={{ [styles.pulse]: run() !== null }}
              data-testid="coach-ring"
              data-running={run() === null ? undefined : ''}
              aria-hidden="true"
              style={{
                top: `${box().top}px`,
                left: `${box().left}px`,
                width: `${box().width}px`,
                height: `${box().height}px`,
              }}
            />
          )}
        </Show>
        <div
          ref={bubble}
          class={styles.bubble}
          classList={{ [styles.celebrating]: snapshot()?.celebrating === true }}
          data-testid="coach-bubble"
          data-place={place()}
          data-corner={corner()}
          data-pose={pose()}
          data-more={more() ? '' : undefined}
          style={bubbleStyle()}
          role="dialog"
          aria-labelledby="coach-title"
          aria-describedby="coach-body"
          tabindex="-1"
          on:keydown={onKey}
        >
          <button
            type="button"
            class={styles.close}
            aria-label="End tour"
            onClick={end}
          >
            <X />
          </button>
          <MercPresence
            state={pose}
            stillSrc={stillFor(pose())}
            size={props.phone ? 72 : 96}
            testId="coach-merc"
            class={styles.merc}
          />
          <Show
            when={handoff()}
            fallback={
              <Show when={snapshot()}>
                {(at) => (
                  <StepCard
                    words={wordsRef}
                    at={at}
                    body={body}
                    said={() => run()?.said() ?? ''}
                    runner={props.runner}
                    tone={tone}
                    more={props.more}
                  />
                )}
              </Show>
            }
          >
            {(next) => (
              <HandoffCard
                words={wordsRef}
                handoff={next()}
                onLater={() => props.onClose()}
                onGo={go}
              />
            )}
          </Show>
        </div>
      </Show>
    </div>
  )
}

/** What the forward button says: Skip on a step still waiting for the singer. */
export function forwardLabel(at: CoachSnapshot): string {
  if (at.waiting) return 'Skip this step'
  return at.last ? 'Done' : 'Next'
}

interface StepCardProps {
  /** Takes the words' box, which scrolls them when they do not fit. */
  words: (el: HTMLDivElement) => void
  at: () => CoachSnapshot
  /** The step's body, or its unseen line while its target is not on screen. */
  body: () => string
  /** A line of what Merc is doing, from the step's run; '' says nothing. */
  said: () => string
  runner: CoachRunner
  tone: HoldTone
  more?: { label: string; go: () => void }
}

/** A step's words, what it offers besides them, and its buttons. */
function StepCard(props: StepCardProps): JSX.Element {
  const step = (): CoachStep => props.at().step
  // A do-step moves on by itself once the singer has done it; until then the
  // button is how to move on without it.
  const forward = (): void => {
    if (props.at().waiting) props.runner.skip()
    else props.runner.next()
  }
  // What went wrong while the step waits (a refused mic), and how to fix it.
  const failure = (): CoachAside | null => {
    const at = props.at()
    if (!at.failed || at.step.kind !== 'do') return null
    return at.step.failure?.aside ?? null
  }
  // Another tour, offered beside Done on the last stop.
  const moreOffer = (): { label: string; go: () => void } | null => {
    const at = props.at()
    return at.last && !at.waiting ? (props.more ?? null) : null
  }
  return (
    <>
      <div ref={props.words} class={styles.content} tabindex="-1">
        <div aria-live="polite">
          <h2 id="coach-title" class={styles.title}>
            {step().title}
          </h2>
          <p id="coach-body" class={styles.body}>
            {props.body()}
          </p>
          <Show when={failure()}>
            {(line) => (
              <p class={styles.aside} data-testid="coach-failure">
                <strong>{line().title}</strong> {line().sub}
              </p>
            )}
          </Show>
          <Show when={props.said()}>
            {(line) => (
              <p class={styles.aside} data-testid="coach-said">
                {line()}
              </p>
            )}
          </Show>
        </div>
        <Show when={step().aside?.()}>
          {(aside) => (
            <p class={styles.aside} data-testid="coach-aside">
              <strong>{aside().title}</strong> {aside().sub}
            </p>
          )}
        </Show>
        <Show when={step().sound === 'hold-tone'}>
          <ToneStop tone={props.tone} />
        </Show>
        <Show when={step().lesson}>
          {(lesson) => (
            <a
              class={styles.lesson}
              href={lesson().href}
              target="_blank"
              rel="noopener"
            >
              {lesson().title}
            </a>
          )}
        </Show>
      </div>
      <div class={styles.foot}>
        <span class={styles.count}>
          {props.at().place} of {props.at().total}
        </span>
        <Show when={props.at().index > 0}>
          <button
            type="button"
            class={styles.back}
            onClick={() => props.runner.back()}
          >
            Back
          </button>
        </Show>
        <Show when={moreOffer()}>
          {(more) => (
            <button
              type="button"
              class={styles.back}
              onClick={() => more().go()}
            >
              {more().label}
            </button>
          )}
        </Show>
        <button type="button" class={styles.next} onClick={forward}>
          {forwardLabel(props.at())}
        </button>
      </div>
    </>
  )
}

interface HandoffCardProps {
  /** Takes the words' box, as StepCard's does. */
  words: (el: HTMLDivElement) => void
  handoff: CoachHandoff
  onLater: () => void
  onGo: () => void
}

/** After a finished tour: the next thing to try, and Later. */
function HandoffCard(props: HandoffCardProps): JSX.Element {
  return (
    <>
      <div
        ref={props.words}
        class={styles.content}
        tabindex="-1"
        aria-live="polite"
      >
        <h2 id="coach-title" class={styles.title}>
          {props.handoff.title}
        </h2>
        <p id="coach-body" class={styles.body}>
          {props.handoff.body}
        </p>
      </div>
      <div class={styles.foot}>
        <button
          type="button"
          class={styles.back}
          onClick={() => props.onLater()}
        >
          Later
        </button>
        <button type="button" class={styles.next} onClick={() => props.onGo()}>
          Go
        </button>
      </div>
    </>
  )
}

/** Draws the layer into `root`; returns the unmount. */
export function mountCoachLayer(
  root: HTMLElement,
  props: CoachLayerProps,
): () => void {
  return render(() => createComponent(CoachLayer, props), root)
}
