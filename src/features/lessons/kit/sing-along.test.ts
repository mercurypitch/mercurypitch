// ============================================================
// Sing along tests — Merc quiet after a run, never during the next one
// ============================================================
//
// Read on the hero rail's bead, which marks a Merc's sung note whatever
// the motion setting: lit while he sings, dark once he falls quiet.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import './browser-doubles.test-fixtures'
import { mercSing } from './merc-duo'
import type { SungNote } from './sing-along'
import { singAlong, stopSingAlong } from './sing-along'

/** Whether Merc's bead on the rail is lit: he is singing. */
const singing = (): boolean =>
  document
    .querySelector('#heroRail [data-bead="blue"]')
    ?.classList.contains('on') === true

const note = (midi: number, dur: number): SungNote => ({ midi, dur })

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  document.body.innerHTML =
    '<div id="mercBlue"></div><div id="heroRail"><i data-bead="blue"></i></div>'
})

afterEach(() => {
  stopSingAlong('blue', 60)
  vi.useRealTimers()
  document.body.innerHTML = ''
})

describe('singAlong', () => {
  it('sings each note as it starts and falls quiet once the last has ended', () => {
    // Arrange
    const sing = singAlong('blue')
    sing(note(60, 0.45), 0, 2)
    sing(note(62, 0.9), 1, 2)
    vi.advanceTimersByTime(899)
    const before = singing()

    // Act
    vi.advanceTimersByTime(1)

    // Assert
    expect(before).toBe(true)
    expect(singing()).toBe(false)
  })

  it("keeps Merc singing through a replay started within the last note's length", () => {
    // Arrange: a run's last note, 1.2 s, and a replay 0.5 s into it
    const first = singAlong('blue')
    first(note(71, 1.2), 1, 2)
    vi.advanceTimersByTime(500)
    singAlong('blue')(note(60, 0.45), 0, 8)

    // Act: past the end of the first run's last note
    vi.advanceTimersByTime(800)

    // Assert
    expect(singing()).toBe(true)
  })

  it('quiets Merc at once for a run cut short, and that run never quiets the replay', () => {
    // Arrange: the last note sounding, then cut short 0.3 s in
    singAlong('blue')(note(71, 1.2), 6, 7)
    vi.advanceTimersByTime(300)
    stopSingAlong('blue', 60)
    const cut = singing()
    singAlong('blue')(note(60, 0.45), 0, 8)

    // Act: past the end the cut note would have had
    vi.advanceTimersByTime(1000)

    // Assert
    expect(cut).toBe(false)
    expect(singing()).toBe(true)
  })

  it('leaves no quiet behind a run cut short, with no replay after it', () => {
    // Arrange: the last note cut short 0.3 s in, then Merc set singing by hand
    singAlong('blue')(note(71, 1.2), 6, 7)
    vi.advanceTimersByTime(300)
    stopSingAlong('blue', 71)
    mercSing('blue', 64, true)

    // Act: past the end the cut note would have had
    vi.advanceTimersByTime(1000)

    // Assert
    expect(singing()).toBe(true)
  })
})
