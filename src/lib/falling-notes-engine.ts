// ============================================================
// Falling Notes Engine — Lightweight mic + pitch adapter for
// Synthesia-style piano practice
// ============================================================

import type { AudioEngine } from './audio-engine'
import { PitchDetector } from './pitch-detector'

export interface FallingNotesEngineCallbacks {
  onPitchDetected?: (
    pitch: {
      frequency: number
      clarity: number
      noteName: string
      octave: number
      cents: number
    } | null,
  ) => void
  onMicStateChange?: (active: boolean, error?: string) => void
}

export class FallingNotesEngine {
  private audioEngine: AudioEngine
  private detector: PitchDetector
  private micActive = false
  private sampleRate = 44100
  private bufferSize = 2048

  callbacks: FallingNotesEngineCallbacks = {}

  constructor(audioEngine: AudioEngine) {
    this.audioEngine = audioEngine
    this.detector = new PitchDetector({
      sampleRate: this.sampleRate,
      bufferSize: this.bufferSize,
      sensitivity: 5,
    })
  }

  // ── Mic ──────────────────────────────────────────────────

  async startMic(): Promise<boolean> {
    try {
      await this.audioEngine.init()
      await this.audioEngine.resume()

      // Reinitialize PitchDetector with the actual AudioContext sample rate
      const actualSampleRate = this.audioEngine.getSampleRate()
      const actualBufferSize = this.audioEngine.getBufferSize()
      if (
        actualSampleRate !== this.sampleRate ||
        actualBufferSize !== this.bufferSize
      ) {
        this.sampleRate = actualSampleRate
        this.bufferSize = actualBufferSize
        this.detector = new PitchDetector({
          sampleRate: this.sampleRate,
          bufferSize: this.bufferSize,
          sensitivity: 5,
        })
      }

      const ok = await this.audioEngine.startMic()
      if (ok) {
        this.micActive = true
        this.detector.resetHistory()
        this.callbacks.onMicStateChange?.(true)
        return true
      }
      this.callbacks.onMicStateChange?.(false, 'Microphone access denied')
      return false
    } catch (err) {
      console.error('[FallingNotesEngine] Mic start error:', err)
      this.callbacks.onMicStateChange?.(false, String(err))
      return false
    }
  }

  stopMic(): void {
    if (!this.micActive) return
    this.audioEngine.stopMic()
    this.micActive = false
    this.callbacks.onMicStateChange?.(false)
  }

  isMicActive(): boolean {
    return this.micActive && this.audioEngine.isMicActive()
  }

  // ── Pitch Detection ──────────────────────────────────────

  detectPitch(): {
    frequency: number
    clarity: number
    noteName: string
    octave: number
    cents: number
  } | null {
    if (!this.micActive) return null

    const timeData = this.audioEngine.getTimeData()
    const result = this.detector.detect(timeData)

    if (!result.noteName || result.frequency === 0) {
      return null
    }

    return {
      frequency: result.frequency,
      clarity: result.clarity,
      noteName: result.noteName,
      octave: result.octave,
      cents: result.cents,
    }
  }

  // ── Waveform ─────────────────────────────────────────────

  getWaveformData(): Float32Array {
    return this.audioEngine.getWaveformData()
  }

  // ── Cleanup ──────────────────────────────────────────────

  destroy(): void {
    this.stopMic()
  }
}
