// ============================================================
// Lesson 19 free play tests — the six pads and the two tunes, in one place
// ============================================================
//
// On the page's own markup, with the beat clock the kit's recorder
// (WEB-SPEC, Toys 8): both figures open unwritten, the six pads in 6/8 and
// the staff on the stored voice's clef, Bass with none; 6/8 · 3/4 regroups
// the six eighths and plays nothing, keeping what it leaves written, and
// Play strikes the metre's drums; the staff's 6/8 · 3/4 picks a tune, each
// kept as heard for the visit, Count and Clef redraw it, and Play plays it
// at its own pitches; and one sound for the page, the card off screen for
// 600 ms stopping both.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import type * as BeatClockModule from '@/features/lessons/kit/beat-clock'
import { finish, resetRuns, runs, } from '@/features/lessons/kit/beat-clock-recorder.test-fixtures'
import { scrollIntoViewAgain, scrollOutOfView, } from '@/features/lessons/kit/browser-doubles.test-fixtures'
import { AWAY_MS } from '@/features/lessons/kit/leave'
import { hz } from '@/features/lessons/kit/notes'
import type * as SoundAheadModule from '@/features/lessons/kit/sound-ahead'
import { midiOf } from '@/features/lessons/kit/staff-places'
import { VoiceChoice } from '@/features/lessons/kit/voice-choice'
import type * as WoodblockModule from '@/features/lessons/kit/woodblock'
import { initFreePlay } from './free-play'
import { el, loadPage, settle, soundOn, words } from './page-dom.test-fixtures'
import { tuneNotes } from './rhythm-views'
import { SWITCH_SAID } from './steps'

vi.mock('@/features/lessons/kit/beat-clock', async (actual) => ({
  ...(await actual<typeof BeatClockModule>()),
  BeatClock: (
    await import('@/features/lessons/kit/beat-clock-recorder.test-fixtures')
  ).FakeBeatClock,
}))
const voices: number[] = []
vi.mock('@/features/lessons/kit/sound-ahead', async (actual) => ({
  ...(await actual<typeof SoundAheadModule>()),
  bookNote: (freq: number) => {
    voices.push(freq)
    return null
  },
}))
const knocks: boolean[] = []
vi.mock('@/features/lessons/kit/woodblock', async (actual) => ({
  ...(await actual<typeof WoodblockModule>()),
  bookWood: (_bus: unknown, _when: number, high: boolean) => {
    knocks.push(high)
  },
}))
const drums: string[] = []
vi.mock('@/lib/drum-voices', () => ({
  triggerDrumVoice: (id: string) => {
    drums.push(id)
  },
}))

beforeEach(() => {
  resetRuns()
  voices.length = 0
  knocks.length = 0
  drums.length = 0
  soundOn()
  loadPage()
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  document.body.textContent = ''
})

const sixFig = () => el('#freePlay [data-free-bar]')
const staffFig = () => el('#freePlay [data-free-staff]')
const sixSaid = () => words(el('#freePlay [data-free-bar] [data-rb-said]'))
const staffSaid = () => words(el('#freePlay [data-free-staff] [data-rb-said]'))
const sixRow = '#freePlay > .controls'
const staffRow = '#freePlay .l19-free-staff .controls'
const button = (row: string, sel: string) =>
  el<HTMLButtonElement>(`${row} ${sel}`)
/** A figure's written symbols, by index, row after row. */
const written = (fig: HTMLElement): number[] =>
  Array.from(fig.querySelectorAll('.rb-sym:not(.is-hidden)'), (g) =>
    Number(g.getAttribute('data-i')),
  )

describe('free play', () => {
  it('opens both figures unwritten: six pads in 6/8, and the 6/8 tune on the bass staff with no voice chosen', () => {
    // Act
    initFreePlay()

    // Assert (WEB-SPEC, Toys 8)
    expect(sixFig().getAttribute('aria-label')).toBe(
      'One bar of 6/8: six eighth notes, in two groups of three, on one line',
    )
    expect(staffFig().getAttribute('aria-label')).toMatch(
      /^Four bars of 6\/8: .+, on the bass staff$/,
    )
    expect([written(sixFig()), written(staffFig())]).toEqual([[], []])
    expect(sixFig().querySelectorAll('.rb-pad')).toHaveLength(6)
    expect(
      button(staffRow, '[data-rb-clef="bass"]').getAttribute('aria-pressed'),
    ).toBe('true')
  })

  it("regroups the six on 6/8 · 3/4 and plays nothing, then plays the metre's drums with no click", async () => {
    // Arrange
    initFreePlay()

    // Act
    button(sixRow, '[data-rb-metre="3-4"]').click()
    const switched = [runs.length, sixSaid()]
    button(sixRow, '[data-rb-play]').click()
    await finish()

    // Assert (FACTS 18, 65): 3/4's kick on 1 and snares on 3 and 5
    expect(switched).toEqual([0, SWITCH_SAID['3-4']])
    expect(
      button(sixRow, '[data-rb-metre="3-4"]').getAttribute('aria-pressed'),
    ).toBe('true')
    expect(drums).toEqual([
      'kick',
      'hh-closed',
      'snare',
      'hh-closed',
      'snare',
      'hh-closed',
    ])
    expect(knocks).toEqual([])
    expect(written(sixFig())).toEqual([0, 1, 2, 3, 4, 5])
  })

  it('keeps the six written as heard across 6/8 · 3/4', async () => {
    // Arrange: heard in 6/8
    initFreePlay()
    button(sixRow, '[data-rb-play]').click()
    await finish()

    // Act
    button(sixRow, '[data-rb-metre="3-4"]').click()

    // Assert: the same six eighths, regrouped, still written
    expect(written(sixFig())).toEqual([0, 1, 2, 3, 4, 5])
  })

  it('plays the tune shown at its own pitches, then the other tune, each kept as heard for the visit', async () => {
    // Arrange
    initFreePlay()

    // Act
    button(staffRow, '[data-rb-play]').click()
    await finish()
    const first = [...voices]
    button(staffRow, '[data-rb-metre="3-4"]').click()
    const other = [written(staffFig()).length, staffSaid()]
    button(staffRow, '[data-rb-metre="6-8"]').click()

    // Assert (FACTS 30): the 6/8 tune from C3, its fifteen notes written
    expect(first).toEqual(tuneNotes('6-8', 'bass').map((n) => hz(midiOf(n))))
    expect(other).toEqual([0, SWITCH_SAID.tune['3-4']])
    expect(written(staffFig())).toHaveLength(15)
  })

  it('moves the staff to the treble on Clef, what was heard staying written, and plays from C4', async () => {
    // Arrange
    initFreePlay()
    button(staffRow, '[data-rb-play]').click()
    await finish()
    voices.length = 0

    // Act
    button(staffRow, '[data-rb-clef="treble"]').click()
    const said = staffSaid()
    const kept = written(staffFig()).length
    button(staffRow, '[data-rb-play]').click()
    await finish()

    // Assert: the fifteen heard stay written on the treble before it plays
    expect(said).toBe(SWITCH_SAID.treble)
    expect(staffFig().getAttribute('aria-label')).toMatch(
      /on the treble staff$/,
    )
    expect(kept).toBe(15)
    expect(voices[0]).toBe(hz(midiOf({ letter: 'C', alter: 0, octave: 4 })))
  })

  it('opens the staff on the treble for a viewer who chose the higher voice', () => {
    // Arrange
    vi.spyOn(VoiceChoice, 'voice', 'get').mockReturnValue('higher')

    // Act
    initFreePlay()

    // Assert
    expect(
      button(staffRow, '[data-rb-clef="treble"]').getAttribute('aria-pressed'),
    ).toBe('true')
  })

  it('writes each count under its note on Count', () => {
    // Arrange
    initFreePlay()

    // Act
    button(staffRow, '[data-rb-count]').click()

    // Assert
    expect(
      button(staffRow, '[data-rb-count]').getAttribute('aria-pressed'),
    ).toBe('true')
    expect(staffFig().querySelectorAll('.rb-count').length).toBeGreaterThan(0)
  })

  it('is one sound: the tune stops the six, and the card off screen for 600 ms stops the tune', async () => {
    // Arrange
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    initFreePlay()
    button(sixRow, '[data-rb-play]').click()

    // Act
    button(staffRow, '[data-rb-play]').click()
    await settle()
    const first = runs[0].stopped
    scrollOutOfView(el('#freePlay'))
    await vi.advanceTimersByTimeAsync(AWAY_MS)
    scrollIntoViewAgain(el('#freePlay'))

    // Assert
    expect(first).toBe(true)
    expect(runs[1].stopped).toBe(true)
  })
})
