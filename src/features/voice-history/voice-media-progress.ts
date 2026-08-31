// ============================================================
// Voice Media Progress — terminal fallback for native take playback
// ============================================================

import type { MediaFrameScheduler, MediaProgressLoop, } from '@/lib/media-progress-loop'
import { createMediaProgressLoop } from '@/lib/media-progress-loop'

/**
 * Native media events remain the primary playback signal, but some WebKit
 * paths reach duration without promptly exposing `ended`. Treat terminal
 * clock progress as the same state transition so the UI cannot remain Pause.
 */
export function createVoiceMediaProgressLoop(
  onProgress: (progress: number) => void,
  onTerminal: () => void,
  scheduler?: MediaFrameScheduler,
): MediaProgressLoop {
  return createMediaProgressLoop((nextProgress) => {
    onProgress(nextProgress)
    if (nextProgress >= 1) onTerminal()
  }, scheduler)
}
