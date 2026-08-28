import { describe, expect, it } from 'vitest'
import type { F0Frame } from '@/lib/pitch-measurements'
import { noteWindows, scorePhrase } from './phrase-score'

const midiToFreq = (midi: number) => 440 * 2 ** ((midi - 69) / 12)

/** Frames every 10 ms across a window, at one pitch. */
function sing(
  window: { startS: number; endS: number },
  midi: number,
  conf = 0.9,
): F0Frame[] {
  const frames: F0Frame[] = []
  for (let t = window.startS; t <= window.endS; t += 0.01) {
    frames.push({ t, f0: midiToFreq(midi), conf })
  }
  return frames
}

describe('phrase-score', () => {
  const windows = noteWindows(3, 400, 100, 200)

  it('lays the windows on the grid the phrase was played on', () => {
    expect(windows).toEqual([
      { startS: 0.2, endS: 0.6 },
      { startS: 0.7, endS: 1.1 },
      { startS: 1.2, endS: 1.6 },
    ])
  })

  it('meets a phrase sung in tune, any octave', () => {
    const frames = [
      ...sing(windows[0], 60),
      ...sing(windows[1], 62 + 12),
      ...sing(windows[2], 64 - 12),
    ]
    const score = scorePhrase(frames, 60, [1, 2, 3], windows)
    expect(score.correct).toBe(true)
    expect(score.firstMiss).toBeNull()
    expect(score.voicedNotes).toBe(3)
    expect(score.notes.map((n) => n.centsOff)).toEqual([0, 0, 0])
  })

  it('names the first slip, and reads a note 30 cents sharp as met but off', () => {
    const frames = [
      ...sing(windows[0], 60.3),
      ...sing(windows[1], 65),
      ...sing(windows[2], 64),
    ]
    const score = scorePhrase(frames, 60, [1, 2, 3], windows)
    expect(score.notes[0].met).toBe(true)
    expect(score.notes[0].centsOff).toBe(30)
    expect(score.notes[1].met).toBe(false)
    expect(score.notes[1].centsOff).toBe(300)
    expect(score.firstMiss).toBe(1)
    expect(score.correct).toBe(false)
  })

  it('treats silence or unconfident voicing in a window as a miss, not a crash', () => {
    const frames = [...sing(windows[0], 60), ...sing(windows[1], 62, 0.2)]
    const score = scorePhrase(frames, 60, [1, 2, 3], windows)
    expect(score.notes[1].sungMidi).toBeNull()
    expect(score.notes[2].sungMidi).toBeNull()
    expect(score.voicedNotes).toBe(1)
    expect(score.firstMiss).toBe(1)
  })

  it('ignores the scoop at the start of a window', () => {
    const w = windows[0]
    const scoop: F0Frame[] = []
    for (let t = w.startS; t < w.startS + 0.1; t += 0.01) {
      scoop.push({ t, f0: midiToFreq(57), conf: 0.9 })
    }
    const held = sing({ startS: w.startS + 0.12, endS: w.endS }, 60)
    const score = scorePhrase([...scoop, ...held], 60, [1], [w])
    expect(score.notes[0].centsOff).toBe(0)
    expect(score.correct).toBe(true)
  })
})
