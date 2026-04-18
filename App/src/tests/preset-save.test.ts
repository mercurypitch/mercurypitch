// ============================================================
// Preset Save/Load Tests
// ============================================================

import { beforeEach,describe, expect, it } from 'vitest'
import type {PresetData} from '@/stores/app-store';
import { _resetPresets, deletePreset, getPresetNames, initPresets, loadPreset, savePreset  } from '@/stores/app-store'
import { melodyStore as _melodyStore, setMelody } from '@/stores/melody-store'

function makeNote(midi: number, startBeat: number, duration: number) {
  return {
    id: Math.floor(Math.random() * 99999),
    note: { name: 'C' as const, octave: 4, midi, freq: 261.63 },
    startBeat,
    duration,
  }
}

describe('Preset Save and Load', () => {
  beforeEach(() => {
    localStorage.removeItem('pitchperfect_presets')
    localStorage.removeItem('pitchperfect_lastpreset')
    localStorage.removeItem('pitchperfect_selected_preset')
    _resetPresets()
    initPresets()
  })

  describe('savePreset', () => {
    it('saves notes to localStorage', () => {
      const data: PresetData = {
        notes: [
          { midi: 60, startBeat: 0, duration: 1 },
          { midi: 64, startBeat: 1, duration: 1 },
          { midi: 67, startBeat: 2, duration: 1 },
        ],
        totalBeats: 4,
        bpm: 120,
        scale: [],
      }
      savePreset('Test Preset', data)

      const stored = localStorage.getItem('pitchperfect_presets')
      expect(stored).not.toBeNull()
      const parsed = JSON.parse(stored!)
      expect(parsed['Test Preset']).toBeDefined()
      expect(parsed['Test Preset'].notes).toHaveLength(3)
      expect(parsed['Test Preset'].notes[0].midi).toBe(60)
      expect(parsed['Test Preset'].notes[1].midi).toBe(64)
      expect(parsed['Test Preset'].notes[2].midi).toBe(67)
    })

    it('saves empty notes array', () => {
      const data: PresetData = {
        notes: [],
        totalBeats: 16,
        bpm: 100,
        scale: [],
      }
      savePreset('Empty Preset', data)

      const stored = localStorage.getItem('pitchperfect_presets')
      const parsed = JSON.parse(stored!)
      expect(parsed['Empty Preset'].notes).toHaveLength(0)
    })

    it('saves bpm and totalBeats', () => {
      const data: PresetData = {
        notes: [{ midi: 60, startBeat: 0, duration: 2 }],
        totalBeats: 8, // stored value is used as-is (caller computes)
        bpm: 140,
        scale: [],
      }
      savePreset('Tempo Test', data)

      const stored = localStorage.getItem('pitchperfect_presets')
      const parsed = JSON.parse(stored!)
      expect(parsed['Tempo Test'].totalBeats).toBe(8) // exact value passed is stored
      expect(parsed['Tempo Test'].bpm).toBe(140)
    })

    it('saves effectType and linkedTo', () => {
      const data: PresetData = {
        notes: [
          {
            midi: 60,
            startBeat: 0,
            duration: 1,
            effectType: 'vibrato',
            linkedTo: [1],
          },
          { midi: 64, startBeat: 1, duration: 1 },
        ],
        totalBeats: 2,
        bpm: 120,
        scale: [],
      }
      savePreset('Effect Test', data)

      const stored = localStorage.getItem('pitchperfect_presets')
      const parsed = JSON.parse(stored!)
      expect(parsed['Effect Test'].notes[0].effectType).toBe('vibrato')
      expect(parsed['Effect Test'].notes[0].linkedTo).toEqual([1])
    })

    it('overwrites an existing preset with the same name', () => {
      const data1: PresetData = {
        notes: [{ midi: 60, startBeat: 0, duration: 1 }],
        totalBeats: 1,
        bpm: 120,
        scale: [],
      }
      savePreset('Overwrite Me', data1)

      const data2: PresetData = {
        notes: [
          { midi: 72, startBeat: 0, duration: 2 },
          { midi: 74, startBeat: 2, duration: 1 },
        ],
        totalBeats: 3,
        bpm: 80,
        scale: [],
      }
      savePreset('Overwrite Me', data2)

      const stored = localStorage.getItem('pitchperfect_presets')
      const parsed = JSON.parse(stored!)
      expect(Object.keys(parsed)).toHaveLength(1)
      expect(parsed['Overwrite Me'].notes).toHaveLength(2)
      expect(parsed['Overwrite Me'].notes[0].midi).toBe(72)
      expect(parsed['Overwrite Me'].bpm).toBe(80)
    })
  })

  describe('loadPreset', () => {
    it('loads a saved preset from localStorage', () => {
      const data: PresetData = {
        notes: [
          { midi: 60, startBeat: 0, duration: 1 },
          { midi: 62, startBeat: 1, duration: 0.5 },
        ],
        totalBeats: 2,
        bpm: 100,
        scale: [{ midi: 60, name: 'C', octave: 4, freq: 261.63 }],
      }
      savePreset('Load Test', data)

      // Re-init to simulate fresh load
      localStorage.removeItem('pitchperfect_presets')
      initPresets()
      // Manually set to simulate the stored data
      const stored = JSON.stringify({ 'Load Test': data })
      localStorage.setItem('pitchperfect_presets', stored)
      initPresets()

      const loaded = loadPreset('Load Test')
      expect(loaded).not.toBeNull()
      expect(loaded!.notes).toHaveLength(2)
      expect(loaded!.notes[0].midi).toBe(60)
      expect(loaded!.notes[1].midi).toBe(62)
      expect(loaded!.bpm).toBe(100)
    })

    it('returns null for a preset that does not exist', () => {
      const result = loadPreset('Non Existent')
      expect(result).toBeNull()
    })
  })

  describe('getPresetNames', () => {
    it('returns sorted list of preset names', () => {
      savePreset('Zebra Preset', {
        notes: [],
        totalBeats: 1,
        bpm: 120,
        scale: [],
      })
      savePreset('Apple Preset', {
        notes: [],
        totalBeats: 1,
        bpm: 120,
        scale: [],
      })
      savePreset('Melon Preset', {
        notes: [],
        totalBeats: 1,
        bpm: 120,
        scale: [],
      })

      const names = getPresetNames()
      expect(names).toEqual(['Apple Preset', 'Melon Preset', 'Zebra Preset'])
    })
  })

  describe('deletePreset', () => {
    it('removes a preset from localStorage', () => {
      savePreset('To Delete', {
        notes: [{ midi: 60, startBeat: 0, duration: 1 }],
        totalBeats: 1,
        bpm: 120,
        scale: [],
      })
      expect(loadPreset('To Delete')).not.toBeNull()

      deletePreset('To Delete')
      expect(loadPreset('To Delete')).toBeNull()
    })
  })

  describe('round-trip', () => {
    it('saves melody items via melodyStore and loads them back', () => {
      // This simulates the actual PresetSelector.handleSave flow
      const melody = [
        makeNote(60, 0, 1),
        makeNote(64, 1, 1),
        makeNote(67, 2, 1),
        makeNote(72, 3, 0.5),
      ]
      setMelody(melody)

      const totalBeats = Math.max(
        ...melody.map((n) => n.startBeat + n.duration),
      )
      const data: PresetData = {
        notes: melody.map((n) => ({
          midi: n.note.midi,
          startBeat: n.startBeat,
          duration: n.duration,
          effectType: (n as { effectType?: string }).effectType,
          linkedTo: (n as { linkedTo?: number[] }).linkedTo,
        })),
        totalBeats,
        bpm: 120,
        scale: [],
      }

      savePreset('Round Trip Test', data)

      // Simulate fresh load
      localStorage.removeItem('pitchperfect_presets')
      const stored = JSON.stringify({ 'Round Trip Test': data })
      localStorage.setItem('pitchperfect_presets', stored)
      initPresets()

      const loaded = loadPreset('Round Trip Test')
      expect(loaded).not.toBeNull()
      expect(loaded!.notes).toHaveLength(4)
      expect(loaded!.notes[0].midi).toBe(60)
      expect(loaded!.notes[1].midi).toBe(64)
      expect(loaded!.notes[2].midi).toBe(67)
      expect(loaded!.notes[3].midi).toBe(72)
      expect(loaded!.totalBeats).toBeCloseTo(3.5, 1)
    })
  })
})
