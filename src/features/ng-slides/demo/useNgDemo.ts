// ============================================================
// useNgDemo: "how it works", Merc hums Ng slides twice
// ============================================================
//
// The glide rooms' demo (room-kit glide/useGlideDemo.ts) in the Ng slides
// room: take 1 steps up the slide note to note and stops on the way down,
// so the glass stays dark between the steps and where the hum stopped;
// take 2 slides along the line, turns at the top note and lights the arch.
// Every tooltip waits for the engine event it explains (demo-cues.ts), and
// both takes play at their own speed, one slide each at Beginner's timing.

import type { DemoMode, DemoTip as KitDemoTip, ExerciseDemo, RoomDemoOptions, } from '@/components/demo-kit/useExerciseDemo'
import { useGlideDemo } from '@/components/room-kit/glide/useGlideDemo'
import { markNgDemoSeen, ngDemoAutoPlays } from '@/stores/ng-slides-store'
import type { NgController } from '../ng-controller-contract'
import type { ScriptedNgTake } from '../scripted-take'
import type { DemoCueId, DemoTarget } from './demo-cues'
import { DEMO_CUES, demoCueText, planNgDemo } from './demo-cues'
import { createDemoSound } from './demo-sound'

export type { DemoMode }

export type DemoTip = KitDemoTip<DemoCueId, DemoTarget>

export type NgDemo = ExerciseDemo<DemoCueId, DemoTarget>

export function useNgDemo(
  room: NgController,
  options: RoomDemoOptions = {},
): NgDemo {
  return useGlideDemo(room, {
    plan: planNgDemo,
    cues: DEMO_CUES,
    cueText: (id) => demoCueText(id),
    ownNote: () => room.lines().root !== null,
    autoPlays: () => options.autoPlay !== false && ngDemoAutoPlays(),
    markSeen: () => markNgDemoSeen(),
    sound: (ctx, minLead) => createDemoSound(ctx, minLead),
    take: (take, clock): ScriptedNgTake => ({
      plan: take.plan,
      preset: take.preset,
      ...clock,
    }),
  })
}
