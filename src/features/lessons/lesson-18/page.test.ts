// ============================================================
// Lesson 18's page document — its references, its order, nothing that answers the predict
// ============================================================
//
// learn/18.html is hand-written markup, so some of its promises are held
// here: every id a label or description points at exists, once; every
// button is a button, not a submit; there is no Watch section, because
// Lesson 18 has no film; the page opens on its cold open, the recall after
// it, shown to everyone, and before the four words; nothing a reader meets
// before the cold open's choice outside the predict itself says what
// reading note by note costs (FACTS 1a; WEB-SPEC, Sections, item 2): the
// head, the share card, the title, the promise, the sound gate and the
// structured data, nor the step headings, the section headings, the recall
// or the four words; the hero has its five chips; Merc's read waits for a
// choice, and his way waits inside the reveal; the four steps share the
// reading staff, whose Step 1 reads stay locked until the choice, in the
// step and in free play (Toys 2); no section head carries the faint staff
// and its clef, and the body drops the background's, since a Season 2 page
// draws no staff for show (WEB-SPEC, Look); Sing it holds the series' lines
// and this page's two tunes; the practice links carry the lesson, the rest
// version sends no one to sing, and The Chart stays on offer under it; the
// share card its head names is in public/, at its size; and every line of
// its copy says only what the claims check passes.

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import { validateGuidedDynamicClaim } from '@/lib/guided-voice/claims'
import { PAGE, words } from './page-dom.test-fixtures'

/** The share card's words (WEB-SPEC, Sections, item 2). */
const SHARE_ALT =
  'The title card: Find Your Pitch, Lesson 18, Read and sing a whole line, above a bass staff of two bars over a row of beat pads, between Merc and Tavi.'

/** What would say what reading note by note costs: notes coming late, falling behind, or never coming (FACTS 1a). */
const COST =
  /\blate\b|\bbehind\b|\blag|only (?:the )?first four|never (?:came|come|comes)|\bfalls? back/i

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

const doc = (): Document => new DOMParser().parseFromString(PAGE, 'text/html')

/** An element's words with its icons left out, whose markup holds only spaces. */
const prose = (e: Element | null | undefined): string => {
  const copy = e?.cloneNode(true) as Element | undefined
  copy?.querySelectorAll('svg').forEach((svg) => svg.remove())
  return words(copy)
}

/** Whether a control can be used: neither disabled nor marked unavailable. */
const usable = (e: Element): boolean =>
  !e.hasAttribute('disabled') && e.getAttribute('aria-disabled') !== 'true'

/** Which button of a radio group of buttons is pressed. */
const pressed = (group: Element | null, attr: string): string[] =>
  Array.from(
    group?.querySelectorAll(`[${attr}][aria-pressed="true"]`) ?? [],
    (b) => b.getAttribute(attr) ?? '',
  )

/** A figure's plays and marks: what each plays, its step, its words and whether it can be used. */
const playsOf = (root: Element | null): (string | boolean | null)[][] =>
  Array.from(
    root?.querySelectorAll('[data-read-play], [data-read-mark]') ?? [],
    (b) => [
      b.getAttribute('data-read-play') ?? b.getAttribute('data-read-mark'),
      b.getAttribute('data-part'),
      words(b),
      usable(b),
    ],
  )

describe("Lesson 18's page", () => {
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

  it('makes every button a button, never a submit', () => {
    // Arrange
    const buttons = Array.from(doc().querySelectorAll('button'))

    // Assert
    expect(buttons.length).toBeGreaterThan(60)
    for (const b of buttons) expect(b.getAttribute('type')).toBe('button')
  })

  it("carries the step deck's way through: Previous, and Next naming Step 2", () => {
    // Arrange
    const nav = doc().getElementById('deckNav')

    // Assert: the deck renames this label at every step (kit/step-deck.ts)
    expect(nav?.querySelector('[data-step-go="-1"]')).not.toBeNull()
    expect(words(nav?.querySelector('[data-step-go="1"] #deckNextLabel'))).toBe(
      'Next: What should my eye look for?',
    )
  })

  it('opens on its cold open, then the recall, the words, the steps, Sing it, the check, the Wrap and the explorer, with no Watch section', () => {
    // Act
    const order = Array.from(
      doc().querySelectorAll('main > section'),
      (s) => s.id || s.className.split(' ')[0],
    )

    // Assert: Lesson 2's order (FACTS 7); Lesson 18 has no film
    expect(order).toEqual([
      'hero',
      'recall',
      'words',
      'lesson',
      'sing',
      'check',
      'wrap',
      'explorer',
    ])
    expect(doc().getElementById('watch')).toBeNull()
  })

  it('says nothing of what reading note by note costs in its head, its share card, its title, its promise, its sound gate or its structured data', () => {
    // Arrange: what a reader meets before the cold open's choice
    const d = doc()
    const head = [
      d.title,
      metaOf('description'),
      metaOf('og:title'),
      metaOf('og:description'),
      metaOf('twitter:title'),
      metaOf('twitter:description'),
      metaOf('og:image:alt'),
      metaOf('twitter:image:alt'),
      words(d.getElementById('hook')),
      words(d.querySelector('.l18-hero .promise')),
      words(d.getElementById('gateText')),
      ...Array.from(
        d.querySelectorAll('script[type="application/ld+json"]'),
        (s) => s.textContent ?? '',
      ),
    ]

    // Assert: FACTS 1a; WEB-SPEC, Sections, item 2
    expect(head.every((t) => t !== undefined && t !== '')).toBe(true)
    for (const t of head) expect(t, t).not.toMatch(COST)
    expect([metaOf('og:image:alt'), metaOf('twitter:image:alt')]).toEqual([
      SHARE_ALT,
      SHARE_ALT,
    ])
    expect(d.title).toBe('How to sight-sing a melody in time | MercuryPitch')
    expect(metaOf('description')).toHaveLength(149)
  })

  it('says nothing of it in its step headings, its section headings, the recall or the four words, and keeps the reveal hidden', () => {
    // Arrange
    const d = doc()
    const headings = Array.from(d.querySelectorAll('.step h3'), words)
    const parts = [
      ...Array.from(d.querySelectorAll('main .mv-head'), (h) => words(h)),
      words(d.getElementById('recall')),
      words(d.getElementById('words')),
    ]

    // Assert: the lesson menu lists these headings from the first paint;
    // Step 1's asks the question, and its text, further down, answers it
    expect(headings).toEqual([
      'Do I have to name every note?',
      'What should my eye look for?',
      'How do I keep the beat going?',
      'What do the other marks ask for?',
    ])
    for (const t of [...headings, ...parts]) expect(t, t).not.toMatch(COST)
    expect(d.querySelector('#predict .reveal')?.hasAttribute('hidden')).toBe(
      true,
    )
  })

  it('has its five chips, linking Lessons 16 and 17', () => {
    // Arrange
    const d = doc()
    const chips = Array.from(d.querySelectorAll('.l18-hero .meta > li'), words)

    // Assert: FACTS 2 and 3
    expect(chips).toEqual([
      '16 minutes',
      'After Lesson 16: Sing what you see',
      'After Lesson 17: How long is a note?',
      'Sound on',
      'Microphone optional',
    ])
    expect(
      Array.from(d.querySelectorAll('.l18-hero .meta a'), (a) =>
        a.getAttribute('href'),
      ),
    ).toEqual(['/learn/16', '/learn/17'])
  })

  it("holds Merc's read for a choice, under the bass staff of two bars, and keeps his way inside the reveal", () => {
    // Arrange
    const d = doc()
    const plays = Array.from(
      d.querySelectorAll<HTMLButtonElement>('.hero-plays [data-play]'),
    )

    // Assert: WEB-SPEC, Toys 1
    expect(plays.map((b) => [b.dataset.play, words(b), usable(b)])).toEqual([
      ['read', 'Watch Merc read', false],
    ])
    expect(d.querySelectorAll('.hero-plays [data-free]')).toHaveLength(0)
    expect(
      Array.from(d.querySelectorAll('#predict [data-choice]'), (c) => [
        c.getAttribute('data-choice'),
        words(c),
      ]),
    ).toEqual([
      ['seven', 'All seven notes, each a beat late'],
      ['four', 'Only the first four'],
    ])
    expect(words(d.querySelector('#predict .lock-hint'))).toBe(
      "Choose an answer to unlock Merc's read.",
    )
    expect(
      d.querySelector('[data-hero-staff]')?.getAttribute('aria-label'),
    ).toBe('Bass staff, two bars of 4/4: G, A, B, A, then G, B and a long D')
    expect(
      Array.from(d.querySelectorAll('[data-play="way"]'), (b) =>
        b.closest('#predict .reveal') === null ? 'outside' : words(b),
      ),
    ).toEqual(["Read Merc's way"])
  })

  it('puts the four steps on one toy, the reading staff on the bass clef with the names off, Count on and the pitch line off, and locks its two reads behind the lock line', () => {
    // Arrange
    const d = doc()
    const toy = d.getElementById('toyRead')

    // Assert: WEB-SPEC, Toys 2; the bass clef when no voice is stored
    expect(
      Array.from(d.querySelectorAll('#stepsStage [data-toy]'), (t) => [
        t.getAttribute('data-toy'),
        t.id,
      ]),
    ).toEqual([['1', 'toyRead']])
    expect(
      pressed(toy?.querySelector('[data-staff-clef]') ?? null, 'data-clef'),
    ).toEqual(['bass'])
    expect(
      pressed(toy?.querySelector('[data-staff-names]') ?? null, 'data-names'),
    ).toEqual(['off'])
    expect(
      toy?.querySelector('[data-read-count]')?.getAttribute('aria-pressed'),
    ).toBe('true')
    expect(
      toy?.querySelector('[data-staff-lanes]')?.getAttribute('aria-pressed'),
    ).toBe('false')
    // each play names its step; Step 1's wait for the predict's choice
    expect(playsOf(toy)).toEqual([
      ['by-name', '1', 'Read note by note', false],
      ['way', '1', "Read Merc's way", false],
      ['tune-a', '2', 'Play tune A', true],
      ['tune-b', '2', 'Play tune B', true],
      ['count-in', '3', 'Play with the count-in', true],
      ['dynamics', '4', 'p, then f', true],
      ['hairpins', '4', 'Hairpins', true],
      ['staccato', '4', 'Staccato', true],
      ['slur', '4', 'Slur', true],
      ['breath', '4', 'Breath mark', true],
    ])
    expect(words(toy?.querySelector('[data-read-lock]'))).toBe(
      'Choose an answer at the top of the page to unlock this.',
    )
    // Step 3's tap pad, which never scores, as Lesson 17's reads
    const tap = toy?.querySelector('[data-read-tap]')
    expect([
      words(tap?.firstChild as Element),
      words(tap?.querySelector('small')),
    ]).toEqual(['Tap', 'or press Space'])
    // no step has a Go deeper drawer (Length)
    expect(d.querySelectorAll('#lesson details.deeper')).toHaveLength(0)
  })

  it("gives free play every play from the steps, Step 1's still locked behind the same line", () => {
    // Arrange
    const free = doc().getElementById('freePlay')

    // Assert: WEB-SPEC, Toys 2, state 5
    expect(
      playsOf(free).map(([kind, , label, can]) => [kind, label, can]),
    ).toEqual([
      ['by-name', 'Read note by note', false],
      ['way', "Read Merc's way", false],
      ['tune-a', 'Play tune A', true],
      ['tune-b', 'Play tune B', true],
      ['count-in', 'Play with the count-in', true],
      ['dynamics', 'p, then f', true],
      ['hairpins', 'Hairpins', true],
      ['staccato', 'Staccato', true],
      ['slur', 'Slur', true],
      ['breath', 'Breath mark', true],
    ])
    expect(words(free?.querySelector('[data-read-lock]'))).toBe(
      'Choose an answer at the top of the page to unlock this.',
    )
    for (const control of [
      '[data-staff-clef]',
      '[data-staff-names]',
      '[data-read-count]',
      '[data-staff-lanes]',
    ])
      expect(free?.querySelector(control), control).not.toBeNull()
  })

  it('gives its four words a figure and a play each', () => {
    // Arrange
    const tickets = Array.from(doc().querySelectorAll('#words .ticket'))

    // Assert: WEB-SPEC, Toys 3
    expect(
      tickets.map((t) => [
        words(t.querySelector('h3')),
        t.querySelector('svg.word-fig') !== null,
        words(t.querySelector('[data-word-play]')),
      ]),
    ).toEqual([
      ['Count-in', true, 'Play: four clicks at 60 BPM'],
      ['Dynamics', true, 'Play: mi, re, do, quiet, then loud'],
      ['Staccato', true, 'Play: do, mi, so, staccato'],
      ['Slur', true, 'Play: do, re, mi, slurred'],
    ])
    for (const t of tickets) {
      const play = t.querySelector('[data-word-play]')
      expect(play !== null && usable(play)).toBe(true)
    }
  })

  it('draws no staff for show: no section head carries the faint staff, and the body drops the background', () => {
    // Arrange
    const d = doc()

    // Assert: WEB-SPEC, Look
    expect(d.querySelectorAll('.mv-staff, svg.clef')).toHaveLength(0)
    expect(d.body.classList.contains('season-2')).toBe(true)
  })

  it("holds Sing it's series lines and this page's two tunes", () => {
    // Arrange
    const sing = doc().getElementById('sing')
    const text = words(sing)

    // Assert: LESSON.md, Sing it
    for (const line of [
      'Sore, hoarse or unwell today? Just listen along.',
      "I'm comfortable: let's sing",
      'Just listen today',
      'Good call. Merc sings the two tunes, and nothing listens. Rest your voice.',
      'Lower: sing with Merc, around A3',
      'Higher: sing with Tavi, around A4',
      'Your staff follows your choice: the bass clef for the lower voice, the treble clef for the higher.',
      "Your turn: a tune you've never heard, in time.",
      'Breathe at the breath mark.',
      'Stop immediately if anything feels uncomfortable.',
      "It doesn't score your timing.",
      "We didn't hear you start that time. Come in on do after the count-in.",
      "Now another tune you've never heard.",
      'Two tunes, read in time from the page.',
      'Keep it gentle: rest before you sing again.',
      "Thanks for saying so. That's enough singing for today: rest your voice.",
      "No microphone? Play the start, read and sing anyway, then play Merc's tunes to check. Nothing listens.",
    ])
      expect(text, line).toContain(line)
    expect(sing?.querySelectorAll('[data-feel]')).toHaveLength(4)
    // the second tune waits for the flow, and the readings for a take
    expect(
      sing?.querySelector('[data-sing="tune-2"]')?.hasAttribute('hidden'),
    ).toBe(true)
    expect(sing?.querySelector('[data-readings]')?.hasAttribute('hidden')).toBe(
      true,
    )
  })

  it('links Sight-Singing and The Chart with the lesson; its rest version names Sight-Singing for another day with no link, since it asks for the voice, and keeps The Chart', () => {
    // Arrange
    const d = doc()
    const card = d.getElementById('practiseCard')
    const second = card?.querySelector('.second-drill')

    // Assert: LESSON.md, Wrap; FACTS 60
    expect(words(card?.querySelector('[data-ending="rest"]'))).toBe(
      'Rest today. Sight-Singing will be here when your voice feels comfortable: mercurypitch.com/pitch-training, then tap Sight-Singing.',
    )
    expect(card?.querySelectorAll('[data-ending="rest"] a')).toHaveLength(0)
    expect(second?.closest('[data-ending]')).toBeNull()
    expect(second?.querySelector('a')?.getAttribute('href')).toBe(
      '/ear-lab?lesson=18',
    )
    expect(prose(second)).toBe(
      "For the beat, Ear Lab's The Chart writes a bar of rhythm on one line, and you tap it at sight. Some of its bars hold triplets, which come later. Free: mercurypitch.com/ear-lab, then tap The Chart.",
    )
    expect(
      Array.from(d.querySelectorAll('a[href*="?lesson="]'), (a) =>
        a.getAttribute('href'),
      ),
    ).toEqual([
      '/pitch-training?lesson=18',
      '/ear-lab?lesson=18',
      '/pitch-training?lesson=18',
      '/ear-lab?lesson=18',
    ])
  })

  it('names a share card that is in public/, at its size', () => {
    // Arrange
    const image = metaOf('og:image')?.replace('https://mercurypitch.com/', '')
    const bytes = readFileSync(resolve(process.cwd(), 'public', image ?? ''))

    // Act
    const size = jpegSize(bytes)

    // Assert
    expect(image).toBe('learn/lesson-18-og.jpg')
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
