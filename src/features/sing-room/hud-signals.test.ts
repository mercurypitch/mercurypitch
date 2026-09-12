import { describe, expect, it } from 'vitest'
import { midiToFreq, scaleDegreeSet } from '@/lib/scale-data'
import type { PitchResult } from '@/types'
import { centsToNearestScaleNote, formatCents, keyChipLabel, noteChipSignal, stateChipLabel, } from './hud-signals'

function pitch(overrides: Partial<PitchResult> = {}): PitchResult {
  return {
    freq: 220,
    midi: 57,
    note: 'A3',
    noteName: 'A',
    targetMidi: 0,
    targetNote: '',
    cents: 2,
    frequency: 220,
    clarity: 0.9,
    octave: 3,
    ...overrides,
  }
}

describe('the note chip', () => {
  it('reads the mock’s own chip: A3, +2 cents, in tune', () => {
    const signal = noteChipSignal(pitch())
    expect(signal.note).toBe('A')
    expect(signal.octave).toBe('3')
    expect(signal.cents).toBe('+2 cents')
    expect(signal.variant).toBe('in')
  })

  it('goes flat below the note and sharp above it', () => {
    expect(noteChipSignal(pitch({ cents: -40 })).variant).toBe('flat')
    expect(noteChipSignal(pitch({ cents: 40 })).variant).toBe('sharp')
  })

  it('is quiet when nothing is heard, and says so rather than lying', () => {
    expect(noteChipSignal(null).variant).toBe('quiet')
    expect(noteChipSignal(pitch({ frequency: 0 })).variant).toBe('quiet')
    expect(noteChipSignal(null).cents).toBe('No voice')
  })

  it('announces the note in words, not in punctuation', () => {
    expect(noteChipSignal(pitch({ cents: -40 })).announce).toBe(
      'A3, 40 cents flat',
    )
    expect(noteChipSignal(pitch()).announce).toBe('A3, in tune')
  })

  it('always signs the cents, zero included', () => {
    expect(formatCents(0)).toBe('0 cents')
    expect(formatCents(2.4)).toBe('+2 cents')
    expect(formatCents(-2.4)).toBe('-2 cents')
  })
})

describe('the key and state chips', () => {
  it('says the key the way the mock does', () => {
    expect(keyChipLabel('C', 'major')).toBe('C major')
    expect(keyChipLabel('A', 'natural-minor')).toBe('A natural minor')
  })

  it('has one word for each state, and no percentage anywhere', () => {
    expect(stateChipLabel('listening')).toBe('Listening')
    expect(stateChipLabel('paused')).toBe('Paused')
    expect(stateChipLabel('muted')).toBe('Mic off')
    expect(stateChipLabel('off')).toBe('Mic off')
  })
})

describe('centsToNearestScaleNote', () => {
  const cMajor = scaleDegreeSet('C', 'major')

  it('measures against a note of the key, not the nearest chromatic one', () => {
    // C#4 is 1 semitone above C4 and is not in C major, so the nearest
    // in-key note is C4 — a hundred cents away, not zero.
    const answer = centsToNearestScaleNote(midiToFreq(61), cMajor)
    expect(answer?.midi).toBe(60)
    expect(Math.round(answer!.cents)).toBe(100)
  })

  it('is zero when dead on a scale note', () => {
    const answer = centsToNearestScaleNote(midiToFreq(67), cMajor)
    expect(answer?.midi).toBe(67)
    expect(Math.round(answer!.cents)).toBe(0)
  })

  it('signs the deviation the way the chip does', () => {
    const sharp = centsToNearestScaleNote(midiToFreq(69) * 1.01, cMajor)
    expect(sharp!.cents).toBeGreaterThan(0)
    const flat = centsToNearestScaleNote(midiToFreq(69) * 0.99, cMajor)
    expect(flat!.cents).toBeLessThan(0)
  })

  it('answers null for silence, so "no voice" is not "dead on"', () => {
    expect(centsToNearestScaleNote(0, cMajor)).toBeNull()
    expect(centsToNearestScaleNote(220, new Set())).toBeNull()
  })
})
