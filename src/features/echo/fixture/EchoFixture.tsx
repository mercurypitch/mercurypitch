// ============================================================
// EchoFixture: a storyboard frame of the room, pinned, for the art measure
// ============================================================
//
// ART-FIDELITY.md 3.6: a fixed picture with every element at the
// storyboard's place (FIXTURE_SCENES, generated from A0's pins), so the
// art is compared and not the pitch layout. Full screen, as the storyboard
// frames it: the shell's bar and dock are interface, excluded from the
// measure, and the room does not run inside them until the full-bleed room
// is built (decision D1).
//
// Reached only from the dev server: the native entry imports this behind
// `import.meta.env.DEV` (`?echoFixture=intro`), so no build carries it.
// The capture waits for
//   [data-testid="echo-room"][data-fixture="<name>"][data-ready="true"]
// which is set once the plate and every sprite are decoded.

import type { JSX } from 'solid-js'
import { createMemo, createSignal, onCleanup, onMount } from 'solid-js'
import { MercView } from '@/components/room-kit/MercView'
import type { MercVoice } from '@/lib/merc/sim'
import { EchoMerc, mercBox } from '../EchoMerc'
import type { EchoRibbonApi } from '../EchoRibbon'
import { EchoRibbon, RIBBON_REFERENCE_W } from '../EchoRibbon'
import { EchoSky } from '../EchoSky'
import { layoutSky, onPlate } from '../sky-layout'
import type { SkyScene } from '../sky-scene'
import styles from './EchoFixture.module.css'
import type { FixtureScene } from './fixture-scenes'
import { FIXTURE_SCENES } from './fixture-scenes'

export type FixtureName = keyof typeof FIXTURE_SCENES

export function isFixtureName(name: string | null): name is FixtureName {
  return name !== null && Object.hasOwn(FIXTURE_SCENES, name)
}

/** A fixture as the sky draws it: places pinned, nothing moving. */
export function fixtureSky(scene: FixtureScene): SkyScene {
  return {
    rings: scene.rings.map((ring, i) => ({
      key: `ring-${i}`,
      u: ring.u,
      v: ring.v,
      rW: ring.rW,
      style: ring.style,
    })),
    stars: scene.stars.map((star, i) => ({
      key: `star-${i}`,
      u: star.u,
      v: star.v,
      widthW: star.widthW,
      size: star.size,
      tint: star.tint,
      mix: 1,
    })),
    lines: scene.lines.map((line, i) => ({
      key: `line-${i}`,
      a: line.a,
      b: line.b,
      style: line.style,
    })),
    result: scene.plate === 'result',
    celebration: scene.celebration,
  }
}

/** Every image in `root` decoded (a failure counts: it will not get better). */
async function imagesDecoded(root: HTMLElement): Promise<void> {
  const images = [...root.querySelectorAll('img')]
  await Promise.all(
    images.map((img) =>
      typeof img.decode === 'function'
        ? img.decode().catch(() => undefined)
        : Promise.resolve(),
    ),
  )
}

const SILENT: MercVoice = {
  voiced: false,
  cents: 0,
  level: 0,
  steady: 1,
  midi: 57,
}

export interface EchoFixtureProps {
  name: FixtureName
}

export function EchoFixture(props: EchoFixtureProps): JSX.Element {
  let room: HTMLDivElement | undefined
  const [size, setSize] = createSignal({
    width: window.innerWidth,
    height: window.innerHeight,
  })
  const [ready, setReady] = createSignal(false)
  const fixture = (): FixtureScene => FIXTURE_SCENES[props.name]
  // The storyboard's frame: the island, the chip and the result's numbers
  // where screens 1, 2 and 4 put them.
  const layout = createMemo(() => {
    const { width, height } = size()
    return layoutSky({
      width,
      height,
      edgeClear: 0.06 * height,
      chipClear: 0.18 * height,
      resultClear: 0.245 * height,
    })
  })
  const scene = createMemo(() => fixtureSky(fixture()))
  let ribbon: EchoRibbonApi | null = null

  const drawRibbon = (): void => {
    const path = fixture().ribbon
    if (ribbon === null) return
    if (path === null) {
      ribbon.draw(null)
      return
    }
    const l = layout()
    ribbon.draw({
      points: path.points.map(([u, v]) => ({
        ...onPlate(l, { u, v }),
        filling: true,
      })),
      scale: path.scale * (l.unit / RIBBON_REFERENCE_W),
    })
  }

  const onResize = (): void => {
    setSize({ width: window.innerWidth, height: window.innerHeight })
  }

  onMount(() => window.addEventListener('resize', onResize))
  onCleanup(() => window.removeEventListener('resize', onResize))

  const settled = (): void => {
    drawRibbon()
    // Two frames for the compositor to settle the blurred glow.
    void (room === undefined ? Promise.resolve() : imagesDecoded(room)).then(
      () =>
        requestAnimationFrame(() =>
          requestAnimationFrame(() => setReady(true)),
        ),
    )
  }

  const merc = createMemo(() => mercBox(layout()))

  return (
    <div
      ref={room}
      class={styles.page}
      data-testid="echo-room"
      data-fixture={props.name}
      data-ready={ready() ? 'true' : 'false'}
    >
      <EchoSky
        layout={layout()}
        scene={scene()}
        still
        clouds={
          fixture().clouds === null ? undefined : { present: true, on: true }
        }
        onPlateSettled={settled}
        ribbon={
          <EchoRibbon
            box={{
              left: 0,
              top: 0,
              width: size().width,
              height: size().height,
            }}
            scale={
              (fixture().ribbon?.scale ?? 1) *
              (layout().unit / RIBBON_REFERENCE_W)
            }
            onReady={(api) => {
              ribbon = api
              drawRibbon()
            }}
          />
        }
      >
        <EchoMerc box={merc()}>
          <MercView
            state={() => fixture().merc}
            voice={() => SILENT}
            testId="echo-merc"
          />
        </EchoMerc>
      </EchoSky>
    </div>
  )
}
