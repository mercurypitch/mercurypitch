// ============================================================
// Lesson 20 free play tests — both toys, every switch, one sound at a time
// ============================================================
//
// On the page's markup (WEB-SPEC, Sections 8): free play opens the
// staircase and the run side by side with every control from the steps,
// Leave out fa and ti, Major · Minor and the Slide on the staircase, Tempo,
// Staccato · Legato and Play it smudged on the run, and no reveal or quiz.
// A play on one stops the other, as every sound on the page does; both
// follow Sing it's voice choice; and leaving free play stops what it
// plays. The staircase sounds through `Sound.voice` on fake timers, the
// run through the kit's runs, here the recorder.

import type { MockInstance } from 'vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import { hz } from '@/features/lessons/kit/notes'
import type * as RunModule from '@/features/lessons/kit/run'
import { resetRuns, runs, } from '@/features/lessons/kit/run-recorder.test-fixtures'
import { Sound } from '@/features/lessons/kit/sound'
import { VoiceChoice } from '@/features/lessons/kit/voice-choice'
import { initFreePlay } from './free-play'
import { el, loadPage, soundOn } from './page-dom.test-fixtures'

vi.mock('@/features/lessons/kit/run', async (actual) => ({
  ...(await actual<typeof RunModule>()),
  ...(await import('@/features/lessons/kit/run-recorder.test-fixtures'))
    .recordedRuns,
}))

let voices: MockInstance<typeof Sound.voice>

beforeEach(() => {
  resetRuns()
  soundOn()
  voices = vi.spyOn(Sound, 'voice').mockReturnValue(null)
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  loadPage()
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
  document.body.textContent = ''
})

const click = (selector: string): void => el<HTMLElement>(selector).click()
const shows = (selector: string): boolean => !el(selector).hidden

/** The MIDI notes the staircase has sounded so far, in order. */
const sounded = (): number[] =>
  voices.mock.calls.map(([f]) => Math.round(69 + 12 * Math.log2(f / 440)))

/** Free play's visible stairs, as their buttons name them. */
const stairs = (): string[] =>
  Array.from(
    document.querySelectorAll<HTMLButtonElement>('#freeStairs .stair-hit'),
  )
    .filter((b) => !b.hidden && b.dataset.stair !== undefined)
    .map((b) => b.getAttribute('aria-label') ?? '')

describe("Lesson 20's free play", () => {
  it('opens both toys with every control from the steps', () => {
    // Act
    initFreePlay()

    // Assert: WEB-SPEC, Sections 8
    expect({
      five: shows('#freeStairs [data-stairs-five]'),
      modes: shows('#freeStairs [data-stairs-mode]'),
      slide: shows('#freeStairs [data-slide-row]'),
      tempo: shows('#freeRun [data-run-tempo]'),
      touch: shows('#freeRun [data-run-touch]'),
      smudged: shows('#freeRun [data-run-play="smudged"]'),
      staff: shows('#freeRun [data-run-staff]'),
    }).toEqual({
      five: true,
      modes: true,
      slide: true,
      tempo: true,
      touch: true,
      smudged: true,
      staff: true,
    })
    expect(document.querySelector('#freePlay [data-choice]')).toBeNull()
  })

  it("leaves out fa and ti and plays the five; Merc sings the run at Tempo's notch", async () => {
    // Arrange
    initFreePlay()

    // Act
    click('#freeStairs [data-stairs-five]')
    click('#freeStairs [data-stairs-play="up"]')
    await vi.advanceTimersByTimeAsync(3200)
    click('#freeRun [data-tempo="0.3"]')
    click('#freeRun [data-run-play="run"]')
    const [line, beads] = runs.slice(-2)

    // Assert
    expect(stairs()).toEqual([
      'Stair 1, do, C3, home',
      'Stair 2, re, D3',
      'Stair 3, mi, E3',
      'Stair 4, so, G3',
      'Stair 5, la, A3',
      'Stair 6, do, C4, home',
    ])
    expect(sounded()).toEqual([48, 50, 52, 55, 57, 60])
    expect(line.kind).toBe('line')
    expect(line.o).toMatchObject({ audible: true, kind: 'merc' })
    expect(line.points[0].hz).toBeCloseTo(hz(50), 9)
    expect(line.points[line.points.length - 1].t).toBeCloseTo(2.7, 9)
    expect(beads.o.audible).toBe(false)
  })

  it('plays one sound at a time: the run stops the staircase part way, and the staircase the run', async () => {
    // Arrange
    initFreePlay()
    click('#freeStairs [data-stairs-play="up"]')
    await vi.advanceTimersByTimeAsync(500)
    const early = sounded().length

    // Act
    click('#freeRun [data-run-play="run"]')
    await vi.advanceTimersByTimeAsync(4000)
    const later = sounded().length
    const [line, beads] = runs.slice(-2)
    click('#freeStairs [data-stairs-play="up"]')

    // Assert
    expect(early).toBeGreaterThan(0)
    expect(later).toBe(early)
    expect(line.stopped && beads.stopped).toBe(true)
  })

  it('follows the voice chosen in Sing it: the staircase on C4, and Tavi’s run from D4', () => {
    // Arrange
    initFreePlay()

    // Act
    VoiceChoice.set('higher')
    const top = stairs()[0]
    click('#freeRun [data-run-play="run"]')
    const label = el('#freeRun canvas').getAttribute('aria-label')
    VoiceChoice.set('lower')

    // Assert
    expect(top).toBe('Stair 1, do, C4, home')
    expect(runs[0].points[0].hz).toBeCloseTo(hz(62), 9)
    expect(label).toBe(
      "Tavi's run: do, re, mi, so, la, so, mi, re and do, a note every 0.6 seconds",
    )
  })

  it('stops what it plays when the viewer leaves', () => {
    // Arrange
    initFreePlay()
    click('#freeRun [data-run-play="smudged"]')
    const smudged = runs[runs.length - 1]

    // Act
    window.dispatchEvent(new Event('pagehide'))

    // Assert
    expect(smudged.kind).toBe('line')
    expect(smudged.stopped).toBe(true)
  })
})
