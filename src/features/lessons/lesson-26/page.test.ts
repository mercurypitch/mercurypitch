// ============================================================
// Lesson 26's page document — its spoken signs, its references, its order, nothing that answers the predict
// ============================================================
//
// learn/26.html is hand-written markup, so some of its promises are held
// here: every ♯ its text prints is followed by its spoken name, the sign
// itself hidden from a screen reader, and no accessible name or share card
// carries one; every id a label or description points at exists, once;
// every button is a button, not a submit; there is no Watch section,
// because Lesson 26 has no film; the page opens on its cold open, the
// recall after it, shown to everyone, and before the three words; nothing a
// reader meets before the choice says whether a copy moved four semitones
// stays in the key, or that a key's thirds come in two sizes, and no step
// heading does (FACTS 1a); the hero has its six chips; Play the tune plays
// freely under the stage, and Play them together waits for a choice; the
// steps' toy and free play hold every control and every play in the steps'
// text under their lines, and Steps 1 and 2 wait behind their held lines;
// no section head carries the faint staff and its clef, and the body drops
// the background's (WEB-SPEC, Look); Sing it holds the series' lines and
// this page's; the practice links carry the lesson, and the practice card's
// rest line sends no one to sing; the share card its head names is in
// public/, at its size; and every line of its copy says only what the
// claims check passes (WEB-SPEC, Tests).

import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import { validateGuidedDynamicClaim } from '@/lib/guided-voice/claims'
import { PAGE, words } from './page-dom.test-fixtures'

const DIR = resolve(process.cwd(), 'src/features/lessons/lesson-26')

/** A sign as the page writes it, however the formatter wraps it: hidden, then said. */
const SPOKEN_SIGN =
  /<span\s+aria-hidden="true"\s*>[♯♭]<\/span\s*>\s*<span\s+class="sr"\s*>\s?(?:sharp|flat)<\/span\s*>/g

/** The share card's words (WEB-SPEC, Sections, item 2). */
const SHARE_ALT =
  'The title card: Find Your Pitch, Lesson 26, A second voice, above the start of ‘Twinkle’ drawn as beads on rows, between Merc and Tavi.'

/**
 * What would tell a reader the cold open's answer: a copy that leaves the
 * key, the copy's sharps, or a key's thirds in two sizes (FACTS 1a).
 */
const ANSWERS = [
  /\bleaves? the key\b/i,
  /\boff the key\b/i,
  /\boutside C major\b/i,
  /[♯]|\bsharp\b/i,
  /\btwo sizes\b|\bboth sizes\b|\bone size\b|\bnot all one size\b/i,
  /\b3 semitones\b|\bthree semitones\b|\bminor third\b/i,
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

describe("Lesson 26's page", () => {
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
      'Next: Is a harmony the tune moved up?',
    )
  })

  it('makes every button a plain button', () => {
    // Act
    const buttons = Array.from(PAGE.matchAll(/<button\b[^>]*>/g), (m) => m[0])

    // Assert
    expect(buttons.length).toBeGreaterThan(40)
    for (const b of buttons) expect(b, b).toMatch(/type="button"/)
  })

  it('carries no Watch section: Lesson 26 has no film', () => {
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

  it('asks the recall of everyone, in a section of its own: Lessons 12 and 24 come first, so it needs no live wrapper', () => {
    // Act
    const hero = /<section class="hero[^"]*"[\s\S]*?<\/section>/.exec(PAGE)?.[0]

    // Assert
    expect(hero).toContain('id="predict"')
    expect(hero).not.toContain('id="recall"')
    expect(PAGE).not.toMatch(/data-if-live/)
    expect(PAGE).toMatch(/<section class="mv" id="recall"/)
  })

  it('says nothing before the choice of a copy that leaves the key or of thirds in two sizes, and no step heading does (FACTS 1a)', () => {
    // Arrange: everything a reader meets before the choice, the choices, the
    // reveal and the plays that answer it aside
    const page = doc()
    const reveal = page.querySelector('#predict .reveal')
    reveal?.remove()
    for (const c of Array.from(page.querySelectorAll('#predict .choice')))
      c.remove()
    const hero = words(page.querySelector('.hero'))
    // the head a learner meets; the structured data, which no learner
    // meets, names the answer (WEB-SPEC, Sections, item 2)
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
    // Steps 1 and 2's held text aside, which waits for the reveal
    for (const held of Array.from(
      page.querySelectorAll('.steps-text [data-held]'),
    ))
      held.remove()
    const steps = words(page.querySelector('#stepsText'))
    const toy = words(page.querySelector('#toyTune'))
    const free = words(page.querySelector('#freePlay'))

    // Assert
    for (const text of [hero, head, headings, recall, three, steps, toy, free])
      for (const answer of ANSWERS) expect(text).not.toMatch(answer)
    expect(words(reveal)).toMatch(/^Your guess Some notes leave the key\./)
  })

  it("names the lesson's six chips: its minutes, Lessons 12 and 24 linked, sound on, and the microphone and headphones optional", () => {
    // Act
    const chips = Array.from(
      doc().querySelectorAll('.hero ul.meta .chip'),
      (c) => [words(c), c.getAttribute('href')].join(' → '),
    )

    // Assert: WEB-SPEC, Sections, item 2
    expect(chips).toEqual([
      '16 minutes → ',
      'After Lesson 12: Chords and the four-chord song → /learn/12',
      'After Lesson 24: Harmony against a drone → /learn/24',
      'Sound on → ',
      'Microphone optional → ',
      'Headphones optional → ',
    ])
  })

  it('plays the tune freely under the stage, outside the predict, and keeps Play them together locked until a choice', () => {
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

    // Assert: WEB-SPEC, Toys 1
    expect(plays).toEqual([
      ['tune', 'Play the tune', true, false],
      ['together', 'Play them together', false, true],
    ])
    expect(
      Array.from(predict?.querySelectorAll('.choice') ?? [], (c) => [
        (c as HTMLElement).dataset.choice,
        words(c),
      ]),
    ).toEqual([
      ['fits', 'Every note fits the key'],
      ['leaves', 'Some notes leave the key'],
    ])
    expect(prose(predict?.querySelector('.lock-hint'))).toBe(
      'Choose an answer to unlock the copy.',
    )
    // the reveal's own play, the key's copy, waits inside it
    const reveal = predict?.querySelector('.reveal')
    expect(reveal?.hasAttribute('hidden')).toBe(true)
    expect(prose(reveal?.querySelector('[data-play="key"]'))).toBe(
      'Play the copy that stays in the key',
    )
  })

  it("holds every control of the steps' toy under its line until the choice", () => {
    // Arrange
    const toy = doc().querySelector('#toyTune')

    // Assert: WEB-SPEC, Toys 2; every state shows the answer, so the figure
    // draws the hero's "Twinkle" and every control waits, its name kept
    expect(controlsOf(toy)).toEqual([
      ['Step down', false],
      ['Step up', false],
      ["C major's thirds", false],
      ['Four semitones up', false],
      ['Play', false],
      ['Above', false],
      ['Below', false],
      ['Play above', false],
      ['Play below', false],
      ['Play Merc and Tavi', false],
      ['Play both', false],
    ])
    expect(prose(toy?.querySelector('[data-lock-line]'))).toBe(
      'Choose an answer at the top to unlock this figure.',
    )
    expect(toy?.querySelector('[data-lock-line]')?.hasAttribute('hidden')).toBe(
      false,
    )
    expect(
      toy?.querySelector('[data-tune-canvas]')?.getAttribute('aria-label'),
    ).toBe(
      '‘Twinkle’ in C major: two lines of seven notes, from C 4 up to A 4.',
    )
  })

  it('holds free play the same, with its state switch, each state named by its step', () => {
    // Arrange
    const free = doc().querySelector('#freePlay')

    // Act
    const states = Array.from(
      free?.querySelectorAll<HTMLButtonElement>('[data-state]') ?? [],
      (b) => [words(b), b.getAttribute('aria-label'), b.disabled],
    )

    // Assert: WEB-SPEC, Toys 2, Free play
    expect(states).toEqual([
      ['1', "1: What's a third above each note?", true],
      ['2', '2: Is a harmony the tune moved up?', true],
      ['3', '3: Above or below?', true],
      ['4', "4: What's the note in the middle?", true],
    ])
    expect(
      Array.from(
        free?.querySelectorAll<HTMLButtonElement>('button') ?? [],
      ).every((b) => b.disabled),
    ).toBe(true)
    expect(prose(free?.querySelector('[data-lock-line]'))).toBe(
      'Choose an answer at the top to unlock this figure.',
    )
  })

  it("puts each step's plays in its text, where LESSON.md writes them, each held until the choice", () => {
    // Act
    const plays = Array.from(
      doc().querySelectorAll<HTMLButtonElement>('[data-step-play]'),
      (b) => [b.closest('.step')?.id, b.dataset.stepPlay, prose(b), b.disabled],
    )

    // Assert: LESSON.md, Steps 1 to 4
    expect(plays).toEqual([
      ['step-1', 'thirds', 'Play the thirds up the scale', true],
      ['step-2', 'copy', 'Play ‘Twinkle’ with its third above', true],
      ['step-3', 'above', 'Play above', true],
      ['step-3', 'below', 'Play below', true],
      ['step-3', 'duet', 'Play Merc and Tavi', true],
      ['step-4', 'part-chord', 'Play mi, fa, so over the chord', true],
      ['step-4', 'tune-chord', 'Play do, re, mi over the chord', true],
    ])
  })

  it('keeps Steps 1 and 2 under their headings hidden behind their held lines', () => {
    // Arrange
    const page = doc()

    // Act
    const held = [1, 2].map((n) => [
      prose(page.querySelector(`[data-held-line="${n}"]`)),
      page.querySelector(`[data-held="${n}"]`)?.hasAttribute('hidden'),
      page.querySelector(`[data-held="${n}"]`)?.closest('.step')?.id,
    ])

    // Assert: WEB-SPEC, Toys 1; FACTS 41
    expect(held).toEqual([
      ['Hear the copy at the top to unlock this step.', true, 'step-1'],
      ['Hear the copy at the top to unlock this step.', true, 'step-2'],
    ])
    // Step 2's mix-up card, its Try and its Notice wait with it
    expect(
      page.querySelector('#step-2 .mixup')?.closest('[data-held]'),
    ).not.toBeNull()
  })

  it("names the four step headings, and the three words' plays", () => {
    // Act
    const headings = Array.from(doc().querySelectorAll('.step h3'), (h) =>
      words(h),
    )
    const plays = Array.from(
      doc().querySelectorAll('#words [data-word-play]'),
      (b) => prose(b),
    )

    // Assert: LESSON.md's four headings and the words' plays
    expect(headings).toEqual([
      "What's a third above each note?",
      'Is a harmony the tune moved up?',
      'Above or below?',
      "What's the note in the middle?",
    ])
    expect(plays).toEqual([
      'Play: a tune, then a part with it',
      'Play: a C major chord, then E over it',
      'Play: E, F and G over a C major chord',
    ])
  })

  it('draws no staff, and none for show: no section head carries one, and the body drops the background staff', () => {
    // Arrange
    const page = doc()

    // Assert: WEB-SPEC, Look
    expect(
      page.querySelectorAll('.mv-staff, svg.clef, [data-staff-svg]'),
    ).toHaveLength(0)
    expect(page.body.classList.contains('season-2')).toBe(true)
    for (const m of modules) expect(m).not.toMatch(/engraveClefs\(/)
  })

  it("holds Sing it's series lines and this page's", () => {
    // Arrange
    const card = doc().querySelector('#singCard')

    // Assert: LESSON.md, Sing it
    expect(words(card?.querySelector('.stop-line'))).toBe(
      'Stop immediately if anything feels uncomfortable.',
    )
    expect(words(card?.querySelector('.listen-line'))).toBe(
      'Good call. Merc sings the tune and its harmony, and nothing listens. Rest your voice.',
    )
    expect(words(card?.querySelector('[data-phones-check] p'))).toBe(
      "Put on headphones to keep Merc's part out of the microphone, with the volume low enough to hear yourself.",
    )
    expect(words(card?.querySelector('.turn'))).toBe(
      "Your turn: la ti do ti la, a third below the tune. First hear it alone; then the click counts in one bar and Merc's part begins. Sing yours with it, on the syllables or on “ooh”, and hold your last note until Merc's ends. If a note slips, come in on the next one. Sing at about speaking volume.",
    )
    expect(words(card?.querySelector('[data-quiet-failed]'))).toBe(
      "The microphone heard a note during Merc's part. Check your headphones, then press Start again and stay quiet.",
    )
    expect(words(card?.querySelector('[data-after="swap"]'))).toBe(
      'Now swap: sing the tune while Merc sings your part.',
    )
    // Start is the only control that asks for the microphone
    expect(
      Array.from(card?.querySelectorAll('[data-sing="start"]') ?? [], (b) =>
        prose(b),
      ),
    ).toEqual(['Start', 'Start'])
  })

  it('links the practice drills with the lesson, each in a tab of its own', () => {
    // Act
    const links = Array.from(
      doc().querySelectorAll<HTMLAnchorElement>('a[href*="lesson="]'),
    )

    // Assert: Harmony Stack and Drone Intonation, on the card and in the
    // footer (WEB-SPEC, Practice links)
    expect(links.map((a) => a.getAttribute('href'))).toEqual([
      '/jam?lesson=26',
      '/exercises/thirds-on-a-drone?lesson=26',
      '/jam?lesson=26',
      '/exercises/thirds-on-a-drone?lesson=26',
    ])
    for (const a of links) {
      expect([a.target, a.rel]).toEqual(['_blank', 'noopener'])
      expect(words(a)).toMatch(/^mercurypitch\.com\//)
    }
  })

  it("holds the practice card's rest line, hidden at first, in place of both drills, which ask for the voice", () => {
    // Arrange
    const card = doc().querySelector('#practiseCard')

    // Act
    const rest = card?.querySelector('[data-ending="rest"]')
    const drills = card?.querySelector('[data-ending="practise"]')

    // Assert: Lesson 10's rest form, naming Harmony Stack (FACTS 66)
    expect(words(card?.querySelector('h3'))).toBe('Harmony Stack, in Jam')
    expect(rest?.hasAttribute('hidden')).toBe(true)
    expect(words(rest)).toBe(
      'Rest today. Harmony Stack will be here when your voice feels comfortable: mercurypitch.com/jam',
    )
    expect(rest?.querySelector('a')).toBeNull()
    expect(drills?.hasAttribute('hidden')).toBe(false)
    expect(drills?.querySelectorAll('a.addr')).toHaveLength(2)
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
    expect(image).toBe('learn/lesson-26-og.jpg')
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
