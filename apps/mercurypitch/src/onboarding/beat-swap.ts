// ============================================================
// Between the beats: a View Transition or a cross-fade, and Merc's move
// ============================================================
//
// S7b §3.3: a beat gives way to the next by transform and opacity alone, a
// same-document View Transition where the WebView has one, a cross-fade
// otherwise. Merc is one element for every beat (NativeOnboarding.tsx), so
// he is not cross-faded with the rest: he moves, from where he stood to
// where the next beat puts him. Measured before the swap and after, he is
// drawn from the old box to the new one by a transform (a FLIP), the same
// way in either kind of swap. In a View Transition he is named on his own
// (beat-swap.css), so the old picture of him is not drawn: one Merc on
// screen, not two.
//
// Reduced motion: no move, and the swap is one 150 ms cross-fade.
//
// A RUNNING VIEW TRANSITION TAKES EVERY TAP. Measured on Chromium 148 (19
// Oct 2026, scratch/p5/vt-taps.mjs in the part 5 run): a tap 500 ms into a
// transition reached nothing, and `::view-transition { pointer-events:
// none }` did not change that. So a swap that brings a sheet up over the
// layer (Keep, the Cloud offer) is always the cross-fade, which leaves the
// page live: the sheet's Not now answers from its first frame (S7b E1,
// §4.4). Between the layer's own beats the View Transition holds taps for
// SWAP_MS, the length of the swap.
//
// A View Transition changes the page in its update callback, a frame
// after it is asked for, so `change` must touch only what draws the beat:
// whatever has to happen inside the tap (a mic opened by Find my range)
// stays with the caller. Without element.animate (jsdom) the swap is
// `change`, at once.

/** A swap between beats, ms: the View Transition's or the cross-fade's. */
export const SWAP_MS = 280
/** The same under reduced motion: one cross-fade. */
export const SWAP_REDUCED_MS = 150
/** Merc's move from his old place to his new one, ms. */
export const MOVE_MS = 460
const MOVE_EASE = 'cubic-bezier(0.2, 0.8, 0.2, 1)'

/** On <html> while the layer's View Transition runs (beat-swap.css). */
export const SWAP_CLASS = 'mp-beat-swap'
/** Merc's own class: what beat-swap.css names in a View Transition. */
export const MERC_CLASS = 'mp-onboarding-merc'
/** On the old beat's picture while it fades: the probe tells it apart. */
export const GHOST_ATTR = 'data-beat-ghost'

/**
 * How a beat gives way: 'view' between the layer's own beats, 'fade' when
 * the next beat brings a sheet up over the layer.
 */
export type SwapHow = 'view' | 'fade'

/** What the last swap was, for the probe: what the page did, not what was asked. */
export type SwapDone = SwapHow | 'cut'

export interface BeatSwapDeps {
  /** The layer: the old beat's picture fades over the new beat in it. */
  layer: () => HTMLElement | undefined
  /** The beat on screen: the layer's child that `change` replaces. */
  beat: () => HTMLElement | undefined
  /** Merc, wherever the beat on screen has put him. */
  merc: () => HTMLElement | undefined
  reduced: () => boolean
  /** Told what each swap did. */
  done?: (how: SwapDone) => void
}

export interface BeatSwap {
  /** The next beat, made by `change`, shown as `how` says. */
  swap: (change: () => void, how: SwapHow) => void
  /** The layer has gone: an old beat's picture still fading goes with it. */
  dispose: () => void
}

/** The page's View Transition, when the WebView has one. */
function viewTransition(): ((update: () => void) => ViewTransition) | null {
  // Typed as always there; a WebView older than iOS 18 or Chrome 111 has
  // none.
  if (!('startViewTransition' in document)) return null
  return (update) => document.startViewTransition(update)
}

function boxOf(element: HTMLElement | undefined): DOMRect | null {
  if (element === undefined || !element.isConnected) return null
  const box = element.getBoundingClientRect()
  return box.width > 0 && box.height > 0 ? box : null
}

const quiet = (promise: Promise<unknown>): void => {
  promise.catch(() => undefined)
}

/**
 * The old beat as a picture: a copy with nothing in it to answer (no test
 * ids, no ids, no focus, no taps), its canvases' pixels copied over, and
 * no Merc, who moves on to the next beat. Laid over the layer where the
 * beat stood.
 */
function ghostOf(old: HTMLElement, layer: HTMLElement): HTMLElement {
  const ghost = old.cloneNode(true) as HTMLElement
  const from = old.querySelectorAll('canvas')
  const into = ghost.querySelectorAll('canvas')
  from.forEach((canvas, index) => {
    try {
      into[index]?.getContext('2d')?.drawImage(canvas, 0, 0)
    } catch {
      // A canvas that cannot be copied fades as an empty one.
    }
  })
  ghost.querySelector(`.${MERC_CLASS}`)?.remove()
  for (const element of [
    ghost,
    ...ghost.querySelectorAll('[data-testid], [id]'),
  ]) {
    element.removeAttribute('data-testid')
    element.removeAttribute('id')
  }
  const at = old.getBoundingClientRect()
  const frame = layer.getBoundingClientRect()
  Object.assign(ghost.style, {
    position: 'absolute',
    left: `${at.left - frame.left}px`,
    top: `${at.top - frame.top}px`,
    width: `${at.width}px`,
    height: `${at.height}px`,
    margin: '0',
    zIndex: '3',
    pointerEvents: 'none',
  })
  ghost.setAttribute('aria-hidden', 'true')
  ghost.setAttribute(GHOST_ATTR, '')
  ghost.inert = true
  layer.appendChild(ghost)
  return ghost
}

export function createBeatSwap(deps: BeatSwapDeps): BeatSwap {
  const ghosts = new Set<HTMLElement>()
  let moving: Animation | null = null
  /** View Transitions not yet finished: a second can start under the first. */
  let viewing = 0

  /** Merc from where he was drawn to where the new beat put him. */
  const move = (from: DOMRect | null): void => {
    const merc = deps.merc()
    const to = boxOf(merc)
    if (from === null || to === null || merc === undefined) return
    const dx = from.left - to.left
    const dy = from.top - to.top
    const scale = from.width / to.width
    moving?.cancel()
    moving = null
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1 && Math.abs(scale - 1) < 0.01) {
      return
    }
    moving = merc.animate(
      [
        {
          transformOrigin: '0 0',
          transform: `translate(${dx}px, ${dy}px) scale(${scale})`,
        },
        { transformOrigin: '0 0', transform: 'none' },
      ],
      { duration: MOVE_MS, easing: MOVE_EASE },
    )
  }

  const fade = (change: () => void, ms: number, from: DOMRect | null): void => {
    const layer = deps.layer()
    const old = deps.beat()
    const ghost =
      layer === undefined || old === undefined ? null : ghostOf(old, layer)
    change()
    const next = deps.beat()
    if (ghost !== null) {
      ghosts.add(ghost)
      const gone = (): void => {
        ghosts.delete(ghost)
        ghost.remove()
      }
      ghost
        .animate([{ opacity: 1 }, { opacity: 0 }], {
          duration: ms,
          easing: 'ease',
          fill: 'forwards',
        })
        .finished.then(gone, gone)
    }
    if (next !== undefined && next !== old) {
      next.animate([{ opacity: 0 }, { opacity: 1 }], {
        duration: ms,
        easing: 'ease',
      })
    }
    move(from)
  }

  const swap = (change: () => void, how: SwapHow): void => {
    const old = deps.beat()
    if (old === undefined || typeof old.animate !== 'function') {
      change()
      deps.done?.('cut')
      return
    }
    if (deps.reduced()) {
      fade(change, SWAP_REDUCED_MS, null)
      deps.done?.('fade')
      return
    }
    const merc = deps.merc()
    const from = boxOf(merc)
    const start = how === 'view' ? viewTransition() : null
    if (start === null) {
      fade(change, SWAP_MS, from)
      deps.done?.('fade')
      return
    }
    const html = document.documentElement
    viewing += 1
    html.classList.add(SWAP_CLASS)
    const transition = start(() => {
      change()
      move(from)
    })
    // A transition skipped (another started under it) rejects these.
    quiet(transition.ready)
    quiet(transition.updateCallbackDone)
    const over = (): void => {
      viewing -= 1
      if (viewing === 0) html.classList.remove(SWAP_CLASS)
    }
    transition.finished.then(over, over)
    deps.done?.('view')
  }

  return {
    swap,
    dispose: () => {
      moving?.cancel()
      moving = null
      for (const ghost of ghosts) ghost.remove()
      ghosts.clear()
    },
  }
}
