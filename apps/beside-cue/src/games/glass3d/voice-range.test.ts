import { beforeEach, describe, expect, it } from 'vitest'
import { CHAMBERS } from './levels/chambers'
import { modeMidi, rangeSlackSemis, tuneChamber } from './sim/chamber3d'
import { canShift, centreOf, DEFAULT_CENTRE_MIDI, MAX_CENTRE_MIDI, MIN_CENTRE_MIDI, presetAt, readMeasuredRange, readVoiceCentre, shiftOctaves, VOICE_PRESETS, voiceCentre, writeVoiceCentre, } from './voice-range'

// jsdom here exposes a `localStorage` with no Storage methods at all, so
// remembering anything is what has to be supplied. Worth noting the module
// survives that on its own -- every read is wrapped -- which is the
// "storage is denied" case below.
const entries = new Map<string, string>()
beforeEach(() => {
  entries.clear()
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => entries.get(key) ?? null,
      setItem: (key: string, value: string) => void entries.set(key, value),
      removeItem: (key: string) => void entries.delete(key),
    },
  })
})

describe('where the voice sits', () => {
  it('falls back to G4 only when nothing else is known', () => {
    expect(voiceCentre()).toBe(DEFAULT_CENTRE_MIDI)
  })

  it('prefers the measured range over the fallback', () => {
    window.localStorage.setItem(
      'beside-cue:games:vocal-range',
      JSON.stringify({ loMidi: 45, hiMidi: 65, biasSemis: 0, comfyMidi: 55 }),
    )
    expect(voiceCentre()).toBe(55)
  })

  it('prefers an explicit choice over the measured range', () => {
    window.localStorage.setItem(
      'beside-cue:games:vocal-range',
      JSON.stringify({ loMidi: 60, hiMidi: 80, biasSemis: 0, comfyMidi: 70 }),
    )
    writeVoiceCentre(52)
    expect(voiceCentre()).toBe(52)
  })

  it('ignores a measurement that makes no sense', () => {
    window.localStorage.setItem(
      'beside-cue:games:vocal-range',
      JSON.stringify({ loMidi: 70, hiMidi: 50 }),
    )
    expect(readMeasuredRange()).toBeNull()
    window.localStorage.setItem('beside-cue:games:vocal-range', 'not json')
    expect(readMeasuredRange()).toBeNull()
    expect(voiceCentre()).toBe(DEFAULT_CENTRE_MIDI)
  })

  it('survives storage being denied', () => {
    const real = window.localStorage.getItem
    window.localStorage.getItem = () => {
      throw new Error('denied')
    }
    expect(readVoiceCentre()).toBeNull()
    expect(voiceCentre()).toBe(DEFAULT_CENTRE_MIDI)
    window.localStorage.getItem = real
  })
})

describe('moving it', () => {
  it('moves by whole octaves', () => {
    expect(shiftOctaves(60, -1)).toBe(48)
    expect(shiftOctaves(60, 1)).toBe(72)
  })

  // A stuck button must not be able to leave the room inaudible.
  it('will not leave the singable band', () => {
    expect(shiftOctaves(40, -1)).toBe(MIN_CENTRE_MIDI)
    expect(shiftOctaves(80, 1)).toBe(MAX_CENTRE_MIDI)
    expect(canShift(MIN_CENTRE_MIDI, -1)).toBe(false)
    expect(canShift(MAX_CENTRE_MIDI, 1)).toBe(false)
    expect(canShift(60, -1)).toBe(true)
  })

  it('clamps what it stores, not just what it returns', () => {
    expect(writeVoiceCentre(200)).toBe(MAX_CENTRE_MIDI)
    expect(readVoiceCentre()).toBe(MAX_CENTRE_MIDI)
  })
})

describe('the voice presets', () => {
  it('run low to high without gaps in the ladder', () => {
    const centres = VOICE_PRESETS.map(centreOf)
    expect(centres).toEqual([...centres].sort((a, b) => a - b))
    expect(new Set(centres).size).toBe(centres.length)
  })

  it('lands every centre on a whole semitone', () => {
    for (const preset of VOICE_PRESETS) {
      expect(Number.isInteger(centreOf(preset))).toBe(true)
    }
  })

  // The bug this whole module exists for: the old default sat between
  // alto and soprano, so every lower voice was asked to reach.
  it('shows G4 for what it was -- a high voice, assumed of everyone', () => {
    const alto = VOICE_PRESETS.find((p) => p.id === 'alto')!
    const soprano = VOICE_PRESETS.find((p) => p.id === 'soprano')!
    expect(DEFAULT_CENTRE_MIDI).toBeGreaterThan(centreOf(alto))
    expect(DEFAULT_CENTRE_MIDI).toBeLessThan(centreOf(soprano))
    const bass = VOICE_PRESETS.find((p) => p.id === 'bass')!
    // Fifteen semitones above where a bass sits: not a hard note, an
    // impossible one.
    expect(DEFAULT_CENTRE_MIDI - centreOf(bass)).toBeGreaterThan(12)
  })

  it('lights the button that was pressed, and none when it was measured', () => {
    const bass = VOICE_PRESETS.find((p) => p.id === 'bass')!
    expect(presetAt(centreOf(bass))?.id).toBe('bass')
    expect(presetAt(centreOf(bass) + 1)).toBeNull()
  })
})

// The point of transposing at all: every room has to be singable by
// every voice, and the ratios say it can be.
describe('every chamber, for every voice', () => {
  it.each(
    VOICE_PRESETS.flatMap((preset) =>
      CHAMBERS.map((room) => [preset.label, room.id, preset, room] as const),
    ),
  )('%s can sing %s', (_voice, _room, preset, room) => {
    const centre = centreOf(preset)
    const f0 = tuneChamber(room.modes, null, centre)
    for (const mode of room.modes) {
      const midi = modeMidi(f0, mode)
      expect(midi).toBeGreaterThanOrEqual(preset.lowMidi)
      expect(midi).toBeLessThanOrEqual(preset.highMidi)
    }
    // And with room left over, rather than exactly filling the voice.
    expect(
      rangeSlackSemis(room.modes, {
        lowMidi: preset.lowMidi,
        highMidi: preset.highMidi,
      }),
    ).toBeGreaterThan(6)
  })

  // What maff hit: the untuned default is a room a bass cannot sing.
  it('is a room a bass cannot sing at the old default', () => {
    const bass = VOICE_PRESETS.find((p) => p.id === 'bass')!
    const room = CHAMBERS[0]!
    const f0 = tuneChamber(room.modes, null, DEFAULT_CENTRE_MIDI)
    const highest = Math.max(...room.modes.map((m) => modeMidi(f0, m)))
    expect(highest).toBeGreaterThan(bass.highMidi - 12)
  })
})
