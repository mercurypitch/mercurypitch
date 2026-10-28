// ============================================================
// TourChip, floating: where it stands, in which form, by what name
// ============================================================
//
// Given a room, the chip floats where nothing is (chip-float.ts, by
// chip-place.ts's rule). jsdom lays nothing out, so these cases lay a page
// out by hand: a phone's column 390 px wide under a 50 px top bar, with
// controls at given boxes, and the chip as wide as its form. They hold what
// the rule's own tests cannot: the chip takes the form and the spot the rule
// gives, from its anchor or in the window, keeps its whole line as its name
// in every form, and moves when something comes under it.

import { cleanup, render, screen } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Box } from './chip-place'
import { MERC_TOUR_LINE, TourChip } from './TourChip'

const LEGACY = 'New to Leaderboard? Take a quick tour.'
/** Each form's width, as the browser would draw it. */
const WIDTH: Record<string, number> = { full: 300, short: 160, mini: 90 }

const boxes = new WeakMap<Element, Box>()
const realRect = Element.prototype.getBoundingClientRect
const realRects = Range.prototype.getClientRects

const rect = (b: Box): DOMRect =>
  ({
    ...b,
    x: b.left,
    y: b.top,
    width: b.right - b.left,
    height: b.bottom - b.top,
    toJSON: () => b,
  }) as DOMRect

function laidOut(el: HTMLElement, b: Box): HTMLElement {
  boxes.set(el, b)
  Object.defineProperty(el, 'clientWidth', { value: b.right - b.left })
  Object.defineProperty(el, 'clientHeight', { value: b.bottom - b.top })
  return el
}

const chipEl = (): HTMLElement => screen.getByTestId('tour-chip')

/** The chip's box: from its anchor, or the window when it stands in the bar. */
function chipBox(chip: HTMLElement): Box {
  const origin =
    chip.dataset.place === 'bar' || chip.parentElement === null
      ? { left: 0, top: 0 }
      : (boxes.get(chip.parentElement) ?? { left: 0, top: 0 })
  const left = origin.left + Number.parseFloat(chip.style.left || '0')
  const top = origin.top + Number.parseFloat(chip.style.top || '0')
  return {
    left,
    top,
    right: left + WIDTH[chip.dataset.form ?? 'full'],
    bottom: top + 46,
  }
}

beforeEach(() => {
  vi.stubGlobal('matchMedia', () => ({ matches: true }))
  Object.defineProperty(document, 'elementsFromPoint', {
    value: () => [],
    configurable: true,
  })
  Range.prototype.getClientRects = () => [] as unknown as DOMRectList
  Element.prototype.getBoundingClientRect = function (this: Element) {
    if (this instanceof HTMLElement && this.dataset.testid === 'tour-chip') {
      return rect(chipBox(this))
    }
    return rect(boxes.get(this) ?? { left: 0, top: 0, right: 0, bottom: 0 })
  }
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
    configurable: true,
    get(this: HTMLElement) {
      return this.dataset.testid === 'tour-chip'
        ? WIDTH[this.dataset.form ?? 'full']
        : 0
    },
  })
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
    configurable: true,
    get(this: HTMLElement) {
      return this.dataset.testid === 'tour-chip' ? 46 : 0
    },
  })
})

afterEach(() => {
  cleanup()
  document.body.replaceChildren()
  vi.unstubAllGlobals()
  vi.useRealTimers()
  Element.prototype.getBoundingClientRect = realRect
  Range.prototype.getClientRects = realRects
  delete (HTMLElement.prototype as { offsetWidth?: number }).offsetWidth
  delete (HTMLElement.prototype as { offsetHeight?: number }).offsetHeight
  Reflect.deleteProperty(document, 'elementsFromPoint')
})

const box = (
  left: number,
  top: number,
  width: number,
  height: number,
): Box => ({
  left,
  top,
  right: left + width,
  bottom: top + height,
})

function control(parent: HTMLElement, at: Box, name = 'Control'): HTMLElement {
  const button = document.createElement('button')
  button.textContent = name
  parent.append(laidOut(button, at))
  return button
}

/** A phone's page: its top bar (none for `bar: null`), and its column with `blocks` in it. */
function mount(
  blocks: Box[],
  opts: { line?: string; short?: string; bar?: Box[] | null } = {},
): { column: HTMLElement; bar: HTMLElement } {
  const bar = laidOut(document.createElement('header'), box(0, 0, 390, 50))
  for (const at of opts.bar ?? []) control(bar, at)
  const barOf = (): HTMLElement | null => (opts.bar === null ? null : bar)
  const column = laidOut(document.createElement('main'), box(0, 50, 390, 794))
  const slot = laidOut(document.createElement('div'), box(0, 50, 390, 0))
  column.append(slot)
  for (const at of blocks) control(column, at)
  document.body.append(bar, column)
  render(
    () => (
      <TourChip
        line={opts.line}
        short={opts.short}
        room={{ column: () => column, bar: barOf }}
        onStart={vi.fn()}
        onDismiss={vi.fn()}
      />
    ),
    { container: slot },
  )
  return { column, bar }
}

describe('TourChip, floating', () => {
  it('stands whole by the title, from its anchor, named by its line', () => {
    mount([box(16, 64, 50, 30)])

    const chip = chipEl()
    expect(chip.dataset).toMatchObject({ place: 'column', form: 'full' })
    expect(chip.style.left).toBe('78px')
    expect(chip.style.top).toBe('8px')
    const start = screen.getByRole('button', { name: MERC_TOUR_LINE })
    expect(start).not.toHaveAttribute('aria-label')
  })

  it('shrinks to its short line where only that fits, and keeps its line as its name', () => {
    mount([box(16, 64, 173, 31), box(12, 120, 366, 600)], {
      line: LEGACY,
      short: 'Quick tour',
    })

    const chip = chipEl()
    expect(chip.dataset.form).toBe('short')
    expect(chip.style.left).toBe('218px')
    const start = screen.getByRole('button', { name: LEGACY })
    expect(start).toHaveAttribute('aria-label', LEGACY)
    expect(start).toHaveAttribute('title', LEGACY)
    expect(start).toHaveTextContent('Quick tour')
  })

  it('stands in the bar, Merc alone, where the column has no room at all', () => {
    mount([box(12, 58, 366, 700)], {
      bar: [box(62, 15, 111, 20), box(300, 5, 80, 40)],
    })

    const chip = chipEl()
    expect(chip.dataset).toMatchObject({ place: 'bar', form: 'mini' })
    expect(chip.style.left).toBe('206px')
    expect(chip.style.top).toBe('2px')
    expect(
      screen.getByRole('button', { name: MERC_TOUR_LINE }),
    ).toHaveAttribute('aria-label', MERC_TOUR_LINE)
    expect(screen.getByRole('button', { name: 'Not now' })).toBeVisible()
  })

  it('never shrinks to words a line was not given', () => {
    mount([box(16, 64, 173, 31), box(12, 110, 366, 600)], { line: LEGACY })

    expect(chipEl().dataset.form).toBe('mini')
    cleanup()
    document.body.replaceChildren()
    // nowhere free and no bar: whole, said so, where the rule says short
    mount([box(12, 58, 366, 700)], { line: LEGACY, bar: null })

    expect(chipEl().dataset).toMatchObject({
      form: 'full',
      covers: 'something',
    })
    expect(screen.getByRole('button', { name: LEGACY })).not.toHaveAttribute(
      'aria-label',
    )
  })

  it('takes the best spot as the page settles, then keeps one while nothing comes under it', async () => {
    vi.useFakeTimers()
    // a skeleton row loading where the top's free room will be
    const { column } = mount([box(16, 64, 50, 30), box(200, 56, 178, 60)])
    const chip = chipEl()
    expect(chip.style.top).toBe(`${116 + 4 - 50}px`)

    // the skeleton gives way in its first seconds: the chip takes the top
    column.lastElementChild?.remove()
    await vi.advanceTimersByTimeAsync(200)
    expect(chip.style.top).toBe('8px')

    // settled: a list arriving below leaves it be, a row under it moves it
    await vi.advanceTimersByTimeAsync(2000)
    control(column, box(12, 300, 366, 40))
    await vi.advanceTimersByTimeAsync(200)
    expect(chip.style.top).toBe('8px')
    control(column, box(200, 60, 170, 40))
    await vi.advanceTimersByTimeAsync(200)
    expect(chip.style.top).toBe(`${100 + 4 - 50}px`)
  })
})
