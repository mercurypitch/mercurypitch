import { describe, expect, it, vi } from 'vitest'
import { computeBackingSize, createDprWatcher, createRedrawScheduler, syncCanvasBacking, } from '@/lib/canvas-size-sync'

describe('computeBackingSize', () => {
  it('scales css pixels by dpr', () => {
    expect(computeBackingSize(300.4, 150.6, 2)).toEqual({
      cssW: 300,
      cssH: 151,
      deviceW: 600,
      deviceH: 302,
    })
  })

  it('returns null for zero-area rects (hidden / mid-mount)', () => {
    expect(computeBackingSize(0, 150, 1)).toBeNull()
    expect(computeBackingSize(300, 0, 1)).toBeNull()
  })

  it('guards against a bogus dpr', () => {
    expect(computeBackingSize(100, 100, 0)).toEqual({
      cssW: 100,
      cssH: 100,
      deviceW: 100,
      deviceH: 100,
    })
  })
})

describe('syncCanvasBacking', () => {
  const makeCanvas = (cssW: number, cssH: number): HTMLCanvasElement => {
    const canvas = document.createElement('canvas')
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
      width: cssW,
      height: cssH,
      top: 0,
      left: 0,
      right: cssW,
      bottom: cssH,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect)
    return canvas
  }

  it('sets the backing store from the CSS size × dpr', () => {
    const canvas = makeCanvas(400, 100)
    expect(syncCanvasBacking(canvas, 2)).toBe(true)
    expect(canvas.width).toBe(800)
    expect(canvas.height).toBe(200)
  })

  it('reports no change when the backing store already matches', () => {
    const canvas = makeCanvas(400, 100)
    syncCanvasBacking(canvas, 1)
    expect(syncCanvasBacking(canvas, 1)).toBe(false)
  })

  it('removes legacy inline pixel pins so CSS regains control', () => {
    const canvas = makeCanvas(400, 100)
    canvas.style.width = '620px'
    canvas.style.height = '80px'
    syncCanvasBacking(canvas, 1)
    expect(canvas.style.width).toBe('')
    expect(canvas.style.height).toBe('')
  })

  it('keeps the previous backing store on a zero-size measure', () => {
    const canvas = makeCanvas(400, 100)
    syncCanvasBacking(canvas, 1)
    ;(
      canvas.getBoundingClientRect as unknown as ReturnType<typeof vi.fn>
    ).mockReturnValue({ width: 0, height: 0 } as DOMRect)
    expect(syncCanvasBacking(canvas, 1)).toBe(false)
    expect(canvas.width).toBe(400)
    expect(canvas.height).toBe(100)
  })
})

describe('createRedrawScheduler', () => {
  it('coalesces multiple queues into one draw per frame', () => {
    const draw = vi.fn()
    const frames: (() => void)[] = []
    const scheduler = createRedrawScheduler(
      draw,
      (cb) => frames.push(cb) - 1,
      () => {},
    )
    scheduler.queue()
    scheduler.queue()
    scheduler.queue()
    expect(frames.length).toBe(1)
    frames[0]()
    expect(draw).toHaveBeenCalledTimes(1)
    // A queue after the frame fires schedules a fresh draw.
    scheduler.queue()
    expect(frames.length).toBe(2)
  })

  it('cancel drops the pending draw', () => {
    const draw = vi.fn()
    const frames: (() => void)[] = []
    const cancelled: number[] = []
    const scheduler = createRedrawScheduler(
      draw,
      (cb) => frames.push(cb) - 1,
      (id) => cancelled.push(id),
    )
    scheduler.queue()
    scheduler.cancel()
    expect(cancelled).toEqual([0])
  })
})

describe('createDprWatcher', () => {
  interface FakeMql {
    query: string
    listeners: Set<() => void>
    addEventListener: (type: 'change', cb: () => void) => void
    removeEventListener: (type: 'change', cb: () => void) => void
  }

  const makeFakeWindow = () => {
    const created: FakeMql[] = []
    const win = {
      devicePixelRatio: 1,
      matchMedia: (query: string): FakeMql => {
        const mql: FakeMql = {
          query,
          listeners: new Set(),
          addEventListener: (_t, cb) => mql.listeners.add(cb),
          removeEventListener: (_t, cb) => mql.listeners.delete(cb),
        }
        created.push(mql)
        return mql
      },
    }
    return { win, created }
  }

  it('fires on change and re-arms against the new dpr', () => {
    const { win, created } = makeFakeWindow()
    const onChange = vi.fn()
    createDprWatcher(onChange, win)
    expect(created[0].query).toContain('1dppx')

    win.devicePixelRatio = 2
    for (const cb of [...created[0].listeners]) cb()

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(created.length).toBe(2)
    expect(created[1].query).toContain('2dppx')
    // The stale query's listener was removed.
    expect(created[0].listeners.size).toBe(0)
  })

  it('dispose stops listening and re-arming', () => {
    const { win, created } = makeFakeWindow()
    const onChange = vi.fn()
    const watcher = createDprWatcher(onChange, win)
    watcher.dispose()
    expect(created[0].listeners.size).toBe(0)
    for (const cb of [...created[0].listeners]) cb()
    expect(onChange).not.toHaveBeenCalled()
    expect(created.length).toBe(1)
  })
})
