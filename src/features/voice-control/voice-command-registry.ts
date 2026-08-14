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

// ── Wake-word holds ────────────────────────────────────────────
// A surface that deliberately captures open-ended audio — the Mercury Sing
// stage, where the user is SINGING into the mic — forces wake-word-required
// mode on for its lifetime, regardless of the user's setting, so sung
// lyrics cannot fire transport commands. Commands flagged `ignoresWakeWord`
// (the stage's own cancel phrases) still work bare.

const [wakeHolds, setWakeHolds] = createSignal<readonly symbol[]>([])

/** Forces wake-word-required mode on until the returned release is called.
 *  Call the release from onCleanup; releasing twice is safe. */
export function acquireWakeWordHold(): () => void {
  const token = Symbol('wake-word-hold')
  setWakeHolds((prev) => [...prev, token])
  let released = false
  return () => {
    if (released) return
    released = true
    setWakeHolds((prev) => prev.filter((t) => t !== token))
  }
}

export function wakeWordHoldActive(): boolean {
  return wakeHolds().length > 0
}

// ── The ear's latest output ────────────────────────────────────
// A neutral seam so a surface can know that someone is TALKING to the app
// right now, and what was heard, without reaching into the controller.
//
// Mercury Sing needs both. It needs the text to show you what the
// recogniser made of your voice, and it needs the timing because a spoken
// command is not singing: while you say "sing number one", those words
// were still being fed to the melody matcher, which reordered the wheel
// underneath the number you had just read. Freezing on speech is what
// makes the number you say mean the song you saw.

const [heardText, setHeardText] = createSignal('')
const [heardAt, setHeardAt] = createSignal(0)

export function reportHeardSpeech(text: string): void {
  const clean = text.trim()
  // An empty report is a recognizer recycle, not speech: webspeech fires
  // `onInterim('')` on every session end, every few seconds of silence —
  // counting those as "someone is talking" froze the Mercury Sing wheel
  // over and over in a quiet room.
  if (clean === '') return
  setHeardText(clean)
  setHeardAt(Date.now())
}

/** Most recent transcript the listener produced, interim or final. */
export function lastHeardSpeech(): string {
  return heardText()
}

/** True when the listener produced something within `ms`. */
export function speechActiveWithin(ms: number): boolean {
  const at = heardAt()
  return at > 0 && Date.now() - at < ms
}
