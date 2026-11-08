// ============================================================
// Lesson 16's page document — its references, its order, nothing that answers the predict
// ============================================================
//
// learn/16.html is hand-written markup, so some of its promises are held
// here: every id a label or description points at exists, once; every
// button is a button, not a submit; there is no Watch section, because
// Lesson 16 has no film; the page opens on its cold open, the recall after
// it, shown to everyone, and before the three words; nothing a reader meets
// before the cold open's choice outside the predict itself says what Tavi
// sings with no note first or names perfect pitch (FACTS 1a; WEB-SPEC,
// Tests, item 5): the head, the share card, the title, the promise, the
// sound gate and the structured data; the step headings name no first
// note, and the section headings, the recall and the three words name
// neither kind of pitch; the hero has its five chips; both tries wait for
// a choice; no section head carries the faint staff and its clef, and the
// body drops the background's, since a Season 2 page draws no staff for
// show (WEB-SPEC, Look); Sing it holds the series' lines and this page's
// two phrases; the practice links carry the lesson, and the rest version
// sends no one to sing; the share card its head names is in public/, at
// its size; and every line of its copy says only what the claims check
// passes.

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import { validateGuidedDynamicClaim } from '@/lib/guided-voice/claims'
import { PAGE, words } from './page-dom.test-fixtures'

/** The share card's words (WEB-SPEC, Sections, item 2). */
const SHARE_ALT =
  'The title card: Find Your Pitch, Lesson 16, Sing what you see, above a treble staff of five plain notes, between Merc and Tavi.'

/** What would tell a reader where Tavi starts with no note first: a note of her own, a step under the page. */
const FIRST_NOTE = /of her own|a step (?:under|below|low)|\bfrom F\b|\bF4\b/i

/** The two kinds of pitch, which together point to the predict's answer (FACTS 1a). */
const PITCH_KIND = /perfect pitch|absolute pitch|relative pitch/i

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

/** Which button of a radio group of buttons is pressed. */
const pressed = (group: Element | null, attr: string): string[] =>
  Array.from(
    group?.querySelectorAll(`[${attr}][aria-pressed="true"]`) ?? [],
    (b) => b.getAttribute(attr) ?? '',
  )

describe("Lesson 16's page", () => {
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
    expect(buttons.length).toBeGreaterThan(55)
    for (const b of buttons) expect(b.getAttribute('type')).toBe('button')
  })

  it("carries the step deck's way through: Previous, and Next naming Step 2", () => {
    // Arrange
    const nav = doc().getElementById('deckNav')

    // Assert: the deck renames this label at every step (kit/step-deck.ts)
    expect(nav?.querySelector('[data-step-go="-1"]')).not.toBeNull()
    expect(words(nav?.querySelector('[data-step-go="1"] #deckNextLabel'))).toBe(
      'Next: Do I need perfect pitch for this?',
    )
  })

  it('opens on its cold open, then the recall, the words, the steps, Sing it, the check, the Wrap and the explorer, with no Watch section', () => {
    // Act
    const order = Array.from(
      doc().querySelectorAll('main > section'),
      (s) => s.id || s.className.split(' ')[0],
    )

    // Assert: Lesson 2's order (FACTS 5a); Lesson 16 has no film
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

  it('names no first note and no perfect pitch in its head, its share card, its title, its promise or its sound gate', () => {
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
      words(d.querySelector('.l16-hero .promise')),
      words(d.getElementById('gateText')),
      ...Array.from(
        d.querySelectorAll('script[type="application/ld+json"]'),
        (s) => s.textContent ?? '',
      ),
    ]

    // Assert: FACTS 1a; WEB-SPEC, Sections, item 2
    expect(head.every((t) => t !== undefined && t !== '')).toBe(true)
    for (const t of head) {
      expect(t, t).not.toMatch(FIRST_NOTE)
      expect(t, t).not.toMatch(/perfect pitch/i)
    }
    expect([metaOf('og:image:alt'), metaOf('twitter:image:alt')]).toEqual([
      SHARE_ALT,
      SHARE_ALT,
    ])
    expect(d.title).toBe(
      'How to sight-sing a melody from the staff | MercuryPitch',
    )
    expect(metaOf('description')).toHaveLength(142)
  })

  it('names no first note in its step headings, neither kind of pitch in its section headings, the recall or the three words, and keeps the reveal hidden', () => {
    // Arrange
    const d = doc()
    const headings = Array.from(d.querySelectorAll('.step h3'), words)
    const parts = [
      ...Array.from(d.querySelectorAll('main .mv-head'), (h) => words(h)),
      words(d.getElementById('recall')),
      words(d.getElementById('words')),
    ]

    // Assert: the lesson menu lists these headings from the first paint;
    // Step 2's leans towards no, the lesson's misconception, not the
    // predict's answer (FACTS 1a)
    expect(headings).toEqual([
      'Where is do on the page?',
      'Do I need perfect pitch for this?',
      'How do I hear the next note before I sing it?',
      'What about a leap?',
      'Can I read it without the names?',
    ])
    for (const t of headings) expect(t, t).not.toMatch(FIRST_NOTE)
    for (const t of parts) {
      expect(t, t).not.toMatch(FIRST_NOTE)
      expect(t, t).not.toMatch(PITCH_KIND)
    }
    expect(d.querySelector('#predict .reveal')?.hasAttribute('hidden')).toBe(
      true,
    )
  })

  it('has its five chips, linking Lessons 9 and 15', () => {
    // Arrange
    const d = doc()
    const chips = Array.from(d.querySelectorAll('.l16-hero .meta > li'), words)

    // Assert: FACTS 2 and 3
    expect(chips).toEqual([
      '15 minutes',
      'After Lesson 9: Landing a leap',
      'After Lesson 15: The staff: where notes sit',
      'Sound on',
      'Microphone optional',
    ])
    expect(
      Array.from(d.querySelectorAll('.l16-hero .meta a'), (a) =>
        a.getAttribute('href'),
      ),
    ).toEqual(['/learn/09', '/learn/15'])
  })

  it("holds both of Tavi's tries for a choice, under a staff of five plain notes", () => {
    // Arrange
    const d = doc()
    const plays = Array.from(
      d.querySelectorAll<HTMLButtonElement>('.hero-plays [data-play]'),
    )

    // Assert: WEB-SPEC, Toys 1
    expect(plays.map((b) => [b.dataset.play, words(b), usable(b)])).toEqual([
      ['alone', 'Tavi sings, no note first', false],
      ['note', 'One note first, then Tavi sings', false],
    ])
    expect(d.querySelectorAll('.hero-plays [data-free]')).toHaveLength(0)
    expect(
      Array.from(d.querySelectorAll('#predict [data-choice]'), (c) => [
        c.getAttribute('data-choice'),
        words(c),
      ]),
    ).toEqual([
      ['jumble', "A jumble: with no note, she can't read it"],
      ['tune', 'The tune, from a note of her own'],
    ])
    expect(words(d.querySelector('#predict .lock-hint'))).toBe(
      "Choose an answer to unlock Tavi's two tries.",
    )
    expect(
      d.querySelector('[data-hero-staff]')?.getAttribute('aria-label'),
    ).toBe('Treble staff with five notes: G, A, B, A, G')
  })

  it('puts the five steps on two toys, the staircase beside the staff and the staff, on the bass clef with the names on and Hear it inside off', () => {
    // Arrange
    const d = doc()

    // Assert: WEB-SPEC, Toys 2 and 3; the bass clef when no voice is stored
    expect(
      Array.from(d.querySelectorAll('#stepsStage [data-toy]'), (t) => [
        t.getAttribute('data-toy'),
        t.id,
      ]),
    ).toEqual([
      ['1', 'toyStairs'],
      ['2', 'toyStaff'],
    ])
    for (const group of d.querySelectorAll('#stepsStage [data-staff-clef]'))
      expect(pressed(group, 'data-clef')).toEqual(['bass'])
    expect(
      pressed(d.querySelector('#toyStaff [data-staff-names]'), 'data-names'),
    ).toEqual(['on'])
    expect(
      d
        .querySelector('#toyStaff [data-hear-inside]')
        ?.getAttribute('aria-pressed'),
    ).toBe('false')
    // each of the staff's plays names the steps it shows in
    expect(
      Array.from(d.querySelectorAll('#toyStaff [data-staff-play]'), (b) => [
        b.getAttribute('data-staff-play'),
        b.getAttribute('data-for'),
        words(b),
      ]),
    ).toEqual([
      ['do', '2', 'Play do'],
      ['do-so', '3 5', 'Play do to so'],
      ['triad', '4 5', 'Play do, mi, so, mi, do'],
      ['turn', '4', 'Play do, mi, then do, so'],
    ])
    // no step has a Go deeper drawer (Length)
    expect(d.querySelectorAll('#lesson details.deeper')).toHaveLength(0)
  })

  it('gives its three words a figure and a play each', () => {
    // Arrange
    const tickets = Array.from(doc().querySelectorAll('#words .ticket'))

    // Assert: WEB-SPEC, Toys 4
    expect(
      tickets.map((t) => [
        words(t.querySelector('h3')),
        t.querySelector('svg.word-fig') !== null,
        words(t.querySelector('[data-word-play]')),
      ]),
    ).toEqual([
      ['Sight-singing', true, 'Play: do first, then Merc sings do to so'],
      ['Tonic triad', true, 'Play: do, mi, so'],
      ['Audiation', true, 'Play: do, a silent beat, then re'],
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

  it("holds Sing it's series lines and this page's two phrases", () => {
    // Arrange
    const sing = doc().getElementById('sing')
    const text = words(sing)

    // Assert: LESSON.md, Sing it
    for (const line of [
      'Sore, hoarse or unwell today? Just listen along.',
      "I'm comfortable: let's sing",
      'Just listen today',
      'Good call. Merc sings the two phrases, and nothing listens. Rest your voice.',
      'Lower: sing with Merc, around A3',
      'Higher: sing with Tavi, around A4',
      'Your staff follows your choice: the bass clef for the lower voice, the treble clef for the higher.',
      'Stop immediately if anything feels uncomfortable.',
      "Now a line you've never heard, with the names off.",
      'Two phrases from the page, each found from do.',
      'Keep it gentle: rest before you sing again.',
      "Thanks for saying so. That's enough singing for today: rest your voice.",
    ])
      expect(text, line).toContain(line)
    expect(sing?.querySelectorAll('[data-feel]')).toHaveLength(4)
    // the second phrase waits for the flow, and the readings for a take
    expect(
      sing?.querySelector('[data-sing="phrase-2"]')?.hasAttribute('hidden'),
    ).toBe(true)
    expect(sing?.querySelector('[data-readings]')?.hasAttribute('hidden')).toBe(
      true,
    )
  })

  it('links Sight-Singing with the lesson, and its rest version names the drill for another day with no link, since it asks for the voice', () => {
    // Arrange
    const d = doc()
    const card = d.getElementById('practiseCard')

    // Assert: LESSON.md, Wrap; FACTS 52
    expect(words(card?.querySelector('[data-ending="rest"]'))).toBe(
      'Rest today. Sight-Singing will be here when your voice feels comfortable: mercurypitch.com/pitch-training, then tap Sight-Singing.',
    )
    expect(card?.querySelectorAll('[data-ending="rest"] a')).toHaveLength(0)
    expect(
      Array.from(d.querySelectorAll('a[href*="?lesson="]'), (a) =>
        a.getAttribute('href'),
      ),
    ).toEqual(['/pitch-training?lesson=16', '/pitch-training?lesson=16'])
  })

  it('names a share card that is in public/, at its size', () => {
    // Arrange
    const image = metaOf('og:image')?.replace('https://mercurypitch.com/', '')
    const bytes = readFileSync(resolve(process.cwd(), 'public', image ?? ''))

    // Act
    const size = jpegSize(bytes)

    // Assert
    expect(image).toBe('learn/lesson-16-og.jpg')
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
