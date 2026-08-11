// MIDI adapter tests cover selected-port ownership, releases, and clock truth.
// ============================================================

import { describe, expect, it, vi } from 'vitest'
import type { GuitarMidiAccessLike, GuitarMidiHost, GuitarMidiInputPortLike, GuitarMidiMessageLike, } from './guitar-midi-input'
import { GuitarMidiInputAdapter, mapMidiTimestampToAudioClock, parseGuitarMidiNote, } from './guitar-midi-input'

function port(id: string, name: string): GuitarMidiInputPortLike {
  return { id, name, state: 'connected', onmidimessage: null }
}

function host(inputs: GuitarMidiInputPortLike[]): {
  access: GuitarMidiAccessLike
  host: GuitarMidiHost
} {
  const access: GuitarMidiAccessLike = {
    inputs: new Map(inputs.map((input) => [input.id, input])),
    onstatechange: null,
  }
  return {
    access,
    host: {
      requestAccess: async () => access,
      performanceNow: () => 2_000,
    },
  }
}

function message(data: number[], timeStamp = 1_990): GuitarMidiMessageLike {
  return { data: Uint8Array.from(data), timeStamp }
}

describe('parseGuitarMidiNote', () => {
  it('treats velocity-zero note-on as a release with a stable voice id', () => {
    const parsed = parseGuitarMidiNote(
      message([0x92, 64, 0]),
      { id: 'guitar-midi', label: 'Guitar MIDI' },
      2_000,
    )
    expect(parsed).toMatchObject({
      kind: 'release',
      midi: 64,
      channel: 2,
      inputId: 'guitar-midi',
      voiceId: 'guitar-midi:2:64',
    })
  })

  it('ignores unrelated and malformed MIDI messages', () => {
    expect(
      parseGuitarMidiNote(
        message([0xb0, 7, 100]),
        { id: 'midi', label: 'MIDI' },
        2_000,
      ),
    ).toBeNull()
    expect(
      parseGuitarMidiNote(
        message([0x90, 200, 100]),
        { id: 'midi', label: 'MIDI' },
        2_000,
      ),
    ).toBeNull()
  })
})

describe('mapMidiTimestampToAudioClock', () => {
  it('maps the event timestamp onto the observed AudioContext clock', () => {
    expect(mapMidiTimestampToAudioClock(1_990, 2_000, 12)).toEqual({
      capturedAtSeconds: 11.99,
      eventTimestampMs: 1_990,
      observedPerformanceMs: 2_000,
    })
  })

  it('does not invent negative audio time from an old timestamp', () => {
    expect(mapMidiTimestampToAudioClock(0, 2_000, 0.1).capturedAtSeconds).toBe(
      0,
    )
  })
})

describe('GuitarMidiInputAdapter', () => {
  it('listens to only the selected port and emits note release', async () => {
    const first = port('one', 'First')
    const second = port('two', 'Second')
    const harness = host([first, second])
    const notes = vi.fn()
    const adapter = new GuitarMidiInputAdapter({
      host: harness.host,
      onNote: notes,
    })

    await adapter.connect()
    expect(adapter.selectedPortId()).toBe('one')
    expect(first.onmidimessage).not.toBeNull()
    expect(second.onmidimessage).toBeNull()

    expect(adapter.selectPort('two')).toBe(true)
    expect(first.onmidimessage).toBeNull()
    second.onmidimessage?.(message([0x90, 67, 110]))
    second.onmidimessage?.(message([0x80, 67, 20]))

    expect(notes).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ kind: 'attack', midi: 67, inputId: 'two' }),
    )
    expect(notes).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ kind: 'release', midi: 67, inputId: 'two' }),
    )
  })

  it('reports a selected port as unavailable instead of silently switching', async () => {
    const selected = port('selected', 'Selected')
    const fallback = port('fallback', 'Fallback')
    const harness = host([selected, fallback])
    const portsChanged = vi.fn()
    const adapter = new GuitarMidiInputAdapter({
      host: harness.host,
      onNote: vi.fn(),
      onPortsChanged: portsChanged,
    })

    await adapter.connect()
    adapter.selectPort('selected')
    selected.state = 'disconnected'
    harness.access.onstatechange?.()

    expect(adapter.selectedPortId()).toBeNull()
    expect(fallback.onmidimessage).toBeNull()
    expect(portsChanged).toHaveBeenLastCalledWith(
      [{ id: 'fallback', label: 'Fallback' }],
      null,
    )
  })

  it('detaches handlers on disconnect', async () => {
    const input = port('one', 'First')
    const harness = host([input])
    const adapter = new GuitarMidiInputAdapter({
      host: harness.host,
      onNote: vi.fn(),
    })
    await adapter.connect()

    adapter.disconnect()

    expect(input.onmidimessage).toBeNull()
    expect(harness.access.onstatechange).toBeNull()
  })
})
