// Drum Night input tests — permissions, mapping and event filtering stay honest.
// ============================================================

import { afterEach, describe, expect, it, vi } from 'vitest'
import type { DrumMidiAccessPort, DrumMidiInputPort, DrumMidiMappingStore, } from './drum-input'
import { createDrumMidiInput, createLocalDrumMidiMappingStore, drumKeyboardHitFromEvent, normalizeDrumInputTimestampMs, } from './drum-input'
import { GENERAL_MIDI_DRUM_ARTICULATIONS } from './drum-pad-layout'
import type { DrumLiveHit } from './drum-runtime-types'

function deferred<T>(): {
  readonly promise: Promise<T>
  resolve(value: T): void
} {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((settle) => {
    resolve = settle
  })
  return { promise, resolve }
}

interface MidiHarness {
  readonly access: DrumMidiAccessPort
  readonly input: DrumMidiInputPort
  setInputs(inputs: readonly DrumMidiInputPort[]): void
  send(data: readonly number[], timestampMs?: number): void
}

function midiHarness(): MidiHarness {
  let currentInputs: readonly DrumMidiInputPort[] = []
  const input: DrumMidiInputPort = {
    id: 'kit-1',
    name: 'Practice Kit',
    state: 'connected',
    onmidimessage: null,
  }
  const access: DrumMidiAccessPort = {
    inputs: {
      values: () => currentInputs[Symbol.iterator](),
    },
    onstatechange: null,
  }
  return {
    access,
    input,
    setInputs(inputs) {
      currentInputs = inputs
    },
    send(data, timestampMs = 1_000) {
      input.onmidimessage?.({
        data: new Uint8Array(data),
        timeStamp: timestampMs,
      })
    },
  }
}

function keyboardEvent(
  code: string,
  overrides: Partial<Parameters<typeof drumKeyboardHitFromEvent>[0]> = {},
): Parameters<typeof drumKeyboardHitFromEvent>[0] {
  return {
    altKey: false,
    code,
    ctrlKey: false,
    defaultPrevented: false,
    metaKey: false,
    repeat: false,
    shiftKey: false,
    target: document.body,
    timeStamp: 500,
    ...overrides,
  }
}

afterEach(() => vi.restoreAllMocks())

describe('Drum Night keyboard input', () => {
  it('maps the six top-row and numpad controls onto the essential GM kit', () => {
    expect(
      ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6'].map(
        (code) => drumKeyboardHitFromEvent(keyboardEvent(code), 500)?.gmKey,
      ),
    ).toEqual([42, 38, 36, 48, 51, 49])
    expect(drumKeyboardHitFromEvent(keyboardEvent('Numpad3'), 500)?.gmKey).toBe(
      36,
    )
    expect(GENERAL_MIDI_DRUM_ARTICULATIONS).toHaveLength(47)
    expect(GENERAL_MIDI_DRUM_ARTICULATIONS.at(0)?.gmKey).toBe(35)
    expect(GENERAL_MIDI_DRUM_ARTICULATIONS.at(-1)?.gmKey).toBe(81)
  })

  it('does not steal modified, repeated, handled, or editable keystrokes', () => {
    const input = document.createElement('input')
    const cases = [
      keyboardEvent('Digit1', { ctrlKey: true }),
      keyboardEvent('Digit1', { shiftKey: true }),
      keyboardEvent('Digit1', { repeat: true }),
      keyboardEvent('Digit1', { defaultPrevented: true }),
      keyboardEvent('Digit1', { target: input }),
      keyboardEvent('KeyA'),
    ]
    expect(
      cases.every((event) => drumKeyboardHitFromEvent(event, 500) === null),
    ).toBe(true)
  })
})

describe('Drum Night MIDI input', () => {
  it('requests access only when connect is called and reports no-hit state', async () => {
    const harness = midiHarness()
    harness.setInputs([harness.input])
    const requestAccess = vi.fn(async () => harness.access)
    const hits: DrumLiveHit[] = []
    const input = createDrumMidiInput({
      environment: { requestAccess, nowMs: () => 1_000 },
      onHit: (hit) => hits.push(hit),
    })

    expect(requestAccess).not.toHaveBeenCalled()
    expect(input.state()).toMatchObject({
      status: 'idle',
      hasReceivedHit: false,
    })

    await expect(input.connect()).resolves.toBe(true)
    expect(requestAccess).toHaveBeenCalledOnce()
    expect(input.state()).toMatchObject({
      status: 'connected',
      inputNames: ['Practice Kit'],
      selectedInputId: 'kit-1',
      selectedInputName: 'Practice Kit',
      hasReceivedHit: false,
    })
    expect(hits).toEqual([])
  })

  it('keeps full GM identity, ignores note-off, and emits repeated strikes', async () => {
    const harness = midiHarness()
    harness.setInputs([harness.input])
    const hits: DrumLiveHit[] = []
    const input = createDrumMidiInput({
      environment: {
        requestAccess: async () => harness.access,
        nowMs: () => 1_000,
      },
      onHit: (hit) => hits.push(hit),
    })
    await input.connect()

    harness.send([0x92, 38, 91])
    harness.send([0x89, 38, 0])
    harness.send([0x99, 38, 84])
    harness.send([0x99, 90, 100])

    expect(hits.map((hit) => [hit.gmKey, hit.velocity])).toEqual([
      [38, 91],
      [38, 84],
    ])
    expect(hits[0].midiChannel).toBe(2)
    expect(input.state().hasReceivedHit).toBe(true)
    expect(input.state().lastRawUnmappedNote).toEqual({
      sourceId: 'kit-1',
      midiChannel: 9,
      rawMidiKey: 90,
      velocity: 100,
      timestampMs: 1_000,
    })
  })

  it('retains raw controller state, including hi-hat pedal CC4', async () => {
    const harness = midiHarness()
    harness.setInputs([harness.input])
    const controllerChanges = vi.fn()
    const input = createDrumMidiInput({
      environment: {
        requestAccess: async () => harness.access,
        nowMs: () => 1_000,
      },
      onHit: () => undefined,
      onControllerChange: controllerChanges,
    })
    await input.connect()

    harness.send([0xb9, 4, 73], 990)
    harness.send([0xb9, 1, 12], 995)

    expect(input.state().lastControllerChange).toEqual({
      sourceId: 'kit-1',
      midiChannel: 9,
      controller: 1,
      value: 12,
      timestampMs: 995,
    })
    expect(input.state().controllerValues).toContainEqual({
      sourceId: 'kit-1',
      midiChannel: 9,
      controller: 4,
      value: 73,
      timestampMs: 990,
    })
    expect(controllerChanges).toHaveBeenCalledTimes(2)
    expect(input.state().hasReceivedHit).toBe(false)
  })

  it('learns the next physical strike and persists the source mapping', async () => {
    const harness = midiHarness()
    harness.setInputs([harness.input])
    const saved: Array<{
      readonly inputId: string
      readonly mapping: ReadonlyMap<number, number>
    }> = []
    const store: DrumMidiMappingStore = {
      load: (inputId) =>
        inputId === 'kit-1'
          ? new Map([
              [22, 42],
              [23, 99],
            ])
          : new Map(),
      save: (inputId, mapping) =>
        saved.push({ inputId, mapping: new Map(mapping) }),
    }
    const hits: DrumLiveHit[] = []
    const input = createDrumMidiInput({
      environment: {
        requestAccess: async () => harness.access,
        nowMs: () => 1_000,
      },
      mappingStore: store,
      onHit: (hit) => hits.push(hit),
    })
    await input.connect()

    harness.send([0x90, 22, 77])
    expect(hits.at(-1)).toMatchObject({ gmKey: 42, rawMidiKey: 22 })

    expect(input.beginLearn(38)).toBe(true)
    harness.send([0x90, 24, 88])
    expect(hits.at(-1)).toMatchObject({ gmKey: 38, rawMidiKey: 24 })
    expect(input.state().learningTargetGmKey).toBeNull()
    expect(saved.at(-1)?.inputId).toBe('kit-1')
    expect(saved.at(-1)?.mapping.get(24)).toBe(38)
    expect(input.mapping().has(23)).toBe(false)
  })

  it('distinguishes no inputs, later disconnect, permission denial, and errors', async () => {
    const harness = midiHarness()
    const input = createDrumMidiInput({
      environment: {
        requestAccess: async () => harness.access,
        nowMs: () => 1_000,
      },
      onHit: () => undefined,
    })
    await expect(input.connect()).resolves.toBe(false)
    expect(input.state().status).toBe('no-inputs')

    harness.setInputs([harness.input])
    harness.access.onstatechange?.()
    expect(input.state().status).toBe('connected')
    harness.setInputs([])
    harness.access.onstatechange?.()
    expect(input.state().status).toBe('disconnected')

    const denied = createDrumMidiInput({
      environment: {
        requestAccess: () =>
          Promise.reject(
            Object.freeze({
              name: 'NotAllowedError',
              message: 'No MIDI permission',
            }),
          ),
        nowMs: () => 1_000,
      },
      onHit: () => undefined,
    })
    await denied.connect()
    expect(denied.state()).toMatchObject({
      status: 'denied',
      errorMessage: 'No MIDI permission',
    })

    const failed = createDrumMidiInput({
      environment: {
        requestAccess: async () => {
          throw new Error('Driver disappeared')
        },
        nowMs: () => 1_000,
      },
      onHit: () => undefined,
    })
    await failed.connect()
    expect(failed.state()).toMatchObject({
      status: 'error',
      errorMessage: 'Driver disappeared',
    })
  })

  it('detaches every listener on disconnect and dispose', async () => {
    const harness = midiHarness()
    harness.setInputs([harness.input])
    const input = createDrumMidiInput({
      environment: {
        requestAccess: async () => harness.access,
        nowMs: () => 1_000,
      },
      onHit: () => undefined,
    })
    await input.connect()
    expect(harness.input.onmidimessage).not.toBeNull()
    expect(harness.access.onstatechange).not.toBeNull()

    input.disconnect()
    expect(harness.input.onmidimessage).toBeNull()
    expect(harness.access.onstatechange).toBeNull()
    expect(input.state().status).toBe('disconnected')
    input.dispose()
  })

  it('deduplicates concurrent permission requests', async () => {
    const harness = midiHarness()
    harness.setInputs([harness.input])
    const permission = deferred<DrumMidiAccessPort>()
    const requestAccess = vi.fn(() => permission.promise)
    const input = createDrumMidiInput({
      environment: { requestAccess, nowMs: () => 1_000 },
      onHit: () => undefined,
    })

    const first = input.connect()
    const second = input.connect()
    expect(requestAccess).toHaveBeenCalledOnce()
    permission.resolve(harness.access)
    await expect(Promise.all([first, second])).resolves.toEqual([true, true])
  })

  it('selects one input deterministically and keeps profiles device-scoped', async () => {
    const harness = midiHarness()
    const other: DrumMidiInputPort = {
      id: 'a-kit',
      name: 'A Kit',
      state: 'connected',
      onmidimessage: null,
    }
    harness.setInputs([harness.input, other])
    const loadedIds: string[] = []
    const store: DrumMidiMappingStore = {
      load(inputId) {
        loadedIds.push(inputId)
        return inputId === 'a-kit' ? new Map([[22, 38]]) : new Map([[22, 42]])
      },
      save: () => undefined,
    }
    const hits: DrumLiveHit[] = []
    const input = createDrumMidiInput({
      environment: {
        requestAccess: async () => harness.access,
        nowMs: () => 1_000,
      },
      mappingStore: store,
      onHit: (hit) => hits.push(hit),
    })
    await input.connect()

    expect(input.state()).toMatchObject({
      selectedInputId: 'a-kit',
      selectedInputName: 'A Kit',
      availableInputs: [
        { id: 'a-kit', name: 'A Kit' },
        { id: 'kit-1', name: 'Practice Kit' },
      ],
    })
    expect(other.onmidimessage).not.toBeNull()
    expect(harness.input.onmidimessage).toBeNull()
    other.onmidimessage?.({
      data: new Uint8Array([0x99, 22, 90]),
      timeStamp: 1_000,
    })
    expect(hits.at(-1)?.gmKey).toBe(38)

    expect(input.selectInput('kit-1')).toBe(true)
    expect(other.onmidimessage).toBeNull()
    expect(harness.input.onmidimessage).not.toBeNull()
    harness.send([0x99, 22, 90])
    expect(hits.at(-1)?.gmKey).toBe(42)
    expect(loadedIds).toEqual(['a-kit', 'kit-1'])
  })

  it('preserves prior property handlers through hotplug and teardown', async () => {
    const harness = midiHarness()
    const priorInput = vi.fn()
    const priorAccess = vi.fn()
    harness.input.onmidimessage = priorInput
    harness.access.onstatechange = priorAccess
    harness.setInputs([harness.input])
    const hits: DrumLiveHit[] = []
    const input = createDrumMidiInput({
      environment: {
        requestAccess: async () => harness.access,
        nowMs: () => 1_000,
      },
      onHit: (hit) => hits.push(hit),
    })
    await input.connect()
    const combinedInput = harness.input.onmidimessage
    const combinedAccess = harness.access.onstatechange
    expect(combinedInput).not.toBe(priorInput)
    expect(combinedAccess).not.toBe(priorAccess)

    harness.send([0x99, 38, 90])
    expect(priorInput).toHaveBeenCalledOnce()
    expect(hits).toHaveLength(1)

    const replacementPrior = vi.fn()
    const replacement: DrumMidiInputPort = {
      id: 'replacement-kit',
      name: 'Replacement Kit',
      state: 'connected',
      onmidimessage: replacementPrior,
    }
    harness.setInputs([replacement])
    harness.access.onstatechange?.()
    expect(priorAccess).toHaveBeenCalledOnce()
    expect(harness.input.onmidimessage).toBe(priorInput)
    expect(replacement.onmidimessage).not.toBe(replacementPrior)
    replacement.onmidimessage?.({
      data: new Uint8Array([0x99, 42, 80]),
      timeStamp: 1_000,
    })
    expect(replacementPrior).toHaveBeenCalledOnce()
    expect(hits.at(-1)?.gmKey).toBe(42)

    input.disconnect()
    expect(replacement.onmidimessage).toBe(replacementPrior)
    expect(harness.access.onstatechange).toBe(priorAccess)
  })

  it('uses listener APIs without replacing another MIDI consumer', async () => {
    const messageListeners = new Set<
      NonNullable<DrumMidiInputPort['onmidimessage']>
    >()
    const stateListeners = new Set<(event?: Event) => void>()
    const priorInput = vi.fn<NonNullable<DrumMidiInputPort['onmidimessage']>>()
    const priorAccess = vi.fn<(event?: Event) => void>()
    const port: DrumMidiInputPort = {
      id: 'event-target-kit',
      name: 'Event Target Kit',
      state: 'connected',
      onmidimessage: priorInput,
      addEventListener: vi.fn((_type, listener) => {
        messageListeners.add(listener)
      }),
      removeEventListener: vi.fn((_type, listener) => {
        messageListeners.delete(listener)
      }),
    }
    const access: DrumMidiAccessPort = {
      inputs: { values: () => [port][Symbol.iterator]() },
      onstatechange: priorAccess,
      addEventListener: vi.fn((_type, listener) => {
        stateListeners.add(listener)
      }),
      removeEventListener: vi.fn((_type, listener) => {
        stateListeners.delete(listener)
      }),
    }
    const hits: DrumLiveHit[] = []
    const input = createDrumMidiInput({
      environment: {
        requestAccess: async () => access,
        nowMs: () => 1_000,
      },
      onHit: (hit) => hits.push(hit),
    })
    await input.connect()

    expect(port.onmidimessage).toBe(priorInput)
    expect(access.onstatechange).toBe(priorAccess)
    expect(messageListeners.size).toBe(1)
    expect(stateListeners.size).toBe(1)
    for (const listener of messageListeners) {
      listener({
        data: new Uint8Array([0x99, 38, 90]),
        timeStamp: 1_000,
      })
    }
    expect(hits).toHaveLength(1)

    input.dispose()
    expect(messageListeners.size).toBe(0)
    expect(stateListeners.size).toBe(0)
    expect(port.onmidimessage).toBe(priorInput)
    expect(access.onstatechange).toBe(priorAccess)
  })
})

describe('Drum Night input timestamps', () => {
  it('keeps current performance stamps, converts epoch stamps, and rejects stale values', () => {
    const origin = 1_700_000_000_000
    expect(normalizeDrumInputTimestampMs(9_980, 10_000, origin)).toBe(9_980)
    expect(normalizeDrumInputTimestampMs(origin + 9_975, 10_000, origin)).toBe(
      9_975,
    )
    expect(normalizeDrumInputTimestampMs(-500_000, 10_000, origin)).toBe(10_000)
    expect(normalizeDrumInputTimestampMs(Number.NaN, 10_000, origin)).toBe(
      10_000,
    )
  })
})

describe('Drum Night MIDI message hygiene', () => {
  async function connectedInput() {
    const harness = midiHarness()
    harness.setInputs([harness.input])
    const hits: DrumLiveHit[] = []
    const input = createDrumMidiInput({
      environment: {
        requestAccess: async () => harness.access,
        nowMs: () => 1_000,
      },
      onHit: (hit) => hits.push(hit),
    })
    await input.connect()
    return { harness, hits, input }
  }

  it('treats a velocity-zero note-on as the note-off it is', async () => {
    const { harness, hits } = await connectedInput()
    harness.send([0x99, 38, 0])
    expect(hits).toHaveLength(0)
    harness.send([0x99, 38, 96])
    expect(hits).toHaveLength(1)
  })

  it('drops short, realtime, and empty messages without crashing', async () => {
    const { harness, hits, input } = await connectedInput()
    harness.send([0xf8])
    harness.send([0xc0, 5])
    harness.input.onmidimessage?.({ data: null, timeStamp: 1_000 })
    expect(hits).toHaveLength(0)
    expect(input.state().errorMessage).toBeNull()
    harness.send([0x90, 36, 64])
    expect(hits).toHaveLength(1)
  })

  it('clamps an out-of-range velocity to the MIDI ceiling', async () => {
    const { harness, hits } = await connectedInput()
    harness.send([0x90, 36, 255])
    expect(hits.at(-1)?.velocity).toBe(127)
  })
})

describe('createLocalDrumMidiMappingStore', () => {
  const STORAGE_KEY = 'mp.drumNight.midiMapping.v2'

  function memoryStorage(): Storage {
    const bag = new Map<string, string>()
    return {
      get length() {
        return bag.size
      },
      clear: () => bag.clear(),
      getItem: (key: string) => bag.get(key) ?? null,
      key: () => null,
      removeItem: (key: string) => void bag.delete(key),
      setItem: (key: string, value: string) => void bag.set(key, value),
    }
  }

  it('round-trips per-input profiles and preserves other devices on save', () => {
    const storage = memoryStorage()
    const store = createLocalDrumMidiMappingStore(storage)
    store.save('kit-a', new Map([[22, 42]]))
    store.save('kit-b', new Map([[30, 36]]))
    expect(store.load('kit-a').get(22)).toBe(42)
    expect(store.load('kit-b').get(30)).toBe(36)

    store.save('kit-a', new Map([[24, 38]]))
    expect(store.load('kit-a').get(24)).toBe(38)
    expect(store.load('kit-a').has(22)).toBe(false)
    expect(store.load('kit-b').get(30)).toBe(36)
  })

  it('loads nothing from corrupted, foreign-version, or invalid payloads', () => {
    const storage = memoryStorage()
    const store = createLocalDrumMidiMappingStore(storage)
    storage.setItem(STORAGE_KEY, 'not json {')
    expect(store.load('kit-a').size).toBe(0)

    storage.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: 1, profiles: { 'kit-a': { 22: 42 } } }),
    )
    expect(store.load('kit-a').size).toBe(0)

    // Valid envelope, invalid entries: non-GM target and non-numeric key.
    storage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 2,
        profiles: { 'kit-a': { 22: 99, nope: 38, 23: 46 } },
      }),
    )
    const mapping = store.load('kit-a')
    expect([...mapping.entries()]).toEqual([[23, 46]])
  })

  it('swallows a throwing storage so the live mapping keeps playing', () => {
    const storage = memoryStorage()
    storage.setItem = () => {
      throw new DOMException('quota', 'QuotaExceededError')
    }
    const store = createLocalDrumMidiMappingStore(storage)
    expect(() => store.save('kit-a', new Map([[22, 42]]))).not.toThrow()
    expect(store.load('kit-a').size).toBe(0)
  })
})

describe('Drum Night MIDI learn overwrite and recovery', () => {
  it('lets a learned strike shadow a native pad and per-key clear restore it', async () => {
    const harness = midiHarness()
    harness.setInputs([harness.input])
    const saved: Array<ReadonlyMap<number, number>> = []
    const store: DrumMidiMappingStore = {
      load: () => new Map(),
      save: (_inputId, mapping) => saved.push(new Map(mapping)),
    }
    const hits: DrumLiveHit[] = []
    const input = createDrumMidiInput({
      environment: {
        requestAccess: async () => harness.access,
        nowMs: () => 1_000,
      },
      mappingStore: store,
      onHit: (hit) => hits.push(hit),
    })
    await input.connect()

    // Native GM kick passes through untouched.
    harness.send([0x90, 36, 90])
    expect(hits.at(-1)?.gmKey).toBe(36)

    // A mis-strike while learning snare captures the kick pad...
    expect(input.beginLearn(38)).toBe(true)
    harness.send([0x90, 36, 90])
    expect(hits.at(-1)).toMatchObject({ gmKey: 38, rawMidiKey: 36 })
    expect(saved.at(-1)?.get(36)).toBe(38)
    harness.send([0x90, 36, 90])
    expect(hits.at(-1)?.gmKey).toBe(38)

    // ...and the per-key clear brings the native voice back, persisted.
    input.clearMapping(36)
    expect(saved.at(-1)?.has(36)).toBe(false)
    harness.send([0x90, 36, 90])
    expect(hits.at(-1)?.gmKey).toBe(36)
  })

  it('cancelLearn leaves the map untouched and rejects non-GM learn targets', async () => {
    const harness = midiHarness()
    harness.setInputs([harness.input])
    const saved: Array<ReadonlyMap<number, number>> = []
    const store: DrumMidiMappingStore = {
      load: () => new Map(),
      save: (_inputId, mapping) => saved.push(new Map(mapping)),
    }
    const input = createDrumMidiInput({
      environment: {
        requestAccess: async () => harness.access,
        nowMs: () => 1_000,
      },
      mappingStore: store,
      onHit: () => undefined,
    })
    await input.connect()

    expect(input.beginLearn(34)).toBe(false)
    expect(input.beginLearn(45)).toBe(true)
    input.cancelLearn()
    expect(input.state().learningTargetGmKey).toBeNull()
    harness.send([0x90, 20, 70])
    expect(input.mapping().size).toBe(0)
    expect(saved).toHaveLength(0)
    expect(input.state().lastRawUnmappedNote?.rawMidiKey).toBe(20)
  })
})
