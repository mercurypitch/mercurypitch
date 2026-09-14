// Session drummer UI state persists choices, never playback, and retires late audio activation on Stop.
import type { Accessor } from 'solid-js'
import { createEffect, createSignal, onCleanup, untrack } from 'solid-js'
import type { GuitarSessionAudioGraph } from '@/features/guitar/backing/guitar-session-audio-graph'
import { browserGuitarNightDrumSoundStorage, readGuitarNightDrumSound, } from '@/features/guitar-night/guitar-night-drum-sound'
import type { SubscribeSessionBeat } from '@/lib/session-beat-clock'
import type { createSessionDrummerEngine } from './session-drummer-engine'
import type { SessionDrummerSettings } from './session-drummer-pattern'
import { DRUMMER_STORAGE_KEY, normalizeDrummerSettings, surpriseDrummer, } from './session-drummer-pattern'

export interface SessionDrummerHost {
  activateGraph(): Promise<GuitarSessionAudioGraph | null>
  /** Null means an independent manual-tempo jam, not an inferred song beat grid. */
  clock: Accessor<SubscribeSessionBeat | null>
  tempo: Accessor<number | null>
  running: Accessor<boolean>
  startHost(): Promise<void> | void
  blocked?: Accessor<boolean>
  unavailableReason?: Accessor<string | null>
}

export function useSessionDrummer(host: SessionDrummerHost) {
  const storage = browserGuitarNightDrumSoundStorage()
  let saved: unknown
  try {
    saved = JSON.parse(storage?.getItem(DRUMMER_STORAGE_KEY) ?? 'null')
  } catch {
    saved = null
  }
  const [settings, setSettings] = createSignal(
    normalizeDrummerSettings(saved, readGuitarNightDrumSound().kitId),
  )
  const [active, setActive] = createSignal<SessionDrummerSettings | null>(null)
  const [armed, setArmed] = createSignal(false)
  const [busy, setBusy] = createSignal(false)
  const [bar, setBar] = createSignal(-1)
  const [error, setError] = createSignal<string | null>(null)
  const [open, setOpen] = createSignal(false)
  let engine: ReturnType<typeof createSessionDrummerEngine> | null = null
  let unsubscribe: (() => void) | undefined
  let generation = 0
  let disposed = false
  const stop = () => {
    generation++
    engine?.stop()
    setArmed(false)
    setBusy(false)
    setBar(-1)
  }
  const save = (next: SessionDrummerSettings) => {
    const normalized = normalizeDrummerSettings(next)
    setSettings(normalized)
    try {
      storage?.setItem(DRUMMER_STORAGE_KEY, JSON.stringify(normalized))
    } catch {
      /* Device storage may be denied. */
    }
    return normalized
  }
  createEffect(() => {
    const clock = host.clock()
    untrack(stop)
    unsubscribe?.()
    unsubscribe = clock?.((event) => {
      engine?.accept(event)
      if (event.kind === 'stop') setBar(-1)
    })
  })
  createEffect(() => {
    const blocked = host.blocked?.()
    const unavailable = host.unavailableReason?.()
    if (blocked === true || (unavailable ?? null) !== null) untrack(stop)
  })
  const start = async (next = settings()) => {
    if (
      disposed ||
      busy() ||
      host.blocked?.() === true ||
      (host.unavailableReason?.() ?? null) !== null
    )
      return
    const operation = ++generation
    const clock = host.clock()
    const shouldStartHost = clock !== null && !host.running()
    setBusy(true)
    setError(null)
    try {
      // Unlock the host within the gesture, before waiting for the optional chunk.
      const [graph, module] = await Promise.all([
        host.activateGraph(),
        import('./session-drummer-engine'),
      ])
      if (disposed || operation !== generation) return
      if (!graph)
        throw new Error(
          'Audio could not start. Check your output and try again.',
        )
      engine ??= module.createSessionDrummerEngine({
        activateGraph: async () => graph,
        onBar: setBar,
        onApplied: setActive,
      })
      const started = await engine.start(next, clock !== null)
      if (disposed || operation !== generation) return
      if (!started)
        throw new Error('The drum player could not start. Please try again.')
      setArmed(true)
      if (shouldStartHost && !host.running()) {
        // Yield the modal before the host requests Listening or mic consent.
        setOpen(false)
        await host.startHost()
      }
    } catch (cause) {
      if (!disposed && operation === generation) {
        stop()
        setError(
          cause instanceof Error ? cause.message : 'Drummer could not start.',
        )
      }
    } finally {
      if (!disposed && operation === generation) setBusy(false)
    }
  }
  onCleanup(() => {
    disposed = true
    generation++
    unsubscribe?.()
    void engine?.dispose()
  })
  return {
    settings,
    active,
    armed,
    busy,
    bar,
    error,
    unavailableReason: () => host.unavailableReason?.() ?? null,
    open,
    setOpen,
    stop,
    followsScore: () => host.clock() !== null,
    tempo: () => (host.clock() !== null ? host.tempo() : settings().tempoBpm),
    waiting: () => armed() && bar() < 0,
    changed: () =>
      armed() && JSON.stringify(active()) !== JSON.stringify(settings()),
    snapshot: () => engine?.snapshot() ?? null,
    change: (patch: Partial<SessionDrummerSettings>) =>
      save({ ...settings(), ...patch }),
    setLevel: (level: number) => {
      const next = save({ ...settings(), level })
      engine?.setLevel(next.level)
      setActive((current) => current && { ...current, level: next.level })
    },
    start: () => start(),
    apply: () => engine?.update(settings()),
    surprise: () => {
      const next = save(surpriseDrummer(settings()))
      if (armed()) engine?.update(next)
      else void start(next)
    },
  }
}

export type SessionDrummerController = ReturnType<typeof useSessionDrummer>
