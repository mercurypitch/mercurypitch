// ============================================================
// useLongNoteDemo — "how it works": Merc sings Long note twice
// ============================================================
//
// The demo kit's driver (demo-kit/useExerciseDemo.ts) in the Long note room:
// take 1 drifts off the line and stops for a breath, take 2 holds the line
// to the goal (half full, Merc steps out), then steady to the brim, its two
// long stretches at 4x. Every tooltip waits for the engine event it explains
// (demo-cues.ts). At the goal the tooltip goes while Merc steps out of the
// glass to cheer, until the next one explains the top.

import type { DemoMode, DemoTip as KitDemoTip, ExerciseDemo, } from '@/components/demo-kit/useExerciseDemo'
import { useExerciseDemo } from '@/components/demo-kit/useExerciseDemo'
import type { ScriptedTake } from '../scripted-take'
import type { LongNoteController } from '../useLongNoteController'
import { longNoteDemoAutoPlays } from './demo-auto-play'
import type { DemoCueId, DemoTarget } from './demo-cues'
import { DEMO_BEATS, DEMO_COPY, DEMO_CUES, demoCueText, planLongNoteDemo, } from './demo-cues'
import { markLongNoteDemoSeen } from './demo-seen'
import { createDemoSound } from './demo-sound'

export type { DemoMode }

export type DemoTip = KitDemoTip<DemoCueId, DemoTarget>

export type LongNoteDemo = ExerciseDemo<DemoCueId, DemoTarget>

export function useLongNoteDemo(room: LongNoteController): LongNoteDemo {
  return useExerciseDemo({
    room: {
      script: room.script,
      phase: () => room.state().phase,
      noteName: () => room.noteName(),
      ownNote: () => room.state().targetMidi !== null,
      moment: () => `${room.state().phase}:${room.state().targetMidi}`,
    },
    plan: planLongNoteDemo,
    cues: DEMO_CUES,
    beats: DEMO_BEATS,
    cueText: demoCueText,
    copy: DEMO_COPY,
    micTarget: 'mic',
    endMark: 'end',
    clearTipOn: ['goal'],
    autoPlays: () => longNoteDemoAutoPlays(),
    markSeen: () => markLongNoteDemoSeen(),
    sound: (ctx, minLead) => createDemoSound(ctx, minLead),
    take: (take, note, clock, still): ScriptedTake => ({
      targetMidi: note,
      preset: take.preset,
      toResult: take.id === 'on',
      // Sheepish: he glances about, out of the glass.
      after: 'idle',
      still,
      ...clock,
    }),
  })
}
