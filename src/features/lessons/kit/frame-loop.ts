// ============================================================
// Lesson frame loop — canvases that draw only while they are seen
// ============================================================
//
// One requestAnimationFrame loop for the whole page. Each figure registers a
// drawer with an `active` test (on screen, on its step); an inactive drawer
// costs nothing. A drawer that throws is retired rather than taking the loop
// down with it.

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
  (entries) => entries.forEach((e) => seen.set(e.target, e.isIntersecting)),
  { rootMargin: '80px 0px' },
)

/** Starts watching `el`; the returned test is true while it is near the viewport. */
export function watch(el: Element): () => boolean {
  seen.set(el, false)
  observer.observe(el)
  return () => seen.get(el) === true
}

export const isSeen = (el: Element): boolean => seen.get(el) === true

export interface Drawer {
  active(): boolean
  draw(now: number, dt: number): void
}

const drawers: { drawer: Drawer; dead: boolean }[] = []
let last = performance.now()
let running = false

export function addDrawer(drawer: Drawer): void {
  drawers.push({ drawer, dead: false })
}

function frame(now: number): void {
  const dt = Math.min(0.05, (now - last) / 1000)
  last = now
  for (const entry of drawers) {
    if (entry.dead) continue
    try {
      if (entry.drawer.active()) entry.drawer.draw(now, dt)
    } catch (err) {
      entry.dead = true
      console.error(err)
    }
  }
  requestAnimationFrame(frame)
}

export function startFrameLoop(): void {
  if (running) return
  running = true
  last = performance.now()
  requestAnimationFrame(frame)
}
