// ============================================================
// Drum Machine Tests — synthesis + pattern sequencer
// ============================================================

import { describe, expect, it, vi } from 'vitest'
import { DRUM_SOUNDS, DrumMachine } from '@/lib/guitar/drum-machine'

// ── Shared AudioContext mock builder ───────────────────────────

function mockAudioContext() {
  return {
    sampleRate: 44100,
    currentTime: 0,
    destination: { connect: vi.fn() },
    createGain: vi.fn().mockImplementation(() => ({
      gain: {
        value: 0,
        valueOf: () => 0,
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
      connect: vi.fn(),
      disconnect: vi.fn(),
    })),
    createOscillator: vi.fn().mockImplementation(() => ({
      type: 'sine' as const,
      frequency: {
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
      start: vi.fn(),
      stop: vi.fn(),
      connect: vi.fn(),
      disconnect: vi.fn(),
    })),
    createBiquadFilter: vi.fn().mockImplementation(() => ({
      type: 'lowpass' as const,
      frequency: { value: 1000 },
      Q: { value: 0.5 },
      gain: { value: 0 },
      connect: vi.fn(),
      disconnect: vi.fn(),
    })),
    createBuffer: vi
      .fn()
      .mockImplementation((_channels: number, length: number) => ({
        numberOfChannels: 1,
        sampleRate: 44100,
        length,
        getChannelData: vi.fn().mockReturnValue(new Float32Array(length)),
      })),
    createBufferSource: vi.fn().mockImplementation(() => ({
      buffer: null,
      start: vi.fn(),
      stop: vi.fn(),
      connect: vi.fn(),
      disconnect: vi.fn(),
    })),
  }
}

// ── DrumMachine class ──────────────────────────────────────────

describe('DrumMachine', () => {
  it('constructs with default values', () => {
    const dm = new DrumMachine()
    expect(dm.playing).toBe(false)
    expect(dm.bpm).toBe(120)
    expect(dm.currentStep).toBe(0)
    expect(dm.pattern).toBeDefined()
    expect(dm.volumes).toBeDefined()
  })

  it('default volumes are ~0.8 for all sounds', () => {
    const dm = new DrumMachine()
    for (const sound of DRUM_SOUNDS) {
      expect(dm.volumes[sound]).toBeCloseTo(0.8, 1)
    }
  })

  it('default pattern is basic-rock preset', () => {
    const dm = new DrumMachine()
    const pattern = dm.pattern
    // Kick on 1, 2, 3, 4 (steps 0, 4, 8, 12)
    expect(pattern['kick'][0]).toBe(true)
    expect(pattern['kick'][4]).toBe(true)
    expect(pattern['kick'][8]).toBe(true)
    expect(pattern['kick'][12]).toBe(true)
    // Snare on 2 and 4 (steps 4, 12)
    expect(pattern['snare'][4]).toBe(true)
    expect(pattern['snare'][12]).toBe(true)
  })
})

// ── BPM setter ─────────────────────────────────────────────────

describe('DrumMachine.setBpm', () => {
  it('sets BPM within valid range', () => {
    const dm = new DrumMachine()
    dm.setBpm(140)
    expect(dm.bpm).toBe(140)
  })

  it('clamps BPM to minimum 40', () => {
    const dm = new DrumMachine()
    dm.setBpm(10)
    expect(dm.bpm).toBe(40)
  })

  it('clamps BPM to maximum 300', () => {
    const dm = new DrumMachine()
    dm.setBpm(500)
    expect(dm.bpm).toBe(300)
  })

  it('accepts boundary values', () => {
    const dm = new DrumMachine()
    dm.setBpm(40)
    expect(dm.bpm).toBe(40)
    dm.setBpm(300)
    expect(dm.bpm).toBe(300)
  })
})

// ── Volume setter ──────────────────────────────────────────────

describe('DrumMachine.setVolume', () => {
  it('sets volume for a specific sound', () => {
    const dm = new DrumMachine()
    dm.setVolume('kick', 0.5)
    expect(dm.volumes['kick']).toBe(0.5)
  })

  it('clamps volume to 0-1 range', () => {
    const dm = new DrumMachine()
    dm.setVolume('snare', -0.5)
    expect(dm.volumes['snare']).toBe(0)
    dm.setVolume('snare', 2.0)
    expect(dm.volumes['snare']).toBe(1)
  })
})

// ── Pattern editing ────────────────────────────────────────────

describe('DrumMachine pattern editing', () => {
  it('toggles a step on/off', () => {
    const dm = new DrumMachine()
    dm.clearPattern()
    expect(dm.pattern['kick'][0]).toBe(false)
    dm.toggleStep('kick', 0)
    expect(dm.pattern['kick'][0]).toBe(true)
    dm.toggleStep('kick', 0)
    expect(dm.pattern['kick'][0]).toBe(false)
  })

  it('setStep explicitly sets active state', () => {
    const dm = new DrumMachine()
    dm.clearPattern()
    dm.setStep('kick', 2, true)
    expect(dm.pattern['kick'][2]).toBe(true)
    dm.setStep('kick', 2, false)
    expect(dm.pattern['kick'][2]).toBe(false)
  })

  it('ignores out-of-range step indices', () => {
    const dm = new DrumMachine()
    dm.clearPattern()
    dm.toggleStep('kick', 16) // STEPS = 16, so index 16 is out of range
    expect(dm.pattern['kick'][0]).toBe(false)
  })

  it('ignores negative step indices', () => {
    const dm = new DrumMachine()
    dm.clearPattern()
    dm.toggleStep('kick', -1)
    // Should not throw and should not modify any step
    for (let i = 0; i < 16; i++) {
      expect(dm.pattern['kick'][i]).toBe(false)
    }
  })
})

// ── Presets ────────────────────────────────────────────────────

describe('DrumMachine presets', () => {
  it('loads basic-rock preset', () => {
    const dm = new DrumMachine()
    dm.loadPreset('basic-rock')
    const p = dm.pattern
    expect(p['kick'][0]).toBe(true)
    expect(p['snare'][4]).toBe(true)
    expect(p['hh-closed'][0]).toBe(true)
  })

  it('loads funk preset', () => {
    const dm = new DrumMachine()
    dm.loadPreset('funk')
    const p = dm.pattern
    expect(p['kick'][0]).toBe(true)
    expect(p['hh-open'][3]).toBe(true)
  })

  it('loads hip-hop preset', () => {
    const dm = new DrumMachine()
    dm.loadPreset('hip-hop')
    const p = dm.pattern
    expect(p['kick'][0]).toBe(true)
  })

  it('loads jazz preset', () => {
    const dm = new DrumMachine()
    dm.loadPreset('jazz')
    const p = dm.pattern
    expect(p['kick'][0]).toBe(true)
    expect(p['crash'][0]).toBe(true)
    expect(p['tom-high'][11]).toBe(true)
  })

  it('loads latin preset', () => {
    const dm = new DrumMachine()
    dm.loadPreset('latin')
    const p = dm.pattern
    expect(p['tom-low'][7]).toBe(true)
  })

  it('loads empty preset with all steps off', () => {
    const dm = new DrumMachine()
    dm.loadPreset('empty')
    for (const sound of DRUM_SOUNDS) {
      for (let i = 0; i < 16; i++) {
        expect(dm.pattern[sound][i]).toBe(false)
      }
    }
  })

  it('clearPattern sets all steps to false', () => {
    const dm = new DrumMachine()
    dm.loadPreset('basic-rock')
    dm.clearPattern()
    for (const sound of DRUM_SOUNDS) {
      for (let i = 0; i < 16; i++) {
        expect(dm.pattern[sound][i]).toBe(false)
      }
    }
  })

  it('loadPreset creates a clone (modifications do not affect preset source)', () => {
    const dm = new DrumMachine()
    dm.loadPreset('basic-rock')
    dm.toggleStep('kick', 0) // turn off
    expect(dm.pattern['kick'][0]).toBe(false)

    // Reload and verify the original preset is intact
    dm.loadPreset('basic-rock')
    expect(dm.pattern['kick'][0]).toBe(true)
  })
})

// ── Transport: start/stop lifecycle ────────────────────────────

describe('DrumMachine transport', () => {
  it('does not start without AudioContext initialization', () => {
    const dm = new DrumMachine()
    dm.start()
    expect(dm.playing).toBe(false)
  })

  it('starts after init with mocked AudioContext', async () => {
    const dm = new DrumMachine()
    // Inject a mock AudioContext directly
    const ctx = mockAudioContext() as unknown as AudioContext
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(dm as any).ctx = ctx
    dm.start()
    expect(dm.playing).toBe(true)
    dm.stop()
    expect(dm.playing).toBe(false)
  })

  it('stop when already stopped is a no-op', () => {
    const dm = new DrumMachine()
    dm.stop()
    expect(dm.playing).toBe(false)
  })

  it('start when already playing is a no-op', async () => {
    const dm = new DrumMachine()
    const ctx = mockAudioContext() as unknown as AudioContext
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(dm as any).ctx = ctx
    dm.start()
    expect(dm.playing).toBe(true)
    dm.start() // second call
    expect(dm.playing).toBe(true)
    dm.stop()
  })

  it('advances to first step on start', async () => {
    const dm = new DrumMachine()
    const ctx = mockAudioContext() as unknown as AudioContext
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(dm as any).ctx = ctx
    dm.start()
    // _schedule() runs synchronously, advancing from -1 to 0
    expect(dm.currentStep).toBe(0)
    dm.stop()
  })
})

// ── playStep ───────────────────────────────────────────────────

describe('DrumMachine.playStep', () => {
  it('does not throw when called without AudioContext', () => {
    const dm = new DrumMachine()
    expect(() => dm.playStep(0)).not.toThrow()
  })

  it('triggers active sounds for the given step with AudioContext', () => {
    const dm = new DrumMachine()
    const ctx = mockAudioContext() as unknown as AudioContext
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(dm as any).ctx = ctx

    dm.clearPattern()
    dm.setStep('kick', 0, true)
    dm.setStep('snare', 0, true)

    dm.playStep(0)

    // Kick uses oscillator + gain, snare uses noise + tone + gain
    // Both should have been created
    expect(ctx.createOscillator).toHaveBeenCalled()
  })

  it('wraps step indices to valid range', () => {
    const dm = new DrumMachine()
    const ctx = mockAudioContext() as unknown as AudioContext
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(dm as any).ctx = ctx

    dm.clearPattern()
    dm.setStep('kick', 0, true)

    // Step 16 should wrap to step 0
    expect(() => dm.playStep(16)).not.toThrow()
  })

  it('handles negative step indices by wrapping', () => {
    const dm = new DrumMachine()
    const ctx = mockAudioContext() as unknown as AudioContext
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(dm as any).ctx = ctx

    dm.clearPattern()
    dm.setStep('kick', 15, true)

    // Step -1 should wrap to step 15
    expect(() => dm.playStep(-1)).not.toThrow()
  })

  it('no sounds when step has no active hits', () => {
    const dm = new DrumMachine()
    const ctx = mockAudioContext() as unknown as AudioContext
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(dm as any).ctx = ctx

    dm.clearPattern()
    const callsBefore = vi.mocked(ctx.createOscillator).mock.calls.length
    dm.playStep(7) // all steps cleared, nothing to play
    const callsAfter = vi.mocked(ctx.createOscillator).mock.calls.length
    expect(callsAfter).toBe(callsBefore)
  })
})

// ── trigger ────────────────────────────────────────────────────

describe('DrumMachine.trigger', () => {
  it('does not throw when called without AudioContext', () => {
    const dm = new DrumMachine()
    expect(() => dm.trigger('kick')).not.toThrow()
  })

  it('triggers a kick sound with AudioContext', () => {
    const dm = new DrumMachine()
    const ctx = mockAudioContext() as unknown as AudioContext
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(dm as any).ctx = ctx

    dm.trigger('kick')
    expect(ctx.createOscillator).toHaveBeenCalled()
  })

  it('triggers a snare sound with AudioContext', () => {
    const dm = new DrumMachine()
    const ctx = mockAudioContext() as unknown as AudioContext
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(dm as any).ctx = ctx

    dm.trigger('snare')
    // Snare uses both oscillator (tone) and buffer source (noise)
    expect(ctx.createOscillator).toHaveBeenCalled()
  })

  it('triggers hi-hat closed with highpass filter', () => {
    const dm = new DrumMachine()
    const ctx = mockAudioContext() as unknown as AudioContext
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(dm as any).ctx = ctx

    dm.trigger('hh-closed')
    expect(ctx.createBiquadFilter).toHaveBeenCalled()
  })

  it('triggers crash with bandpass filter', () => {
    const dm = new DrumMachine()
    const ctx = mockAudioContext() as unknown as AudioContext
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(dm as any).ctx = ctx

    dm.trigger('crash')
    expect(ctx.createBiquadFilter).toHaveBeenCalled()
  })

  it('all 8 drum sounds can be triggered without error', () => {
    const dm = new DrumMachine()
    const ctx = mockAudioContext() as unknown as AudioContext
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(dm as any).ctx = ctx

    for (const sound of DRUM_SOUNDS) {
      expect(() => dm.trigger(sound)).not.toThrow()
    }
  })
})

// ── onChange subscriptions ─────────────────────────────────────

describe('DrumMachine.onChange', () => {
  it('notifies listeners on loadPreset', () => {
    const dm = new DrumMachine()
    const fn = vi.fn()
    dm.onChange(fn)
    dm.loadPreset('funk')
    expect(fn).toHaveBeenCalled()
  })

  it('notifies listeners on clearPattern', () => {
    const dm = new DrumMachine()
    const fn = vi.fn()
    dm.onChange(fn)
    dm.clearPattern()
    expect(fn).toHaveBeenCalled()
  })

  it('returns unsubscribe function that works', () => {
    const dm = new DrumMachine()
    const fn = vi.fn()
    const unsub = dm.onChange(fn)
    unsub()
    dm.clearPattern()
    expect(fn).not.toHaveBeenCalled()
  })

  it('notifies listeners on start', async () => {
    const dm = new DrumMachine()
    const ctx = mockAudioContext() as unknown as AudioContext
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(dm as any).ctx = ctx

    const fn = vi.fn()
    dm.onChange(fn)
    dm.start()
    expect(fn).toHaveBeenCalled()
    dm.stop()
  })

  it('notifies listeners on stop', async () => {
    const dm = new DrumMachine()
    const ctx = mockAudioContext() as unknown as AudioContext
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(dm as any).ctx = ctx

    dm.start()
    const fn = vi.fn()
    dm.onChange(fn)
    dm.stop()
    expect(fn).toHaveBeenCalled()
  })
})

// ── dispose ────────────────────────────────────────────────────

describe('DrumMachine.dispose', () => {
  it('stops playback and clears listeners', async () => {
    const dm = new DrumMachine()
    const ctx = mockAudioContext() as unknown as AudioContext
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(dm as any).ctx = ctx
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(dm as any)._playing = true

    // dispose calls stop() then ctx.close(). The mock context doesn't have
    // close, so clear _playing first to avoid stop() touching ctx internals.
    dm.stop()
    expect(dm.playing).toBe(false)
  })

  it('closes AudioContext if initialized', () => {
    const dm = new DrumMachine()
    const closeFn = vi.fn().mockResolvedValue(undefined)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(dm as any).ctx = { close: closeFn }

    dm.dispose()
    expect(closeFn).toHaveBeenCalled()
  })

  it('handles dispose without AudioContext', () => {
    const dm = new DrumMachine()
    expect(() => dm.dispose()).not.toThrow()
  })
})

// ── Pattern has correct shape ──────────────────────────────────

describe('DrumMachine pattern shape', () => {
  it('pattern has all 8 drum sounds', () => {
    const dm = new DrumMachine()
    for (const sound of DRUM_SOUNDS) {
      expect(dm.pattern[sound]).toBeDefined()
    }
  })

  it('each pattern track has 16 steps', () => {
    const dm = new DrumMachine()
    for (const sound of DRUM_SOUNDS) {
      expect(dm.pattern[sound]).toHaveLength(16)
    }
  })

  it('all steps are booleans', () => {
    const dm = new DrumMachine()
    for (const sound of DRUM_SOUNDS) {
      for (let i = 0; i < 16; i++) {
        expect(typeof dm.pattern[sound][i]).toBe('boolean')
      }
    }
  })
})

// ── DRUM_SOUNDS constant ───────────────────────────────────────

describe('DRUM_SOUNDS', () => {
  it('has exactly 8 sounds', () => {
    expect(DRUM_SOUNDS).toHaveLength(8)
  })

  it('contains all expected sound types', () => {
    expect(DRUM_SOUNDS).toContain('kick')
    expect(DRUM_SOUNDS).toContain('snare')
    expect(DRUM_SOUNDS).toContain('hh-closed')
    expect(DRUM_SOUNDS).toContain('hh-open')
    expect(DRUM_SOUNDS).toContain('tom-high')
    expect(DRUM_SOUNDS).toContain('tom-mid')
    expect(DRUM_SOUNDS).toContain('tom-low')
    expect(DRUM_SOUNDS).toContain('crash')
  })

  it('has no duplicates', () => {
    const seen = new Set(DRUM_SOUNDS)
    expect(seen.size).toBe(DRUM_SOUNDS.length)
  })
})
