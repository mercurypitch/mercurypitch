// Merc narration — bounded one-shot dialogue with persisted opt-out and microphone-safe silence.
import { acquireSharedAudioContext } from '@irchiinnuss/audio-io'
import type { GlassMercNarration, MercNarrationCue, MercNarrationPreferences, } from '../host'

export interface MercNarrationOptions {
  assetUrl(id: string): string
  readPreference(key: string): string | null
  writePreference(key: string, value: string): void
}

const PREFERENCE_KEY = 'merc-narration:v1'
const FLOOR = 0.0001
const RELEASE_MS = 120
const START_TIMEOUT_MS = 1800
const ASSETS: Record<MercNarrationCue, string> = {
  'tutorial-note': 'merc-voice-welcome',
  'required-break': 'merc-voice-path-open',
  'optional-break': 'merc-voice-optional-break',
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
    play(buffer: AudioBuffer): boolean {
      if (
        !context ||
        !bus ||
        closed ||
        releasing ||
        context.state !== 'running'
      )
        return false
      const at = context.currentTime
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
      return Promise.resolve(false)
    }
    const attempt = { token, abort, output }
    attempts.add(attempt)
    current = attempt
    void output.finished.then(() => {
      attempts.delete(attempt)
      if (current === attempt) current = undefined
    })
    let response: Promise<Response>
    try {
      // Start transport during the same gesture as the context unlock.
      response = fetch(url, { signal: abort.signal })
    } catch {
      abort.abort()
      void output.release()
      if (current === attempt) current = undefined
      return Promise.resolve(false)
    }
    const timeout = setTimeout(() => abort.abort(), START_TIMEOUT_MS)
    const cancelled = new Promise<false>((resolve) => {
      abort.signal.addEventListener('abort', () => resolve(false), {
        once: true,
      })
    })
    const work = async (): Promise<boolean> => {
      try {
        const [available, fetched] = await Promise.all([
          output.unlocked,
          response,
        ])
        if (!available || !fetched.ok || abort.signal.aborted) return false
        const bytes = await fetched.arrayBuffer()
        if (abort.signal.aborted || token !== generation || disposed)
          return false
        const decoded = await output.context?.decodeAudioData(bytes)
        if (
          !decoded ||
          abort.signal.aborted ||
          token !== generation ||
          disposed ||
          !preferences.enabled
        )
          return false
        await previous
        if (
          abort.signal.aborted ||
          token !== generation ||
          disposed ||
          !preferences.enabled
        )
          return false
        return output.play(decoded)
      } catch {
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
