// ============================================================
// Lesson 6 tune toy tests — a play pressed again, and a drag's end
// ============================================================
//
// The steps' stage on the page's own markup, with sound on: Play pressed
// again while the line plays stays lit for the newer run and goes out
// when that run ends, and the swapped version played again stays on the
// line until its own run ends. The line itself is a canvas jsdom cannot
// read, so that test reads what the toy tells its line to show. A drag
// ends with its pointer, let go off the line or taken by a scroll, so Enter
// on a bead after it still plays the bead; the click a drag ends on is
// still no press. The real-mouse drags are in learn-lesson-06-qa.spec.ts.

import { afterEach, describe, expect, it, vi } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import { createModeStore } from '@/features/lessons/kit/names'
import type { LettersSolfegeMode } from '@/features/lessons/kit/names-modes'
import { LETTERS_SOLFEGE_MODES } from '@/features/lessons/kit/names-modes'
import { el, listen, loadPage } from './page-dom.test-fixtures'
import type { TuneStep, TuneToy } from './tune-toy'
import { mountTuneToy } from './tune-toy'

/** The steps' stage on the page's markup, on `step`. */
function mountStage(step: TuneStep = 1): TuneToy {
  loadPage()
  const toy = mountTuneToy(el('#toyTune'), {
    active: () => true,
    names: createModeStore<LettersSolfegeMode>(
      LETTERS_SOLFEGE_MODES,
      'letters',
    ),
  })
  toy.setStep(step)
  return toy
}

/**
 * A pointer event from pointer 1 at height `y`, a mouse's unless
 * `pointerType` says otherwise. jsdom has no PointerEvent, so it is a
 * mouse event carrying a pointer's id and type.
 */
function pointer(
  target: Element,
  type: string,
  y: number,
  pointerType = 'mouse',
): void {
  const event = new MouseEvent(type, {
    bubbles: true,
    button: 0,
    clientX: 100,
    clientY: y,
  })
  Object.defineProperties(event, {
    pointerId: { value: 1 },
    pointerType: { value: pointerType },
  })
  target.dispatchEvent(event)
}

/** Enter or Space on a focused button: a click no pointer made. */
const keyClick = (target: Element): boolean =>
  target.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 0 }))

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  document.body.textContent = ''
})

describe("Lesson 6's tune toy: a play pressed again", () => {
  it('keeps Play lit for the newer run, and puts it out when that run ends', async () => {
    // Arrange: the first line, a second into its 4 s run
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    listen()
    mountStage()
    const play = el('#toyTune [data-tune-play]')
    play.click()
    await vi.advanceTimersByTimeAsync(1000)

    // Act
    play.click()
    await vi.advanceTimersByTimeAsync(1000)
    const during = play.classList.contains('is-on')
    await vi.advanceTimersByTimeAsync(3100)

    // Assert
    expect(during).toBe(true)
    expect(play.classList.contains('is-on')).toBe(false)
  })

  it('keeps the swapped version on the line for the newer run, and takes it off when that run ends', async () => {
    // Arrange: Step 4, the swapped version a second into its run
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    listen()
    const toy = mountStage(4)
    void toy.playSwapped(true)
    await vi.advanceTimersByTimeAsync(1000)
    const shown = vi.spyOn(toy.core, 'setOverlay')
    const onLine = (): boolean[] => shown.mock.calls.map(([o]) => o !== null)

    // Act
    void toy.playSwapped(true)
    await vi.advanceTimersByTimeAsync(1000)
    const during = onLine()
    await vi.advanceTimersByTimeAsync(3100)

    // Assert: put on for the newer run, and taken off only once it ends
    expect(during).toEqual([true])
    expect(onLine()).toEqual([true, false])
  })
})

describe("Lesson 6's tune toy: a drag's end", () => {
  it('plays a bead by Enter after a mouse drag let go off the line', () => {
    // Arrange: Step 1's line, the fourth bead (G4) dragged up and let go above the figure
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const heard = listen()
    mountStage()
    const bead = el('#toyTune [data-note="3"]')
    pointer(bead, 'pointerdown', 200)
    pointer(bead, 'pointermove', 170)
    pointer(document.body, 'pointerup', 120)

    // Act
    keyClick(bead)
    vi.advanceTimersByTime(100)

    // Assert
    expect(heard.map((v) => v.midi)).toEqual([67])
  })

  it('plays a bead by Enter after a touch the page took for a scroll', () => {
    // Arrange: a touch on the fourth bead, moved, then cancelled by the page's scroll
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const heard = listen()
    mountStage()
    const bead = el('#toyTune [data-note="3"]')
    pointer(bead, 'pointerdown', 200, 'touch')
    pointer(bead, 'pointermove', 170, 'touch')
    pointer(bead, 'pointercancel', 170, 'touch')

    // Act
    keyClick(bead)
    vi.advanceTimersByTime(100)

    // Assert
    expect(heard.map((v) => v.midi)).toEqual([67])
  })

  it('takes no press from the click a drag ends on, and plays the next click', () => {
    // Arrange: the fourth bead dragged up and let go on itself
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const heard = listen()
    mountStage()
    const bead = el('#toyTune [data-note="3"]')
    pointer(bead, 'pointerdown', 200)
    pointer(bead, 'pointermove', 170)
    pointer(bead, 'pointerup', 170)

    // Act: the click that drag ends on, then a plain one
    bead.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }))
    vi.advanceTimersByTime(100)
    const afterDrag = heard.length
    pointer(bead, 'pointerdown', 200)
    pointer(bead, 'pointerup', 200)
    bead.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }))
    vi.advanceTimersByTime(100)

    // Assert
    expect(afterDrag).toBe(0)
    expect(heard.map((v) => v.midi)).toEqual([67])
  })
})
