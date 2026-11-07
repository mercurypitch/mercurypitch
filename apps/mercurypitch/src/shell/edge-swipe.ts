// ============================================================
// The back swipe: a drag from the left edge takes a pushed screen off
// ============================================================
//
// On an iPhone, a screen that was pushed is left by swiping in from the left
// edge. The web view has no such gesture of its own: the bridge's view
// controller leaves WebKit's back-forward swipe off (ios/App/App/
// ViewController.swift), and a pushed screen is a signal in the shell, not a
// history entry, so there would be nothing for it to go back to anyway. So
// a pushed screen that asks for it (`swipeBack`, ShellScreens.tsx) takes the
// gesture itself: a touch that starts at the edge and moves mostly sideways
// drags the screen with the finger, and a release past a third of the width,
// or a quick flick, is Back.
//
// Not on Android. Its system back gesture already arrives as the back button
// (infrastructure/native-shell.ts, performBack), and two gestures on one edge
// would fight over the same touch.
//
// The drag goes to Pointer Events. The scroller under the finger allows
// vertical panning only (`touch-action: pan-y`, shell.css), so a sideways
// drag stays with the page instead of being cancelled as a scroll, and a
// vertical one is handed to the browser at once.

import { Capacitor } from '@capacitor/core'

/** How far in from the left edge a swipe may start, in CSS px. */
export const EDGE_PX = 24
/** Movement under this is still a tap. */
export const SLOP_PX = 10
/** A release past this share of the width is Back. */
export const COMMIT_FRACTION = 0.35
/** A release moving right faster than this is Back too, in px per ms. */
export const COMMIT_VELOCITY = 0.5
/** How long the screen takes to finish or undo the slide, in ms. */
export const SETTLE_MS = 200

export type SwipeIntent = 'pending' | 'swipe' | 'scroll'

/** What a touch that started at the edge is doing, so far. */
export function swipeIntent(dx: number, dy: number): SwipeIntent {
  if (Math.hypot(dx, dy) < SLOP_PX) return 'pending'
  return dx > 0 && dx > Math.abs(dy) * 1.2 ? 'swipe' : 'scroll'
}

/** Whether a release at this distance and speed is Back. */
export function swipeCommits(
  dx: number,
  width: number,
  velocity: number,
): boolean {
  if (dx <= 0) return false
  return dx >= width * COMMIT_FRACTION || velocity >= COMMIT_VELOCITY
}

function reducedMotion(): boolean {
  return (
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

export interface EdgeSwipeOptions {
  /** Back: the swipe has been released past the line. */
  onBack: () => void
  /** The platform, for a test; the running one otherwise. */
  platform?: string
}

/**
 * Let a swipe from the left edge drag `screen` and, released far enough,
 * call `onBack`. Returns the release, which also puts the screen back.
 */
export function installEdgeSwipe(
  screen: HTMLElement,
  options: EdgeSwipeOptions,
): () => void {
  const platform = options.platform ?? Capacitor.getPlatform()
  if (platform === 'android') return () => undefined

  let pointer: number | null = null
  let startX = 0
  let startY = 0
  let intent: SwipeIntent = 'pending'
  let lastX = 0
  let lastAt = 0
  let velocity = 0
  let settle: ReturnType<typeof setTimeout> | undefined

  const place = (dx: number, animate: boolean): void => {
    screen.style.transition = animate
      ? `transform ${SETTLE_MS}ms cubic-bezier(0.2, 0.8, 0.2, 1)`
      : 'none'
    screen.style.transform = dx === 0 ? '' : `translate3d(${dx}px, 0, 0)`
  }

  const reset = (): void => {
    pointer = null
    intent = 'pending'
    velocity = 0
  }

  const onDown = (event: PointerEvent): void => {
    if (pointer !== null || event.pointerType === 'mouse') return
    if (event.clientX > EDGE_PX) return
    pointer = event.pointerId
    startX = event.clientX
    startY = event.clientY
    lastX = event.clientX
    lastAt = event.timeStamp
    intent = 'pending'
  }

  const onMove = (event: PointerEvent): void => {
    if (event.pointerId !== pointer) return
    const dx = event.clientX - startX
    const dy = event.clientY - startY
    if (intent === 'pending') {
      intent = swipeIntent(dx, dy)
      if (intent === 'scroll') {
        reset()
        return
      }
      if (intent === 'swipe') {
        clearTimeout(settle)
        screen.setPointerCapture?.(event.pointerId)
        screen.setAttribute('data-swiping', 'on')
      }
    }
    if (intent !== 'swipe') return
    const elapsed = event.timeStamp - lastAt
    if (elapsed > 0) velocity = (event.clientX - lastX) / elapsed
    lastX = event.clientX
    lastAt = event.timeStamp
    place(Math.max(0, dx), false)
  }

  const finish = (event: PointerEvent, cancelled: boolean): void => {
    if (event.pointerId !== pointer) return
    const swiping = intent === 'swipe'
    const dx = event.clientX - startX
    const speed = velocity
    reset()
    if (!swiping) return
    screen.removeAttribute('data-swiping')
    const width = screen.getBoundingClientRect().width || window.innerWidth
    if (cancelled || !swipeCommits(dx, width, speed)) {
      place(0, !reducedMotion())
      return
    }
    if (reducedMotion()) {
      place(0, false)
      options.onBack()
      return
    }
    place(width, true)
    settle = setTimeout(() => {
      options.onBack()
      // Still here if the Back did not take the screen off.
      place(0, false)
    }, SETTLE_MS)
  }

  const onUp = (event: PointerEvent): void => finish(event, false)
  const onCancel = (event: PointerEvent): void => finish(event, true)

  screen.addEventListener('pointerdown', onDown)
  screen.addEventListener('pointermove', onMove)
  screen.addEventListener('pointerup', onUp)
  screen.addEventListener('pointercancel', onCancel)
  return () => {
    clearTimeout(settle)
    screen.removeEventListener('pointerdown', onDown)
    screen.removeEventListener('pointermove', onMove)
    screen.removeEventListener('pointerup', onUp)
    screen.removeEventListener('pointercancel', onCancel)
    screen.removeAttribute('data-swiping')
    screen.style.transition = ''
    screen.style.transform = ''
  }
}
