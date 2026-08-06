// The Guitar Night adapter preserves native stem time until a verified score supplies beats.
// ============================================================

import type { Accessor } from 'solid-js'
import type { GuitarBackingTransportController } from '@/features/guitar/backing/useGuitarBackingTransportController'
import type { GuitarPerformancePhase, GuitarPerformanceRuntime, } from '@/features/guitar/runtime/guitar-performance-contract'
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
): GuitarPerformanceRuntime {
  const timeline = {
    positionSeconds: () => controller().positionSeconds(),
    durationSeconds: () => controller().durationSeconds(),
    playheadBeat: () => null,
    tempoBpm: () => null,
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
