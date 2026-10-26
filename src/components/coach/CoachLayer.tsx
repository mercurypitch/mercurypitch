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
//   moves to the top when that would cover the target. A target that is not
//   there (not mounted yet, or under a full-screen stage, which makes the page
//   inert) or that is taller than RING_MAX_SHARE of the window gets no ring,
//   and the bubble stands centred. The layer keeps looking every TRACK_MS while
//   a step shows, so a target that mounts late, or moves, is found and ringed.
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
//   leaves it. While focus is inside it, though, no key reaches the app's
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
//   when it goes.

import type { JSX } from 'solid-js'
import { createComponent, createEffect, createMemo, createSignal, on, onCleanup, onMount, Show, untrack, } from 'solid-js'
import { render } from 'solid-js/web'
import { X } from '@/components/icons'
import { MercPresence } from '@/components/room-kit/MercPresence'
import type { CoachAside, CoachHandoff, CoachStep } from '@/lib/coach-types'
import type { DemoSound } from '@/lib/demo-audio'
import { playHoldTone } from '@/lib/demo-audio'
import type { MercState } from '@/lib/merc/constants'
import { stillFor } from '@/lib/merc/stills'
import styles from './CoachLayer.module.css'
import { findTarget } from './find-target'
import type { CoachRunner, CoachSnapshot } from './runner'
import { isQuiet } from './runner'

/** A target taller than this share of the window gets no ring: it would ring the page. */
export const RING_MAX_SHARE = 0.7
/** How often a showing step looks for its target again, in ms. */
export const TRACK_MS = 300
/** The note a "hold-tone" step plays: A3, in reach of most voices or an octave of them. */
export const HOLD_TONE_HZ = 220

const GAP = 12
const MARGIN = 16
const BUBBLE_MAX_W = 360

export interface CoachLayerProps {
  runner: CoachRunner
  phone: boolean
  /** What to offer once the tour is done; null offers nothing. */
  handoff?: () => CoachHandoff | null
  /** The layer is finished with: the host unmounts it. */
  onClose: () => void
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

/** The box to ring for `step`, or null for none. Scrolls a target out of view into it, once. */
function ringFor(step: CoachStep, scrolled: { done: boolean }): Box | null {
  if (step.target === undefined) return null
  const el = findTarget(step.target)
  if (el === null) return null
  let r = el.getBoundingClientRect()
  if (r.height > window.innerHeight * RING_MAX_SHARE) return null
  const outOfView = r.bottom < 0 || r.top > window.innerHeight
  if (outOfView && !scrolled.done && typeof el.scrollIntoView === 'function') {
    scrolled.done = true
    el.scrollIntoView({ block: 'center' })
    r = el.getBoundingClientRect()
  }
  return { top: r.top, left: r.left, width: r.width, height: r.height }
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
  const [size, setSize] = createSignal({ w: BUBBLE_MAX_W, h: 0 })
  const [handoff, setHandoff] = createSignal<CoachHandoff | null>(null)
  let bubble: HTMLDivElement | undefined
  let audio: AudioContext | null = null
  let tone: DemoSound | null = null

  const stopTone = (): void => {
    tone?.stop()
    tone = null
  }

  const pose = (): MercState => {
    const at = snapshot()
    if (at === null || at.celebrating) return 'celebrate'
    return at.waiting ? 'listen' : at.step.merc
  }

  const measureBubble = (): void => {
    if (bubble === undefined) return
    const next = {
      w: bubble.offsetWidth || BUBBLE_MAX_W,
      h: bubble.offsetHeight,
    }
    const last = untrack(size)
    if (next.w !== last.w || next.h !== last.h) setSize(next)
  }

  // A do-step with nothing to ring ("sing to the end") leaves the bubble up
  // for as long as the singer is busy, so it stands aside: in a corner of a
  // wide screen, and at the top of a phone, off the transport at its foot.
  const asideForWork = (): boolean => snapshot()?.step.kind === 'do'

  const place = (): Place => {
    const r = ring()
    if (props.phone) {
      if (r === null) return asideForWork() ? 'dock-top' : 'dock-bottom'
      const sheetTop = window.innerHeight - footFloor() - GAP - size().h
      return r.top + r.height + GAP > sheetTop ? 'dock-top' : 'dock-bottom'
    }
    if (r !== null) return 'near'
    return asideForWork() ? 'corner' : 'centre'
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
      stopTone()
      if (shown === undefined) {
        setRing(null)
        return
      }
      if (isQuiet(shown)) {
        setRing(null)
        return
      }
      const scrolled = { done: false }
      const track = (): void => {
        const next = ringFor(shown, scrolled)
        if (!sameBox(untrack(ring), next)) setRing(next)
        measureBubble()
      }
      track()
      focusBubble()
      const timer = setInterval(track, TRACK_MS)
      window.addEventListener('resize', track)
      window.addEventListener('scroll', track, { capture: true, passive: true })
      onCleanup(() => {
        clearInterval(timer)
        window.removeEventListener('resize', track)
        window.removeEventListener('scroll', track, { capture: true })
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
        stopTone()
        const next =
          result === 'done' ? (untrack(() => props.handoff?.()) ?? null) : null
        if (next === null) {
          props.onClose()
          return
        }
        setHandoff(next)
        focusBubble()
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

  const playNote = (): void => {
    stopTone()
    try {
      audio ??= new AudioContext()
      void audio.resume().catch(() => undefined)
      tone = playHoldTone(audio, HOLD_TONE_HZ)
    } catch {
      // No audio here. The step still waits for the singer, and Skip is there.
    }
  }

  const onKey = (event: KeyboardEvent): void => {
    // Inside the bubble, no key reaches the app's shortcuts on the window.
    event.stopPropagation()
    if (event.key === 'Escape') {
      event.preventDefault()
      end()
      return
    }
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
  onCleanup(() => {
    stopTone()
    void audio?.close().catch(() => undefined)
    audio = null
  })

  return (
    <div class={styles.layer} data-testid="coach-layer">
      <Show when={!quietStep()}>
        <Show when={ring()}>
          {(box) => (
            <div
              class={styles.ring}
              data-testid="coach-ring"
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
                  <StepCard at={at} runner={props.runner} onPlay={playNote} />
                )}
              </Show>
            }
          >
            {(next) => (
              <HandoffCard
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
  at: () => CoachSnapshot
  runner: CoachRunner
  onPlay: () => void
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
  return (
    <>
      <div class={styles.content}>
        <div aria-live="polite">
          <h2 id="coach-title" class={styles.title}>
            {step().title}
          </h2>
          <p id="coach-body" class={styles.body}>
            {step().body}
          </p>
          <Show when={failure()}>
            {(line) => (
              <p class={styles.aside} data-testid="coach-failure">
                <strong>{line().title}</strong> {line().sub}
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
          <button
            type="button"
            class={styles.play}
            onClick={() => props.onPlay()}
          >
            Play the note
          </button>
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
        <button type="button" class={styles.next} onClick={forward}>
          {forwardLabel(props.at())}
        </button>
      </div>
    </>
  )
}

interface HandoffCardProps {
  handoff: CoachHandoff
  onLater: () => void
  onGo: () => void
}

/** After a finished tour: the next thing to try, and Later. */
function HandoffCard(props: HandoffCardProps): JSX.Element {
  return (
    <>
      <div class={styles.content} aria-live="polite">
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
