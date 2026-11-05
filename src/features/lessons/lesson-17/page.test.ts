// ============================================================
// Lesson 17's page document — its references, its order, nothing that answers the predict, no staff for show
// ============================================================
//
// learn/17.html is hand-written markup, so some of its promises are held
// here: it prints no ♯ or ♭, since every note it plays is an A, and no
// accessible name or share card carries one; every id a label or
// description points at exists, once; every button is a button, not a
// submit; there is no Watch section, because Lesson 17 has no film; the
// page opens on its cold open, the recall after it, shown to everyone, and
// before the four words; nothing before the reveal says how long a note
// lasts at 120 BPM, or that the tempo changes it (FACTS 1a); the hero has
// its four chips; the 60 BPM play plays freely under the stage, and the
// 120 BPM play waits for a choice; the masthead's anchors are Lesson, Tap it
// and Explorer; no section head carries the faint staff and its clef, and
// the body drops the background's, since on this page a staff is always
// music (WEB-SPEC, Look); the practice links carry the lesson, and the
// practice card's rest line keeps both drills; the share card its head
// names is in public/, at its size; and every line of its copy says only
// what the claims check passes (WEB-SPEC, Tests).

import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import { validateGuidedDynamicClaim } from '@/lib/guided-voice/claims'
import { PAGE, words } from './page-dom.test-fixtures'

const DIR = resolve(process.cwd(), 'src/features/lessons/lesson-17')

/** The share card's words (WEB-SPEC, What the kit and the app still need, item 2). */
const SHARE_ALT =
  'The title card: Find Your Pitch, Lesson 17, How long is a note?, above four beat pads with four quarter notes written over them, between Merc and Tavi.'

/** What would tell a reader the cold open's answer: a length at 120 BPM, or that the tempo sets it. */
const ANSWERS = [
  /half a second/i,
  /\b0\.5\b/,
  /twice as (fast|long|short)/i,
  /\b(shorter|shrinks?|stretch(es)?)\b/i,
  /tempo (sets|changes|turns|says)/i,
  /depends on the tempo/i,
]

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

describe("Lesson 17's page", () => {
  it('prints no ♯ or ♭, and names its share card in words', () => {
    // Arrange
    const named = [
      ...valuesOf('aria-label'),
      ...valuesOf('aria-valuetext'),
      ...valuesOf('alt'),
    ]
    const card = [metaOf('og:image:alt'), metaOf('twitter:image:alt')]

    // Assert: every note the page plays is an A (FACTS 61)
    expect(named.length).toBeGreaterThan(0)
    expect(card).toEqual([SHARE_ALT, SHARE_ALT])
    expect(PAGE.match(/[♯♭]/g) ?? []).toEqual([])
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

  it("carries the step deck's way through: Previous, and Next naming Step 2", () => {
    // Arrange
    const nav = doc().getElementById('deckNav')

    // Assert: the deck renames this label at every step (kit/step-deck.ts)
    expect(nav).not.toBeNull()
    expect(nav?.querySelector('[data-step-go="-1"]')).not.toBeNull()
    expect(
      nav
        ?.querySelector('[data-step-go="1"] #deckNextLabel')
        ?.textContent?.trim(),
    ).toBe('Next: So what sets how long a note lasts?')
  })

  it('makes every button a plain button', () => {
    // Act
    const buttons = Array.from(PAGE.matchAll(/<button\b[^>]*>/g), (m) => m[0])

    // Assert
    expect(buttons.length).toBeGreaterThan(20)
    for (const b of buttons) expect(b, b).toMatch(/type="button"/)
  })

  it('carries no Watch section: Lesson 17 has no film', () => {
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
      'id="lesson"',
      'id="sing"',
      'id="check"',
      'id="wrap"',
      'id="explorer"',
    ].map((s) => PAGE.indexOf(s))

    // Assert: CURIOSITY-MOMENTS § 3.1, and WEB-SPEC, Sections
    expect(at.every((i) => i > 0)).toBe(true)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
  })

  it('asks the recall of everyone, in a section of its own', () => {
    // Act
    const hero = /<section class="hero[^"]*"[\s\S]*?<\/section>/.exec(PAGE)?.[0]

    // Assert: Lesson 8's questions, open to all (WEB-SPEC, Toys 9)
    expect(hero).toContain('id="predict"')
    expect(hero).not.toContain('id="recall"')
    expect(PAGE).not.toMatch(/data-if-live/)
    expect(PAGE).toMatch(/<section class="mv" id="recall"/)
  })

  it('says nothing before the reveal of how long a note lasts at 120 BPM, nor that the tempo sets it (FACTS 1a)', () => {
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

    // Assert
    for (const text of [hero, head, steps])
      for (const answer of ANSWERS) expect(text).not.toMatch(answer)
    expect(words(reveal)).toMatch(/^Your guess Half a second\./)
  })

  it("names the lesson's four chips: its minutes, Lesson 8 linked, Lesson 15 as a help, and sound on", () => {
    // Act
    const chips = Array.from(
      doc().querySelectorAll('.hero ul.meta .chip'),
      (c) => [words(c), c.getAttribute('href')].join(' → '),
    )

    // Assert: WEB-SPEC, Sections, item 2
    expect(chips).toEqual([
      '16 minutes → ',
      'After Lesson 8: Beat, tempo and the backbeat → /learn/08',
      'Also useful: Lesson 15, The staff → ',
      'Sound on → ',
    ])
  })

  it('plays the bar at 60 BPM freely under the stage, outside the predict, and keeps 120 BPM locked until a choice', () => {
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
      ['60', 'Play the bar at 60 BPM', true, false],
      ['120', 'Play the bar at 120 BPM', false, true],
    ])
    expect(predict?.querySelectorAll('[data-play]')).toHaveLength(0)
    expect(
      Array.from(predict?.querySelectorAll('.choice') ?? [], (c) => words(c)),
    ).toEqual(['One second, the same', 'Half a second'])
    expect(words(predict?.querySelector('.lock-hint'))).toBe(
      'Choose an answer to unlock the faster play.',
    )
  })

  it("puts Lesson, Tap it and Explorer in the masthead, and Season 2's line above the explorer", () => {
    // Arrange
    const page = doc()

    // Act
    const anchors = Array.from(page.querySelectorAll('#mastNav a'), (a) => [
      a.getAttribute('href'),
      words(a).replace(/^[IV]+/, ''),
    ])

    // Assert: WEB-SPEC, Sections, items 1 and 12
    expect(anchors).toEqual([
      ['#lesson', 'Lesson'],
      ['#sing', 'Tap it'],
      ['#explorer', 'Explorer'],
    ])
    expect(words(page.querySelector('.mast-ep'))).toBe('Season 2 · Lesson 17')
    expect(words(page.querySelector('#explorer .mv-tempo'))).toBe(
      'Season 2 · Lesson 17',
    )
  })

  it('draws no staff for show: no section head carries one, and the body drops the background staff', () => {
    // Arrange
    const page = doc()

    // Assert: WEB-SPEC, Look; every staff on the page is a figure
    expect(page.querySelectorAll('.mv-staff, svg.clef')).toHaveLength(0)
    expect(page.body.classList.contains('season-2')).toBe(true)
    for (const m of modules) expect(m).not.toMatch(/engraveClefs\(/)
  })

  it('links both practice drills with the lesson, each in a tab of its own', () => {
    // Act
    const links = Array.from(
      doc().querySelectorAll<HTMLAnchorElement>('a[href*="lesson="]'),
    )

    // Assert: The Chart and Pulse on the card, and the footer (FACTS 39 to 42)
    expect(links.map((a) => a.getAttribute('href'))).toEqual([
      '/ear-lab?lesson=17',
      '/ear-lab?lesson=17',
      '/ear-lab?lesson=17',
    ])
    for (const a of links)
      expect([a.target, a.rel, words(a)]).toEqual([
        '_blank',
        'noopener',
        'mercurypitch.com/ear-lab',
      ])
  })

  it("holds the practice card's rest line, hidden at first, above a text that keeps both drills after every ending", () => {
    // Arrange
    const card = doc().querySelector('#practiseCard')

    // Act
    const rest = card?.querySelector('[data-ending="rest"]')
    const links = Array.from(card?.querySelectorAll('a.addr') ?? [])

    // Assert: LESSON.md, Wrap, its rest version
    expect(words(card?.querySelector('h3'))).toBe('The Chart')
    expect(rest?.hasAttribute('hidden')).toBe(true)
    expect(words(rest)).toBe(
      "Rest today. This page's sung bars will be here when your voice feels comfortable.",
    )
    expect(links).toHaveLength(2)
    for (const a of links) expect(a.closest('[data-ending]')).toBeNull()
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
    expect(image).toBe('learn/lesson-17-og.jpg')
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
