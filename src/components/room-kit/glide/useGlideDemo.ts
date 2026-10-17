// ============================================================
// useGlideDemo: "how it works" in a glide room, Merc sings it twice
// ============================================================
//
// The demo kit's driver (demo-kit/useExerciseDemo.ts) as both glide rooms
// run it: Merc's two takes sung through the room's own controller, take
// and engine (its DemoScript), the glide rooms' beats and words
// (glide-demo.ts), each tooltip waiting for the engine event it explains,
// the mic hint pointing at the mic, and a take ending on the engine's
// `end`. A room brings what is its own (GlideDemoSetup): its plan, its
// cues and their words, its device flag, its sound, and how a demo take
// becomes its scripted take.

import type { Accessor } from 'solid-js'
import type { DemoCue, TakeClock } from '@/components/demo-kit/demo-plan'
import type { DemoSoundtrack } from '@/components/demo-kit/demo-sound'
import type { DemoScript, ExerciseDemo, } from '@/components/demo-kit/useExerciseDemo'
import { useExerciseDemo } from '@/components/demo-kit/useExerciseDemo'
import { midiToNoteNameOctave } from '@/lib/note-utils'
import type { GlideDemoPlan, GlideDemoTake } from './glide-demo'
import { GLIDE_DEMO_BEATS, GLIDE_DEMO_COPY } from './glide-demo'
import type { GlideDemoMark } from './glide-room-contract'
import type { GlideRoomState } from './glide-room-machine'

/** What the demo reads of the room: its way in, and where the run is. */
export interface GlideDemoRoom<S> {
  readonly script: DemoScript<S>
  state: Accessor<GlideRoomState>
}

/** What a glide room's demo brings: everything that is its own. */
export interface GlideDemoSetup<
  C extends string,
  T extends string,
  Take extends GlideDemoTake,
  S,
> {
  /** Its two takes and its cues on a note (planGlideDemo). */
  plan: (note: number) => GlideDemoPlan<C, Take>
  readonly cues: readonly DemoCue<C, GlideDemoMark, T>[]
  /** A tooltip's words. */
  cueText: (id: C) => string
  /** The singer has a note of their own, not the room's "any easy note". */
  ownNote: () => boolean
  /** A first visit opens on the demo (the room's store). */
  autoPlays: () => boolean
  /** The device has seen the demo: its end card, Skip or Not now. */
  markSeen: () => void
  sound: (ctx: AudioContext, minLead: number) => DemoSoundtrack<Take>
  /** One take as the room's script plays it, on `clock`. */
  take: (take: Take, clock: TakeClock<GlideDemoMark>) => S
}

export function useGlideDemo<
  C extends string,
  T extends string,
  Take extends GlideDemoTake,
  S,
>(
  room: GlideDemoRoom<S>,
  setup: GlideDemoSetup<C, T, Take, S>,
): ExerciseDemo<C, T | 'mic'> {
  return useExerciseDemo<C, T | 'mic', GlideDemoMark, Take, S>({
    room: {
      script: room.script,
      phase: () => room.state().phase,
      noteName: () => midiToNoteNameOctave(room.script.note()),
      ownNote: () => setup.ownNote(),
      moment: () => `${room.state().phase}:${room.state().run}`,
    },
    plan: setup.plan,
    cues: setup.cues,
    beats: GLIDE_DEMO_BEATS,
    cueText: (id) => setup.cueText(id),
    copy: GLIDE_DEMO_COPY,
    micTarget: 'mic',
    endMark: 'end',
    clearTipOn: [],
    autoPlays: () => setup.autoPlays(),
    markSeen: () => setup.markSeen(),
    sound: (ctx, minLead) => setup.sound(ctx, minLead),
    take: (take, _root, clock) => setup.take(take, clock),
  })
}
