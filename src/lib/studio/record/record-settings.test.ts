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
    })
  })

  it('reads back what was kept', () => {
    writeStudioRecordSettings({
      countInBars: 2,
      click: true,
      monitor: true,
      offsetMs: -12,
    })

    expect(readStudioRecordSettings()).toEqual({
      countInBars: 2,
      click: true,
      monitor: true,
      offsetMs: -12,
    })
  })

  it('keeps the default for each value that does not fit, and holds the offset to 250 ms whole', () => {
    expect(
      sanitizeStudioRecordSettings({
        countInBars: 3,
        click: 'yes',
        monitor: true,
        offsetMs: 400.6,
      }),
    ).toEqual({ countInBars: 1, click: false, monitor: true, offsetMs: 250 })
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
