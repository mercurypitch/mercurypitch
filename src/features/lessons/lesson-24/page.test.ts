// ============================================================
// Lesson 24's page document — its references, its order, nothing that answers a predict
// ============================================================
//
// learn/24.html is hand-written markup, so some of its promises are held
// here: every id a label or description points at exists, once; every
// button is a button, not a submit; there is no Watch section, because
// Lesson 24 has no film; the page opens on its cold open, the recall after
// it, shown to everyone, and before the four words; nothing a reader meets
// before the cold open's choice names a beat, a slowing or a stopping, or
// which interval beats faster, and no step heading does (FACTS 1a); the
// hero has its seven chips; the pair plays freely under the stage, and the
// slide waits for a choice; the steps' drone chart and free play hold back
// in their markup everything that would answer either predict, under their
// lock lines; Step 2's predict waits for the cold open's, and Steps 1 and
// 3's words for the reveals, under their held lines; no section head
// carries the faint staff and its clef, and the body drops the
// background's, since a Season 2 page draws no staff for show (WEB-SPEC,
// Look); Sing it holds the series' lines, the headphones check, the quiet
// check's line, the holds' cues and the sing-along; the practice links carry
// the lesson, and the rest version sends no one to sing; the share card its
// head names is in public/, at its size; and every line of its copy says
// only what the claims check passes.

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import { validateGuidedDynamicClaim } from '@/lib/guided-voice/claims'
import { PAGE, words } from './page-dom.test-fixtures'

/** The share card's words (WEB-SPEC, Sections, item 2). */
const SHARE_ALT =
  'The title card: Find Your Pitch, Lesson 24, Harmony against a drone, above a wide drone band on A3 with a thin line just above it, between Merc and Tavi.'

/** What would tell a reader either predict's answer: a beat, its slowing or stopping, or which interval beats faster. */
const ANSWER = /\bbeat|slow|stop|still|faster/i

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

describe("Lesson 24's page", () => {
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
      'Next: Do two different notes throb too?',
    )
  })

  it('opens on its cold open, then the recall, the words, the steps, Sing it, the check, the Wrap and the explorer, with no Watch section', () => {
    // Act
    const order = Array.from(
      doc().querySelectorAll('main > section'),
      (s) => s.id || s.className.split(' ')[0],
    )

    // Assert: Lesson 2's order (FACTS 5a); Lesson 24 has no film
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

  it('names no beat, slowing or stopping, and no faster interval, in its head, its share card or its title', () => {
    // Arrange: what a reader meets before the cold open's choice
    const head = [
      doc().title,
      metaOf('description'),
      metaOf('og:title'),
      metaOf('og:description'),
      metaOf('twitter:title'),
      metaOf('twitter:description'),
      metaOf('og:image:alt'),
      metaOf('twitter:image:alt'),
      words(doc().getElementById('hook')),
    ]

    // Assert: FACTS 1a; WEB-SPEC, Sections, item 2
    expect(head.every((t) => t !== undefined && t !== '')).toBe(true)
    for (const t of head) expect(t, t).not.toMatch(ANSWER)
    expect([metaOf('og:image:alt'), metaOf('twitter:image:alt')]).toEqual([
      SHARE_ALT,
      SHARE_ALT,
    ])
    expect(doc().title).toBe('How to sing in tune with a drone | MercuryPitch')
  })

  it('names no beat, slowing or stopping in its step headings or its four words, and keeps both reveals and the held words hidden', () => {
    // Arrange
    const d = doc()
    const headings = Array.from(d.querySelectorAll('.step h3'), words)
    const parts = [...headings, words(d.getElementById('words'))]

    // Assert: the lesson menu lists these headings from the first paint
    expect(headings).toEqual([
      'What is that throbbing?',
      'Do two different notes throb too?',
      "Which should I sing: the piano's note, or the pure one?",
      'To hold my part, should I shut out the other one?',
    ])
    for (const t of parts) expect(t, t).not.toMatch(ANSWER)
    for (const id of ['predict', 'predict2'])
      expect(d.querySelector(`#${id} .reveal`)?.hasAttribute('hidden')).toBe(
        true,
      )
    // Step 1's words wait for the cold open's reveal, and Step 2's and 3's
    // for Step 2's (WEB-SPEC, Toys 1 and 3)
    const held1 = Array.from(d.querySelectorAll('[data-reveal1]'))
    const held2 = Array.from(d.querySelectorAll('[data-reveal2]'))
    expect(held1).toHaveLength(6)
    expect(held2).toHaveLength(8)
    for (const e of [...held1, ...held2])
      expect(e.hasAttribute('hidden')).toBe(true)
    expect(
      Array.from(d.querySelectorAll('.step-held'), (e) => [
        e.getAttribute('data-held'),
        words(e),
        e.hasAttribute('hidden'),
      ]),
    ).toEqual([
      ['1', 'Hear the slide at the top to unlock this step.', false],
      ['3', "Hear Step 2's two intervals to unlock this step.", false],
    ])
  })

  it('has its seven chips, Lessons 5, 10 and 23 links', () => {
    // Arrange
    const d = doc()
    const chips = Array.from(d.querySelectorAll('.l24-hero .meta > li'), words)

    // Assert: WEB-SPEC, Sections, item 2
    expect(chips).toEqual([
      '16 minutes',
      'After Lesson 5: Breath and a steady note',
      'After Lesson 10: Major and minor',
      'After Lesson 23: Perfect, major, minor and the tritone',
      'Sound on',
      'Microphone optional',
      'Headphones optional',
    ])
    expect(
      Array.from(d.querySelectorAll('.l24-hero .meta a'), (a) =>
        a.getAttribute('href'),
      ),
    ).toEqual(['/learn/05', '/learn/10', '/learn/23'])
  })

  it('plays the pair freely under the stage, and holds the slide for a choice', () => {
    // Arrange
    const plays = Array.from(
      doc().querySelectorAll<HTMLButtonElement>('.hero-plays [data-play]'),
    )

    // Assert: WEB-SPEC, Toys 1
    expect(plays.map((b) => [b.dataset.play, words(b), usable(b)])).toEqual([
      ['pair', 'Play the drone and the top note', true],
      ['slide', 'Play the slide', false],
    ])
    expect(plays[0].hasAttribute('data-free')).toBe(true)
    expect(words(doc().querySelector('#predict .lock-hint'))).toBe(
      'Choose an answer to unlock the slide.',
    )
  })

  it("holds back every control of the steps' drone chart and of free play, under their lock lines", () => {
    // Arrange
    const d = doc()
    const controls = (root: string): Element[] =>
      Array.from(
        d.querySelectorAll(
          `${root} :is([data-drone-play], [data-drone-bead], [data-drone-tuning], [data-drone-octave], input, [data-free-state])`,
        ),
      )

    // Assert: WEB-SPEC, Toys 2, "Before the choice nothing on the page plays its answer"
    expect(controls('#toyChart')).toHaveLength(11)
    expect(controls('#freePlay')).toHaveLength(23)
    for (const root of ['#toyChart', '#freePlay']) {
      for (const c of controls(root)) expect(usable(c), root).toBe(false)
      expect(words(d.querySelector(`${root} [data-drone-lock]`))).toBe(
        'Choose an answer at the top to unlock this figure.',
      )
      expect(words(d.querySelector(`${root} [data-drone-lock2]`))).toBe(
        "Answer Step 2's question first to use this figure.",
      )
    }
  })

  it("holds Step 2's predict until the cold open's choice, asking for that choice first, and Steps 3 and 4's plays for Step 2's", () => {
    // Arrange
    const d = doc()
    const card = d.getElementById('predict2')

    // Assert: WEB-SPEC, Toys 3
    const controls = Array.from(
      card?.querySelectorAll('[data-choice], [data-play]') ?? [],
    )
    expect(controls).toHaveLength(4)
    for (const c of controls) expect(usable(c)).toBe(false)
    expect(words(card?.querySelector('.lock-hint'))).toBe(
      'Choose an answer at the top first.',
    )
    // the piano's mi and its fifth over the drone answer it (Toys 2)
    const later = Array.from(
      d.querySelectorAll('#step-3 [data-step-play], #step-4 [data-step-play]'),
    )
    expect(later.map((b) => b.getAttribute('data-step-play'))).toEqual([
      'mi-piano',
      'mi-pure',
      'wave',
      'straight',
    ])
    for (const b of later) expect(usable(b)).toBe(false)
  })

  it('gives its four words a figure and a play each, Pure held for the choice under its line', () => {
    // Arrange
    const tickets = Array.from(doc().querySelectorAll('#words .ticket'))

    // Assert: WEB-SPEC, Toys 4
    expect(tickets.map((t) => words(t.querySelector('h3')))).toEqual([
      'Drone',
      'Harmonic',
      'Pure',
      'Equal-tempered',
    ])
    expect(
      tickets.map((t) => {
        const play = t.querySelector('[data-word-play]')
        return [
          t.querySelector('canvas') !== null,
          play !== null && usable(play),
        ]
      }),
    ).toEqual([
      [true, true],
      [true, true],
      [true, false],
      [true, true],
    ])
    expect(words(tickets[2].querySelector('[data-word-lock]'))).toBe(
      'Choose an answer at the top to hear this.',
    )
  })

  it('draws no staff for show: no section head carries the faint staff, and the body drops the background', () => {
    // Arrange
    const d = doc()

    // Assert: WEB-SPEC, Look
    expect(d.querySelectorAll('.mv-staff, svg.clef')).toHaveLength(0)
    expect(d.body.classList.contains('season-2')).toBe(true)
  })

  it("holds Sing it's series lines, the headphones check, the quiet check's line, the holds' cues and the sing-along", () => {
    // Arrange
    const sing = doc().getElementById('sing')
    const text = words(sing)

    // Assert: LESSON.md, Sing it; FACTS 49 to 59
    for (const line of [
      'Sore, hoarse or unwell today? Just listen along.',
      "I'm comfortable: let's sing",
      'Just listen today',
      'Good call. Merc holds three notes over the drone for you, and nothing listens. Rest your voice.',
      'Lower: sing with Merc, around A3',
      'Higher: sing with Tavi, around A4',
      'If do feels low, move it higher.',
      'Put on headphones to keep the drone out of the microphone, with the volume low enough to hear yourself.',
      "What this does: it measures how long the middle of your line stays in each note's band, in any octave.",
      "First, stay quiet for two seconds while the drone plays: the page checks that the microphone can't hear it.",
      "If you can, hold each note straight; if a wave comes, that's fine.",
      "As you settle, listen: a throb that slows means you're close.",
      'Stop immediately if anything feels uncomfortable.',
      'The microphone heard a note during the drone. Check your headphones, then press Start again and stay quiet.',
      'The sing-along: Merc sings each note alone, then the drone plays with you for five seconds. Nothing listens.',
      'A unison, a fifth and a major third, each over the drone.',
      "If that felt tricky, good: that's learning.",
      'Rest for a few easy breaths. Ready when you are.',
    ])
      expect(text, line).toContain(line)
    expect(words(sing?.querySelector('[data-sing="hold2"]'))).toBe(
      'Hold so and mi for 10 seconds',
    )
    expect(words(sing?.querySelector('[data-sing="along-again"]'))).toBe(
      'Sing along again',
    )
    expect(
      Array.from(sing?.querySelectorAll('[data-phones]') ?? [], words),
    ).toEqual(['I have headphones on', 'No headphones'])
    // Move do rests at D: "lower" is unavailable, never disabled
    const lower = sing?.querySelector('[data-move-do="-1"]')
    expect(lower?.getAttribute('aria-disabled')).toBe('true')
    expect(lower?.hasAttribute('disabled')).toBe(false)
    // "Just listen today"'s play waits for Step 2's choice
    const listen = sing?.querySelector('[data-listen-play]')
    expect(listen && usable(listen)).toBe(false)
    expect(words(sing?.querySelector('[data-listen-lock]'))).toBe(
      "Answer Step 2's question first to hear this.",
    )
    expect(sing?.querySelector('[data-vibrato-line]')).toBeNull()
    expect(sing?.querySelectorAll('[data-feel]')).toHaveLength(4)
  })

  it('links Drone Intonation and Beat Hunt with the lesson, and its rest version links no drill that asks for the voice', () => {
    // Arrange
    const d = doc()
    const card = d.getElementById('practiseCard')

    // Assert: WEB-SPEC, Practice links
    expect(
      Array.from(
        card?.querySelectorAll('[data-ending="practise"] a') ?? [],
        (a) => a.getAttribute('href'),
      ),
    ).toEqual(['/exercises/thirds-on-a-drone?lesson=24'])
    expect(card?.querySelectorAll('[data-ending="rest"] a')).toHaveLength(0)
    expect(words(card?.querySelector('[data-ending="rest"]'))).toBe(
      'Rest today. Drone Intonation will be here when your voice feels comfortable: mercurypitch.com/exercises/thirds-on-a-drone',
    )
    // Beat Hunt asks for no voice, so it stays on both versions
    expect(card?.querySelector('.second-drill a')?.getAttribute('href')).toBe(
      '/ear-lab?lesson=24',
    )
    expect(
      Array.from(d.querySelectorAll('a[href*="?lesson="]'), (a) =>
        a.getAttribute('href'),
      ),
    ).toEqual([
      '/exercises/thirds-on-a-drone?lesson=24',
      '/ear-lab?lesson=24',
      '/exercises/thirds-on-a-drone?lesson=24',
      '/ear-lab?lesson=24',
    ])
  })

  it('names a share card that is in public/, at its size', () => {
    // Arrange
    const image = metaOf('og:image')?.replace('https://mercurypitch.com/', '')
    const bytes = readFileSync(resolve(process.cwd(), 'public', image ?? ''))

    // Act
    const size = jpegSize(bytes)

    // Assert
    expect(image).toBe('learn/lesson-24-og.jpg')
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
