import { beforeEach, describe, expect, it, vi } from 'vitest'

const STEM_DENOISE_KEY = 'pitchperfect_stem_denoise'
const AUTO_INDEX_KEY = 'pitchperfect_karaoke_auto_index_shazam'

/** The store reads localStorage at import time, so each case needs a fresh one. */
const loadStore = async () => {
  vi.resetModules()
  return await import('@/stores/karaoke-settings-store')
}

describe('karaoke settings store', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('defaults both preferences on, matching shipped behaviour', async () => {
    const store = await loadStore()
    expect(store.karaokeStemDenoise()).toBe(true)
    expect(store.karaokeAutoIndexShazam()).toBe(true)
  })

  it('carries over the cogwheel toggle’s bare-string format', async () => {
    // The old UvrPanel signal wrote 'true'/'false', not JSON. A user who had
    // turned denoise off must not silently get it back on after the move.
    localStorage.setItem(STEM_DENOISE_KEY, 'false')
    const store = await loadStore()
    expect(store.karaokeStemDenoise()).toBe(false)
  })

  it('keeps writing the format the old key used', async () => {
    const store = await loadStore()
    store.setKaraokeStemDenoise(false)
    expect(localStorage.getItem(STEM_DENOISE_KEY)).toBe('false')
    store.setKaraokeStemDenoise(true)
    expect(localStorage.getItem(STEM_DENOISE_KEY)).toBe('true')
  })

  it('persists the Shazam indexing preference', async () => {
    const store = await loadStore()
    store.setKaraokeAutoIndexShazam(false)
    expect(localStorage.getItem(AUTO_INDEX_KEY)).toBe('false')

    const reloaded = await loadStore()
    expect(reloaded.karaokeAutoIndexShazam()).toBe(false)
  })
})
