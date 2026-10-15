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
import { createSignal } from 'solid-js'
import { ngSlidesPath } from '@/lib/glide/glide-path'
import { NG_SLIDES_LEVELS } from '@/lib/glide/glide-presets'
import type { MercVoice } from '@/lib/merc/sim'
import { bridgeArt, bridgeImage, REFLECTION_ART } from '../bridge-art'
import type { LitStrip } from '../bridge-reveal'
import { introHum } from '../bridge-ride'
import { NgSlidesRoom } from '../NgSlidesRoom'
import type { NgController } from '../useNgController'
import type { NgFixtureName, NgFixtureScene } from './fixture-scenes'
import { FIXTURE_ROOT, FIXTURE_SCENES } from './fixture-scenes'

export function isFixtureName(name: string | null): name is NgFixtureName {
  return name !== null && Object.hasOwn(FIXTURE_SCENES, name)
}

const SILENT: MercVoice = {
  voiced: false,
  cents: 0,
  level: 0,
  steady: 1,
  midi: 57,
}

/** Screen 2's voice: on its way up a slide, so `ride` leans him. */
const RISE_ST_PER_SEC = 5

function voiceOf(kind: NgFixtureScene['voice']): () => MercVoice {
  if (kind === 'hum') {
    const hum = introHum(FIXTURE_ROOT)
    return () => hum
  }
  if (kind === 'rise') {
    return () => ({
      voiced: true,
      cents: 0,
      level: 0.6,
      steady: 1,
      midi: FIXTURE_ROOT + (RISE_ST_PER_SEC * performance.now()) / 1000,
    })
  }
  return () => SILENT
}

const PATH = ngSlidesPath(
  [0, 1, 2, 3, 4].map((k) => FIXTURE_ROOT + k),
  NG_SLIDES_LEVELS.singer,
)

/** A run that is only ever this one frame. */
export function fixtureController(scene: NgFixtureScene): NgController {
  const strips: LitStrip[] = scene.lit.flatMap((ranges, arch) =>
    ranges.map(([from, to]) => ({ arch, from, to })),
  )
  const voice = voiceOf(scene.voice)
  return {
    state: () => ({ phase: scene.phase, run: 0, block: null }),
    line: () => scene.line,
    chip: () => scene.chip,
    // A pinned slide is being sung, and the mic's ring holds at the
    // pinned voice's loudness.
    sliding: () => scene.phase === 'run',
    micLevel: () => voice().level,
    summary: () => scene.summary,
    mercState: () => scene.mercState,
    mercVoice: voice,
    lines: () => ({ path: PATH, root: scene.names ? FIXTURE_ROOT : null }),
    showResult: () => scene.summary !== null,
    start: () => undefined,
    stop: () => undefined,
    // A fixture has no demo (NgSlidesRoom: another's run has none).
    script: {
      active: () => false,
      audio: () => Promise.resolve(null),
      note: () => FIXTURE_ROOT,
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
      view.frame({
        camera: scene.camera,
        strips,
        trace: scene.trace,
        merc: scene.merc,
      })
    },
  }
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
}

export function NgFixture(props: NgFixtureProps): JSX.Element {
  const [ready, setReady] = createSignal(false)
  // eslint-disable-next-line solid/reactivity -- a fixture is one frame
  const controller = fixtureController(FIXTURE_SCENES[props.name])
  const settled = (): void => {
    void canvasesPainted().then(() =>
      requestAnimationFrame(() => requestAnimationFrame(() => setReady(true))),
    )
  }
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
      />
    </div>
  )
}
