// ============================================================
// StemLoadProgress unit tests
// ============================================================

import { createRoot } from 'solid-js'
import { describe, expect, it } from 'vitest'
import { StemLoadProgress } from './StemLoadProgress'

describe('StemLoadProgress', () => {
  it('renders indeterminate state during connecting phase', () => {
    createRoot((dispose) => {
      const el = StemLoadProgress({
        pct: 0,
        phase: 'connecting',
        loadedBytes: 0,
        totalBytes: null,
      }) as HTMLElement

      expect(el.querySelector('.sm-load-title')?.textContent).toBe(
        'Loading stems',
      )
      expect(el.querySelector('.sm-load-pct')).toBeNull()
      const track = el.querySelector('.sm-load-track')
      expect(track?.classList.contains('is-indeterminate')).toBe(true)
      expect(track?.getAttribute('aria-label')).toBe('Connecting stems')
      expect(track?.getAttribute('aria-valuenow')).toBeNull()
      expect(el.querySelector('.sm-load-phase')?.textContent).toBe('Connecting')
      expect(el.querySelector('.sm-load-bytes')?.textContent).toBe(
        'Reaching the song library',
      )

      dispose()
    })
  })

  it('renders indeterminate state during decoding phase', () => {
    createRoot((dispose) => {
      const el = StemLoadProgress({
        pct: 100,
        phase: 'decoding',
        loadedBytes: 5000000,
        totalBytes: 5000000,
        songTitle: 'Test Track',
      }) as HTMLElement

      expect(el.querySelector('.sm-load-title')?.textContent).toBe('Test Track')
      expect(el.querySelector('.sm-load-pct')).toBeNull()
      const track = el.querySelector('.sm-load-track')
      expect(track?.classList.contains('is-indeterminate')).toBe(true)
      expect(track?.getAttribute('aria-label')).toBe('Decoding audio stems')
      expect(el.querySelector('.sm-load-phase')?.textContent).toBe(
        'Decoding audio',
      )
      expect(el.querySelector('.sm-load-bytes')?.textContent).toBe(
        'Almost ready',
      )

      dispose()
    })
  })

  it('renders determinate state during downloading phase with known totalBytes', () => {
    createRoot((dispose) => {
      const el = StemLoadProgress({
        pct: 45,
        phase: 'downloading',
        loadedBytes: 4500000,
        totalBytes: 10000000,
        songTitle: 'Song A',
      }) as HTMLElement

      expect(el.querySelector('.sm-load-title')?.textContent).toBe('Song A')
      expect(el.querySelector('.sm-load-pct')?.textContent).toBe('45%')
      const track = el.querySelector('.sm-load-track')
      expect(track?.classList.contains('is-indeterminate')).toBe(false)
      expect(track?.getAttribute('aria-valuenow')).toBe('45')
      expect(el.querySelector('.sm-load-phase')?.textContent).toBe(
        'Downloading',
      )
      expect(
        el.querySelector('.sm-load-fill')?.getAttribute('style'),
      ).toContain('width: 45%')

      dispose()
    })
  })

  it('renders indeterminate downloading state when totalBytes is null', () => {
    createRoot((dispose) => {
      const el = StemLoadProgress({
        pct: 0,
        phase: 'downloading',
        loadedBytes: 1048576,
        totalBytes: null,
      }) as HTMLElement

      expect(el.querySelector('.sm-load-pct')).toBeNull()
      const track = el.querySelector('.sm-load-track')
      expect(track?.classList.contains('is-indeterminate')).toBe(true)
      expect(el.querySelector('.sm-load-bytes')?.textContent).toContain('MB')

      dispose()
    })
  })
})
