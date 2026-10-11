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
