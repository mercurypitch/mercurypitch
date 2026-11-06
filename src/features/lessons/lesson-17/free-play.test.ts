// ============================================================
// Lesson 17 free play tests — every control of the rhythm bar in one place
// ============================================================
//
// On the page's own markup, with the beat clock a recorder (WEB-SPEC, Toys
// 8): both figures open unwritten, beat 1 chosen and the clef from the
// voice; Halve and Join on the chosen beat, played at once; Note · Rest on
// the chosen beat, Halve and Join then refused with their hint; Tempo,
// Count, the pitch line and Reset; Step 5's two bars with Dot, Tie and
// Clef, which follows a voice chosen later; and one sound for the page, the
// card off screen for 600 ms stopping both.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import type * as BeatClockModule from '@/features/lessons/kit/beat-clock'
import { scrollIntoViewAgain, scrollOutOfView, } from '@/features/lessons/kit/browser-doubles.test-fixtures'
import { AWAY_MS } from '@/features/lessons/kit/leave'
import { A3, A4, hz } from '@/features/lessons/kit/notes'
import type * as SoundAheadModule from '@/features/lessons/kit/sound-ahead'
import { VoiceChoice } from '@/features/lessons/kit/voice-choice'
import type * as WoodblockModule from '@/features/lessons/kit/woodblock'
import { initFreePlay } from './free-play'
import { drive, el, finish, loadPage, resetRuns, runs, soundOn, words, } from './page-dom.test-fixtures'
import { REFUSAL_HINT, STAFF_SAID } from './steps'

vi.mock('@/features/lessons/kit/beat-clock', async (actual) => ({
  ...(await actual<typeof BeatClockModule>()),
  BeatClock: (await import('./page-dom.test-fixtures')).FakeBeatClock,
}))
const voices: number[] = []
vi.mock('@/features/lessons/kit/sound-ahead', async (actual) => ({
  ...(await actual<typeof SoundAheadModule>()),
  bookNote: (freq: number) => {
    voices.push(freq)
    return null
  },
}))
vi.mock('@/features/lessons/kit/woodblock', async (actual) => ({
  ...(await actual<typeof WoodblockModule>()),
  bookWood: () => undefined,
}))

beforeEach(() => {
  resetRuns()
  voices.length = 0
  soundOn()
  loadPage()
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  // as no voice does: the bass staff and A3
  VoiceChoice.set('lower')
  document.body.textContent = ''
})

const lineFig = () => el('#freePlay [data-free-bar]')
const staffFig = () => el('#freePlay [data-free-staff]')
const lineSaid = () => words(el('#freePlay [data-free-bar] [data-rb-said]'))
const staffSaid = () => words(el('#freePlay [data-free-staff] [data-rb-said]'))
const button = (sel: string) => el<HTMLButtonElement>(`#freePlay ${sel}`)
const linePlay = () =>
  el<HTMLButtonElement>('#freePlay > .controls [data-rb-play]')
const staffPlay = () =>
  el<HTMLButtonElement>('#freePlay .l17-free-staff [data-rb-play]')
const pad = (beat: number) =>
  el<HTMLButtonElement>(`#freePlay .rb-padbtn[data-beat="${beat}"]`)
/** A figure's written symbols, by index. */
const written = (fig: HTMLElement): number[] =>
  Array.from(fig.querySelectorAll('.rb-sym:not(.is-hidden)'), (g) =>
    Number(g.getAttribute('data-i')),
  )

describe('free play', () => {
  it('opens both figures unwritten, beat 1 chosen, and the staff on the bass clef with no voice chosen', () => {
    // Act
    initFreePlay()

    // Assert (WEB-SPEC, Toys 8)
    expect(lineFig().getAttribute('aria-label')).toBe(
      'One bar of 4/4: four quarter notes, on one line',
    )
    expect(staffFig().getAttribute('aria-label')).toBe(
      'Two bars of 4/4: a half note and two quarter notes, then two quarter notes and a half note, on the bass staff',
    )
    expect([written(lineFig()), written(staffFig())]).toEqual([[], []])
    expect(pad(0).getAttribute('aria-pressed')).toBe('true')
    expect(
      [button('[data-rb-halve]'), button('[data-rb-join]')].map((b) =>
        b.getAttribute('aria-disabled'),
      ),
    ).toEqual(['false', 'false'])
    expect(button('[data-rb-clef="bass"]').getAttribute('aria-pressed')).toBe(
      'true',
    )
    expect(runs).toHaveLength(0)
  })

  it('halves the chosen beat and plays it at once, its unchanged beats still written, then joins it back', async () => {
    // Arrange
    initFreePlay()
    linePlay().click()
    await finish()

    // Act
    pad(1).click()
    button('[data-rb-halve]').click()
    const halved = [lineSaid(), written(lineFig())]
    await finish()
    button('[data-rb-join]').click()

    // Assert (WEB-SPEC, Toys 1)
    expect([0, 1].map((b) => pad(b).getAttribute('aria-pressed'))).toEqual([
      'false',
      'true',
    ])
    expect(halved).toEqual(['Beat 2 halved: two eighth notes', [0, 3, 4]])
    expect(lineSaid()).toBe('Beat 2 joined: a quarter note')
    expect(lineFig().getAttribute('aria-label')).toBe(
      'One bar of 4/4: four quarter notes, on one line',
    )
    expect(runs).toHaveLength(3)
    expect(new Set(voices)).toEqual(new Set([hz(A3)]))
  })

  it('makes the chosen beat a rest and back with Note · Rest, Halve and Join refused on it with their hint', () => {
    // Arrange
    initFreePlay()
    pad(2).click()

    // Act
    button('[data-rb-rest-toggle]').click()
    const silent = [
      lineSaid(),
      button('[data-rb-halve]').getAttribute('aria-disabled'),
      words(el('#freeHint')),
    ]
    button('[data-rb-halve]').click()
    const refused = [lineSaid(), runs.length]
    button('[data-rb-rest-toggle]').click()

    // Assert (WEB-SPEC, Toys 1)
    expect(silent).toEqual([
      'Beat 3 silent: a quarter rest',
      'true',
      REFUSAL_HINT.silent,
    ])
    expect(refused).toEqual([REFUSAL_HINT.silent, 1])
    expect(lineSaid()).toBe('Beat 3 sounding again: a quarter note')
    expect(el('#freeHint').hidden).toBe(true)
    expect(runs).toHaveLength(2)
  })

  it("plays at the slider's tempo, the track filled to the thumb, writes the counts, draws the pitch line, and Reset puts back four quarters without a play, the changed beat unwritten", async () => {
    // Arrange
    initFreePlay()
    const tempo = el<HTMLInputElement>('#tempoFree')
    const filled = [tempo.style.getPropertyValue('--p')]

    // Act
    tempo.value = '120'
    tempo.dispatchEvent(new Event('input'))
    filled.push(tempo.style.getPropertyValue('--p'))
    button('[data-rb-count]').click()
    linePlay().click()
    const bpm = runs[0].o.bpm()
    await finish()
    const counts = lineFig().querySelectorAll('.rb-count').length
    const read = lineFig().querySelectorAll('.rb-read:not(.is-hidden)').length
    tempo.value = '90'
    tempo.dispatchEvent(new Event('input'))
    filled.push(tempo.style.getPropertyValue('--p'))
    const reread = lineFig().querySelectorAll('.rb-read:not(.is-hidden)').length
    button('[data-rb-lanes]').click()
    const lanes = lineFig().querySelector('svg')?.dataset.staff
    pad(0).click()
    button('[data-rb-halve]').click()
    button('[data-rb-reset]').click()

    // Assert (WEB-SPEC, Toys 1)
    expect(bpm).toBe(120)
    expect(words(el('label[for="tempoFree"]'))).toBe('Tempo 90 BPM')
    expect(tempo.getAttribute('aria-valuetext')).toBe('90 beats per minute')
    // the kit's track fill reads --p, and without it sits halfway at any tempo
    expect(filled).toEqual(['0%', '100%', '50%'])
    expect(button('[data-rb-count]').getAttribute('aria-pressed')).toBe('true')
    expect(counts).toBe(4)
    // the readings go with a new tempo, to read again as each note ends
    expect([read, reread]).toEqual([4, 0])
    expect(lanes).toBe('lanes')
    expect(lineSaid()).toBe('Back to four quarter notes')
    expect(runs.map((r) => r.stopped)).toEqual([false, true])
    // beat 1 was halved, so its quarter waits for its sound
    expect(written(lineFig())).toEqual([1, 2, 3])
  })

  it('changes the staff bars with Dot and Tie, says so and plays them; Clef moves the staff and the sound', () => {
    // Arrange
    initFreePlay()

    // Act
    button('[data-rb-dot]').click()
    const dotted = staffSaid()
    drive()
    const low = [...voices]
    button('[data-rb-tie]').click()
    const tied = staffSaid()
    const kept = written(staffFig())
    button('[data-rb-clef="treble"]').click()
    const treble = staffSaid()
    voices.length = 0
    staffPlay().click()
    drive()

    // Assert (WEB-SPEC, Toys 1)
    expect([dotted, tied, treble]).toEqual([
      STAFF_SAID.dotOn,
      STAFF_SAID.tieOn,
      STAFF_SAID.treble,
    ])
    expect(button('[data-rb-dot]').getAttribute('aria-pressed')).toBe('true')
    expect(button('[data-rb-tie]').getAttribute('aria-pressed')).toBe('true')
    // the tied quarter waits for its sound; the rest stay as heard
    expect(kept).toEqual([0, 2, 3, 4])
    expect(new Set(low)).toEqual(new Set([hz(A3)]))
    expect(staffFig().getAttribute('aria-label')).toMatch(
      /tied across the bar line, on the treble staff$/,
    )
    expect(new Set(voices)).toEqual(new Set([hz(A4)]))
  })

  it("takes the clef and the note of a voice chosen later, keeping the staff's writing", () => {
    // Arrange
    initFreePlay()
    staffPlay().click()
    drive()

    // Act
    VoiceChoice.set('higher')
    voices.length = 0
    linePlay().click()
    drive()

    // Assert (WEB-SPEC, Toys 7, part 2, state 2)
    expect(button('[data-rb-clef="treble"]').getAttribute('aria-pressed')).toBe(
      'true',
    )
    expect(written(staffFig())).toEqual([0, 1, 2, 3, 4, 5])
    expect(new Set(voices)).toEqual(new Set([hz(A4)]))
  })

  it('plays one figure at a time, and stops either once the card has been off screen for 600 ms', async () => {
    // Arrange
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    initFreePlay()

    // Act
    staffPlay().click()
    linePlay().click()
    const cut = runs[0].stopped
    scrollOutOfView(el('#freePlay'))
    await vi.advanceTimersByTimeAsync(AWAY_MS)
    const line = runs[1].stopped
    scrollIntoViewAgain(el('#freePlay'))
    staffPlay().click()
    scrollOutOfView(el('#freePlay'))
    await vi.advanceTimersByTimeAsync(AWAY_MS)

    // Assert (kit/now-playing.ts; Lesson 3's rule)
    expect([cut, line]).toEqual([true, true])
    expect(runs[2].stopped).toBe(true)
  })
})
