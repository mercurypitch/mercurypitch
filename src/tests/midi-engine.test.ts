// ============================================================
// MIDI Engine Tests — Web MIDI API wrapper
// ============================================================

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MidiNoteEvent } from '@/lib/midi-engine'
import { MidiEngine } from '@/lib/midi-engine'

// ── Helpers ──────────────────────────────────────────────────

interface MockMidiMessage {
  data: Uint8Array
  timeStamp: number
}

interface MockPort {
  id: string
  name: string
  onmidimessage: ((msg: MockMidiMessage) => void) | null
}

function createMockInput(id: string, name: string): MockPort {
  return { id, name, onmidimessage: null }
}

function setupMockMidi(inputs: MockPort[] = []) {
  const mockAccess = {
    inputs: new Map(inputs.map((i) => [i.id, i as unknown as MIDIInput])),
    outputs: new Map(),
    onstatechange: null as (() => void) | null,
  }

  Object.defineProperty(navigator, 'requestMIDIAccess', {
    value: vi.fn().mockResolvedValue(mockAccess as unknown as MIDIAccess),
    writable: true,
    configurable: true,
  })
  return { mockAccess, inputs }
}

function sendMidi(input: MockPort, status: number, note: number, velocity: number) {
  input.onmidimessage?.({ data: new Uint8Array([status, note, velocity]), timeStamp: performance.now() })
}

// ── Tests ────────────────────────────────────────────────────

describe('MidiEngine', () => {
  let engine: MidiEngine

  beforeEach(() => {
    engine = new MidiEngine()
    vi.restoreAllMocks()
  })

  describe('connect', () => {
    it('returns true when MIDI inputs are found', async () => {
      const input = createMockInput('abc', 'My Keyboard')
      setupMockMidi([input])

      const result = await engine.connect()
      expect(result).toBe(true)
      expect(engine.isConnected()).toBe(true)
    })

    it('returns false when requestMIDIAccess throws', async () => {
      Object.defineProperty(navigator, 'requestMIDIAccess', {
        value: vi.fn().mockRejectedValue(new Error('Not supported')),
        writable: true,
        configurable: true,
      })

      const result = await engine.connect()
      expect(result).toBe(false)
      expect(engine.isConnected()).toBe(false)
    })

    it('returns false when no MIDI inputs exist', async () => {
      setupMockMidi([])

      const result = await engine.connect()
      expect(result).toBe(false)
      expect(engine.isConnected()).toBe(false)
    })
  })

  describe('disconnect', () => {
    it('clears all state and detaches listeners', async () => {
      const input = createMockInput('abc', 'Keyboard')
      setupMockMidi([input])

      await engine.connect()
      const heldNotes = engine.getHeldNotes()

      // Simulate a held note
      sendMidi(input, 0x90, 60, 100)
      expect(heldNotes.size).toBe(1)

      engine.disconnect()
      expect(engine.isConnected()).toBe(false)
      expect(heldNotes.size).toBe(0)
    })
  })

  describe('note-on parsing', () => {
    it('fires onNoteOn callback with correct MIDI data', async () => {
      const input = createMockInput('abc', 'KB')
      setupMockMidi([input])
      await engine.connect()

      const events: MidiNoteEvent[] = []
      engine.callbacks.onNoteOn = (e) => events.push(e)

      sendMidi(input, 0x90, 60, 100)
      expect(events.length).toBe(1)
      expect(events[0].midi).toBe(60)
      expect(events[0].velocity).toBe(100)
      expect(events[0].timestamp).toBeDefined()
    })

    it('adds the note to heldNotes', async () => {
      const input = createMockInput('abc', 'KB')
      setupMockMidi([input])
      await engine.connect()

      sendMidi(input, 0x90, 64, 80)
      const held = engine.getHeldNotes()
      expect(held.size).toBe(1)
      expect(held.get(64)?.velocity).toBe(80)
    })

    it('ignores note-on with velocity 0 (treated as note-off)', async () => {
      const input = createMockInput('abc', 'KB')
      setupMockMidi([input])
      await engine.connect()

      // First press a note
      sendMidi(input, 0x90, 60, 80)
      expect(engine.getHeldNotes().size).toBe(1)

      // Now "release" via velocity=0 note-on
      const noteOffEvents: MidiNoteEvent[] = []
      engine.callbacks.onNoteOff = (e) => noteOffEvents.push(e)

      sendMidi(input, 0x90, 60, 0)
      expect(noteOffEvents.length).toBe(1)
      expect(noteOffEvents[0].midi).toBe(60)
      expect(engine.getHeldNotes().size).toBe(0)
    })
  })

  describe('note-off parsing', () => {
    it('fires onNoteOff callback and removes from heldNotes', async () => {
      const input = createMockInput('abc', 'KB')
      setupMockMidi([input])
      await engine.connect()

      // Press a note first
      sendMidi(input, 0x90, 62, 100)
      expect(engine.getHeldNotes().size).toBe(1)

      // Release it
      const noteOffEvents: MidiNoteEvent[] = []
      engine.callbacks.onNoteOff = (e) => noteOffEvents.push(e)

      sendMidi(input, 0x80, 62, 64)
      expect(noteOffEvents.length).toBe(1)
      expect(noteOffEvents[0].midi).toBe(62)
      expect(engine.getHeldNotes().size).toBe(0)
    })
  })

  describe('multiple simultaneous notes', () => {
    it('tracks multiple held notes concurrently', async () => {
      const input = createMockInput('abc', 'KB')
      setupMockMidi([input])
      await engine.connect()

      sendMidi(input, 0x90, 60, 100)
      sendMidi(input, 0x90, 64, 90)
      sendMidi(input, 0x90, 67, 80)

      const held = engine.getHeldNotes()
      expect(held.size).toBe(3)
      expect(held.get(60)?.velocity).toBe(100)
      expect(held.get(64)?.velocity).toBe(90)
      expect(held.get(67)?.velocity).toBe(80)

      // Release middle note
      sendMidi(input, 0x80, 64, 0)
      expect(engine.getHeldNotes().size).toBe(2)
      expect(engine.getHeldNotes().has(64)).toBe(false)
    })

    it('fires onNoteOn for each press and onNoteOff for each release', async () => {
      const input = createMockInput('abc', 'KB')
      setupMockMidi([input])
      await engine.connect()

      const onEvents: MidiNoteEvent[] = []
      const offEvents: MidiNoteEvent[] = []
      engine.callbacks.onNoteOn = (e) => onEvents.push(e)
      engine.callbacks.onNoteOff = (e) => offEvents.push(e)

      sendMidi(input, 0x90, 60, 100)
      sendMidi(input, 0x90, 64, 100)
      sendMidi(input, 0x80, 60, 0)
      sendMidi(input, 0x80, 64, 0)

      expect(onEvents.length).toBe(2)
      expect(offEvents.length).toBe(2)
    })
  })

  describe('state change callback', () => {
    it('fires onStateChange when triggered by MIDI access', async () => {
      const input = createMockInput('abc', 'KB')
      const { mockAccess } = setupMockMidi([input])
      await engine.connect()

      const changes: boolean[] = []
      engine.callbacks.onStateChange = (c) => changes.push(c)

      mockAccess.inputs = new Map()
      mockAccess.onstatechange?.()

      expect(changes.length).toBe(1)
      expect(changes[0]).toBe(false) // no inputs left
    })
  })

  describe('getInputNames', () => {
    it('returns connected device names', async () => {
      const k1 = createMockInput('a', 'Piano')
      const k2 = createMockInput('b', 'Synth')
      setupMockMidi([k1, k2])
      await engine.connect()

      const names = engine.getInputNames()
      expect(names).toContain('Piano')
      expect(names).toContain('Synth')
    })
  })

  describe('ignored messages', () => {
    it('does not process messages that are not note-on/off', async () => {
      const input = createMockInput('abc', 'KB')
      setupMockMidi([input])
      await engine.connect()

      const onEvents: MidiNoteEvent[] = []
      const offEvents: MidiNoteEvent[] = []
      engine.callbacks.onNoteOn = (e) => onEvents.push(e)
      engine.callbacks.onNoteOff = (e) => offEvents.push(e)

      // Control change (0xB0)
      sendMidi(input, 0xB0, 64, 127)
      // Pitch bend (0xE0)
      sendMidi(input, 0xE0, 0, 64)

      expect(onEvents.length).toBe(0)
      expect(offEvents.length).toBe(0)
      expect(engine.getHeldNotes().size).toBe(0)
    })
  })
})
