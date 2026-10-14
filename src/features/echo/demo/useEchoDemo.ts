// ============================================================
// useEchoDemo: "how it works", Merc sings Echo twice
// ============================================================
//
// The demo kit's driver (demo-kit/useExerciseDemo.ts) in the Echo room:
// take 1 comes in over Merc's call, sits flat on the second note and moves
// on to the third; take 2 waits for the call and lands all three, and its
// phrase joins the sky. Every tooltip waits for the moment it explains
// (demo-cues.ts), and both takes play at their own speed. The result takes
// down the tooltip on the phrase, whose stars it moves.

import type { DemoMode, DemoTip as KitDemoTip, ExerciseDemo, } from '@/components/demo-kit/useExerciseDemo'
import { useExerciseDemo } from '@/components/demo-kit/useExerciseDemo'
import { midiToNoteNameOctave } from '@/lib/note-utils'
import { echoDemoAutoPlays, markEchoDemoSeen } from '@/stores/echo-store'
import type { EchoController } from '../echo-controller-contract'
import type { ScriptedEchoTake } from '../scripted-take'
import type { DemoCueId, DemoTarget } from './demo-cues'
import { DEMO_BEATS, DEMO_COPY, DEMO_CUES, demoCueText, planEchoDemo, } from './demo-cues'
import { DEMO_LEVEL } from './demo-script'
import { createDemoSound } from './demo-sound'

export type { DemoMode }

export type DemoTip = KitDemoTip<DemoCueId, DemoTarget>

export type EchoDemo = ExerciseDemo<DemoCueId, DemoTarget>

export function useEchoDemo(room: EchoController): EchoDemo {
  return useExerciseDemo({
    room: {
      script: room.script,
      phase: () => room.state().phase,
      noteName: () => midiToNoteNameOctave(room.script.note()),
      ownNote: () => true,
      moment: () => `${room.state().phase}:${room.state().run}`,
    },
    plan: planEchoDemo,
    cues: DEMO_CUES,
    beats: DEMO_BEATS,
    cueText: (id) => demoCueText(id),
    copy: DEMO_COPY,
    micTarget: 'mic',
    endMark: 'phraseEnd',
    clearTipOn: ['result'],
    autoPlays: () => echoDemoAutoPlays(),
    markSeen: () => markEchoDemoSeen(),
    sound: (ctx, minLead) =>
      createDemoSound(ctx, minLead, room.script.callVoice),
    take: (take, _root, clock, still): ScriptedEchoTake => ({
      phrase: take.phrase,
      call: take.call,
      callEnd: take.callEnd,
      level: DEMO_LEVEL,
      toResult: take.id === 'on',
      still,
      ...clock,
    }),
  })
}
