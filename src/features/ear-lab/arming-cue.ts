// ============================================================
// useArmingCue — the pads arm audibly.
//
// A soft click on the room's click voice the moment the pads arm, so
// the ear knows the question is open without a glance at the console.
// It rides the bench volume the way every click does; the Last call
// plate shows the same moment as a brass tick on its rail.
// ============================================================

import { createEffect, on, onCleanup } from 'solid-js'
import { useEngines } from '@/contexts/EngineContext'
import type { ScheduledClick } from './click-synth'
import { scheduleClick } from './click-synth'
import { useEarRoom } from './ear-room-context'

/** Under the count-in clicks: a cue, not a beat. */
export const ARMING_CUE_GAIN = 0.45

export function useArmingCue(armed: () => boolean): void {
  const { audioEngine } = useEngines()
  const room = useEarRoom()
  let click: ScheduledClick | undefined
  const silence = (): void => {
    click?.cancel()
    click = undefined
  }
  createEffect(
    on(
      armed,
      (isArmed, wasArmed) => {
        if (!isArmed) {
          silence()
          return
        }
        if (wasArmed === true) return
        const ctx = audioEngine.getAudioContext()
        if (!ctx) return
        // A cue, never the run: a context that cannot click (closed, or
        // a stub) is no reason for the pads to stay dark.
        try {
          click = scheduleClick(ctx, ctx.currentTime, {
            voice: room.clickVoice(),
            gainLevel:
              ARMING_CUE_GAIN * room.volume() * audioEngine.getVolume(),
          })
        } catch {
          click = undefined
        }
      },
      { defer: true },
    ),
  )
  onCleanup(silence)
}
