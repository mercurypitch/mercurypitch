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
): NativeAudioOutputReading => ({
  volume,
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
