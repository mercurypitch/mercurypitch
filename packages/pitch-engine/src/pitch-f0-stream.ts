// ============================================================
// Shared F0 frame stream over the mic (Beside Cue's sung drivers).
//
// Bridges the app's capture chain (MicManager stream → audio graph) and
// the YIN detector into pure pitch frames. Each frame also carries the
// analysed window's RMS level (`rms`) — the glass fatigue model needs
// per-frame loudness; narrower consumers see the same frames through the
// `F0Frame` contract.
//
// Deliberately uses only the 'yin' algorithm — no SwiftF0/ONNX — so the
// standalone entries ship no model weights (bundle rule).
//
// ---
//
// It used to poll an AnalyserNode inside requestAnimationFrame, which
// made the pitch hop equal to the frame interval: 16 ms while the
// renderer was idle, 33 ms while it was not, and the audio in between
// analysed by nobody. For a game whose input is the voice that is the
// worst available coupling — the harder the scene, the worse the singing
// feels — so detection now runs on the audio clock instead:
//
//   capture worklet (audio thread)  cuts fixed 2048-sample windows at a
//                                   1024-sample hop, stamps each on the
//                                   audio clock, computes its RMS
//   detector worker                 runs YIN, off the main thread
//   here                            assembles frames, publishes the level
//
// The frame loop survives as a fallback for engines without AudioWorklet,
// or when the module fails to load. Both paths feed the same pure
// assembler, so a take recorded either way is the same shape.
// ============================================================

import workletUrl from './f0-capture.worklet.ts?worker&url'
import type { PitchFrame } from './f0-frames'
import { createFrameAssembler } from './f0-frames'
import type { F0CaptureMessage, F0WorkerResult } from './f0-worklet-contract'
import { F0_CAPTURE_PROCESSOR, F0_HOP, F0_WINDOW } from './f0-worklet-contract'
import { publishMicLevel, resetMicLevel } from './mic-level'
import { PitchDetector } from './pitch-detector'

export type { PitchFrame }

/** Human singing range with headroom; keeps YIN off subharmonics. */
const MIN_FREQUENCY = 60
const MAX_FREQUENCY = 1600

/**
 * The mirror captures with AGC off (required for honest pitch), so raw
 * mobile input is quiet — the detector's 0.02 default RMS gate would
 * reject normal singing at arm's length on a phone.
 */
const MIN_AMPLITUDE = 0.005

/** Assumed hop for the fallback path, where the frame loop sets the pace. */
const FRAME_HOP_SECONDS = 1 / 60

export interface F0Stream {
  /** Begin a task recording: clears frames and re-zeroes the clock. */
  startTask: () => void
  /** Frames captured since the last startTask(), time-relative to it. */
  takeFrames: () => PitchFrame[]
  /** The most recent frame, for live visual feedback (null before any). */
  latest: () => PitchFrame | null
  /**
   * The most recent frame with a display/gameplay smoothing pass on top of
   * the detector's own stability filter: a median over the last few VOICED
   * readings (kills residual octave flickers) and short-gap bridging (the
   * held pitch survives consonants and quick breaths for ~130 ms instead
   * of collapsing to unvoiced). Recorded `takeFrames()` stay RAW so
   * metrics remain honest — this view is for ribbons and resonance.
   */
  latestSmoothed: () => PitchFrame | null
  /** RMS input level of the most recent analysed window (0..1). */
  latestLevel: () => number
  /** Highest RMS level observed since the last startTask(). */
  maxLevel: () => number
  /** Tear down the audio graph (does not stop the MediaStream itself). */
  dispose: () => void
}

/**
 * Create the F0 stream. The caller owns the MediaStream (via micManager)
 * and the AudioContext (created inside a user gesture for iOS Safari);
 * this owns everything downstream of them.
 */
export function createF0Stream(
  audioContext: AudioContext,
  stream: MediaStream,
): F0Stream {
  const source = audioContext.createMediaStreamSource(stream)
  // Muted sink: a node with no path to the destination is not pulled by
  // the graph at all, and some WebKit versions only reliably pull an
  // analyser that is transitively connected. Zero gain keeps it silent.
  const keepalive = audioContext.createGain()
  keepalive.gain.value = 0
  keepalive.connect(audioContext.destination)

  const assembler = createFrameAssembler(FRAME_HOP_SECONDS)
  let takeStart = audioContext.currentTime
  let disposed = false

  // --- the audio-clock path -------------------------------------------

  let workletNode: AudioWorkletNode | null = null
  let worker: Worker | null = null

  const attachAudioClockPath = async (): Promise<boolean> => {
    if (typeof audioContext.audioWorklet?.addModule !== 'function') return false
    try {
      await audioContext.audioWorklet.addModule(workletUrl)
      if (disposed) return false

      // DOWN-MIX TO MONO AT THE NODE, and this line is load-bearing.
      //
      // `channelCountMode` defaults to 'max', which makes the node's
      // input as wide as whatever is connected -- so a stereo capture
      // arrives as two channels and the processor, which reads channel
      // zero, hears only the left one. On a laptop's built-in
      // microphone that is invisible: the stream is mono, or both
      // channels carry the same thing. On an audio interface it is not.
      // A Focusrite Scarlett presented by PipeWire as "Analog Surround
      // 4.1" hands Chrome two channels with the singer on ONE of them,
      // and if that one is not the left, the detector reads digital
      // silence, reports no pitch, and raises nothing to explain it --
      // while the AnalyserNode fallback path a few lines down works
      // perfectly, because AnalyserNode down-mixes by default.
      //
      // 'explicit' plus 'speakers' is the spec's stereo-to-mono sum,
      // (L+R)/2, done by the engine before the processor runs: no cost
      // on the audio thread and no channel can go unheard.
      const node = new AudioWorkletNode(audioContext, F0_CAPTURE_PROCESSOR, {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        outputChannelCount: [1],
        channelCount: 1,
        channelCountMode: 'explicit',
        channelInterpretation: 'speakers',
      })
      const detectorWorker = new Worker(
        new URL('./f0-detector.worker.ts', import.meta.url),
        { type: 'module' },
      )
      detectorWorker.postMessage({
        kind: 'configure',
        sampleRate: audioContext.sampleRate,
        minFrequency: MIN_FREQUENCY,
        maxFrequency: MAX_FREQUENCY,
        minAmplitude: MIN_AMPLITUDE,
      })

      node.port.onmessage = (event: MessageEvent<F0CaptureMessage>) => {
        const { samples, atFrame, rms } = event.data
        // The meter moves while the singer positions the mic, long
        // before they ever hit record.
        publishMicLevel(rms)
        // YIN only while a take is running: during briefs and reference
        // tones the frames would be discarded anyway, and a full window
        // 47 times a second is real battery on a phone.
        if (!assembler.isRecording()) return
        detectorWorker.postMessage({ kind: 'window', samples, atFrame, rms }, [
          samples.buffer,
        ])
      }

      detectorWorker.onerror = () => {
        // The worker's script never loaded (a stale index.html after a
        // redeploy, a CSP without worker-src). The worklet kept the meter
        // moving while every window posted into a dead worker and pitch
        // stayed null for good. The frame loop needs no worker.
        if (disposed || worker !== detectorWorker) return
        node.port.onmessage = null
        source.disconnect(node)
        node.disconnect()
        detectorWorker.terminate()
        workletNode = null
        worker = null
        startFrameLoop()
      }

      detectorWorker.onmessage = (event: MessageEvent<F0WorkerResult>) => {
        const { atFrame, rms, f0, conf } = event.data
        assembler.ingest({
          t: atFrame / audioContext.sampleRate - takeStart,
          f0,
          conf,
          rms,
        })
      }

      source.connect(node)
      node.connect(keepalive)
      workletNode = node
      worker = detectorWorker
      assembler.setHopSeconds(F0_HOP / audioContext.sampleRate)
      return true
    } catch {
      // An old engine, a blocked asset, a worker the CSP refused. The
      // frame loop is coarser but it is a working microphone, which is
      // the thing that actually matters.
      return false
    }
  }

  // --- the frame-loop fallback ----------------------------------------

  let analyser: AnalyserNode | null = null
  let fallbackDetector: PitchDetector | null = null
  let rafId = 0

  const startFrameLoop = (): void => {
    if (disposed) return
    const node = audioContext.createAnalyser()
    node.fftSize = F0_WINDOW
    source.connect(node)
    node.connect(keepalive)
    analyser = node

    const detector = new PitchDetector({
      sampleRate: audioContext.sampleRate,
      bufferSize: F0_WINDOW,
      algorithm: 'yin',
      minFrequency: MIN_FREQUENCY,
      maxFrequency: MAX_FREQUENCY,
      minAmplitude: MIN_AMPLITUDE,
    })
    fallbackDetector = detector

    const buffer = new Float32Array(F0_WINDOW)
    const loop = (): void => {
      if (disposed) return
      rafId = requestAnimationFrame(loop)
      node.getFloatTimeDomainData(buffer)

      let sumSquares = 0
      for (let i = 0; i < buffer.length; i++) {
        sumSquares += buffer[i] * buffer[i]
      }
      const rms = Math.sqrt(sumSquares / buffer.length)
      publishMicLevel(rms)
      if (!assembler.isRecording()) return

      const detected = detector.detect(buffer)
      assembler.ingest({
        t: audioContext.currentTime - takeStart,
        f0: detected.frequency,
        conf: detected.clarity,
        rms,
      })
    }
    rafId = requestAnimationFrame(loop)
  }

  void attachAudioClockPath().then((attached) => {
    if (!attached) startFrameLoop()
  })

  return {
    startTask: () => {
      takeStart = audioContext.currentTime
      assembler.startTake()
      // The detector's stability filter keeps a short pitch history that
      // would otherwise clamp the first frames of a new take toward the
      // previous task's trailing pitch.
      worker?.postMessage({ kind: 'reset' })
      fallbackDetector?.resetHistory()
    },
    takeFrames: () => assembler.takeFrames(),
    latest: () => assembler.latest(),
    latestSmoothed: () => assembler.latestSmoothed(),
    latestLevel: () => assembler.latestLevel(),
    maxLevel: () => assembler.maxLevel(),
    dispose: () => {
      disposed = true
      cancelAnimationFrame(rafId)
      if (workletNode !== null) {
        workletNode.port.onmessage = null
        workletNode.disconnect()
      }
      worker?.terminate()
      analyser?.disconnect()
      source.disconnect()
      keepalive.disconnect()
      resetMicLevel()
    },
  }
}
