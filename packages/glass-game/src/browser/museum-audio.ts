// Museum soundtrack — lazy approved scene loops, persisted mix, and a silent microphone handoff.
import type { GlassMuseumAudio, MuseumAudioPreferences, MuseumAudioScene, } from '../host'
import { repairMuseumLoop } from './museum-loop'
import { createMuseumOutput } from './museum-output'

export interface MuseumAudioOptions {
  assetUrl(id: string): string
  readPreference(key: string): string | null
  writePreference(key: string, value: string): void
}

const PREFERENCE_KEY = 'museum-audio:v1'
const DEFAULTS: MuseumAudioPreferences = {
  muted: false,
  musicVolume: 0.65,
  ambienceVolume: 0.55,
}
const SCENES: Record<MuseumAudioScene, readonly [string, string]> = {
  museum: ['audio-m01-loop', 'audio-a01-loop'],
  garden: ['audio-m03-loop', 'audio-a02-loop'],
  gallery: ['audio-m01-loop', 'audio-a03-loop'],
  journey: ['audio-m03-loop', 'audio-a02-loop'],
}
const clampVolume = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.min(1, value))
    : fallback

function readPreferences(options: MuseumAudioOptions): MuseumAudioPreferences {
  try {
    const value = JSON.parse(options.readPreference(PREFERENCE_KEY) ?? 'null')
    return {
      muted: value?.muted === true,
      musicVolume: clampVolume(value?.musicVolume, DEFAULTS.musicVolume),
      ambienceVolume: clampVolume(
        value?.ambienceVolume,
        DEFAULTS.ambienceVolume,
      ),
    }
  } catch {
    return { ...DEFAULTS }
  }
}

export function createBrowserMuseumAudio(
  options: MuseumAudioOptions,
): GlassMuseumAudio {
  let preferences = readPreferences(options)
  let disposed = false
  let generation = 0
  let wanted: MuseumAudioScene | undefined
  let active:
    | { scene: MuseumAudioScene; output: ReturnType<typeof createMuseumOutput> }
    | undefined
  let pending:
    | {
        scene: MuseumAudioScene
        promise: Promise<boolean>
        abort: AbortController
      }
    | undefined
  const outputs = new Set<ReturnType<typeof createMuseumOutput>>()
  // At most one music and one ambience buffer are retained between encounters.
  // A scene crossfade temporarily also owns its outgoing buffers until release.
  const cache = new Map<string, AudioBuffer>()
  const positions = new Map<string, number>()

  function rememberActive(): void {
    if (!active) return
    const heads = active.output.playheads()
    SCENES[active.scene].forEach((id, index) => {
      if (heads[index] !== undefined) positions.set(id, heads[index])
    })
  }

  function cancelPending(): void {
    generation++
    pending?.abort.abort()
    pending = undefined
  }

  function stop(clearIntent = true): Promise<void> {
    if (clearIntent) wanted = undefined
    cancelPending()
    rememberActive()
    active = undefined
    return Promise.all([...outputs].map((output) => output.release())).then(
      () => undefined,
    )
  }

  async function load(
    id: string,
    context: AudioContext,
    signal: AbortSignal,
  ): Promise<AudioBuffer> {
    const cached = cache.get(id)
    if (cached) return cached
    const response = await fetch(options.assetUrl(id), { signal })
    if (!response.ok) throw new Error(`Museum audio unavailable: ${id}`)
    const bytes = await response.arrayBuffer()
    if (signal.aborted) throw new Error('Museum audio cancelled')
    const decoded = await context.decodeAudioData(bytes)
    if (signal.aborted || disposed) throw new Error('Museum audio cancelled')
    const repaired = repairMuseumLoop(context, decoded)
    const category = id.startsWith('audio-m') ? 'audio-m' : 'audio-a'
    for (const key of cache.keys())
      if (key.startsWith(category)) cache.delete(key)
    cache.set(id, repaired)
    return repaired
  }

  function start(scene: MuseumAudioScene = 'museum'): Promise<boolean> {
    if (disposed) return Promise.resolve(false)
    wanted = scene
    if (preferences.muted) return Promise.resolve(true)
    if (pending?.scene === scene) return pending.promise
    if (!pending && active?.scene === scene && !active.output.isClosed())
      return Promise.resolve(true)
    cancelPending()
    const token = generation
    const abort = new AbortController()
    const output = createMuseumOutput(() => {
      void stop()
    })
    outputs.add(output)
    void output.finished.then(() => {
      outputs.delete(output)
    })
    const timer = setTimeout(() => abort.abort(), 15_000)
    const cancelled = new Promise<false>((resolve) => {
      abort.signal.addEventListener('abort', () => resolve(false), {
        once: true,
      })
    })
    const work = async (): Promise<boolean> => {
      try {
        if (
          !(await output.unlocked) ||
          !output.context ||
          abort.signal.aborted ||
          token !== generation ||
          output.isClosed()
        )
          return false
        const buffers = await Promise.all(
          SCENES[scene].map((id) => load(id, output.context!, abort.signal)),
        )
        if (
          disposed ||
          abort.signal.aborted ||
          token !== generation ||
          output.isClosed()
        )
          return false
        rememberActive()
        if (
          !output.play(
            buffers,
            preferences,
            SCENES[scene].map((id) => positions.get(id) ?? 0),
          )
        )
          return false
        const previous = active
        active = { scene, output }
        void previous?.output.release()
        return true
      } catch {
        return false
      }
    }
    const promise = Promise.race([work(), cancelled]).then((started) => {
      clearTimeout(timer)
      if (token === generation) pending = undefined
      if (!started) {
        abort.abort()
        void output.release()
      }
      return started
    })
    pending = { scene, promise, abort }
    return promise
  }

  return {
    start,
    async silenceForVoice() {
      const silence = stop()
      const token = generation
      await silence
      if (generation !== token)
        throw new Error('The audio handoff was cancelled.')
    },
    pause() {
      void stop()
    },
    preferences: () => ({ ...preferences }),
    setPreferences(patch) {
      if (disposed) return
      const wasMuted = preferences.muted
      preferences = {
        muted:
          typeof patch.muted === 'boolean' ? patch.muted : preferences.muted,
        musicVolume: clampVolume(patch.musicVolume, preferences.musicVolume),
        ambienceVolume: clampVolume(
          patch.ambienceVolume,
          preferences.ambienceVolume,
        ),
      }
      try {
        options.writePreference(PREFERENCE_KEY, JSON.stringify(preferences))
      } catch {
        /* Private storage may be unavailable. */
      }
      if (preferences.muted && (wanted || active || pending)) void stop(false)
      else if (wasMuted && wanted) void start(wanted)
      else active?.output.setVolumes(preferences)
    },
    dispose() {
      if (disposed) return
      disposed = true
      void stop()
      cache.clear()
      positions.clear()
    },
  }
}
