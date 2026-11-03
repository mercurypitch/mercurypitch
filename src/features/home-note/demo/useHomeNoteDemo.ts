// ============================================================
// useHomeNoteDemo: "how it works", the band and home, twice
// ============================================================
//
// The demo kit's driver (demo-kit/useExerciseDemo.ts) in the Home note
// room: take 1 hears the band's intro and sings the last chord's note, so
// the lamp stays dark and Merc sings home over home's chord; take 2 hears
// the same intro and sings home, held in the band of light, and the lamp
// lights. Every tooltip waits for the moment it explains (demo-cues.ts),
// and both takes play at their own speed.

import type { DemoMode, DemoTip as KitDemoTip, ExerciseDemo, } from '@/components/demo-kit/useExerciseDemo'
import { useExerciseDemo } from '@/components/demo-kit/useExerciseDemo'
import { midiToNoteNameOctave } from '@/lib/note-utils'
import { homeNoteDemoAutoPlays, markHomeNoteDemoSeen, } from '@/stores/home-note-store'
import type { HomeNoteController } from '../home-note-controller-contract'
import type { ScriptedHomeTake } from '../scripted-take'
import type { DemoCueId, DemoTarget } from './demo-cues'
import { DEMO_BEATS, DEMO_COPY, DEMO_CUES, demoCueText, planHomeNoteDemo, } from './demo-cues'
import { createDemoSound } from './demo-sound'

export type { DemoMode }

export type DemoTip = KitDemoTip<DemoCueId, DemoTarget>

export type HomeNoteDemo = ExerciseDemo<DemoCueId, DemoTarget>

export function useHomeNoteDemo(room: HomeNoteController): HomeNoteDemo {
  return useExerciseDemo({
    room: {
      script: room.script,
      phase: () => room.state().phase,
      noteName: () => midiToNoteNameOctave(room.script.note()),
      ownNote: () => true,
      moment: () => `${room.state().phase}:${room.state().run}`,
    },
    plan: planHomeNoteDemo,
    cues: DEMO_CUES,
    beats: DEMO_BEATS,
    cueText: (id) => demoCueText(id),
    copy: DEMO_COPY,
    micTarget: 'mic',
    endMark: 'outcome',
    clearTipOn: [],
    autoPlays: homeNoteDemoAutoPlays,
    markSeen: markHomeNoteDemoSeen,
    sound: (ctx, minLead) => createDemoSound(ctx, minLead, room.script.voice),
    // Merc's moves keep to reduced motion on their own (merc-moves.ts).
    take: (take, _note, clock): ScriptedHomeTake => ({
      round: take.round,
      introAt: take.introAt,
      responseStart: take.responseStart,
      answer: take.answer,
      rules: take.rules,
      ...clock,
    }),
  })
}
