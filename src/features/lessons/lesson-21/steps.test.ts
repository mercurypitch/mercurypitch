// ============================================================
// Lesson 21 steps tests — the staircase, the circle, Find do and the walk on the page's own markup
// ============================================================
//
// On the page's markup and its own deck (WEB-SPEC, Toys 1 to 4): Step 1's
// G major writes F sharp with its own sharp, ringed, and moves it into the
// signature as the scale ends, White keys only drops the signature and
// plays the white keys, and the next G major brings the sharp in again;
// Steps 2 and 3 walk the house round their sides of the circle, each move
// playing the key's scale under the signature the keys share and adding
// the new sign as it ends, with Spell it on F major's fourth note; Find do
// runs its six rounds; and the walk plays its fourteen notes. Every staff
// is the learner's and follows Sing it's voice choice. Every sound is one
// of the kit's runs, here the recorder.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as RunModule from '@/features/lessons/kit/run'
import type { RecordedRun } from '@/features/lessons/kit/run-recorder.test-fixtures'
import { resetRuns, runs, } from '@/features/lessons/kit/run-recorder.test-fixtures'
import { VoiceChoice } from '@/features/lessons/kit/voice-choice'
import { el, mountSteps, settle, soundOn, words, } from './page-dom.test-fixtures'

vi.mock('@/features/lessons/kit/run', async (actual) => ({
  ...(await actual<typeof RunModule>()),
  ...(await import('@/features/lessons/kit/run-recorder.test-fixtures'))
    .recordedRuns,
}))

beforeEach(() => {
  resetRuns()
  soundOn()
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
  window.location.hash = ''
  document.body.textContent = ''
})

const last = (): RecordedRun => runs[runs.length - 1]
const noteNames = (r: RecordedRun): string =>
  r.notes.map((n) => n.midi).join(' ')

/** Ends the latest run heard, every note sounded first. */
async function hear(r: RecordedRun = last()): Promise<void> {
  r.notes.forEach((_n, i) => r.note(i))
  r.end(true)
  await settle()
}

const signs = (root: string): number =>
  document.querySelectorAll(`${root} .st-keysign`).length
const rings = (root: string): number =>
  document.querySelectorAll(`${root} .st-outline`).length
const ownSigns = (root: string): number =>
  document.querySelectorAll(`${root} .st-sign:not(.st-keysign)`).length
const said = (root: string): string =>
  words(document.querySelector(`${root} [data-staff-said]`))
const click = (selector: string): void => el<HTMLElement>(selector).click()

/** An element's words as the eye reads them: each sign's spoken word (`.sr`) left out. */
function seen(e: Element): string {
  const copy = e.cloneNode(true) as Element
  copy.querySelectorAll('.sr').forEach((h) => h.remove())
  return (copy.textContent ?? '').replace(/\s+/g, ' ').trim()
}

describe('Step 1: the staircase on G', () => {
  it('plays G major from G2 at 0.4 s a note, writing F sharp with its own sharp, ringed', () => {
    // Arrange
    mountSteps()

    // Act
    click('#toyStairs [data-stairs-play]')
    last().notes.forEach((_n, i) => last().note(i))

    // Assert: FACTS 63
    expect(noteNames(last())).toBe('43 45 47 48 50 52 54 55')
    expect(last().notes.map((n) => n.t)).toEqual([
      0, 0.4, 0.8, 1.2, 1.6, 2, 2.4, 2.8,
    ])
    expect(ownSigns('#toyStairs')).toBe(1)
    expect(rings('#toyStairs')).toBe(1)
    expect(signs('#toyStairs')).toBe(0)
  })

  it('moves the sharp into G major’s signature as the scale ends, the note keeping no sign', async () => {
    // Arrange
    mountSteps()
    click('#toyStairs [data-stairs-play]')

    // Act
    await hear()

    // Assert
    expect(signs('#toyStairs')).toBe(1)
    expect(ownSigns('#toyStairs')).toBe(0)
    expect(said('#toyStairs')).toBe('Key signature: one sharp, F sharp')
  })

  it('drops the signature for the white keys and plays them plain, then brings the sharp back with the next G major', async () => {
    // Arrange: G major once, so the signature holds F sharp
    mountSteps()
    click('#toyStairs [data-stairs-play]')
    await hear()

    // Act: White keys only on, and play
    click('#toyStairs [data-white-keys]')
    const label = words(el('#toyStairs [data-stairs-play-label]'))
    click('#toyStairs [data-stairs-play]')
    const white = last()
    await hear(white)
    const whiteSigns = signs('#toyStairs') + ownSigns('#toyStairs')
    // and off again, and play
    click('#toyStairs [data-white-keys]')
    click('#toyStairs [data-stairs-play]')
    last().notes.forEach((_n, i) => last().note(i))
    const ringed = rings('#toyStairs')
    await hear()

    // Assert: FACTS 13; WEB-SPEC, Toys 1
    expect(label).toBe('Play the white keys from G')
    expect(noteNames(white)).toBe('43 45 47 48 50 52 53 55')
    expect(whiteSigns).toBe(0)
    expect(ringed).toBe(1)
    expect(signs('#toyStairs')).toBe(1)
  })

  it('names each stair, G major’s seventh F sharp, ti', () => {
    // Act
    mountSteps()

    // Assert
    expect(el('#toyStairs [data-stair="6"]').getAttribute('aria-label')).toBe(
      'Stair 7, ti, F sharp 3',
    )
  })
})

describe('Steps 2 and 3: the circle beside the staff', () => {
  it('steps the house round the sharp side, each key’s scale under the shared signature, the new sharp joining as it ends', async () => {
    // Arrange
    const deck = mountSteps()
    deck.show(2)

    // Act: C round to G, then to D
    click('#toyCircle [data-circle-step="1"]')
    const g = last()
    g.notes.forEach((_n, i) => g.note(i))
    const gRings = rings('#toyCircle')
    await hear(g)
    const gSigns = signs('#toyCircle')
    click('#toyCircle [data-circle-step="1"]')
    const d = last()
    d.notes.forEach((_n, i) => d.note(i))
    const dRings = rings('#toyCircle')
    await hear(d)

    // Assert: FACTS 63, a note every 0.3 s on G2 and D3
    expect(noteNames(g)).toBe('43 45 47 48 50 52 54 55')
    expect(g.notes[1].t).toBeCloseTo(0.3, 6)
    expect(g.notes[0].dur).toBeCloseTo(0.27, 6)
    expect(gRings).toBe(1)
    expect(gSigns).toBe(1)
    expect(noteNames(d)).toBe('50 52 54 55 57 59 61 62')
    expect(dRings).toBe(1)
    expect(signs('#toyCircle')).toBe(2)
    expect(said('#toyCircle')).toBe(
      'Key signature: two sharps, F sharp and C sharp',
    )
  })

  it('shows Spell it and the white keys from F in Step 3 only', () => {
    // Arrange
    const deck = mountSteps()

    // Act
    deck.show(2)
    const two = el('#toyCircle [data-spell]').hidden
    deck.show(3)

    // Assert
    expect(two).toBe(true)
    expect(el('#toyCircle [data-spell]').hidden).toBe(false)
    expect(el('#toyCircle [data-staff-play="white-f"]').hidden).toBe(false)
    expect(
      Array.from(
        document.querySelectorAll('#toyCircle [data-circle-beads] button'),
        (b) => b.getAttribute('aria-label'),
      ),
    ).toEqual([
      'E flat major, three flats',
      'B flat major, two flats',
      'F major, one flat',
      'C major, no sharps or flats',
    ])
  })

  it('spells F major with B flat under one flat, then with A sharp under none, two notes ringed', async () => {
    // Arrange
    const deck = mountSteps()
    deck.show(3)

    // Act: B flat first, so the staff holds F major's flat
    click('#toyCircle [data-spelling="flat"]')
    const flat = last()
    flat.notes.forEach((_n, i) => flat.note(i))
    const flatSigns = signs('#toyCircle')
    const flatSaid = said('#toyCircle')
    await hear(flat)
    click('#toyCircle [data-spelling="sharp"]')
    const sharp = last()
    sharp.notes.forEach((_n, i) => sharp.note(i))

    // Assert: the same sounds both ways, F2 to F3 at 0.4 s a note
    expect(noteNames(flat)).toBe('41 43 45 46 48 50 52 53')
    expect(noteNames(sharp)).toBe(noteNames(flat))
    expect(flat.notes[1].t).toBeCloseTo(0.4, 6)
    expect(flatSigns).toBe(1)
    expect(flatSaid).toBe('One note on every letter')
    expect(rings('#toyCircle')).toBe(2)
    expect(signs('#toyCircle')).toBe(0)
    expect(said('#toyCircle')).toBe('Two notes on A, none on B')
    expect(
      el('#toyCircle [data-spelling="sharp"]').getAttribute('aria-pressed'),
    ).toBe('true')
    expect(
      el('#toyCircle [data-circle-beads] [aria-current="true"]').getAttribute(
        'aria-label',
      ),
    ).toBe('F major, one flat')
  })

  it('sets Spell it back to B flat as the house leaves F', () => {
    // Arrange
    const deck = mountSteps()
    deck.show(3)
    click('#toyCircle [data-spelling="sharp"]')

    // Act: F round to C
    click('#toyCircle [data-circle-step="1"]')

    // Assert
    expect(
      el('#toyCircle [data-spelling="flat"]').getAttribute('aria-pressed'),
    ).toBe('true')
    expect(
      el('#toyCircle [data-spelling="sharp"]').getAttribute('aria-pressed'),
    ).toBe('false')
    expect(noteNames(last())).toBe('48 50 52 53 55 57 59 60')
  })

  it('plays F major spelled both ways from the mix-up card, 0.5 s apart', async () => {
    // Arrange
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const deck = mountSteps()
    deck.show(3)

    // Act
    click('[data-staff-play="both-ways"]')
    const first = last()
    await hear(first)
    const before = runs.length
    vi.advanceTimersByTime(499)
    await settle()
    const early = runs.length
    vi.advanceTimersByTime(1)
    await settle()

    // Assert: FACTS 63, 6.8 s in all
    expect(early).toBe(before)
    expect(runs.length).toBe(before + 1)
    expect(noteNames(last())).toBe(noteNames(first))
  })
})

describe('Step 4: Find do', () => {
  it('opens on G major’s signature and says why a tap on G is right, then plays do, mi and so from the house', async () => {
    // Arrange
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const deck = mountSteps()
    deck.show(4)
    const sigs = signs('#toyFind')

    // Act: the bass staff's bottom line is G2
    deck.steps.find.staff.tapPlace(0)
    const line = seen(el('#toyFind [data-find-line]'))
    const heard = runs.length
    vi.advanceTimersByTime(999)
    const early = runs.length
    vi.advanceTimersByTime(1)

    // Assert: FACTS 26 and 63; the place and the line said as one sentence
    expect(sigs).toBe(1)
    expect(el('#toyFind [data-staff-svg]').getAttribute('aria-label')).toBe(
      'Bass staff, five lines and four spaces. Key signature: one sharp, F sharp',
    )
    expect(line).toBe('Do is G. The last sharp, F♯, is ti.')
    expect(said('#toyFind')).toBe(
      'G2, the bottom line. Do is G. The last sharp, F sharp, is ti.',
    )
    expect(el('#toyFind [data-find-next]').hidden).toBe(false)
    expect(early).toBe(heard)
    expect(noteNames(last())).toBe('43 47 50')
  })

  it('names a wrong tap and gives the rule, and counts nothing', () => {
    // Arrange
    const deck = mountSteps()
    deck.show(4)

    // Act: the bottom space, A2
    deck.steps.find.staff.tapPlace(1)

    // Assert
    expect(seen(el('#toyFind [data-find-line]'))).toBe(
      "That's A. Look at the last sharp: do sits a semitone above it.",
    )
    expect(el('#toyFind [data-find-next]').hidden).toBe(true)
  })

  it('plays a tapped place as the signature has it: the F line in G major is F sharp', () => {
    // Arrange
    const deck = mountSteps()
    deck.show(4)

    // Act: the bass staff's fourth line, F3
    deck.steps.find.staff.tapPlace(6)

    // Assert
    expect(last().notes[0].midi).toBe(54)
    expect(seen(el('#toyFind [data-find-line]'))).toBe(
      "That's F♯. Look at the last sharp: do sits a semitone above it.",
    )
    expect(said('#toyFind')).toBe(
      "F sharp 3, the fourth line. That's F sharp. Look at the last sharp: do sits a semitone above it.",
    )
  })

  it('runs six rounds, then says all six are found and offers Again, which starts at G', () => {
    // Arrange: do's place in each round on the bass staff
    const deck = mountSteps()
    deck.show(4)
    const doPlaces = [0, 4, 1, 6, 2, 5]

    // Act
    doPlaces.forEach((place, i) => {
      deck.steps.find.staff.tapPlace(place)
      if (i < 5) click('#toyFind [data-find-next]')
    })
    const line = seen(el('#toyFind [data-find-line]'))
    click('#toyFind [data-find-again]')

    // Assert
    expect(line).toBe('Do is E♭: the second-to-last flat. All six found.')
    expect(deck.steps.find.round).toBe(0)
    expect(signs('#toyFind')).toBe(1)
  })
})

describe('Step 5: the walk', () => {
  it('plays the walk as the switch says', () => {
    // Arrange
    const deck = mountSteps()
    deck.show(5)

    // Act
    click('#toyWalk [data-tuning="equal"]')
    click('#toyWalk [data-walk-play]')

    // Assert: twelve fifths, the C they reach, and the first C again
    expect(last().notes).toHaveLength(14)
    expect(last().notes[12].midi).toBeCloseTo(60, 6)
  })
})

describe('the learner’s clef', () => {
  it('opens every staff in the bass clef with no voice stored, and moves each to the treble as the voice is chosen', () => {
    // Arrange
    const deck = mountSteps()
    const before = deck.steps.stairs.staff.clef

    // Act
    VoiceChoice.set('higher')

    // Assert: G4 for the higher voice
    expect(before).toBe('bass')
    expect(deck.steps.stairs.staff.clef).toBe('treble')
    expect(deck.steps.stairs.core.tonic).toBe(67)
    expect(deck.steps.circle.staff.clef).toBe('treble')
    expect(deck.steps.find.staff.clef).toBe('treble')
    VoiceChoice.set('lower')
  })

  it('writes the scales in the other G when the Clef switch shows the other staff', () => {
    // Arrange
    const deck = mountSteps()

    // Act
    click('#toyStairs [data-clef="treble"]')
    click('#toyStairs [data-stairs-play]')

    // Assert
    expect(noteNames(last())).toBe('67 69 71 72 74 76 78 79')
    expect(deck.steps.stairs.core.tonic).toBe(67)
  })
})
