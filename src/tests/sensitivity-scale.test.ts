// ============================================================
// The room scale: three presets, and everywhere between them
// ============================================================
//
// Reported after testing in a noisy room: "that noisy preset is really
// restrictive, it needs my mouth close to the mic and very loud ... I am
// considering something sort of a preset in between noisy and home".
//
// The scale exists to make that middle reachable. The property that matters
// most is the boring one: the three named stops must still produce EXACTLY the
// numbers they always did, or a release note about a new slider becomes a
// silent change to every existing singer's microphone gate.

import { describe, expect, it } from 'vitest'
import { describeSensitivityPosition, isAtSensitivityStop, nearestSensitivityPreset, SENSITIVITY_PRESETS, SENSITIVITY_STOPS, sensitivityConfigAt, sensitivityPositionForConfig, sensitivityPositionOf, sensitivityPresetLabel, } from '@/lib/sensitivity-scale'

describe('the named stops are untouched', () => {
  it('reproduces each preset exactly at its own position', () => {
    for (const stop of SENSITIVITY_STOPS) {
      expect(sensitivityConfigAt(stop.position)).toEqual(
        SENSITIVITY_PRESETS[stop.preset],
      )
    }
  })

  it('puts the rooms in order: quiet, home, noisy', () => {
    expect(SENSITIVITY_STOPS.map((s) => s.preset)).toEqual([
      'quiet',
      'home',
      'noisy',
    ])
    expect(sensitivityPositionOf('quiet')).toBe(0)
    expect(sensitivityPositionOf('home')).toBe(50)
    expect(sensitivityPositionOf('noisy')).toBe(100)
  })

  it('falls back to the quietest end for a preset with no stop', () => {
    // Unreachable through the type today. Pinned so that adding a fourth
    // preset without giving it a stop fails toward the open microphone
    // rather than toward a silent one.
    expect(sensitivityPositionOf('studio' as unknown as 'quiet')).toBe(0)
  })
})

describe('the space between the stops', () => {
  it('lands halfway between Home and Noisy at 75 — the setting asked for', () => {
    const between = sensitivityConfigAt(75)
    const home = SENSITIVITY_PRESETS.home
    const noisy = SENSITIVITY_PRESETS.noisy

    // Strictly between on the gate, which is the number the report is about.
    expect(between.minAmplitude).toBeGreaterThan(home.minAmplitude)
    expect(between.minAmplitude).toBeLessThan(noisy.minAmplitude)
    expect(between.minAmplitude).toBe(3)
    expect(between.minConfidence).toBeCloseTo(0.6, 5)
    expect(between.detectionThreshold).toBeCloseTo(0.15, 5)
  })

  it('interpolates piecewise, so a non-monotonic knob still passes through Home', () => {
    // `sensitivity` runs 7 -> 5 -> 9. Interpolated end to end it would read
    // ~7.7 at Home instead of 5, quietly moving the default everybody starts on.
    expect(sensitivityConfigAt(50).sensitivity).toBe(5)
    expect(sensitivityConfigAt(25).sensitivity).toBe(6)
    expect(sensitivityConfigAt(75).sensitivity).toBe(7)
  })

  it('moves the gate monotonically from quiet to noisy', () => {
    let previous = -Infinity
    for (let position = 0; position <= 100; position += 5) {
      const gate = sensitivityConfigAt(position).minAmplitude
      expect(gate).toBeGreaterThanOrEqual(previous)
      previous = gate
    }
  })

  it('clamps anything off the line, including nonsense', () => {
    expect(sensitivityConfigAt(-40)).toEqual(SENSITIVITY_PRESETS.quiet)
    expect(sensitivityConfigAt(9000)).toEqual(SENSITIVITY_PRESETS.noisy)
    expect(sensitivityConfigAt(Number.NaN)).toEqual(SENSITIVITY_PRESETS.quiet)
  })
})

describe('the label above the slider', () => {
  it('names the nearest room', () => {
    expect(nearestSensitivityPreset(0)).toBe('quiet')
    expect(nearestSensitivityPreset(10)).toBe('quiet')
    expect(nearestSensitivityPreset(45)).toBe('home')
    expect(nearestSensitivityPreset(60)).toBe('home')
    expect(nearestSensitivityPreset(90)).toBe('noisy')
  })

  it('breaks a tie toward the quieter room', () => {
    // 25 is equidistant from Quiet and Home. The quieter setting lets more
    // sound through, so naming it over-reports how open the mic is — the
    // kinder error when someone is trying to work out why they are not heard.
    expect(nearestSensitivityPreset(25)).toBe('quiet')
    expect(nearestSensitivityPreset(75)).toBe('home')
  })

  it('knows a stop from somewhere between two', () => {
    expect(isAtSensitivityStop(0)).toBe(true)
    expect(isAtSensitivityStop(50)).toBe(true)
    expect(isAtSensitivityStop(100)).toBe(true)
    expect(isAtSensitivityStop(75)).toBe(false)
    expect(isAtSensitivityStop(49)).toBe(false)
  })
})

describe('opening the slider on settings that predate it', () => {
  it('starts every existing preset where that singer already was', () => {
    for (const stop of SENSITIVITY_STOPS) {
      expect(
        sensitivityPositionForConfig(SENSITIVITY_PRESETS[stop.preset]),
      ).toBe(stop.position)
    }
  })

  it('places hand-tuned thresholds at the closest point, not at zero', () => {
    // The raw Pitch Detection sliders in Settings can still write anything.
    expect(sensitivityPositionForConfig({ minAmplitude: 3 })).toBe(75)
    expect(sensitivityPositionForConfig({ minAmplitude: 1.5 })).toBe(25)
  })

  it('survives a corrupt or missing value', () => {
    expect(sensitivityPositionForConfig({ minAmplitude: Number.NaN })).toBe(0)
    expect(sensitivityPositionForConfig({ minAmplitude: -5 })).toBe(0)
    expect(sensitivityPositionForConfig({ minAmplitude: 99 })).toBe(100)
  })
})

describe('what the slider says it is set to', () => {
  it('names the room at a stop', () => {
    expect(describeSensitivityPosition(0)).toBe('Quiet')
    expect(describeSensitivityPosition(50)).toBe('Home')
    expect(describeSensitivityPosition(100)).toBe('Noisy')
  })

  it('names both neighbours in between', () => {
    // "Home" alone would misdescribe a gate that is most of the way to Noisy,
    // and standing between two rooms is the entire point of the control.
    expect(describeSensitivityPosition(75)).toBe('Between Home and Noisy')
    expect(describeSensitivityPosition(25)).toBe('Between Quiet and Home')
  })

  it('clamps rather than inventing a room', () => {
    expect(describeSensitivityPosition(-10)).toBe('Quiet')
    expect(describeSensitivityPosition(140)).toBe('Noisy')
    expect(sensitivityPresetLabel('noisy')).toBe('Noisy')
  })
})
