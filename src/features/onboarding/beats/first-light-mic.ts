// ============================================================
// First Light's microphone, as the waiting screen shows it
// ============================================================
//
// The waiting screen draws the Settings mic check's stage and names the
// inputs, both from the beat's own voice session. Two small pieces do it:
//
//   • the stage feed: a live analysis (mic-check/live-analysis.ts) that
//     follows the session's context and stream, which a probe or a switch of
//     input rebuilds, and takes its pitch from the session's own frames, so a
//     phone runs one YIN pass for the take and the picture, not two;
//   • the input roster: what the browser lists, with the input the capture
//     hears marked, read again whenever a device comes or goes.

import type { Accessor } from 'solid-js'
import { createSignal, onCleanup } from 'solid-js'
import { listDevices, trackIdentity, watchDeviceChanges, } from '@/features/mic-check/device-watch'
import type { MicAnalysis, MicCheckLive, } from '@/features/mic-check/live-analysis'
import { createMicAnalysis, createMicLive, quietMicLive, UNVOICED, } from '@/features/mic-check/live-analysis'
import type { MicRoster } from '@/features/mic-check/mic-roster'
import { buildRoster, EMPTY_ROSTER } from '@/features/mic-check/mic-roster'
import { micManager } from '@/lib/mic-manager'
import type { VoiceSession } from '@/lib/voice-session'

export interface StageFeed {
  /** What the stage paints. It reads this every frame. */
  readonly live: MicCheckLive
  /** One frame: follow the session's capture, then analyse it. */
  read: (session: VoiceSession | null, at: number) => void
  /** Let go of the analysis; the stage settles to rest. */
  stop: () => void
}

export function createStageFeed(): StageFeed {
  const live = createMicLive()
  let analysis: MicAnalysis | null = null

  const stop = (): void => {
    analysis?.dispose()
    analysis = null
    quietMicLive(live)
  }

  /** The analysis for the capture as it stands, rebuilt when it moved. */
  const follow = (session: VoiceSession | null): MicAnalysis | null => {
    const context = session?.context() ?? null
    const stream = context === null ? null : micManager.getStream()
    if (analysis?.context === context && analysis.stream === stream) {
      return analysis
    }
    stop()
    if (context === null || stream === null) return null
    analysis = createMicAnalysis(context, stream, { detectPitch: false })
    return analysis
  }

  return {
    live,
    read(session, at) {
      const current = follow(session)
      if (current === null) return
      // The session's raw frame, not its smoothed one: the note tracker
      // bridges gaps and holds a note through a wobble by itself.
      const frame = session?.latest() ?? null
      current.read(
        live,
        at,
        frame === null || frame.f0 <= 0
          ? UNVOICED
          : { f0: frame.f0, clarity: frame.conf },
      )
    },
    stop,
  }
}

export interface InputRoster {
  roster: Accessor<MicRoster>
  /** What the capture track reports about its format, or null. */
  settings: Accessor<MediaTrackSettings | null>
  /** List the inputs again, and which one the capture hears now. */
  refresh: () => Promise<void>
}

/** Follows `devicechange` until its owner's cleanup. */
export function useInputRoster(): InputRoster {
  const [roster, setRoster] = createSignal<MicRoster>(EMPTY_ROSTER)
  const [settings, setSettings] = createSignal<MediaTrackSettings | null>(null)
  let disposed = false

  const refresh = async (): Promise<void> => {
    const devices = await listDevices()
    if (devices === null || disposed) return
    // Read after the await: a switch of input replaces the track meanwhile.
    const track = micManager.getStream()?.getAudioTracks()[0] ?? null
    setRoster(buildRoster(devices, trackIdentity(track)))
    setSettings(track?.getSettings?.() ?? null)
  }

  const unwatch = watchDeviceChanges(() => {
    void refresh()
  })
  onCleanup(() => {
    disposed = true
    unwatch()
  })

  return { roster, settings, refresh }
}
