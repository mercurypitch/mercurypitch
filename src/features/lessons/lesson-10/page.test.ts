// ============================================================
// Lesson 10's page document — its spoken signs, its references, its order
// ============================================================
//
// learn/10.html is hand-written markup, so some of its promises are held
// here: every ♯ and ♭ its text prints is followed by its spoken name, the
// sign itself hidden from a screen reader, and no accessible name or share
// card carries a sign at all; every id a label or description points at
// exists, once; every button is a button, not a submit; there is no Watch
// section, because Lesson 10 has no film; the page opens on its cold open,
// the recall after it, shown to everyone, and before the four words; the
// hero has its three chips; Play the chord plays freely under the stage,
// and the two moves wait for a choice; Step 5's Major · Minor waits for its
// predict; the practice links carry the lesson; the share card its head
// names is in public/, at its size; and every line of its copy says only
// what the claims check passes (WEB-SPEC, Tests 8). The stage's names, step
// by step, are steps.test.ts's.

import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import { validateGuidedDynamicClaim } from '@/lib/guided-voice/claims'

const PAGE = readFileSync(resolve(process.cwd(), 'learn/10.html'), 'utf8')
const DIR = resolve(process.cwd(), 'src/features/lessons/lesson-10')

/** A sign as the page writes it, however the formatter wraps it: hidden, then said. */
const SPOKEN_SIGN =
  /<span\s+aria-hidden="true"\s*>[♯♭]<\/span\s*>\s*<span\s+class="sr"\s*>\s(?:sharp|flat)<\/span\s*>/g

/** A meta tag's content, however the formatter wraps the tag. */
const metaOf = (property: string): string | undefined =>
  new RegExp(`property="${property}"\\s+content="([^"]*)"`).exec(PAGE)?.[1]

/** A baseline or progressive JPEG's pixel size, from its frame header. */
function jpegSize(bytes: Buffer): { width: number; height: number } {
  let at = 2
  while (at + 8 < bytes.length) {
    const marker = bytes[at + 1]
    const sof =
      marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)
    if (sof)
      return {
        height: bytes.readUInt16BE(at + 5),
        width: bytes.readUInt16BE(at + 7),
      }
    at += 2 + bytes.readUInt16BE(at + 2)
  }
  throw new Error('no JPEG frame header')
}

/** Every value of one attribute, in page order. */
const valuesOf = (attr: string): string[] =>
  Array.from(
    PAGE.matchAll(new RegExp(`\\s${attr}="([^"]*)"`, 'g')),
    (m) => m[1],
  )

/** The page's own modules, tests aside. */
const modules = readdirSync(DIR)
  .filter((f) => f.endsWith('.ts') && !f.includes('.test'))
  .map((f) => readFileSync(resolve(DIR, f), 'utf8'))

const doc = (): Document => new DOMParser().parseFromString(PAGE, 'text/html')

/** An element's words, as a reader meets them. */
const words = (e: Element | null | undefined): string =>
  (e?.textContent ?? '').replace(/\s+/g, ' ').trim()

describe("Lesson 10's page", () => {
  it('follows every ♯ and ♭ it prints with its spoken name', () => {
    // Arrange
    const signs = PAGE.match(/[♯♭]/g) ?? []

    // Act
    const bare = PAGE.replace(SPOKEN_SIGN, '').match(/[♯♭]/g) ?? []

    // Assert
    expect(signs.length).toBeGreaterThan(0)
    expect(bare).toEqual([])
  })

  it('puts no sign in an accessible name or a share card: they are spoken', () => {
    const named = [
      ...valuesOf('aria-label'),
      ...valuesOf('aria-valuetext'),
      ...valuesOf('alt'),
      ...valuesOf('content'),
    ]
    expect(named.length).toBeGreaterThan(0)
    expect(named.filter((v) => /[♯♭]/.test(v))).toEqual([])
  })

  it('points every label and description at an id that exists, once', () => {
    // Arrange
    const ids = valuesOf('id')
    const refs = [
      ...valuesOf('aria-labelledby'),
      ...valuesOf('aria-describedby'),
      ...valuesOf('for'),
    ].flatMap((v) => v.split(/\s+/))

    // Act
    const missing = refs.filter((r) => !ids.includes(r))
    const twice = ids.filter((id, i) => ids.indexOf(id) !== i)

    // Assert
    expect(refs.length).toBeGreaterThan(0)
    expect(missing).toEqual([])
    expect(twice).toEqual([])
  })

  it('makes every button a plain button', () => {
    // Act
    const buttons = Array.from(PAGE.matchAll(/<button\b[^>]*>/g), (m) => m[0])

    // Assert
    expect(buttons.length).toBeGreaterThan(20)
    for (const b of buttons) expect(b, b).toMatch(/type="button"/)
  })

  it('carries no Watch section: Lesson 10 has no film', () => {
    expect(PAGE).not.toMatch(/id="watch"/)
    expect(PAGE).not.toMatch(/<video/)
  })

  it('opens on the hook and the cold open, the recall after it and before the four words', () => {
    // Act: each part's place in the document
    const at = [
      'id="hook"',
      'id="heroStage"',
      'id="predict"',
      'id="recall"',
      'id="words"',
    ].map((s) => PAGE.indexOf(s))

    // Assert: CURIOSITY-MOMENTS § 3.1, as Lessons 2 and 4 to 9 run
    expect(at.every((i) => i > 0)).toBe(true)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
  })

  it('asks the recall of everyone, in a section of its own: Lesson 6 comes first, so it needs no live wrapper', () => {
    // Act
    const hero = /<section class="hero[^"]*"[\s\S]*?<\/section>/.exec(PAGE)?.[0]

    // Assert
    expect(hero).toContain('id="predict"')
    expect(hero).not.toContain('id="recall"')
    expect(PAGE).not.toMatch(/data-if-live/)
    expect(PAGE).toMatch(/<section class="mv" id="recall"/)
  })

  it("names the lesson's three chips: its minutes, Lesson 6 linked, and sound on", () => {
    // Act
    const chips = Array.from(
      doc().querySelectorAll('.hero ul.meta .chip'),
      (c) => [words(c), c.getAttribute('href')].join(' → '),
    )

    // Assert: WEB-SPEC, Sections, item 2
    expect(chips).toEqual([
      '17 minutes → ',
      'After Lesson 6: Intervals: the distance between notes → /learn/06',
      'Sound on → ',
    ])
  })

  it('plays the chord freely under the stage, outside the predict, and keeps the two moves locked until a choice', () => {
    // Arrange
    const page = doc()
    const predict = page.querySelector('#predict')

    // Act
    const plays = Array.from(
      page.querySelectorAll<HTMLButtonElement>('.hero-plays [data-play]'),
      (b) => [
        b.dataset.play,
        words(b),
        b.dataset.free !== undefined,
        b.disabled,
      ],
    )

    // Assert: WEB-SPEC, Toys 3, Cold open
    expect(plays).toEqual([
      ['chord-c', 'Play the chord', true, false],
      ['move-mi', 'Move mi down', false, true],
      ['move-so', 'Move so down', false, true],
    ])
    expect(predict?.querySelectorAll('[data-play]')).toHaveLength(0)
    expect(
      Array.from(predict?.querySelectorAll('.choice') ?? [], (c) => words(c)),
    ).toEqual(['Mi', 'So'])
  })

  it("draws Step 5's Major · Minor disabled, and its two scales locked until a choice", () => {
    // Arrange
    const page = doc()

    // Act
    const quality = Array.from(
      page.querySelectorAll<HTMLButtonElement>('[data-scale-quality] button'),
      (b) => [words(b), b.disabled],
    )
    const scales = Array.from(
      page.querySelectorAll<HTMLButtonElement>('#predictScale [data-play]'),
      (b) => [b.dataset.play, b.disabled],
    )

    // Assert: WEB-SPEC, Toys 1, Scale, and Toys 3, Step 5
    expect(quality).toEqual([
      ['Major', true],
      ['Minor', true],
    ])
    expect(scales).toEqual([
      ['scale-major', true],
      ['scale-minor', true],
    ])
  })

  it('links every practice drill with the lesson, before any hash', () => {
    // Act
    const links = valuesOf('href').filter((h) =>
      /^\/(pitch-training|ear-lab|exercises)/.test(h),
    )

    // Assert: Drone Intonation and Ear Lab's Stack, on the card and in the footer
    expect(new Set(links)).toEqual(
      new Set(['/pitch-training?lesson=10', '/ear-lab?lesson=10']),
    )
    for (const h of links) expect(h, h).toMatch(/[?&]lesson=10(?:#|$)/)
  })

  it('reads no draft switch: the page state decides (kit/drafts.ts)', () => {
    expect(modules.length).toBeGreaterThan(0)
    for (const m of modules)
      expect(m).not.toMatch(/DRAFT_LESSONS|DRAFTS_SHOWN|import\.meta\.env/)
  })

  it('names a share card that is in public/, at the size its head gives', () => {
    // Arrange
    const image = metaOf('og:image')?.replace('https://mercurypitch.com/', '')

    // Act
    const size = jpegSize(
      readFileSync(resolve(process.cwd(), 'public', image ?? '')),
    )

    // Assert
    expect(image).toBe('learn/lesson-10-og.jpg')
    expect([size.width, size.height].map(String)).toEqual([
      metaOf('og:image:width'),
      metaOf('og:image:height'),
    ])
    expect([size.width, size.height]).toEqual([1200, 630])
  })

  it('says only what the claims check passes, in every line of its copy', () => {
    // Arrange: the page's text as a reader meets it, block by block
    const blocks = Array.from(
      doc().querySelectorAll(
        'main :is(p, li, h1, h2, h3, h4, button, blockquote, summary, figcaption)',
      ),
      (e) => words(e),
    ).filter((t) => t !== '')

    // Assert
    expect(blocks.length).toBeGreaterThan(150)
    for (const text of blocks)
      expect(
        validateGuidedDynamicClaim({ surface: 'finding', text }).violations,
        text,
      ).toEqual([])
  })
})
