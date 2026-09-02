import { micManager } from '@irchiinnuss/pitch-engine'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { applyPreferredInput, chooseInput, configureInputDevice, listInputs, readPreferredInput, SYSTEM_DEFAULT, writePreferredInput, } from './input-device'

const device = (
  deviceId: string,
  label = '',
  kind: MediaDeviceKind = 'audioinput',
): MediaDeviceInfo => ({ deviceId, label, kind, groupId: 'g' }) as MediaDeviceInfo

const memoryStorage = (): Storage => {
  const map = new Map<string, string>()
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, String(v)),
    removeItem: (k) => void map.delete(k),
    clear: () => map.clear(),
    key: (i) => [...map.keys()][i] ?? null,
    get length() {
      return map.size
    },
  } as Storage
}

/** A storage that throws on every operation, as a blocked one does. */
const hostileStorage = (): Storage =>
  ({
    getItem: () => {
      throw new Error('blocked')
    },
    setItem: () => {
      throw new Error('blocked')
    },
    removeItem: () => {
      throw new Error('blocked')
    },
  }) as unknown as Storage

let setPreferred: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  // The key is module state; reset it so tests do not inherit whichever
  // product the previous one configured.
  configureInputDevice({ storageKey: 'audio-io:input-device' })
  setPreferred = vi
    .spyOn(micManager, 'setPreferredDevice')
    .mockResolvedValue(undefined)
})
afterEach(() => {
  vi.restoreAllMocks()
})

describe('listInputs', () => {
  it('drops the synthetic mirror entries a real microphone comes with', async () => {
    // Chrome publishes `default` and `communications` alongside the real
    // device, which is how one microphone becomes three rows in a picker.
    const choices = await listInputs(async () => [
      device('default', 'Default - Scarlett Solo'),
      device('communications', 'Communications - Scarlett Solo'),
      device('abc123', 'Scarlett Solo'),
    ])
    expect(choices).toEqual([
      SYSTEM_DEFAULT,
      { deviceId: 'abc123', label: 'Scarlett Solo' },
    ])
  })

  it('offers only the system default when every device is synthetic', async () => {
    const choices = await listInputs(async () => [
      device('default', 'Default'),
      device('communications', 'Communications'),
    ])
    expect(choices).toEqual([SYSTEM_DEFAULT])
  })

  it('drops the empty-id placeholder that precedes permission', async () => {
    // Before a grant, enumerateDevices returns one blank entry. Asking to
    // open it is `{ deviceId: { exact: '' } }`, an OverconstrainedError.
    const choices = await listInputs(async () => [device('')])
    expect(choices).toEqual([SYSTEM_DEFAULT])
  })

  it('names an unlabelled device rather than offering a blank row', async () => {
    const choices = await listInputs(async () => [device('abc123')])
    expect(choices[1]).toEqual({ deviceId: 'abc123', label: 'Microphone' })
  })

  it('keeps one row per device when the list repeats an id', async () => {
    const choices = await listInputs(async () => [
      device('abc123', 'Scarlett Solo'),
      device('abc123', 'Scarlett Solo'),
    ])
    expect(choices).toHaveLength(2)
  })

  it('keeps the order the browser gave', async () => {
    const choices = await listInputs(async () => [
      device('one', 'Built-in'),
      device('two', 'Scarlett Solo'),
    ])
    expect(choices.map((c) => c.deviceId)).toEqual(['', 'one', 'two'])
  })

  it('offers the system default when enumeration is unavailable', async () => {
    // An engine without enumerateDevices, or one that refuses.
    const choices = await listInputs(() => Promise.reject(new Error('no')))
    expect(choices).toEqual([SYSTEM_DEFAULT])
  })
})

describe('the remembered choice', () => {
  it('round-trips a device id', () => {
    const storage = memoryStorage()
    writePreferredInput('abc123', storage)
    expect(readPreferredInput(storage)).toBe('abc123')
  })

  it('treats the empty string as no preference, not as a device', () => {
    // '' is the picker's value for "System default", and storing it would
    // read back as a device id that can never be opened.
    const storage = memoryStorage()
    writePreferredInput('abc123', storage)
    writePreferredInput('', storage)
    expect(readPreferredInput(storage)).toBeNull()
  })

  it('forgets on null', () => {
    const storage = memoryStorage()
    writePreferredInput('abc123', storage)
    writePreferredInput(null, storage)
    expect(readPreferredInput(storage)).toBeNull()
  })

  it('reads null when there is no storage at all', () => {
    expect(readPreferredInput(undefined)).toBeNull()
  })

  it('survives a storage that throws on read and on write', () => {
    // Private mode, or storage disabled by policy. The choice does not
    // persist; nothing else may break.
    const storage = hostileStorage()
    expect(() => writePreferredInput('abc123', storage)).not.toThrow()
    expect(readPreferredInput(storage)).toBeNull()
  })

  it('keeps each product under its own key', async () => {
    // Two apps on one origin must not overwrite each other's microphone.
    const storage = memoryStorage()
    configureInputDevice({ storageKey: 'app-one:input' })
    writePreferredInput('abc123', storage)
    configureInputDevice({ storageKey: 'app-two:input' })
    expect(readPreferredInput(storage)).toBeNull()
    configureInputDevice({ storageKey: 'app-one:input' })
    expect(readPreferredInput(storage)).toBe('abc123')
  })
})

describe('applyPreferredInput', () => {
  it('applies a remembered device that is still plugged in', async () => {
    const storage = memoryStorage()
    writePreferredInput('abc123', storage)
    const applied = await applyPreferredInput(
      async () => [device('abc123', 'Scarlett Solo')],
      storage,
    )
    expect(applied).toBe('abc123')
    expect(setPreferred).toHaveBeenCalledWith('abc123')
  })

  it('falls back to the default when the remembered device is gone', async () => {
    // Unplugging the interface must degrade to the system default. Asking
    // for a missing id with `exact` is an OverconstrainedError, which the
    // player cannot act on and which reads as "the microphone is broken".
    const storage = memoryStorage()
    writePreferredInput('gone', storage)
    const applied = await applyPreferredInput(
      async () => [device('abc123', 'Scarlett Solo')],
      storage,
    )
    expect(applied).toBeNull()
    expect(setPreferred).toHaveBeenCalledWith(null)
    expect(readPreferredInput(storage)).toBeNull()
  })

  it('does not enumerate when nothing is remembered', async () => {
    // The common case, and it must not pay for a device query.
    const list = vi.fn(async () => [device('abc123', 'Scarlett Solo')])
    const applied = await applyPreferredInput(list, memoryStorage())
    expect(applied).toBeNull()
    expect(list).not.toHaveBeenCalled()
    expect(setPreferred).toHaveBeenCalledWith(null)
  })

  it('falls back when the device list cannot be read', async () => {
    const storage = memoryStorage()
    writePreferredInput('abc123', storage)
    const applied = await applyPreferredInput(
      () => Promise.reject(new Error('no')),
      storage,
    )
    expect(applied).toBeNull()
    expect(setPreferred).toHaveBeenCalledWith(null)
  })

  it('survives storage that refuses to answer', async () => {
    await expect(
      applyPreferredInput(async () => [], hostileStorage()),
    ).resolves.toBeNull()
  })
})

describe('chooseInput', () => {
  it('remembers the device and points the mic manager at it', async () => {
    configureInputDevice({ storageKey: 'audio-io-test:input' })
    await chooseInput('abc123')
    expect(setPreferred).toHaveBeenCalledWith('abc123')
  })

  it('treats the picker’s empty value as the system default', async () => {
    await chooseInput('')
    expect(setPreferred).toHaveBeenCalledWith(null)
  })
})
