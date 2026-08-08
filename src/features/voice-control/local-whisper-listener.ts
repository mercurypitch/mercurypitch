// ============================================================
// Local whisper listener — the phase-2 on-device ear
// ============================================================
//
// VoiceListener over MicManager + an RMS voice-activity gate + the
// voice-stt worker (whisper-tiny). The gate segments speech into 0.2-3.6 s
// utterances so the model only ever sees actual talking: capture runs at
// 16 kHz through a ScriptProcessorNode (AudioWorklet + MediaStreamSource
// resampling outputs silence on Chrome — same reason ShazamListen uses it),
// keeps a pre-roll ring so the first syllable is not clipped, tracks an
// adaptive noise floor, and flushes on ~0.4 s of silence. Unlike the Web
// Speech engine this one holds the shared mic, so it registers with
// MicManager AND the mic sentinel, and releases both unconditionally on
// stop. Reports end-of-speech to text latency through onLatency.

import { micManager } from '@/lib/mic-manager'
import { registerMicIndicator } from '@/lib/mic-sentinel'
import type { VoiceListener, VoiceListenerCallbacks } from './types'
import { sharedVoiceSttService } from './voice-stt-service'

const MIC_CONSUMER_ID = 'voice-control'
const SAMPLE_RATE = 16_000
const FRAME_SIZE = 1024 // 64 ms per onaudioprocess callback

// Voice-activity gate, all in ~64 ms frames.
const PREROLL_FRAMES = 6 // ~384 ms kept from before the trigger
const START_FRAMES = 2 // consecutive loud frames to open
const END_SILENCE_FRAMES = 6 // ~384 ms of quiet closes the utterance
const MIN_SPEECH_FRAMES = 3 // shorter than ~192 ms of voice is a cough
const MAX_UTTERANCE_FRAMES = 56 // ~3.6 s hard flush
const ABS_THRESHOLD_MIN = 0.012
const NOISE_FLOOR_ALPHA = 0.05
const NOISE_FLOOR_RATIO = 3.5
/** Silence appended after the utterance; whisper decodes cleaner with a tail. */
const TAIL_PAD_SAMPLES = 3840

export function createLocalWhisperListener(
  callbacks: VoiceListenerCallbacks,
): VoiceListener {
  let started = false
  let runGeneration = 0
  let micHeld = false
  let unregisterIndicator: (() => void) | null = null
  let audioCtx: AudioContext | null = null
  let source: MediaStreamAudioSourceNode | null = null
  let script: ScriptProcessorNode | null = null

  // Gate state.
  let preroll: Float32Array[] = []
  let utterance: Float32Array[] = []
  let inSpeech = false
  let risingFrames = 0
  let speechFrames = 0
  let silenceFrames = 0
  let noiseFloor = 0.005

  const resetGate = () => {
    preroll = []
    utterance = []
    inSpeech = false
    risingFrames = 0
    speechFrames = 0
    silenceFrames = 0
  }

  const flushUtterance = () => {
    const frames = utterance
    const voicedFrames = speechFrames
    utterance = []
    inSpeech = false
    risingFrames = 0
    speechFrames = 0
    silenceFrames = 0
    if (voicedFrames < MIN_SPEECH_FRAMES) return

    let total = 0
    for (const frame of frames) total += frame.length
    const buffer = new Float32Array(total + TAIL_PAD_SAMPLES)
    let offset = 0
    for (const frame of frames) {
      buffer.set(frame, offset)
      offset += frame.length
    }

    const generation = runGeneration
    const startedAt = performance.now()
    sharedVoiceSttService()
      .transcribe(buffer)
      .then((text) => {
        if (generation !== runGeneration) return
        callbacks.onLatency?.(performance.now() - startedAt)
        const trimmed = text.trim()
        if (trimmed !== '') callbacks.onUtterance(trimmed)
      })
      .catch((err: unknown) => {
        if (generation !== runGeneration) return
        console.warn('[voice-control] local transcription failed:', err)
      })
  }

  const handleAudio = (e: AudioProcessingEvent) => {
    const input = e.inputBuffer.getChannelData(0)
    let sum = 0
    for (let i = 0; i < input.length; i++) sum += input[i] * input[i]
    const rms = Math.sqrt(sum / input.length)
    const threshold = Math.max(
      ABS_THRESHOLD_MIN,
      noiseFloor * NOISE_FLOOR_RATIO,
    )
    const frame = input.slice()

    if (!inSpeech) {
      preroll.push(frame)
      if (preroll.length > PREROLL_FRAMES) preroll.shift()
      if (rms > threshold) {
        risingFrames++
        if (risingFrames >= START_FRAMES) {
          inSpeech = true
          utterance = [...preroll]
          speechFrames = risingFrames
          silenceFrames = 0
        }
      } else {
        risingFrames = 0
        noiseFloor =
          (1 - NOISE_FLOOR_ALPHA) * noiseFloor + NOISE_FLOOR_ALPHA * rms
      }
      return
    }

    utterance.push(frame)
    if (rms > threshold) {
      speechFrames++
      silenceFrames = 0
    } else {
      silenceFrames++
    }
    if (
      silenceFrames >= END_SILENCE_FRAMES ||
      utterance.length >= MAX_UTTERANCE_FRAMES
    ) {
      flushUtterance()
    }
  }

  const teardownCapture = () => {
    if (script !== null) {
      script.disconnect()
      script.onaudioprocess = null
      script = null
    }
    if (source !== null) {
      source.disconnect()
      source = null
    }
    if (audioCtx !== null) {
      void audioCtx.close()
      audioCtx = null
    }
    if (unregisterIndicator !== null) {
      unregisterIndicator()
      unregisterIndicator = null
    }
    if (micHeld) {
      micHeld = false
      micManager.release(MIC_CONSUMER_ID)
    }
    resetGate()
  }

  const stopInternal = () => {
    if (!started) return
    started = false
    runGeneration++
    teardownCapture()
    callbacks.onInterim('')
    callbacks.onStateChange('idle')
  }

  const startAsync = async () => {
    const generation = ++runGeneration
    callbacks.onStateChange('starting')
    try {
      const service = sharedVoiceSttService()
      const modelReady = service.init()
      const stream = await micManager.acquire(MIC_CONSUMER_ID)
      micHeld = true
      if (!started || generation !== runGeneration) {
        micHeld = false
        micManager.release(MIC_CONSUMER_ID)
        return
      }
      unregisterIndicator = registerMicIndicator(
        'voice-control',
        () => micHeld,
        () => {
          stopInternal()
        },
      )
      audioCtx = new AudioContext({ sampleRate: SAMPLE_RATE })
      source = audioCtx.createMediaStreamSource(stream)
      script = audioCtx.createScriptProcessor(FRAME_SIZE, 1, 1)
      script.onaudioprocess = handleAudio
      source.connect(script)
      // The processor must reach the destination or onaudioprocess never
      // fires; its output buffer stays silent so nothing is audible.
      script.connect(audioCtx.destination)
      if (audioCtx.state === 'suspended') void audioCtx.resume()

      await modelReady
      if (!started || generation !== runGeneration) return
      callbacks.onStateChange('listening')
    } catch (err) {
      console.error('[voice-control] local engine start failed:', err)
      teardownCapture()
      started = false
      const detail =
        err instanceof DOMException && err.name === 'NotAllowedError'
          ? 'not-allowed'
          : 'local-engine-failed'
      callbacks.onStateChange('error', detail)
    }
  }

  return {
    // WASM fallback means this engine runs anywhere with a mic.
    isSupported: true,
    start: () => {
      if (started) return
      started = true
      resetGate()
      void startAsync()
    },
    stop: stopInternal,
  }
}
