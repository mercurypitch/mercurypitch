// ============================================================
// useFirstNoteDemo: "how it works", a song's lead-in and its entry, twice
// ============================================================
//
// The demo kit's driver (demo-kit/useExerciseDemo.ts) in the First note
// room: take 1 hears Josephine's band lead in and comes in a step under its
// singer's first note, so the line stays dark and Merc sings the note; take
// 2 hears the same lead-in and comes in on the note, held in the band of
// light, and it lands. Every tooltip waits for the moment it explains
// (demo-cues.ts), and both takes play at their own speed.
//
// The band is a clip that ships with the app (demo-band.ts): the demo
// waits for it to decode, beside what the room's voice needs, before it
// plays (the kit waits READY_WAIT_MS at most).

import type { DemoMode, DemoTip as KitDemoTip, ExerciseDemo, } from '@/components/demo-kit/useExerciseDemo'
import { useExerciseDemo } from '@/components/demo-kit/useExerciseDemo'
import { midiToNoteNameOctave } from '@/lib/note-utils'
import { firstNoteDemoAutoPlays, markFirstNoteDemoSeen, } from '@/stores/first-note-store'
import type { FirstNoteController } from '../first-note-controller-contract'
import type { FirstNoteScript, ScriptedFirstTake } from '../scripted-take'
import { demoBand, loadDemoBand } from './demo-band'
import type { DemoCueId, DemoTarget } from './demo-cues'
import { DEMO_BEATS, DEMO_COPY, DEMO_CUES, demoCueText, planFirstNoteDemo, } from './demo-cues'
import { demoEntry } from './demo-script'
import { createDemoSound } from './demo-sound'

export type { DemoMode }

export type DemoTip = KitDemoTip<DemoCueId, DemoTarget>

export type FirstNoteDemo = ExerciseDemo<DemoCueId, DemoTarget>

/** The room's way in, with the band's clip loaded first. */
function withBand(script: FirstNoteScript): FirstNoteScript {
  const roomReady = script.ready
  return {
    ...script,
    ready: () =>
      Promise.all([
        loadDemoBand(),
        roomReady === undefined ? null : roomReady(),
      ]),
  }
}

export function useFirstNoteDemo(room: FirstNoteController): FirstNoteDemo {
  const script = withBand(room.script)
  return useExerciseDemo({
    room: {
      script,
      phase: () => room.state().phase,
      noteName: () => midiToNoteNameOctave(demoEntry().midi),
      ownNote: () => true,
      moment: () => `${room.state().phase}:${room.state().run}`,
    },
    plan: () => planFirstNoteDemo(),
    cues: DEMO_CUES,
    beats: DEMO_BEATS,
    cueText: (id) => demoCueText(id),
    copy: DEMO_COPY,
    micTarget: 'mic',
    endMark: 'outcome',
    clearTipOn: [],
    autoPlays: firstNoteDemoAutoPlays,
    markSeen: markFirstNoteDemoSeen,
    sound: (ctx, minLead) =>
      createDemoSound(ctx, minLead, room.script.voice, demoBand()),
    // Merc's moves keep to reduced motion on their own (merc-moves.ts).
    take: (take, _note, clock): ScriptedFirstTake => ({
      round: take.round,
      introAt: take.introAt,
      turnAt: take.turnAt,
      responseStart: take.responseStart,
      answer: take.answer,
      rules: take.rules,
      ...clock,
    }),
  })
}
