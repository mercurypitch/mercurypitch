// ============================================================
// useLeapDemo: "how it works", Merc sings Leap twice
// ============================================================
//
// The demo kit's driver (demo-kit/useExerciseDemo.ts) in the Leap room:
// take 1 sings Merc's note back and leaps short, the lantern stays dark and
// he sings both notes; take 2 sings his note back and leaps into the band
// of light, and the lantern lights. Every tooltip waits for the moment it
// explains (demo-cues.ts), and both takes play at their own speed.

import type { DemoMode, DemoTip as KitDemoTip, ExerciseDemo, } from '@/components/demo-kit/useExerciseDemo'
import { useExerciseDemo } from '@/components/demo-kit/useExerciseDemo'
import { midiToNoteNameOctave } from '@/lib/note-utils'
import { leapDemoAutoPlays, markLeapDemoSeen } from '@/stores/leap-store'
import type { LeapController } from '../leap-controller-contract'
import type { ScriptedLeapTake } from '../scripted-take'
import type { DemoCueId, DemoTarget } from './demo-cues'
import { DEMO_BEATS, DEMO_COPY, DEMO_CUES, demoCueText, planLeapDemo, } from './demo-cues'
import { createDemoSound } from './demo-sound'

export type { DemoMode }

export type DemoTip = KitDemoTip<DemoCueId, DemoTarget>

export type LeapDemo = ExerciseDemo<DemoCueId, DemoTarget>

export function useLeapDemo(room: LeapController): LeapDemo {
  return useExerciseDemo({
    room: {
      script: room.script,
      phase: () => room.state().phase,
      noteName: () => midiToNoteNameOctave(room.script.note()),
      ownNote: () => true,
      moment: () => `${room.state().phase}:${room.state().run}`,
    },
    plan: planLeapDemo,
    cues: DEMO_CUES,
    beats: DEMO_BEATS,
    cueText: (id) => demoCueText(id),
    copy: DEMO_COPY,
    micTarget: 'mic',
    endMark: 'outcome',
    clearTipOn: [],
    autoPlays: leapDemoAutoPlays,
    markSeen: markLeapDemoSeen,
    sound: (ctx, minLead) => createDemoSound(ctx, minLead, room.script.voice),
    // Merc's moves keep to reduced motion on their own (merc-moves.ts).
    take: (take, _note, clock): ScriptedLeapTake => ({
      round: take.round,
      call: take.call,
      responseStart: take.responseStart,
      answer: take.answer,
      rules: take.rules,
      ...clock,
    }),
  })
}
