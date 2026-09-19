// ── JamPitchDetector ──────────────────────────────────────────────────
// Lightweight pitch detector for P2P jam sessions.
// Own AudioContext + AnalyserNode, separate from the main app's audio engine.

import { publishMicLevel, resetMicLevel, rmsOfTimeData } from '../mic-level'
import type { DetectedPitch } from '../pitch-detector'
import { PitchDetector } from '../pitch-detector'
import type { PitchSmoother } from './jam-pitch-smoothing'
import { createPitchSmoother } from './jam-pitch-smoothing'

export type JamPitchCallback = (pitch: DetectedPitch) => void

export class JamPitchDetector {
  private ctx: AudioContext | null = null
  private analyser: AnalyserNode | null = null
  private source: MediaStreamAudioSourceNode | null = null
  private detector: PitchDetector
  private keepalive: GainNode | null = null
  private rafId = 0
  private running = false
  private timeData: Float32Array
  private smoother: PitchSmoother = createPitchSmoother()

  onPitch: JamPitchCallback | null = null

  constructor() {
    // Matched to the app's own voice path (pitch-f0-stream.ts) rather
    // than to the engine defaults, which is what this used to run on.
    this.detector = new PitchDetector({
      sampleRate: 48000,
      bufferSize: 2048,
      algorithm: 'yin',
      minConfidence: 0.3,
      // Human singing range with headroom; keeps YIN off subharmonics.
      minFrequency: 60,
      maxFrequency: 1600,
      // Jam captures with AGC off, so raw mobile input is quiet. The
      // engine's 0.02 default rejects normal singing at arm's length on
      // a phone -- which read as the trail vanishing, not as a miss.
      minAmplitude: 0.005,
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
    // Muted sink: some WebKit versions only reliably pull an analyser
    // that is (transitively) connected to the destination. Zero gain
    // keeps it silent, and stops a phone quietly reporting no pitch.
    this.keepalive = this.ctx.createGain()
    this.keepalive.gain.value = 0
    this.analyser.connect(this.keepalive)
    this.keepalive.connect(this.ctx.destination)
    this.smoother.reset()
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
    this.analyser?.disconnect()
    this.analyser = null
    this.keepalive?.disconnect()
    this.keepalive = null
    this.ctx?.close()
    this.ctx = null
    this.detector.resetHistory()
    this.smoother.reset()
    resetMicLevel()
  }

  getLatestPitch(): DetectedPitch | null {
    // No buffering — caller can cache the latest from onPitch
    return null
  }

  /** Latest RMS input level (0–1) for mic-feedback insights; 0 when stopped. */
  getInputLevel(): number {
    if (!this.running) return 0
    return rmsOfTimeData(this.timeData)
  }

  private loop = (): void => {
    if (!this.running || !this.analyser) return
    this.analyser.getFloatTimeDomainData(
      this.timeData as Float32Array<ArrayBuffer>,
    )
    // Jam runs its own AudioContext, so the shared publish inside AudioEngine
    // never fires here — the meter and the watchdog need it from this loop.
    publishMicLevel(rmsOfTimeData(this.timeData))
    const pitch = this.smoother.push(this.detector.detect(this.timeData))
    if (pitch !== null && pitch.frequency > 0) {
      this.onPitch?.(pitch)
    }
    this.rafId = requestAnimationFrame(this.loop)
  }
}
