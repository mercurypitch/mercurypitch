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
// rest, and every hover effect needs a pointer that can hover). The file
// reads the whole sheet, so it also holds the rules of First Light's frame that
// the plan's beat reads (the bottom of the file).

import { cleanup, fireEvent, render } from '@solidjs/testing-library'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MirrorResult } from '@/lib/mirror/metrics'
import { setPracticeScope, setUiMode } from '@/stores/settings-store'
import { ROOMS, SIDE_DOORS } from '../rooms'
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

// Owner testing, 11 Oct 2026: eight doors wrapped to three rows on a phone.
describe("the Map's side doors", () => {
  afterEach(cleanup)

  it('offers four doors, the Voice Mirror among them, each opening its room', () => {
    // Arrange
    const onEnter = vi.fn()
    const { container } = render(() => (
      <BeatMap
        voiceprint={null}
        onEnter={onEnter}
        onTour={() => {}}
        onDone={() => {}}
      />
    ))
    const doors = [
      ...container.querySelectorAll<HTMLButtonElement>(
        '[data-side-doors] button',
      ),
    ]

    // Act
    for (const door of doors) fireEvent.click(door)

    // Assert
    expect(doors.map((door) => door.textContent)).toEqual([
      'Challenges',
      'Guitar',
      'Piano',
      'Voice Mirror',
    ])
    expect(onEnter.mock.calls).toEqual(
      SIDE_DOORS.map((door) => [door.target, door.id]),
    )
  })

  it('gives every door a 44 px tap target on a phone', () => {
    const phoneDoor = RULES.find(
      (rule) =>
        rule.selector === '.sideDoor' &&
        rule.at.includes('@media (max-width: 640px)'),
    )

    expect(phoneDoor?.body).toMatch(/min-height:\s*44px/)
  })
})

// The plan can narrow the menu to one instrument (its switch), and "See every
// room" then opens this grid: a card or a door for a tab the menu has hidden
// would open a room the person cannot reach from anywhere else.
describe("the Map and the person's menu", () => {
  const WOBBLY = {
    range: null,
    accuracy: null,
    steadiness: { score: 40 },
  } as unknown as MirrorResult

  afterEach(() => {
    cleanup()
    setPracticeScope('all')
    setUiMode('advanced')
  })

  function mapOf(voiceprint: MirrorResult | null = null): HTMLElement {
    return render(() => (
      <BeatMap
        voiceprint={voiceprint}
        onEnter={() => {}}
        onTour={() => {}}
        onDone={() => {}}
      />
    )).container
  }

  const rooms = (map: HTMLElement): (string | null)[] =>
    [...map.querySelectorAll('[data-room]')].map((card) =>
      card.getAttribute('data-room'),
    )

  const doors = (map: HTMLElement): (string | null)[] =>
    [...map.querySelectorAll('[data-side-doors] button')].map(
      (door) => door.textContent,
    )

  it('shows every room and door while the menu shows every tab', () => {
    const map = mapOf()

    expect(rooms(map).sort()).toEqual(ROOMS.map((room) => room.id).sort())
    expect(doors(map)).toEqual(SIDE_DOORS.map((door) => door.label))
  })

  it('leaves out rooms the menu hides', () => {
    // Arrange: guitar's menu has no Practice, no Jam, and no Karaoke tab.
    setPracticeScope('guitar')

    // Act
    const map = mapOf()

    // Assert: the Karaoke room is a page, but it stands for the Karaoke tab.
    expect(rooms(map)).not.toContain('practice')
    expect(rooms(map)).not.toContain('jam')
    expect(rooms(map)).not.toContain('karaoke')
    expect(rooms(map)).toContain('ascent')
  })

  it('leaves out the doors the menu hides, and keeps the one with no tab', () => {
    setPracticeScope('guitar')

    const map = mapOf()

    expect(doors(map)).toEqual(['Guitar', 'Voice Mirror'])
  })

  it("follows Simple mode's smaller menu", () => {
    setUiMode('simple')

    const map = mapOf()

    expect(rooms(map)).toEqual(
      expect.arrayContaining(['practice', 'exercises', 'ascent']),
    )
    expect(rooms(map)).not.toContain('karaoke')
    expect(rooms(map)).not.toContain('jam')
    expect(rooms(map)).not.toContain('analysis')
  })

  it('brings the rooms back when the menu does', () => {
    setPracticeScope('guitar')
    const map = mapOf()
    expect(rooms(map)).not.toContain('practice')

    setPracticeScope('all')

    expect(rooms(map)).toContain('practice')
    expect(rooms(map)).toContain('karaoke')
  })

  it('names no first stop in a room the menu has hidden', () => {
    // Arrange: a wobbly voiceprint sends a singer to Exercises, which
    // guitar's menu does not have.
    setPracticeScope('guitar')

    // Act
    const map = mapOf(WOBBLY)

    // Assert
    expect(rooms(map)).not.toContain('exercises')
    expect(map).not.toHaveTextContent('Your first stop')
  })

  it('still names the first stop in a room the menu keeps', () => {
    setPracticeScope('singing')

    const map = mapOf(WOBBLY)

    expect(rooms(map)[0]).toBe('exercises')
    expect(map).toHaveTextContent('Your first stop')
  })
})

// The plan's beat (the four questions and the plan, BeatPlan) is a direct
// child of First Light's frame and carries `data-beat="questions"`. On a phone
// the frame gives its bottom padding up to it, as it does to the twin's: the
// screens own the room under their last row, the home indicator's inset
// included, and the box adds none (BeatPlan.module.css). The beat standing
// directly in the frame is pinned in FirstLight.plan.test.tsx. The frame also
// lends the screens its padding beside and below the box, which it never
// clips, so a glow by the box's edge fades out there (PlanExits.tsx). A lend is
// the padding it lends, so it is read against the frame's padding at each
// width, not pinned as a second copy of the number.
describe("First Light's frame, while the plan is up", () => {
  const PHONE = '@media (max-width: 640px)'
  const reads = RULES.filter((rule) =>
    rule.selector.includes("[data-beat='questions']"),
  )
  const body = (rule: Rule): string => rule.body.replace(/\s+/g, ' ').trim()
  // The frame's own rules. The beat's (`reads`) are the more specific selector,
  // so what they set wins over these at any width.
  const frames = RULES.filter((rule) => rule.selector === '.frame')

  /** The four sides of a `padding` of one to four values, as CSS reads them. */
  function sides(value: string): Record<string, string> {
    const [top, right = top, bottom = top, left = right, ...more] =
      value.split(' ')
    if (more.length > 0) throw new Error(`Cannot read the padding "${value}"`)
    return {
      'padding-top': top,
      'padding-right': right,
      'padding-bottom': bottom,
      'padding-left': left,
    }
  }

  /** What the rules leave each property, later over earlier, with `padding` spelt out by side. */
  function cascade(rules: Rule[]): Record<string, string> {
    const settled: Record<string, string> = {}
    for (const rule of rules) {
      for (const declaration of body(rule).split(';')) {
        const colon = declaration.indexOf(':')
        if (colon < 1) continue
        const property = declaration.slice(0, colon).trim()
        const value = declaration.slice(colon + 1).trim()
        Object.assign(
          settled,
          property === 'padding' ? sides(value) : { [property]: value },
        )
      }
    }
    return settled
  }

  /** A plain length in px, where `0` is one too. A calc() or a var() is not, and throws. */
  function px(value: string | undefined): number {
    if (value === '0') return 0
    const found = /^(-?\d+(?:\.\d+)?)px$/.exec(value ?? '')
    if (found === null) throw new Error(`"${value}" is not a plain px length`)
    return Number(found[1])
  }

  it('lends its padding, gives up its bottom padding on a phone, and does nothing else', () => {
    expect(reads.map((rule) => [rule.selector, rule.at])).toEqual([
      [".frame:has(> [data-beat='questions'])", []],
      [".frame:has(> [data-beat='questions'])", [PHONE]],
    ])
    expect(reads.map(body)).toEqual([
      '--pc-overhang-side: 22px; --pc-overhang-end: 40px;',
      'padding-bottom: 0; --pc-overhang-end: 0px;',
    ])
  })

  it.each<[string, string[]]>([
    ['wider than a phone', []],
    ['on a phone', [PHONE]],
  ])(
    'lends exactly the padding it has beside and below the box, %s',
    (_width, widths) => {
      const frame = cascade(
        [...frames, ...reads].filter((rule) =>
          rule.at.every((atRule) => widths.includes(atRule)),
        ),
      )
      const padding = {
        left: px(frame['padding-left']),
        right: px(frame['padding-right']),
        bottom: px(frame['padding-bottom']),
      }

      // One lend serves both sides, so the narrower side is all it can be.
      expect({
        side: px(frame['--pc-overhang-side']),
        end: px(frame['--pc-overhang-end']),
      }).toEqual({
        side: Math.min(padding.left, padding.right),
        end: padding.bottom,
      })
    },
  )

  it("changes the frame's padding at no width but the phone's, so no width goes unread", () => {
    const elsewhere = frames.filter(
      (rule) =>
        rule.at.some((atRule) => atRule !== PHONE) &&
        rule.body.includes('padding'),
    )

    expect(elsewhere.map(body)).toEqual([])
  })

  it("gives it up on a phone only, in the width the twin's rule gives its own", () => {
    const twin = RULES.find(
      (rule) => rule.selector === '.frame:has(> .twinBeat)',
    )

    expect(reads[1].at).toEqual([PHONE])
    expect(twin?.at).toEqual([PHONE])
  })
})
