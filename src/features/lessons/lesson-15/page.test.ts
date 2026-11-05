// ============================================================
// Lesson 15's page document — its spoken signs, its references, its order, no staff for show
// ============================================================
//
// learn/15.html is hand-written markup, so some of its promises are held
// here: every ♯ and ♭ its text prints is followed by its spoken name, the
// sign itself hidden from a screen reader, and no accessible name or share
// card carries one; every id a label or description points at exists, once;
// every button is a button, not a submit; there is no Watch section, because
// Lesson 15 has no film; the page opens on its cold open, the recall after
// it, shown to everyone, and before the four words; nothing before the
// reveal says that a space holds a note or how many places five lines give
// (FACTS 1a); the hero has its three chips; Play the climb plays freely under
// the stage, and the five lines wait for a choice; no section head carries
// the faint staff and its clef, and the body drops the background's, since
// on this page a staff is always music (WEB-SPEC, Look; Tests 16); the
// practice link carries the lesson before its hash, and the practice card's
// rest line keeps Compose; the share card its head names is in public/, at
// its size; and every line of its copy says only what the claims check
// passes (WEB-SPEC, Tests 14).

import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import { validateGuidedDynamicClaim } from '@/lib/guided-voice/claims'
import { PAGE, words } from './page-dom.test-fixtures'

const DIR = resolve(process.cwd(), 'src/features/lessons/lesson-15')

/** A sign as the page writes it, however the formatter wraps it: hidden, then said. */
const SPOKEN_SIGN =
  /<span\s+aria-hidden="true"\s*>[♯♭]<\/span\s*>\s*<span\s+class="sr"\s*>\s(?:sharp|flat)<\/span\s*>/g

/** The share card's words (WEB-SPEC, Sections, item 2). */
const SHARE_ALT =
  'The title card: Find Your Pitch, Lesson 15, The staff: where notes sit, above five empty lines between Merc and Tavi.'

/** A meta tag's content, however the formatter wraps the tag. */
const metaOf = (property: string): string | undefined =>
  new RegExp(`(?:property|name)="${property}"\\s+content="([^"]*)"`).exec(
    PAGE,
  )?.[1]

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

describe("Lesson 15's page", () => {
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
    // Arrange
    const named = [
      ...valuesOf('aria-label'),
      ...valuesOf('aria-valuetext'),
      ...valuesOf('alt'),
    ]
    const card = [metaOf('og:image:alt'), metaOf('twitter:image:alt')]

    // Assert
    expect(named.length).toBeGreaterThan(0)
    expect(card).toEqual([SHARE_ALT, SHARE_ALT])
    expect(
      [...named, ...valuesOf('content')].filter((v) => /[♯♭]/.test(v)),
    ).toEqual([])
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

  it('carries no Watch section: Lesson 15 has no film', () => {
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

    // Assert: CURIOSITY-MOMENTS § 3.1, as Lessons 2 and 4 to 13 run
    expect(at.every((i) => i > 0)).toBe(true)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
  })

  it('asks the recall of everyone, in a section of its own: Lesson 2 comes first, so it needs no live wrapper', () => {
    // Act
    const hero = /<section class="hero[^"]*"[\s\S]*?<\/section>/.exec(PAGE)?.[0]

    // Assert
    expect(hero).toContain('id="predict"')
    expect(hero).not.toContain('id="recall"')
    expect(PAGE).not.toMatch(/data-if-live/)
    expect(PAGE).toMatch(/<section class="mv" id="recall"/)
  })

  it('says nothing before the reveal of a note in a space, nor how many places five lines give (FACTS 1a)', () => {
    // Arrange: everything a reader meets before the reveal, the choices aside
    const page = doc()
    const reveal = page.querySelector('#predict .reveal')
    reveal?.remove()
    for (const c of Array.from(page.querySelectorAll('#predict .choice')))
      c.remove()
    const hero = words(page.querySelector('.hero'))
    const head = [
      page.title,
      metaOf('description'),
      metaOf('og:description'),
      metaOf('twitter:description'),
      metaOf('og:image:alt'),
    ].join(' ')
    const steps = Array.from(page.querySelectorAll('.step h3'), (h) =>
      words(h),
    ).join(' ')

    // Assert: the predict's premise is five lines and 88 keys, and no more
    for (const text of [hero, head, steps]) {
      expect(text).not.toMatch(/\bspaces?\b/i)
      expect(text).not.toMatch(/\bnine\b|\b9\b/i)
    }
    expect(words(reveal)).toMatch(/^Your guess Nine\./)
  })

  it("names the lesson's three chips: its minutes, Lesson 2 linked, and sound on", () => {
    // Act
    const chips = Array.from(
      doc().querySelectorAll('.hero ul.meta .chip'),
      (c) => [words(c), c.getAttribute('href')].join(' → '),
    )

    // Assert: WEB-SPEC, Sections, item 2
    expect(chips).toEqual([
      '15 minutes → ',
      'After Lesson 2: Twelve notes → /learn/02',
      'Sound on → ',
    ])
  })

  it('plays the climb freely under the stage, outside the predict, and keeps the five lines locked until a choice', () => {
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

    // Assert: WEB-SPEC, Toys 2 and 3
    expect(plays).toEqual([
      ['climb', 'Play the climb', true, false],
      ['lines', 'Play it on the five lines', false, true],
    ])
    expect(predict?.querySelectorAll('[data-play]')).toHaveLength(0)
    expect(
      Array.from(predict?.querySelectorAll('.choice') ?? [], (c) => words(c)),
    ).toEqual(['Five', 'Nine'])
    expect(words(predict?.querySelector('.lock-hint'))).toBe(
      'Choose an answer to unlock the five lines.',
    )
  })

  it('draws no staff for show: no section head carries one, and the body drops the background staff', () => {
    // Arrange
    const page = doc()

    // Assert: WEB-SPEC, Look, and Tests 16; every staff on the page is a figure
    expect(page.querySelectorAll('.mv-staff, svg.clef')).toHaveLength(0)
    expect(page.body.classList.contains('season-2')).toBe(true)
    for (const m of modules) expect(m).not.toMatch(/engraveClefs\(/)
  })

  it('links the practice drill with the lesson, before its hash, each in a tab of its own', () => {
    // Act
    const links = Array.from(
      doc().querySelectorAll<HTMLAnchorElement>('a[href*="lesson="]'),
    )

    // Assert: Compose, on the card and in the footer (FACTS 45)
    expect(links.map((a) => a.getAttribute('href'))).toEqual([
      '/?lesson=15#/compose',
      '/?lesson=15#/compose',
    ])
    for (const a of links)
      expect([a.target, a.rel, words(a)]).toEqual([
        '_blank',
        'noopener',
        'mercurypitch.com/#/compose',
      ])
  })

  it("holds the practice card's rest line, hidden at first, above a text that keeps Compose after every ending", () => {
    // Arrange
    const card = doc().querySelector('#practiseCard')

    // Act
    const rest = card?.querySelector('[data-ending="rest"]')
    const link = card?.querySelector('a.addr')

    // Assert: Lesson 8's rest line, word for word (FACTS 59)
    expect(words(card?.querySelector('h3'))).toBe('Compose, in Sheet Music')
    expect(rest?.hasAttribute('hidden')).toBe(true)
    expect(words(rest)).toBe(
      "Rest today. This page's sung line will be here when your voice feels comfortable.",
    )
    expect(link?.closest('[data-ending]')).toBeNull()
    expect(card?.querySelectorAll('[data-ending]')).toHaveLength(1)
  })

  it('reads no draft switch: the page state decides (kit/drafts.ts)', () => {
    expect(modules.length).toBeGreaterThan(0)
    for (const m of modules)
      expect(m).not.toMatch(/DRAFT_LESSONS|DRAFTS_SHOWN|import\.meta\.env/)
  })

  it('carries Season 2 before anything draws', () => {
    // Arrange
    const main = readFileSync(resolve(DIR, 'main.ts'), 'utf8')

    // Act: the first call the module makes
    const first = /^[a-zA-Z]\w*\(/m.exec(main)?.[0]

    // Assert: kit/page-state.ts `carrySeason`
    expect(first).toBe('carrySeason(')
    expect(main).toMatch(/carrySeason\(SEASON_2\)/)
  })

  it('names a share card that is in public/, at the size its head gives', () => {
    // Arrange
    const image = metaOf('og:image')?.replace('https://mercurypitch.com/', '')

    // Act
    const size = jpegSize(
      readFileSync(resolve(process.cwd(), 'public', image ?? '')),
    )

    // Assert
    expect(image).toBe('learn/lesson-15-og.jpg')
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
    expect(blocks.length).toBeGreaterThan(100)
    for (const text of blocks)
      expect(
        validateGuidedDynamicClaim({ surface: 'finding', text }).violations,
        text,
      ).toEqual([])
  })
})
