// ============================================================
// useHarmonyDemo: "how it works", one line sung twice
// ============================================================
//
// The demo kit's driver (demo-kit/useExerciseDemo.ts) in the Harmony room:
// take 1 sings the first note a third above Merc's, then his own second
// note instead of the third over it, so that lamp stays dark and he sings
// his note and the third from it; take 2 sings every note a third above,
// and every gold lamp lights. Every tooltip waits for the moment it
// explains (demo-cues.ts), and both takes play at their own speed.

import type { DemoMode, DemoTip as KitDemoTip, ExerciseDemo, } from '@/components/demo-kit/useExerciseDemo'
import { useExerciseDemo } from '@/components/demo-kit/useExerciseDemo'
import { midiToNoteNameOctave } from '@/lib/note-utils'
import { harmonyDemoAutoPlays, markHarmonyDemoSeen, } from '@/stores/harmony-store'
import type { HarmonyController } from '../harmony-controller-contract'
import type { ScriptedHarmonyTake } from '../scripted-take'
import type { DemoCueId, DemoTarget } from './demo-cues'
import { DEMO_BEATS, DEMO_COPY, DEMO_CUES, demoCueText, planHarmonyDemo, } from './demo-cues'
import { createDemoSound } from './demo-sound'

export type { DemoMode }

export type DemoTip = KitDemoTip<DemoCueId, DemoTarget>

export type HarmonyDemo = ExerciseDemo<DemoCueId, DemoTarget>

export function useHarmonyDemo(room: HarmonyController): HarmonyDemo {
  return useExerciseDemo({
    room: {
      script: room.script,
      phase: () => room.state().phase,
      noteName: () => midiToNoteNameOctave(room.script.note()),
      ownNote: () => true,
      moment: () => `${room.state().phase}:${room.state().run}`,
    },
    plan: planHarmonyDemo,
    cues: DEMO_CUES,
    beats: DEMO_BEATS,
    cueText: (id) => demoCueText(id),
    copy: DEMO_COPY,
    micTarget: 'mic',
    endMark: 'outcome',
    clearTipOn: [],
    autoPlays: harmonyDemoAutoPlays,
    markSeen: markHarmonyDemoSeen,
    sound: (ctx, minLead) => createDemoSound(ctx, minLead, room.script.voice),
    // Merc's moves keep to reduced motion on their own (merc-moves.ts).
    take: (take, _note, clock): ScriptedHarmonyTake => ({
      line: take.line,
      call: take.call,
      responseStart: take.responseStart,
      answer: take.answer,
      rules: take.rules,
      ...clock,
    }),
  })
}
