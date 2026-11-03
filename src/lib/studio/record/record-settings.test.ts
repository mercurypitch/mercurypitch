// Studio record settings — kept on this device, read back sanitized, and the defaults kept when storage is missing, broken or refuses.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_STUDIO_RECORD_SETTINGS, readStudioRecordSettings, sanitizeStudioRecordSettings, writeStudioRecordSettings, } from './record-settings'

const KEY = 'mercurypitch.studio.recording'

afterEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})

describe('Studio record settings', () => {
  it('starts with a one-bar count-in, no click, no monitoring and no offset', () => {
    expect(readStudioRecordSettings()).toEqual({
      countInBars: 1,
      click: false,
      monitor: false,
      offsetMs: 0,
      punch: false,
      inputDeviceId: null,
      inputLabel: null,
    })
  })

  it('reads back what was kept', () => {
    const kept = {
      countInBars: 2 as const,
      click: true,
      monitor: true,
      offsetMs: -12,
      punch: true,
      inputDeviceId: 'usb-mic',
      inputLabel: 'USB Microphone',
    }
    writeStudioRecordSettings(kept)

    expect(readStudioRecordSettings()).toEqual(kept)
  })

  it('keeps the default for each value that does not fit, and holds the offset to 250 ms whole', () => {
    expect(
      sanitizeStudioRecordSettings({
        countInBars: 3,
        click: 'yes',
        monitor: true,
        offsetMs: 400.6,
      }),
    ).toEqual({
      ...DEFAULT_STUDIO_RECORD_SETTINGS,
      countInBars: 1,
      click: false,
      monitor: true,
      offsetMs: 250,
    })
    // A device id that is not text is none, and a name without one is let go.
    expect(
      sanitizeStudioRecordSettings({
        inputDeviceId: 42,
        inputLabel: 'Lost mic',
        punch: 'on',
      }),
    ).toMatchObject({ inputDeviceId: null, inputLabel: null, punch: false })
    expect(sanitizeStudioRecordSettings({ offsetMs: -12.4 }).offsetMs).toBe(-12)
    expect(sanitizeStudioRecordSettings(null)).toEqual(
      DEFAULT_STUDIO_RECORD_SETTINGS,
    )
  })

  it('keeps the defaults for damaged storage, and the settings for the session when storage refuses', () => {
    localStorage.setItem(KEY, '{not json')
    expect(readStudioRecordSettings()).toEqual(DEFAULT_STUDIO_RECORD_SETTINGS)

    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    const kept = writeStudioRecordSettings({
      ...DEFAULT_STUDIO_RECORD_SETTINGS,
      click: true,
    })
    expect(kept.click).toBe(true)
  })
})
