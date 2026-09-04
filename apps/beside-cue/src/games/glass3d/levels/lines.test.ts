// Can every room be finished, by every voice?
// ============================================================

import { describe, expect, it } from 'vitest'
import { bandFor, inBand, restTFor, slotHeightFor, workingRange, } from '../sim/tension3d'
import { VOICE_PRESETS } from '../voice-range'
import { LINES, PLATE_STANDOFF } from './lines'

describe('the rooms', () => {
  it('have distinct ids and a sentence each', () => {
    const ids = LINES.map((l) => l.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const room of LINES) expect(room.teaches.length).toBeGreaterThan(8)
  })

  it('put the start before every gate and every gate before the exit', () => {
    for (const room of LINES) {
      for (const gate of room.gates) {
        expect(gate.x).toBeGreaterThan(room.startX + PLATE_STANDOFF)
        expect(gate.x).toBeLessThan(room.exitX)
      }
      expect(room.exitX).toBeLessThan(room.length)
    }
  })

  // §4's promise: the letterbox admits at least four semitones for every
  // voice, and the resting drop never fits it.
  it('give every preset a slot it can reach and cannot rest through', () => {
    for (const preset of VOICE_PRESETS) {
      const range = workingRange(preset)
      const span = range.highMidi - range.lowMidi
      for (const room of LINES) {
        for (const gate of room.gates) {
          const band = bandFor(gate.gate, range)
          expect(
            (band.hi - band.lo) * span,
            `${preset.id} ${room.id}`,
          ).toBeGreaterThanOrEqual(3.5)
          expect(inBand(restTFor(), band)).toBe(false)
          // A torso, not a whole box: 0.376 to 0.434 across the presets.
          expect(slotHeightFor(band)).toBeGreaterThan(0.3)
          expect(slotHeightFor(band)).toBeLessThan(0.5)
        }
      }
    }
  })

  it('hides the jump where there is nothing to jump onto', () => {
    expect(LINES[0]!.jump).toBe(false)
  })
})
