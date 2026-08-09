// ============================================================
// Web MIDI input port tests — permission, selection, and hotplug
// ============================================================

import { describe, expect, it, vi } from 'vitest'
import type { PianoInputEvent } from './piano-input-state'
import { createWebMidiInputPort } from './web-midi-input-port'

interface MockMidiInput {
  id: string
  name: string
  manufacturer: string | null
  state: MIDIPortDeviceState
  connection: MIDIPortConnectionState
  onmidimessage: ((event: MIDIMessageEvent) => void) | null
}

interface MockMidiAccess {
  inputs: Map<string, MIDIInput>
  outputs: Map<string, MIDIOutput>
  onstatechange: ((event: MIDIConnectionEvent) => void) | null
}

function createInput(id: string, name: string): MockMidiInput {
  return {
    id,
    name,
    manufacturer: 'Mercury Test',
    state: 'connected',
    connection: 'open',
    onmidimessage: null,
  }
}

function createAccess(inputs: MockMidiInput[]): MockMidiAccess {
  return {
    inputs: new Map(
      inputs.map((input) => [input.id, input as unknown as MIDIInput]),
    ),
    outputs: new Map(),
    onstatechange: null,
  }
}

function send(
  input: MockMidiInput,
  bytes: readonly number[],
  timestampMs = 100,
): void {
  input.onmidimessage?.({
    data: new Uint8Array(bytes),
    timeStamp: timestampMs,
  } as MIDIMessageEvent)
}

function stateChange(access: MockMidiAccess): void {
  access.onstatechange?.({} as MIDIConnectionEvent)
}

describe('createWebMidiInputPort', () => {
  it('requests permission lazily and auto-selects only after connect', async () => {
    const keyboard = createInput('a', 'Stage Keyboard')
    const access = createAccess([keyboard])
    const requestMIDIAccess = vi
      .fn()
      .mockResolvedValue(access as unknown as MIDIAccess)
    const onInput = vi.fn<(event: PianoInputEvent) => void>()
    const port = createWebMidiInputPort({ onInput, requestMIDIAccess })

    expect(requestMIDIAccess).not.toHaveBeenCalled()
    expect(port.snapshot()).toMatchObject({
      permission: 'idle',
      devices: [],
      selectedInputId: null,
      connected: false,
    })

    await expect(port.connect()).resolves.toBe(true)
    expect(requestMIDIAccess).toHaveBeenCalledTimes(1)
    expect(port.snapshot()).toMatchObject({
      permission: 'granted',
      selectedInputId: 'a',
      connected: true,
    })
    expect(port.snapshot().devices).toEqual([
      {
        id: 'a',
        name: 'Stage Keyboard',
        manufacturer: 'Mercury Test',
        state: 'connected',
        connection: 'open',
      },
    ])
    expect(keyboard.onmidimessage).not.toBeNull()
  })

  it('routes notes, channels, velocity, pedals, and safety controllers', async () => {
    const keyboard = createInput('a', 'Stage Keyboard')
    const access = createAccess([keyboard])
    const events: PianoInputEvent[] = []
    const port = createWebMidiInputPort({
      onInput: (event) => events.push(event),
      requestMIDIAccess: async () => access as unknown as MIDIAccess,
    })
    await port.connect()

    send(keyboard, [0x92, 60, 100], 10)
    send(keyboard, [0x92, 60, 0], 20)
    send(keyboard, [0xb2, 64, 127], 30)
    send(keyboard, [0xb2, 66, 80], 40)
    send(keyboard, [0xb2, 67, 32], 50)
    send(keyboard, [0xb2, 123, 0], 60)
    send(keyboard, [0xb2, 121, 0], 70)
    send(keyboard, [0xb2, 120, 0], 80)

    expect(events.map((event) => event.type)).toEqual([
      'note-on',
      'note-off',
      'pedal',
      'pedal',
      'pedal',
      'all-notes-off',
      'reset-controllers',
      'panic',
    ])
    expect(events[0]).toMatchObject({
      source: { kind: 'midi', id: 'a', name: 'Stage Keyboard' },
      channel: 2,
      midi: 60,
      velocity: 100 / 127,
      timestampMs: 10,
    })
    expect(events.slice(2, 5)).toMatchObject([
      { pedal: 'sustain', value: 1 },
      { pedal: 'sostenuto', value: 80 / 127 },
      { pedal: 'soft', value: 32 / 127 },
    ])
  })

  it('routes only the selected device and cleans up before switching', async () => {
    const first = createInput('a', 'First')
    const second = createInput('b', 'Second')
    const access = createAccess([first, second])
    const events: PianoInputEvent[] = []
    const port = createWebMidiInputPort({
      onInput: (event) => events.push(event),
      requestMIDIAccess: async () => access as unknown as MIDIAccess,
    })
    await port.connect()

    expect(first.onmidimessage).not.toBeNull()
    expect(second.onmidimessage).toBeNull()
    send(first, [0x90, 60, 100])
    send(second, [0x90, 64, 100])
    expect(events).toHaveLength(1)

    expect(port.selectInput('b')).toBe(true)
    expect(first.onmidimessage).toBeNull()
    expect(second.onmidimessage).not.toBeNull()
    expect(events[1]).toMatchObject({
      type: 'source-disconnected',
      source: { id: 'a' },
    })

    send(first, [0x90, 67, 100])
    send(second, [0x90, 69, 100])
    expect(events.at(-1)).toMatchObject({ type: 'note-on', midi: 69 })
    expect(port.selectInput('missing')).toBe(false)
    expect(port.snapshot().selectedInputId).toBe('b')
  })

  it('reconnects the first device after No MIDI input is selected', async () => {
    const keyboard = createInput('a', 'Stage Keyboard')
    const access = createAccess([keyboard])
    const port = createWebMidiInputPort({
      onInput: vi.fn(),
      requestMIDIAccess: async () => access as unknown as MIDIAccess,
    })

    await expect(port.connect()).resolves.toBe(true)
    expect(port.selectInput(null)).toBe(true)
    expect(port.snapshot()).toMatchObject({
      selectedInputId: null,
      connected: false,
    })

    await expect(port.connect()).resolves.toBe(true)
    expect(port.snapshot()).toMatchObject({
      selectedInputId: 'a',
      connected: true,
    })
    expect(keyboard.onmidimessage).not.toBeNull()
  })

  it('falls forward on auto-selected hot-unplug and retains manual selection', async () => {
    const first = createInput('a', 'First')
    const second = createInput('b', 'Second')
    const access = createAccess([first, second])
    const events: PianoInputEvent[] = []
    const port = createWebMidiInputPort({
      onInput: (event) => events.push(event),
      requestMIDIAccess: async () => access as unknown as MIDIAccess,
    })
    await port.connect()

    first.state = 'disconnected'
    stateChange(access)
    expect(port.snapshot()).toMatchObject({
      selectedInputId: 'b',
      connected: true,
    })
    expect(events.at(-1)).toMatchObject({
      type: 'source-disconnected',
      source: { id: 'a' },
    })

    expect(port.selectInput('b')).toBe(true)
    second.state = 'disconnected'
    stateChange(access)
    expect(port.snapshot()).toMatchObject({
      selectedInputId: 'b',
      connected: false,
    })

    const reconnected = createInput('b', 'Second, reconnected')
    access.inputs.set('b', reconnected as unknown as MIDIInput)
    stateChange(access)
    expect(port.snapshot()).toMatchObject({
      selectedInputId: 'b',
      connected: true,
    })
    expect(reconnected.onmidimessage).not.toBeNull()
  })

  it('can disconnect and reconnect without preserving stale handlers', async () => {
    const first = createInput('a', 'First')
    const second = createInput('a', 'First, new access')
    const firstAccess = createAccess([first])
    const secondAccess = createAccess([second])
    const requestMIDIAccess = vi
      .fn()
      .mockResolvedValueOnce(firstAccess as unknown as MIDIAccess)
      .mockResolvedValueOnce(secondAccess as unknown as MIDIAccess)
    const events: PianoInputEvent[] = []
    const port = createWebMidiInputPort({
      onInput: (event) => events.push(event),
      requestMIDIAccess,
    })

    await port.connect()
    port.disconnect()
    expect(first.onmidimessage).toBeNull()
    expect(firstAccess.onstatechange).toBeNull()
    expect(events.at(-1)?.type).toBe('source-disconnected')

    await expect(port.connect()).resolves.toBe(true)
    expect(requestMIDIAccess).toHaveBeenCalledTimes(2)
    expect(second.onmidimessage).not.toBeNull()

    port.dispose()
    expect(second.onmidimessage).toBeNull()
    expect(port.snapshot().permission).toBe('disposed')
    await expect(port.connect()).resolves.toBe(false)
  })

  it('ignores permission results that resolve after disconnect', async () => {
    const keyboard = createInput('a', 'Late Keyboard')
    const access = createAccess([keyboard])
    let resolveAccess: ((access: MIDIAccess) => void) | undefined
    const pendingAccess = new Promise<MIDIAccess>((resolve) => {
      resolveAccess = resolve
    })
    const port = createWebMidiInputPort({
      onInput: vi.fn(),
      requestMIDIAccess: () => pendingAccess,
    })

    const connecting = port.connect()
    port.disconnect()
    resolveAccess?.(access as unknown as MIDIAccess)

    await expect(connecting).resolves.toBe(false)
    expect(keyboard.onmidimessage).toBeNull()
    expect(port.snapshot()).toMatchObject({
      permission: 'idle',
      connected: false,
    })
  })

  it('reports denied permission without attaching an access listener', async () => {
    const listener = vi.fn()
    const port = createWebMidiInputPort({
      onInput: vi.fn(),
      requestMIDIAccess: vi.fn().mockRejectedValue(new Error('denied')),
    })
    port.subscribe(listener)

    await expect(port.connect()).resolves.toBe(false)
    expect(port.snapshot().permission).toBe('denied')
    expect(listener).toHaveBeenCalledTimes(2)
  })
})
