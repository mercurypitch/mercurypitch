// The legacy Guitar adapter exposes its proven controller through the shared performance contract.
// ============================================================

import type { GuitarPerformancePhase, GuitarPerformanceRuntime, } from '@/features/guitar/runtime/guitar-performance-contract'
import { beatToSeconds, secondsToBeat, } from '@/features/guitar/runtime/guitar-performance-contract'
import type { GuitarPracticeController } from '@/features/guitar-practice/useGuitarPracticeController'

type LegacyPerformanceController = Pick<
  GuitarPracticeController,
  | 'fallingNotes'
  | 'gameState'
  | 'pauseGame'
  | 'playbackRate'
  | 'playheadBeat'
  | 'resumeGame'
  | 'seekToBeat'
  | 'setPlaybackRate'
  | 'selectedSongName'
  | 'songBpm'
  | 'startGame'
  | 'stopGame'
  | 'totalBeats'
>

function legacyPhase(
  state: ReturnType<LegacyPerformanceController['gameState']>,
): GuitarPerformancePhase {
  if (state === 'countdown') return 'count-in'
  if (state === 'playing') return 'playing'
  if (state === 'paused') return 'paused'
  if (state === 'finished') return 'complete'
  return 'ready'
}

export function createLegacyGuitarPerformanceAdapter(
  controller: LegacyPerformanceController,
): GuitarPerformanceRuntime {
  const timeline = {
    positionSeconds: () =>
      beatToSeconds(controller.playheadBeat(), controller.songBpm()),
    durationSeconds: () =>
      beatToSeconds(controller.totalBeats(), controller.songBpm()),
    playheadBeat: () => controller.playheadBeat(),
    tempoBpm: () => controller.songBpm(),
  }

  return {
    stage: {
      title: controller.selectedSongName,
      notes: controller.fallingNotes,
      timeline,
    },
    transport: {
      phase: () => legacyPhase(controller.gameState()),
      timeline,
      playbackRate: controller.playbackRate,
      play: async () => {
        const state = controller.gameState()
        if (state === 'playing' || state === 'countdown') return true
        if (state === 'paused') controller.resumeGame()
        else controller.startGame()
        return controller.fallingNotes().length > 0
      },
      pause: controller.pauseGame,
      stop: controller.stopGame,
      seekSeconds: (seconds) =>
        controller.seekToBeat(secondsToBeat(seconds, controller.songBpm())),
      setPlaybackRate: async (rate) => {
        controller.setPlaybackRate(rate)
        return true
      },
    },
  }
}
