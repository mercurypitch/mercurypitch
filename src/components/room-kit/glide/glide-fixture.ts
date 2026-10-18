// ============================================================
// A glide room's fixture: one storyboard frame as a pinned run
// ============================================================
//
// ART-FIDELITY.md 3.6: a glide room as its storyboard's screens draw it,
// nothing moving, for the art measure. The room itself draws it, every
// component its own, with a pinned run in place of a live one
// (glideFixtureController): the scene's camera, lit strips, ribbon and
// Merc are handed in once, as a run would hand them in a frame. A room
// brings its scenes (its fixture-scenes.ts), its path and the frame its
// scene takes; its fixture page waits on createFixtureReady before the
// capture reads it.
//
// Reached only from the dev server: the native entry imports a room's
// fixture behind `import.meta.env.DEV`, so no build carries it.

import type { Accessor } from 'solid-js'
import { createSignal } from 'solid-js'
import type { LitStrip } from '@/components/room-kit/glide-reveal'
import type { MercState } from '@/lib/merc/constants'
import type { MercVoice } from '@/lib/merc/sim'
import { introHum } from './glide-ride'
import type { GlideRoomController, GlideRoomTypes, GlideSceneLines, } from './glide-room-contract'
import type { GlideRoomPhase } from './glide-room-machine'

/** The parts of a storyboard screen every glide room's fixture pins. */
export interface GlideFixtureScene<Summary> {
  readonly phase: GlideRoomPhase
  /** World X under the playhead. */
  readonly camera: number
  /** Each arch's lit ranges, in its u. */
  readonly lit: readonly (readonly (readonly [number, number])[])[]
  readonly mercState: MercState
  /**
   * What Merc hears: nothing, his own voice (the intro), or a voice on its
   * way up an arch (GlideFixtureSetup.riseStPerSec, so `ride` leans him).
   */
  readonly voice: 'silent' | 'hum' | 'rise'
  readonly chip: string | null
  /** Merc's line, as the room would say it. */
  readonly line: string
  readonly summary: Summary | null
}

/** What a room's fixture brings. */
export interface GlideFixtureSetup<R extends GlideRoomTypes, Scene> {
  /** The first arch's root in every fixture, MIDI. */
  readonly root: number
  /** A rising voice's climb, semitones a second (screen 2). */
  readonly riseStPerSec: number
  /** What the scene draws its lines from, on this screen. */
  readonly lines: (scene: Scene) => GlideSceneLines
  /** The scene's frame: the pinned screen, with its lit strips. */
  readonly frame: (scene: Scene, strips: readonly LitStrip[]) => R['frame']
}

const SILENT: MercVoice = {
  voiced: false,
  cents: 0,
  level: 0,
  steady: 1,
  midi: 57,
}

function voiceOf(
  kind: GlideFixtureScene<unknown>['voice'],
  root: number,
  riseStPerSec: number,
): () => MercVoice {
  if (kind === 'hum') {
    const hum = introHum(root)
    return () => hum
  }
  if (kind === 'rise') {
    return () => ({
      voiced: true,
      cents: 0,
      level: 0.6,
      steady: 1,
      midi: root + (riseStPerSec * performance.now()) / 1000,
    })
  }
  return () => SILENT
}

/** A run that is only ever this one frame. */
export function glideFixtureController<
  R extends GlideRoomTypes,
  Scene extends GlideFixtureScene<R['summary']>,
>(scene: Scene, setup: GlideFixtureSetup<R, Scene>): GlideRoomController<R> {
  const strips: LitStrip[] = scene.lit.flatMap((ranges, arch) =>
    ranges.map(([from, to]) => ({ arch, from, to })),
  )
  const voice = voiceOf(scene.voice, setup.root, setup.riseStPerSec)
  return {
    state: () => ({ phase: scene.phase, run: 0, block: null }),
    line: () => scene.line,
    chip: () => scene.chip,
    // A pinned arch is being sung, and the mic's ring holds at the pinned
    // voice's loudness.
    singing: () => scene.phase === 'run',
    micLevel: () => voice().level,
    summary: () => scene.summary,
    mercState: () => scene.mercState,
    mercVoice: voice,
    lines: () => setup.lines(scene),
    showResult: () => scene.summary !== null,
    settledNote: () => setup.root,
    start: () => undefined,
    stop: () => undefined,
    // A fixture has no demo (the room: another's run has none).
    script: {
      active: () => false,
      audio: () => Promise.resolve(null),
      note: () => setup.root,
      enter: () => false,
      play: () => undefined,
      rest: () => undefined,
      leave: () => undefined,
      playing: () => undefined,
    },
    attach: (view) => {
      view.reset(scene.camera)
      if (scene.summary !== null) {
        view.result(scene.lit)
        return
      }
      view.frame(setup.frame(scene, strips))
    },
  }
}

/**
 * The fixture page's ready flag, for the capture: true two frames after
 * the room has settled and every picture its canvases copy from has
 * decoded (`painted`), so every canvas has painted.
 */
export function createFixtureReady(painted: () => Promise<void>): {
  ready: Accessor<boolean>
  /** The room's onSettled. */
  settled: () => void
} {
  const [ready, setReady] = createSignal(false)
  const settled = (): void => {
    void painted().then(() =>
      requestAnimationFrame(() => requestAnimationFrame(() => setReady(true))),
    )
  }
  return { ready, settled }
}
