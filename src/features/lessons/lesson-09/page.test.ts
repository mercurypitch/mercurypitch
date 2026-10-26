// ============================================================
// Lesson 9's page document — its references, its order, its promises
// ============================================================
//
// learn/09.html is hand-written markup, so some of its promises are held
// here: no sharp or flat sign in the markup (a note with one, such as mi
// over D3, is spelled by a script, with its spoken word); every id a label
// or description points at exists, once; every button is a button, not a
// submit; there is no Watch section, because Lesson 9 has no film; the page
// opens on its cold open, with Merc's leap as the predict's free play, the
// recall after it, shown to everyone, and before the four words; the
// practice links carry the lesson; the Wrap's recap and cards, the section
// heads and the footer's lines are LESSON.md's, word for word; free play's
// controls have names no other control on the page has; the next card's
// mark holds only the tease's still, with no button; the share card its
// head names is in public/, at its size; and every line of its copy says
// only what the claims check passes (WEB-SPEC, Tests 8). The stage's names,
// step by step, are steps.test.ts's.

import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import { validateGuidedDynamicClaim } from '@/lib/guided-voice/claims'

const PAGE = readFileSync(resolve(process.cwd(), 'learn/09.html'), 'utf8')
const DIR = resolve(process.cwd(), 'src/features/lessons/lesson-09')

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

describe("Lesson 9's page", () => {
  it('prints no sharp or flat sign in its markup: a note with one is spelled by a script', () => {
    expect(PAGE.match(/[♯♭]/gu)).toBeNull()
  })

  it('points every label and description at an id that exists, once', () => {
    // Arrange
    const ids = valuesOf('id')
    const refs = [
      ...valuesOf('aria-labelledby'),
      ...valuesOf('aria-describedby'),
      ...valuesOf('for'),
    ].flatMap((v) => v.split(/\s+/))

    // Assert
    expect(ids.filter((id, i) => ids.indexOf(id) !== i)).toEqual([])
    for (const ref of refs) expect(ids, ref).toContain(ref)
  })

  it('makes every button a plain button', () => {
    // Act
    const buttons = Array.from(PAGE.matchAll(/<button\b[^>]*>/g), (m) => m[0])

    // Assert
    expect(buttons.length).toBeGreaterThan(20)
    for (const b of buttons) expect(b, b).toMatch(/type="button"/)
  })

  it('carries no Watch section: Lesson 9 has no film', () => {
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

    // Assert: CURIOSITY-MOMENTS § 3.1, as Lessons 2 and 4 to 8 run
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

  it("plays Merc's leap freely inside the predict, and keeps its three paths locked until a choice", () => {
    // Arrange
    const predict = doc().querySelector('#predict')

    // Act
    const free = predict?.querySelectorAll('[data-play][data-free]')
    const paths = Array.from(
      predict?.querySelectorAll<HTMLButtonElement>(
        '[data-play]:not([data-free])',
      ) ?? [],
    )

    // Assert: WEB-SPEC, Toys 2
    expect(Array.from(free ?? [], (b) => b.getAttribute('data-play'))).toEqual([
      'leap',
    ])
    expect(paths.map((b) => [b.dataset.play, b.disabled])).toEqual([
      ['re', true],
      ['mi', true],
      ['fa', true],
    ])
  })

  it('links every practice drill with the lesson', () => {
    // Act
    const links = valuesOf('href').filter((h) =>
      /^\/(pitch-training|exercises)/.test(h),
    )

    // Assert
    expect(links.length).toBeGreaterThanOrEqual(2)
    for (const h of links) expect(h, h).toMatch(/[?&]lesson=09(?:#|$)/)
  })

  it("carries the Wrap's words, its section heads and its footer as LESSON.md writes them", () => {
    // Arrange: LESSON.md flat, its bold marks gone and its quotes as the page sets them
    const flat = (t: string | null | undefined): string =>
      (t ?? '').replace(/\s+/g, ' ').replace(/[“”]/g, '"').trim()
    const lesson = flat(
      readFileSync(
        resolve(
          process.cwd(),
          'docs/plans/find-your-pitch/lessons/09-landing-a-leap/LESSON.md',
        ),
        'utf8',
      ),
    ).replace(/\*\*/g, '')
    const page = doc()
    // the footer's lines LESSON.md gives word for word; the fonts line is Lesson 1's
    const footer = [
      'Season 1 · Lesson 09 · Landing a leap',
      'mercurypitch.com/pitch-training',
      'Arpeggio Jumper and Interval Trainer are free.',
      'Every sound on this page is synthesised in your browser.',
    ]

    // Act
    const words = [
      ...page.querySelectorAll('#wrap .recap li'),
      ...page.querySelectorAll('#practiseCard [data-ending] p'),
      ...page.querySelectorAll('.mv-tempo, .mv-title'),
    ].map((e) => flat(e.textContent))
    const printed = flat(page.querySelector('footer')?.textContent)

    // Assert
    expect(words.length).toBeGreaterThan(15)
    expect(words.filter((w) => !lesson.includes(w))).toEqual([])
    expect(footer.filter((w) => !lesson.includes(w))).toEqual([])
    expect(footer.filter((w) => !printed.includes(w))).toEqual([])
  })

  it("gives free play's controls names no other control on the page has", () => {
    // Arrange: each control's name as the markup gives it
    const nameOf = (e: Element): string =>
      e.getAttribute('aria-label') ??
      (e.textContent ?? '').replace(/\s+/g, ' ').trim()
    const page = doc()
    const all = Array.from(
      page.querySelectorAll('main :is(button, input)'),
      nameOf,
    )

    // Act
    const free = Array.from(
      page.querySelectorAll('#freePlay :is(button, input)'),
      nameOf,
    )

    // Assert
    expect(free).toEqual([
      'do, D3',
      'mi, F sharp 3',
      'so, A3',
      'top do, D4',
      'Free play: Hear it first',
      'Free play: Slow',
      'Lower voice',
      'Higher voice',
    ])
    for (const name of free)
      expect(
        all.filter((n) => n === name),
        name,
      ).toHaveLength(1)
  })

  it("keeps only the tease's still in the next card's mark, hidden from a screen reader, with no button: the card is a link", () => {
    // Act
    const mark = doc().querySelector('[data-next-card]')
    const kids = Array.from(mark?.children ?? [], (k) => [
      k.tagName.toLowerCase(),
      k.getAttribute('class'),
      k.getAttribute('aria-hidden'),
      k.getAttribute('focusable'),
    ])

    // Assert
    expect(kids).toEqual([['svg', 'l09-tease', 'true', 'false']])
    expect(mark?.querySelectorAll('button, a, input, [tabindex]')).toHaveLength(
      0,
    )
    expect(mark?.querySelectorAll('.lit')).toHaveLength(3)
    expect(mark?.querySelector('.ask')?.textContent).toBe('?')
  })

  it('reads no draft switch: the page state decides (kit/drafts.ts)', () => {
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
    expect(image).toBe('learn/lesson-09-og.jpg')
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
        'main :is(p, li, h1, h2, h3, button, blockquote, summary, figcaption)',
      ),
      (e) => (e.textContent ?? '').replace(/\s+/g, ' ').trim(),
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
