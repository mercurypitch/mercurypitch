import { describe, expect, it } from 'vitest'
import type { LivePitchPipeline } from './live-pitch-pipeline'
import { createLivePitchPipeline } from './live-pitch-pipeline'
import { midiFloatToFreq } from './log-pitch'
import type { CompletedNote } from './types'

interface Frame {
  midi: number | null
}

/** Feed frames at 100 fps (bpm 120 => 0.02 beats/frame); collect committed notes. */
function feed(pipe: LivePitchPipeline, frames: Frame[]): CompletedNote[] {
  const completed: CompletedNote[] = []
  frames.forEach((f, i) => {
    const freq = f.midi === null ? null : midiFloatToFreq(f.midi)
    const clarity = f.midi === null ? 0 : 0.9
    const res = pipe.push(freq, clarity, i * 0.01, i * 0.02)
    completed.push(...res.completed)
  })
  return completed
}

const hold = (midi: number | null, n: number): Frame[] =>
  Array.from({ length: n }, () => ({ midi }))

describe('createLivePitchPipeline', () => {
  it('THE headline fix: octave spikes + garbage never become notes (C3 -> D3, not C3->C4->C5->D3)', () => {
    const pipe = createLivePitchPipeline()
    const frames: Frame[] = hold(48, 40) // C3 sustained
    frames[15] = { midi: 60 } // single-frame C4 spike (octave up)
    frames[25] = { midi: 72 } // single-frame C5 spike (two octaves up)
    frames[30] = { midi: 36 } // single-frame C2 spike (octave down)
    frames.push(...hold(50, 40)) // D3 sustained
    frames.push(...hold(null, 12)) // trailing silence closes the last note

    const notes = feed(pipe, frames)
    expect(notes.map((n) => n.midi)).toEqual([48, 50])
  })

  it('segments a clean two-note phrase into exactly two notes', () => {
    const pipe = createLivePitchPipeline()
    const notes = feed(pipe, [
      ...hold(48, 30),
      ...hold(50, 30),
      ...hold(null, 12),
    ])
    expect(notes.map((n) => n.midi)).toEqual([48, 50])
  })

  it('treats a natural vibrato wobble as a single note', () => {
    const pipe = createLivePitchPipeline()
    const vib: Frame[] = Array.from({ length: 60 }, (_, i) => ({
      midi: 57 + 0.5 * Math.sin((2 * Math.PI * i) / 20), // +/-0.5 st at ~5 Hz
    }))
    const notes = feed(pipe, [...vib, ...hold(null, 12)])
    expect(notes.map((n) => n.midi)).toEqual([57])
  })

  it('preserves a genuine, sustained octave leap', () => {
    const pipe = createLivePitchPipeline()
    const notes = feed(pipe, [
      ...hold(48, 40),
      ...hold(60, 40),
      ...hold(null, 12),
    ])
    expect(notes.map((n) => n.midi)).toEqual([48, 60])
  })

  it('flush commits the final open note on stop', () => {
    const pipe = createLivePitchPipeline()
    feed(pipe, hold(55, 30))
    const flushed = pipe.flush(2.0)
    expect(flushed.length).toBe(1)
    expect(flushed[0].midi).toBe(55)
  })

  it('exposes a smoothed needle while voiced and null when silent', () => {
    const pipe = createLivePitchPipeline()
    let lastVoiced = pipe.push(midiFloatToFreq(57), 0.9, 0, 0)
    for (let i = 1; i < 10; i++) {
      lastVoiced = pipe.push(midiFloatToFreq(57), 0.9, i * 0.01, i * 0.02)
    }
    expect(lastVoiced.smoothedMidi).toBeCloseTo(57, 1)
    const silent = pipe.push(null, 0, 0.2, 0.4)
    expect(silent.smoothedMidi).toBeNull()
  })

  it('drops low-clarity frames (does not create notes from noise)', () => {
    const pipe = createLivePitchPipeline()
    const completed: CompletedNote[] = []
    for (let i = 0; i < 40; i++) {
      const res = pipe.push(midiFloatToFreq(60), 0.1, i * 0.01, i * 0.02)
      completed.push(...res.completed)
    }
    completed.push(...pipe.flush(1))
    expect(completed).toEqual([])
  })
})
