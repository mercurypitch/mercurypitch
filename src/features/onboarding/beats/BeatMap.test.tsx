// ============================================================
// The Map without hover (owner decision V5)
// ============================================================
//
// The Map's cards used to show each room's interface blurred and dimmed
// until a pointer hovered it, behind a scroll-in reveal. A phone has no
// pointer to hover with, so on touch the art never came forward at all.
// Each card now wears its room's cover in full from the first frame.
// These tests hold both halves of that: the markup (nothing waits on a
// pointer or an observer) and the stylesheet (nothing dims the cover at
// rest, and every hover effect needs a pointer that can hover).

import { cleanup, fireEvent, render } from '@solidjs/testing-library'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ROOMS } from '../rooms'
import { BeatMap, ROOM_COVER_SIZES } from './BeatMap'

const CSS = readFileSync(
  resolve(process.cwd(), 'src/features/onboarding/onboarding.module.css'),
  'utf8',
)

interface Rule {
  selector: string
  body: string
  /** The at-rules it sits inside, outermost first. */
  at: string[]
}

/** The index just past the brace that closes the one at `open`. */
function closing(src: string, open: number): number {
  let depth = 0
  for (let j = open; j < src.length; j++) {
    if (src[j] === '{') depth++
    else if (src[j] === '}' && --depth === 0) return j + 1
  }
  return src.length
}

/** Style rules with the at-rules around them. Enough for this file. */
function parseRules(css: string): Rule[] {
  const src = css.replace(/\/\*[\s\S]*?\*\//g, '')
  const rules: Rule[] = []
  const stack: string[] = []
  let head = ''
  let i = 0
  while (i < src.length) {
    const ch = src[i]
    const name = head.trim()
    if (ch === '{' && name.startsWith('@')) {
      stack.push(name)
      head = ''
      i++
    } else if (ch === '{') {
      const end = closing(src, i)
      rules.push({
        selector: name,
        body: src.slice(i + 1, end - 1),
        at: [...stack],
      })
      head = ''
      i = end
    } else {
      if (ch === '}') stack.pop()
      head = ch === '}' || ch === ';' ? '' : head + ch
      i++
    }
  }
  return rules
}

const RULES = parseRules(CSS)

const touches = (rule: Rule, ...names: string[]): boolean =>
  names.some((name) => new RegExp(`\\.${name}\\b`).test(rule.selector))

describe('the Map cards, at rest', () => {
  let observers = 0

  beforeEach(() => {
    observers = 0
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor() {
          observers++
        }
        observe(): void {}
        unobserve(): void {}
        disconnect(): void {}
      },
    )
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it("shows every room's cover from the first frame, with nothing to wait for", () => {
    const { container } = render(() => (
      <BeatMap
        voiceprint={null}
        onEnter={() => {}}
        onTour={() => {}}
        onDone={() => {}}
      />
    ))

    for (const room of ROOMS) {
      const img = container.querySelector<HTMLImageElement>(
        `[data-room="${room.id}"] img`,
      )
      expect(img, `no cover on ${room.id}`).not.toBeNull()
      expect(img?.getAttribute('src')).toBe(room.cover.small)
      expect(img?.getAttribute('srcset')).toContain(`${room.cover.src} 1672w`)
      expect(img?.getAttribute('sizes')).toBe(ROOM_COVER_SIZES)
    }
    expect(observers).toBe(0)
  })

  it('looks the same before and after a pointer passes over a card', () => {
    // Arrange
    const { container } = render(() => (
      <BeatMap
        voiceprint={null}
        onEnter={() => {}}
        onTour={() => {}}
        onDone={() => {}}
      />
    ))
    const card = container.querySelector<HTMLElement>('[data-room="karaoke"]')
    const before = card?.outerHTML

    // Act
    if (card !== null) {
      fireEvent.pointerEnter(card)
      fireEvent.mouseEnter(card)
      fireEvent.mouseOver(card)
      fireEvent.focus(card)
    }

    // Assert
    expect(card?.outerHTML).toBe(before)
  })
})

describe('the Map stylesheet', () => {
  it('never blurs, dims or hides a cover', () => {
    const coverRules = RULES.filter((rule) =>
      touches(rule, 'roomCover', 'roomCoverImg'),
    )

    expect(coverRules.length).toBeGreaterThan(0)
    for (const rule of coverRules) {
      expect(rule.body, rule.selector).not.toMatch(
        /(^|[\s;])(filter|opacity|visibility)\s*:/,
      )
    }
  })

  it('keeps every card hover effect behind a pointer that can hover', () => {
    // On touch, :hover sticks to whatever was tapped last, so an
    // unguarded hover rule leaves a lifted card behind on a phone.
    const hovers = RULES.filter(
      (rule) =>
        rule.selector.includes(':hover') &&
        touches(rule, 'roomCard', 'roomCover', 'roomTour', 'roomBody'),
    )

    expect(hovers.length).toBeGreaterThan(0)
    for (const rule of hovers) {
      // A rule that only switches an effect off (reduced motion's
      // `transform: none`) is not an effect, and is safe on touch.
      const declarations = rule.body
        .split(';')
        .map((d) => d.trim())
        .filter((d) => d.length > 0)
      if (declarations.every((d) => /:\s*none$/.test(d))) continue
      expect(
        rule.at.some((at) => at.includes('(hover: hover)')),
        rule.selector,
      ).toBe(true)
    }
  })

  it('sizes the desktop covers to the columns the grid actually runs', () => {
    // Arrange: the grid's own numbers, read from the stylesheet.
    const px = (selector: string, pattern: RegExp): number => {
      const rule = RULES.find(
        (r) => r.selector === selector && r.at.length === 0,
      )
      return Number(pattern.exec(rule?.body ?? '')?.[1])
    }
    const min = px('.mapGrid', /minmax\((\d+)px/)
    const gap = px('.mapGrid', /gap:\s*(\d+)px/)
    const beat = px('.beatWide', /max-width:\s*(\d+)px/)
    const pad = px('.frame', /padding:\s*\d+px\s+(\d+)px/)
    /** A card's width at this window width, as the grid lays it out. */
    const card = (vw: number): number => {
      const width = Math.min(beat, vw - 2 * pad)
      const columns = Math.max(1, Math.floor((width + gap) / (min + gap)))
      return (width - gap * (columns - 1)) / columns
    }
    /** The slot `sizes` names at this window width. */
    const slot = (vw: number): number => {
      for (const part of ROOM_COVER_SIZES.split(/,\s*(?![^(]*\))/)) {
        const query = /^\(max-width:\s*(\d+)px\)\s+(.*)$/.exec(part)
        if (query !== null && vw > Number(query[1])) continue
        const value = query?.[2] ?? part
        const calc = /calc\(\(100vw - (\d+)px\) \/ (\d+)\)/.exec(value)
        if (calc !== null) return (vw - Number(calc[1])) / Number(calc[2])
        const share = /^(\d+)vw$/.exec(value)
        if (share !== null) return (vw * Number(share[1])) / 100
        return Number(/(\d+)px/.exec(value)?.[1])
      }
      return Number.NaN
    }

    // Act + Assert: every desktop width, two columns and three.
    for (let vw = 641; vw <= 1600; vw++) {
      expect(Math.abs(slot(vw) - card(vw)), `at ${vw}px`).toBeLessThanOrEqual(2)
    }
  })

  it('offers a 2x laptop a cover smaller than the master', () => {
    // Arrange
    render(() => (
      <BeatMap
        voiceprint={null}
        onEnter={() => {}}
        onTour={() => {}}
        onDone={() => {}}
      />
    ))

    // Act
    const srcset =
      document.querySelector('[data-room] img')?.getAttribute('srcset') ?? ''
    const widths = [...srcset.matchAll(/\s(\d+)w/g)].map((m) => Number(m[1]))

    // Assert: the widest desktop card is under 400 px, so 800 covers it
    // at twice the density without fetching the 1672 px master.
    expect(widths).toEqual([560, 800, 1672])
  })

  it('sizes the phone cover the same in the stylesheet and in sizes', () => {
    const [query, width] =
      /^(\([^)]*\))\s+(\d+)px/.exec(ROOM_COVER_SIZES)?.slice(1) ?? []

    const phoneCover = RULES.find(
      (rule) =>
        rule.selector === '.roomCover' && rule.at.includes(`@media ${query}`),
    )
    expect(query).toBe('(max-width: 640px)')
    expect(phoneCover?.body).toMatch(new RegExp(`width:\\s*${width}px`))
  })
})
