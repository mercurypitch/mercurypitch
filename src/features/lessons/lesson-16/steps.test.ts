// ============================================================
// Lesson 16 steps tests — the staircase's turn and the staff toy on the page's own markup
// ============================================================
//
// On the page's markup and its own deck (WEB-SPEC, Toys 2 and 3): Step 1's
// five stairs over a bare staff, Play the stairs, the turn into the staff
// and the staff's taps once turned, do and then the note; Steps 2 to 5's
// plays, each lighting its place, Hear it inside's beat before each note,
// held for the visit, and Names off keeping the house; the step left keeps
// nothing sounding; and every staff in the learner's clef. Every sound is
// one of the kit's runs, here the recorder.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as RunModule from '@/features/lessons/kit/run'
import type { RecordedRun } from '@/features/lessons/kit/run-recorder.test-fixtures'
import { resetRuns, runs, } from '@/features/lessons/kit/run-recorder.test-fixtures'
import { placeOf } from '@/features/lessons/kit/staff-places'
import { VoiceChoice } from '@/features/lessons/kit/voice-choice'
import { el, mountSteps, settle, soundOn, words, } from './page-dom.test-fixtures'
import { HearInside } from './steps'

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
  HearInside.set(false)
  vi.restoreAllMocks()
  vi.useRealTimers()
  window.location.hash = ''
  document.body.textContent = ''
})

const last = (): RecordedRun => runs[runs.length - 1]
const midis = (r: RecordedRun): number[] => r.notes.map((n) => n.midi)
const onsets = (r: RecordedRun): number[] => r.notes.map((n) => n.t)
const length = (r: RecordedRun): number =>
  Math.round(Math.max(...r.notes.map((n) => n.t + n.dur)) * 1000) / 1000
const click = (selector: string): void => el<HTMLElement>(selector).click()
const count = (selector: string): number =>
  document.querySelectorAll(selector).length
const syllables = (root: string): string[] =>
  Array.from(document.querySelectorAll(`${root} .st-syl`), (t) => words(t))
const shown = (root: string): string[] =>
  Array.from(
    document.querySelectorAll<HTMLElement>(`${root} [data-part]`),
  ).flatMap((p) =>
    p.hidden
      ? []
      : [
          p.getAttribute('data-staff-play') ??
            (p.hasAttribute('data-hear-inside') ? 'hear-inside' : 'names'),
        ],
  )

/** Ends the latest run heard, every note sounded first. */
async function hear(r: RecordedRun = last()): Promise<void> {
  r.notes.forEach((_n, i) => r.note(i))
  r.end(true)
  await settle()
}

describe('Step 1: the staircase that turns into the staff', () => {
  it('lays five stairs on G3, each named, over a bare staff', () => {
    // Arrange
    mountSteps()

    // Assert: WEB-SPEC, Toys 3
    expect(
      Array.from(document.querySelectorAll('#toyStairs .stair-hit'), (b) =>
        b.getAttribute('aria-label'),
      ),
    ).toEqual([
      'Stair 1, do, G3, home',
      'Stair 2, re, A3',
      'Stair 3, mi, B3',
      'Stair 4, fa, C4',
      'Stair 5, so, D4',
    ])
    expect(count('#toyStairs .st-head')).toBe(0)
    expect(count('#toyStairs .st-home')).toBe(0)
  })

  it('plays do to so on Play the stairs, 2.9 s, and a stair its own note for 0.8 s', () => {
    // Arrange
    mountSteps()

    // Act
    click('#toyStairs [data-stairs-play]')
    const stairs = last()
    click('#toyStairs .stair-hit[data-stair="2"]')

    // Assert: FACTS 68
    expect(midis(stairs)).toEqual([55, 57, 59, 60, 62])
    expect(onsets(stairs)).toEqual([0, 0.6, 1.2, 1.8, 2.4])
    expect(length(stairs)).toBe(2.9)
    expect(midis(last())).toEqual([59])
    expect(length(last())).toBe(0.8)
  })

  it('turns into the staff in 0.8 s, its notes waiting, then plays them: the house on do, the syllables under them', async () => {
    // Arrange
    vi.useFakeTimers()
    const deck = mountSteps()
    const turn = el<HTMLButtonElement>('#toyStairs [data-stairs-turn]')

    // Act
    turn.click()
    const turning = el('#toyStairs').classList.contains('is-turning')
    const heardBefore = runs.length
    vi.advanceTimersByTime(800)
    await settle()

    // Assert: WEB-SPEC, Toys 2 state 1 and Toys 3; FACTS 68, 3.7 s in all
    expect(turning).toBe(true)
    expect(heardBefore).toBe(0)
    expect(el('#toyStairs').classList.contains('is-turning')).toBe(false)
    expect(count('#toyStairs .st-head')).toBe(5)
    expect(count('#toyStairs .st-home')).toBe(1)
    expect(syllables('#toyStairs')).toEqual(['do', 're', 'mi', 'fa', 'so'])
    expect(midis(last())).toEqual([55, 57, 59, 60, 62])
    expect(length(last())).toBe(2.9)
    expect(turn.classList.contains('is-on')).toBe(true)
    expect(deck.steps.stairs.turned).toBe(true)

    // Act: heard to its end
    await hear()

    // Assert
    expect(turn.classList.contains('is-on')).toBe(false)
  })

  it('plays do and then a tapped note once turned, 0.8 s each with 0.2 s between, and the house alone plays do', async () => {
    // Arrange
    vi.useFakeTimers()
    const deck = mountSteps()
    click('#toyStairs [data-stairs-turn]')
    vi.advanceTimersByTime(800)
    await settle()
    const staff = deck.steps.stairs.staff

    // Act
    staff.tapPlace(placeOf({ letter: 'B', alter: 0, octave: 3 }, 'bass'))
    const mi = last()
    staff.tapPlace(placeOf({ letter: 'G', alter: 0, octave: 3 }, 'bass'))

    // Assert: LESSON.md, Step 1's Try
    expect(midis(mi)).toEqual([55, 59])
    expect(onsets(mi)).toEqual([0, 1])
    expect(mi.notes.map((n) => n.dur)).toEqual([0.8, 0.8])
    expect(midis(last())).toEqual([55])
  })

  it('stops a turn in flight for any other sound, and keeps the staff it turned into', async () => {
    // Arrange
    vi.useFakeTimers()
    const deck = mountSteps()
    const turn = el<HTMLButtonElement>('#toyStairs [data-stairs-turn]')
    turn.click()

    // Act
    click('#toyStairs [data-stairs-play]')
    await settle()
    const cut = !el('#toyStairs').classList.contains('is-turning')
    vi.advanceTimersByTime(800)
    await settle()

    // Assert: only the stairs sound, once
    expect(cut).toBe(true)
    expect(runs).toHaveLength(1)
    expect(midis(last())).toEqual([55, 57, 59, 60, 62])
    expect(turn.classList.contains('is-on')).toBe(false)
    expect(deck.steps.stairs.turned).toBe(true)
    expect(count('#toyStairs .st-head')).toBe(5)
  })

  it('starts a turn afresh when turned again in flight, and another sound still stops it', async () => {
    // Arrange
    vi.useFakeTimers()
    mountSteps()
    const turn = el<HTMLButtonElement>('#toyStairs [data-stairs-turn]')

    // Act
    turn.click()
    turn.click()
    await settle()
    const again = el('#toyStairs').classList.contains('is-turning')
    click('#toyStaff [data-staff-play="do"]')
    await settle()
    const cut = !el('#toyStairs').classList.contains('is-turning')
    vi.advanceTimersByTime(800)
    await settle()

    // Assert: the second turn's notes wait, then Play do alone sounds
    expect(again).toBe(true)
    expect(cut).toBe(true)
    expect(runs.map(midis)).toEqual([[55]])
  })

  it('plays nothing of a turn another sound, or a step left, has cut short', async () => {
    // Arrange
    vi.useFakeTimers()
    const deck = mountSteps()
    const turn = el<HTMLButtonElement>('#toyStairs [data-stairs-turn]')

    // Act: Step 2's Play do as the stairs travel, then a turn left for Step 2
    turn.click()
    click('#toyStaff [data-staff-play="do"]')
    await settle()
    vi.advanceTimersByTime(800)
    await settle()
    const afterSound = runs.map(midis)
    turn.click()
    deck.show(2)
    await settle()
    vi.advanceTimersByTime(800)
    await settle()

    // Assert: Play do alone, then nothing
    expect(afterSound).toEqual([[55]])
    expect(runs.map(midis)).toEqual([[55]])
    expect(turn.classList.contains('is-on')).toBe(false)
  })
})

describe('Steps 2 to 5: the staff toy', () => {
  it('shows each step its own plays', () => {
    // Arrange
    const deck = mountSteps()
    const seen: string[][] = []

    // Act
    for (const n of [2, 3, 4, 5]) {
      deck.show(n)
      seen.push(shown('#toyStaff'))
    }

    // Assert: WEB-SPEC, Toys 2 states 2 to 5
    expect(seen).toEqual([
      ['do'],
      ['hear-inside', 'do-so'],
      ['triad', 'turn'],
      ['do-so', 'triad', 'names'],
    ])
    expect(words(el('#toyStaff [data-fig-label]'))).toBe(
      'Fig. 5 Names on or off.',
    )
  })

  it('plays do for 0.8 s on Play do, lighting the house’s note and the house', () => {
    // Arrange
    const deck = mountSteps()
    deck.show(2)

    // Act
    click('#toyStaff [data-staff-play="do"]')
    last().note(0)

    // Assert: WEB-SPEC, Toys 2 state 2
    expect(midis(last())).toEqual([55])
    expect(length(last())).toBe(0.8)
    const heads = document.querySelectorAll('#toyStaff .st-head')
    expect(heads).toHaveLength(5)
    expect(heads[0].classList.contains('is-lit')).toBe(true)
    expect(heads[1].classList.contains('is-lit')).toBe(false)
    expect(count('#toyStaff .st-home.is-lit')).toBe(1)
  })

  it('plays do to so in 2.9 s, and with Hear it inside on in 8.0 s, each note lit a beat before it sounds', () => {
    // Arrange
    vi.useFakeTimers()
    const deck = mountSteps()
    deck.show(3)
    const inside = el<HTMLButtonElement>('#toyStaff [data-hear-inside]')

    // Act
    click('#toyStaff [data-staff-play="do-so"]')
    const plain = last()
    inside.click()
    click('#toyStaff [data-staff-play="do-so"]')
    vi.advanceTimersByTime(1)
    const lit = Array.from(
      document.querySelectorAll('#toyStaff .st-head'),
      (h) => h.classList.contains('is-lit'),
    )

    // Assert: FACTS 68
    expect(length(plain)).toBe(2.9)
    expect(inside.getAttribute('aria-pressed')).toBe('true')
    expect(onsets(last())).toEqual([1, 2.6, 4.2, 5.8, 7.4])
    expect(length(last())).toBe(8)
    // do lights in its silent beat, before the run sounds it
    expect(lit).toEqual([true, false, false, false, false])
  })

  it('holds Hear it inside for the visit, on every switch and in every step', () => {
    // Arrange
    const deck = mountSteps()
    deck.show(3)

    // Act
    click('#toyStaff [data-hear-inside]')
    deck.show(4)
    click('#toyStaff [data-staff-play="triad"]')

    // Assert
    expect(length(last())).toBe(8)
    for (const b of document.querySelectorAll('[data-hear-inside]'))
      expect(b.getAttribute('aria-pressed')).toBe('true')
  })

  it('plays the triad and its turn in Step 4', () => {
    // Arrange
    const deck = mountSteps()
    deck.show(4)

    // Act
    click('#toyStaff [data-staff-play="triad"]')
    const triad = last()
    click('#toyStaff [data-staff-play="turn"]')

    // Assert: FACTS 68
    expect(midis(triad)).toEqual([55, 59, 62, 59, 55])
    expect(midis(last())).toEqual([55, 59, 55, 62])
    expect(onsets(last())).toEqual([0, 0.6, 1.6, 2.2])
  })

  it('hides the syllables with Names off and keeps the house, and keeps the choice for the visit', () => {
    // Arrange
    const deck = mountSteps()
    deck.show(5)
    const before = syllables('#toyStaff')

    // Act
    click('#toyStaff [data-names="off"]')
    const off = syllables('#toyStaff')
    const house = count('#toyStaff .st-home')
    deck.show(4)
    const step4 = syllables('#toyStaff')
    deck.show(5)

    // Assert: WEB-SPEC, Toys 2 state 5
    expect(before).toEqual(['do', 're', 'mi', 'fa', 'so'])
    expect(off).toEqual([])
    expect(house).toBe(1)
    expect(step4).toEqual(['do', 're', 'mi', 'fa', 'so'])
    expect(syllables('#toyStaff')).toEqual([])
    expect(
      el('#toyStaff [data-names="off"]').getAttribute('aria-pressed'),
    ).toBe('true')
  })

  it('stops what plays when the step is left', () => {
    // Arrange
    const deck = mountSteps()
    deck.show(3)
    click('#toyStaff [data-staff-play="do-so"]')
    const r = last()

    // Act
    deck.show(4)

    // Assert
    expect(r.stopped).toBe(true)
  })
})

describe('the learner’s clef', () => {
  it('opens both staffs in the bass clef with no voice stored, and moves both to the treble as the voice is chosen', () => {
    // Arrange
    const deck = mountSteps()
    const before = [deck.steps.stairs.staff.clef, deck.steps.staff.clef]

    // Act
    VoiceChoice.set('higher')
    deck.show(2)
    click('#toyStaff [data-staff-play="do"]')

    // Assert: FACTS 8, G4 for the higher voice
    expect(before).toEqual(['bass', 'bass'])
    expect(deck.steps.stairs.staff.clef).toBe('treble')
    expect(deck.steps.stairs.core.tonic).toBe(67)
    expect(deck.steps.staff.clef).toBe('treble')
    expect(midis(last())).toEqual([67])
    VoiceChoice.set('lower')
  })

  it('moves every staff to the other G from either Clef switch, a turned staff staying turned', async () => {
    // Arrange
    vi.useFakeTimers()
    const deck = mountSteps()
    click('#toyStairs [data-stairs-turn]')
    vi.advanceTimersByTime(800)
    await settle()
    deck.show(2)

    // Act
    click('#toyStaff [data-clef="treble"]')
    click('#toyStairs [data-stairs-play]')

    // Assert
    expect(deck.steps.clef).toBe('treble')
    expect(deck.steps.stairs.staff.clef).toBe('treble')
    expect(count('#toyStairs .st-head')).toBe(5)
    expect(midis(last())).toEqual([67, 69, 71, 72, 74])
    expect(
      el('#toyStairs .stair-hit[data-stair="0"]').getAttribute('aria-label'),
    ).toBe('Stair 1, do, G4, home')
  })
})
