// Browser host foreground tests — the first visibility state arrives before map loading.

import { micManager } from '@irchiinnuss/pitch-engine'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { REFERENCE_NOTE_HOLD_PREFERENCE } from '../reference-note'
import { createBrowserGlassHost } from './browser-host'
import { createBrowserGlassSound } from './glass-sound'

vi.mock('./glass-sound', () => ({
  createBrowserGlassSound: vi.fn(() => ({ dispose: vi.fn() })),
}))

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('browser host foreground subscription', () => {
  it('emits initial visibility and stops every listener after unsubscribe', () => {
    const browserWindow = new EventTarget()
    const browserDocument = new EventTarget() as EventTarget & {
      visibilityState: DocumentVisibilityState
    }
    let visibility: DocumentVisibilityState = 'visible'
    Object.defineProperty(browserDocument, 'visibilityState', {
      get: () => visibility,
    })
    vi.stubGlobal('window', browserWindow)
    vi.stubGlobal('document', browserDocument)
    const host = createBrowserGlassHost({
      assetUrl: (id) => id,
      storagePrefix: 'journey-test',
      onExit: vi.fn(),
    })
    const listener = vi.fn()

    const unsubscribe = host.subscribeForeground(listener)
    expect(listener).toHaveBeenCalledExactlyOnceWith(true)
    visibility = 'hidden'
    browserDocument.dispatchEvent(new Event('visibilitychange'))
    browserWindow.dispatchEvent(new Event('pagehide'))
    visibility = 'visible'
    browserWindow.dispatchEvent(new Event('pageshow'))
    expect(listener.mock.calls.map(([value]) => value)).toEqual([
      true,
      false,
      false,
      true,
    ])

    unsubscribe()
    browserDocument.dispatchEvent(new Event('visibilitychange'))
    expect(listener).toHaveBeenCalledTimes(4)
  })

  it('routes cooperative takeover and unused cleanup through the shared manager', async () => {
    const takeOver = vi
      .spyOn(micManager, 'takeOverFromOtherTab')
      .mockResolvedValue(true)
    const release = vi
      .spyOn(micManager, 'releaseTakeoverIfUnused')
      .mockResolvedValue()
    const host = createBrowserGlassHost({
      assetUrl: (id) => id,
      storagePrefix: 'journey-test',
      onExit: vi.fn(),
    })

    await expect(host.takeOverMicrophone?.()).resolves.toBe(true)
    await host.releaseUnusedMicrophoneTakeover?.()
    expect(takeOver).toHaveBeenCalledOnce()
    expect(release).toHaveBeenCalledOnce()
  })
})

describe('browser host reference tuning', () => {
  it.each([true, false])(
    'applies tuning only when the host enables it (%s)',
    (developmentTuning) => {
      vi.stubGlobal('localStorage', { getItem: () => '1.4', setItem: vi.fn() })
      const host = createBrowserGlassHost({
        assetUrl: (id) => id,
        storagePrefix: 'reference-test',
        onExit: vi.fn(),
        developmentTuning,
      })
      host.createSound()
      const options = vi.mocked(createBrowserGlassSound).mock.calls.at(-1)![0]!
      expect(options.referenceNoteHoldSeconds?.()).toBe(
        developmentTuning ? 1.4 : 1.25,
      )
      host.writePreference(REFERENCE_NOTE_HOLD_PREFERENCE, '8')
      expect(options.referenceNoteHoldSeconds?.()).toBe(
        developmentTuning ? 1.5 : 1.25,
      )
    },
  )
  it('keeps current-visit tuning when persistent storage is unavailable', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
    })
    const host = createBrowserGlassHost({
      assetUrl: (id) => id,
      storagePrefix: 'reference-test',
      onExit: vi.fn(),
      developmentTuning: true,
    })
    host.createSound()
    const options = vi.mocked(createBrowserGlassSound).mock.calls.at(-1)![0]!
    expect(options.referenceNoteHoldSeconds?.()).toBe(1.25)
    host.writePreference(REFERENCE_NOTE_HOLD_PREFERENCE, '1.1')
    expect(options.referenceNoteHoldSeconds?.()).toBe(1.1)
  })
})
