// ============================================================
// Local whisper listener — the phase-2 on-device ear
// ============================================================
//
// VoiceListener over MicManager + an RMS voice-activity gate + the
// voice-stt worker. The gate segments speech into 0.2-3.6 s utterances so
// the model only ever sees actual talking. Capture runs at the context's
// NATIVE rate — forcing a 16 kHz AudioContext breaks on Firefox, which
// refuses to connect a MediaStream whose device rate differs from the
// context — and each finished utterance is resampled to the model's 16 kHz
// offline. A ScriptProcessorNode does the tapping (AudioWorklet +
// MediaStreamSource resampling outputs silence on Chrome — same reason
// ShazamListen uses it), a pre-roll ring keeps the first syllable, an
// adaptive noise floor tracks the room, and ~0.4 s of silence flushes.
// Unlike the Web Speech engine this one holds the shared mic, so it
// registers with MicManager AND the mic sentinel, and releases both
// unconditionally on stop. Reports end-of-speech-to-text latency through
// onLatency.

import { micManager } from '@/lib/mic-manager'
import { registerMicIndicator } from '@/lib/mic-sentinel'
import type { VoiceListener, VoiceListenerCallbacks } from './types'
import { sharedVoiceSttService } from './voice-stt-service'

const MIC_CONSUMER_ID = 'voice-control'
const MODEL_SAMPLE_RATE = 16_000
const FRAME_SIZE = 1024

// Voice-activity gate in milliseconds; frame counts derive from the actual
// context rate at start (1024 samples is 64 ms at 16 kHz but only ~21 ms at
// 48 kHz, so hardcoded frame counts would triple every window on Firefox).
const PREROLL_MS = 384
const START_MS = 128
const END_SILENCE_MS = 384
const MIN_SPEECH_MS = 192
const MAX_UTTERANCE_MS = 3600
/** Silence appended after the utterance; whisper decodes cleaner with a tail. */
const TAIL_PAD_MS = 240

const ABS_THRESHOLD_MIN = 0.012
const NOISE_FLOOR_ALPHA = 0.05
const NOISE_FLOOR_RATIO = 3.5

export interface LocalListenerOptions {
  /** Override the STT model (e.g. Moonshine); defaults to whisper-tiny. */
  modelId?: string
}

/** Offline-renders mono PCM to the model's 16 kHz. */
async function resampleForModel(
  data: Float32Array<ArrayBuffer>,
  fromRate: number,
): Promise<Float32Array> {
  if (fromRate === MODEL_SAMPLE_RATE) return data
  const offline = new OfflineAudioContext(
    1,
    Math.max(1, Math.ceil((data.length * MODEL_SAMPLE_RATE) / fromRate)),
    MODEL_SAMPLE_RATE,
  )
  const buffer = offline.createBuffer(1, data.length, fromRate)
  buffer.copyToChannel(data, 0)
  const source = offline.createBufferSource()
  source.buffer = buffer
  source.connect(offline.destination)
  source.start(0)
  const rendered = await offline.startRendering()
  return rendered.getChannelData(0)
}

export function createLocalWhisperListener(
  callbacks: VoiceListenerCallbacks,
  options?: LocalListenerOptions,
): VoiceListener {
  let started = false
  let runGeneration = 0
  let micHeld = false
  let unregisterIndicator: (() => void) | null = null
  let audioCtx: AudioContext | null = null
  let source: MediaStreamAudioSourceNode | null = null
  let script: ScriptProcessorNode | null = null

  // Derived per start() from the context's real rate.
  let captureRate = MODEL_SAMPLE_RATE
  let prerollFrames = 6
  let startFrames = 2
  let endSilenceFrames = 6
  let minSpeechFrames = 3
  let maxUtteranceFrames = 56

  // Gate state.
  let preroll: Float32Array[] = []
  let utterance: Float32Array[] = []
  let inSpeech = false
  let risingFrames = 0
  let speechFrames = 0
  let silenceFrames = 0
  let noiseFloor = 0.005
  /** EMA of in-speech loudness — calibrates the floor on forced flushes. */
  let speechRms = 0

  // One decode in flight, at most one waiting, LATEST WINS: under speaker
  // bleed the gate can outpace the model, and a backlog of stale music
  // chunks decoding late is exactly how one spoken command turns into
  // several delayed executions.
  let transcribeInFlight = false
  let queuedUtterance: {
    buffer: Float32Array<ArrayBuffer>
    queuedAt: number
  } | null = null

  const service = () => sharedVoiceSttService(options?.modelId)

  const resetGate = () => {
    preroll = []
    utterance = []
    inSpeech = false
    risingFrames = 0
    speechFrames = 0
    silenceFrames = 0
    queuedUtterance = null
  }

  const runTranscribe = (
    buffer: Float32Array<ArrayBuffer>,
    startedAt: number,
  ) => {
    transcribeInFlight = true
    const generation = runGeneration
    resampleForModel(buffer, captureRate)
      .then((resampled) => {
        if (generation !== runGeneration) return null
        return service().transcribe(resampled)
      })
      .then((text) => {
        if (text === null || generation !== runGeneration) return
        callbacks.onLatency?.(performance.now() - startedAt)
        const trimmed = text.trim()
        if (trimmed !== '') callbacks.onUtterance(trimmed)
      })
      .catch((err: unknown) => {
        if (generation !== runGeneration) return
        console.warn('[voice-control] local transcription failed:', err)
      })
      .finally(() => {
        transcribeInFlight = false
        const queued = queuedUtterance
        queuedUtterance = null
        if (queued !== null && started && generation === runGeneration) {
          runTranscribe(queued.buffer, queued.queuedAt)
        }
      })
  }

  const submitUtterance = (buffer: Float32Array<ArrayBuffer>) => {
    if (transcribeInFlight) {
      queuedUtterance = { buffer, queuedAt: performance.now() }
      return
    }
    runTranscribe(buffer, performance.now())
  }

  const flushUtterance = (forcedByLength: boolean) => {
    const frames = utterance
    const voicedFrames = speechFrames
    utterance = []
    inSpeech = false
    risingFrames = 0
    speechFrames = 0
    silenceFrames = 0

    // A gate pinned open for the whole window means the "speech" is really
    // sustained loud audio (the backing track through speakers). Raise the
    // floor toward that loudness so the gate closes against it instead of
    // feeding the model music forever.
    if (forcedByLength) {
      noiseFloor = Math.max(noiseFloor, speechRms * 0.5)
    }

    if (voicedFrames < minSpeechFrames) return

    const tailSamples = Math.round((TAIL_PAD_MS / 1000) * captureRate)
    let total = 0
    for (const frame of frames) total += frame.length
    const buffer = new Float32Array(total + tailSamples)
    let offset = 0
    for (const frame of frames) {
      buffer.set(frame, offset)
      offset += frame.length
    }

    submitUtterance(buffer)
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
      if (preroll.length > prerollFrames) preroll.shift()
      if (rms > threshold) {
        risingFrames++
        if (risingFrames >= startFrames) {
          inSpeech = true
          utterance = [...preroll]
          speechFrames = risingFrames
          silenceFrames = 0
          speechRms = rms
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
      speechRms = 0.9 * speechRms + 0.1 * rms
      // Constant loud input drifts the floor upward even mid-"speech", so
      // a playing song cannot hold the gate open indefinitely.
      noiseFloor = 0.995 * noiseFloor + 0.005 * rms
    } else {
      silenceFrames++
    }
    if (utterance.length >= maxUtteranceFrames) {
      flushUtterance(true)
    } else if (silenceFrames >= endSilenceFrames) {
      flushUtterance(false)
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
      const modelReady = service().init()
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
      // Native rate on purpose — see the header.
      audioCtx = new AudioContext()
      captureRate = audioCtx.sampleRate
      const frameMs = (FRAME_SIZE / captureRate) * 1000
      const framesFor = (ms: number) => Math.max(1, Math.round(ms / frameMs))
      prerollFrames = framesFor(PREROLL_MS)
      startFrames = framesFor(START_MS)
      endSilenceFrames = framesFor(END_SILENCE_MS)
      minSpeechFrames = framesFor(MIN_SPEECH_MS)
      maxUtteranceFrames = framesFor(MAX_UTTERANCE_MS)

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
