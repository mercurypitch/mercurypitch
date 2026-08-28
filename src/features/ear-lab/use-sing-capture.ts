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
  /** Frames since startWindow(), timed from it. */
  takeFrames: () => PitchFrame[]
}

export function useSingCapture(
  audioEngine: EngineLike,
  consumer: string,
): SingCaptureHandle {
  let f0: F0Stream | null = null

  const release = (): void => {
    f0?.dispose()
    f0 = null
    micManager.release(consumer)
  }
  onCleanup(release)

  return {
    acquire: async () => {
      if (f0) return
      await audioEngine.init()
      await audioEngine.resume()
      const ctx = audioEngine.getAudioContext()
      if (!ctx) throw new Error('Audio engine has no context')
      const stream = await micManager.acquire(consumer)
      f0 = createF0Stream(ctx, stream)
    },
    release,
    held: () => f0 !== null,
    startWindow: () => f0?.startTask(),
    takeFrames: () => f0?.takeFrames() ?? [],
  }
}
