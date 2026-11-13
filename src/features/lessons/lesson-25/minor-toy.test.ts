// ============================================================
// Lesson 25's steps' toy tests — the lock, the switches and every step's plays on the page's own markup
// ============================================================
//
// On learn/25.html's markup (WEB-SPEC, Toys 1, Edge cases and Contract):
// the toy holds Raise te and the chord column back until the cold open's
// choice; Raise te lifts te to ti and turns the chord on so major, saying
// both; a play shows its own stairs while it sounds, figure by figure, a
// bar each, and then the stairs go back to the switches; Step 3's melodic
// minor turns Raise le on and comes down plain; Step 4's staircase stays
// where its play leaves it, do gliding from C to A, and C minor's flats
// travel into both signatures, B flat first, landing at once when a play
// is cut short; the clef moves the whole toy an octave; and a sound
// anywhere stops a play, between its figures too. Every sound is one of
// the kit's runs, here the recorder, and the clock is a fake one.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import { HARMONIC_MINOR_DEGREES, MELODIC_MINOR_UP_DEGREES, NATURAL_MINOR_DEGREES, } from '@/features/lessons/kit/chords'
import { MAJOR_DEGREES } from '@/features/lessons/kit/major-scale'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import type * as RunModule from '@/features/lessons/kit/run'
import type { RecordedRun } from '@/features/lessons/kit/run-recorder.test-fixtures'
import { resetRuns, runs, } from '@/features/lessons/kit/run-recorder.test-fixtures'
import { PitchLine } from '@/features/lessons/kit/staff'
import type { Clef } from '@/features/lessons/kit/staff-places'
import type { MinorState, MinorToy } from './minor-toy'
import { MINOR_STATES, mountMinorToy } from './minor-toy'
import { el, loadPage, settle, soundOn, words } from './page-dom.test-fixtures'

vi.mock('@/features/lessons/kit/run', async (actual) => ({
  ...(await actual<typeof RunModule>()),
  ...(await import('@/features/lessons/kit/run-recorder.test-fixtures'))
    .recordedRuns,
}))

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] })
  resetRuns()
  soundOn()
  loadPage()
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
  PitchLine.set(false)
  document.body.textContent = ''
})

const last = (): RecordedRun => runs[runs.length - 1]
const midis = (r: RecordedRun): number[] => r.notes.map((n) => n.midi)

/** Ends the latest run heard, every note sounded first. */
async function hear(r: RecordedRun = last()): Promise<void> {
  r.notes.forEach((_n, i) => r.note(i))
  r.end(true)
  await settle()
}

/** Moves the clock on `ms`, letting what waits on it run: the fake clock stands still while a run is heard. */
async function wait(ms: number): Promise<void> {
  vi.advanceTimersByTime(ms)
  await settle()
}

function mount(
  state: MinorState = MINOR_STATES[1],
  clef: Clef = 'bass',
  root = '#toyMinor',
): MinorToy {
  return mountMinorToy(el(root), { active: () => true, clef, state })
}

const button = (selector: string): HTMLButtonElement =>
  el<HTMLButtonElement>(selector)
const said = (): string => words(el('#toyMinor [data-beads-said]'))
const keySigns = (selector: string): number =>
  document.querySelectorAll(`${selector} .st-keysign`).length
const ownSigns = (): number =>
  document.querySelectorAll(
    '#toyMinor [data-staff-svg] .st-sign:not(.st-keysign)',
  ).length

describe('the lock until the cold open’s choice', () => {
  it('holds Raise te and the chord column back under the lock line, its name kept', () => {
    // Act
    const toy = mount()

    // Assert: FACTS 36
    const te = button('#toyMinor [data-raise="te"]')
    expect([te.disabled, words(te)]).toEqual([true, 'Raise te'])
    expect(el('#toyMinor [data-lock-line]').hidden).toBe(false)
    expect(toy.column.shown).toBe(false)
  })

  it('opens Raise te, draws the column and puts the lock line away at the choice', () => {
    // Arrange
    const toy = mount()

    // Act
    toy.unlock()

    // Assert
    expect(button('#toyMinor [data-raise="te"]').disabled).toBe(false)
    expect(el('#toyMinor [data-lock-line]').hidden).toBe(true)
    expect(toy.column.shown).toBe(true)
    expect(toy.column.chord?.label).toBe('E minor')
  })

  it('holds free play’s Raise te, Raise le and chord play too, and lets no switch break melodic minor’s rule', () => {
    // Arrange
    const toy = mount(MINOR_STATES.free, 'bass', '#freePlay')
    const te = button('#freePlay [data-raise="te"]')
    const le = button('#freePlay [data-raise="le"]')
    const chord = button('#freePlay [data-minor-play="chord-home"]')
    const before = [te.disabled, le.disabled, chord.disabled]

    const line = (): string => words(el('#freePlay [data-beads-said]'))

    // Act: Raise le alone raises te with it, and te down takes le down
    toy.unlock()
    le.click()
    const melodic = toy.raises
    const up = line()
    te.click()
    const down = line()

    // Assert: WEB-SPEC, Edge cases
    expect(before).toEqual([true, true, true])
    expect(el('#freePlay [data-lock-line]').hidden).toBe(true)
    expect(melodic).toEqual({ te: true, le: true })
    expect(toy.raises).toEqual({ te: false, le: false })
    expect(toy.core.degrees).toEqual(NATURAL_MINOR_DEGREES)
    // each switch that moved is said, te first
    expect(up).toBe(
      'Te raised to ti: G sharp 3. Le raised to la, going up: F sharp 3. Coming down, both fall back. E, G sharp, B: 4 and 3 semitones, E major.',
    )
    expect(down).toBe(
      'Ti back down to te: G3. La back down to le: F3. E, G, B: 3 and 4 semitones, E minor.',
    )
  })

  it('sounds free play’s melodic minor before the choice with le and te raised for the play alone, its held switches left off', async () => {
    // Arrange
    const toy = mount(MINOR_STATES.free, 'bass', '#freePlay')
    const switches = (): (string | null)[] =>
      ['te', 'le'].map((r) =>
        button(`#freePlay [data-raise="${r}"]`).getAttribute('aria-pressed'),
      )

    // Act
    const played = toy.play('melodic')
    const up = midis(last())
    const during = switches()
    await hear()
    await wait(3200)
    await hear()
    const heard = await played

    // Assert: WEB-SPEC, Free play; a switch moved while held could not be
    // moved back until the choice
    expect(heard).toBe(true)
    expect(up).toEqual([45, 47, 48, 50, 52, 54, 56, 57])
    expect(during).toEqual(['false', 'false'])
    expect(switches()).toEqual(['false', 'false'])
    expect(toy.raises).toEqual({ te: false, le: false })
    expect(toy.core.degrees).toEqual(NATURAL_MINOR_DEGREES)
  })
})

describe('Step 1: why raise te?', () => {
  it('lifts te to ti and turns the chord on so major, saying both', () => {
    // Arrange
    const toy = mount()
    toy.unlock()

    // Act
    button('#toyMinor [data-raise="te"]').click()

    // Assert: WEB-SPEC, Toys 1 and Contract
    expect(toy.core.degrees).toEqual(HARMONIC_MINOR_DEGREES)
    expect(toy.column.chord?.label).toBe('E major')
    expect(said()).toBe(
      'Te raised to ti: G sharp 3. E, G sharp, B: 4 and 3 semitones, E major.',
    )
    expect(
      button('#toyMinor [data-raise="te"]').getAttribute('aria-pressed'),
    ).toBe('true')
  })

  it('lifts te for as long as Play so, ti, do sounds, and lets it back down after', async () => {
    // Arrange
    const toy = mount()

    // Act
    const played = toy.play('so-ti-do')
    const during = toy.core.degrees
    const line = said()
    last().note(0)
    const blue = document.querySelectorAll('#toyMinor .st-head.is-blue').length
    await hear()

    // Assert: FACTS 61; the bass staff's notes in Merc's blue (WEB-SPEC, Look)
    expect(midis(last())).toEqual([52, 56, 57])
    expect(blue).toBe(1)
    expect(during).toEqual(HARMONIC_MINOR_DEGREES)
    expect(line).toBe('So, ti, do: te lifts to ti, a semitone under do.')
    expect(await played).toBe(true)
    expect(toy.core.degrees).toEqual(NATURAL_MINOR_DEGREES)
  })

  it('plays the chord on so, then home, as two stacked chords, the column’s beads lit while the first sounds', () => {
    // Arrange
    const toy = mount()
    toy.unlock()
    const lights = vi.spyOn(toy.column, 'light')

    // Act
    void toy.play('chord-home')

    // Assert
    expect(midis(last())).toEqual([52, 55, 59, 45, 48, 52])
    expect(last().o.gain).toBe(0.075)
    expect(lights.mock.calls.map((c) => c[0])).toEqual([0, 1, 2])
    expect(said()).toBe(
      'E, G, B: 3 and 4 semitones, E minor. Then home: A, C, E, A minor.',
    )
  })

  it('names the column in the figure once the choice draws it, and says what each play sounds', () => {
    // Arrange
    const toy = mount()
    const canvas = el('#toyMinor [data-beads-canvas]')
    const before = canvas.getAttribute('aria-label') ?? ''

    // Act
    toy.unlock()
    const after = canvas.getAttribute('aria-label') ?? ''
    void toy.play('so-te-do')
    const soTeDo = said()

    // Assert: WEB-SPEC, Readouts and names; the hero's figure names its
    // column the same way
    expect(before).not.toContain('chord on so')
    expect(after).toBe(
      `${before} Beside it, the chord on so: E, G, B: 3 and 4 semitones, E minor.`,
    )
    expect(soTeDo).toBe('So, te, do: te a tone under do.')
  })
})

describe('Step 2: what does the raised note do to the scale?', () => {
  it('plays le to te on natural minor’s stairs, then le to ti on harmonic minor’s, saying each size', async () => {
    // Arrange
    const toy = mount(MINOR_STATES[2])

    // Act
    void toy.play('le-pairs')
    const first = [midis(last()), toy.core.degrees, said()]
    await hear()
    await wait(2050)

    // Assert: FACTS 19, 62
    expect(first).toEqual([
      [53, 55],
      NATURAL_MINOR_DEGREES,
      'Le to te, F to G: 2 semitones.',
    ])
    expect(midis(last())).toEqual([53, 56])
    expect(toy.core.degrees).toEqual(HARMONIC_MINOR_DEGREES)
    expect(said()).toBe('Le to ti, F to G sharp: 3 semitones.')
  })
})

describe('Step 2: the widest stair', () => {
  it('outlines le to ti with its 3 on harmonic minor’s stairs, and not on natural minor’s', async () => {
    // Arrange
    const toy = mount(MINOR_STATES[2])
    const outline = vi.spyOn(toy.core, 'setOutline')

    // Act: the pairs, natural minor's stairs first
    void toy.play('le-pairs')
    await hear()
    await wait(2050)

    // Assert: WEB-SPEC, Look
    expect(outline.mock.calls.map((c) => c[0])).toEqual([
      null,
      { riser: 5, label: '3' },
    ])
  })
})

describe('Step 3: is there more than one minor scale?', () => {
  it('turns Raise le on for melodic minor, its sharps going up and a plain bar of its own coming down', async () => {
    // Arrange
    const toy = mount(MINOR_STATES[3])

    // Act
    const played = toy.play('melodic')
    const le = button('#toyMinor [data-raise="le"]').getAttribute(
      'aria-pressed',
    )
    const up = midis(last())
    last().notes.forEach((_n, i) => last().note(i))
    const upSigns = ownSigns()
    await hear()
    await wait(3200)
    const down = midis(last())
    const downStairs = toy.core.degrees
    await hear()

    // Assert: FACTS 13, 63
    expect(le).toBe('true')
    expect(up).toEqual([45, 47, 48, 50, 52, 54, 56, 57])
    expect(upSigns).toBe(2)
    expect(down).toEqual([55, 53, 52, 50, 48, 47, 45])
    expect(downStairs).toEqual(NATURAL_MINOR_DEGREES)
    expect(ownSigns()).toBe(0)
    expect(await played).toBe(true)
    expect(toy.core.degrees).toEqual(MELODIC_MINOR_UP_DEGREES)
  })

  it('draws A major for the first scale of Play A major, then melodic minor, then goes back', async () => {
    // Arrange
    const toy = mount(MINOR_STATES[3])

    // Act
    const played = toy.play('major-melodic')
    const first = toy.core.degrees
    await hear()
    await wait(3650)
    const second = toy.core.degrees
    await hear()

    // Assert: FACTS 21, 63
    expect([first, second]).toEqual([MAJOR_DEGREES, MELODIC_MINOR_UP_DEGREES])
    expect(await played).toBe(true)
    expect(toy.core.degrees).toEqual(HARMONIC_MINOR_DEGREES)
  })
})

describe('Step 4: why do C major and A minor share a key signature?', () => {
  it('draws C major on C, then A minor on A, and stays there, both staves with no signature', async () => {
    // Arrange
    const toy = mount(MINOR_STATES[4])

    // Act
    const played = toy.play('relative')
    const onC = toy.core.tonic
    await hear()
    await wait(3650)
    const second = midis(last())
    await hear()

    // Assert: FACTS 22, 64
    expect(onC).toBe(48)
    expect(second).toEqual([45, 47, 48, 50, 52, 53, 55, 57])
    expect(await played).toBe(true)
    expect([toy.core.tonic, toy.core.degrees]).toEqual([
      45,
      NATURAL_MINOR_DEGREES,
    ])
    expect(el('#toyMinor [data-staff-small]').hasAttribute('hidden')).toBe(
      false,
    )
    expect(keySigns('#toyMinor')).toBe(0)
  })

  it('writes C minor’s flats with their own signs, then moves them into both signatures, B flat first', async () => {
    // Arrange
    const toy = mount(MINOR_STATES[4])

    // Act
    const played = toy.play('c-minor')
    last().notes.forEach((_n, i) => last().note(i))
    const written = ownSigns()
    await hear()
    const one = [
      keySigns('#toyMinor [data-staff-svg]'),
      keySigns('#toyMinor [data-staff-small]'),
    ]
    await wait(600)
    await wait(600)
    await wait(600)

    // Assert: FACTS 27, 64
    expect(written).toBe(3)
    expect(one).toEqual([1, 1])
    expect(keySigns('#toyMinor [data-staff-svg]')).toBe(3)
    expect(keySigns('#toyMinor [data-staff-small]')).toBe(3)
    expect(words(el('#toyMinor [data-staff-said]'))).toBe(
      'Key signature: three flats, B flat, E flat and A flat',
    )
    expect(await played).toBe(true)
    expect(toy.core.tonic).toBe(48)
  })

  it('lands C minor’s flats in the signature at once when its play is cut short', async () => {
    // Arrange
    const toy = mount(MINOR_STATES[4])
    void toy.play('c-minor')
    await hear()

    // Act
    toy.stop()

    // Assert: WEB-SPEC, Edge cases
    expect(toy.staff.key).toEqual({ sign: 'flat', count: 3 })
    expect(keySigns('#toyMinor [data-staff-small]')).toBe(3)
    expect(toy.core.tonic).toBe(48)
  })
})

describe('the clef and the one sound', () => {
  it('moves the whole toy an octave with the Clef switch, stopping what plays', () => {
    // Arrange
    const toy = mount()
    void toy.play('so-te-do')
    const playing = last()

    // Act
    button('#toyMinor [data-clef="treble"]').click()
    void toy.play('so-te-do')

    // Assert: WEB-SPEC, Edge cases
    expect(playing.stopped).toBe(true)
    expect(toy.clef).toBe('treble')
    expect(toy.core.tonic).toBe(57)
    expect(midis(last())).toEqual([64, 67, 69])
  })

  it('stops a play between its figures when a sound starts anywhere else', async () => {
    // Arrange
    const toy = mount(MINOR_STATES[2])
    const played = toy.play('harmonic')
    await hear()

    // Act
    NowPlaying.claim(() => undefined)
    await wait(5000)

    // Assert: WEB-SPEC, Audio, rule 1
    expect(runs).toHaveLength(1)
    expect(await played).toBe(false)
  })

  it('swaps the staircase for the staff’s pitch line, and back', () => {
    // Arrange
    mount()

    // Act
    button('#toyMinor [data-staff-lanes]').click()
    const swapped = el('#toyMinor [data-beads-viz]').hidden
    button('#toyMinor [data-staff-lanes]').click()

    // Assert: FACTS 8
    expect(swapped).toBe(true)
    expect(el('#toyMinor [data-beads-viz]').hidden).toBe(false)
  })
})
