// ============================================================
// Scripted takes: how the demo hums through the Ng slides room
// ============================================================
//
// The "how it works" demo (demo/useNgDemo.ts) plays Merc's two slides
// through useNgController instead of beside it: scripted frames take the
// microphone's place, and the same take (room-kit glide/glide-take.ts: the
// glide engine, the reveal, the voice's ribbon), the same scroll and the
// same Merc answer them, so the demo can only show what the room really
// does. A scripted take never opens the mic, plays the room's tones, fires
// a haptic, says a line or keeps a result: the demo's sound plays its
// count-in note and Merc's hum, and its tooltips speak for it.
//
// The room reports every engine event of a scripted take as it fires
// (`onEvent`), which is what each tooltip waits for.

import type { DemoScript } from '@/components/demo-kit/useExerciseDemo'
import type { GlideDemoMark, ScriptedGlideTake, } from '@/components/room-kit/glide/glide-room-contract'
import type { NgPlan } from './ng-run'

/** A moment of a take a tooltip can wait for: the glide engine's events. */
export type NgDemoMark = GlideDemoMark

/** One of the demo's takes, hummed through the room instead of the mic. */
export type ScriptedNgTake = ScriptedGlideTake<NgPlan>

/** The demo's way into the room (the demo kit's DemoScript). */
export type NgScript = DemoScript<ScriptedNgTake>
