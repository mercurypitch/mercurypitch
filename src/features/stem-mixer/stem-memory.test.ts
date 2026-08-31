// ============================================================
// A phone cannot hold six decoded stems, and now says so
// ============================================================
//
// Reported from an iPhone home-screen install: opening a song from the
// karaoke sidebar killed the app, it reloaded, died again on "Decoding
// audio", and WebKit put up its own "a problem repeatedly occurred" page.
// Karaoke Night's own picker never did it.
//
// The difference is the stem count. Karaoke Night stages a song with
// `requestedStems={{ vocal: true, instrumental: true }}` and no extras — two
// decoded stems. The play-along part presets select `['vocal', ...parts]`,
// which for a full-band song is vocal plus every isolated band stem. Decoded
// audio is uncompressed Float32, so those six are ~440MB resident, and iOS
// kills the content process rather than letting a tab have it. A killed
// process is not a JS error: nothing in the app can catch it, so the size has
// to be worked out before the decode is attempted.

import { describe, expect, it } from 'vitest'
import { decodedBudgetBytes, decodedStemBytes, fitStems, mb, stemLoadConcurrency, } from './stem-memory'

const MB = 1024 * 1024

describe('decodedStemBytes', () => {
  it('measures a decoded stem as Float32 per sample per channel', () => {
    // Three and a half minutes of 44.1kHz stereo: the shape of a pop song.
    const bytes = decodedStemBytes(210, 44_100, 2)
    expect(mb(bytes)).toBe(71)
  })

  it('follows the context sample rate, not the file it came from', () => {
    // decodeAudioData resamples into the context, so a 48kHz context makes a
    // 44.1kHz file bigger than its own header implies — the difference
    // between fitting the budget and not.
    const at44 = decodedStemBytes(210, 44_100, 2)
    const at48 = decodedStemBytes(210, 48_000, 2)
    expect(at48).toBeGreaterThan(at44)
  })

  it('reports nothing for a duration it does not know yet', () => {
    // Guarding the caller: this is asked before the extras load, and a NaN
    // here would silently trim every stem or none.
    expect(decodedStemBytes(0, 44_100, 2)).toBe(0)
    expect(decodedStemBytes(Number.NaN, 44_100, 2)).toBe(0)
    expect(decodedStemBytes(210, 44_100, 0)).toBe(0)
  })
})

describe('decodedBudgetBytes', () => {
  it('gives a phone far less than a desktop', () => {
    const phone = decodedBudgetBytes({
      deviceClass: 'mobile',
      deviceMemoryGb: null,
    })
    const desktop = decodedBudgetBytes({
      deviceClass: 'desktop',
      deviceMemoryGb: 16,
    })
    expect(phone).toBeLessThan(desktop)
  })

  it('does not wait for a deviceMemory reading iOS never sends', () => {
    // `navigator.deviceMemory` is Chromium-only. Every iPhone reports null,
    // and the iPhone is the device this exists for, so a null must not be
    // read as "unknown, assume plenty".
    const unknown = decodedBudgetBytes({
      deviceClass: 'mobile',
      deviceMemoryGb: null,
    })
    expect(unknown).toBeLessThanOrEqual(320 * MB)
  })

  it('tightens further on a device that admits to 2GB', () => {
    const small = decodedBudgetBytes({
      deviceClass: 'mobile',
      deviceMemoryGb: 2,
    })
    const ordinary = decodedBudgetBytes({
      deviceClass: 'mobile',
      deviceMemoryGb: 8,
    })
    expect(small).toBeLessThan(ordinary)
  })
})

describe('stemLoadConcurrency', () => {
  it('loads one stem at a time on a phone', () => {
    // Each in-flight stem holds its compressed download AND its decoded
    // buffer at the same moment, so parallelism multiplies the peak by the
    // number in flight. That is the one thing a phone cannot afford.
    expect(stemLoadConcurrency('mobile')).toBe(1)
    expect(stemLoadConcurrency('tv')).toBe(1)
    expect(stemLoadConcurrency('desktop')).toBeGreaterThan(1)
  })
})

describe('fitStems', () => {
  const perStemBytes = decodedStemBytes(210, 44_100, 2)

  it('lets a phone open the two-stem song that always worked', () => {
    // Karaoke Night's path. It has to stay exactly as it is — this is the
    // case the report says is fine, and a budget that trimmed it would break
    // the working half of the app to fix the broken half.
    const fit = fitStems({
      loaded: 2,
      pending: 0,
      perStemBytes,
      budgetBytes: decodedBudgetBytes({
        deviceClass: 'mobile',
        deviceMemoryGb: null,
      }),
    })
    expect(fit.skipped).toBe(0)
  })

  it('trims the six-stem play-along that killed the tab', () => {
    const fit = fitStems({
      loaded: 1,
      pending: 5,
      perStemBytes,
      budgetBytes: decodedBudgetBytes({
        deviceClass: 'mobile',
        deviceMemoryGb: null,
      }),
    })
    expect(fit.projectedBytes).toBeGreaterThan(400 * MB)
    expect(fit.skipped).toBeGreaterThan(0)
    expect(fit.allowed).toBeLessThan(5)
  })

  it('leaves the same song alone on a desktop', () => {
    const fit = fitStems({
      loaded: 1,
      pending: 5,
      perStemBytes,
      budgetBytes: decodedBudgetBytes({
        deviceClass: 'desktop',
        deviceMemoryGb: 16,
      }),
    })
    expect(fit.skipped).toBe(0)
  })

  it('never counts stems already decoded as skippable', () => {
    // Asked after the named stems have loaded. They are resident by then, so
    // trimming them would only throw away audio already paid for while
    // leaving the memory it occupies untouched.
    const fit = fitStems({
      loaded: 8,
      pending: 2,
      perStemBytes,
      budgetBytes: perStemBytes,
    })
    expect(fit.allowed).toBe(0)
    expect(fit.skipped).toBe(2)
  })

  it('does not trim on a guess before any duration is known', () => {
    // perStemBytes is 0 until the first stem decodes. Treating that as
    // "everything fits in nothing" would drop every extra on every song.
    const fit = fitStems({
      loaded: 0,
      pending: 5,
      perStemBytes: 0,
      budgetBytes: 1,
    })
    expect(fit.allowed).toBe(5)
    expect(fit.skipped).toBe(0)
  })
})
