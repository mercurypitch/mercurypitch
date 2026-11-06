// ============================================================
// Lesson 23's page document — its spoken signs, its references, its order, nothing that answers the predict
// ============================================================
//
// learn/23.html is hand-written markup, so some of its promises are held
// here: every ♯ and ♭ its text prints is followed by its spoken name, the
// sign itself hidden from a screen reader, and no accessible name or share
// card carries one; every id a label or description points at exists, once;
// every button is a button, not a submit; there is no Watch section, because
// Lesson 23 has no film; the page opens on its cold open, the recall after
// it, shown to everyone, and before the four words; nothing a reader meets
// before the reveal names the halfway note, its six semitones or the
// tritone, and no step heading names one (FACTS 1a, 48); the hero has its
// three chips; Play C up to C plays freely under the stage, and the two
// splits wait for a choice; the steps' toy holds back in its markup what
// would answer the predict, and free play holds nothing back; no section head
// carries the faint staff and its clef, and the body drops the background's,
// since on this page a staff is always music (WEB-SPEC, Look; Tests 16);
// Sing it holds the series' lines and its listening part; the practice links
// carry the lesson, and the practice card's rest line keeps Leap; the share
// card its head names is in public/, at its size; and every line of its copy
// says only what the claims check passes (WEB-SPEC, Tests 14).

import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import { validateGuidedDynamicClaim } from '@/lib/guided-voice/claims'
import { PAGE, words } from './page-dom.test-fixtures'

const DIR = resolve(process.cwd(), 'src/features/lessons/lesson-23')

/** A sign as the page writes it, however the formatter wraps it: hidden, then said. */
const SPOKEN_SIGN =
  /<span\s+aria-hidden="true"\s*>[♯♭]<\/span\s*>\s*<span\s+class="sr"\s*>\s(?:sharp|flat)<\/span\s*>/g

/** The share card's words (WEB-SPEC, Sections, item 2). */
const SHARE_ALT =
  'The title card: Find Your Pitch, Lesson 23, Perfect, major, minor and the tritone, above an upright pitch line with C at its foot and C an octave up at its top and nothing between, between Merc and Tavi.'

/** What would tell a reader the cold open's answer: the halfway note, its size, or its name. */
const ANSWERS = [/F♯|F sharp|G♭|G flat/, /\bsix\b|\b6 semitones/i, /tritone/i]

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

describe("Lesson 23's page", () => {
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

  it("carries the step deck's way through: Previous, and Next naming Step 2", () => {
    // Arrange
    const nav = doc().getElementById('deckNav')

    // Assert: the deck renames this label at every step (kit/step-deck.ts)
    expect(nav?.querySelector('[data-step-go="-1"]')).not.toBeNull()
    expect(words(nav?.querySelector('[data-step-go="1"] #deckNextLabel'))).toBe(
      'Next: Is every interval major or minor?',
    )
  })

  it('makes every button a plain button', () => {
    // Act
    const buttons = Array.from(PAGE.matchAll(/<button\b[^>]*>/g), (m) => m[0])

    // Assert
    expect(buttons.length).toBeGreaterThan(20)
    for (const b of buttons) expect(b, b).toMatch(/type="button"/)
  })

  it('carries no Watch section: Lesson 23 has no film', () => {
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

    // Assert: CURIOSITY-MOMENTS § 3.1, as Lessons 2 and 4 to 19 run
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

  it('says nothing before the reveal of the halfway note, its six semitones or its name, and no step heading names one (FACTS 1a, 48)', () => {
    // Arrange: everything a reader meets before the reveal, the choices and
    // the plays that answer them aside
    const page = doc()
    const reveal = page.querySelector('#predict .reveal')
    reveal?.remove()
    for (const c of Array.from(
      page.querySelectorAll('#predict .choice, .hero-plays [data-play]'),
    ))
      c.remove()
    const hero = words(page.querySelector('.hero'))
    const head = [
      page.title,
      metaOf('description'),
      metaOf('og:description'),
      metaOf('twitter:description'),
    ].join(' ')
    const steps = Array.from(page.querySelectorAll('.step h3'), (h) =>
      words(h),
    ).join(' ')
    const four = words(page.querySelector('#words'))

    // Assert: the predict's premise is the octave's two Cs and its 12
    // semitones; the share card's words name the lesson, and no note
    for (const text of [hero, head, steps, four])
      for (const answer of ANSWERS) expect(text).not.toMatch(answer)
    expect(metaOf('og:image:alt')).not.toMatch(ANSWERS[0])
    expect(metaOf('og:image:alt')).not.toMatch(ANSWERS[1])
    expect(words(reveal)).toMatch(/^Your guess F♯ sharp\./)
  })

  it("names the lesson's three chips: its minutes, Lesson 6 linked, and sound on", () => {
    // Act
    const chips = Array.from(
      doc().querySelectorAll('.hero ul.meta .chip'),
      (c) => [words(c), c.getAttribute('href')].join(' → '),
    )

    // Assert: WEB-SPEC, Sections, item 2
    expect(chips).toEqual([
      '14 minutes → ',
      'After Lesson 6: Intervals: the distance between notes → /learn/06',
      'Sound on → ',
    ])
  })

  it('plays C up to C freely under the stage, outside the predict, and keeps the two splits locked until a choice', () => {
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
      ['octave', 'Play C up to C', true, false],
      ['g', 'Play C, G, C', false, true],
      ['fs', 'Play C, F♯ sharp, C', false, true],
    ])
    expect(predict?.querySelectorAll('[data-play]')).toHaveLength(0)
    expect(
      Array.from(predict?.querySelectorAll('.choice') ?? [], (c) => [
        (c as HTMLElement).dataset.choice,
        words(c),
      ]),
    ).toEqual([
      ['g', 'G'],
      ['fs', 'F♯ sharp'],
    ])
    expect(words(predict?.querySelector('.lock-hint'))).toBe(
      'Choose an answer to unlock the two splits.',
    )
  })

  it("holds back in the steps' toy what would answer the predict, and nothing in free play", () => {
    // Arrange
    const page = doc()
    const held = (root: string): string[] =>
      Array.from(page.querySelectorAll(`${root} [aria-disabled="true"]`), (b) =>
        words(b),
      )

    // Assert: WEB-SPEC, Toys 1, Before the choice; Step 1's two plays stay open
    expect(held('#toyStaff')).toEqual([
      'Sharp',
      'Flat',
      'Fold',
      'Curl into a ring',
      'Play C up to F, then F♯ sharp',
      'Play C up to G, then G♭ flat',
      'Play C up to G, then G up to C',
      'Play C up to E, then E up to C',
      'Play B and F, then C and E',
    ])
    expect(
      Array.from(
        page.querySelectorAll('#toyStaff [data-iv-play][data-part="1"]'),
        (b) => [words(b), b.hasAttribute('aria-disabled')],
      ),
    ).toEqual([
      ['Play C up to E', false],
      ['Play C up to E♭ flat', false],
    ])
    expect(held('#freePlay')).toEqual([])
    expect(page.querySelectorAll('#freePlay [data-iv-play]')).toHaveLength(0)
  })

  it('names no interval, note or size in a step heading, and none of the four words sounds the fifth turned over', () => {
    // Act
    const headings = Array.from(doc().querySelectorAll('.step h3'), (h) =>
      words(h),
    )
    const plays = Array.from(
      doc().querySelectorAll('#words [data-word-play]'),
      (b) => words(b),
    )

    // Assert: LESSON.md's four headings; Inversion's figure is a third (FACTS 69)
    expect(headings).toEqual([
      'How do you name an interval?',
      'Is every interval major or minor?',
      'What happens if you turn an interval upside down?',
      'Why does the halfway interval want to move?',
    ])
    expect(plays).toEqual([
      'Play: C up to E',
      'Play: a major third, then a minor third',
      'Play: C up to G',
      'Play: C up to E, then E up to C',
    ])
  })

  it('draws no staff for show: no section head carries one, and the body drops the background staff', () => {
    // Arrange
    const page = doc()

    // Assert: WEB-SPEC, Look, and Tests 16; every staff on the page is a figure
    expect(page.querySelectorAll('.mv-staff, svg.clef')).toHaveLength(0)
    expect(page.body.classList.contains('season-2')).toBe(true)
    for (const m of modules) expect(m).not.toMatch(/engraveClefs\(/)
  })

  it("holds Sing it's series lines, this page's line after Easy and Workable, and the listening part", () => {
    // Arrange
    const card = doc().querySelector('#singCard')

    // Assert: LESSON.md, Sing it; the listening part shows in every ending
    expect(words(card?.querySelector('.stop-line'))).toBe(
      'Stop immediately if anything feels uncomfortable.',
    )
    expect(words(card?.querySelector('[data-after="interval"]'))).toBe(
      'A fifth, then a fourth: one interval and its upside down.',
    )
    expect(words(card?.querySelector('.turn'))).toContain(
      'If the top note feels high, sing only do up to so.',
    )
    const listen = card?.querySelector('[data-listen-pair]')
    expect(listen?.hasAttribute('hidden')).toBe(true)
    expect(listen?.closest('[data-panel]')).toBeNull()
    expect(words(listen?.querySelector('p'))).toBe(
      'Then just listen. Ti and fa together, C♯ sharp and G in D: a tritone. Then each moves a semitone, to do and mi, D and F♯ sharp. Nobody sings this one.',
    )
    expect(words(listen?.querySelector('[data-pair-play]'))).toBe(
      'Play ti and fa',
    )
  })

  it('links the practice drill with the lesson, each in a tab of its own', () => {
    // Act
    const links = Array.from(
      doc().querySelectorAll<HTMLAnchorElement>('a[href*="lesson="]'),
    )

    // Assert: Ear Lab, on the card and in the footer (FACTS 62)
    expect(links.map((a) => a.getAttribute('href'))).toEqual([
      '/ear-lab?lesson=23',
      '/ear-lab?lesson=23',
    ])
    for (const a of links)
      expect([a.target, a.rel, words(a)]).toEqual([
        '_blank',
        'noopener',
        'mercurypitch.com/ear-lab',
      ])
  })

  it("holds the practice card's rest line, hidden at first, above a text that keeps Leap after every ending", () => {
    // Arrange
    const card = doc().querySelector('#practiseCard')

    // Act
    const rest = card?.querySelector('[data-ending="rest"]')
    const link = card?.querySelector('a.addr')

    // Assert: Lesson 8's rest line, word for word (FACTS 56)
    expect(words(card?.querySelector('h3'))).toBe("Ear Lab's Leap")
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
    expect(image).toBe('learn/lesson-23-og.jpg')
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
