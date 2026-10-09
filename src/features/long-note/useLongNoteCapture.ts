// ============================================================
// useLongNoteCapture — the microphone and the audio clock for Long note
// ============================================================
//
// Long note lives on the native shell's stack, which sits outside the app's
// engine provider, so it takes the phone's one AudioContext the way the
// Karaoke room does: a lease from `nativeDeviceApi().acquireAudio`, given
// back with the screen. A browser (a dev build) has no lease; the room makes
// its own context then and closes it after.
//
// `acquire` must run inside the singer's tap: iOS unlocks audio and the mic
// only from a gesture. Each acquisition is numbered, so a release during the
// permission prompt hands the stream straight back instead of holding it
// for a room that is gone (the Ear Lab's rule, use-sing-capture.ts). Once
// the screen is gone, `acquire` opens nothing at all.

import { onCleanup, untrack } from 'solid-js'
import type { MicError } from '@/lib/mic-manager'
import { micManager } from '@/lib/mic-manager'
import type { F0Stream, PitchFrame } from '@/lib/pitch-f0-stream'
import { createF0Stream } from '@/lib/pitch-f0-stream'
import { playReferenceTone } from '@/lib/reference-tone'
import { nativeDeviceApi } from '@/stores/native-shell-store'

export const LONG_NOTE_AUDIO_OWNER = 'long-note-lantern'

export type CaptureFailure = 'denied' | 'unavailable'

/** Why the microphone could not be opened. */
export class CaptureError extends Error {
  constructor(readonly failure: CaptureFailure) {
    super(`Long note capture: ${failure}`)
  }
}

export interface LongNoteCapture {
  /** Unlock audio and open the mic. Rejects with a CaptureError. */
  acquire: () => Promise<void>
  /** Hand the mic back. Safe when nothing is held. */
  release: () => void
  held: () => boolean
  /** Start a take: clears the frames and zeroes their clock. */
  startWindow: () => void
  /** The take's frames so far, raw, oldest first (a copy). */
  peekFrames: () => PitchFrame[]
  /** The take's frames, ending it. */
  takeFrames: () => PitchFrame[]
  /** Play the target note; resolves after its release tail. */
  playTone: (midi: number, seconds?: number) => Promise<void>
}

function isMicError(value: unknown): value is MicError {
  return typeof value === 'object' && value !== null && 'kind' in value
}

export function useLongNoteCapture(): LongNoteCapture {
  const lease = untrack(nativeDeviceApi)?.acquireAudio(LONG_NOTE_AUDIO_OWNER)
  let ownContext: AudioContext | null = null
  let f0: F0Stream | null = null
  let acquiring: Promise<void> | null = null
  let generation = 0
  let disposed = false

  const context = (): AudioContext | null => {
    if (lease !== undefined) return lease.ensure()
    if (ownContext === null && typeof AudioContext !== 'undefined') {
      ownContext = new AudioContext()
    }
    return ownContext
  }

  /** The clock, running; null when there is none or it would not start. */
  const unlock = async (): Promise<AudioContext | null> => {
    const ctx = context()
    if (ctx === null) return null
    if (lease !== undefined) return (await lease.unlock()) ? ctx : null
    if (ctx.state === 'suspended') await ctx.resume().catch(() => undefined)
    return ctx.state === 'running' ? ctx : null
  }

  const release = (): void => {
    generation += 1
    f0?.dispose()
    f0 = null
    micManager.release(LONG_NOTE_AUDIO_OWNER)
  }

  onCleanup(() => {
    disposed = true
    release()
    lease?.release()
    if (ownContext !== null) {
      void ownContext.close().catch(() => undefined)
      ownContext = null
    }
  })

  return {
    acquire: () => {
      if (disposed || f0 !== null) return Promise.resolve()
      acquiring ??= (async () => {
        const mine = generation
        const ctx = await unlock()
        if (mine !== generation) return
        if (ctx === null) throw new CaptureError('unavailable')
        let stream: MediaStream
        try {
          stream = await micManager.acquire(LONG_NOTE_AUDIO_OWNER)
        } catch (error) {
          throw new CaptureError(
            isMicError(error) && error.kind === 'permission-denied'
              ? 'denied'
              : 'unavailable',
          )
        }
        if (mine !== generation) {
          micManager.release(LONG_NOTE_AUDIO_OWNER)
          return
        }
        try {
          f0 = createF0Stream(ctx, stream)
        } catch {
          // No pitch stream, no reason to keep the mic.
          micManager.release(LONG_NOTE_AUDIO_OWNER)
          throw new CaptureError('unavailable')
        }
      })().finally(() => {
        acquiring = null
      })
      return acquiring
    },
    release,
    held: () => f0 !== null,
    startWindow: () => f0?.startTask(),
    peekFrames: () => f0?.peekFrames() ?? [],
    takeFrames: () => f0?.takeFrames() ?? [],
    playTone: async (midi, seconds = 1.1) => {
      const ctx = await unlock()
      if (ctx === null) return
      await playReferenceTone(ctx, midi, seconds)
    },
  }
}
