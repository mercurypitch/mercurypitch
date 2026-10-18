// ============================================================
// LipFixture: a storyboard frame of the room, pinned, for the art measure
// ============================================================
//
// ART-FIDELITY.md 3.6, as Ng's fixtures: the room as storyboard screens 1
// to 4 draw it (fixture-scenes.ts), nothing moving. The room itself draws
// it, every component its own, with a pinned run in place of a live one:
// the scene's camera, zoom, lit strips, ribbon and Merc are handed in
// once, as a run would hand them in a frame.
//
// Reached only from the dev server: the native entry imports this behind
// `import.meta.env.DEV` (`?lipFixture=intro`), so no build carries it. The
// capture waits for
//   [data-testid="lip-fixture"][data-fixture="<name>"][data-ready="true"]
// which is set once every picture is decoded and every canvas painted.

import type { JSX } from 'solid-js'
import { createFixtureReady, glideFixtureController, } from '@/components/room-kit/glide/glide-fixture'
import type { RoutineStop } from '@/components/room-kit/routine-stop'
import { lipRollPath } from '@/lib/glide/glide-path'
import { LIP_ROLL_LEVELS } from '@/lib/glide/glide-presets'
import { bayArt, bayImage, BUBBLE_URL } from '../bay-art'
import type { LipController, LipTypes } from '../lip-controller-contract'
import { LipRollRoom } from '../LipRollRoom'
import { LIP_LINES } from '../merc-lines'
import type { LipFixtureName, LipFixtureScene } from './fixture-scenes'
import { FIXTURE_ROOT, FIXTURE_SCENES } from './fixture-scenes'

export function isFixtureName(name: string | null): name is LipFixtureName {
  return name !== null && Object.hasOwn(FIXTURE_SCENES, name)
}

const PATH = lipRollPath(
  [0, 2, 4].map((k) => FIXTURE_ROOT + k),
  12,
  LIP_ROLL_LEVELS.singer,
)

/** A run that is only ever this one frame. */
export function fixtureController(scene: LipFixtureScene): LipController {
  return {
    ...glideFixtureController<LipTypes, LipFixtureScene>(scene, {
      root: FIXTURE_ROOT,
      // Screen 2's voice: on its way up a wave, so `ride` leans him.
      riseStPerSec: 6,
      lines: () => ({ path: PATH, root: FIXTURE_ROOT }),
      frame: (pinned, strips) => ({
        camera: pinned.camera,
        zoom: pinned.zoom,
        strips,
        trace: pinned.trace,
        merc: pinned.merc,
        voiced: pinned.voiced,
        // The storyboard's frames: no contact light.
        contact: null,
      }),
    }),
    mercAhead: () => [],
  }
}

/** The pictures the canvases copy from: decoded, so they have painted. */
async function canvasesPainted(): Promise<void> {
  const art = bayArt(window.devicePixelRatio || 1)
  await Promise.all(
    [art.waveUnlit, art.waveLit, art.resultLit, BUBBLE_URL].map((url) =>
      bayImage(url).catch(() => undefined),
    ),
  )
}

export interface LipFixtureProps {
  name: LipFixtureName
  /** The room as a stop of the Warm-up (`&warmUp=<n>`); none by default. */
  stop?: RoutineStop
}

/** In the Warm-up the intro opens on Merc's cue (merc-lines.ts). */
function inWarmUp(
  scene: LipFixtureScene,
  stop: RoutineStop | undefined,
): LipFixtureScene {
  if (stop === undefined || scene.phase !== 'intro') return scene
  return { ...scene, line: LIP_LINES.routine[0].text }
}

export function LipFixture(props: LipFixtureProps): JSX.Element {
  const { ready, settled } = createFixtureReady(canvasesPainted)
  // eslint-disable-next-line solid/reactivity -- a fixture is one frame
  const scene = inWarmUp(FIXTURE_SCENES[props.name], props.stop)
  const controller = fixtureController(scene)
  return (
    <div
      style={{
        position: 'fixed',
        inset: '0',
        '--pushed-top': 'calc(var(--safe-top, 0px) + 56px)',
        '--pushed-bottom': 'var(--safe-bottom, 0px)',
      }}
      data-testid="lip-fixture"
      data-fixture={props.name}
      data-ready={ready() ? 'true' : 'false'}
    >
      <LipRollRoom
        onDone={() => undefined}
        controller={controller}
        still
        onSettled={settled}
        routine={props.stop}
      />
    </div>
  )
}
