// ============================================================
// Lesson 20's page document — its references, its order, nothing that answers the predict
// ============================================================
//
// learn/20.html is hand-written markup, so some of its promises are held
// here: every id a label or description points at exists, once; every
// button is a button, not a submit; there is no Watch section, because
// Lesson 20 has no film; the page opens on its cold open, the recall after
// it, shown to everyone, and before the four words; nothing a reader meets
// before the predict's choice outside the predict itself says what the
// pianists' study found (FACTS 1a; WEB-SPEC, Tests 18): the head, the share
// card, the title, the promise, the sound gate and the structured data, nor
// the step headings, the section headings, the recall or the four words,
// whose only "slow" is the Run word's play; the hero has its seven chips and
// its two free plays, and the predict, a research predict, has no play of
// its own and keeps its reveal hidden (Toys 2 and 3); the steps share two
// toys, the staircase and the run (Toys 1 and 5), and free play has both
// with every control; no section head carries the faint staff and its clef,
// and the body drops the background's, since a Season 2 page draws no staff
// for show (WEB-SPEC, Look); Sing it holds the series' lines and this
// page's runs; the practice links carry the lesson, and the rest version
// sends no one to sing, Staccato Precision dropped with Scale Runner's
// link; the share card its head names is in public/, at its size; and every
// line of its copy says only what the claims check passes.

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import { validateGuidedDynamicClaim } from '@/lib/guided-voice/claims'
import { PAGE, words } from './page-dom.test-fixtures'

/** The share card's words (WEB-SPEC, Sections, item 2). */
const SHARE_ALT =
  'The title card: Find Your Pitch, Lesson 20, Runs and the pentatonic scale, above a pitch line with nine beads on a string, each in its band, between Merc and Tavi.'

/** What would say what the study found: the share of tries, playing right, accuracy, how long, or slowness (FACTS 1a). */
const FINDING = /\bshare\b|\bcorrect|\baccura|how long|\bslow/i

/** The two plays that name a tempo to hear, the only "slow" a reader meets before the choice. */
const TEMPO_PLAYS = /Play it slowly|the run, slowly/g

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

/** Whether an element or a box around it is hidden in the markup. */
const hiddenIn = (e: Element | null | undefined): boolean =>
  e?.closest('[hidden]') !== null

/** A toy's controls, as a reader meets them: each one's hook, its words and whether it shows. */
const controlsOf = (root: Element | null): (string | boolean)[][] =>
  Array.from(
    root?.querySelectorAll(
      '[data-stairs-play], [data-stairs-five], [data-mode], [data-slide], [data-tempo], [data-touch], [data-run-play], [data-run-staff]',
    ) ?? [],
    (b) => [
      [
        'data-stairs-play',
        'data-stairs-five',
        'data-mode',
        'data-slide',
        'data-tempo',
        'data-touch',
        'data-run-play',
        'data-run-staff',
      ]
        .filter((a) => b.hasAttribute(a))
        .map((a) => `${a}=${b.getAttribute(a)}`)
        .join(''),
      prose(b),
      !hiddenIn(b),
    ],
  )

describe("Lesson 20's page", () => {
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
      'Next: Is there a minor pentatonic too?',
    )
  })

  it('opens on its cold open, then the recall, the words, the steps, Sing it, the check, the Wrap and the explorer, with no Watch section', () => {
    // Act
    const order = Array.from(
      doc().querySelectorAll('main > section'),
      (s) => s.id || s.className.split(' ')[0],
    )

    // Assert: Lesson 2's order (FACTS 5a); Lesson 20 has no film
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

  it('says nothing of what the study found in its head, its share card, its title, its promise, its sound gate or its structured data', () => {
    // Arrange: what a reader meets before the predict's choice
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
      words(d.querySelector('.l20-hero .promise')),
      words(d.getElementById('gateText')),
      words(d.querySelector('#stageShot .bubbles')),
      words(d.getElementById('predictQ')),
      ...Array.from(
        d.querySelectorAll('script[type="application/ld+json"]'),
        (s) => s.textContent ?? '',
      ),
    ]

    // Assert: FACTS 1a; WEB-SPEC, Sections, item 2, and Tests 10 and 18
    expect(head.every((t) => t !== undefined && t !== '')).toBe(true)
    for (const t of head) expect(t, t).not.toMatch(FINDING)
    expect([metaOf('og:image:alt'), metaOf('twitter:image:alt')]).toEqual([
      SHARE_ALT,
      SHARE_ALT,
    ])
    expect(d.title).toBe(
      'Pentatonic scale and singing fast runs | MercuryPitch',
    )
    expect(metaOf('description')).toHaveLength(148)
    expect(metaOf('description')).toContain('A fifteen-minute lesson')
    expect(PAGE).toContain('"timeRequired": "PT15M"')
  })

  it('says nothing of it in its step headings, its section headings, the recall or the four words, whose only slowness is a tempo to hear, and keeps the reveal hidden', () => {
    // Arrange
    const d = doc()
    const headings = Array.from(d.querySelectorAll('.step h3'), words)
    const parts = [
      ...Array.from(d.querySelectorAll('main .mv-head'), (h) => words(h)),
      words(d.getElementById('recall')),
      prose(d.getElementById('words')),
      prose(d.querySelector('.hero-plays')),
    ].map((t) => t.replace(TEMPO_PLAYS, ''))

    // Assert: the lesson menu lists these headings from the first paint;
    // Step 3's asks the question, and its text, further down, answers it
    expect(headings).toEqual([
      "What's left when fa and ti go?",
      'Is there a minor pentatonic too?',
      'How do I make a run faster without smudging it?',
      'How do short notes help?',
    ])
    for (const t of [...headings, ...parts]) expect(t, t).not.toMatch(FINDING)
    expect(d.querySelector('#predict .reveal')?.hasAttribute('hidden')).toBe(
      true,
    )
  })

  it('has its seven chips, linking Lessons 5, 9 and 10', () => {
    // Arrange
    const d = doc()
    const chips = Array.from(d.querySelectorAll('.l20-hero .meta > li'), words)

    // Assert: FACTS 2 and 3
    expect(chips).toEqual([
      '15 minutes',
      'After Lesson 5: Breath and a steady note',
      'After Lesson 9: Landing a leap',
      'After Lesson 10: Major and minor',
      'Also useful: Lesson 19, Threes and offbeats',
      'Sound on',
      'Microphone optional',
    ])
    expect(
      Array.from(d.querySelectorAll('.l20-hero .meta a'), (a) =>
        a.getAttribute('href'),
      ),
    ).toEqual(['/learn/05', '/learn/09', '/learn/10'])
  })

  it('plays the run fast or slowly for everyone, under a pitch line that names no note yet, and keeps the predict a research predict with no play of its own', () => {
    // Arrange
    const d = doc()
    const plays = Array.from(
      d.querySelectorAll<HTMLButtonElement>('.hero-plays [data-play]'),
    )

    // Assert: WEB-SPEC, Toys 2 and 3; FACTS 11, 12 and 15
    expect(
      plays.map((b) => [
        b.dataset.play,
        words(b),
        usable(b),
        b.hasAttribute('data-free'),
      ]),
    ).toEqual([
      ['fast', 'Play the run fast', true, true],
      ['slow', 'Play it slowly', true, true],
    ])
    expect(d.querySelectorAll('#predict [data-play]')).toHaveLength(0)
    expect(
      Array.from(d.querySelectorAll('#predict [data-choice]'), (c) => [
        c.getAttribute('data-choice'),
        words(c),
      ]),
    ).toEqual([
      ['time', 'How long they practised'],
      ['share', 'What share of their tries came out right'],
    ])
    expect(words(d.querySelector('#predict .lock-hint'))).toBe(
      'Choose an answer to see what the study found.',
    )
    const reveal = words(d.querySelector('#predict .reveal'))
    expect(reveal).toMatch(/^What share of their tries came out right\. /)
    expect(reveal).toContain('(Duke, Simmons and Cash, 2009)')
    expect(reveal).toMatch(/which made “how long” a fair guess\.\)$/)
    expect(reveal).not.toContain('Now play the other one')
    const label = d.querySelector('#heroRun canvas')?.getAttribute('aria-label')
    expect(label).toBe(
      "Merc's run on the pitch line: nine beads on a string, each in its band",
    )
    expect(label).not.toMatch(/\b(do|re|mi|so|la)\b/)
  })

  it('puts Steps 1 and 2 on the staircase and Steps 3 and 4 on the run, each with its own controls', () => {
    // Arrange
    const d = doc()

    // Assert: WEB-SPEC, Toys 1 and 5
    expect(
      Array.from(d.querySelectorAll('#stepsStage [data-toy]'), (t) => [
        t.getAttribute('data-toy'),
        t.id,
      ]),
    ).toEqual([
      ['1', 'toyStairs'],
      ['2', 'toyRun'],
    ])
    // the staircase: no names switch, its readout hidden, Leave out fa and
    // ti off, Major · Minor waiting for Step 2, its slide C3 to B3 when no
    // voice is stored
    const stairs = d.getElementById('toyStairs')
    expect(stairs?.querySelector('[data-names]')).toBeNull()
    expect(hiddenIn(stairs?.querySelector('[data-stairs-readout]'))).toBe(true)
    expect(controlsOf(stairs)).toEqual([
      ['data-stairs-play=up', 'Play up', true],
      ['data-stairs-five=', 'Leave out fa and ti', true],
      ['data-mode=major', 'Major', false],
      ['data-mode=minor', 'Minor', false],
      ['data-slide=-1', 'Start lower', true],
      ['data-slide=1', 'Start higher', true],
    ])
    const slider = stairs?.querySelector('[data-start-slider]')
    expect(
      ['aria-valuemin', 'aria-valuemax', 'aria-valuenow'].map((a) =>
        slider?.getAttribute(a),
      ),
    ).toEqual(['48', '59', '48'])
    // the run: Tempo at 0.6 s, Staccato · Legato waiting for Step 4, the
    // staff off and hidden
    const run = d.getElementById('toyRun')
    expect(controlsOf(run)).toEqual([
      ['data-tempo=0.75', '0.75 s', true],
      ['data-tempo=0.6', '0.6 s', true],
      ['data-tempo=0.45', '0.45 s', true],
      ['data-tempo=0.3', '0.3 s', true],
      ['data-tempo=0.2', '0.2 s', true],
      ['data-touch=staccato', 'Staccato', false],
      ['data-touch=legato', 'Legato', false],
      ['data-run-play=run', 'Play the run', true],
      ['data-run-play=smudged', 'Play it smudged', true],
      ['data-run-staff=', 'See it on the staff', true],
    ])
    expect(
      pressed(run?.querySelector('[data-run-tempo]') ?? null, 'data-tempo'),
    ).toEqual(['0.6'])
    expect(
      pressed(run?.querySelector('[data-run-touch]') ?? null, 'data-touch'),
    ).toEqual(['legato'])
    expect(
      run?.querySelector('[data-run-staff]')?.getAttribute('aria-pressed'),
    ).toBe('false')
    expect(hiddenIn(run?.querySelector('[data-staff-viz]'))).toBe(true)
  })

  it("puts each step's own plays in its text, a Go deeper drawer in Steps 1 and 2, and the mix-up card in Step 3", () => {
    // Arrange
    const d = doc()

    // Assert: LESSON.md, Steps 1 to 4; WEB-SPEC, Toys 7
    expect(
      Array.from(d.querySelectorAll('.step [data-step-play]'), (b) => [
        b.closest('.step')?.getAttribute('data-step'),
        b.getAttribute('data-step-play'),
        prose(b),
      ]),
    ).toEqual([
      ['1', 'major-five', 'Play C major, then the five'],
      ['2', 'both', 'Play both'],
      ['2', 'on-c', 'Play it on C'],
      ['4', 'touch', 'Play staccato, then legato'],
    ])
    expect(
      Array.from(d.querySelectorAll('.step details.deeper'), (g) => [
        g.closest('.step')?.getAttribute('data-step'),
        g.hasAttribute('open'),
        words(g.querySelector('li b')),
      ]),
    ).toEqual([
      ['1', false, 'Not everywhere.'],
      ['2', false, 'Blues.'],
    ])
    expect(
      Array.from(d.querySelectorAll('.step .mixup'), (m) =>
        m.closest('.step')?.getAttribute('data-step'),
      ),
    ).toEqual(['3'])
    expect(words(d.querySelector('.mixup blockquote'))).toBe(
      '“Speed comes from practising it fast.”',
    )
  })

  it('gives free play both toys with every control from the steps', () => {
    // Arrange
    const d = doc()

    // Assert: WEB-SPEC, Sections 8
    expect(controlsOf(d.getElementById('freeStairs'))).toEqual([
      ['data-stairs-play=up', 'Play up', true],
      ['data-stairs-five=', 'Leave out fa and ti', true],
      ['data-mode=major', 'Major', true],
      ['data-mode=minor', 'Minor', true],
      ['data-slide=-1', 'Start lower', true],
      ['data-slide=1', 'Start higher', true],
    ])
    expect(
      controlsOf(d.getElementById('freeRun')).map(([hook, , shows]) => [
        hook,
        shows,
      ]),
    ).toEqual([
      ['data-tempo=0.75', true],
      ['data-tempo=0.6', true],
      ['data-tempo=0.45', true],
      ['data-tempo=0.3', true],
      ['data-tempo=0.2', true],
      ['data-touch=staccato', true],
      ['data-touch=legato', true],
      ['data-run-play=run', true],
      ['data-run-play=smudged', true],
      ['data-run-staff=', true],
    ])
  })

  it('gives three of its four words a figure and a play, and Agility neither', () => {
    // Arrange
    const tickets = Array.from(doc().querySelectorAll('#words .ticket'))

    // Assert: WEB-SPEC, Toys 4; FACTS 28
    expect(
      tickets.map((t) => [
        words(t.querySelector('h3')),
        t.querySelector('[data-word-fig]') !== null,
        prose(t.querySelector('[data-word-play]')),
      ]),
    ).toEqual([
      ['Run', true, 'Play: the run, slowly'],
      ['Pentatonic scale', true, 'Play: C, D, E, G, A, C'],
      ['Minor pentatonic', true, 'Play: A, C, D, E, G, A'],
      ['Agility', false, ''],
    ])
  })

  it('draws no staff for show: no section head carries the faint staff, and the body drops the background', () => {
    // Arrange
    const d = doc()

    // Assert: WEB-SPEC, Look, and Tests 16
    expect(d.querySelectorAll('.mv-staff, svg.clef')).toHaveLength(0)
    expect(d.body.classList.contains('season-2')).toBe(true)
  })

  it("holds Sing it's series lines and this page's runs, with Move do's lower end where every visit starts", () => {
    // Arrange
    const sing = doc().getElementById('sing')
    const text = prose(sing)

    // Assert: LESSON.md, Sing it
    for (const line of [
      'Sore, hoarse or unwell today? Just listen along.',
      "I'm comfortable: let's sing",
      'Just listen today',
      'Good call. Merc sings the run, and nothing listens. Rest your voice.',
      'Choose a voice: it picks who sings.',
      'Lower: sing with Merc, around A3',
      'Higher: sing with Tavi, around A4',
      'Warm-up, optional, about a minute.',
      'Your turn: the run. Choose a run:',
      'The run: up to la',
      'Smaller: up to so',
      'Merc sings it first, or Tavi an octave higher, a note every 0.75 seconds.',
      'If the bottom feels low, move do, your starting note, higher.',
      'Stop immediately if anything feels uncomfortable.',
      "“Mi · In the band: 20 cents below Merc's note.”",
      "“So again · We didn't hear a steady note there.”",
      "Play Merc's run",
      "If that felt tricky, good: that's learning.",
      "That's the run, faster.",
      'Merc sings it at a note every 0.45 seconds, then the beads light in turn. Sing along if you like: nothing listens and nothing is scored.',
      'Keep it gentle: rest before you sing again.',
      "Thanks for saying so. That's enough singing for today: rest your voice.",
      'No microphone? Sing along anyway: Merc sings the run first, and nothing listens.',
    ])
      expect(text, line).toContain(line)
    expect(sing?.querySelectorAll('[data-feel]')).toHaveLength(4)
    expect(
      Array.from(sing?.querySelectorAll('[data-sing]') ?? [], (b) => [
        b.getAttribute('data-sing'),
        b.getAttribute('aria-label') ?? prose(b),
      ]),
    ).toEqual([
      ['start', 'Start'],
      ['again', 'Again: the run'],
      ['again-smaller', 'Again, smaller run'],
      ['faster', 'Again, faster'],
      ['start-again', 'Start again'],
      ['today', 'Done for today'],
    ])
    expect(
      pressed(sing?.querySelector('.ladder-choice') ?? null, 'data-ladder'),
    ).toEqual(['full'])
    expect(
      Array.from(sing?.querySelectorAll('[data-move-do]') ?? [], usable),
    ).toEqual([false, true])
    expect(sing?.querySelector('[data-readings]')?.hasAttribute('hidden')).toBe(
      true,
    )
  })

  it('links Scale Runner and Staccato Precision with the lesson; its rest version names Scale Runner for another day with no link, and drops Staccato Precision, since both ask for the voice', () => {
    // Arrange
    const d = doc()
    const card = d.getElementById('practiseCard')
    const second = card?.querySelector('.second-drill')

    // Assert: LESSON.md, Wrap; FACTS 69 and 72
    expect(words(card?.querySelector('h3'))).toBe('Scale Runner')
    expect(words(card?.querySelector('[data-ending="rest"]'))).toBe(
      'Rest today. Scale Runner will be here when your voice feels comfortable: mercurypitch.com/pitch-training, then tap Scale Runner.',
    )
    expect(card?.querySelectorAll('[data-ending="rest"] a')).toHaveLength(0)
    expect(second?.closest('[data-ending]')?.getAttribute('data-ending')).toBe(
      'practise',
    )
    expect(prose(second)).toBe(
      'For short notes, Staccato Precision plays short notes from the major scale, shuffled; sing each back in the octave it plays. Free: mercurypitch.com/pitch-training, then tap Staccato Precision.',
    )
    expect(
      Array.from(d.querySelectorAll('a[href*="?lesson="]'), (a) =>
        a.getAttribute('href'),
      ),
    ).toEqual([
      '/pitch-training?lesson=20',
      '/pitch-training?lesson=20',
      '/pitch-training?lesson=20',
    ])
    expect(PAGE).not.toContain('/exercises/speed-scales')
  })

  it("draws the tease still as markup: Lesson 21's ring of twelve beads, D major's seven lit, F sharp and C sharp named on the keys, and nothing to press", () => {
    // Arrange
    const tease = doc().querySelector('.l20-next .l20-tease')
    const ring = tease?.querySelector('svg[data-tease-ring]')
    const parts = Array.from(ring?.children ?? [])
    const beads = Array.from(
      parts.find((c) => c.tagName === 'g')?.children ?? [],
    )

    // Act: a bead lit for D major wears a halo, a second circle behind it
    const named = beads.map((g) => words(g.querySelector('text')))
    const lit = beads
      .filter((g) => g.querySelectorAll('circle').length === 2)
      .map((g) => words(g.querySelector('text')))
    const keys = parts.filter((c) => c.tagName === 'text').map((t) => words(t))

    // Assert: WEB-SPEC, Toys 9
    expect(tease?.getAttribute('aria-hidden')).toBe('true')
    expect(beads).toHaveLength(12)
    expect(named.filter((n) => n !== '')).toEqual([
      'C',
      'C♯',
      'D',
      'E',
      'F',
      'F♯',
      'G',
      'A',
      'B',
    ])
    expect(lit).toEqual(['C♯', 'D', 'E', 'F♯', 'G', 'A', 'B'])
    expect(keys).toEqual(['F♯', 'C♯'])
    expect(tease?.querySelectorAll('a, button, [tabindex]')).toHaveLength(0)
    expect(tease?.querySelector('script, use')).toBeNull()
  })

  it('names a share card that is in public/, at its size', () => {
    // Arrange
    const image = metaOf('og:image')?.replace('https://mercurypitch.com/', '')
    const bytes = readFileSync(resolve(process.cwd(), 'public', image ?? ''))

    // Act
    const size = jpegSize(bytes)

    // Assert
    expect(image).toBe('learn/lesson-20-og.jpg')
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

    // Assert: WEB-SPEC, Tests 14
    expect(blocks.length).toBeGreaterThan(100)
    for (const text of blocks)
      expect(
        validateGuidedDynamicClaim({ surface: 'finding', text }).violations,
        text,
      ).toEqual([])
  })
})
