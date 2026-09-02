import { micManager } from '@irchiinnuss/pitch-engine'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { applyPreferredInput, listInputs, readPreferredInput, SYSTEM_DEFAULT, writePreferredInput, } from './input-device'

const device = (deviceId: string, label = ''): MediaDeviceInfo =>
  ({ deviceId, label, kind: 'audioinput', groupId: 'g' }) as MediaDeviceInfo

const memoryStorage = (): Storage => {
  const map = new Map<string, string>()
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
    clear: () => map.clear(),
    key: () => null,
    length: 0,
  } as Storage
}

describe('listInputs', () => {
  it('drops the synthetic mirror entries a real microphone comes with', async () => {
    // Chrome publishes `default` and `communications` alongside the real
    // device, which is how one microphone becomes three rows.
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

  it('names an unlabelled device rather than offering a blank row', async () => {
    // Labels are empty until a stream has been granted.
    const choices = await listInputs(async () => [device('abc123')])
    expect(choices[1]).toEqual({ deviceId: 'abc123', label: 'Microphone' })
  })

  it('offers the system default when enumeration is unavailable', async () => {
    const choices = await listInputs(() => Promise.reject(new Error('no')))
    expect(choices).toEqual([SYSTEM_DEFAULT])
  })
})

describe('applyPreferredInput', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('applies a remembered device that is still plugged in', async () => {
    const storage = memoryStorage()
    const setPreferred = vi
      .spyOn(micManager, 'setPreferredDevice')
      .mockResolvedValue()
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
    // player cannot act on.
    const storage = memoryStorage()
    const setPreferred = vi
      .spyOn(micManager, 'setPreferredDevice')
      .mockResolvedValue()
    writePreferredInput('gone', storage)
    const applied = await applyPreferredInput(
      async () => [device('abc123', 'Scarlett Solo')],
      storage,
    )
    expect(applied).toBeNull()
    expect(setPreferred).toHaveBeenCalledWith(null)
    expect(readPreferredInput(storage)).toBeNull()
  })

  it('survives storage that refuses to answer', async () => {
    vi.spyOn(micManager, 'setPreferredDevice').mockResolvedValue()
    const throwing = {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => undefined,
      removeItem: () => undefined,
    } as unknown as Storage
    await expect(
      applyPreferredInput(async () => [], throwing),
    ).resolves.toBeNull()
  })
})
