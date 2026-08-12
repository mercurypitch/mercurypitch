import { describe, expect, it, vi } from 'vitest'
import { filePickerLooksUnavailable, openFilePicker } from './file-picker'

const signals = (
  overrides: Partial<{
    documentLostFocus: boolean
    filesArrived: boolean
    cancelled: boolean
  }> = {},
) => ({
  documentLostFocus: false,
  filesArrived: false,
  cancelled: false,
  ...overrides,
})

describe('filePickerLooksUnavailable', () => {
  it('reports failure when the click produced no observable effect', () => {
    expect(filePickerLooksUnavailable(signals())).toBe(true)
  })

  it('stays silent when the document lost focus to a native picker', () => {
    expect(
      filePickerLooksUnavailable(signals({ documentLostFocus: true })),
    ).toBe(false)
  })

  it('stays silent when files actually arrived', () => {
    expect(filePickerLooksUnavailable(signals({ filesArrived: true }))).toBe(
      false,
    )
  })

  it('treats an explicit cancel as proof a picker existed', () => {
    expect(filePickerLooksUnavailable(signals({ cancelled: true }))).toBe(false)
  })
})

describe('openFilePicker', () => {
  it('does nothing when there is no input', () => {
    expect(() => openFilePicker(undefined)).not.toThrow()
  })

  it('clicks the input', () => {
    const input = document.createElement('input')
    input.type = 'file'
    const click = vi.spyOn(input, 'click').mockImplementation(() => {})
    openFilePicker(input)
    expect(click).toHaveBeenCalledTimes(1)
  })

  it('reports unavailable after a silent click', async () => {
    vi.useFakeTimers()
    try {
      const input = document.createElement('input')
      input.type = 'file'
      vi.spyOn(input, 'click').mockImplementation(() => {})
      const onUnavailable = vi.fn()

      openFilePicker(input, { onUnavailable, probeMs: 100 })
      expect(onUnavailable).not.toHaveBeenCalled()
      vi.advanceTimersByTime(150)
      expect(onUnavailable).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })

  it('stays quiet when the picker takes focus', () => {
    vi.useFakeTimers()
    try {
      const input = document.createElement('input')
      input.type = 'file'
      vi.spyOn(input, 'click').mockImplementation(() => {
        window.dispatchEvent(new Event('blur'))
      })
      const onUnavailable = vi.fn()

      openFilePicker(input, { onUnavailable, probeMs: 100 })
      vi.advanceTimersByTime(150)
      expect(onUnavailable).not.toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })

  it('stays quiet when a file arrives', () => {
    vi.useFakeTimers()
    try {
      const input = document.createElement('input')
      input.type = 'file'
      vi.spyOn(input, 'click').mockImplementation(() => {})
      const onUnavailable = vi.fn()

      openFilePicker(input, { onUnavailable, probeMs: 100 })
      input.dispatchEvent(new Event('change'))
      vi.advanceTimersByTime(150)
      expect(onUnavailable).not.toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })
})
