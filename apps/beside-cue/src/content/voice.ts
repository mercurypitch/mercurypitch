// ============================================================
// Voice player shell — captions now, audio when it is recorded
// ============================================================
//
// No line has a recording yet, so this deliberately ships as a shell: it always
// produces the caption, and plays audio only where a file exists. That means
// the recording pass is a data change, not a feature.
//
// Two rules are enforced here rather than left to a caller's good manners:
//
// - A caption is never optional. Audio is an enhancement on top of readable
//   text, so a muted phone, a failed decode and an unrecorded line all behave
//   the same way.
// - There is no entry point that plays a line without the app being open. A
//   notification must never make a phone speak in a quiet room, and the way to
//   guarantee that is to give the notification path nothing to call.

import type { ContentPack, Line } from './pack'
import { findLine } from './pack'

export interface VoiceCue {
  readonly line: Line
  /** Always shown. Identical to the line text; named for what it is used for. */
  readonly caption: string
  /** False when the line has no recording, or audio could not start. */
  readonly spoken: boolean
}

/** Narrow port over the platform's audio, so tests need no DOM. */
export interface VoiceAudioPort {
  play: (url: string) => Promise<void>
  stop: () => void
}

export interface VoicePlayerOptions {
  readonly pack: ContentPack
  /** Omitted where nothing can play, such as a server render. */
  readonly audio?: VoiceAudioPort
  /** When true, audio is skipped and captions still appear. */
  readonly muted?: () => boolean
}

export interface VoicePlayer {
  /** Resolves once the caption is known, which is immediately. */
  playLine: (lineId: string) => Promise<VoiceCue>
  stop: () => void
}

export function createVoicePlayer(options: VoicePlayerOptions): VoicePlayer {
  let current: string | undefined

  const stop = (): void => {
    current = undefined
    options.audio?.stop()
  }

  const playLine = async (lineId: string): Promise<VoiceCue> => {
    const line = findLine(options.pack, lineId)
    if (line === undefined) {
      throw new Error(
        `No line "${lineId}" in content pack "${options.pack.id}".`,
      )
    }

    // One voice at a time. Two Corky lines over each other would be worse than
    // silence, and the caption of the newer line is the one that matters.
    if (current !== undefined) {
      options.audio?.stop()
    }
    current = lineId

    const caption = line.text
    const canSpeak =
      line.audio !== undefined &&
      options.audio !== undefined &&
      options.muted?.() !== true

    if (!canSpeak) {
      return { line, caption, spoken: false }
    }

    try {
      await options.audio!.play(line.audio!)
      return { line, caption, spoken: true }
    } catch {
      // A refused autoplay or a missing file is not an error worth surfacing:
      // the person still reads the line.
      return { line, caption, spoken: false }
    }
  }

  return { playLine, stop }
}

/** Wraps an `Audio` element. Undefined where the platform has none. */
export function createElementAudioPort(): VoiceAudioPort | undefined {
  if (typeof Audio === 'undefined') {
    return undefined
  }
  let element: HTMLAudioElement | undefined

  return {
    play: async (url) => {
      element?.pause()
      element = new Audio(url)
      await element.play()
    },
    stop: () => {
      element?.pause()
      element = undefined
    },
  }
}
