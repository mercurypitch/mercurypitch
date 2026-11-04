// ============================================================
// createSheetFollow — the staff keeps the playback cursor in sight
// ============================================================
//
// jsdom has no layout and no scrolling, so the scrollers here are elements
// with their geometry set by hand: the MIDI Melody panel's Notes view at
// 1280 x 816, a 91 px tall body over a 220 px score whose staff scroller is
// 180 px tall, with systems 130 px apart. A smooth scroll is held until the
// test lands it, as a glide is in a browser.

import { createRoot, createSignal } from 'solid-js'
import { afterEach, describe, expect, it } from 'vitest'
import { SHEET_FOLLOW_RESUME_MS } from '@/lib/sheet-follow'
import type { CursorPos } from '@/lib/sheet-music-renderer'
import { createSheetFollow } from './sheet-follow-controller'

interface Box {
  /** Where the box's top sits in the viewport while nothing is scrolled. */
  top: number
  height: number
  contentHeight: number
  width: number
  contentWidth: number
}

interface FakeScroller {
  el: HTMLElement
  /** Every scrollTo the follow asked for, in order. */
  calls: ScrollToOptions[]
  /** Every plain scrollTop / scrollLeft write, in order. */
  writes: string[]
  /** Finishes a smooth scroll in flight, as the browser's glide would. */
  land: () => void
}

function fakeScroller(box: Box, viewportTop: () => number): FakeScroller {
  const el = document.createElement('div')
  let top = 0
  let left = 0
  let pending: ScrollToOptions | null = null
  const calls: ScrollToOptions[] = []
  const writes: string[] = []
  const maxTop = (): number => Math.max(0, box.contentHeight - box.height)
  const maxLeft = (): number => Math.max(0, box.contentWidth - box.width)
  const apply = (options: ScrollToOptions): void => {
    if (options.top !== undefined)
      top = Math.min(maxTop(), Math.max(0, options.top))
    if (options.left !== undefined)
      left = Math.min(maxLeft(), Math.max(0, options.left))
  }
  Object.defineProperties(el, {
    scrollTop: {
      get: () => top,
      set: (value: number) => {
        writes.push(`top=${value}`)
        pending = null
        top = value
      },
    },
    scrollLeft: {
      get: () => left,
      set: (value: number) => {
        writes.push(`left=${value}`)
        pending = null
        left = value
      },
    },
    clientTop: { get: () => 0 },
    clientHeight: { get: () => box.height },
    scrollHeight: { get: () => box.contentHeight },
    clientWidth: { get: () => box.width },
    scrollWidth: { get: () => box.contentWidth },
  })
  el.getBoundingClientRect = () =>
    new DOMRect(0, viewportTop(), box.width, box.height)
  el.scrollTo = ((options: ScrollToOptions) => {
    calls.push(options)
    if (options.behavior === 'smooth') pending = options
    else apply(options)
  }) as HTMLElement['scrollTo']
  return {
    el,
    calls,
    writes,
    land: () => {
      if (pending === null) return
      apply(pending)
      pending = null
      el.dispatchEvent(new Event('scrollend'))
    },
  }
}

/** The engraved staff: 14 px of padding inside the staff scroller. */
function fakeContent(): HTMLElement {
  const el = document.createElement('div')
  Object.defineProperties(el, {
    offsetTop: { get: () => 14 },
    offsetLeft: { get: () => 10 },
  })
  return el
}

/** The cursor on system `index`, `x` px along it (content coordinates). */
const onSystem = (index: number, x = 120): CursorPos => ({
  x,
  top: 54 + index * 130,
  bottom: 114 + index * 130,
})

const STAFF: Box = {
  top: 0,
  height: 180,
  contentHeight: 726,
  width: 356,
  contentWidth: 460,
}

/** Opening on the first system: its stave sits below the middle of a
 *  180 px view, so it is parked a quarter of the way down at once. */
const OPENED = { top: 68 - 45, left: 0, behavior: 'instant' }

function mount(
  options: {
    at?: CursorPos
    playing?: boolean
    outer?: boolean
    reducedMotion?: boolean
  } = {},
) {
  let clock = 1_000
  // The Notes view's body: 91 px tall at y 653, over a 220 px score whose
  // staff starts 76 px down (the score's header and the tempo line).
  const outer =
    options.outer === true
      ? fakeScroller(
          {
            top: 653,
            height: 91,
            contentHeight: 220,
            width: 380,
            contentWidth: 380,
          },
          () => 653,
        )
      : undefined
  const staff = fakeScroller(STAFF, () =>
    outer ? 653 + 76 - outer.el.scrollTop : 0,
  )
  const content = fakeContent()
  const [cursor, setCursor] = createSignal<CursorPos | null>(
    options.at ?? onSystem(0),
  )
  const [playing, setPlaying] = createSignal(options.playing ?? false)
  const [jumps, setJumps] = createSignal(0)
  const { follow, dispose } = createRoot((disposeRoot) => ({
    follow: createSheetFollow({
      scroller: () => staff.el,
      content: () => content,
      outer: outer ? () => outer.el : undefined,
      cursor,
      playing,
      jumps,
      now: () => clock,
      reducedMotion: () => options.reducedMotion ?? false,
    }),
    dispose: disposeRoot,
  }))
  disposers.push(dispose)
  return {
    staff,
    outer,
    setCursor,
    setPlaying,
    seek: (at: CursorPos) => {
      setCursor(at)
      setJumps((count) => count + 1)
    },
    wait: (ms: number) => {
      clock += ms
    },
    follow,
  }
}

const disposers: Array<() => void> = []
afterEach(() => {
  while (disposers.length > 0) disposers.pop()?.()
})

describe('createSheetFollow', () => {
  it('scrolls each system into view as the cursor moves across them', () => {
    const view = mount()
    view.setPlaying(true)
    view.setCursor(onSystem(0, 200))
    expect(view.staff.calls).toEqual([OPENED])

    // The cursor reaches the second system: one glide parks it a quarter of
    // the way down the staff (its stave at 14 + 184 px, less 45).
    view.setCursor(onSystem(1, 70))
    expect(view.staff.calls.slice(1)).toEqual([
      { top: 198 - 45, left: 0, behavior: 'smooth' },
    ])
    view.staff.land()
    expect(view.staff.el.scrollTop).toBe(153)

    view.setCursor(onSystem(1, 200))
    view.setCursor(onSystem(2, 70))
    expect(view.staff.calls.slice(2)).toEqual([
      { top: 328 - 45, left: 0, behavior: 'smooth' },
    ])
    view.staff.land()
    expect(view.staff.el.scrollTop).toBe(283)
  })

  it('leaves a glide alone until it lands', () => {
    const view = mount({ playing: true })
    view.setCursor(onSystem(1, 70))
    expect(view.staff.calls).toHaveLength(2)

    // Mid-glide the cursor runs on, past where the staff would scroll
    // sideways for it. Any scroll of the gliding staff, even one to where
    // it already is, would stop the glide in Chromium.
    view.setCursor(onSystem(1, 72))
    view.setCursor(onSystem(1, 340))
    expect(view.staff.calls).toHaveLength(2)
    expect(view.staff.writes).toEqual([])

    view.staff.land()
    view.setCursor(onSystem(1, 341))
    expect(view.staff.calls.slice(2)).toEqual([
      { left: 341 + 10 - 356 + 80, behavior: 'instant' },
    ])
    expect(view.staff.writes).toEqual([])
  })

  it('tries again when a glide never lands', () => {
    const view = mount({ playing: true })
    view.setCursor(onSystem(1, 70))
    expect(view.staff.calls).toHaveLength(2)

    view.wait(1_100)
    view.setCursor(onSystem(1, 72))
    expect(view.staff.calls).toEqual([
      OPENED,
      { top: 153, left: 0, behavior: 'smooth' },
      { top: 153, left: 0, behavior: 'smooth' },
    ])
  })

  it('lets go while the staff is scrolled by hand, and follows again after 3.5 s', () => {
    const view = mount({ playing: true })
    view.staff.el.dispatchEvent(new Event('wheel'))

    view.setCursor(onSystem(1, 70))
    view.wait(SHEET_FOLLOW_RESUME_MS - 100)
    view.setCursor(onSystem(1, 80))
    expect(view.staff.calls).toEqual([OPENED])

    view.wait(100)
    view.setCursor(onSystem(1, 90))
    expect(view.staff.calls).toEqual([
      OPENED,
      { top: 153, left: 0, behavior: 'smooth' },
    ])
  })

  it('follows again at once after a seek, playing or paused', () => {
    const view = mount()
    view.staff.el.dispatchEvent(new Event('touchmove'))

    view.seek(onSystem(3, 150))
    expect(view.staff.calls).toEqual([
      OPENED,
      { top: 54 + 390 + 14 - 45, left: 0, behavior: 'smooth' },
    ])
  })

  it('follows again at once when the song plays', () => {
    const view = mount({ at: onSystem(2, 150) })
    view.staff.el.dispatchEvent(new Event('wheel'))
    view.setCursor(onSystem(3, 150))
    expect(view.staff.calls).toHaveLength(1)

    view.setPlaying(true)
    expect(view.staff.calls.slice(1)).toEqual([
      { top: 458 - 45, left: 0, behavior: 'smooth' },
    ])
  })

  it('shows the cursor’s system when the staff opens, wherever the song is', () => {
    const view = mount({ at: onSystem(3, 150) })
    expect(view.staff.calls).toEqual([
      { top: 458 - 45, left: 0, behavior: 'instant' },
    ])
  })

  it('shows a note’s system after a click on it', () => {
    const view = mount({ at: onSystem(0, 150) })
    view.staff.el.dispatchEvent(new Event('wheel'))
    view.follow.seeked()
    view.setCursor(onSystem(2, 150))
    expect(view.staff.calls).toEqual([
      OPENED,
      { top: 328 - 45, left: 0, behavior: 'smooth' },
    ])
  })

  it('scrolls the Notes view’s body just far enough to show the stave', () => {
    const view = mount({ outer: true })

    // Parked in the staff, the stave is at 653 + 76 + 68 - 23 = 774 to 834,
    // under the body's bottom at 744: the body scrolls until the stave and
    // 12 px below it show.
    expect(view.staff.calls).toEqual([OPENED])
    expect(view.outer?.calls).toEqual([
      { top: 834 + 12 - 744, behavior: 'instant' },
    ])
    expect(view.outer?.el.scrollTop).toBe(102)

    // The next system glides up inside the staff, to where the body shows
    // it already.
    view.setPlaying(true)
    view.setCursor(onSystem(1, 70))
    expect(view.staff.calls.slice(1)).toEqual([
      { top: 153, left: 0, behavior: 'smooth' },
    ])
    expect(view.outer?.calls).toHaveLength(1)

    // Scrolled by hand to the score's header, the body is left there until
    // the follow resumes, and then shows the stave again.
    view.outer?.el.dispatchEvent(new Event('wheel'))
    view.outer!.el.scrollTop = 0
    view.staff.land()
    view.setCursor(onSystem(2, 70))
    expect(view.staff.calls).toHaveLength(2)
    view.wait(SHEET_FOLLOW_RESUME_MS)
    view.setCursor(onSystem(2, 80))
    expect(view.staff.calls.slice(2)).toEqual([
      { top: 283, left: 0, behavior: 'smooth' },
    ])
    expect(view.outer?.calls.slice(1)).toEqual([
      { top: 102, behavior: 'smooth' },
    ])
  })

  it('moves without gliding for a reader who asked for less motion', () => {
    const view = mount({ playing: true, reducedMotion: true })
    view.setCursor(onSystem(1, 70))
    expect(view.staff.calls).toEqual([
      OPENED,
      { top: 153, left: 0, behavior: 'instant' },
    ])
  })
})
