// ============================================================
// Lesson frame loop — canvases that draw only while they are seen
// ============================================================
//
// One requestAnimationFrame loop for the whole page. Each figure registers a
// drawer with an `active` test (on screen, on its step); an inactive drawer
// costs nothing. A drawer may also say whether it has anything to draw
// (`wants`), as the tune line does: it then draws only when something it
// shows has changed or is moving, and calls `wake` when it has. Once every
// drawer on the page has settled like that, the loop stops asking for
// frames until one wakes it, or a figure comes into view or leaves it. A
// drawer without `wants` draws every frame it is active and keeps the loop
// running, as every drawer always has. A drawer that throws is retired
// rather than taking the loop down with it.

export interface Surface {
  readonly canvas: HTMLCanvasElement
  readonly ctx: CanvasRenderingContext2D
  /** Size the backing store to the element (DPR capped at 2), clear it, return its CSS size. */
  fit(): { ctx: CanvasRenderingContext2D; w: number; h: number }
}

export function surface(canvas: HTMLCanvasElement): Surface {
  const context = canvas.getContext('2d')
  if (context === null) throw new Error('lesson: no 2D canvas context')
  const ctx: CanvasRenderingContext2D = context
  let w = 0
  let h = 0
  let dpr = 1
  return {
    canvas,
    ctx,
    fit() {
      const rect = canvas.getBoundingClientRect()
      const nextDpr = Math.min(2, window.devicePixelRatio || 1)
      const nextW = Math.max(1, Math.round(rect.width))
      const nextH = Math.max(1, Math.round(rect.height))
      if (nextW !== w || nextH !== h || nextDpr !== dpr) {
        w = nextW
        h = nextH
        dpr = nextDpr
        canvas.width = Math.round(w * dpr)
        canvas.height = Math.round(h * dpr)
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)
      return { ctx, w, h }
    },
  }
}

const seen = new WeakMap<Element, boolean>()
const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((e) => seen.set(e.target, e.isIntersecting))
    // a figure came into view or left it: a settled loop looks again
    wake()
  },
  { rootMargin: '80px 0px' },
)

/** Starts watching `el`; the returned test is true while it is near the viewport. */
export function watch(el: Element): () => boolean {
  seen.set(el, false)
  observer.observe(el)
  return () => seen.get(el) === true
}

export const isSeen = (el: Element): boolean => seen.get(el) === true

/**
 * Calls `fn` whenever the screen's pixel ratio changes (a zoom, or another
 * screen): a canvas that rests draws again at the new ratio.
 */
export function watchPixelRatio(fn: () => void): void {
  const query = window.matchMedia(
    `(resolution: ${window.devicePixelRatio || 1}dppx)`,
  )
  query.addEventListener(
    'change',
    () => {
      fn()
      watchPixelRatio(fn)
    },
    { once: true },
  )
}

export interface Drawer {
  active(): boolean
  draw(now: number, dt: number): void
  /**
   * Whether it has a frame to draw: something it shows has changed since
   * its last frame, or is moving. A drawer that has it calls `wake()` when
   * it gets something new to draw; one without it draws every frame.
   */
  wants?(): boolean
}

const drawers: { drawer: Drawer; dead: boolean }[] = []
let last = performance.now()
let running = false
// a frame is asked for, or being drawn
let asked = false
// a drawer has something to draw in the next frame
let more = false

export function addDrawer(drawer: Drawer): void {
  drawers.push({ drawer, dead: false })
  wake()
}

function ask(): void {
  asked = true
  requestAnimationFrame(frame)
}

function frame(now: number): void {
  // a frame's time can fall a little before the wake that asked for it
  const dt = Math.min(0.05, Math.max(0, (now - last) / 1000))
  last = now
  more = false
  for (const entry of drawers) {
    if (entry.dead) continue
    const d = entry.drawer
    try {
      const on = d.active()
      // one without `wants` draws every frame it is on, and keeps the loop going
      if (on && d.wants?.() !== false) d.draw(now, dt)
      if (d.wants === undefined || (on && d.wants())) more = true
    } catch (err) {
      entry.dead = true
      console.error(err)
    }
  }
  asked = false
  if (more) ask()
}

/**
 * A drawer has something new to draw. A loop that had settled asks for a
 * frame again, stepping from now; during a frame, it draws one more.
 */
export function wake(): void {
  more = true
  if (!running || asked) return
  last = performance.now()
  ask()
}

export function startFrameLoop(): void {
  if (running) return
  running = true
  wake()
}
