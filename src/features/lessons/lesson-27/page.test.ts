// ============================================================
// Lesson 27's page document — its spoken signs, its references, its order, nothing that answers a predict
// ============================================================
//
// learn/27.html is hand-written markup, so some of its promises are held
// here: every ♯ and ♭ its text prints is followed by its spoken name, the
// sign itself hidden from a screen reader, and no accessible name or share
// card carries one; every id a label or description points at exists, once;
// every button is a button, not a submit; there is no Watch section, because
// Lesson 27 has no film; the page opens on its cold open, the recall after
// it, shown to everyone, and before the three words; nothing a reader meets
// before the choice names the note that turns V into its seventh chord, and
// no step heading names F, F♯, an inversion or the bottom note (FACTS 1a,
// 1b); the hero has its four chips; Play V, then I plays freely under the
// stage, and the two with a fourth note wait for a choice; the steps' toy
// and free play hold back in their markup what would answer a predict, and
// Steps 1 to 3's text waits behind its held lines, Step 4's behind its own
// predict; no section head carries the faint staff and its clef, and the
// body drops the background's, since on this page a staff is always music
// (WEB-SPEC, Look); Sing it holds the series' lines and this page's; the
// practice links carry the lesson, and the practice card's rest line sends
// no one to sing; the share card its head names is in public/, at its size;
// and every line of its copy says only what the claims check passes
// (WEB-SPEC, Tests).

import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import { validateGuidedDynamicClaim } from '@/lib/guided-voice/claims'
import { PAGE, words } from './page-dom.test-fixtures'

const DIR = resolve(process.cwd(), 'src/features/lessons/lesson-27')

/**
 * A sign as the page writes it, however the formatter wraps it: hidden,
 * then said. The practice card's degrees keep their number with their sign,
 * ♯4 said "sharp 4".
 */
const SPOKEN_SIGN =
  /<span\s+aria-hidden="true"\s*>[♯♭]\d?<\/span\s*>\s*<span\s+class="sr"\s*>\s?(?:sharp|flat)(?: \d)?<\/span\s*>/g

/** The share card's words (WEB-SPEC, Sections, item 2). */
const SHARE_ALT =
  "The title card: Find Your Pitch, Lesson 27, Seventh chords and inversions, above Lesson 12's ring of rooms with the V room lit, between Merc and Tavi."

/**
 * What would tell a reader the cold open's answer: F as a note name, not F♯,
 * which the page writes "F♯ sharp" for a reader (FACTS 1a).
 */
const ANSWERS = [/\bF\b(?!♯)/]

/** What would tell a reader Step 4's answer: a chord turned over keeps its name (FACTS 1b). */
const TURNED = [/\binversions?\b/i, /\bbottom note\b/i, /\bstill C major\b/i]

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

describe("Lesson 27's page", () => {
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
      'Next: Does an extra note just make a chord richer?',
    )
  })

  it('makes every button a plain button', () => {
    // Act
    const buttons = Array.from(PAGE.matchAll(/<button\b[^>]*>/g), (m) => m[0])

    // Assert
    expect(buttons.length).toBeGreaterThan(40)
    for (const b of buttons) expect(b, b).toMatch(/type="button"/)
  })

  it('carries no Watch section: Lesson 27 has no film', () => {
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

    // Assert: CURIOSITY-MOMENTS § 3.1, as Lessons 2 and 4 to 25 run
    expect(at.every((i) => i > 0)).toBe(true)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
  })

  it('asks the recall of everyone, in a section of its own: Lessons 12 and 23 come first, so it needs no live wrapper', () => {
    // Act
    const hero = /<section class="hero[^"]*"[\s\S]*?<\/section>/.exec(PAGE)?.[0]

    // Assert
    expect(hero).toContain('id="predict"')
    expect(hero).not.toContain('id="recall"')
    expect(PAGE).not.toMatch(/data-if-live/)
    expect(PAGE).toMatch(/<section class="mv" id="recall"/)
  })

  it('names no F before the choice, nor the plays and choices that ask for it, and no step heading names F, F♯, an inversion or the bottom note (FACTS 1a, 1b)', () => {
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
    const headings = Array.from(page.querySelectorAll('.step h3'), (h) =>
      words(h),
    ).join(' ')
    const recall = words(page.querySelector('#recall'))
    const three = words(page.querySelector('#words'))
    // the steps, their held text and Step 4's predict aside, which wait
    for (const held of Array.from(
      page.querySelectorAll(
        '.steps-text [data-held], .steps-text [data-reveal4], #predict4',
      ),
    ))
      held.remove()
    const steps = words(page.querySelector('#stepsText'))
    const toy = words(page.querySelector('#toyRing'))

    // Assert
    for (const text of [hero, head, headings, recall, three, steps, toy])
      for (const answer of ANSWERS) expect(text).not.toMatch(answer)
    for (const text of [headings, three, steps, toy, hero])
      for (const answer of TURNED) expect(text).not.toMatch(answer)
    expect(words(reveal)).toMatch(/^Your guess F\. Stacked in C major/)
  })

  it("names the lesson's four chips: its minutes, Lessons 12 and 23 linked, and sound on", () => {
    // Act
    const chips = Array.from(
      doc().querySelectorAll('.hero ul.meta .chip'),
      (c) => [words(c), c.getAttribute('href')].join(' → '),
    )

    // Assert: WEB-SPEC, Sections, item 2
    expect(chips).toEqual([
      '15 minutes → ',
      'After Lesson 12: Chords and the four-chord song → /learn/12',
      'After Lesson 23: Perfect, major, minor and the tritone → /learn/23',
      'Sound on → ',
    ])
  })

  it('plays V, then I freely under the stage, outside the predict, and keeps the two with a fourth note locked until a choice', () => {
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
      ['vi', 'Play V, then I', true, false],
      ['f', 'Play it with F', false, true],
      ['fsharp', 'Play it with F♯ sharp', false, true],
    ])
    expect(predict?.querySelectorAll('[data-play]')).toHaveLength(0)
    expect(
      Array.from(predict?.querySelectorAll('.choice') ?? [], (c) => [
        (c as HTMLElement).dataset.choice,
        words(c),
      ]),
    ).toEqual([
      ['f', 'F'],
      ['fsharp', 'F♯ sharp'],
    ])
    expect(prose(predict?.querySelector('.lock-hint'))).toBe(
      'Choose an answer to unlock the two chords.',
    )
    expect(predict?.querySelector('.reveal')?.hasAttribute('hidden')).toBe(true)
  })

  it("holds back the V chip in the steps' toy until the choice, and Step 4's chips and Turn over until Step 4's", () => {
    // Arrange
    const page = doc()

    // Assert: WEB-SPEC, Toys 1; Step 4's row shows with its step
    expect(controlsOf(page.querySelector('#toyRing'))).toEqual([
      ['I', true, true],
      ['V', true, false],
      ['Add the seventh', true, true],
      ['I', false, false],
      ['V7', false, false],
      ['Turn over', false, false],
      ['Treble', true, true],
      ['Bass', true, true],
      ['See it on the pitch line', true, true],
    ])
    expect(prose(page.querySelector('#toyRing [data-lock-line]'))).toBe(
      'Choose an answer at the top to unlock the rest of this figure.',
    )
  })

  it("holds back free play's V chip and V7's plays until the cold open's choice, and Turn over until Step 4's, each under its line", () => {
    // Arrange
    const page = doc()

    // Assert: WEB-SPEC, Toys 1, Free play
    expect(controlsOf(page.querySelector('#freePlay'))).toEqual([
      ['I', true, true],
      ['V', true, false],
      ['Add the seventh', true, true],
      ['Turn over', true, false],
      ['Treble', true, true],
      ['Bass', true, true],
      ['See it on the pitch line', true, true],
      ['Play C, E and G, then C, E, G and B', true, true],
      ['Play G, B and D, then G, B, D and F', true, false],
      ['Play the major seventh chord, then the dominant seventh', true, false],
      ['Play the dominant seventh, then I', true, false],
      ['Play B and F, then C and E', true, false],
      ['Play V7, then I', true, false],
    ])
    expect(
      Array.from(page.querySelectorAll('#freePlay [data-lock-line]'), (l) =>
        prose(l),
      ),
    ).toEqual([
      'Choose an answer at the top to unlock the rest of this figure.',
      'Choose an answer in Step 4 to unlock this.',
    ])
  })

  it("puts each step's plays in its text, where LESSON.md writes them, and holds all but I's until the reveal", () => {
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

    // Assert: LESSON.md, Steps 1 to 3; Step 4's two are its predict's
    expect(plays).toEqual([
      [
        ['i-seventh', 'Play C, E and G, then C, E, G and B', true],
        ['v-seventh', 'Play G, B and D, then G, B, D and F', false],
      ],
      [
        [
          'sevenths',
          'Play the major seventh chord, then the dominant seventh',
          false,
        ],
        ['dom-home', 'Play the dominant seventh, then I', false],
      ],
      [
        ['tritone', 'Play B and F, then C and E', false],
        ['v7-home', 'Play V7, then I', false],
      ],
      [],
    ])
  })

  it("keeps Step 1's paragraph on so, and Steps 2 and 3 under their headings, hidden behind their held lines", () => {
    // Arrange
    const page = doc()

    // Act
    const held = Array.from(page.querySelectorAll('[data-held-line]'), (l) => [
      l.closest('.step')?.id,
      prose(l),
      l.hasAttribute('hidden'),
    ])

    // Assert: WEB-SPEC, Toys 3, the cold open's second to fourth reveal elements
    expect(held).toEqual([
      [
        'step-1',
        'Choose an answer at the top, then hear both chords, to unlock this paragraph.',
        false,
      ],
      [
        'step-2',
        'Choose an answer at the top, then hear both chords, to unlock this step.',
        false,
      ],
      [
        'step-3',
        'Choose an answer at the top, then hear both chords, to unlock this step.',
        false,
      ],
    ])
    for (const n of [1, 2, 3])
      expect(
        page
          .querySelector(`#step-${n} [data-held="${n}"]`)
          ?.hasAttribute('hidden'),
      ).toBe(true)
    expect(
      words(page.querySelector('#step-3 [data-held="3"] details')),
    ).toMatch(/^Go deeper No fifth\./)
  })

  it("waits Step 4's predict for the cold open's choice, and its text for its own reveal", () => {
    // Arrange
    const predict = doc().querySelector('#predict4')

    // Act
    const controls = Array.from(
      predict?.querySelectorAll<HTMLButtonElement>('button') ?? [],
      (b) => [prose(b), b.disabled],
    )

    // Assert: WEB-SPEC, Toys 3; FACTS 48
    expect(controls).toEqual([
      ['Still C major', true],
      ['E minor', true],
      ['Play C, E, G, then E, G, C', true],
      ['Play E, G, C, then E, G, B', true],
    ])
    expect(prose(predict?.querySelector('.lock-hint'))).toBe(
      'Choose an answer at the top first.',
    )
    expect(predict?.querySelector('.reveal')?.hasAttribute('hidden')).toBe(true)
    const after = predict?.parentElement?.querySelector('[data-reveal4]')
    expect(after?.hasAttribute('hidden')).toBe(true)
    expect(words(after)).toMatch(/^That holds in root position\./)
  })

  it("names the four step headings, and the three words' plays stand on C", () => {
    // Act
    const headings = Array.from(doc().querySelectorAll('.step h3'), (h) =>
      words(h),
    )
    const plays = Array.from(
      doc().querySelectorAll('#words [data-word-play]'),
      (b) => prose(b),
    )

    // Assert: LESSON.md's four headings; no word is built on G (FACTS 41)
    expect(headings).toEqual([
      'How do you build a seventh chord?',
      'Does an extra note just make a chord richer?',
      'Why does the dominant seventh pull home?',
      'Which note names a chord?',
    ])
    expect(plays).toEqual([
      'Play: C, E, G and B',
      'Play: C up to B',
      'Play: C up to B♭ flat',
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
    expect(words(card?.querySelector('[data-after="home"]'))).toBe(
      'So, ti, re, fa, then mi, then do: the dominant seventh, going home.',
    )
    expect(words(card?.querySelector('.turn'))).toMatch(
      /^Your turn: Merc sings so, ti, re and fa, slowly, then mi, then do, in G/,
    )
    expect(words(card?.querySelector('.listen-line'))).toBe(
      'Good call. Merc sings so, ti, re, fa, then mi, then do, and nothing listens. Rest your voice.',
    )
    // nothing listens: no microphone is asked for on this page
    expect(PAGE).not.toMatch(/getUserMedia|data-mic/)
  })

  it('links the practice drills with the lesson, each in a tab of its own', () => {
    // Act
    const links = Array.from(
      doc().querySelectorAll<HTMLAnchorElement>('a[href*="lesson="]'),
    )

    // Assert: Chord Stacker and Ear Lab's Stack, on the card and in the
    // footer (WEB-SPEC, Practice links)
    expect(links.map((a) => a.getAttribute('href'))).toEqual([
      '/pitch-training?lesson=27',
      '/ear-lab?lesson=27',
      '/pitch-training?lesson=27',
      '/ear-lab?lesson=27',
    ])
    for (const a of links) {
      expect([a.target, a.rel]).toEqual(['_blank', 'noopener'])
      expect(words(a)).toMatch(/^mercurypitch\.com\//)
    }
  })

  it("holds the practice card's rest line, hidden at first, in place of Chord Stacker, and keeps Stack in every ending", () => {
    // Arrange
    const card = doc().querySelector('#practiseCard')

    // Act
    const rest = card?.querySelector('[data-ending="rest"]')
    const drill = card?.querySelector('[data-ending="practise"]')

    // Assert: Lesson 12's rest line, naming Chord Stacker (FACTS 70)
    expect(words(card?.querySelector('h3'))).toBe('Chord Stacker')
    expect(rest?.hasAttribute('hidden')).toBe(true)
    expect(words(rest)).toBe(
      'Rest today. Chord Stacker will be here when your voice feels comfortable: mercurypitch.com/pitch-training, then tap Chord Stacker.',
    )
    expect(rest?.querySelector('a')).toBeNull()
    expect(drill?.hasAttribute('hidden')).toBe(false)
    expect(
      drill?.querySelector('a[href="/pitch-training?lesson=27"]'),
    ).not.toBeNull()
    // Stack asks for no voice: its link stays in every ending
    expect(
      card
        ?.querySelector('a[href="/ear-lab?lesson=27"]')
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
    expect(image).toBe('learn/lesson-27-og.jpg')
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
