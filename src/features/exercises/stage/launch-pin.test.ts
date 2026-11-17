// ============================================================
// The launch button in its sheet: pinned only with something beyond it,
// and a sheet stacked only where its own layout would hide it
// ============================================================

import { afterEach, describe, expect, it, vi } from 'vitest'
import type { LaunchPinMeasure } from './launch-pin'
import { launchFits, launchPin, watchLaunchPin } from './launch-pin'

/** A sheet from 200 to 700 px with a 56 px button in it. */
const sheet = (over: Partial<LaunchPinMeasure>): LaunchPinMeasure => ({
  sheetTop: 200,
  sheetBottom: 700,
  buttonTop: 400,
  buttonBottom: 456,
  scrolled: 0,
  remaining: 0,
  ...over,
})

describe('where the launch button is pinned', () => {
  it('is nowhere at rest, in a sheet that holds all it has', () => {
    expect(launchPin(sheet({}))).toBeNull()
    // At the foot of a short sheet with nothing below is still at rest.
    expect(launchPin(sheet({ buttonTop: 634, buttonBottom: 690 }))).toBeNull()
  })

  it('is the foot while it stands there and more lies below', () => {
    expect(
      launchPin(sheet({ buttonTop: 634, buttonBottom: 690, remaining: 168 })),
    ).toBe('bottom')
  })

  it('is at rest again once the sheet has scrolled it back into its place', () => {
    expect(
      launchPin(
        sheet({
          buttonTop: 520,
          buttonBottom: 576,
          scrolled: 90,
          remaining: 78,
        }),
      ),
    ).toBeNull()
  })

  it('is the top while it stands there and some has scrolled past', () => {
    expect(
      launchPin(
        sheet({
          buttonTop: 210,
          buttonBottom: 266,
          scrolled: 240,
          remaining: 0,
        }),
      ),
    ).toBe('top')
    // Standing at the top of a sheet that has not scrolled is at rest.
    expect(launchPin(sheet({ buttonTop: 210, buttonBottom: 266 }))).toBeNull()
  })

  it('takes a sub-pixel of slack at either edge, and no more than that', () => {
    expect(
      launchPin(
        sheet({ buttonTop: 633.4, buttonBottom: 689.4, remaining: 40 }),
      ),
    ).toBe('bottom')
    expect(
      launchPin(sheet({ buttonTop: 630, buttonBottom: 686, remaining: 40 })),
    ).toBeNull()
  })
})

describe('whether a sheet shows its launch before any scroll', () => {
  it('does while the launch ends inside the sheet, to the pixel', () => {
    expect(launchFits({ sheetHeight: 698, launchBottom: 560 })).toBe(true)
    expect(launchFits({ sheetHeight: 698, launchBottom: 698 })).toBe(true)
    // A sub-pixel of rounding is not a scroll.
    expect(launchFits({ sheetHeight: 698, launchBottom: 698.6 })).toBe(true)
  })

  it('does not once any of it is under the fold', () => {
    expect(launchFits({ sheetHeight: 698, launchBottom: 700 })).toBe(false)
    // Sing It in Time's Try Again at 1440 x 900, as the dev site had it.
    expect(launchFits({ sheetHeight: 698, launchBottom: 990 })).toBe(false)
  })
})

// ── The watcher, on a sheet whose boxes the test lays out ─────────────

interface Box {
  top: number
  bottom: number
}

const rect = (box: Box): DOMRect =>
  ({
    top: box.top,
    bottom: box.bottom,
    left: 0,
    right: 800,
    x: 0,
    y: box.top,
    width: 800,
    height: box.bottom - box.top,
    toJSON: () => box,
  }) as DOMRect

interface Laid {
  sheet: HTMLElement
  scrim: HTMLElement
  /** How many times the sheet was put back in its own layout to be asked. */
  asked: () => number
  /** What the two layouts hold from now on, and a look by the watcher. */
  lay: (to: {
    /** The launch group's box in the sheet's own layout. */
    own: Box
    /** The button's box once the sheet is stacked. */
    stacked: Box
    /** How far the stacked sheet can still scroll. */
    remaining?: number
    /** What told the watcher: a new size, or something new in the sheet. */
    by?: 'resize' | 'change'
  }) => void
  /** A result arrives in the sheet, or goes. */
  result: (shown: boolean) => void
  stop: () => void
}

/** A sheet from 100 to 800 px (700 tall), wide or a phone's. */
function sheetOn(phone: boolean): Laid {
  vi.stubGlobal(
    'matchMedia',
    (query: string): MediaQueryList =>
      ({
        matches: phone,
        media: query,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      }) as unknown as MediaQueryList,
  )
  const sheet = document.createElement('div')
  sheet.innerHTML = `
    <div class="exercise-idle-center">
      <div class="exercise-launch-scrim"></div>
      <div class="exercise-idle-body">
        <div class="exercise-idle-setup"></div>
        <div class="exercise-idle-launch">
          <button class="exercise-idle-start"></button>
        </div>
      </div>
    </div>`
  document.body.append(sheet)
  const find = (selector: string): HTMLElement => {
    const found = sheet.querySelector<HTMLElement>(selector)
    if (found === null) throw new Error(`no ${selector}`)
    return found
  }
  const scrim = find('.exercise-launch-scrim')
  const group = find('.exercise-idle-launch')
  const button = find('.exercise-idle-start')
  const center = find('.exercise-idle-center')
  let own: Box = { top: 400, bottom: 510 }
  let stacked: Box = { top: 300, bottom: 356 }
  let remaining = 0
  let asked = 0
  const isStacked = (): boolean => sheet.hasAttribute('data-stacked')
  sheet.getBoundingClientRect = () => rect({ top: 100, bottom: 800 })
  Object.defineProperty(sheet, 'clientHeight', { value: 700 })
  Object.defineProperty(sheet, 'scrollHeight', {
    get: () => 700 + (isStacked() || phone ? remaining : 0),
  })
  // In its own layout the group is a box and the button stands in it; a
  // stacked sheet (or a phone's) gives the group no box of its own.
  group.getBoundingClientRect = () => {
    if (isStacked() || phone) return rect({ top: 0, bottom: 0 })
    asked += 1
    return rect(own)
  }
  button.getBoundingClientRect = () =>
    rect(isStacked() || phone ? stacked : { ...own, bottom: own.top + 56 })
  const stop = watchLaunchPin(sheet)
  const look = (by: 'resize' | 'change'): void => {
    if (by === 'resize') window.dispatchEvent(new Event('resize'))
    else sheet.dispatchEvent(new Event('scroll'))
    // The style sheet makes the button sticky in a stacked sheet and on a
    // phone; here the test stands in for it before the watcher reads.
    button.style.position = isStacked() || phone ? 'sticky' : ''
    vi.runAllTimers()
    button.style.position = isStacked() || phone ? 'sticky' : ''
    // A sheet stacked in that look is read again at its next change.
    sheet.dispatchEvent(new Event('scroll'))
    vi.runAllTimers()
  }
  return {
    sheet,
    scrim,
    asked: () => asked,
    stop,
    lay: (to) => {
      own = to.own
      stacked = to.stacked
      remaining = to.remaining ?? 0
      look(to.by ?? 'change')
    },
    result: (shown) => {
      const card = sheet.querySelector('.exercise-result-card')
      if (shown && card === null) {
        const made = document.createElement('div')
        made.className = 'exercise-result-card'
        center.prepend(made)
      } else if (!shown) card?.remove()
    },
  }
}

describe('the watcher', () => {
  let laid: Laid | null = null
  afterEach(() => {
    laid?.stop()
    laid?.sheet.remove()
    laid = null
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })
  const start = (phone = false): Laid => {
    vi.useFakeTimers({
      toFake: ['requestAnimationFrame', 'cancelAnimationFrame'],
    })
    laid = sheetOn(phone)
    return laid
  }

  it('leaves a sheet that shows its launch as it is', () => {
    const { sheet, scrim, lay } = start()
    lay({ own: { top: 500, bottom: 610 }, stacked: { top: 300, bottom: 356 } })
    expect(sheet.hasAttribute('data-stacked')).toBe(false)
    expect(scrim.hasAttribute('data-pinned')).toBe(false)
    expect(sheet.hasAttribute('data-measuring')).toBe(false)
  })

  it('stacks a sheet whose own layout puts the launch under the fold', () => {
    const { sheet, scrim, lay } = start()
    // The group ends 240 px under the sheet's foot (800). Stacked, the
    // button stands under the result, in sight, with more below.
    lay({
      own: { top: 930, bottom: 1040 },
      stacked: { top: 620, bottom: 676 },
      remaining: 300,
    })
    expect(sheet.hasAttribute('data-stacked')).toBe(true)
    expect(sheet.hasAttribute('data-measuring')).toBe(false)
    // In sight and not at the foot: at rest, no band.
    expect(scrim.hasAttribute('data-pinned')).toBe(false)
  })

  it('marks the foot of a stacked sheet while the button is held there', () => {
    const { sheet, scrim, lay } = start()
    lay({
      own: { top: 930, bottom: 1040 },
      // 10 px over the sheet's foot, where the style sheet holds it.
      stacked: { top: 734, bottom: 790 },
      remaining: 300,
    })
    expect(sheet.hasAttribute('data-stacked')).toBe(true)
    expect(scrim.getAttribute('data-pinned')).toBe('bottom')
  })

  it('asks a stacked sheet again only for a new size or a result come or gone', () => {
    const { sheet, lay, asked, result } = start()
    const tall = {
      own: { top: 930, bottom: 1040 },
      stacked: { top: 620, bottom: 676 },
      remaining: 300,
    }
    lay(tall)
    expect(sheet.hasAttribute('data-stacked')).toBe(true)
    const before = asked()
    // Something in the sheet changes: its own layout is not put back.
    lay(tall)
    lay(tall)
    expect(asked()).toBe(before)
    // A new size: asked once more, and still too short.
    lay({ ...tall, by: 'resize' })
    expect(asked()).toBe(before + 1)
    expect(sheet.hasAttribute('data-stacked')).toBe(true)
    // The result goes, and the sheet's own layout shows the launch again.
    result(true)
    lay(tall)
    result(false)
    lay({ ...tall, own: { top: 500, bottom: 610 } })
    expect(sheet.hasAttribute('data-stacked')).toBe(false)
  })

  it('unstacks a sheet a larger window has given room', () => {
    const { sheet, scrim, lay } = start()
    lay({
      own: { top: 930, bottom: 1040 },
      stacked: { top: 734, bottom: 790 },
      remaining: 300,
    })
    expect(scrim.getAttribute('data-pinned')).toBe('bottom')
    lay({
      own: { top: 560, bottom: 670 },
      stacked: { top: 734, bottom: 790 },
      by: 'resize',
    })
    expect(sheet.hasAttribute('data-stacked')).toBe(false)
    expect(scrim.hasAttribute('data-pinned')).toBe(false)
  })

  it('never stacks a phone, whose sheet the style sheet stacks itself', () => {
    const { sheet, scrim, lay } = start(true)
    lay({
      own: { top: 930, bottom: 1040 },
      stacked: { top: 734, bottom: 790 },
      remaining: 300,
    })
    expect(sheet.hasAttribute('data-stacked')).toBe(false)
    // The button is pinned there all the same, and the scrim marked.
    expect(scrim.getAttribute('data-pinned')).toBe('bottom')
  })

  it('takes its marks with it when it stops', () => {
    const { sheet, lay, stop } = start()
    lay({
      own: { top: 930, bottom: 1040 },
      stacked: { top: 620, bottom: 676 },
      remaining: 300,
    })
    expect(sheet.hasAttribute('data-stacked')).toBe(true)
    stop()
    expect(sheet.hasAttribute('data-stacked')).toBe(false)
  })
})
