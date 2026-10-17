// ============================================================
// useLipDemo: "how it works", Merc buzzes Lip roll twice
// ============================================================
//
// The glide rooms' demo (room-kit glide/useGlideDemo.ts) in the Lip roll
// room: take 1 stops short halfway up the wave and stops on the way down,
// so the top stays dark and the light stops where the buzz did; take 2
// rides the crest all the way up and back and lights the wave. Every
// tooltip waits for the engine event it explains (demo-cues.ts), and both
// takes play at their own speed, one wave each at Learning's timing.

import type { DemoMode, DemoTip as KitDemoTip, ExerciseDemo, } from '@/components/demo-kit/useExerciseDemo'
import { useGlideDemo } from '@/components/room-kit/glide/useGlideDemo'
import { lipDemoAutoPlays, markLipDemoSeen } from '@/stores/lip-roll-store'
import type { LipController } from '../lip-controller-contract'
import type { ScriptedLipTake } from '../scripted-take'
import type { DemoCueId, DemoTarget } from './demo-cues'
import { DEMO_CUES, demoCueText, planLipDemo } from './demo-cues'
import { createDemoSound } from './demo-sound'

export type { DemoMode }

export type DemoTip = KitDemoTip<DemoCueId, DemoTarget>

export type LipDemo = ExerciseDemo<DemoCueId, DemoTarget>

export function useLipDemo(room: LipController): LipDemo {
  return useGlideDemo(room, {
    plan: planLipDemo,
    cues: DEMO_CUES,
    cueText: (id) => demoCueText(id),
    // The tooltips name no note.
    ownNote: () => true,
    autoPlays: () => lipDemoAutoPlays(),
    markSeen: () => markLipDemoSeen(),
    sound: (ctx, minLead) => createDemoSound(ctx, minLead),
    take: (take, clock): ScriptedLipTake => ({
      plan: take.plan,
      preset: take.preset,
      hold: take.hold,
      voice: take.voice,
      ...clock,
    }),
  })
}
