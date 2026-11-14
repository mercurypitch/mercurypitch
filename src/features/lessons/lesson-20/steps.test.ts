// ============================================================
// Lesson 20 steps tests — the staircase and the run on the page's own markup
// ============================================================
//
// On the page's markup and its own deck (WEB-SPEC, Toys 1 and 5): Step 1's
// staircase leaves out fa and ti and slides, its inline play moving the
// switch as the five start; Step 2's Major · Minor moves the house to la,
// Play both moves it as A's five begin, and Play it on C shows the minor
// five on C, then A's again; Step 3's run plays at Tempo's notches and
// smudged, Step 4's staccato and legato, and the staff writes the run as
// it sounds. The staircase sounds through `Sound.voice` on fake timers;
// the run through the kit's runs, here the recorder.

import type { MockInstance } from 'vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { hz } from '@/features/lessons/kit/notes'
import type * as RunModule from '@/features/lessons/kit/run'
import type { RecordedRun } from '@/features/lessons/kit/run-recorder.test-fixtures'
import { resetRuns, runs, } from '@/features/lessons/kit/run-recorder.test-fixtures'
import { Sound } from '@/features/lessons/kit/sound'
import { VoiceChoice } from '@/features/lessons/kit/voice-choice'
import { el, mountSteps, settle, soundOn, words, } from './page-dom.test-fixtures'

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
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
  window.location.hash = ''
  document.body.textContent = ''
})

const click = (selector: string): void => el<HTMLElement>(selector).click()
const last = (): RecordedRun => runs[runs.length - 1]

/** The MIDI notes the staircase has sounded so far, in order. */
const sounded = (): number[] =>
  voices.mock.calls.map(([f]) => Math.round(69 + 12 * Math.log2(f / 440)))

/** The staircase's visible stairs, as their buttons name them. */
const stairs = (): string[] =>
  Array.from(
    document.querySelectorAll<HTMLButtonElement>('#toyStairs .stair-hit'),
  )
    .filter((b) => !b.hidden && b.dataset.stair !== undefined)
    .map((b) => b.getAttribute('aria-label') ?? '')

const pressed = (selector: string): string | null =>
  el(selector).getAttribute('aria-pressed')
const said = (root: string, part: string): string =>
  words(document.querySelector(`${root} ${part}`))

describe('Step 1: the staircase with fa and ti left out', () => {
  it("opens on C3's major scale, each stair named, and Play up plays it in the soft tone, 0.45 s a note", async () => {
    // Arrange
    mountSteps()

    // Act
    click('#toyStairs [data-stairs-play="up"]')
    await vi.advanceTimersByTimeAsync(4100)

    // Assert: FACTS 26 and 80
    expect(stairs()).toHaveLength(8)
    expect(stairs()[3]).toBe('Stair 4, fa, F3')
    expect(sounded()).toEqual([48, 50, 52, 53, 55, 57, 59, 60])
    expect(voices.mock.calls.map(([, o]) => o?.dur)).toEqual([
      0.45, 0.45, 0.45, 0.45, 0.45, 0.45, 0.45, 0.9,
    ])
    expect(voices.mock.calls.every(([, o]) => o?.kind === undefined)).toBe(true)
  })

  it('takes fa and ti away, says so, and Play up then plays the five', async () => {
    // Arrange
    mountSteps()

    // Act
    click('#toyStairs [data-stairs-five]')
    click('#toyStairs [data-stairs-play="up"]')
    await vi.advanceTimersByTimeAsync(3200)

    // Assert
    expect(pressed('#toyStairs [data-stairs-five]')).toBe('true')
    expect(stairs()).toEqual([
      'Stair 1, do, C3, home',
      'Stair 2, re, D3',
      'Stair 3, mi, E3',
      'Stair 4, so, G3',
      'Stair 5, la, A3',
      'Stair 6, do, C4, home',
    ])
    expect(said('#toyStairs', '[data-stairs-said]')).toBe(
      'Fa and ti left out: five notes, steps of 2, 2, 3, 2 and 3 semitones.',
    )
    expect(said('#toyStairs', '[data-stairs-summary]')).toBe(
      'C major pentatonic: C, D, E, G, A, C. Steps of 2, 2, 3, 2 and 3 semitones.',
    )
    expect(sounded()).toEqual([48, 50, 52, 55, 57, 60])
  })

  it("slides silently to D, where the five are Merc's: D, E, F sharp, A and B", () => {
    // Arrange
    mountSteps()
    click('#toyStairs [data-stairs-five]')

    // Act
    click('#toyStairs [data-slide="1"]')
    click('#toyStairs [data-slide="1"]')

    // Assert
    expect(stairs().slice(0, 5)).toEqual([
      'Stair 1, do, D3, home',
      'Stair 2, re, E3',
      'Stair 3, mi, F sharp 3',
      'Stair 4, so, A3',
      'Stair 5, la, B3',
    ])
    expect(el('#toyStairs [data-start-value]').textContent).toBe('Do is D3')
    expect(
      el('#toyStairs [data-start-slider]').getAttribute('aria-valuetext'),
    ).toBe('Do is D3: D major pentatonic')
    expect(voices).not.toHaveBeenCalled()
  })

  it('plays C major, 0.5 s of quiet and the five, the switch moving as the five start, 7.7 s', async () => {
    // Arrange
    mountSteps()
    click('#toyStairs [data-slide="1"]')
    const inline = el<HTMLButtonElement>('[data-step-play="major-five"]')

    // Act
    inline.click()
    await vi.advanceTimersByTimeAsync(4500)
    const before = pressed('#toyStairs [data-stairs-five]')
    await vi.advanceTimersByTimeAsync(100)
    const after = pressed('#toyStairs [data-stairs-five]')
    const lit = inline.classList.contains('is-on')
    await vi.advanceTimersByTimeAsync(3150)

    // Assert: back on C first, then each scale in turn (FACTS 80)
    expect(sounded()).toEqual([
      48, 50, 52, 53, 55, 57, 59, 60, 48, 50, 52, 55, 57, 60,
    ])
    expect([before, after]).toEqual(['false', 'true'])
    expect(lit).toBe(true)
    expect(inline.classList.contains('is-on')).toBe(false)
  })
})

describe('Step 2: the same five from la', () => {
  it('shows Major · Minor and no switch or Slide, and Minor moves the house to A2, sung from do', () => {
    // Arrange
    const deck = mountSteps()
    deck.show(2)
    const shown = {
      five: !el('#toyStairs [data-stairs-five]').hidden,
      slide: !el('#toyStairs [data-slide-row]').hidden,
      modes: !el('#toyStairs [data-stairs-mode]').hidden,
    }

    // Act
    click('#toyStairs [data-mode="minor"]')

    // Assert: FACTS 24 and 27
    expect(shown).toEqual({ five: false, slide: false, modes: true })
    expect(stairs()).toEqual([
      'Stair 1, do, A2, home',
      'Stair 2, me, C3',
      'Stair 3, fa, D3',
      'Stair 4, so, E3',
      'Stair 5, te, G3',
      'Stair 6, do, A3, home',
    ])
    expect(said('#toyStairs', '[data-stairs-said]')).toBe(
      'Minor: the same five notes from A, steps of 3, 2, 2, 3 and 2.',
    )
    expect(pressed('#toyStairs [data-mode="minor"]')).toBe('true')
  })

  it("leaves Minor in Step 2: back in Step 1 the five are C's again, its switch as Step 1 left it, and Step 2 opens at Major", () => {
    // Arrange: the five in Step 1, then Minor in Step 2
    const deck = mountSteps()
    click('#toyStairs [data-stairs-five]')
    deck.show(2)
    click('#toyStairs [data-mode="minor"]')

    // Act
    deck.show(1)
    const back = {
      five: pressed('#toyStairs [data-stairs-five]'),
      slide: !el('#toyStairs [data-slide-row]').hidden,
      stairs: stairs(),
    }
    deck.show(2)

    // Assert: Step 1 has no Major · Minor, and Step 2 opens at Major (WEB-SPEC, Toys 1)
    expect(back).toEqual({
      five: 'true',
      slide: true,
      stairs: [
        'Stair 1, do, C3, home',
        'Stair 2, re, D3',
        'Stair 3, mi, E3',
        'Stair 4, so, G3',
        'Stair 5, la, A3',
        'Stair 6, do, C4, home',
      ],
    })
    expect(pressed('#toyStairs [data-mode="major"]')).toBe('true')
  })

  it("plays both, C's five, 0.5 s, then A's, the house moving as A's begin, 6.8 s", async () => {
    // Arrange
    const deck = mountSteps()
    deck.show(2)

    // Act
    click('[data-step-play="both"]')
    await vi.advanceTimersByTimeAsync(3600)
    const before = pressed('#toyStairs [data-mode="minor"]')
    await vi.advanceTimersByTimeAsync(100)
    const after = pressed('#toyStairs [data-mode="minor"]')
    await vi.advanceTimersByTimeAsync(3150)

    // Assert
    expect(sounded()).toEqual([48, 50, 52, 55, 57, 60, 45, 48, 50, 52, 55, 57])
    expect([before, after]).toEqual(['false', 'true'])
  })

  it('plays the minor five on C, its stairs showing E flat and B flat, then shows A’s five again', async () => {
    // Arrange
    const deck = mountSteps()
    deck.show(2)

    // Act
    click('[data-step-play="on-c"]')
    const playing = stairs()
    await vi.advanceTimersByTimeAsync(3200)

    // Assert: FACTS 25
    expect(playing.slice(1, 5)).toEqual([
      'Stair 2, me, E flat 3',
      'Stair 3, fa, F3',
      'Stair 4, so, G3',
      'Stair 5, te, B flat 3',
    ])
    expect(sounded()).toEqual([48, 51, 53, 55, 58, 60])
    expect(stairs()[0]).toBe('Stair 1, do, A2, home')
  })
})

describe('Steps 3 and 4: the run', () => {
  it("sings Merc's run from D3 as one line at 0.6 s a note, each bead lit on the line's own clock", () => {
    // Arrange
    const deck = mountSteps()
    deck.show(3)

    // Act
    click('#toyRun [data-run-play="run"]')
    const [line, beads] = runs.slice(-2)

    // Assert: FACTS 39
    expect(line.kind).toBe('line')
    expect(line.o).toMatchObject({ audible: true, kind: 'merc' })
    expect(line.points[0].hz).toBeCloseTo(hz(50), 9)
    expect(line.points[line.points.length - 1].t).toBeCloseTo(5.4, 9)
    expect(beads.o.audible).toBe(false)
    expect(beads.notes.map((n) => n.t)).toEqual([
      0, 0.6, 1.2, 1.8, 2.4, 3, 3.6, 4.2, 4.8,
    ])
    expect(said('#toyRun', '[data-run-said]')).toBe(
      'The run at 0.6 seconds a note.',
    )
  })

  it("redraws silently at Tempo's 0.3 s, and the run then takes 2.70 s", () => {
    // Arrange
    const deck = mountSteps()
    deck.show(3)

    // Act
    click('#toyRun [data-tempo="0.3"]')
    const silent = runs.length
    click('#toyRun [data-run-play="run"]')

    // Assert
    expect(silent).toBe(0)
    expect(pressed('#toyRun [data-tempo="0.3"]')).toBe('true')
    expect(runs[0].points[runs[0].points.length - 1].t).toBeCloseTo(2.7, 9)
    expect(el('#toyRun canvas').getAttribute('aria-label')).toBe(
      "Merc's run: do, re, mi, so, la, so, mi, re and do, a note every 0.3 seconds",
    )
  })

  it("plays it smudged: Tempo to 0.2 s, an illustrated singer in the soft tone, 1.80 s, and nothing of Merc's", () => {
    // Arrange
    const deck = mountSteps()
    deck.show(3)

    // Act
    click('#toyRun [data-run-play="smudged"]')

    // Assert: FACTS 82a
    expect(pressed('#toyRun [data-tempo="0.2"]')).toBe('true')
    expect(runs).toHaveLength(1)
    expect(last().kind).toBe('line')
    expect(last().o.kind).toBe('soft')
    expect(last().points[last().points.length - 1].t).toBeCloseTo(1.8, 9)
    expect(el('#toyRun [data-run-illustration]').hidden).toBe(false)
    expect(said('#toyRun', '[data-run-said]')).toBe(
      'An illustration: a smudged run, five of its nine notes outside their bands.',
    )
  })

  it('takes the smudged line and its tag away once the beads move: a notch down, or Step 4', () => {
    // Arrange
    const deck = mountSteps()
    deck.show(3)
    click('#toyRun [data-run-play="smudged"]')
    const tagged = !el('#toyRun [data-run-illustration]').hidden

    // Act: the Notice's notch back, then smudged again and on to Step 4
    click('#toyRun [data-tempo="0.3"]')
    const afterNotch = !el('#toyRun [data-run-illustration]').hidden
    click('#toyRun [data-run-play="smudged"]')
    deck.show(4)

    // Assert: the line was sung at 0.2 s, so it goes as its beads move
    expect(tagged).toBe(true)
    expect(afterNotch).toBe(false)
    expect(el('#toyRun [data-run-illustration]').hidden).toBe(true)
  })

  it('holds Step 4 at 0.45 s with Staccato · Legato, and staccato sings nine 0.15 s notes on a short envelope', () => {
    // Arrange
    const deck = mountSteps()
    deck.show(4)
    const shown = {
      tempo: !el('#toyRun [data-run-tempo]').hidden,
      touch: !el('#toyRun [data-run-touch]').hidden,
      smudged: !el('#toyRun [data-run-play="smudged"]').hidden,
    }

    // Act
    click('#toyRun [data-touch="staccato"]')
    click('#toyRun [data-run-play="run"]')

    // Assert: FACTS 31
    expect(shown).toEqual({ tempo: false, touch: true, smudged: false })
    expect(last().kind).toBe('notes')
    expect(last().o).toMatchObject({
      audible: true,
      kind: 'merc',
      attack: 0.025,
      release: 0.08,
    })
    expect(last().notes.map((n) => [n.t, n.dur])).toEqual(
      [0, 0.45, 0.9, 1.35, 1.8, 2.25, 2.7, 3.15, 3.6].map((t) => [t, 0.15]),
    )
    expect(said('#toyRun', '[data-run-said]')).toBe('The run, staccato.')
  })

  it('plays staccato, 0.5 s, then legato, the touch moving as each starts', async () => {
    // Arrange
    const deck = mountSteps()
    deck.show(4)

    // Act
    click('[data-step-play="touch"]')
    const staccato = pressed('#toyRun [data-touch="staccato"]')
    last().end(true)
    await settle()
    await vi.advanceTimersByTimeAsync(500)

    // Assert: the legato line and its silent beads after the staccato notes
    expect(staccato).toBe('true')
    expect(runs.map((r) => r.kind)).toEqual(['notes', 'line', 'notes'])
    expect(runs[1].points[runs[1].points.length - 1].t).toBeCloseTo(4.05, 9)
    expect(pressed('#toyRun [data-touch="legato"]')).toBe('true')
  })

  it('writes the run on the staff as it sounds, silently, once the switch is on, and keeps it written', async () => {
    // Arrange
    const deck = mountSteps()
    deck.show(3)
    click('#toyRun [data-run-staff]')
    const bare = document.querySelectorAll('#toyRun .st-head').length

    // Act
    click('#toyRun [data-run-play="run"]')
    const written = runs[runs.length - 1]
    written.notes.forEach((_n, i) => written.note(i))
    written.end(true)
    runs.slice(0, -1).forEach((r) => r.end(true))
    await settle()

    // Assert: FACTS 47
    expect(el('#toyRun [data-staff-viz]').hidden).toBe(false)
    expect(bare).toBe(0)
    expect(written.o.audible).toBe(false)
    expect(document.querySelectorAll('#toyRun .st-head')).toHaveLength(9)
    expect(document.querySelectorAll('#toyRun .st-sign')).toHaveLength(2)
  })

  it('follows the higher voice: the staircase on C4, and Tavi’s run from D4', () => {
    // Arrange
    const deck = mountSteps()

    // Act
    VoiceChoice.set('higher')
    const top = stairs()[0]
    deck.show(3)
    click('#toyRun [data-run-play="run"]')
    const label = el('#toyRun canvas').getAttribute('aria-label')
    VoiceChoice.set('lower')

    // Assert
    expect(top).toBe('Stair 1, do, C4, home')
    expect(runs[0].points[0].hz).toBeCloseTo(hz(62), 9)
    expect(label).toBe(
      "Tavi's run: do, re, mi, so, la, so, mi, re and do, a note every 0.6 seconds",
    )
  })
})
