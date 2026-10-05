// Merc narration — bounded one-shot dialogue with persisted opt-out and microphone-safe silence.
import { acquireSharedAudioContext } from '@irchiinnuss/audio-io'
import { fetchAssetBytes } from '@irchiinnuss/mobile-runtime/asset-fetch'
import type { GlassMercNarration, MercNarrationCue, MercNarrationPreferences, } from '../host'
import { reportAudioAssetFailure } from './audio-asset-failure'
import type { SpeechEnvelope } from './speech-envelope'
import { createSpeechEnvelope, speechEnvelopeAt } from './speech-envelope'

export interface MercNarrationOptions {
  assetUrl(id: string): string
  readPreference(key: string): string | null
  writePreference(key: string, value: string): void
}

const PREFERENCE_KEY = 'merc-narration:v1'
const FLOOR = 0.0001
const RELEASE_MS = 120
const START_TIMEOUT_MS = 1800
type NarrationStartStage =
  | 'asset-url'
  | 'audio-output'
  | 'loading'
  | 'decode'
  | 'release'
  | 'playback'
const ASSETS: Record<MercNarrationCue, string> = {
  'tutorial-note': 'merc-voice-welcome',
  'required-break': 'merc-voice-path-open',
  'optional-break': 'merc-voice-optional-break',
  'beautiful-mess': 'merc-voice-beautiful-mess',
  'little-disaster': 'merc-voice-little-disaster',
  sparkling: 'merc-voice-sparkling',
  'glass-had-plans': 'merc-voice-glass-had-plans',
  'music-to-my-ears': 'merc-voice-music-to-my-ears',
  'cracking-performance': 'merc-voice-cracking-performance',
}

function readPreferences(
  options: MercNarrationOptions,
): MercNarrationPreferences {
  try {
    const value = JSON.parse(options.readPreference(PREFERENCE_KEY) ?? 'null')
    return { enabled: value?.enabled !== false }
  } catch {
    return { enabled: true }
  }
}

function createNarrationOutput(onInterrupted: () => void) {
  let closed = false
  let releasing = false
  let unlocking = true
  let source: AudioBufferSourceNode | undefined
  let envelope: SpeechEnvelope | undefined
  let startedAt = 0
  let deadline = 0
  let timer: ReturnType<typeof setTimeout> | undefined
  let resolveFinished!: () => void
  const finished = new Promise<void>((resolve) => {
    resolveFinished = resolve
  })
  const lease = acquireSharedAudioContext('glass-merc-narration', {
    prepareToSuspend: () => {
      onInterrupted()
      void release()
      return Math.max(0, deadline - Date.now())
    },
  })
  let context: AudioContext | null
  let bus: GainNode | undefined
  try {
    context = lease.ensure()
    bus = context?.createGain()
    if (context && bus) {
      bus.gain.setValueAtTime(FLOOR, context.currentTime)
      bus.connect(context.destination)
    }
  } catch (error) {
    lease.release()
    throw error
  }

  function finish(): void {
    if (closed) return
    closed = true
    envelope = undefined
    clearTimeout(timer)
    deadline = 0
    if (source) {
      source.onended = null
      try {
        source.stop()
      } catch {
        /* Already stopped. */
      }
      source.disconnect()
      source = undefined
    }
    bus?.disconnect()
    context?.removeEventListener('statechange', changed)
    lease.release()
    resolveFinished()
  }

  function release(): Promise<void> {
    if (releasing || closed) return finished
    releasing = true
    if (!context || !bus || !source || context.state !== 'running') {
      finish()
      return finished
    }
    const at = context.currentTime
    bus.gain.cancelScheduledValues(at)
    bus.gain.setTargetAtTime(0, at, RELEASE_MS / 5000)
    deadline = Date.now() + RELEASE_MS
    try {
      source.stop(at + RELEASE_MS / 1000)
    } catch {
      /* Already stopped. */
    }
    timer = setTimeout(finish, RELEASE_MS)
    return finished
  }

  function changed(): void {
    if (context?.state === 'running' || closed) return
    // A previous owner's queued suspension may race this gesture's unlock.
    if (unlocking && context?.state === 'suspended' && !source) return
    onInterrupted()
    finish()
  }
  context?.addEventListener('statechange', changed)
  // This is reached synchronously from play(), before its first await.
  let unlocked: Promise<boolean>
  try {
    unlocked = (context ? lease.unlock() : Promise.resolve(false)).then(
      (available) => {
        unlocking = false
        return available
      },
    )
  } catch (error) {
    finish()
    throw error
  }

  return {
    context,
    unlocked,
    finished,
    release,
    outputLevel(): number {
      if (
        closed ||
        releasing ||
        !source ||
        !envelope ||
        context?.state !== 'running'
      )
        return 0
      return speechEnvelopeAt(envelope, context.currentTime - startedAt)
    },
    play(buffer: AudioBuffer): boolean {
      if (
        !context ||
        !bus ||
        closed ||
        releasing ||
        context.state !== 'running'
      )
        return false
      envelope = createSpeechEnvelope(buffer)
      const at = context.currentTime
      startedAt = at
      const next = context.createBufferSource()
      next.buffer = buffer
      next.connect(bus)
      next.onended = finish
      source = next
      bus.gain.cancelScheduledValues(at)
      bus.gain.setValueAtTime(FLOOR, at)
      bus.gain.exponentialRampToValueAtTime(1, at + 0.018)
      next.start(at)
      return true
    },
  }
}

export function createBrowserMercNarration(
  options: MercNarrationOptions,
): GlassMercNarration {
  let preferences = readPreferences(options)
  let disposed = false
  let generation = 0
  const reportedFailures = new Set<string>()
  const attempts = new Set<{
    token: number
    abort: AbortController
    output: ReturnType<typeof createNarrationOutput>
  }>()
  let current:
    | {
        token: number
        abort: AbortController
        output: ReturnType<typeof createNarrationOutput>
      }
    | undefined

  function reportStartFailure(
    cue: MercNarrationCue,
    stage: NarrationStartStage,
    reason: 'failed' | 'timed out' | 'unavailable',
  ): void {
    const key = `${cue}:${stage}:${reason}`
    if (reportedFailures.has(key)) return
    reportedFailures.add(key)
    // Fixed cue/stage/reason only: platform errors can contain private URLs.
    reportAudioAssetFailure(
      'merc-narration',
      new Error(`Merc cue ${cue}: ${stage} ${reason}.`),
    )
  }

  function retireAll(): Promise<void> {
    generation++
    current = undefined
    const retiring = [...attempts]
    for (const attempt of retiring) attempt.abort.abort()
    return Promise.all(
      retiring.map((attempt) => attempt.output.release()),
    ).then(() => undefined)
  }

  function play(cue: MercNarrationCue): Promise<boolean> {
    if (disposed || !preferences.enabled) return Promise.resolve(false)

    let url: string
    try {
      url = options.assetUrl(ASSETS[cue])
    } catch {
      reportStartFailure(cue, 'asset-url', 'failed')
      return Promise.resolve(false)
    }

    const previous = retireAll()
    const token = ++generation
    const abort = new AbortController()
    let output: ReturnType<typeof createNarrationOutput>
    try {
      output = createNarrationOutput(() => abort.abort())
    } catch {
      abort.abort()
      reportStartFailure(cue, 'audio-output', 'failed')
      return Promise.resolve(false)
    }
    const attempt = { token, abort, output }
    attempts.add(attempt)
    current = attempt
    void output.finished.then(() => {
      attempts.delete(attempt)
      if (current === attempt) current = undefined
    })
    // Start transport during the same gesture as the context unlock.
    let stage: NarrationStartStage = 'loading'
    const asset = fetchAssetBytes(url, { signal: abort.signal })
    const timeout = setTimeout(() => {
      if (abort.signal.aborted || token !== generation || disposed) return
      reportStartFailure(cue, stage, 'timed out')
      abort.abort()
    }, START_TIMEOUT_MS)
    const cancelled = new Promise<false>((resolve) => {
      abort.signal.addEventListener('abort', () => resolve(false), {
        once: true,
      })
    })
    const work = async (): Promise<boolean> => {
      try {
        const [available, bytes] = await Promise.all([output.unlocked, asset])
        if (abort.signal.aborted || token !== generation || disposed)
          return false
        if (!available) {
          reportStartFailure(cue, 'audio-output', 'unavailable')
          return false
        }
        stage = 'decode'
        const decoded = await output.context?.decodeAudioData(bytes)
        if (
          abort.signal.aborted ||
          token !== generation ||
          disposed ||
          !preferences.enabled
        )
          return false
        if (!decoded) {
          reportStartFailure(cue, stage, 'unavailable')
          return false
        }
        stage = 'release'
        await previous
        if (
          abort.signal.aborted ||
          token !== generation ||
          disposed ||
          !preferences.enabled
        )
          return false
        stage = 'playback'
        const playing = output.play(decoded)
        if (!playing) reportStartFailure(cue, stage, 'unavailable')
        return playing
      } catch {
        if (!abort.signal.aborted && !disposed)
          reportStartFailure(cue, stage, 'failed')
        return false
      }
    }
    const started = Promise.race([work(), cancelled]).then(
      (playing) => {
        clearTimeout(timeout)
        if (!playing) {
          abort.abort()
          void output.release()
          if (current === attempt) current = undefined
        }
        return playing
      },
      () => {
        clearTimeout(timeout)
        if (!abort.signal.aborted && !disposed)
          reportStartFailure(cue, stage, 'failed')
        abort.abort()
        void output.release()
        if (current === attempt) current = undefined
        return false
      },
    )
    return started
  }

  return {
    play,
    outputLevel: () => current?.output.outputLevel() ?? 0,
    silenceForVoice: retireAll,
    pause() {
      void retireAll()
    },
    preferences: () => ({ ...preferences }),
    setPreferences(patch) {
      if (disposed) return
      preferences = {
        enabled:
          typeof patch.enabled === 'boolean'
            ? patch.enabled
            : preferences.enabled,
      }
      try {
        options.writePreference(PREFERENCE_KEY, JSON.stringify(preferences))
      } catch {
        /* Private storage may be unavailable. */
      }
      if (!preferences.enabled) void retireAll()
    },
    dispose() {
      if (disposed) return
      disposed = true
      void retireAll()
    },
  }
}
