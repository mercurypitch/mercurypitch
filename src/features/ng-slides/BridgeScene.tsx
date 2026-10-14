// ============================================================
// BridgeScene: the river, the glass bridge, the voice and Merc
// ============================================================
//
// ART-FIDELITY.md 4.2's layers, back to front:
//
//   river-back   sky, mist, the far bank and its lights: one plate,
//                scrolled at a third of the bridge's speed (PARALLAX)
//   shimmer      the water's light, drifting (CSS; still under reduced
//                motion)
//   stone        the piers and the landings, opaque
//   glass        each arch's glass and its reflection, light added over
//                what is behind (`plus-lighter`): unlit pictures, and a
//                canvas for each arch lighting (bridge-glass.ts)
//   lines        the target line along each arch (an SVG path from the
//                glide path's own targetAt), the first arch's note names
//   ribbon       the voice (BridgeRibbon.tsx), fixed to the screen
//   near bank    the corners' frame, fixed (F2), and the light at the top
//   result       the pulled-back bridge, lit once from the take
//   Merc         his canvas, moved by transform
//
// The stone, the glass and the lines move together, one transform each a
// frame; nothing here is a signal per frame. The run drives it through the
// BridgeView it is handed (`onReady`). Every picture here is a stand-in
// drawn from the N0 geometry until the paintings arrive (STAND-INS.md).

import type { JSX } from 'solid-js'
import { createMemo, createSignal, For, onCleanup, onMount, Show, } from 'solid-js'
import type { Plate } from '@/components/room-kit/plate-loader'
import { claimPlate, releasePlate } from '@/components/room-kit/plate-loader'
import type { GlidePath } from '@/lib/glide/glide-path'
import { targetAt } from '@/lib/glide/glide-path'
import { midiToNoteNameOctave } from '@/lib/note-utils'
import { bridgeArt, bridgeImage, REFLECTION_ART, RESULT_PLATE, RIVER_PLATE, SHIMMER_URL, } from './bridge-art'
import { ARCH, NOTE_NAMES, PARALLAX, PLATES, PLAYHEAD_X, RESULT_VIEW, SHIMMER, STORYBOARD_ASPECT, TARGET_LINE, } from './bridge-geometry'
import type { GlassImages } from './bridge-glass'
import { createArchGlass } from './bridge-glass'
import type { BridgeLayout, MercBox } from './bridge-layout'
import { MERC_INTRO_X, mercBoxAt, mercResultBox, pitchY, yOf, } from './bridge-layout'
import { apexX, INTRO_CAMERA } from './bridge-scroll'
import type { BridgeView, TraceSample } from './bridge-view'
import type { BridgeRibbonApi, StrokePoint } from './BridgeRibbon'
import { BridgeRibbon } from './BridgeRibbon'
import styles from './NgSlidesRoom.module.css'

/** The river's left edge on the intro, W of the screen. */
const RIVER_LEFT = -0.08
/** The ribbon: the shared look, a little wider (N0: 0.031 W at half height). */
const RIBBON_REFERENCE_W = 390
const RIBBON_WIDEN = 1.15
/** The overlay's SVG runs this far past the first and last arches, W. */
const LINES_MARGIN = 1.3
const ARCHES = 5
/** The water's top on the storyboard (ng-n0 bands: 0.38 H). */
const WATER_TOP = 0.38 * STORYBOARD_ASPECT

export interface BridgeSceneProps {
  layout: BridgeLayout
  /** The glide path whose targets the lines follow. */
  path: GlidePath
  /** The first arch's root, for its note names; null shows none. */
  root: number | null
  /** Reduced motion: the river and the shimmer hold still. */
  reduced: boolean
  /** The pulled-back result is showing. */
  showResult: boolean
  /** No animation at all: the fixtures' pinned frames. */
  still?: boolean
  /** Merc's view, placed by the scene. */
  merc: JSX.Element
  onReady: (view: BridgeView) => void
  /** Every picture shown has decoded (the fixtures wait for it). */
  onSettled?: () => void
}

/** The target line over arch k, from the path's own targets. */
function linePath(path: GlidePath, k: number, layout: BridgeLayout): string {
  const arch = path.arches[k]
  const steps = 96
  const parts: string[] = []
  for (let i = 0; i <= steps; i++) {
    const t = arch.start + ((arch.end - arch.start) * i) / steps
    const midi = targetAt(path, t) ?? arch.rootMidi
    const x = apexX(k) - ARCH.a + (2 * ARCH.a * i) / steps + LINES_MARGIN
    const y = pitchY(midi, arch.rootMidi) + TARGET_LINE.offset
    parts.push(
      `${i === 0 ? 'M' : 'L'}${(x * layout.unit).toFixed(1)} ${yOf(layout, y).toFixed(1)}`,
    )
  }
  return parts.join('')
}

/** Every image under `root` decoded (a failure counts: it will not get better). */
async function imagesDecoded(root: HTMLElement): Promise<void> {
  await Promise.all(
    [...root.querySelectorAll('img')].map((img) =>
      typeof img.decode === 'function'
        ? img.decode().catch(() => undefined)
        : Promise.resolve(),
    ),
  )
}

/** The voice's samples on screen, as strokes in px, broken at its gaps. */
function strokesOf(
  trace: readonly TraceSample[],
  camera: number,
  layout: BridgeLayout,
): StrokePoint[][] {
  const strokes: StrokePoint[][] = []
  let current: StrokePoint[] = []
  const left = camera - PLAYHEAD_X - 0.05
  for (const sample of trace) {
    if (sample.x < left) continue
    if (sample.gap && current.length > 0) {
      strokes.push(current)
      current = []
    }
    current.push({
      x: (PLAYHEAD_X + sample.x - camera) * layout.unit,
      y: yOf(layout, sample.y),
      filling: sample.filling,
    })
  }
  if (current.length > 0) strokes.push(current)
  return strokes
}

export function BridgeScene(props: BridgeSceneProps): JSX.Element {
  let rootEl: HTMLDivElement | undefined
  let river: HTMLDivElement | undefined
  let stone: HTMLDivElement | undefined
  let glassLayer: HTMLDivElement | undefined
  let lines: HTMLDivElement | undefined
  let mercEl: HTMLDivElement | undefined
  let resultLit: HTMLCanvasElement | undefined
  let resultHolder: HTMLDivElement | undefined
  let ribbon: BridgeRibbonApi | null = null
  let riverPlate: Plate | null = null
  let resultPlate: Plate | null = null
  const glassHolders: HTMLDivElement[] = []
  const reflectionHolders: HTMLDivElement[] = []
  const [resultReady, setResultReady] = createSignal(false)

  const dpr = (): number => window.devicePixelRatio || 1
  const art = createMemo(() => bridgeArt(dpr()))
  const unit = (): number => props.layout.unit

  const glassImages = async (): Promise<GlassImages> => {
    const files = art()
    const [glassUnlit, glassLit, reflectionUnlit, reflectionLit] =
      await Promise.all([
        bridgeImage(files.glassUnlit),
        bridgeImage(files.glassLit),
        bridgeImage(REFLECTION_ART.unlit),
        bridgeImage(REFLECTION_ART.lit),
      ])
    return { glassUnlit, glassLit, reflectionUnlit, reflectionLit }
  }

  const glass = createArchGlass({
    holders: (k) => {
      const g = glassHolders[k] as HTMLDivElement | undefined
      const r = reflectionHolders[k] as HTMLDivElement | undefined
      return g === undefined || r === undefined
        ? null
        : { glass: g, reflection: r }
    },
    images: glassImages,
  })

  const riverX = (camera: number): number => {
    const travel = props.reduced ? 0 : (camera - INTRO_CAMERA) * PARALLAX
    return (RIVER_LEFT - travel) * unit()
  }

  let camera = INTRO_CAMERA
  const moveTo = (next: number): void => {
    camera = next
    const t = `translate3d(${((PLAYHEAD_X - next) * unit()).toFixed(2)}px,0,0)`
    if (stone !== undefined) stone.style.transform = t
    if (glassLayer !== undefined) glassLayer.style.transform = t
    if (lines !== undefined) lines.style.transform = t
    if (river !== undefined) {
      river.style.transform = `translate3d(${riverX(next).toFixed(2)}px,0,0)`
    }
  }

  /** His canvas keeps one size (a resize reallocates its GL buffers): scaled. */
  const placeMerc = (box: MercBox): void => {
    if (mercEl === undefined) return
    const k = box.size / props.layout.mercSize
    mercEl.style.transform = `translate3d(${box.left.toFixed(1)}px,${box.top.toFixed(1)}px,0) scale(${k.toFixed(3)})`
  }

  const ribbonScale = (): number => (unit() / RIBBON_REFERENCE_W) * RIBBON_WIDEN

  /** The result's lit band: the take's ranges, at screen 4's arches. */
  const paintResult = async (
    lit: readonly (readonly (readonly [number, number])[])[],
  ): Promise<void> => {
    const image = await bridgeImage(art().resultLit).catch(() => null)
    const canvas = resultLit
    if (image === null || canvas === undefined) return
    canvas.width = image.naturalWidth || image.width
    canvas.height = image.naturalHeight || image.height
    const ctx = canvas.getContext('2d')
    if (ctx === null) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    lit.forEach((ranges, k) => {
      const apex = RESULT_VIEW.apexX[k] as number | undefined
      if (apex === undefined) return
      for (const [from, to] of ranges) {
        const x0 = Math.floor(
          (apex + from * RESULT_VIEW.halfWidth) * canvas.width,
        )
        const x1 = Math.ceil((apex + to * RESULT_VIEW.halfWidth) * canvas.width)
        if (x1 > x0) {
          ctx.drawImage(
            image,
            x0,
            0,
            x1 - x0,
            canvas.height,
            x0,
            0,
            x1 - x0,
            canvas.height,
          )
        }
      }
    })
  }

  /** The last frame's voice, for a ribbon that mounts after it. */
  let lastTrace: { trace: readonly TraceSample[]; camera: number } | null = null

  const view: BridgeView = {
    frame: (f) => {
      moveTo(f.camera)
      glass.paint(f.strips)
      lastTrace = { trace: f.trace, camera: f.camera }
      ribbon?.draw(strokesOf(f.trace, f.camera, props.layout), ribbonScale())
      placeMerc(mercBoxAt(props.layout, f.merc.x, f.merc.feetY))
    },
    reset: (at) => {
      glass.reset()
      lastTrace = null
      ribbon?.draw([], ribbonScale())
      moveTo(at)
      placeMerc(mercBoxAt(props.layout, MERC_INTRO_X, ARCH.deckY))
      setResultReady(false)
    },
    result: (lit) => {
      if (resultHolder !== undefined && resultPlate === null) {
        resultPlate = claimPlate(RESULT_PLATE)
        resultPlate.img.alt = ''
        resultHolder.prepend(resultPlate.picture)
      }
      void paintResult(lit).finally(() => {
        setResultReady(true)
        // A frame later, so his walk to the far end is a transition.
        requestAnimationFrame(() => placeMerc(mercResultBox(props.layout)))
      })
    },
  }

  onMount(() => {
    if (river !== undefined) {
      riverPlate = claimPlate(RIVER_PLATE)
      riverPlate.img.alt = ''
      river.appendChild(riverPlate.picture)
    }
    moveTo(camera)
    placeMerc(mercBoxAt(props.layout, MERC_INTRO_X, ARCH.deckY))
    props.onReady(view)
    if (props.onSettled !== undefined && rootEl !== undefined) {
      const done = props.onSettled
      void imagesDecoded(rootEl).then(done)
    }
  })

  onCleanup(() => {
    glass.reset()
    if (riverPlate !== null) releasePlate(riverPlate)
    if (resultPlate !== null) releasePlate(resultPlate)
    riverPlate = null
    resultPlate = null
  })

  // ── Places, px ─────────────────────────────────────────────
  const frame = (name: keyof typeof PLATES) => PLATES[name].frame
  const box = (
    left: number,
    top: number,
    width: number,
    height: number,
  ): JSX.CSSProperties => ({
    left: `${(left * unit()).toFixed(1)}px`,
    top: `${yOf(props.layout, top).toFixed(1)}px`,
    width: `${(width * unit()).toFixed(1)}px`,
    height: `${(height * unit()).toFixed(1)}px`,
  })
  const archBox = (k: number, name: 'glass-unlit' | 'reflection-unlit') => {
    const f = frame(name)
    return box(apexX(k) + f.left, f.top, f.width, f.height)
  }
  const landingBox = (k: number) => {
    const f = frame('landing')
    return box(apexX(k) + f.left, f.top, f.width, f.height)
  }
  const pier = frame('pier')
  const lastApex = apexX(ARCHES - 1)
  const linesWidth = (): number => lastApex + 2 * LINES_MARGIN
  const arches = Array.from({ length: ARCHES }, (_, k) => k)

  /** The lines' SVG, rebuilt only when the path or the frame changes. */
  const archLines = createMemo(() =>
    arches.map((k) => linePath(props.path, k, props.layout)),
  )
  const names = createMemo(() => {
    const root = props.root
    if (root === null) return null
    const fontPx = (NOTE_NAMES.capHeight / 0.72) * unit()
    const at = (dx: number, y: number) => ({
      x: (dx + LINES_MARGIN) * unit(),
      y: yOf(props.layout, y),
    })
    return {
      fontPx,
      root: {
        ...at(NOTE_NAMES.root.dx, ARCH.deckY + NOTE_NAMES.root.dy),
        text: midiToNoteNameOctave(root),
      },
      top: {
        ...at(NOTE_NAMES.top.dx, ARCH.apexY + NOTE_NAMES.top.dy),
        text: midiToNoteNameOctave(root + 7),
      },
    }
  })

  const resultBox = (): JSX.CSSProperties => ({
    top: `${(-props.layout.resultTop * unit()).toFixed(1)}px`,
    height: `${(STORYBOARD_ASPECT * unit()).toFixed(1)}px`,
  })
  const resultBand = (): JSX.CSSProperties => {
    const f = frame('result-lit')
    // Inside the result's own box, which starts at the storyboard's top.
    return {
      top: `${(f.top * unit()).toFixed(1)}px`,
      height: `${(f.height * unit()).toFixed(1)}px`,
    }
  }

  return (
    <div
      ref={rootEl}
      class={styles.scene}
      classList={{
        [styles.reduced]: props.reduced,
        [styles.still]: props.still === true,
      }}
      data-result={props.showResult && resultReady() ? 'true' : 'false'}
      data-testid="ng-scene"
    >
      <div class={styles.take} data-testid="ng-take">
        <div
          ref={river}
          class={styles.river}
          style={{
            top: `${yOf(props.layout, frame('riverback').top).toFixed(1)}px`,
            width: `${(frame('riverback').width * unit()).toFixed(1)}px`,
            height: `${(frame('riverback').height * unit()).toFixed(1)}px`,
          }}
          data-testid="ng-river"
        />
        <div
          class={styles.shimmer}
          style={{
            top: `${yOf(props.layout, WATER_TOP).toFixed(1)}px`,
            'background-image': `url("${SHIMMER_URL}")`,
            'background-size': `${unit().toFixed(1)}px ${((SHIMMER.height / SHIMMER.width) * unit()).toFixed(1)}px`,
          }}
          aria-hidden="true"
        />
        <div ref={stone} class={styles.world} data-testid="ng-stone">
          <img
            class={styles.sprite}
            src={art().pier}
            alt=""
            style={box(pier.left, pier.top, pier.width, pier.height)}
          />
          <For each={arches.slice(0, -1)}>
            {(k) => (
              <img
                class={styles.sprite}
                src={art().landing}
                alt=""
                style={landingBox(k)}
              />
            )}
          </For>
          <img
            class={`${styles.sprite} ${styles.mirrored}`}
            src={art().pier}
            alt=""
            style={box(
              lastApex - pier.left - pier.width,
              pier.top,
              pier.width,
              pier.height,
            )}
          />
        </div>
        <div
          ref={glassLayer}
          class={`${styles.world} ${styles.glass}`}
          data-testid="ng-glass"
        >
          <For each={arches}>
            {(k) => (
              <>
                <div
                  ref={(el) => (reflectionHolders[k] = el)}
                  class={styles.sprite}
                  style={archBox(k, 'reflection-unlit')}
                >
                  <img class={styles.fill} src={REFLECTION_ART.unlit} alt="" />
                </div>
                <div
                  ref={(el) => (glassHolders[k] = el)}
                  class={styles.sprite}
                  style={archBox(k, 'glass-unlit')}
                  data-arch={k}
                >
                  <img class={styles.fill} src={art().glassUnlit} alt="" />
                </div>
              </>
            )}
          </For>
        </div>
        <div ref={lines} class={styles.world} data-testid="ng-lines">
          <svg
            class={styles.lines}
            style={{
              left: `${(-LINES_MARGIN * unit()).toFixed(1)}px`,
              width: `${(linesWidth() * unit()).toFixed(1)}px`,
              height: `${props.layout.height}px`,
            }}
            viewBox={`0 0 ${(linesWidth() * unit()).toFixed(1)} ${props.layout.height}`}
            aria-hidden="true"
          >
            <For each={archLines()}>
              {(d) => (
                <path
                  d={d}
                  fill="none"
                  stroke={TARGET_LINE.colour}
                  stroke-width={(TARGET_LINE.width * unit()).toFixed(2)}
                  stroke-linecap="round"
                  data-testid="ng-target"
                />
              )}
            </For>
            <Show when={names()}>
              {(n) => (
                <g
                  font-size={n().fontPx.toFixed(1)}
                  font-weight="600"
                  text-anchor="middle"
                  dominant-baseline="central"
                  class={styles.names}
                >
                  <text
                    x={n().root.x}
                    y={n().root.y}
                    fill={NOTE_NAMES.root.colour}
                    data-testid="ng-root-name"
                  >
                    {n().root.text}
                  </text>
                  <text
                    x={n().top.x}
                    y={n().top.y}
                    fill={NOTE_NAMES.top.colour}
                    data-testid="ng-top-name"
                  >
                    {n().top.text}
                  </text>
                </g>
              )}
            </Show>
          </svg>
        </div>
        <BridgeRibbon
          width={props.layout.width}
          height={props.layout.height}
          scale={ribbonScale()}
          onReady={(api) => {
            ribbon = api
            // The scene's first frame can come before the ribbon mounts.
            if (lastTrace !== null) {
              api.draw(
                strokesOf(lastTrace.trace, lastTrace.camera, props.layout),
                ribbonScale(),
              )
            }
          }}
        />
        <img
          class={styles.nearLeft}
          src={art().nearLeft}
          alt=""
          style={{
            width: `${(frame('near-left').width * unit()).toFixed(1)}px`,
            height: `${(frame('near-left').height * unit()).toFixed(1)}px`,
          }}
        />
        <img
          class={styles.nearRight}
          src={art().nearRight}
          alt=""
          style={{
            width: `${(frame('near-right').width * unit()).toFixed(1)}px`,
            height: `${(frame('near-right').height * unit()).toFixed(1)}px`,
          }}
        />
        <div class={styles.topLight} aria-hidden="true" />
      </div>
      <div
        ref={resultHolder}
        class={styles.result}
        style={resultBox()}
        data-testid="ng-result-view"
      >
        <canvas
          ref={resultLit}
          class={styles.resultLit}
          style={resultBand()}
          aria-hidden="true"
        />
      </div>
      <div
        ref={mercEl}
        class={styles.merc}
        style={{
          width: `${props.layout.mercSize.toFixed(1)}px`,
          height: `${props.layout.mercSize.toFixed(1)}px`,
        }}
      >
        {props.merc}
      </div>
    </div>
  )
}
