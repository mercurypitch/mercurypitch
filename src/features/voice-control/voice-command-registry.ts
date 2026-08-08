// ============================================================
// Voice command registry — which command sets are live right now
// ============================================================
//
// The adapter seam: App registers the transport set for the shell's
// lifetime; a surface with its own audio graph (StemMixer, Guitar Night,
// a jam room) registers its set on mount and disposes it on cleanup.
// Sets are matched in registration order — the first full-phrase match
// wins — so ordering doubles as priority.

import type { Accessor } from 'solid-js'
import { createSignal } from 'solid-js'
import type { VoiceCommand } from './types'

type VoiceCommandSource = Accessor<readonly VoiceCommand[]>

const [sources, setSources] = createSignal<readonly VoiceCommandSource[]>([])

/**
 * Adds a command source and returns its disposer. Call the disposer from
 * onCleanup — a surface that unmounts without disposing keeps answering to
 * its phrases forever.
 */
export function registerVoiceCommands(source: VoiceCommandSource): () => void {
  setSources((prev) => [...prev, source])
  let disposed = false
  return () => {
    if (disposed) return
    disposed = true
    setSources((prev) => prev.filter((s) => s !== source))
  }
}

/** Every live command, in registration order. */
export function activeVoiceCommands(): VoiceCommand[] {
  return sources().flatMap((source) => [...source()])
}

// ── Music-playing sources ──────────────────────────────────────
// The wake-word-required-while-playing mode needs to know when ANY
// transport is audibly rolling. App reports the shared runtime and the
// piano game directly; surfaces with their own audio graph (StemMixer)
// register here, exactly like their command sets.

type MusicPlayingSource = Accessor<boolean>

const [musicSources, setMusicSources] = createSignal<
  readonly MusicPlayingSource[]
>([])

export function registerMusicPlayingSource(
  source: MusicPlayingSource,
): () => void {
  setMusicSources((prev) => [...prev, source])
  let disposed = false
  return () => {
    if (disposed) return
    disposed = true
    setMusicSources((prev) => prev.filter((s) => s !== source))
  }
}

export function anyRegisteredMusicPlaying(): boolean {
  return musicSources().some((source) => source())
}
