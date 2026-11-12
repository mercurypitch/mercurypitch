// ============================================================
// Lesson 25's page document — its spoken signs, its references, its order, nothing that answers the predict
// ============================================================
//
// learn/25.html is hand-written markup, so some of its promises are held
// here: every ♯ and ♭ its text prints is followed by its spoken name, the
// sign itself hidden from a screen reader, and no accessible name or share
// card carries one; every id a label or description points at exists, once;
// every button is a button, not a submit; there is no Watch section, because
// Lesson 25 has no film; the page opens on its cold open, the recall after
// it, shown to everyone, and before the four words; nothing a reader meets
// before the choice says what raising G to G♯ does to the chord before
// home, and no step heading names a chord or its quality (FACTS 1a); the
// hero has its five chips; Play the tune, twice plays freely under the
// stage, and the two endings wait for a choice; the steps' toy and free
// play hold back in their markup what would answer the predict, and Step
// 1's paragraph on the chord waits behind its held line; no section head
// carries the faint staff and its clef, and the body drops the
// background's, since on this page a staff is always music (WEB-SPEC,
// Look); Sing it holds the series' lines and this page's; the practice
// links carry the lesson, and the practice card's rest line sends no one to
// sing; the share card its head names is in public/, at its size; and every
// line of its copy says only what the claims check passes (WEB-SPEC, Tests).

import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import { validateGuidedDynamicClaim } from '@/lib/guided-voice/claims'
import { PAGE, words } from './page-dom.test-fixtures'

const DIR = resolve(process.cwd(), 'src/features/lessons/lesson-25')

/**
 * A sign as the page writes it, however the formatter wraps it: hidden,
 * then said. The practice card's degrees keep their number with their sign,
 * ♯4 said "sharp 4".
 */
const SPOKEN_SIGN =
  /<span\s+aria-hidden="true"\s*>[♯♭]\d?<\/span\s*>\s*<span\s+class="sr"\s*>\s?(?:sharp|flat)(?: \d)?<\/span\s*>/g

/** The share card's words (WEB-SPEC, Sections, item 2). */
const SHARE_ALT =
  "The title card: Find Your Pitch, Lesson 25, Minor, properly, above Lesson 10's minor staircase on A, do to do, with the house on do, between Merc and Tavi."

/** What would tell a reader the cold open's answer: the chord before home turning major (FACTS 1a). */
const ANSWERS = [
  /\bE major\b/,
  /\bturns? major\b/i,
  /\bmajor chord\b/i,
  /chord (?:on so|before home)[^.]*\bmajor\b/i,
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

/** A toy's buttons as a reader meets them: words, and whether each shows and can be used. */
const controlsOf = (root: Element | null): (string | boolean)[][] =>
  Array.from(root?.querySelectorAll<HTMLButtonElement>('button') ?? [], (b) => [
    prose(b),
    b.closest('[hidden]') === null,
    !b.disabled,
  ])

describe("Lesson 25's page", () => {
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
      'Next: What does the raised note do to the scale?',
    )
  })

  it('makes every button a plain button', () => {
    // Act
    const buttons = Array.from(PAGE.matchAll(/<button\b[^>]*>/g), (m) => m[0])

    // Assert
    expect(buttons.length).toBeGreaterThan(40)
    for (const b of buttons) expect(b, b).toMatch(/type="button"/)
  })

  it('carries no Watch section: Lesson 25 has no film', () => {
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

    // Assert: CURIOSITY-MOMENTS § 3.1, as Lessons 2 and 4 to 24 run
    expect(at.every((i) => i > 0)).toBe(true)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
  })

  it('asks the recall of everyone, in a section of its own: Lessons 10 and 21 come first, so it needs no live wrapper', () => {
    // Act
    const hero = /<section class="hero[^"]*"[\s\S]*?<\/section>/.exec(PAGE)?.[0]

    // Assert
    expect(hero).toContain('id="predict"')
    expect(hero).not.toContain('id="recall"')
    expect(PAGE).not.toMatch(/data-if-live/)
    expect(PAGE).toMatch(/<section class="mv" id="recall"/)
  })

  it('says nothing before the choice of what raising G does to the chord before home, and no step heading names a chord or its quality (FACTS 1a)', () => {
    // Arrange: everything a reader meets before the choice, the choices, the
    // reveal and the plays that answer it aside
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
      metaOf('og:title'),
      metaOf('og:description'),
      metaOf('twitter:description'),
      metaOf('og:image:alt'),
      ...Array.from(
        page.querySelectorAll('script[type="application/ld+json"]'),
        (s) => s.textContent ?? '',
      ),
    ].join(' ')
    const steps = Array.from(page.querySelectorAll('.step h3'), (h) =>
      words(h),
    ).join(' ')
    const recall = words(page.querySelector('#recall'))
    const four = words(page.querySelector('#words'))
    // Step 1, its paragraph on the chord on so aside, which waits for the reveal
    const step1 = page.querySelector('#step-1')
    const chord = step1?.querySelector('[data-chord-para]')
    chord?.remove()
    const toy = words(page.querySelector('#toyMinor'))

    // Assert
    for (const text of [hero, head, steps, recall, four, words(step1), toy])
      for (const answer of ANSWERS) expect(text).not.toMatch(answer)
    expect(words(reveal)).toMatch(/^Your guess It turns major\./)
    expect(words(chord)).toMatch(/\bmajor\b/)
  })

  it("names the lesson's five chips: its minutes, Lessons 10, 21 and 23 linked, and sound on", () => {
    // Act
    const chips = Array.from(
      doc().querySelectorAll('.hero ul.meta .chip'),
      (c) => [words(c), c.getAttribute('href')].join(' → '),
    )

    // Assert: WEB-SPEC, Sections, item 2
    expect(chips).toEqual([
      '15 minutes → ',
      'After Lesson 10: Major and minor → /learn/10',
      'After Lesson 21: Keys and the circle of fifths → /learn/21',
      'After Lesson 23: Perfect, major, minor and the tritone → /learn/23',
      'Sound on → ',
    ])
  })

  it('plays the tune freely under the stage, outside the predict, and keeps the two endings locked until a choice', () => {
    // Arrange
    const page = doc()
    const predict = page.querySelector('#predict')

    // Act
    const plays = Array.from(
      page.querySelectorAll<HTMLButtonElement>('.hero-plays [data-play]'),
      (b) => [
        b.dataset.play,
        prose(b),
        b.dataset.free !== undefined,
        b.disabled,
      ],
    )

    // Assert: WEB-SPEC, Toys 2 and 3
    expect(plays).toEqual([
      ['tune', 'Play the tune, twice', true, false],
      ['end1', 'Play ending 1, with chords', false, true],
      ['end2', 'Play ending 2, with chords', false, true],
    ])
    expect(predict?.querySelectorAll('[data-play]')).toHaveLength(0)
    expect(
      Array.from(predict?.querySelectorAll('.choice') ?? [], (c) => [
        (c as HTMLElement).dataset.choice,
        words(c),
      ]),
    ).toEqual([
      ['major', 'It turns major'],
      ['minor', 'It stays minor'],
    ])
    expect(prose(predict?.querySelector('.lock-hint'))).toBe(
      'Choose an answer to unlock the two endings with their chords.',
    )
    expect(predict?.querySelector('.reveal')?.hasAttribute('hidden')).toBe(true)
  })

  it("holds back Raise te in the steps' toy until the choice, and in free play Raise te, Raise le and the chord's play, each under the steps' line", () => {
    // Arrange
    const page = doc()

    // Assert: WEB-SPEC, Toys 1; Step 3's Raise le and the toy's Play the
    // scale show with their step, and nothing else is held
    expect(controlsOf(page.querySelector('#toyMinor'))).toEqual([
      ['Raise te', true, false],
      ['Raise le', false, true],
      ['Play the scale, up and down', false, true],
      ['Treble', true, true],
      ['Bass', true, true],
      ['See it on the pitch line', true, true],
    ])
    // Free play: the four states on one card, every play, the chord held
    expect(controlsOf(page.querySelector('#freePlay'))).toEqual([
      ['Raise te', true, false],
      ['Raise le', true, false],
      ['Treble', true, true],
      ['Bass', true, true],
      ['See it on the pitch line', true, true],
      ['Play so, te, do', true, true],
      ['Play so, ti, do', true, true],
      ['Play the chord on so, then home', true, false],
      ['Play A harmonic minor, up and down', true, true],
      ['Play le to te, then le to ti', true, true],
      ['Play A melodic minor, up and down', true, true],
      ['Play A major, then melodic minor, going up', true, true],
      ['Play the scale, up and down', true, true],
      ['Play C major, then A minor', true, true],
      ['Play C minor', true, true],
    ])
    for (const root of ['#toyMinor', '#freePlay'])
      expect(prose(page.querySelector(`${root} [data-lock-line]`))).toBe(
        'Choose an answer at the top to unlock the rest of this figure.',
      )
  })

  it("puts each step's plays in its text, where LESSON.md writes them, and only the chord's waits for the reveal", () => {
    // Act
    const plays = Array.from(doc().querySelectorAll('.step'), (step) =>
      Array.from(
        step.querySelectorAll<HTMLButtonElement>('[data-step-play]'),
        (b) => [
          b.dataset.stepPlay,
          prose(b),
          b.closest('[hidden]') === null && !b.disabled,
        ],
      ),
    )

    // Assert: LESSON.md, Steps 1 to 4; Step 1's two figure plays work before
    // the choice, since the tune play already sounds their melody (FACTS 1a)
    expect(plays).toEqual([
      [
        ['so-te-do', 'Play so, te, do', true],
        ['so-ti-do', 'Play so, ti, do', true],
        ['chord-home', 'Play the chord on so, then home', false],
      ],
      [
        ['harmonic', 'Play A harmonic minor, up and down', true],
        ['le-pairs', 'Play le to te, then le to ti', true],
      ],
      [
        ['melodic', 'Play A melodic minor, up and down', true],
        ['major-melodic', 'Play A major, then melodic minor, going up', true],
      ],
      [
        ['relative', 'Play C major, then A minor', true],
        ['c-minor', 'Play C minor', true],
      ],
    ])
  })

  it("keeps Step 1's paragraph on the chord on so hidden behind its held line, with the paragraph's own play", () => {
    // Arrange
    const step = doc().querySelector('#step-1')

    // Act
    const held = step?.querySelector('[data-held-line]')
    const para = step?.querySelector('[data-chord-para]')

    // Assert: WEB-SPEC, Toys 1 and 3, the predict's second reveal element
    expect(prose(held)).toBe(
      'Choose an answer at the top, then hear both endings, to unlock this paragraph.',
    )
    expect(held?.hasAttribute('hidden')).toBe(false)
    expect(para?.hasAttribute('hidden')).toBe(true)
    expect(
      Array.from(para?.querySelectorAll('[data-step-play]') ?? [], (b) => [
        b.getAttribute('data-step-play'),
        prose(b),
      ]),
    ).toEqual([['chord-home', 'Play the chord on so, then home']])
  })

  it("names no chord or quality in a step heading, and the four words' plays are scales", () => {
    // Act
    const headings = Array.from(doc().querySelectorAll('.step h3'), (h) =>
      words(h),
    )
    const plays = Array.from(
      doc().querySelectorAll('#words [data-word-play]'),
      (b) => prose(b),
    )

    // Assert: LESSON.md's four headings; no figure plays a chord (FACTS 60)
    expect(headings).toEqual([
      'Why raise te?',
      'What does the raised note do to the scale?',
      'Is there more than one minor scale?',
      'Why do C major and A minor share a key signature?',
    ])
    expect(plays).toEqual([
      'Play: A natural minor',
      'Play: A harmonic minor',
      'Play: A melodic minor, up and down',
      'Play: C major, then A minor',
    ])
  })

  it('draws no staff for show: no section head carries one, and the body drops the background staff', () => {
    // Arrange
    const page = doc()

    // Assert: WEB-SPEC, Look; every staff on the page is a figure
    expect(page.querySelectorAll('.mv-staff, svg.clef')).toHaveLength(0)
    expect(page.body.classList.contains('season-2')).toBe(true)
    for (const m of modules) expect(m).not.toMatch(/engraveClefs\(/)
  })

  it("holds Sing it's series lines and this page's lines after each feeling", () => {
    // Arrange
    const card = doc().querySelector('#singCard')

    // Assert: LESSON.md, Sing it
    expect(words(card?.querySelector('.stop-line'))).toBe(
      'Stop immediately if anything feels uncomfortable.',
    )
    expect(words(card?.querySelector('[data-after="raised"]'))).toBe(
      'So, te, do, then so, ti, do: you just raised the seventh.',
    )
    expect(words(card?.querySelector('.turn'))).toMatch(
      /^Your turn: Merc sings so, te, do, a breath, then so, ti, do, slowly, in A minor/,
    )
    // nothing listens: no microphone is asked for on this page
    expect(PAGE).not.toMatch(/getUserMedia|data-mic/)
  })

  it('links the practice drills with the lesson, each in a tab of its own', () => {
    // Act
    const links = Array.from(
      doc().querySelectorAll<HTMLAnchorElement>('a[href*="lesson="]'),
    )

    // Assert: Ear Lab's Gravity and the Singing tab, on the card and in the
    // footer (WEB-SPEC, Practice links)
    expect(links.map((a) => a.getAttribute('href'))).toEqual([
      '/ear-lab?lesson=25',
      '/?lesson=25#/singing',
      '/ear-lab?lesson=25',
      '/?lesson=25#/singing',
    ])
    for (const a of links) {
      expect([a.target, a.rel]).toEqual(['_blank', 'noopener'])
      expect(words(a)).toMatch(/^mercurypitch\.com\//)
    }
  })

  it("holds the practice card's rest line, hidden at first, and the second drill that the rest version drops", () => {
    // Arrange
    const card = doc().querySelector('#practiseCard')

    // Act
    const rest = card?.querySelector('[data-ending="rest"]')
    const drill = card?.querySelector('[data-ending="practise"]')

    // Assert: Lesson 12's rest line, naming Sight-Singing (WEB-SPEC, Toys 5)
    expect(words(card?.querySelector('h3'))).toBe("Ear Lab's Gravity")
    expect(rest?.hasAttribute('hidden')).toBe(true)
    expect(words(rest)).toBe(
      'Rest today. Sight-Singing will be here when your voice feels comfortable: mercurypitch.com/#/singing, set to A and Harmonic Minor.',
    )
    expect(drill?.hasAttribute('hidden')).toBe(false)
    expect(
      drill?.querySelector('a[href="/?lesson=25#/singing"]'),
    ).not.toBeNull()
    // Gravity's own link stays in every ending
    expect(
      card
        ?.querySelector('a[href="/ear-lab?lesson=25"]')
        ?.closest('[data-ending]'),
    ).toBeNull()
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
    expect(image).toBe('learn/lesson-25-og.jpg')
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
