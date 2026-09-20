// ── useLyricsScrollController: following, and never staying away ─────
// Owner report (2026-09-20): in the karaoke mixer the words sometimes stop
// following the song after a scroll, and stay wherever they were left.
//
// Three things in the controller could each do it:
//
//   - nothing turned following back on. A scroll turned it off, and only
//     scrolling BACK onto the sung line (or pressing stop) turned it on
//     again -- so a reader who scrolled up and let go was left there;
//   - "back on the sung line" was measured from one side only. A line above
//     the top of the list counted as back, so scrolling DOWN past it snapped
//     back in under a second and scrolling UP never did. Hence "sometimes";
//   - the flag that marks a glide as the controller's own was released by a
//     timer nobody cancelled, so the timer of one glide could unmark the
//     next, and the controller then took its own scrolling for the reader's.
//
// jsdom lays nothing out, so the geometry is handed to it here.

import { createRoot, createSignal } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FOLLOW_RESUME_MS } from './lyrics-scroll'
import { useLyricsScrollController } from './useLyricsScrollController'

const scrollTo = vi.fn()

const rectAt = (top: number, height: number) => () =>
  ({ top, height, bottom: top + height }) as DOMRect

/** A 400px list that starts 100px down the page, with five lines in it. */
function mountList(): HTMLElement {
  const list = document.createElement('div')
  list.className = 'sm-lyrics-lines'
  list.getBoundingClientRect = rectAt(100, 400)
  for (let i = 0; i < 5; i++) {
    const row = document.createElement('p')
    row.dataset.lyricsIndex = String(i)
    list.appendChild(row)
  }
  document.body.appendChild(list)
  return list
}

/** Put a line `into` pixels below the top of the list, on screen. */
function placeLine(list: HTMLElement, index: number, into: number): void {
  const row = list.querySelector(`[data-lyrics-index="${index}"]`)
  ;(row as HTMLElement).getBoundingClientRect = rectAt(100 + into, 30)
}

function mountController() {
  const [line, setLine] = createSignal(-1)
  const [playing, setPlaying] = createSignal(true)
  let dispose = () => {}
  const controller = createRoot((disposer) => {
    dispose = disposer
    return useLyricsScrollController({
      playing,
      currentLineIdx: line,
      lyricsSource: () => 'lrc' as never,
      editMode: () => false,
      lrcGenMode: () => false,
      lrcGenLineIdx: () => -1,
    })
  })
  // The scroll listener is attached a task after the list is known.
  vi.advanceTimersByTime(1)
  return { controller, setLine, setPlaying, dispose }
}

let list: HTMLElement
let dispose = () => {}

beforeEach(() => {
  vi.useFakeTimers()
  scrollTo.mockClear()
  Element.prototype.scrollTo = scrollTo as typeof Element.prototype.scrollTo
  list = mountList()
})

afterEach(() => {
  dispose()
  list.remove()
  vi.useRealTimers()
})

describe('following the sung line', () => {
  it('brings a line that has dropped out of the band back to the anchor', () => {
    const mounted = mountController()
    dispose = mounted.dispose
    placeLine(list, 1, 300)
    mounted.setLine(1)
    expect(scrollTo).toHaveBeenCalledTimes(1)
  })

  it('stops when the reader scrolls for themselves', () => {
    const mounted = mountController()
    dispose = mounted.dispose
    list.dispatchEvent(new Event('scroll'))
    expect(mounted.controller.userScrolled()).toBe(true)
    placeLine(list, 1, 300)
    mounted.setLine(1)
    expect(scrollTo).not.toHaveBeenCalled()
  })
})

describe('never staying away', () => {
  it('comes back by itself once the reader has left the words alone', () => {
    const mounted = mountController()
    dispose = mounted.dispose
    // The sung line is low in the list, where scrolling up to read leaves
    // it -- the case that used to be stuck until stop was pressed.
    placeLine(list, 1, 380)
    mounted.setLine(1)
    scrollTo.mockClear()
    vi.advanceTimersByTime(1100) // the controller's own glide is over
    list.dispatchEvent(new Event('scroll'))
    expect(mounted.controller.userScrolled()).toBe(true)

    vi.advanceTimersByTime(FOLLOW_RESUME_MS + 1)

    expect(mounted.controller.userScrolled()).toBe(false)
    expect(scrollTo).toHaveBeenCalledTimes(1)
  })

  it('counts from the LAST scroll, so reading on keeps the words', () => {
    const mounted = mountController()
    dispose = mounted.dispose
    placeLine(list, 1, 380)
    list.dispatchEvent(new Event('scroll'))
    vi.advanceTimersByTime(FOLLOW_RESUME_MS - 500)
    list.dispatchEvent(new Event('scroll'))
    vi.advanceTimersByTime(FOLLOW_RESUME_MS - 500)
    expect(mounted.controller.userScrolled()).toBe(true)
  })

  it('treats a line scrolled off the TOP as away, the same as one below', () => {
    const mounted = mountController()
    dispose = mounted.dispose
    // Scrolled down past the sung line: it is 200px above the list.
    placeLine(list, 1, -200)
    mounted.setLine(1)
    vi.advanceTimersByTime(1100)
    list.dispatchEvent(new Event('scroll'))
    // The settle check runs here. It used to call this "back on the line".
    vi.advanceTimersByTime(900)
    expect(mounted.controller.userScrolled()).toBe(true)
  })

  it('still resumes early when the reader scrolls back onto the line', () => {
    const mounted = mountController()
    dispose = mounted.dispose
    placeLine(list, 1, 120)
    mounted.setLine(1)
    vi.advanceTimersByTime(1100)
    list.dispatchEvent(new Event('scroll'))
    vi.advanceTimersByTime(900)
    expect(mounted.controller.userScrolled()).toBe(false)
  })
})

describe('telling its own glide from the reader', () => {
  it('is not unmarked by the timer of the glide before it', () => {
    const mounted = mountController()
    dispose = mounted.dispose
    placeLine(list, 1, 300)
    mounted.setLine(1) // glide A
    vi.advanceTimersByTime(400)
    placeLine(list, 2, 300)
    mounted.setLine(2) // glide B, 400ms later
    // A's release would have fired at 500ms and unmarked B.
    vi.advanceTimersByTime(200)
    list.dispatchEvent(new Event('scroll'))
    expect(mounted.controller.userScrolled()).toBe(false)
  })

  it('lets go when the glide lands', () => {
    const mounted = mountController()
    dispose = mounted.dispose
    placeLine(list, 1, 300)
    mounted.setLine(1)
    list.dispatchEvent(new Event('scrollend'))
    list.dispatchEvent(new Event('scroll'))
    expect(mounted.controller.userScrolled()).toBe(true)
  })

  it('lets go by itself if a glide never reports landing', () => {
    const mounted = mountController()
    dispose = mounted.dispose
    placeLine(list, 1, 300)
    mounted.setLine(1)
    vi.advanceTimersByTime(1100)
    list.dispatchEvent(new Event('scroll'))
    expect(mounted.controller.userScrolled()).toBe(true)
  })
})
