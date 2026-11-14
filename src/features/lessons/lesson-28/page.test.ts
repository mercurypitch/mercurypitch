// ============================================================
// Lesson 28's page document — its spoken signs, its references, its order, nothing that answers the predict
// ============================================================
//
// learn/28.html is hand-written markup, so some of its promises are held
// here: every ♯ its text prints is followed by its spoken name, the sign
// itself hidden from a screen reader, and no accessible name or share card
// carries one; every id a label or description points at exists, once;
// every button is a button, not a submit; there is no Watch section,
// because Lesson 28 has no film; the page opens on its cold open, the
// recall after it, shown to everyone, and before the three words; nothing a
// reader meets before the choice says whose note at bar 8 is different, or
// what chord comes instead of I there, and no step heading does (FACTS 1a);
// the hero has its six chips; Play the song plays freely under the stage,
// and Play the ending and Play it going on wait for a choice; the steps'
// toy and free play hold every control and every play in the steps' text
// under their lines, and Step 2 waits behind its held line; no section head
// carries the faint staff and its clef, and the body drops the background's
// (WEB-SPEC, Look); Sing it holds the series' lines and this page's, and
// waits under its own line; the practice links carry the lesson, and the
// practice card's rest line sends no one to sing; the share card its head
// names is in public/, at its size; and every line of its copy says only
// what the claims check passes (WEB-SPEC, Tests).

import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import { validateGuidedDynamicClaim } from '@/lib/guided-voice/claims'
import { PAGE, words } from './page-dom.test-fixtures'

const DIR = resolve(process.cwd(), 'src/features/lessons/lesson-28')

/** A sign as the page writes it, however the formatter wraps it: hidden, then said. */
const SPOKEN_SIGN =
  /<span\s+aria-hidden="true"\s*>[♯♭]<\/span\s*>\s*<span\s+class="sr"\s*>\s?(?:sharp|flat)<\/span\s*>/g

/** The share card's words (WEB-SPEC, Sections, item 2). */
const SHARE_ALT =
  'The title card: Find Your Pitch, Lesson 28, Cadences, form and a song in two parts, above a strip of ten bars in two rows, between Merc and Tavi.'

/**
 * What would tell a reader the cold open's answer: whose note at bar 8 is
 * different, or what chord comes instead of I there (FACTS 1a). Step 3 may
 * say its bridge opens on vi, which is not bar 8, and Step 2's toy names
 * its three cadences on its held buttons, as LESSON.md draws it.
 */
const ANSWERS = [
  /\bdeceptive\b/i,
  /\bV to vi\b/,
  /\bE ?3\b/,
  /\bleapt\b|\bstepped up to E\b/i,
  /\bMerc's part changes\b/i,
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

/** An element's words with its icons left out, whose markup holds only spaces. */
const prose = (e: Element | null | undefined): string => {
  const copy = e?.cloneNode(true) as Element | undefined
  copy?.querySelectorAll('svg').forEach((svg) => svg.remove())
  return words(copy)
}

/** A toy's buttons as a reader meets them: words, and whether each can be used. */
const controlsOf = (root: Element | null): (string | boolean)[][] =>
  Array.from(root?.querySelectorAll<HTMLButtonElement>('button') ?? [], (b) => [
    prose(b),
    !b.disabled,
  ])

describe("Lesson 28's page", () => {
  it('follows every ♯ it prints with its spoken name', () => {
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
      'Next: How can a song fake its ending?',
    )
  })

  it('makes every button a plain button', () => {
    // Act
    const buttons = Array.from(PAGE.matchAll(/<button\b[^>]*>/g), (m) => m[0])

    // Assert
    expect(buttons.length).toBeGreaterThan(40)
    for (const b of buttons) expect(b, b).toMatch(/type="button"/)
  })

  it('carries no Watch section: Lesson 28 has no film', () => {
    expect(PAGE).not.toMatch(/id="watch"/)
    expect(PAGE).not.toMatch(/<video/)
  })

  it('opens on the hook and the cold open, the recall after it and before the three words', () => {
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

    // Assert: CURIOSITY-MOMENTS § 3.1, as Lessons 2 and 4 to 27 run
    expect(at.every((i) => i > 0)).toBe(true)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
  })

  it('asks the recall of everyone, in a section of its own: Lessons 18 and 26 come first, so it needs no live wrapper', () => {
    // Act
    const hero = /<section class="hero[^"]*"[\s\S]*?<\/section>/.exec(PAGE)?.[0]

    // Assert
    expect(hero).toContain('id="predict"')
    expect(hero).not.toContain('id="recall"')
    expect(PAGE).not.toMatch(/data-if-live/)
    expect(PAGE).toMatch(/<section class="mv" id="recall"/)
  })

  it('says nothing before the choice of whose note at bar 8 is different, or of what comes instead of I, and no step heading does (FACTS 1a)', () => {
    // Arrange: everything a reader meets before the choice, the choices and
    // the reveal aside
    const page = doc()
    const reveal = page.querySelector('#predict .reveal')
    reveal?.remove()
    for (const c of Array.from(page.querySelectorAll('#predict .choice')))
      c.remove()
    const hero = words(page.querySelector('.hero'))
    // the head a learner meets; the structured data, which no learner
    // meets, names the cadences (WEB-SPEC, Sections, item 2)
    const head = [
      page.title,
      metaOf('description'),
      metaOf('og:title'),
      metaOf('og:description'),
      metaOf('twitter:description'),
      metaOf('og:image:alt'),
    ].join(' ')
    const headings = Array.from(page.querySelectorAll('.step h3'), (h) =>
      words(h),
    ).join(' ')
    const recall = words(page.querySelector('#recall'))
    const three = words(page.querySelector('#words'))
    // Step 2's held text aside, which waits for the reveal
    for (const held of Array.from(
      page.querySelectorAll('.steps-text [data-held]'),
    ))
      held.remove()
    const steps = words(page.querySelector('#stepsText'))
    const toy = words(page.querySelector('#toyScore'))
    const sing = words(page.querySelector('#sing'))
    const free = words(page.querySelector('#freePlay'))

    // Assert
    for (const text of [
      hero,
      head,
      headings,
      recall,
      three,
      steps,
      toy,
      sing,
      free,
    ])
      for (const answer of ANSWERS) expect(text).not.toMatch(answer)
    expect(words(reveal)).toMatch(/^Your guess Merc's part\. /)
  })

  it("names the lesson's six chips: its minutes, Lessons 18 and 26 linked, sound on, and the microphone and headphones optional", () => {
    // Arrange
    const chips = Array.from(
      doc().querySelectorAll('.hero .meta .chip'),
      (c) => [words(c), c.getAttribute('href')],
    )

    // Assert: WEB-SPEC, Sections, item 2
    expect(chips).toEqual([
      ['19 minutes', null],
      ['After Lesson 18: Read and sing a whole line', '/learn/18'],
      ['After Lesson 26: A second voice', '/learn/26'],
      ['Sound on', null],
      ['Microphone optional', null],
      ['Headphones optional', null],
    ])
  })

  it('plays the song freely under the stage, outside the predict, and keeps both ways locked until a choice', () => {
    // Arrange
    const page = doc()
    const plays = page.querySelector('.hero .hero-plays')

    // Act
    const buttons = Array.from(
      plays?.querySelectorAll<HTMLButtonElement>('button') ?? [],
      (b) => [
        prose(b),
        b.dataset.play,
        b.hasAttribute('data-free'),
        b.disabled,
      ],
    )

    // Assert: WEB-SPEC, Toys 1
    expect(buttons).toEqual([
      ['Play the song', 'song', true, false],
      ['Play the ending', 'ending', false, true],
      ['Play it going on', 'going', false, true],
    ])
    expect(plays?.closest('#predict')).toBeNull()
    expect(words(page.querySelector('#predict .lock-hint'))).toBe(
      'Choose an answer to unlock both ways.',
    )
    expect(
      Array.from(page.querySelectorAll('#predict .choice'), (c) => words(c)),
    ).toEqual(["Tavi's part", "Merc's part"])
  })

  it("draws the song strip with no note: ten numbered boxes a row, Tavi's part above Merc's, each labelled", () => {
    // Arrange
    const strip = doc().querySelector('#heroStrip')

    // Act
    const rows = Array.from(
      strip?.querySelectorAll('.strip-row') ?? [],
      (r) => [
        (r as HTMLElement).dataset.part,
        words(r.querySelector('.strip-label')),
        Array.from(r.querySelectorAll('li'), (li) => words(li)).join(' '),
      ],
    )

    // Assert: WEB-SPEC, Look
    expect(rows).toEqual([
      ['tavi', "Tavi's part", '1 2 3 4 5 6 7 8 9 10'],
      ['merc', "Merc's part", '1 2 3 4 5 6 7 8 9 10'],
    ])
    expect(
      strip?.querySelector('[data-hero-strip]')?.getAttribute('role'),
    ).toBe('img')
  })

  it("holds every control of the steps' toy under its line until the choice", () => {
    // Arrange
    const toy = doc().querySelector('#toyScore')

    // Act
    const controls = controlsOf(toy)

    // Assert: WEB-SPEC, Toys 2 and 3
    expect(controls.length).toBeGreaterThan(5)
    expect(controls.filter(([, live]) => live === true)).toEqual([])
    expect(words(toy?.querySelector('[data-lock-line]'))).toBe(
      'Choose an answer at the top to unlock this figure.',
    )
  })

  it('holds free play the same, with its state switch, each state named by its step', () => {
    // Arrange
    const page = doc()
    const free = page.querySelector('#freePlay')
    const heads = Array.from(page.querySelectorAll('.step h3'), (h) => words(h))

    // Act
    const states = Array.from(
      free?.querySelectorAll('[data-state]') ?? [],
      (b) => b.getAttribute('aria-label'),
    )

    // Assert
    expect(controlsOf(free).filter(([, live]) => live === true)).toEqual([])
    expect(states).toEqual(heads.map((h, i) => `${i + 1}: ${h}`))
    expect(words(free?.querySelector('[data-lock-line]'))).toBe(
      'Choose an answer at the top to unlock this figure.',
    )
  })

  it("puts each step's plays in its text, where LESSON.md writes them, each held until the choice", () => {
    // Act
    const plays = Array.from(
      doc().querySelectorAll<HTMLButtonElement>('#stepsText [data-step-play]'),
      (b) => [b.closest('.step')?.id, prose(b), b.dataset.stepPlay, b.disabled],
    )

    // Assert
    expect(plays).toEqual([
      ['step-1', 'Play bars 1 to 4', 'phrase1', true],
      ['step-1', 'Play bars 5 to 8', 'phrase2', true],
      ['step-2', 'Play bars 7 to 10', 'interrupted', true],
      ['step-2', 'Play the ending, then the Amen', 'plagal', true],
      ['step-3', 'Play B, then A', 'bridge', true],
      ['step-4', "Play Tavi's part", 'tavi', true],
      ['step-4', "Play Merc's part", 'merc', true],
    ])
  })

  it('keeps Step 2 under its heading hidden behind its held line', () => {
    // Arrange
    const page = doc()

    // Act
    const held = Array.from(page.querySelectorAll('[data-held]'), (h) => [
      (h as HTMLElement).dataset.held,
      h.hasAttribute('hidden'),
    ])
    const line = page.querySelector('[data-held-line="2"]')

    // Assert: the predict's second reveal element (WEB-SPEC, Toys 1)
    expect(held).toEqual([['2', true]])
    expect(words(line)).toBe('Hear both ways at the top to unlock this step.')
    expect(line?.hasAttribute('hidden')).toBe(false)
  })

  it('names the four step headings, and the three words', () => {
    // Arrange
    const page = doc()

    // Assert: LESSON.md's headings and words
    expect(
      Array.from(page.querySelectorAll('.step h3'), (h) => words(h)),
    ).toEqual([
      'What makes a phrase sound finished?',
      'How can a song fake its ending?',
      'How is a song put together?',
      'How do I read my part?',
    ])
    expect(
      Array.from(page.querySelectorAll('#words .ticket'), (t) => [
        words(t.querySelector('h3')),
        prose(t.querySelector('button')),
      ]),
    ).toEqual([
      ['Cadence', 'Play: bars 3 and 4'],
      ['Section', ''],
      ['Form', 'Show the letters'],
    ])
  })

  it('draws no staff for show: no section head carries one, and the body drops the background staff', () => {
    // Arrange
    const page = doc()

    // Assert: WEB-SPEC, Look
    expect(
      page.querySelectorAll('.mv-staff, svg.clef, [data-staff-svg]'),
    ).toHaveLength(0)
    expect(page.body.classList.contains('season-2')).toBe(true)
    for (const m of modules) expect(m).not.toMatch(/engraveClefs\(/)
  })

  it("holds Sing it's series lines and this page's, waiting under its own line until the choice", () => {
    // Arrange
    const card = doc().querySelector('#singCard')

    // Assert: LESSON.md, Sing it
    expect(words(card?.querySelector('.stop-line'))).toBe(
      'Stop immediately if anything feels uncomfortable.',
    )
    expect(words(card?.querySelector('.listen-line'))).toBe(
      "Good call. Merc and Tavi sing the song's two parts, and nothing listens. Rest your voice.",
    )
    expect(words(card?.querySelector('[data-phones-check] p'))).toBe(
      "Put on headphones to keep Tavi's part out of the microphone, with the volume low enough to hear yourself.",
    )
    expect(words(card?.querySelector('.turn'))).toBe(
      "Your turn: bars 1 to 8 of your part, read from the staff. Merc sings do, then the click counts in one bar. Sing on the syllables or on “ooh”. The cursor won't wait for you. Breathe at the breath marks. If a note slips, come in on the next one. Sing at about speaking volume.",
    )
    expect(words(card?.querySelector('[data-quiet-failed]'))).toBe(
      "The microphone heard a note during Tavi's part. Check your headphones, or choose No headphones to sing alone.",
    )
    expect(words(card?.querySelector('.playback-line'))).toBe(
      'The song ends V to I: a perfect cadence.',
    )
    expect(words(card?.querySelector('[data-sing-lock]'))).toBe(
      'Choose an answer at the top to sing or listen here.',
    )
    // Start is the only control that asks for the microphone, and it waits
    // with every play for the choice
    expect(
      Array.from(
        card?.querySelectorAll<HTMLButtonElement>('[data-sing="start"]') ?? [],
        (b) => [prose(b), b.disabled],
      ),
    ).toEqual([['Start', true]])
    expect(
      Array.from(
        card?.querySelectorAll<HTMLButtonElement>(
          '[data-listen-play], [data-sing="first"]',
        ) ?? [],
        (b) => b.disabled,
      ),
    ).toEqual([true, true])
  })

  it('links the practice drills with the lesson, each in a tab of its own', () => {
    // Act
    const links = Array.from(
      doc().querySelectorAll<HTMLAnchorElement>('a[href*="lesson="]'),
    )

    // Assert: Karaoke Night and Ear Lab, on the card and in the footer
    // (WEB-SPEC, Practice links)
    expect(links.map((a) => a.getAttribute('href'))).toEqual([
      '/karaoke-night?lesson=28',
      '/ear-lab?lesson=28',
      '/karaoke-night?lesson=28',
      '/ear-lab?lesson=28',
    ])
    for (const a of links) {
      expect([a.target, a.rel]).toEqual(['_blank', 'noopener'])
      expect(words(a)).toMatch(/^mercurypitch\.com\//)
    }
  })

  it("holds the practice card's rest line, hidden at first, in place of Karaoke Night, which asks for the voice; Ear Lab's Cadence stays", () => {
    // Arrange
    const card = doc().querySelector('#practiseCard')

    // Act
    const rest = card?.querySelector('[data-ending="rest"]')
    const sing = card?.querySelector('[data-ending="practise"]')

    // Assert: Lesson 10's rest form, naming Karaoke Night (LESSON.md, Wrap)
    expect(words(card?.querySelector('h3'))).toBe('Karaoke Night')
    expect(rest?.hasAttribute('hidden')).toBe(true)
    expect(words(rest)).toBe(
      'Rest today. Karaoke Night will be here when your voice feels comfortable: mercurypitch.com/karaoke-night',
    )
    expect(rest?.querySelector('a')).toBeNull()
    expect(sing?.hasAttribute('hidden')).toBe(false)
    expect(sing?.querySelectorAll('a.addr')).toHaveLength(1)
    expect(
      card?.querySelector('.second-drill')?.closest('[data-ending]'),
    ).toBeNull()
  })

  it("draws the season's close figure with no note and no staff", () => {
    // Arrange
    const close = doc().querySelector('[data-next-card] .l28-close')

    // Assert: WEB-SPEC, Toys 7, and Look
    expect(close?.getAttribute('aria-hidden')).toBe('true')
    expect(
      Array.from(close?.querySelectorAll('text') ?? [], (t) => words(t)),
    ).toEqual(['A', 'A', 'B', 'A'])
    expect(close?.querySelector('button, a')).toBeNull()
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
    expect(image).toBe('learn/lesson-28-og.jpg')
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
