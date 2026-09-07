// ============================================================
// Guitar monitor diagnostics — observe the listening owner's existing route
// ============================================================

import type { Accessor } from 'solid-js'
import { createSignal, onCleanup } from 'solid-js'
import type { AudioRouteDiagnosticsSnapshot, AudioRouteDiagnosticsSource, } from '@/lib/audio-route-diagnostics'
import { createAudioRouteDiagnosticsReader } from '@/lib/audio-route-diagnostics'

export interface GuitarMonitorDiagnostics {
  snapshot: Accessor<AudioRouteDiagnosticsSnapshot | null>
  attach(source: AudioRouteDiagnosticsSource): void
  clear(): void
  refresh(): void
}

export function useGuitarMonitorDiagnostics(): GuitarMonitorDiagnostics {
  const [snapshot, setSnapshot] =
    createSignal<AudioRouteDiagnosticsSnapshot | null>(null)
  let release: (() => void) | null = null
  let generation = 0
  let disposed = false
  let refreshAttached: (() => void) | null = null

  const clear = (): void => {
    generation += 1
    release?.()
    release = null
    refreshAttached = null
    setSnapshot(null)
  }

  const attach = (source: AudioRouteDiagnosticsSource): void => {
    clear()
    if (disposed) return
    const currentGeneration = generation
    const read = createAudioRouteDiagnosticsReader(source)
    let timer: ReturnType<typeof setTimeout> | null = null
    const visible = () => typeof document === 'undefined' || !document.hidden
    const current = () => !disposed && currentGeneration === generation
    const stopTimer = () => {
      if (timer !== null) clearTimeout(timer)
      timer = null
    }
    const refresh = () => {
      if (!current()) return
      stopTimer()
      if (!visible()) return
      const next = read()
      setSnapshot(next)
      if (
        next.context.state === 'running' &&
        next.capture.trackState === 'live'
      ) {
        timer = setTimeout(refresh, 1000)
      }
    }
    refreshAttached = refresh
    source.context.addEventListener?.('statechange', refresh)
    source.context.addEventListener?.('sinkchange', refresh)
    for (const event of ['ended', 'mute', 'unmute'])
      source.track.addEventListener?.(event, refresh)
    if (typeof document !== 'undefined')
      document.addEventListener('visibilitychange', refresh)
    release = () => {
      stopTimer()
      source.context.removeEventListener?.('statechange', refresh)
      source.context.removeEventListener?.('sinkchange', refresh)
      for (const event of ['ended', 'mute', 'unmute'])
        source.track.removeEventListener?.(event, refresh)
      if (typeof document !== 'undefined')
        document.removeEventListener('visibilitychange', refresh)
    }
    refresh()
  }

  onCleanup(() => {
    disposed = true
    clear()
  })

  return { snapshot, attach, clear, refresh: () => refreshAttached?.() }
}
