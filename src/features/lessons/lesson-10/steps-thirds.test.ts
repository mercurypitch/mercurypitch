// ============================================================
// Lesson 10 Steps 1 and 2 tests — the third, its switch, Slow, and the stack
// ============================================================
//
// On the page's own markup and deck, its runs recorded (kit/run-recorder.
// test-fixtures.ts): Play the third plays its two notes, 0.6 s each, then
// together for 1.0 s, and Slow doubles every length, the gap buttons' too
// (FACTS 75); Major · Minor starts on Major and slides the top bead to
// E♭4, spelled on its own letter; Stack a third drops G4 in and gives its
// place and the focus to Play the triad, 0.55 s a note, then together for
// 1.2 s, and the middle bead turns gold. Each play is the page's one sound
// and lights its button while it sounds; each change is said once, in the
// toy's polite line, and stops the stage's sound first (WEB-SPEC, Toys 1).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import type * as RunModule from '@/features/lessons/kit/run'
import type { RunNote } from '@/features/lessons/kit/run'
import type { RecordedRun } from '@/features/lessons/kit/run-recorder.test-fixtures'
import { resetRuns, runs, } from '@/features/lessons/kit/run-recorder.test-fixtures'
import type { BeadsScene } from './chord-beads-draw'
import { el, mountSteps, settle, soundOn } from './page-dom.test-fixtures'

vi.mock('@/features/lessons/kit/run', async (actual) => ({
  ...(await actual<typeof RunModule>()),
  ...(await import('@/features/lessons/kit/run-recorder.test-fixtures'))
    .recordedRuns,
}))

type Deck = ReturnType<typeof mountSteps>

/** The stage's deck on step `n`, its figure a phone's 356 x 340 (FACTS 82). */
function openStep(n: number): Deck {
  const deck = mountSteps()
  vi.spyOn(
    el<HTMLCanvasElement>('#toyChord [data-chord-viz] canvas'),
    'getBoundingClientRect',
  ).mockReturnValue(new DOMRect(0, 0, 356, 340))
  deck.show(n)
  return deck
}

const stage = (selector: string): HTMLButtonElement =>
  el<HTMLButtonElement>(`#toyChord ${selector}`)
const pressed = (selector: string): (string | null)[] =>
  Array.from(document.querySelectorAll(`#toyChord ${selector}`), (b) =>
    b.getAttribute('aria-pressed'),
  )
const last = (): RecordedRun => {
  const r = runs.at(-1)
  if (r === undefined) throw new Error('nothing played')
  return r
}
/** Notes as they sound, to the nanosecond: onset, MIDI, length and level. */
const timed = (notes: readonly RunNote[]): string[] =>
  notes.map(
    (n) => `${n.t.toFixed(9)} ${n.midi} ${n.dur.toFixed(9)} ${n.gain ?? 'run'}`,
  )
const sceneOf = (deck: Deck): BeadsScene => {
  const s = deck.beads.scene()
  if (s === null) throw new Error('no scene')
  return s
}

/** Every line the toy's polite region is given from now on. */
function hearSaid(): string[] {
  const lines: string[] = []
  const said = el('#toyChord [data-chord-said]')
  new MutationObserver(() => lines.push(said.textContent ?? '')).observe(said, {
    childList: true,
    characterData: true,
    subtree: true,
  })
  return lines
}

beforeEach(() => {
  resetRuns()
  soundOn()
})

afterEach(() => {
  vi.restoreAllMocks()
  window.location.hash = ''
  document.body.textContent = ''
})

describe("Lesson 10's Step 1, a third", () => {
  it('plays the third as its two notes, 0.6 s each, then together for 1.0 s, in the soft tone', () => {
    // Arrange
    openStep(1)

    // Act
    stage('[data-chord-play="third"]').click()

    // Assert: FACTS 75, the two together at a chord voice's level (FACTS 81)
    expect([last().notes, last().o.kind, last().o.audible]).toEqual([
      [
        { t: 0, midi: 60, dur: 0.6 },
        { t: 0.6, midi: 64, dur: 0.6 },
        { t: 1.2, midi: 60, dur: 1, gain: 0.075 },
        { t: 1.2, midi: 64, dur: 1, gain: 0.075 },
      ],
      'soft',
      true,
    ])
  })

  it('doubles every length with Slow, pressed, for Play the third and the gap button alike', () => {
    // Arrange
    openStep(1)

    // Act
    stage('[data-chord-slow]').click()
    stage('[data-chord-play="third"]').click()
    const third = last().notes
    stage('.chord-hit-gap').click()

    // Assert
    const doubled = [
      { t: 0, midi: 60, dur: 1.2 },
      { t: 1.2, midi: 64, dur: 1.2 },
      { t: 2.4, midi: 60, dur: 2, gain: 0.075 },
      { t: 2.4, midi: 64, dur: 2, gain: 0.075 },
    ]
    expect(pressed('[data-chord-slow]')).toEqual(['true'])
    expect(third).toEqual(doubled)
    expect(last().notes).toEqual(doubled)
  })

  it('plays at its own lengths again once Slow is pressed off', () => {
    // Arrange
    openStep(1)
    stage('[data-chord-slow]').click()

    // Act
    stage('[data-chord-slow]').click()
    stage('[data-chord-play="third"]').click()

    // Assert
    expect(pressed('[data-chord-slow]')).toEqual(['false'])
    expect(last().notes.map((n) => n.dur)).toEqual([0.6, 0.6, 1, 1])
  })

  it('starts on Major, and Minor slides the top bead to E♭4, spelled on its E, never D♯4', () => {
    // Arrange
    const deck = openStep(1)
    const before = pressed('[data-chord-quality] button')

    // Act
    stage('[data-quality="minor"]').click()

    // Assert
    expect(before).toEqual(['true', 'false'])
    expect(pressed('[data-chord-quality] button')).toEqual(['false', 'true'])
    expect(deck.beads.settings.quality).toBe('minor')
    expect(sceneOf(deck).beads.map((b) => b.name)).toEqual(['C4', 'E♭4'])
    expect(el('#toyChord [data-chord-summary]').textContent).toBe(
      'Minor third: C 4, E flat 4. A gap of 3 semitones.',
    )
  })

  it('says each switch once, in the toy’s polite line', async () => {
    // Arrange
    openStep(1)
    const lines = hearSaid()

    // Act
    stage('[data-quality="minor"]').click()
    await settle()
    stage('[data-quality="major"]').click()
    await settle()

    // Assert
    expect(lines).toEqual([
      'Minor: the top note moved down a semitone, to E flat 4. A minor third.',
      'Major: the top note moved up a semitone, to E 4. A major third.',
    ])
  })

  it('stops the third sounding as Major · Minor changes, and lets go of its button', async () => {
    // Arrange
    openStep(1)
    const play = stage('[data-chord-play="third"]')
    play.click()
    const lit = play.classList.contains('is-on')

    // Act
    stage('[data-quality="minor"]').click()
    await settle()

    // Assert
    expect(lit).toBe(true)
    expect(runs[0].stopped).toBe(true)
    expect(play.classList.contains('is-on')).toBe(false)
  })

  it('plays as the page’s one sound: it stops the sound before it, and a newer one stops it', async () => {
    // Arrange: another sound on the page, playing
    openStep(1)
    const before = vi.fn()
    NowPlaying.claim(before)
    const play = stage('[data-chord-play="third"]')

    // Act
    play.click()
    const stoppedBefore = before.mock.calls.length
    NowPlaying.claim(() => undefined)
    await settle()

    // Assert
    expect(stoppedBefore).toBe(1)
    expect(last().stopped).toBe(true)
    expect(play.classList.contains('is-on')).toBe(false)
  })

  it('lights its button while it sounds, and puts it out once heard to its end', async () => {
    // Arrange
    openStep(1)
    const play = stage('[data-chord-play="third"]')
    play.click()
    const lit = play.classList.contains('is-on')

    // Act
    last().end(true)
    await settle()

    // Assert
    expect(lit).toBe(true)
    expect(play.classList.contains('is-on')).toBe(false)
  })

  it('opens Step 1 on Major again, whatever was pressed before the step was left', () => {
    // Arrange
    const deck = openStep(1)
    stage('[data-quality="minor"]').click()

    // Act
    deck.show(2)
    deck.show(1)

    // Assert
    expect(pressed('[data-chord-quality] button')).toEqual(['true', 'false'])
    expect(deck.beads.settings.quality).toBe('major')
  })
})

describe("Lesson 10's Step 2, a third stacked on a third", () => {
  it('opens on Step 1’s two beads in C major, with Stack a third and no Play the triad', () => {
    // Act
    const deck = openStep(2)

    // Assert
    expect(stage('[data-chord-stack]').hidden).toBe(false)
    expect(stage('[data-chord-play="triad"]').hidden).toBe(true)
    expect(sceneOf(deck).beads.map((b) => b.name)).toEqual(['C4', 'E4'])
  })

  it('drops G4 in and gives its place and the focus to Play the triad, the middle bead gold', () => {
    // Arrange
    const deck = openStep(2)
    const stack = stage('[data-chord-stack]')
    stack.focus()

    // Act
    stack.click()

    // Assert
    const triad = stage('[data-chord-play="triad"]')
    expect([stack.hidden, triad.hidden]).toEqual([true, false])
    expect(document.activeElement).toBe(triad)
    expect(deck.beads.settings.stacked).toBe(true)
    expect(sceneOf(deck).beads.map((b) => [b.name, b.gold])).toEqual([
      ['C4', false],
      ['E4', true],
      ['G4', false],
    ])
  })

  it('says the stack once, in the toy’s polite line', async () => {
    // Arrange
    openStep(2)
    const lines = hearSaid()

    // Act
    stage('[data-chord-stack]').click()
    await settle()

    // Assert
    expect(lines).toEqual(['Stacked: C, E, G. C major.'])
  })

  it('stops the stage’s sound as it stacks', () => {
    // Arrange
    openStep(2)
    stage('.chord-hit-gap').click()

    // Act
    stage('[data-chord-stack]').click()

    // Assert
    expect(runs[0].stopped).toBe(true)
  })

  it('plays the triad at 0.55 s a note, then all three together for 1.2 s, and twice as long with Slow', () => {
    // Arrange
    openStep(2)
    stage('[data-chord-stack]').click()

    // Act
    stage('[data-chord-play="triad"]').click()
    const plain = last().notes
    stage('[data-chord-slow]').click()
    stage('[data-chord-play="triad"]').click()

    // Assert: FACTS 75
    expect(timed(plain)).toEqual([
      '0.000000000 60 0.550000000 run',
      '0.550000000 64 0.550000000 run',
      '1.100000000 67 0.550000000 run',
      '1.650000000 60 1.200000000 0.075',
      '1.650000000 64 1.200000000 0.075',
      '1.650000000 67 1.200000000 0.075',
    ])
    expect(timed(last().notes)).toEqual([
      '0.000000000 60 1.100000000 run',
      '1.100000000 64 1.100000000 run',
      '2.200000000 67 1.100000000 run',
      '3.300000000 60 2.400000000 0.075',
      '3.300000000 64 2.400000000 0.075',
      '3.300000000 67 2.400000000 0.075',
    ])
  })

  it('opens unstacked again, with Stack a third, once the viewer leaves and comes back', () => {
    // Arrange
    const deck = openStep(2)
    stage('[data-chord-stack]').click()

    // Act
    deck.show(1)
    deck.show(2)

    // Assert
    expect(stage('[data-chord-stack]').hidden).toBe(false)
    expect(stage('[data-chord-play="triad"]').hidden).toBe(true)
    expect(deck.beads.settings.stacked).toBe(false)
  })
})
