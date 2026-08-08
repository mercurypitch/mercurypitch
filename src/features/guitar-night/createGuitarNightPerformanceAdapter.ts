// The Guitar Night adapter preserves native stem time until a verified score supplies beats.
// ============================================================

import type { Accessor } from 'solid-js'
import type { GuitarBackingTransportController } from '@/features/guitar/backing/useGuitarBackingTransportController'
import type { GuitarPerformancePhase, GuitarPerformanceRuntime, } from '@/features/guitar/runtime/guitar-performance-contract'
import { secondsToBeat } from '@/features/guitar/runtime/guitar-performance-contract'
import type { GuitarNote } from '@/lib/guitar/guitar-synth'

function roomPhase(
  status: ReturnType<GuitarBackingTransportController['status']>,
): GuitarPerformancePhase {
  if (status === 'loading') return 'loading'
  if (status === 'playing') return 'playing'
  if (status === 'paused') return 'paused'
  if (status === 'complete') return 'complete'
  if (status === 'error') return 'error'
  return 'ready'
}

export function createGuitarNightPerformanceAdapter(
  controller: Accessor<GuitarBackingTransportController>,
  title: Accessor<string>,
  notes: Accessor<readonly GuitarNote[]>,
  tempoBpm: Accessor<number | null> = () => null,
): GuitarPerformanceRuntime {
  const timeline = {
    positionSeconds: () => controller().positionSeconds(),
    durationSeconds: () => controller().durationSeconds(),
    // Score time exists only while a verified reference supplies a tempo, and
    // it is derived from the canonical audio clock — never from render frames.
    // Playback rate needs no correction here: stem position already advances
    // in real media time, so a slowed take slows the beat with it.
    playheadBeat: () => {
      const bpm = tempoBpm()
      if (bpm === null || !Number.isFinite(bpm) || bpm <= 0) return null
      return secondsToBeat(controller().positionSeconds(), bpm)
    },
    tempoBpm,
  }

  return {
    stage: { title, notes, timeline },
    transport: {
      phase: () => roomPhase(controller().status()),
      timeline,
      playbackRate: () => controller().playbackRate(),
      play: () => controller().play(),
      pause: () => controller().pause(),
      stop: () => controller().stop(),
      seekSeconds: (seconds) => controller().seek(seconds),
      setPlaybackRate: (rate) => controller().setPlaybackRate(rate),
    },
  }
}
