// ============================================================
// Scripted takes: how the demo buzzes through the Lip roll room
// ============================================================
//
// The "how it works" demo (demo/useLipDemo.ts) plays Merc's two waves
// through useLipController instead of beside it: scripted frames take the
// microphone's place, and the same take (room-kit glide/glide-take.ts: the
// glide engine, the reveal, the voice's ribbon), the same scroll and the
// same Merc answer them, so the demo can only show what the room really
// does. A scripted take never opens the mic, plays the room's tones, fires
// a haptic, says a line or keeps a result: the demo's sound plays its
// count-in note and Merc's buzz, and its tooltips speak for it.
//
// The room reports every engine event of a scripted take as it fires
// (`onEvent`), which is what each tooltip waits for. One thing the demo
// asks of the room that a run never does: its camera can stop (`hold`,
// bay-scroll.ts holdCamera), so the take's one wave stays in view while
// its tooltips are read.

import type { DemoVoicePoint } from '@/components/demo-kit/demo-plan'
import type { DemoScript } from '@/components/demo-kit/useExerciseDemo'
import type { GlideDemoMark, ScriptedGlideTake, } from '@/components/room-kit/glide/glide-room-contract'
import type { CameraHold } from './bay-scroll'
import type { LipPlan } from './lip-run'

/** A moment of a take a tooltip can wait for: the glide engine's events. */
export type LipDemoMark = GlideDemoMark

/**
 * One of the demo's takes, buzzed through the room instead of the mic (the
 * glide rooms' scripted take), with what only Lip roll's demo asks.
 */
export interface ScriptedLipTake extends ScriptedGlideTake<LipPlan> {
  /** Where the camera stops, path seconds; null to follow as a run does. */
  readonly hold: CameraHold | null
  /**
   * The whole take's voice, ahead of the frames released so far (take
   * clock, cents over the root): where Merc will ride, so the demo's
   * tooltips can stay clear of him while they are up.
   */
  readonly voice: readonly DemoVoicePoint[]
}

/** The demo's way into the room (the demo kit's DemoScript). */
export type LipScript = DemoScript<ScriptedLipTake>
