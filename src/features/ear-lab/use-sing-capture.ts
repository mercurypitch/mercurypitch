// ============================================================
// use-sing-capture — the microphone for a sung answer.
//
// Home, Echo and Span answer by voice the same way: acquire the mic
// through micManager under the drill's own consumer id, run the
// standalone f0 stream on the engine's context, open a window when
// the answer phase starts and take the frames when it ends. The
// stream is created on the first sung run and handed back when the
// player switches to tapping or leaves — a drill never holds an
// open mic for a run that will not listen.
// ============================================================

import { onCleanup } from 'solid-js'
import { micManager } from '@/lib/mic-manager'
import type { PitchFrame } from '@/lib/pitch-f0-stream'
import type { F0Stream } from '@/lib/pitch-f0-stream'
import { createF0Stream } from '@/lib/pitch-f0-stream'

interface EngineLike {
  init: () => Promise<void>
  resume: () => Promise<void>
  getAudioContext: () => AudioContext | null
}

export interface SingCaptureHandle {
  /** Acquire the mic and start the stream; throws when unavailable. */
  acquire: () => Promise<void>
  /** Hand the device back. Safe when nothing is held. */
  release: () => void
  held: () => boolean
  /** Clear the frame window. */
  startWindow: () => void
  /** Frames since startWindow(), timed from it; closes the window. */
  takeFrames: () => PitchFrame[]
  /** The frames so far, the window still open. */
  peekFrames: () => PitchFrame[]
  /** Input level 0..1 (RMS) of the latest buffer; 0 with no mic. */
  level: () => number
}

export function useSingCapture(
  audioEngine: EngineLike,
  consumer: string,
): SingCaptureHandle {
  let f0: F0Stream | null = null
  let acquiring: Promise<void> | null = null
  /** Bumped by release(): an acquisition still waiting on the permission
   *  prompt when the drill let go (unmount, or a switch to tapping) hands
   *  its stream straight back instead of holding it for nobody. */
  let generation = 0

  const release = (): void => {
    generation += 1
    f0?.dispose()
    f0 = null
    micManager.release(consumer)
  }
  onCleanup(release)

  return {
    acquire: () => {
      if (f0) return Promise.resolve()
      // One acquisition at a time: a second Begin during the permission
      // prompt used to open a second stream and orphan the first.
      acquiring ??= (async () => {
        const mine = generation
        await audioEngine.init()
        await audioEngine.resume()
        const ctx = audioEngine.getAudioContext()
        if (!ctx) throw new Error('Audio engine has no context')
        const stream = await micManager.acquire(consumer)
        if (mine !== generation) {
          // Released meanwhile: the caller carries on in whatever mode it
          // is in now (held() says no), and the mic goes back.
          micManager.release(consumer)
          return
        }
        f0 = createF0Stream(ctx, stream)
      })().finally(() => {
        acquiring = null
      })
      return acquiring
    },
    release,
    held: () => f0 !== null,
    startWindow: () => f0?.startTask(),
    takeFrames: () => f0?.takeFrames() ?? [],
    peekFrames: () => f0?.peekFrames() ?? [],
    level: () => f0?.latestLevel() ?? 0,
  }
}
