// ============================================================
// useNgDemo: "how it works", Merc hums Ng slides twice
// ============================================================
//
// The demo kit's driver (demo-kit/useExerciseDemo.ts) in the Ng slides
// room: take 1 steps up the slide note to note and stops on the way down,
// so the glass stays dark between the steps and where the hum stopped;
// take 2 slides along the line, turns at the top note and lights the arch.
// Every tooltip waits for the engine event it explains (demo-cues.ts), and
// both takes play at their own speed, one slide each at Beginner's timing.

import type { DemoMode, DemoTip as KitDemoTip, ExerciseDemo, } from '@/components/demo-kit/useExerciseDemo'
import { useExerciseDemo } from '@/components/demo-kit/useExerciseDemo'
import { midiToNoteNameOctave } from '@/lib/note-utils'
import { markNgDemoSeen, ngDemoAutoPlays } from '@/stores/ng-slides-store'
import type { ScriptedNgTake } from '../scripted-take'
import type { NgController } from '../useNgController'
import type { DemoCueId, DemoTarget } from './demo-cues'
import { DEMO_BEATS, DEMO_COPY, DEMO_CUES, demoCueText, planNgDemo, } from './demo-cues'
import { createDemoSound } from './demo-sound'

export type { DemoMode }

export type DemoTip = KitDemoTip<DemoCueId, DemoTarget>

export type NgDemo = ExerciseDemo<DemoCueId, DemoTarget>

export function useNgDemo(room: NgController): NgDemo {
  return useExerciseDemo({
    room: {
      script: room.script,
      phase: () => room.state().phase,
      noteName: () => midiToNoteNameOctave(room.script.note()),
      ownNote: () => room.lines().root !== null,
      moment: () => `${room.state().phase}:${room.state().run}`,
    },
    plan: planNgDemo,
    cues: DEMO_CUES,
    beats: DEMO_BEATS,
    cueText: (id) => demoCueText(id),
    copy: DEMO_COPY,
    micTarget: 'mic',
    endMark: 'end',
    clearTipOn: [],
    autoPlays: () => ngDemoAutoPlays(),
    markSeen: () => markNgDemoSeen(),
    sound: (ctx, minLead) => createDemoSound(ctx, minLead),
    take: (take, _root, clock): ScriptedNgTake => ({
      plan: take.plan,
      preset: take.preset,
      ...clock,
    }),
  })
}
