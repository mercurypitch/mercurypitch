// ============================================================
// Lesson 27 ring toy tests — the steps' toy and free play on the page's own markup
// ============================================================
//
// The WEB-SPEC's Toys 1 and Tests 3, 5, 7, 8 and 19, with the kit's runs a
// recorder: I lit at first paint and the V chip held under the steps'
// line until the cold open's choice; a chip's chord, and Add the seventh's,
// at 1.2 s and at 0.075 or 0.056 a voice, written in one column of the
// learner's staff; the root's distance to the seventh in the readout; V7's
// rooms drawn as V until the choice; Step 3's diagonal; Step 4's chips and
// Turn over held until its own choice, each press moving the lowest note
// up an octave, climbing on the staff, the bass mark moving from the
// corner it leaves, and the press after the last inversion bringing back
// the first pitches; the positions, and a turned chord's name, said only
// after Step 4's reveal; and free play's controls held under their lines.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { signName } from '@/features/lessons/kit/notes'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import type * as RunModule from '@/features/lessons/kit/run'
import type { RunNote } from '@/features/lessons/kit/run'
import { resetRuns, runs, } from '@/features/lessons/kit/run-recorder.test-fixtures'
import { writtenOf } from '@/features/lessons/kit/staff-places'
import { el, loadPage, settle, soundOn, words } from './page-dom.test-fixtures'
import type { RingToy } from './ring-toy'
import { mountRingToy, RING_STATES } from './ring-toy'

vi.mock('@/features/lessons/kit/run', async (actual) => ({
  ...(await actual<typeof RunModule>()),
  ...(await import('@/features/lessons/kit/run-recorder.test-fixtures'))
    .recordedRuns,
}))

/** A run's notes as written: "C3 E3 G3". */
const written = (notes: readonly RunNote[]): string =>
  notes.map((n) => signName(writtenOf(n.midi))).join(' ')

const last = () => runs[runs.length - 1]

/** The steps' toy, mounted on the page's markup in the lower voice, on `state`. */
function steps(state = RING_STATES[1]): RingToy {
  return mountRingToy(el('#toyRing'), {
    active: () => true,
    clef: 'bass',
    state,
  })
}

const label = (root = '#toyRing'): string =>
  el(`${root} [data-ring-canvas]`).getAttribute('aria-label') ?? ''
const readout = (root = '#toyRing'): string =>
  words(el(`${root} [data-ring-readout]`))
const said = (root = '#toyRing'): string =>
  words(el(`${root} [data-ring-said]`))
const button = (sel: string): HTMLButtonElement => el<HTMLButtonElement>(sel)

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] })
  loadPage()
  soundOn()
  resetRuns()
})

afterEach(() => {
  // a newer sound stops what the test started, before its timers are real again
  NowPlaying.claim(() => undefined)
  vi.useRealTimers()
  vi.restoreAllMocks()
  document.body.textContent = ''
})

describe("the steps' toy at first paint", () => {
  it('lights I and holds V back under the steps’ line, its ring a picture (FACTS 39)', () => {
    // Act
    steps()

    // Assert
    expect(label()).toMatch(
      /^Lesson 12's ring of rooms: I, C major: C, E and G/,
    )
    expect(label()).toContain('faint, V, G major: G, B and D')
    expect(button('#toyRing [data-part="1"] [data-chip="V"]').disabled).toBe(
      true,
    )
    expect(button('#toyRing [data-part="1"] [data-chip="I"]').disabled).toBe(
      false,
    )
    expect(el('#toyRing [data-lock-line]').hidden).toBe(false)
    expect(readout()).toBe('')
    // a picture: no slider on the ring
    const canvas = el('#toyRing [data-ring-canvas]')
    expect(canvas.hasAttribute('tabindex')).toBe(false)
    expect(canvas.hasAttribute('aria-valuetext')).toBe(false)
  })
})

describe("the steps' toy, Step 1", () => {
  it('plays I for 1.2 s at 0.075 a voice, in one column of the learner’s staff', () => {
    // Arrange
    steps()

    // Act
    button('#toyRing [data-part="1"] [data-chip="I"]').click()

    // Assert: the lower voice
    expect(written(last().notes)).toBe('C3 E3 G3')
    expect(last().notes.every((n) => n.dur === 1.2 && n.gain === 0.075)).toBe(
      true,
    )
    for (const i of [0, 1, 2]) last().note(i)
    const cols = new Set(
      Array.from(el('#toyRing').querySelectorAll('.st-head'), (h) =>
        h.getAttribute('transform')?.replace(/ .*/, ''),
      ),
    )
    expect(cols.size).toBe(1)
  })

  it('adds the seventh to the lit chord, at 0.056 a voice, the readout giving root to seventh (FACTS 42, 73)', () => {
    // Arrange
    steps()
    const seventh = button('#toyRing [data-seventh]')

    // Act
    seventh.click()

    // Assert
    expect(seventh.getAttribute('aria-pressed')).toBe('true')
    expect(written(last().notes)).toBe('C3 E3 G3 B3')
    expect(last().notes.every((n) => n.gain === 0.056)).toBe(true)
    expect(readout()).toBe('Root to seventh: 11 semitones')
    expect(label()).toContain(
      'I with its seventh: C, E, G and B. Root to seventh: 11 semitones',
    )
    // V's room stays three corners until the choice
    expect(label()).toContain('V, G major: G, B and D')
  })

  it('opens V with the choice, and with the seventh on plays V7, root to seventh 10 (FACTS 16, 39)', () => {
    // Arrange
    const toy = steps()
    button('#toyRing [data-seventh]').click()

    // Act
    toy.unlock()
    button('#toyRing [data-part="1"] [data-chip="V"]').click()

    // Assert
    expect(el('#toyRing [data-lock-line]').hidden).toBe(true)
    expect(written(last().notes)).toBe('G2 B2 D3 F3')
    expect(readout()).toBe('Root to seventh: 10 semitones')
    expect(label()).toContain(
      'V7: G, B, D and F. Root to seventh: 10 semitones',
    )
  })
})

describe("the steps' toy's chips", () => {
  it("keep the lit chord's chip marked after its play, apart from the play's light", async () => {
    // Arrange
    const toy = steps()
    toy.unlock()
    const chip = (c: string): HTMLButtonElement =>
      button(`#toyRing [data-part="1"] [data-chip="${c}"]`)

    // Act: V pressed, its play heard to its end
    chip('V').click()
    const sounding = chip('V').classList.contains('is-on')
    last().end(true)
    await settle()

    // Assert
    expect(sounding).toBe(true)
    expect(chip('V').classList.contains('is-on')).toBe(false)
    expect(chip('V').classList.contains('is-lit')).toBe(true)
    expect(chip('I').classList.contains('is-lit')).toBe(false)
  })
})

describe("the steps' toy, Steps 2 and 3", () => {
  it('draws V7’s room with three corners until the choice, then four (FACTS 39, 43)', () => {
    // Arrange
    const toy = steps()
    toy.setState(RING_STATES[2])
    const before = label()

    // Act
    toy.unlock()

    // Assert
    expect(before).toContain('V, G major: G, B and D')
    expect(before).not.toContain('V7')
    expect(label()).toContain('V7: G, B, D and F')
  })

  it('labels Step 3’s diagonal, B to F, once the choice is in (WEB-SPEC, Look)', () => {
    // Arrange
    const toy = steps()
    toy.setState(RING_STATES[3])
    const held = readout()

    // Act
    toy.unlock()

    // Assert
    expect(held).toBe('')
    expect(readout()).toBe('B to F: 6 semitones')
    expect(label()).toContain(
      'a line from B straight across the ring to F: 6 semitones',
    )
  })

  it('plays Step 3’s pair at 0.13 a note, in two columns', () => {
    // Arrange
    const toy = steps()
    toy.setState(RING_STATES[3])
    toy.unlock()

    // Act
    void toy.play('tritone')

    // Assert
    expect(written(last().notes)).toBe('B2 F3 C3 E3')
    expect(last().notes.every((n) => n.gain === 0.13)).toBe(true)
  })
})

describe("the steps' toy, Step 4", () => {
  it('holds its chips and Turn over until Step 4’s choice (FACTS 1b, 50)', () => {
    // Arrange
    const toy = steps()
    toy.setState(RING_STATES[4])
    toy.unlock()
    const turn = button('#toyRing [data-turn]')
    const held = [
      turn.disabled,
      button('#toyRing [data-part="4"] [data-chip="I"]').disabled,
      button('#toyRing [data-part="4"] [data-chip="V7"]').disabled,
    ]

    // Act
    toy.unlock4()

    // Assert
    expect(held).toEqual([true, true, true])
    expect(turn.disabled).toBe(false)
    expect(button('#toyRing [data-part="4"] [data-chip="V7"]').disabled).toBe(
      false,
    )
  })

  it('labels its V7 chip V until the cold open’s choice, as V7’s room is drawn (FACTS 1a)', () => {
    // Arrange
    const toy = steps()
    toy.setState(RING_STATES[4])
    const chip = button('#toyRing [data-part="4"] [data-chip="V7"]')
    const before = words(chip)

    // Act
    toy.unlock()

    // Assert
    expect(before).toBe('V')
    expect(words(chip)).toBe('V7')
  })

  it('moves the bass mark from the corner it leaves to the new bass’s as Turn over plays (WEB-SPEC, Look)', async () => {
    // Arrange
    const toy = steps()
    toy.setState(RING_STATES[4])
    toy.unlock()
    toy.unlock4()
    const turn = button('#toyRing [data-turn]')

    // Act: C to E, then, once heard, E to G
    turn.click()
    const first = toy.view().bass
    vi.advanceTimersByTime(1)
    const sounding = toy.view().bass
    last().end(true)
    await settle()
    turn.click()
    const second = toy.view().bass

    // Assert: each from the corner it left, as the chord starts too; the
    // view's clock moves it there in 0.3 s (ring-view.test.ts)
    expect(first).toMatchObject({ at: 4, from: 0 })
    expect(sounding).toMatchObject({ at: 4, from: 0 })
    expect(second).toMatchObject({ at: 7, from: 4 })
  })

  it('says a turned chord’s letters, not its name, until Step 4’s reveal, in its live line and the figure’s name (FACTS 1b, 48)', async () => {
    // Arrange
    const toy = steps()
    toy.setState(RING_STATES[4])
    toy.unlock()
    toy.unlock4()

    // Act: the predict's C, E, G, then E, G, C; then Turn over
    void toy.play('turn')
    vi.advanceTimersByTime(1)
    const root = said()
    vi.advanceTimersByTime(1200)
    const turned = said()
    last().end(true)
    await settle()
    button('#toyRing [data-turn]').click()
    vi.advanceTimersByTime(1)
    const heard = { said: said(), label: label() }
    last().end(true)
    await settle()
    toy.reveal4()

    // Assert: root position keeps Lesson 12's name; the turned chord its letters
    expect(root).toBe('I, C major: C, E and G')
    expect(turned).toBe('E, G and C')
    expect(heard.said).toBe('E, G and C')
    expect(heard.label).toBe(
      "Lesson 12's ring of rooms: E, G and C; faint, V7: G, B, D and F",
    )
    expect(label()).toContain(
      'C major, first inversion, E in the bass: E, G and C',
    )
  })

  it('turns I over, its lowest note up an octave, and back to its first pitches on the third press (FACTS 50, 72)', async () => {
    // Arrange
    const toy = steps()
    toy.setState(RING_STATES[4])
    toy.unlock()
    toy.unlock4()
    const turn = button('#toyRing [data-turn]')
    const heard: string[] = []

    // Act
    for (let press = 0; press < 3; press++) {
      turn.click()
      heard.push(written(last().notes))
      last().end(true)
      await settle()
    }

    // Assert
    expect(heard).toEqual(['E3 G3 C4', 'G3 C4 E4', 'C3 E3 G3'])
  })

  it('turns V7 through its three inversions and back on the fourth press', async () => {
    // Arrange
    const toy = steps()
    toy.setState(RING_STATES[4])
    toy.unlock()
    toy.unlock4()
    button('#toyRing [data-part="4"] [data-chip="V7"]').click()
    last().end(true)
    await settle()
    const heard: string[] = []

    // Act
    for (let press = 0; press < 4; press++) {
      button('#toyRing [data-turn]').click()
      heard.push(written(last().notes))
      last().end(true)
      await settle()
    }

    // Assert: F in the bass on the third, G2 again on the fourth
    expect(heard).toEqual([
      'B2 D3 F3 G3',
      'D3 F3 G3 B3',
      'F3 G3 B3 D4',
      'G2 B2 D3 F3',
    ])
  })

  it('names the position only after Step 4’s reveal, and the turned chord’s name with it (FACTS 1b, 48)', async () => {
    // Arrange
    const toy = steps()
    toy.setState(RING_STATES[4])
    toy.unlock()
    toy.unlock4()
    button('#toyRing [data-turn]').click()
    last().end(true)
    await settle()
    const before = { readout: readout(), label: label() }

    // Act
    toy.reveal4()

    // Assert
    expect(before.readout).toBe('')
    expect(before.label).not.toMatch(/inversion/i)
    expect(readout()).toBe('First inversion')
    expect(label()).toContain(
      'C major, first inversion, E in the bass: E, G and C',
    )
  })
})

describe('free play', () => {
  it('holds V, its seventh’s plays and Turn over, each under its line, until each choice (FACTS 1a, 1b, 39)', () => {
    // Arrange
    const toy = mountRingToy(el('#freePlay'), {
      active: () => true,
      clef: 'bass',
      state: RING_STATES.free,
    })
    const held = {
      v: button('#freePlay [data-chip="V"]').disabled,
      i7: button('#freePlay [data-ring-play="i-seventh"]').disabled,
      v7: button('#freePlay [data-ring-play="v-seventh"]').disabled,
      turn: button('#freePlay [data-turn]').disabled,
      line: el('#freePlay [data-lock-line]:not([data-lock-line="4"])').hidden,
      line4: el('#freePlay [data-lock-line="4"]').hidden,
    }

    // Act
    toy.unlock()
    const opened = {
      v: button('#freePlay [data-chip="V"]').disabled,
      v7: button('#freePlay [data-ring-play="v-seventh"]').disabled,
      turn: button('#freePlay [data-turn]').disabled,
      line: el('#freePlay [data-lock-line]:not([data-lock-line="4"])').hidden,
    }
    toy.unlock4()

    // Assert
    expect(held).toEqual({
      v: true,
      i7: false,
      v7: true,
      turn: true,
      line: false,
      line4: false,
    })
    expect(opened).toEqual({ v: false, v7: false, turn: true, line: true })
    expect(button('#freePlay [data-turn]').disabled).toBe(false)
    expect(el('#freePlay [data-lock-line="4"]').hidden).toBe(true)
  })

  it('plays in the higher voice an octave up on the treble staff', () => {
    // Arrange
    const toy = mountRingToy(el('#freePlay'), {
      active: () => true,
      clef: 'treble',
      state: RING_STATES.free,
    })

    // Act
    void toy.play('i-seventh')

    // Assert
    expect(written(last().notes)).toBe('C4 E4 G4 C4 E4 G4 B4')
  })
})
