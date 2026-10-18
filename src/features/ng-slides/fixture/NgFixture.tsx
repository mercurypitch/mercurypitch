// ============================================================
// NgFixture: a storyboard frame of the room, pinned, for the art measure
// ============================================================
//
// ART-FIDELITY.md 3.6, as Echo's fixtures: the room as storyboard screens
// 1 to 4 draw it (fixture-scenes.ts), nothing moving. The room itself
// draws it, every component its own, with a pinned run in place of a
// live one: the scene's camera, lit strips, ribbon and Merc are handed in
// once, as a run would hand them in a frame.
//
// Reached only from the dev server: the native entry imports this behind
// `import.meta.env.DEV` (`?ngFixture=intro`), so no build carries it. The
// capture waits for
//   [data-testid="ng-fixture"][data-fixture="<name>"][data-ready="true"]
// which is set once every picture is decoded and every canvas painted.

import type { JSX } from 'solid-js'
import { createFixtureReady, glideFixtureController, } from '@/components/room-kit/glide/glide-fixture'
import type { RoutineStop } from '@/components/room-kit/routine-stop'
import { ngSlidesPath } from '@/lib/glide/glide-path'
import { NG_SLIDES_LEVELS } from '@/lib/glide/glide-presets'
import { bridgeArt, bridgeImage, REFLECTION_ART } from '../bridge-art'
import { NG_LINES } from '../merc-lines'
import type { NgController, NgTypes } from '../ng-controller-contract'
import { NgSlidesRoom } from '../NgSlidesRoom'
import type { NgFixtureName, NgFixtureScene } from './fixture-scenes'
import { FIXTURE_ROOT, FIXTURE_SCENES } from './fixture-scenes'

export function isFixtureName(name: string | null): name is NgFixtureName {
  return name !== null && Object.hasOwn(FIXTURE_SCENES, name)
}

const PATH = ngSlidesPath(
  [0, 1, 2, 3, 4].map((k) => FIXTURE_ROOT + k),
  NG_SLIDES_LEVELS.singer,
)

/** A run that is only ever this one frame. */
export function fixtureController(scene: NgFixtureScene): NgController {
  return glideFixtureController<NgTypes, NgFixtureScene>(scene, {
    root: FIXTURE_ROOT,
    // Screen 2's voice: on its way up a slide, so `ride` leans him.
    riseStPerSec: 5,
    lines: (pinned) => ({
      path: PATH,
      root: pinned.names ? FIXTURE_ROOT : null,
    }),
    frame: (pinned, strips) => ({
      camera: pinned.camera,
      strips,
      trace: pinned.trace,
      merc: pinned.merc,
      // The storyboard's frames: no contact light.
      contact: null,
    }),
  })
}

/** The pictures the canvases copy from: decoded, so they have painted. */
async function canvasesPainted(): Promise<void> {
  const art = bridgeArt(window.devicePixelRatio || 1)
  await Promise.all(
    [
      art.glassUnlit,
      art.glassLit,
      art.resultLit,
      REFLECTION_ART.unlit,
      REFLECTION_ART.lit,
    ].map((url) => bridgeImage(url).catch(() => undefined)),
  )
}

export interface NgFixtureProps {
  name: NgFixtureName
  /** The room as a stop of the Warm-up (`&warmUp=<n>`); none by default. */
  stop?: RoutineStop
}

/** In the Warm-up the intro opens on Merc's cue (merc-lines.ts). */
function inWarmUp(
  scene: NgFixtureScene,
  stop: RoutineStop | undefined,
): NgFixtureScene {
  if (stop === undefined || scene.phase !== 'intro') return scene
  return { ...scene, line: NG_LINES.routine[0].text }
}

export function NgFixture(props: NgFixtureProps): JSX.Element {
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
      data-testid="ng-fixture"
      data-fixture={props.name}
      data-ready={ready() ? 'true' : 'false'}
    >
      <NgSlidesRoom
        onDone={() => undefined}
        controller={controller}
        still
        onSettled={settled}
        routine={props.stop}
      />
    </div>
  )
}
