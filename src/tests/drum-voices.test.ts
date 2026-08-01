// ============================================================
// Drum Voices Tests — shared percussion synthesis recipes
// ============================================================

import { describe, expect, it, vi } from 'vitest'
import { DRUM_LANE_BY_MIDI, DRUM_LANE_SCALE, DRUM_LANES, drumVoiceForMidi, } from '@/lib/drum-lanes'
import type { DrumVoiceId } from '@/lib/drum-voices'
import { DRUM_VOICES, triggerDrumVoice } from '@/lib/drum-voices'

// ── Shared AudioContext mock builder ───────────────────────────
// Mirrors the builder in drum-machine.test.ts, extended to record every
// created node so the output graph and gain peaks can be asserted.

interface MockAudioParam {
  value: number
  setValueAtTime: ReturnType<typeof vi.fn>
  exponentialRampToValueAtTime: ReturnType<typeof vi.fn>
}

interface MockNode {
  connect: ReturnType<typeof vi.fn>
  disconnect: ReturnType<typeof vi.fn>
}

interface MockGainNode extends MockNode {
  gain: MockAudioParam
}

interface MockSourceNode extends MockNode {
  start: ReturnType<typeof vi.fn>
  stop: ReturnType<typeof vi.fn>
}

function mockAudioParam(): MockAudioParam {
  return {
    value: 0,
    setValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
  }
}

function mockAudioContext() {
  const gains: MockGainNode[] = []
  const sources: MockSourceNode[] = []
  const filters: MockNode[] = []
  // The context's own destination and the destination handed to the voice
  // must be DISTINCT nodes — voices may only ever connect to the latter.
  const ctxDestination: MockNode = { connect: vi.fn(), disconnect: vi.fn() }
  const destination: MockNode = { connect: vi.fn(), disconnect: vi.fn() }

  const raw = {
    sampleRate: 44100,
    currentTime: 0,
    destination: ctxDestination,
    createGain: vi.fn().mockImplementation(() => {
      const node: MockGainNode = {
        gain: mockAudioParam(),
        connect: vi.fn(),
        disconnect: vi.fn(),
      }
      gains.push(node)
      return node
    }),
    createOscillator: vi.fn().mockImplementation(() => {
      const node: MockSourceNode & {
        type: string
        frequency: MockAudioParam
      } = {
        type: 'sine',
        frequency: mockAudioParam(),
        start: vi.fn(),
        stop: vi.fn(),
        connect: vi.fn(),
        disconnect: vi.fn(),
      }
      sources.push(node)
      return node
    }),
    createBiquadFilter: vi.fn().mockImplementation(() => {
      const node: MockNode & {
        type: string
        frequency: { value: number }
        Q: { value: number }
        gain: { value: number }
      } = {
        type: 'lowpass',
        frequency: { value: 1000 },
        Q: { value: 0.5 },
        gain: { value: 0 },
        connect: vi.fn(),
        disconnect: vi.fn(),
      }
      filters.push(node)
      return node
    }),
    createBuffer: vi
      .fn()
      .mockImplementation((_channels: number, length: number) => ({
        numberOfChannels: 1,
        sampleRate: 44100,
        length,
        getChannelData: vi.fn().mockReturnValue(new Float32Array(length)),
      })),
    createBufferSource: vi.fn().mockImplementation(() => {
      const node: MockSourceNode & { buffer: unknown } = {
        buffer: null,
        start: vi.fn(),
        stop: vi.fn(),
        connect: vi.fn(),
        disconnect: vi.fn(),
      }
      sources.push(node)
      return node
    }),
  }

  return {
    ctx: raw as unknown as BaseAudioContext,
    raw,
    gains,
    sources,
    filters,
    ctxDestination,
    destination,
    dest: destination as unknown as AudioNode,
  }
}

const ALL_VOICE_IDS = Object.keys(DRUM_VOICES) as DrumVoiceId[]

/** Highest peak scheduled on any gain param via setValueAtTime. */
function maxScheduledGain(gains: MockGainNode[]): number {
  let max = 0
  for (const gain of gains) {
    for (const call of gain.gain.setValueAtTime.mock.calls) {
      const value = call[0] as number
      if (value > max) max = value
    }
  }
  return max
}

// ── Voice contract: every voice, same three guarantees ─────────

describe('DRUM_VOICES', () => {
  it('defines exactly the 12 expected voices', () => {
    expect(ALL_VOICE_IDS).toHaveLength(12)
    for (const id of [
      'kick',
      'snare',
      'sidestick',
      'clap',
      'hh-closed',
      'hh-pedal',
      'hh-open',
      'tom-low',
      'tom-mid',
      'tom-high',
      'crash',
      'ride',
    ]) {
      expect(ALL_VOICE_IDS).toContain(id)
    }
  })

  for (const id of ALL_VOICE_IDS) {
    describe(id, () => {
      it('starts at least one source', () => {
        const { ctx, sources, dest } = mockAudioContext()
        DRUM_VOICES[id](ctx, 0, 0.8, dest)
        expect(sources.length).toBeGreaterThan(0)
        const started = sources.filter((s) => s.start.mock.calls.length > 0)
        expect(started.length).toBeGreaterThan(0)
        // Every started source is also scheduled to stop
        for (const source of started) {
          expect(source.stop).toHaveBeenCalled()
        }
      })

      it('routes its output gain to the passed destination, never ctx.destination', () => {
        const { ctx, gains, sources, filters, destination, dest } =
          mockAudioContext()
        DRUM_VOICES[id](ctx, 0, 0.8, dest)

        const gainTargets = gains.flatMap((g) => g.connect.mock.calls)
        expect(gainTargets.some((call) => call[0] === destination)).toBe(true)

        for (const node of [...gains, ...sources, ...filters]) {
          for (const call of node.connect.mock.calls) {
            expect(call[0]).not.toBe(ctx.destination)
          }
        }
      })

      it('scales its peak gain with the volume argument', () => {
        const full = mockAudioContext()
        DRUM_VOICES[id](full.ctx, 0, 1.0, full.dest)
        const peakAtFull = maxScheduledGain(full.gains)
        expect(peakAtFull).toBeGreaterThan(0)

        const half = mockAudioContext()
        DRUM_VOICES[id](half.ctx, 0, 0.5, half.dest)
        const peakAtHalf = maxScheduledGain(half.gains)

        expect(peakAtHalf).toBeCloseTo(peakAtFull * 0.5, 6)
      })
    })
  }
})

describe('triggerDrumVoice', () => {
  it('dispatches to the matching voice recipe', () => {
    const { ctx, raw, gains, destination, dest } = mockAudioContext()
    triggerDrumVoice('hh-closed', ctx, 0, 0.8, dest)
    // Closed hat = noise through a highpass into a gain on the destination
    expect(raw.createBufferSource).toHaveBeenCalled()
    expect(raw.createBiquadFilter).toHaveBeenCalled()
    const gainTargets = gains.flatMap((g) => g.connect.mock.calls)
    expect(gainTargets.some((call) => call[0] === destination)).toBe(true)
  })
})

// ── Drum lanes: GM mapping for the compose drum kit ────────────

describe('DRUM_LANES', () => {
  it('has 12 lanes in strictly descending MIDI order', () => {
    expect(DRUM_LANES).toHaveLength(12)
    for (let i = 1; i < DRUM_LANES.length; i++) {
      expect(DRUM_LANES[i].midi).toBeLessThan(DRUM_LANES[i - 1].midi)
    }
  })

  it('maps each GM number to the expected voice', () => {
    const byMidi = Object.fromEntries(
      DRUM_LANES.map((lane) => [lane.midi, lane.voice]),
    )
    expect(byMidi).toEqual({
      51: 'ride',
      50: 'tom-high',
      49: 'crash',
      47: 'tom-mid',
      46: 'hh-open',
      45: 'tom-low',
      44: 'hh-pedal',
      42: 'hh-closed',
      39: 'clap',
      38: 'snare',
      37: 'sidestick',
      36: 'kick',
    })
  })

  it('every lane voice exists in DRUM_VOICES, with label, shortLabel, and icon', () => {
    for (const lane of DRUM_LANES) {
      expect(DRUM_VOICES[lane.voice]).toBeTypeOf('function')
      expect(lane.label.length).toBeGreaterThan(0)
      expect(lane.shortLabel.length).toBeGreaterThan(0)
      // Path2D-compatible path data: SVG path commands and coordinates only
      expect(lane.iconPath).toMatch(/^[MmLlHhVvAaCcQqSsTtZz0-9 .,-]+$/)
    }
  })

  it('DRUM_LANE_SCALE mirrors the lanes with real GM note names', () => {
    expect(DRUM_LANE_SCALE).toHaveLength(DRUM_LANES.length)
    const byMidi = Object.fromEntries(
      DRUM_LANE_SCALE.map((degree) => [
        degree.midi,
        `${degree.name}${degree.octave}`,
      ]),
    )
    expect(byMidi[36]).toBe('C2')
    expect(byMidi[38]).toBe('D2')
    expect(byMidi[42]).toBe('F#2')
    expect(byMidi[51]).toBe('D#3')
    for (const degree of DRUM_LANE_SCALE) {
      expect(degree.semitone).toBe(degree.midi % 12)
      expect(degree.freq).toBeGreaterThan(0)
    }
  })

  it('drumVoiceForMidi resolves lanes and returns null for unknown numbers', () => {
    expect(drumVoiceForMidi(36)).toBe('kick')
    expect(drumVoiceForMidi(51)).toBe('ride')
    expect(drumVoiceForMidi(40)).toBeNull()
    expect(drumVoiceForMidi(0)).toBeNull()
    expect(DRUM_LANE_BY_MIDI.get(42)?.label).toBe('Closed Hat')
  })
})
