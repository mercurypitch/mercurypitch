// ============================================================
// Lesson 22's page document — its spoken signs, its references, its order, nothing that answers a predict
// ============================================================
//
// learn/22.html is hand-written markup, so some of its promises are held
// here: every ± its text prints is followed by its spoken words, the sign
// itself hidden from a screen reader, and no accessible name or share card
// carries one; every id a label or description points at exists, once;
// every button is a button, not a submit; there is no Watch section, because
// Lesson 22 has no film; the page opens on its cold open, the recall after
// it, shown to everyone, and before the four words; nothing a reader meets
// before the cold open's choice names a straight note's place, a middle, a
// centre or an average, and no step heading names one (FACTS 1a); the hero
// has its four chips; Play Merc's note plays freely under the stage, and the
// two straight notes wait for a choice; the steps' band chart and free play
// hold back in their markup everything that would answer either predict,
// under their lock lines, and Step 3's predict waits for the cold open's; no
// section head carries the faint staff and its clef, and the body drops the
// background's, since a Season 2 page draws no staff for show (WEB-SPEC,
// Look; Tests 20); Sing it holds the series' lines, this page's two holds and
// one listening note; the practice links carry the lesson, and the rest
// version links nothing; the share card its head names is in public/, at its
// size; and every line of its copy says only what the claims check passes
// (WEB-SPEC, Tests 17).

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import { validateGuidedDynamicClaim } from '@/lib/guided-voice/claims'
import { PAGE, words } from './page-dom.test-fixtures'

/** A sign as the page writes it, however the formatter wraps it: hidden, then said, with its number or alone. */
const SPOKEN_SIGN =
  /<span\s+aria-hidden="true"\s*>±(\d*)<\/span\s*>\s*<span\s+class="sr"\s*>plus or minus(?: (\d+))?<\/span\s*>/g

/** The page with every sign it speaks taken out, a number's sign only where its words say that number. */
const unspoken = (html: string): string =>
  html.replace(SPOKEN_SIGN, (whole, shown: string, said?: string) =>
    shown === (said ?? '') ? '' : whole,
  )

/** The share card's words (WEB-SPEC, Sections, item 2). */
const SHARE_ALT =
  'The title card: Find Your Pitch, Lesson 22, Vibrato, above a band with a pitch line waving across both its edges, between Merc and Tavi.'

/** What would tell a reader the cold open's answer: where the straight note sits. */
const ANSWER = /straight|middle|centre|center|average/i

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

describe("Lesson 22's page", () => {
  it('follows every ± it prints with its spoken words', () => {
    // Arrange
    const signs = PAGE.match(/±/g) ?? []

    // Act
    const bare = unspoken(PAGE).match(/±/g) ?? []

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
      [...named, ...valuesOf('content')].filter((v) => /±/.test(v)),
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

  it('makes every button a button, never a submit', () => {
    // Arrange
    const buttons = Array.from(doc().querySelectorAll('button'))

    // Assert
    expect(buttons.length).toBeGreaterThan(40)
    for (const b of buttons) expect(b.getAttribute('type')).toBe('button')
  })

  it("carries the step deck's way through: Previous, and Next naming Step 2", () => {
    // Arrange
    const nav = doc().getElementById('deckNav')

    // Assert: the deck renames this label at every step (kit/step-deck.ts)
    expect(nav?.querySelector('[data-step-go="-1"]')).not.toBeNull()
    expect(words(nav?.querySelector('[data-step-go="1"] #deckNextLabel'))).toBe(
      'Next: How fast, and how far?',
    )
  })

  it('opens on its cold open, then the recall, the words, the steps, Sing it, the check, the Wrap and the explorer, with no Watch section', () => {
    // Act
    const order = Array.from(
      doc().querySelectorAll('main > section'),
      (s) => s.id || s.className.split(' ')[0],
    )

    // Assert: Lesson 2's order (FACTS 5a); Lesson 22 has no film
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

  it("names no straight note's place, middle, centre or average in its head, its share card or its title", () => {
    // Arrange: what a reader meets before the cold open's choice
    const head = [
      doc().title,
      metaOf('description'),
      metaOf('og:title'),
      metaOf('og:description'),
      metaOf('twitter:title'),
      metaOf('twitter:description'),
      metaOf('og:image:alt'),
      words(doc().getElementById('hook')),
    ]

    // Assert: FACTS 1a
    expect(head.every((t) => t !== undefined && t !== '')).toBe(true)
    for (const t of head) expect(t, t).not.toMatch(ANSWER)
  })

  it('names no middle, centre or average in its step headings, its recall or its four words, and keeps both reveals hidden', () => {
    // Arrange
    const d = doc()
    const headings = Array.from(d.querySelectorAll('.step h3'), words)
    const parts = [
      ...headings,
      words(d.getElementById('recall')),
      words(d.getElementById('words')),
    ]

    // Assert: the lesson menu lists these headings from the first paint
    expect(headings).toEqual([
      'What exactly is waving?',
      'How fast, and how far?',
      'If it swings, why do we hear one note?',
      'Does a singer need one?',
    ])
    for (const t of parts) expect(t).not.toMatch(/middle|centre|average/i)
    expect(d.querySelector('#predict .reveal')?.hasAttribute('hidden')).toBe(
      true,
    )
    expect(d.querySelector('#predict3 .reveal')?.hasAttribute('hidden')).toBe(
      true,
    )
    const held = Array.from(d.querySelectorAll('[data-reveal3]'))
    expect(held).toHaveLength(4)
    for (const e of held) expect(e.hasAttribute('hidden')).toBe(true)
  })

  it('has its four chips, Lesson 14 a link', () => {
    // Arrange
    const chips = Array.from(
      doc().querySelectorAll('.l22-hero .meta > li'),
      words,
    )

    // Assert: WEB-SPEC, Sections, item 2
    expect(chips).toEqual([
      '15 minutes',
      'After Lesson 14: Phrasing: sing a whole song',
      'Sound on',
      'Microphone optional',
    ])
    expect(doc().querySelector('.l22-hero .meta a')?.getAttribute('href')).toBe(
      '/learn/14',
    )
  })

  it("plays Merc's note freely under the stage, and holds both straight notes for a choice", () => {
    // Arrange
    const plays = Array.from(
      doc().querySelectorAll<HTMLButtonElement>('.hero-plays [data-play]'),
    )

    // Assert: WEB-SPEC, Toys 1
    expect(plays.map((b) => [b.dataset.play, words(b), usable(b)])).toEqual([
      ['wave', "Play Merc's note", true],
      ['top', 'Play: top', false],
      ['middle', 'Play: middle', false],
    ])
    expect(plays[0].hasAttribute('data-free')).toBe(true)
    expect(words(doc().querySelector('#predict .lock-hint'))).toBe(
      'Choose an answer to unlock the two straight notes.',
    )
  })

  it("holds back every control of the steps' band chart and of free play, under their lock lines", () => {
    // Arrange
    const d = doc()
    const controls = (root: string): Element[] =>
      Array.from(
        d.querySelectorAll(
          `${root} :is([data-vib-play], input, [data-vib-drift], [data-free-state])`,
        ),
      )

    // Assert: WEB-SPEC, Toys 2, "Before the choice nothing on the page plays
    // its answer"; free play's state switch is held with the rest
    expect(d.querySelectorAll('#freePlay [data-free-state]')).toHaveLength(4)
    for (const root of ['#toyChart', '#freePlay']) {
      expect(controls(root).length, root).toBeGreaterThan(8)
      for (const c of controls(root)) expect(usable(c), root).toBe(false)
      expect(words(d.querySelector(`${root} [data-vib-lock]`))).toBe(
        'Choose an answer at the top to unlock this figure.',
      )
    }
    expect(words(d.querySelector('#freePlay [data-vib-lock3]'))).toBe(
      "Answer Step 3's question first to hear this.",
    )
    // Step 3's Rate, its play and Drift wait for Step 3's own choice too,
    // and so does free play's slow wave (the steps' is Step 3's predict's)
    for (const [root, held] of [
      ['#toyChart', 3],
      ['#freePlay', 4],
    ] as const)
      expect(
        d.querySelectorAll(`${root} [data-held="step-3"]`),
        root,
      ).toHaveLength(held)
  })

  it("holds Step 3's predict until the cold open's choice, asking for that choice first", () => {
    // Arrange
    const card = doc().getElementById('predict3')

    // Assert: WEB-SPEC, Toys 3
    const controls = Array.from(
      card?.querySelectorAll('[data-choice], [data-play]') ?? [],
    )
    expect(controls).toHaveLength(4)
    for (const c of controls) expect(usable(c)).toBe(false)
    expect(words(card?.querySelector('.lock-hint'))).toBe(
      'Choose an answer at the top first.',
    )
    expect(
      card?.querySelector('[data-play="six"]')?.hasAttribute('data-free'),
    ).toBe(true)
  })

  it('gives its four words a figure and a play each, the plays open', () => {
    // Arrange
    const tickets = Array.from(doc().querySelectorAll('#words .ticket'))

    // Assert: WEB-SPEC, Toys 4
    expect(tickets.map((t) => words(t.querySelector('h3')))).toEqual([
      'Vibrato',
      'Rate',
      'Extent',
      'Straight note',
    ])
    for (const t of tickets) {
      expect(t.querySelector('.word-chart canvas')).not.toBeNull()
      const play = t.querySelector('[data-word-play]')
      expect(play && usable(play)).toBe(true)
    }
  })

  it('draws no staff for show: no section head carries the faint staff, and the body drops the background', () => {
    // Arrange
    const d = doc()

    // Assert: WEB-SPEC, Look; Tests 20
    expect(d.querySelectorAll('.mv-staff, svg.clef')).toHaveLength(0)
    expect(d.body.classList.contains('season-2')).toBe(true)
  })

  it("holds Sing it's series lines, its two holds' cues and one listening note", () => {
    // Arrange
    const sing = doc().getElementById('sing')
    const text = words(sing)

    // Assert: LESSON.md, Sing it; FACTS 47 to 60
    for (const line of [
      'Your turn: one note, ten seconds, twice.',
      'Sore, hoarse or unwell today? Just listen along.',
      "I'm comfortable: let's sing",
      'Just listen today',
      'Lower: sing with Merc, around A3',
      'Higher: sing with Tavi, around A4',
      "Copy the way Merc's voice slides, not the exact notes.",
      "What this does: it draws your line, takes a vibrato's wave out to find its middle, and measures how long that middle stays in Merc's band, in any octave.",
      'Hold 1, straight: ten seconds on your note, as level as feels easy.',
      "Hold 2, floating: ten seconds again. Let the note float. If a wave comes, let it; if it doesn't, the note is just as finished.",
      "If that felt tricky, good: that's learning.",
      'Rest for a few easy breaths. Ready when you are.',
      'No microphone? Sing along anyway: Merc sings the note first, and nothing listens.',
    ])
      expect(text, line).toContain(line)
    expect(
      Array.from(sing?.querySelectorAll('[data-listen-len]') ?? [], words),
    ).toEqual(["Play Merc's 10-second note"])
    expect(words(sing?.querySelector('[data-sing="hold2"]'))).toBe(
      'Hold 2: floating',
    )
    expect(sing?.querySelector('[data-vibrato-line]')).not.toBeNull()
    expect(sing?.querySelectorAll('[data-feel]')).toHaveLength(4)
  })

  it('links Voice Mirror with the lesson, and its rest version links nothing', () => {
    // Arrange
    const d = doc()
    const card = d.getElementById('practiseCard')

    // Assert: WEB-SPEC, Practice links
    expect(
      Array.from(
        card?.querySelectorAll('[data-ending="practise"] a') ?? [],
        (a) => a.getAttribute('href'),
      ),
    ).toEqual(['/mirror?lesson=22'])
    expect(card?.querySelectorAll('[data-ending="rest"] a')).toHaveLength(0)
    expect(words(card?.querySelector('[data-ending="rest"]'))).toBe(
      'Rest today. Voice Mirror will be here when your voice feels comfortable: mercurypitch.com/mirror',
    )
    expect(
      Array.from(d.querySelectorAll('a[href*="?lesson="]'), (a) =>
        a.getAttribute('href'),
      ),
    ).toEqual(['/mirror?lesson=22', '/mirror?lesson=22'])
  })

  it('names a share card that is in public/, at its size', () => {
    // Arrange
    const image = metaOf('og:image')?.replace('https://mercurypitch.com/', '')
    const bytes = readFileSync(resolve(process.cwd(), 'public', image ?? ''))

    // Act
    const size = jpegSize(bytes)

    // Assert
    expect(image).toBe('learn/lesson-22-og.jpg')
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
