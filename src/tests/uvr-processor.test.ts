// ============================================================
// UVR Processor Tests — EARS REQ-UV-017 (stem playback/modes)
// ============================================================

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { UvrProcessor } from '@/lib/uvr-processor'
import type { UvrSettings, UvrAnalysis } from '@/lib/uvr-processor'

describe('UvrProcessor', () => {
  let processor: UvrProcessor
  let ctx: AudioContext

  beforeEach(() => {
    processor = new UvrProcessor()
    ctx = new AudioContext()
  })

  afterEach(() => {
    processor.reset()
  })

  // ── Initial State ────────────────────────────────────

  describe('initial state', () => {
    it('defaults to "separate" mode', () => {
      expect(processor.getMode()).toBe('separate')
    })

    it('has default settings', () => {
      const settings = processor.getSettings()
      expect(settings.mode).toBe('separate')
      expect(settings.vocalIntensity).toBe(0.7)
      expect(settings.instrumentalIntensity).toBe(0.7)
      expect(settings.smoothing).toBe(0.3)
    })

    it('returns null analyser before initAudio', () => {
      expect(processor.getAnalyserNode()).toBeNull()
    })
  })

  // ── Mode Setting ─────────────────────────────────────

  describe('setMode', () => {
    it.each([
      ['separate' as const],
      ['instrumental' as const],
      ['vocal' as const],
      ['duo' as const],
    ])('sets mode to %s', (mode) => {
      processor.setMode(mode)
      expect(processor.getMode()).toBe(mode)
    })
  })

  // ── Settings ─────────────────────────────────────────

  describe('setSettings', () => {
    it('updates individual settings partially', () => {
      processor.setSettings({ vocalIntensity: 0.9 })
      const s = processor.getSettings()
      expect(s.vocalIntensity).toBe(0.9)
      expect(s.instrumentalIntensity).toBe(0.7) // unchanged
    })

    it('updates all settings at once', () => {
      const newSettings: Partial<UvrSettings> = {
        mode: 'duo',
        vocalIntensity: 0.5,
        instrumentalIntensity: 0.8,
        smoothing: 0.6,
      }
      processor.setSettings(newSettings)
      const s = processor.getSettings()
      expect(s.mode).toBe('duo')
      expect(s.vocalIntensity).toBe(0.5)
      expect(s.instrumentalIntensity).toBe(0.8)
      expect(s.smoothing).toBe(0.6)
    })
  })

  // ── Audio Init ───────────────────────────────────────

  describe('initAudio', () => {
    it('creates analyser node on init', async () => {
      await processor.initAudio(ctx)
      expect(processor.getAnalyserNode()).not.toBeNull()
    })

    it('is idempotent (no double init)', async () => {
      await processor.initAudio(ctx)
      const first = processor.getAnalyserNode()
      await processor.initAudio(ctx)
      const second = processor.getAnalyserNode()
      expect(second).toBe(first)
    })
  })

  // ── Process Segment ──────────────────────────────────

  describe('processSegment', () => {
    it('returns source node when not initialized', () => {
      const source = ctx.createGain()
      const result = processor.processSegment(source as unknown as AudioNode, 0, ctx)
      expect(result).toHaveLength(1)
      expect(result[0]).toBe(source)
    })

    it('returns 2 nodes for separate mode after init', async () => {
      await processor.initAudio(ctx)
      processor.setMode('separate')
      const source = ctx.createGain()
      const result = processor.processSegment(source as unknown as AudioNode, 0, ctx)
      expect(result).toHaveLength(2) // vocal + instrumental
    })

    it('returns 1 node for instrumental mode', async () => {
      await processor.initAudio(ctx)
      processor.setMode('instrumental')
      const source = ctx.createGain()
      const result = processor.processSegment(source as unknown as AudioNode, 0, ctx)
      expect(result).toHaveLength(1)
    })

    it('returns 1 node for vocal mode', async () => {
      await processor.initAudio(ctx)
      processor.setMode('vocal')
      const source = ctx.createGain()
      const result = processor.processSegment(source as unknown as AudioNode, 0, ctx)
      expect(result).toHaveLength(1)
    })

    it('returns 2 nodes for duo mode', async () => {
      await processor.initAudio(ctx)
      processor.setMode('duo')
      const source = ctx.createGain()
      const result = processor.processSegment(source as unknown as AudioNode, 0, ctx)
      expect(result).toHaveLength(2)
    })
  })

  // ── Analyze Buffer ───────────────────────────────────

  describe('analyzeBuffer', () => {
    it('returns defaults when not initialized', () => {
      const buffer = new Float32Array(2048)
      const result = processor.analyzeBuffer(buffer, 44100)
      expect(result.hasVocals).toBe(false)
      expect(result.isMusic).toBe(false)
    })

    it('returns analysis with correct shape when initialized', async () => {
      await processor.initAudio(ctx)

      // Signal with both low and high frequency content
      const buffer = new Float32Array(2048)
      for (let i = 0; i < buffer.length; i++) {
        // Mix 400 Hz (low) + 4000 Hz (high) to ensure isMusic is detected
        buffer[i] = Math.sin((2 * Math.PI * 400 * i) / 44100) * 0.3
          + Math.sin((2 * Math.PI * 4000 * i) / 44100) * 0.2
      }

      const result = processor.analyzeBuffer(buffer, 44100)
      expect(result).toHaveProperty('hasVocals')
      expect(result).toHaveProperty('isMusic')
      expect(result).toHaveProperty('vocalDominance')
      expect(result).toHaveProperty('hasInstrumental')
      expect(result).toHaveProperty('isVocalHeavy')
      // Non-silent buffer should register as music
      expect(result.isMusic).toBe(true)
    })

    it('detects silence as not music', async () => {
      await processor.initAudio(ctx)
      const buffer = new Float32Array(2048) // all zeros
      const result = processor.analyzeBuffer(buffer, 44100)
      expect(result.isMusic).toBe(false)
    })
  })

  // ── Reset ────────────────────────────────────────────

  describe('reset', () => {
    it('clears all state', async () => {
      await processor.initAudio(ctx)
      processor.setMode('duo')
      processor.setSettings({ vocalIntensity: 0.9 })

      processor.reset()

      expect(processor.getMode()).toBe('separate')
      expect(processor.getSettings().vocalIntensity).toBe(0.7)
      expect(processor.getAnalyserNode()).toBeNull()
    })
  })
})
