// ============================================================
// useExerciseCapture: the microphone and the audio clock for a premium room
// ============================================================
//
// The premium rooms live on the native shell's stack, which sits outside
// the app's engine provider, so a room takes the phone's one AudioContext
// the way the Karaoke room does: a lease from
// `nativeDeviceApi().acquireAudio`, under the room's own owner name, given
// back with the screen. A browser (a dev build) has no lease; the room makes
// its own context then and closes it after.
//
// `acquire` must run inside the singer's tap: iOS unlocks audio and the mic
// only from a gesture. Each acquisition is numbered, so a release during the
// permission prompt hands the stream straight back instead of holding it
// for a room that is gone (the Ear Lab's rule, use-sing-capture.ts). A tap
// after that release starts an acquisition of its own, once the old one has
// handed back what it got. Once the screen is gone, `acquire` opens nothing
// at all.

import { onCleanup, untrack } from 'solid-js'
import type { MicError } from '@/lib/mic-manager'
import { micManager } from '@/lib/mic-manager'
import type { F0Stream, PitchFrame } from '@/lib/pitch-f0-stream'
import { createF0Stream } from '@/lib/pitch-f0-stream'
import { playReferenceTone } from '@/lib/reference-tone'
import { nativeDeviceApi } from '@/stores/native-shell-store'

export type CaptureFailure = 'denied' | 'unavailable'

/** Why the microphone could not be opened, in the room named `room`. */
export class CaptureError extends Error {
  constructor(
    readonly failure: CaptureFailure,
    room = 'Exercise',
  ) {
    super(`${room} capture: ${failure}`)
  }
}

export interface ExerciseCapture {
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
  /**
   * The audio clock, running, for sound of the room's own (the demo); null
   * when it will not start. On iOS, call it inside a tap.
   */
  audio: () => Promise<AudioContext | null>
}

function isMicError(value: unknown): value is MicError {
  return typeof value === 'object' && value !== null && 'kind' in value
}

/**
 * The mic and the clock for one room: `owner` names it to the mic manager
 * and the audio lease, `room` names it in a CaptureError.
 */
export function useExerciseCapture(
  owner: string,
  room: string,
): ExerciseCapture {
  const lease = untrack(nativeDeviceApi)?.acquireAudio(owner)
  let ownContext: AudioContext | null = null
  let f0: F0Stream | null = null
  /** The acquisition in flight, and the release count it began under. */
  let acquiring: { generation: number; done: Promise<void> } | null = null
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
    micManager.release(owner)
  }

  /**
   * Open the mic for acquisition `mine`, after `before` has settled: the
   * mic manager keeps one hold per owner, so an older acquisition handing
   * its stream back later would end this one's.
   */
  const open = async (mine: number, before: Promise<void>): Promise<void> => {
    // Called inside the tap, so the clock is unlocked inside it.
    const ctx = await unlock()
    await before
    if (mine !== generation) return
    if (ctx === null) throw new CaptureError('unavailable', room)
    let stream: MediaStream
    try {
      stream = await micManager.acquire(owner)
    } catch (error) {
      throw new CaptureError(
        isMicError(error) && error.kind === 'permission-denied'
          ? 'denied'
          : 'unavailable',
        room,
      )
    }
    if (mine !== generation) {
      micManager.release(owner)
      return
    }
    try {
      f0 = createF0Stream(ctx, stream)
    } catch {
      // No pitch stream, no reason to keep the mic.
      micManager.release(owner)
      throw new CaptureError('unavailable', room)
    }
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
      // A second tap shares the opening under way, unless a release gave
      // that one up: it will open nothing, so this tap needs its own.
      if (acquiring?.generation === generation) return acquiring.done
      const before = acquiring?.done.catch(() => undefined) ?? Promise.resolve()
      const entry = { generation, done: open(generation, before) }
      acquiring = entry
      const settled = (): void => {
        if (acquiring === entry) acquiring = null
      }
      entry.done.then(settled, settled)
      return entry.done
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
    audio: () => (disposed ? Promise.resolve(null) : unlock()),
  }
}
