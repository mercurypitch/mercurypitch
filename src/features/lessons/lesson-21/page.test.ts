// ============================================================
// Lesson 21's page document — its references, its order, nothing that answers the predict
// ============================================================
//
// learn/21.html is hand-written markup, so some of its promises are held
// here: every id a label or description points at exists, once; every
// button is a button, not a submit; there is no Watch section, because
// Lesson 21 has no film; the page opens on its cold open, the recall after
// it, shown to everyone, and before the four words; nothing a reader meets
// before the cold open's choice outside the predict itself names G sharp,
// says ti or "just below do" (FACTS 1a; WEB-SPEC, Tests, item 8): the head,
// the share card, the title, the promise, the sound gate, the step and
// section headings, the recall and the four words; the hero has its five
// chips; Play D major plays freely under the stage, and the two A major
// plays wait for a choice; no section head carries the faint staff and its
// clef, and the body drops the background's, since a Season 2 page draws no
// staff for show (WEB-SPEC, Look); Sing it holds the series' lines and this
// page's two runs; the practice links carry the lesson, and the rest
// version sends no one to sing; the share card its head names is in
// public/, at its size; and every line of its copy says only what the
// claims check passes.

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import { validateGuidedDynamicClaim } from '@/lib/guided-voice/claims'
import { PAGE, words } from './page-dom.test-fixtures'

/** The share card's words (WEB-SPEC, What the kit and the app still need, item 2). */
const SHARE_ALT =
  "The title card: Find Your Pitch, Lesson 21, Keys and the circle of fifths, above Lesson 2's ring of twelve beads, lit with D major's seven notes and its two black keys, F sharp and C sharp, between Merc and Tavi."

/** What would tell a reader the predict's answer: A major's new sharp, or where a new sharp falls in its scale. */
const ANSWER = /G♯|G sharp|\bti\b|just below do/i

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

/** Whether a control can be used: neither disabled nor marked unavailable. */
const usable = (e: Element): boolean =>
  !e.hasAttribute('disabled') && e.getAttribute('aria-disabled') !== 'true'

describe("Lesson 21's page", () => {
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
      'Next: Why does each key a fifth up add a sharp?',
    )
  })

  it('opens on its cold open, then the recall, the words, the steps, Sing it, the check, the Wrap and the explorer, with no Watch section', () => {
    // Act
    const order = Array.from(
      doc().querySelectorAll('main > section'),
      (s) => s.id || s.className.split(' ')[0],
    )

    // Assert: Lesson 2's order (FACTS 5a); Lesson 21 has no film
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

  it('names no note of A major and says no ti in its head, its share card, its title, its promise or its sound gate', () => {
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
      words(d.querySelector('.l21-hero .promise')),
      words(d.getElementById('gateText')),
      ...Array.from(
        d.querySelectorAll('script[type="application/ld+json"]'),
        (s) => s.textContent ?? '',
      ),
    ]

    // Assert: FACTS 1a; WEB-SPEC, What the kit and the app still need, item 2
    expect(head.every((t) => t !== undefined && t !== '')).toBe(true)
    for (const t of head) expect(t, t).not.toMatch(ANSWER)
    expect([metaOf('og:image:alt'), metaOf('twitter:image:alt')]).toEqual([
      SHARE_ALT,
      SHARE_ALT,
    ])
    expect(d.title).toBe(
      'Key signatures and the circle of fifths | MercuryPitch',
    )
    expect(metaOf('description')).toHaveLength(156)
  })

  it('names no note of A major and says no ti in its step and section headings, the recall or the four words, and keeps the reveal hidden', () => {
    // Arrange
    const d = doc()
    const headings = Array.from(d.querySelectorAll('.step h3'), words)
    const sections = Array.from(d.querySelectorAll('main .mv-head'), (h) =>
      words(h),
    )
    const parts = [
      ...headings,
      ...sections,
      words(d.getElementById('recall')),
      words(d.getElementById('words')),
    ]

    // Assert: the lesson menu lists these headings from the first paint
    expect(headings).toEqual([
      'Why does G major need F♯ sharp?',
      'Why does each key a fifth up add a sharp?',
      'Where do the flats come from?',
      'How do I find do from a key signature?',
      'Why does the circle close after twelve?',
    ])
    for (const t of parts) expect(t, t).not.toMatch(ANSWER)
    expect(d.querySelector('#predict .reveal')?.hasAttribute('hidden')).toBe(
      true,
    )
  })

  it('has its five chips, linking Lessons 6 and 15', () => {
    // Arrange
    const d = doc()
    const chips = Array.from(d.querySelectorAll('.l21-hero .meta > li'), words)

    // Assert: FACTS 2 and 3
    expect(chips).toEqual([
      '15 minutes',
      'After Lesson 6: Intervals: the distance between notes',
      'After Lesson 15: The staff: where notes sit',
      'Also useful: Lesson 13, Vowels',
      'Sound on',
    ])
    expect(
      Array.from(d.querySelectorAll('.l21-hero .meta a'), (a) =>
        a.getAttribute('href'),
      ),
    ).toEqual(['/learn/06', '/learn/15'])
  })

  it('plays D major freely under the stage, and holds both A major plays for a choice, each with its small staircase', () => {
    // Arrange
    const d = doc()
    const plays = Array.from(
      d.querySelectorAll<HTMLButtonElement>('.hero-plays [data-play]'),
    )

    // Assert: WEB-SPEC, Toys 5
    expect(plays.map((b) => [b.dataset.play, words(b), usable(b)])).toEqual([
      ['d-major', 'Play D major', true],
      ['with-d-sharp', 'Play A with D♯ sharp', false],
      ['with-g-sharp', 'Play A with G♯ sharp', false],
    ])
    expect(plays[0].hasAttribute('data-free')).toBe(true)
    expect(
      Array.from(d.querySelectorAll('.hero-plays [data-mini-stairs]'), (s) =>
        s.getAttribute('data-mini-stairs'),
      ),
    ).toEqual(['with-d-sharp', 'with-g-sharp'])
    expect(
      Array.from(d.querySelectorAll('#predict [data-choice]'), (c) => [
        c.getAttribute('data-choice'),
        words(c),
      ]),
    ).toEqual([
      ['d-sharp', 'D♯ sharp'],
      ['g-sharp', 'G♯ sharp'],
    ])
    expect(words(d.querySelector('#predict .lock-hint'))).toBe(
      'Choose an answer to unlock A major, played both ways.',
    )
  })

  it('puts the five steps on four toys: the staircase, the circle with the staff, Find do and the walk', () => {
    // Arrange
    const d = doc()

    // Assert: WEB-SPEC, Sections, item 8
    expect(
      Array.from(d.querySelectorAll('#stepsStage [data-toy]'), (t) => [
        t.getAttribute('data-toy'),
        t.id,
      ]),
    ).toEqual([
      ['1', 'toyStairs'],
      ['2', 'toyCircle'],
      ['3', 'toyFind'],
      ['4', 'toyWalk'],
    ])
    // Spell it opens on B flat, F major's one-flat signature (Toys 2), and
    // the walk on Pure (Toys 3)
    expect(
      d
        .querySelector('[data-spell] [data-spelling="flat"]')
        ?.getAttribute('aria-pressed'),
    ).toBe('true')
    expect(
      d
        .querySelector('[data-walk-tuning] [data-tuning="pure"]')
        ?.getAttribute('aria-pressed'),
    ).toBe('true')
    // no step has a Go deeper drawer (Length)
    expect(d.querySelectorAll('#lesson details.deeper')).toHaveLength(0)
  })

  it('gives its four words a figure and a play each', () => {
    // Arrange
    const tickets = Array.from(doc().querySelectorAll('#words .ticket'))

    // Assert: WEB-SPEC, Toys 6
    expect(
      tickets.map((t) => [
        words(t.querySelector('h3')),
        t.querySelector('svg.word-fig') !== null,
        words(t.querySelector('[data-word-play]')),
      ]),
    ).toEqual([
      ['Key', true, 'Play: G major'],
      ['Key signature', true, 'Play: G major, with its F♯ sharp lit'],
      ['Circle of fifths', true, 'Play: C, G, D, A'],
      ['Equal temperament', true, 'Play: C4 up to C5, in semitones'],
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

  it("holds Sing it's series lines and this page's two runs", () => {
    // Arrange
    const sing = doc().getElementById('sing')
    const text = words(sing)

    // Assert: LESSON.md, Sing it; FACTS 48 to 58
    for (const line of [
      'Sore, hoarse or unwell today? Just listen along.',
      "I'm comfortable: let's sing",
      'Just listen today',
      'Good call. Merc sings so, la, ti and do in C, then in G, and nothing listens. Rest your voice.',
      'Lower: sing with Merc, around A3',
      'Higher: sing with Tavi, around A4',
      'Between the two, the key signature gains its sharp and do moves to G.',
      'If the second run starts low for you, join in on ti.',
      'Stop immediately if anything feels uncomfortable.',
      "The guide counts you in on so before each run, and a line sweeps along the notes. Nothing listens here and nothing is scored. It's just for you.",
      'So, la, ti, do, in two keys: the same syllables on a new do.',
      'Keep it gentle: rest before you sing again.',
      "Thanks for saying so. That's enough singing for today: rest your voice.",
    ])
      expect(text, line).toContain(line)
    // Lesson 15's line naming each voice's clef is left out (FACTS 50)
    expect(text).not.toContain('Your staff follows your choice')
    expect(sing?.querySelectorAll('[data-feel]')).toHaveLength(4)
    expect(
      sing?.querySelector('[data-guide-again]')?.hasAttribute('hidden'),
    ).toBe(true)
  })

  it('links Compose and Ear Lab with the lesson, and its rest version keeps both, since neither asks for the voice', () => {
    // Arrange
    const d = doc()
    const card = d.getElementById('practiseCard')

    // Assert: LESSON.md, Wrap; FACTS 58
    expect(words(card?.querySelector('[data-ending="rest"]'))).toBe(
      "Rest today. This page's sung line will be here when your voice feels comfortable.",
    )
    expect(card?.querySelectorAll('[data-ending="rest"] a')).toHaveLength(0)
    expect(card?.querySelector('.second-drill a')?.getAttribute('href')).toBe(
      '/ear-lab?lesson=21',
    )
    expect(
      Array.from(d.querySelectorAll('a[href*="?lesson="]'), (a) =>
        a.getAttribute('href'),
      ),
    ).toEqual([
      '/?lesson=21#/compose',
      '/ear-lab?lesson=21',
      '/?lesson=21#/compose',
      '/ear-lab?lesson=21',
    ])
  })

  it('names a share card that is in public/, at its size', () => {
    // Arrange
    const image = metaOf('og:image')?.replace('https://mercurypitch.com/', '')
    const bytes = readFileSync(resolve(process.cwd(), 'public', image ?? ''))

    // Act
    const size = jpegSize(bytes)

    // Assert
    expect(image).toBe('learn/lesson-21-og.jpg')
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
