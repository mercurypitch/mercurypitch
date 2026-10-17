// ============================================================
// The low-volume hint's rule: when it shows, and when it goes
// ============================================================
//
// Readings are handed in as the phone sends them: on entry (the first read)
// and on every change after it. An iPhone's volume keys move it in
// sixteenths, an Android phone's in its own steps (15 for media in stock
// Android).

import { describe, expect, it } from 'vitest'
import type { NativeAudioOutputReading } from '@/stores/native-shell-store'
import type { VolumeHint } from './volume-hint'
import { isLowVolume, LOW_VOLUME_AT, nextVolumeHint, VOLUME_HINT_START, } from './volume-hint'

const reading = (
  volume: number,
  route: NativeAudioOutputReading['route'] = 'speaker',
  volumeKnown: NativeAudioOutputReading['volumeKnown'] = 'live',
): NativeAudioOutputReading => ({
  volume,
  volumeKnown,
  step: null,
  steps: null,
  route,
  outputs: [],
  detail: {},
  reason: null,
})

/** Readings in order, from a room just opened. */
const run = (...readings: NativeAudioOutputReading[]): VolumeHint =>
  readings.reduce(nextVolumeHint, VOLUME_HINT_START)

describe('isLowVolume', () => {
  it('counts the bottom quarter on the speaker: four of the iPhone’s sixteen steps', () => {
    expect(LOW_VOLUME_AT).toBe(0.25)
    expect(isLowVolume(reading(0))).toBe(true)
    expect(isLowVolume(reading(4 / 16))).toBe(true)
    expect(isLowVolume(reading(5 / 16))).toBe(false)
    expect(isLowVolume(reading(1))).toBe(false)
  })

  it('counts three of Android’s fifteen steps, and not four', () => {
    expect(isLowVolume(reading(3 / 15))).toBe(true)
    expect(isLowVolume(reading(4 / 15))).toBe(false)
  })

  it('counts the receiver and an unknown route as the speaker is counted', () => {
    expect(isLowVolume(reading(0.25, 'receiver'))).toBe(true)
    expect(isLowVolume(reading(0.25, 'other'))).toBe(true)
  })

  it('counts only silence in headphones and Bluetooth, where a quarter is often plenty', () => {
    expect(isLowVolume(reading(0.0625, 'headphones'))).toBe(false)
    expect(isLowVolume(reading(0.0625, 'bluetooth'))).toBe(false)
    expect(isLowVolume(reading(0, 'headphones'))).toBe(true)
    expect(isLowVolume(reading(0, 'bluetooth'))).toBe(true)
  })
})

describe('nextVolumeHint', () => {
  it('shows nothing before the phone has answered', () => {
    expect(VOLUME_HINT_START.shown).toBe(false)
  })

  it('shows on entry when the volume is low, and not when it is fine', () => {
    expect(run(reading(0.125)).shown).toBe(true)
    expect(run(reading(0.5)).shown).toBe(false)
  })

  it('says whether the volume is all the way down', () => {
    expect(run(reading(0)).silent).toBe(true)
    expect(run(reading(0.125)).silent).toBe(false)
  })

  it('goes the moment the volume rises, even while it is still low', () => {
    expect(run(reading(0), reading(0.0625)).shown).toBe(false)
    expect(run(reading(0.125), reading(0.75)).shown).toBe(false)
  })

  it('comes back when the volume falls into the bottom quarter again', () => {
    expect(run(reading(0), reading(0.0625), reading(0)).shown).toBe(true)
    expect(run(reading(0.5), reading(0.25)).shown).toBe(true)
  })

  it('stays away on a fall that is not low', () => {
    expect(run(reading(0.75), reading(0.5)).shown).toBe(false)
  })

  it('stays away on a same-volume change once a rise has hidden it', () => {
    expect(run(reading(0), reading(0.0625), reading(0.0625)).shown).toBe(false)
  })

  it('reads a new route at the same volume afresh', () => {
    // Headphones out, the speaker on at the same low volume: low now.
    expect(
      run(reading(0.125, 'headphones'), reading(0.125, 'speaker')).shown,
    ).toBe(true)
    // And back in: a quarter is fine in the ear.
    expect(
      run(reading(0.125, 'speaker'), reading(0.125, 'headphones')).shown,
    ).toBe(false)
  })
})

// An iPhone's own session can read 0 while the room plays out loud: it
// stopped following the keys once a room opened (build 880), and on iOS 18
// and later it can read 0 at first or keep an old value. The hint still
// asks for the volume to go up, but says "zero" only from a reading that
// follows the keys, or from two readings that agree.
describe('saying zero', () => {
  it('says zero from a reading that follows the keys', () => {
    expect(run(reading(0, 'speaker', 'live')).silent).toBe(true)
    expect(run(reading(0, 'headphones', 'live')).silent).toBe(true)
  })

  it('says zero when the session and a settled volume view agree', () => {
    expect(run(reading(0, 'speaker', 'agreed')).silent).toBe(true)
  })

  it("never says zero from the session's reading alone", () => {
    const hint = run(reading(0, 'speaker', 'session'))
    expect(hint.shown).toBe(true)
    expect(hint.silent).toBe(false)
  })

  it('keeps the same lines for showing, whatever the reading is', () => {
    for (const known of ['live', 'agreed', 'session'] as const) {
      expect(run(reading(0.25, 'speaker', known)).shown).toBe(true)
      expect(run(reading(5 / 16, 'speaker', known)).shown).toBe(false)
      expect(run(reading(0.0625, 'bluetooth', known)).shown).toBe(false)
      expect(run(reading(0, 'bluetooth', known)).shown).toBe(true)
    }
  })

  it('says zero once a reading that follows the keys confirms it', () => {
    const stale = run(reading(0, 'speaker', 'session'))
    expect(stale.silent).toBe(false)
    expect(nextVolumeHint(stale, reading(0, 'speaker', 'live')).silent).toBe(
      true,
    )
  })
})
