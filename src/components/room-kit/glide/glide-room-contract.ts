// ============================================================
// What a glide room gives the core, and what the core gives the room
// ============================================================
//
// The contract of useGlideRoom.ts, apart from its workings. A glide room
// (Lip roll, Ng slides) brings what is its own, its GlideRoomSetup: its
// run's pure half (the plan, what an arch's end means, the result kept and
// summed up), its words, Merc's choreography and its scene (the scroll, a
// pitch's height, Merc's feet, the frame its scene draws). The core runs
// everything between, and hands the room's screen one controller,
// GlideRoomController, that its room, its demo and its fixture name.
//
// GlideRoomTypes is a room's own types in one bag, so a signature names the
// bag (`GlideRoomSetup<LipTypes>`) rather than seven parameters.

import type { Accessor } from 'solid-js'
import type { TakeClock } from '@/components/demo-kit/demo-plan'
import type { DemoScript } from '@/components/demo-kit/useExerciseDemo'
import type { LitStrip } from '@/components/room-kit/glide-reveal'
import type { RoomLine, RoomLines } from '@/components/room-kit/room-lines'
import type { RoutineRunOptions } from '@/components/room-kit/routine-stop'
import type { ExerciseCapture } from '@/components/room-kit/useExerciseCapture'
import type { GlideEvent } from '@/lib/glide/glide-engine'
import type { GlideResult } from '@/lib/glide/glide-metrics'
import type { GlideArch, GlidePath } from '@/lib/glide/glide-path'
import type { GlideLevelId, GlidePreset } from '@/lib/glide/glide-presets'
import type { GlideTargetInput, GlideTargets, GlideTargetSource, } from '@/lib/glide/glide-targets'
import type { MercState } from '@/lib/merc/constants'
import type { MercVoice } from '@/lib/merc/sim'
import type { ExerciseLevel } from '@/stores/exercise-level'
import type { GlideRideStates } from './glide-ride'
import type { GlideRoomState } from './glide-room-machine'
import type { GlideContact, GlideScroll, GlideTake, GlideTakeDeps, GlideTraceSample, } from './glide-take'

/** The moments the core itself speaks at: every glide room's table has them. */
export type GlideCoreMoment = 'found' | 'listen' | 'rest' | 'left' | 'again'

/**
 * What a glide line's fields become: `{note}` a note ("G3"), `{top}` an
 * arch's top note, `{pct}` a share ("88%").
 */
export interface GlideLineFields {
  readonly note?: string
  readonly top?: string
  readonly pct?: string
}

/** A moment to speak at, and its fields: what a room's run module returns. */
export type GlideLine<M extends string> = RoomLine<M, GlideLineFields>

/** A glide room's lines (room-lines.ts), with the glide fields. */
export type GlideLines<M extends string> = RoomLines<M, GlideLineFields>

/** The count-in's tone: the first root, s. */
export const COUNT_IN_TONE_SEC = 1
/** A breath's tone: the next root, s (levels that play it). */
export const BREATH_TONE_SEC = 0.7

/** A run's plan: its arches' roots and path, and the count-in before them. */
export interface GlidePlan {
  readonly roots: readonly number[]
  readonly path: GlidePath
  /** The count-in before the first arch, s: its tone and a breath. */
  readonly countIn: number
  readonly source: GlideTargetSource
}

/**
 * One arch as the engine heard it at its end: the core reads `lit`, the
 * room's line the rest.
 */
export interface GlideHeard {
  readonly lit: boolean
}

/** What keeping a run says of the best. */
export interface GlideKept {
  readonly improved: boolean
  /** The best before this run, per cent; null on a first run. */
  readonly previousBest: number | null
}

/** A moment of a take a demo tooltip can wait for: the engine's events. */
export type GlideDemoMark = GlideEvent['type']

/**
 * One of the demo's takes, sung through the room instead of the mic: its
 * frames released on its own clock (the demo kit's TakeClock, which reads
 * zero as the count-in starts, as the room's capture window does), and
 * every engine event reported back as it fires.
 */
export interface ScriptedGlideTake<
  P extends GlidePlan = GlidePlan,
> extends TakeClock<GlideDemoMark> {
  /** One arch and its count-in, as the room plans a run. */
  readonly plan: P
  /** The rules it is sung under: the demo's own, not the singer's level. */
  readonly preset: GlidePreset
}

/** What the scene draws its lines from: the path, and the names' root. */
export interface GlideSceneLines {
  readonly path: GlidePath
  /** The first root when the arches are the singer's; null for a guess. */
  readonly root: number | null
}

/** The scene a run draws on (Lip roll's BayView, Ng slides' BridgeView). */
export interface GlideView<F> {
  /** One screen frame of a run. */
  frame: (frame: F) => void
  /** A new run or the intro: every arch unlit, no trace, the camera here. */
  reset: (camera: number) => void
  /**
   * The last arch has begun: the result's lit band is decoded and its
   * canvas sized now, so the result's frame does not decode it.
   */
  prepareResult: () => void
  /**
   * The run is over: the pulled-back view, each arch lit over the ranges
   * (its u) the take lit.
   */
  result: (lit: readonly (readonly (readonly [number, number])[])[]) => void
}

/** What the core hands the room's scene frame each screen frame. */
export interface GlideFrameParts {
  /** Strips lit since the last frame. */
  readonly strips: readonly LitStrip[]
  /** The voice's trace, oldest first; the room draws what is on screen. */
  readonly trace: readonly GlideTraceSample[]
  /** Merc's feet, world y, eased toward the voice (glide-ride.ts). */
  readonly feetY: number
  /**
   * The contact light: the target's world y now, and the voice on it. Null
   * where nothing is judged (the count-in, a landing, a rest) and in the
   * demo's takes.
   */
  readonly contact: GlideContact | null
}

/** A glide room's own types, in one bag. */
export interface GlideRoomTypes {
  /** Its run's plan (the room's run module). */
  readonly plan: GlidePlan
  /** What its line reads of an arch's end. */
  readonly heard: GlideHeard
  /** A run's numbers, as its result shows them. */
  readonly summary: object
  /** Merc's moments to speak at (the room's merc-lines.ts). */
  readonly line: string
  /** What the room's scene takes each screen frame. */
  readonly frame: object
  readonly scroll: GlideScroll
  readonly scripted: ScriptedGlideTake
}

/** The run in progress, as a room's own additions read it. */
export interface GlideRun<R extends GlideRoomTypes> {
  /** The run's plan, or the demo's take's. */
  readonly plan: GlidePlan
  readonly preset: GlidePreset
  readonly scroll: R['scroll']
  readonly take: GlideTake
  /** The demo's take in place of the mic, or null for the singer's run. */
  readonly scripted: R['scripted'] | null
}

/** What a glide room brings: everything that is its own. */
export interface GlideRoomSetup<R extends GlideRoomTypes> {
  /** The exercise's id: the app's mic watchdog names the room by it. */
  readonly exercise: string
  /** The room's microphone and audio clock (its useXCapture()). */
  readonly capture: ExerciseCapture
  /** The rules at each level (glide-presets.ts). */
  readonly levels: Readonly<Record<ExerciseLevel, GlidePreset>>
  /** The run's pure half (the room's run module). */
  readonly run: {
    /** The arches, fitted to the singer (glide-targets.ts). */
    readonly fit: (input: GlideTargetInput) => GlideTargets
    /** The easy note the singer settled on in an earlier run, if any. */
    readonly remembered: () => number | null
    readonly plan: (fit: GlideTargets, preset: GlidePreset) => R['plan']
    /** What the engine knows of an arch at its end, for its line. */
    readonly heard: GlideTakeDeps<R['heard']>['heard']
    /** Keep a finished run: its history row, the level's best, its note. */
    readonly keep: (
      level: GlideLevelId,
      result: GlideResult,
      settled: number | null,
    ) => GlideKept
    readonly summarize: (
      result: GlideResult,
      kept: GlideKept,
      levelName: string,
    ) => R['summary']
  }
  /** What Merc says, and the chip. */
  readonly words: {
    /** Its table of lines; the core speaks at GlideCoreMoment too. */
    readonly lines: GlideLines<GlideCoreMoment | R['line']>
    /**
     * The line a run opens with; null for arches that are a guess.
     * `routine`: the Warm-up's cue in place of the intro.
     */
    readonly intro: (
      plan: R['plan'] | null,
      routine: boolean,
    ) => GlideLine<R['line']>
    /** The line in the breath after an arch: `next` root, its `top` note. */
    readonly afterArch: (
      heard: R['heard'],
      preset: GlidePreset,
      next: number,
      top: number,
    ) => GlideLine<R['line']>
    /** The line at the result. */
    readonly result: (
      result: GlideResult,
      summary: R['summary'],
      preset: GlidePreset,
    ) => GlideLine<R['line']>
    /** The chip during a run, `arch` counted from 0: "Wave 2 of 3". */
    readonly chip: (arch: number, arches: number) => string
  }
  /** Merc: his state at each of the core's moments, and when he cheers. */
  readonly merc: {
    readonly states: GlideRideStates
    /** He cheers this result; else he stands. */
    readonly cheers: (result: GlideResult, summary: R['summary']) => boolean
  }
  /** The room's world. */
  readonly scene: {
    /** The camera on the intro, world X. */
    readonly introCamera: number
    /** Merc's feet as a run starts, world y: on the root. */
    readonly feetStartY: number
    /** The playhead's screen X, W: the trace keeps what is on screen. */
    readonly playheadX: number
    /** The run's scroll; a demo's take may ask more of it. */
    readonly scroll: (
      plan: GlidePlan,
      scripted: R['scripted'] | null,
    ) => R['scroll']
    /** A pitch's world y on `arch`'s scale. */
    readonly pitchY: (midi: number, arch: GlideArch) => number
    /**
     * How fast his feet follow the voice's distance from the path, s (a
     * time constant, rideFeet): the core's own (RIDE_TAU_SEC) when the
     * room names none.
     */
    readonly rideTauSec?: number
    /**
     * Where Merc's feet go this frame, world y: on the voice while it
     * sounds, else on the path, else on `arch`'s root.
     */
    readonly feetTarget: (
      voiceMidi: number | null,
      targetMidi: number | null,
      arch: GlideArch,
    ) => number
    /** The scene's frame at path time `t`, from the core's parts. */
    readonly frame: (
      run: GlideRun<R>,
      t: number,
      parts: GlideFrameParts,
    ) => R['frame']
    /** The result's art, decoded as the last arch begins. */
    readonly preloadResult: () => void
    /**
     * The demo's take draws its own plan (Lip roll's one wave); false keeps
     * the intro's plan drawn under it (Ng slides).
     */
    readonly demoDrawsTake: boolean
  }
  /** The Warm-up's stop, when the room is one (routine-stop.ts). */
  readonly options?: RoutineRunOptions
}

/** What the room's screen gets: its room, its demo and its fixture name it. */
export interface GlideRoomController<R extends GlideRoomTypes> {
  state: Accessor<GlideRoomState>
  /** Merc's line in his bubble; '' for none. */
  line: Accessor<string>
  /** "Wave 2 of 3" during a run; null for none. */
  chip: Accessor<string | null>
  /**
   * An arch is being sung (its up, top and down): the singer's turn in a
   * run (glideMicState). False in the count-in, a landing, a breath and
   * the demo.
   */
  singing: Accessor<boolean>
  /**
   * How loud the singer is, 0..1, from the newest frame the run has read:
   * the mic's ring follows it. Read every frame; deliberately not reactive.
   */
  micLevel: () => number
  summary: Accessor<R['summary'] | null>
  mercState: Accessor<MercState>
  /** Read by Merc's renderer every frame; deliberately not reactive. */
  mercVoice: () => MercVoice
  /** What the scene draws its lines from. */
  lines: Accessor<GlideSceneLines>
  /** The pulled-back result is up. */
  showResult: Accessor<boolean>
  /**
   * The note a run starts from, MIDI, for a later stop of the Warm-up: the
   * easy note the room keeps, else the one it was given; null for none.
   * Read when asked; deliberately not reactive.
   */
  settledNote: () => number | null
  /** Start a run: from the intro, a result or a blocked mic. */
  start: () => void
  /** The mic button during a run: the run stops, nothing kept. */
  stop: () => void
  /** The scene the run draws on. */
  attach: (view: GlideView<R['frame']>) => void
  /** The demo's way in: its takes sung through this room. */
  script: DemoScript<R['scripted']>
}

/** The core's answer: the controller, and the run for a room's additions. */
export interface GlideRoom<
  R extends GlideRoomTypes,
> extends GlideRoomController<R> {
  /** The run in progress, or null. */
  live: () => GlideRun<R> | null
}
