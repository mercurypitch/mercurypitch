// ============================================================
// Shared F0 frame stream over the mic (Voice Mirror + Glass).
//
// Bridges the app's capture chain (MicManager stream → AnalyserNode)
// and the YIN detector into pure pitch frames. Analysis runs in an
// AudioWorklet (~16 ms hop counted in render quanta), which makes the
// frame rate a property of the audio clock instead of a property of
// how busy the renderer is — src/workers/pitch-f0.worklet.ts records
// what the old requestAnimationFrame poll cost when it wasn't. That
// poll is still here as the fallback for a browser without
// AudioWorklet, or a module that fails to load.
//
// Each frame also carries the buffer's RMS level (`rms`) — the glass
// fatigue model needs per-frame loudness; mirror consumers see the
// same frames through the narrower `F0Frame` contract.
//
// Deliberately uses only the 'yin' algorithm — no SwiftF0/ONNX —
// so the standalone entries ship no model weights (bundle rule).
// Lives in src/lib/ so it rides the `pitch-core` manualChunk.
// ============================================================

import { publishMicLevel, resetMicLevel } from '@/lib/mic-level'
import type { F0Frame } from '@/lib/mirror/metrics'
import type { PitchF0ProcessorOptions, PitchF0WorkletCommand, PitchF0WorkletFrame, PitchF0WorkletMessage, } from '@/lib/pitch-f0-worklet-protocol'
import { PITCH_F0_PROCESSOR } from '@/lib/pitch-f0-worklet-protocol'
import { bufferRms, createYinFrameAnalyser } from '@/lib/pitch-yin-core'
import workletUrl from '@/workers/pitch-f0.worklet.ts?worker&url'

const FFT_SIZE = 2048

/**
 * One detector definition for both threads.
 *
 * The mirror captures with AGC off (required for honest pitch), so raw mobile
 * input is quiet — the detector's 0.02 default RMS gate would reject normal
 * singing at arm's length on a phone. The frequency range is the human singing
 * range with headroom, which keeps YIN off subharmonics. Sensitivity and
 * confidence repeat PitchDetector's defaults on purpose: the worklet cannot
 * read them from a shared instance, so they are written down once here.
 */
const DETECTOR: PitchF0ProcessorOptions = {
  bufferSize: FFT_SIZE,
  sensitivity: 7,
  minFrequency: 60,
  maxFrequency: 1600,
  minAmplitude: 0.005,
  minConfidence: 0.3,
}

/**
 * How long a flush waits before giving up on the audio thread.
 *
 * Generous on purpose: it exists only so a lost reply cannot strand a capture,
 * not as a deadline. A renderer far enough behind to spend this long draining
 * its own message queue has lost the frames either way.
 */
const FLUSH_TIMEOUT_MS = 500

/** Contexts whose module registry already has the processor in it. */
const registered = new WeakSet<BaseAudioContext>()

/** An F0Frame plus the analysed buffer's RMS level (0..1). */
export interface PitchFrame extends F0Frame {
  rms: number
}

export interface F0Stream {
  /** Begin a task recording: clears frames and re-zeroes the clock. */
  startTask: () => void
  /**
   * Wait for every hop the audio thread has already analysed to arrive.
   *
   * Frames cross a MessagePort, so a renderer that is behind still owes the
   * take its most recent frames when the caller decides to stop. Await this
   * before `takeFrames()` or the tail of the window is simply dropped —
   * measured at eight Playwright workers on four cores, a 1.8 s landing came
   * back with 43 of its 104 frames. Resolves immediately when the rAF
   * fallback is running, since those frames never left this thread.
   */
  flush: () => Promise<void>
  /** Frames captured since the last startTask(), time-relative to it.
   *  Ends the recording. Await `flush()` first to include the tail. */
  takeFrames: () => PitchFrame[]
  /** The same frames so far, without ending the recording — a live
   *  view while a window is still open. */
  peekFrames: () => PitchFrame[]
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
  /** RMS input level of the most recent analysed buffer (0..1). */
  latestLevel: () => number
  /** Highest RMS level observed since the last startTask(). */
  maxLevel: () => number
  /** Tear down the audio graph (does not stop the MediaStream itself). */
  dispose: () => void
}

/**
 * Create the F0 stream. The caller owns the MediaStream (via micManager) and
 * the AudioContext (created inside a user gesture for iOS Safari); this owns
 * the analyser + detector + the worklet, or the rAF loop that stands in for it.
 */
export function createF0Stream(
  audioContext: AudioContext,
  stream: MediaStream,
): F0Stream {
  const source = audioContext.createMediaStreamSource(stream)
  const analyser = audioContext.createAnalyser()
  analyser.fftSize = FFT_SIZE
  source.connect(analyser)
  // Muted sink: some WebKit versions only reliably pull an analyser that is
  // (transitively) connected to the destination. Zero gain keeps it silent,
  // and the worklet below hangs off the same sink for the same reason.
  const keepalive = audioContext.createGain()
  keepalive.gain.value = 0
  analyser.connect(keepalive)
  keepalive.connect(audioContext.destination)

  const detector = createYinFrameAnalyser({
    ...DETECTOR,
    sampleRate: audioContext.sampleRate,
  })

  const buffer = new Float32Array(FFT_SIZE)
  let frames: PitchFrame[] = []
  let latestFrame: PitchFrame | null = null
  // Smoothed-view state (median window over voiced f0 + gap bridging).
  const MEDIAN_WINDOW = 5
  const BRIDGE_FRAMES = 8 // ~130 ms at the 16 ms hop
  let voicedRing: number[] = []
  let bridgeLeft = 0
  let heldFrame: PitchFrame | null = null
  let smoothedFrame: PitchFrame | null = null

  function updateSmoothed(frame: PitchFrame): void {
    const voiced = frame.f0 > 0 && frame.conf >= 0.5
    if (voiced) {
      voicedRing.push(frame.f0)
      if (voicedRing.length > MEDIAN_WINDOW) voicedRing.shift()
      const sorted = [...voicedRing].sort((a, b) => a - b)
      const median = sorted[Math.floor(sorted.length / 2)]
      smoothedFrame = { ...frame, f0: median }
      heldFrame = smoothedFrame
      bridgeLeft = BRIDGE_FRAMES
    } else if (bridgeLeft > 0 && heldFrame !== null) {
      // Bridge consonants/quick breaths: hold the last voiced pitch.
      bridgeLeft--
      smoothedFrame = { ...heldFrame, t: frame.t, rms: frame.rms }
    } else {
      smoothedFrame = frame
      voicedRing = []
    }
  }
  let latestRms = 0
  let maxRms = 0
  let taskStart = performance.now()
  let taskId = 0
  let rafId = 0
  let disposed = false
  let recording = false
  let workletNode: AudioWorkletNode | null = null
  let flushSequence = 0
  const pendingFlushes = new Map<number, () => void>()

  /** Record one analysed hop, whichever thread produced it. */
  function acceptFrame(frame: PitchFrame): void {
    latestRms = frame.rms
    if (latestRms > maxRms) maxRms = latestRms
    frames.push(frame)
    latestFrame = frame
    updateSmoothed(frame)
  }

  const loop = (): void => {
    if (disposed) return
    rafId = requestAnimationFrame(loop)
    analyser.getFloatTimeDomainData(buffer)

    const rms = bufferRms(buffer)
    // Publish every frame, take or no take: the singer wants to see the meter
    // move while they position the mic, before they ever hit record. One
    // sum-of-squares pass is cheap; the YIN pass below is what isn't.
    publishMicLevel(rms)

    // Only run YIN while a take is actually recording — during briefs and
    // reference-tone playback the frames would be discarded anyway, and a
    // full 2048-sample pass 60×/s is real battery on mobile.
    if (!recording) return

    const detected = detector.analyse(buffer)
    acceptFrame({
      t: (performance.now() - taskStart) / 1000,
      f0: detected.frequency,
      conf: detected.confidence,
      rms: detected.rms,
    })
  }
  rafId = requestAnimationFrame(loop)

  function command(on: boolean): void {
    const node = workletNode
    if (node === null) return
    const message: PitchF0WorkletCommand = {
      type: 'record',
      on,
      taskId,
      startedSecondsAgo: on ? (performance.now() - taskStart) / 1000 : 0,
    }
    node.port.postMessage(message)
  }

  function onWorkletMessage(message: PitchF0WorkletMessage): void {
    if (message.type === 'flushed') {
      pendingFlushes.get(message.id)?.()
      return
    }
    onWorkletFrame(message)
  }

  function onWorkletFrame(frame: PitchF0WorkletFrame): void {
    publishMicLevel(frame.rms)
    // A frame stamped for an earlier take was already in flight when this one
    // started; it belongs to nobody now.
    if (!recording || frame.taskId !== taskId) return
    acceptFrame({ t: frame.t, f0: frame.f0, conf: frame.conf, rms: frame.rms })
  }

  /**
   * Move analysis to the audio thread, or leave the rAF loop in charge.
   *
   * Deliberately not awaited by the caller: `createF0Stream` is synchronous
   * for every consumer, and the rAF loop covers the few milliseconds
   * `addModule` takes. If a take is already recording when the worklet
   * arrives, the audio thread is told how far in it is so both paths keep
   * stamping frames against the same origin.
   */
  async function attachWorklet(): Promise<void> {
    if (typeof audioContext.audioWorklet?.addModule !== 'function') return
    try {
      if (!registered.has(audioContext)) {
        await audioContext.audioWorklet.addModule(workletUrl)
        registered.add(audioContext)
      }
      if (disposed) return

      const node = new AudioWorkletNode(audioContext, PITCH_F0_PROCESSOR, {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        outputChannelCount: [1],
        // Mono down-mix, matching what AnalyserNode hands the fallback path.
        channelCount: 1,
        channelCountMode: 'explicit',
        channelInterpretation: 'speakers',
        processorOptions: DETECTOR,
      })
      node.port.onmessage = (event: MessageEvent<PitchF0WorkletMessage>) => {
        onWorkletMessage(event.data)
      }
      source.connect(node)
      node.connect(keepalive)
      workletNode = node
      // The audio thread now owns both the level and the pitch; a second
      // publisher would only fight it for the meter.
      cancelAnimationFrame(rafId)
      rafId = 0
      if (recording) command(true)
    } catch {
      // An old browser or a blocked asset: the rAF loop is still running and
      // is still a working detector, just a fragile one under load.
      workletNode = null
    }
  }
  void attachWorklet()

  function flush(): Promise<void> {
    const node = workletNode
    if (node === null) return Promise.resolve()
    const id = ++flushSequence
    return new Promise<void>((resolve) => {
      const settle = (): void => {
        if (!pendingFlushes.delete(id)) return
        clearTimeout(timer)
        resolve()
      }
      // A reply that never comes must not strand a capture: the frames already
      // delivered are then the honest answer, and one late window beats a
      // recorder that will not stop. Armed before `settle` is reachable.
      const timer = setTimeout(settle, FLUSH_TIMEOUT_MS)
      pendingFlushes.set(id, settle)
      node.port.postMessage({ type: 'flush', id })
    })
  }

  return {
    flush,
    startTask: () => {
      taskStart = performance.now()
      taskId += 1
      frames = []
      latestFrame = null
      latestRms = 0
      maxRms = 0
      recording = true
      voicedRing = []
      bridgeLeft = 0
      heldFrame = null
      smoothedFrame = null
      // The detector's stability filter keeps a short pitch history that
      // would otherwise clamp the first frames of a new take toward the
      // previous task's trailing pitch. The worklet resets its own copy when
      // the command below lands.
      detector.reset()
      command(true)
    },
    takeFrames: () => {
      recording = false
      command(false)
      const taken = frames
      frames = []
      return taken
    },
    peekFrames: () => frames.slice(),
    latest: () => latestFrame,
    latestSmoothed: () => smoothedFrame,
    latestLevel: () => latestRms,
    maxLevel: () => maxRms,
    dispose: () => {
      disposed = true
      for (const settle of [...pendingFlushes.values()]) settle()
      cancelAnimationFrame(rafId)
      const node = workletNode
      workletNode = null
      if (node !== null) {
        node.port.onmessage = null
        try {
          source.disconnect(node)
        } catch {
          // Already torn down by whoever owned the source.
        }
        node.disconnect()
      }
      source.disconnect()
      analyser.disconnect()
      keepalive.disconnect()
      resetMicLevel()
    },
  }
}
