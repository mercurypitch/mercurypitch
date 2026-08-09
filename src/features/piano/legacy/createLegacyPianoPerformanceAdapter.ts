// ============================================================
// Legacy Piano adapter — exposes falling-notes through the shared contract
// ============================================================
//
// This is deliberately a structural adapter, not a second runtime. Every
// timeline accessor and command delegates to the App-owned falling-notes
// controller so its RAF, audio scheduling, loops and cleanup remain the only
// authorities during the compatibility phase.

import type { Accessor } from 'solid-js'
import type { useFallingNotesController } from '@/features/falling-notes/useFallingNotesController'
import type { PianoPerformancePhase, PianoPerformanceRuntime, } from '@/features/piano/runtime/piano-performance-contract'

type FallingNotesController = ReturnType<typeof useFallingNotesController>

type LegacyPianoPerformanceController = Pick<
  FallingNotesController,
  | 'currentSongBpm'
  | 'gameState'
  | 'pauseGame'
  | 'playheadBeat'
  | 'resetGame'
  | 'resumeGame'
  | 'seekToBeat'
  | 'setBpm'
  | 'setPianoCurrentCycle'
  | 'setSpeed'
  | 'songNotes'
  | 'speed'
  | 'startGame'
  | 'totalBeats'
>

export interface LegacyPianoPerformanceAdapterOptions {
  title: Accessor<string>
}

function legacyPhase(
  state: ReturnType<LegacyPianoPerformanceController['gameState']>,
): PianoPerformancePhase {
  if (state === 'countdown') return 'count-in'
  if (state === 'playing') return 'playing'
  if (state === 'paused') return 'paused'
  if (state === 'finished') return 'complete'
  return 'ready'
}

export function createLegacyPianoPerformanceAdapter(
  controller: LegacyPianoPerformanceController,
  options: LegacyPianoPerformanceAdapterOptions,
): PianoPerformanceRuntime {
  const timeline = {
    playheadBeat: controller.playheadBeat,
    totalBeats: controller.totalBeats,
    tempoBpm: controller.currentSongBpm,
  }

  const hasPlayableNotes = (): boolean => controller.songNotes().length > 0

  return {
    stage: {
      title: options.title,
      notes: controller.songNotes,
      timeline,
    },
    transport: {
      phase: () => legacyPhase(controller.gameState()),
      timeline,
      speed: controller.speed,
      play: async () => {
        const state = controller.gameState()
        if (state === 'playing' || state === 'countdown') {
          return hasPlayableNotes()
        }
        if (state === 'paused') {
          controller.resumeGame()
          return hasPlayableNotes()
        }

        controller.setPianoCurrentCycle(1)
        await controller.startGame()
        return hasPlayableNotes()
      },
      pause: controller.pauseGame,
      stop: controller.resetGame,
      seekToBeat: controller.seekToBeat,
      setTempoBpm: controller.setBpm,
      setSpeed: controller.setSpeed,
    },
  }
}
