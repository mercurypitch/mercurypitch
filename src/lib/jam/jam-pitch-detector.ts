// ── JamPitchDetector ──────────────────────────────────────────────────
// Lightweight pitch detector for P2P jam sessions.
// Own AudioContext + AnalyserNode, separate from the main app's audio engine.

import type { DetectedPitch } from '../pitch-detector'
import { PitchDetector } from '../pitch-detector'

export type JamPitchCallback = (pitch: DetectedPitch) => void

export class JamPitchDetector {
  private ctx: AudioContext | null = null
  private analyser: AnalyserNode | null = null
  private source: MediaStreamAudioSourceNode | null = null
  private detector: PitchDetector
  private rafId = 0
  private running = false
  private timeData: Float32Array

  onPitch: JamPitchCallback | null = null

  constructor() {
    this.detector = new PitchDetector({
      sampleRate: 48000,
      bufferSize: 2048,
      algorithm: 'yin',
      minConfidence: 0.3,
      minAmplitude: 0.02,
    })
    this.timeData = new Float32Array(this.detector.getBufferSize())
  }

  start(stream: MediaStream): void {
    if (this.running) return
    this.ctx = new AudioContext({ sampleRate: 48000 })
    this.source = this.ctx.createMediaStreamSource(stream)
    this.analyser = this.ctx.createAnalyser()
    this.analyser.fftSize = 2048
    this.analyser.smoothingTimeConstant = 0
    this.source.connect(this.analyser)
    this.running = true
    this.loop()
  }

  stop(): void {
    this.running = false
    if (this.rafId) {
      cancelAnimationFrame(this.rafId)
      this.rafId = 0
    }
    this.source?.disconnect()
    this.source = null
    this.analyser = null
    this.ctx?.close()
    this.ctx = null
    this.detector.resetHistory()
  }

  getLatestPitch(): DetectedPitch | null {
    // No buffering — caller can cache the latest from onPitch
    return null
  }

  /** Latest RMS input level (0–1) for mic-feedback insights; 0 when stopped. */
  getInputLevel(): number {
    if (!this.running) return 0
    const d = this.timeData
    let sum = 0
    for (let i = 0; i < d.length; i++) sum += d[i] * d[i]
    return d.length > 0 ? Math.sqrt(sum / d.length) : 0
  }

  private loop = (): void => {
    if (!this.running || !this.analyser) return
    this.analyser.getFloatTimeDomainData(
      this.timeData as Float32Array<ArrayBuffer>,
    )
    const pitch = this.detector.detect(this.timeData)
    if (pitch.frequency > 0) {
      this.onPitch?.(pitch)
    }
    this.rafId = requestAnimationFrame(this.loop)
  }
}
