// ============================================================
// BayScene: the night bay, its three waves, the voice and Merc
// ============================================================
//
// L0 5.4's layers, back to front:
//
//   bay-back     sky, moon, cliffs, the far sea: one plate, scrolled at a
//                quarter of the waves' speed (BAY.parallax), its horizon
//                moved from screen 1's to screens 2 and 3's with the zoom
//   waves        each wave's unlit water, and a canvas for each wave
//                lighting (bay-waves.ts); drawn normally, opaque water
//   dots         the target: pale dots along each crest (an SVG path per
//                wave from the glide path's own targetAt, dashed to dots),
//                and the foam's sparkles on a crest once its top is lit
//   ribbon       the voice (GlideRibbon), fixed to the screen
//   bubbles      what the voice sheds while it sounds (bay-bubbles.ts)
//   Merc         his canvas, moved by transform, with the buzz beside his
//                mouth (BuzzMarks.tsx)
//   sea-front    the near sea and its foam, over Merc
//   result       the pulled-back bay, lit once from the take
//
// The waves and the sea-front share one transform a frame: the camera,
// and the zoom from the intro's wave A to the run's wave B (a scale
// across and a scale up and down, bay-layout.ts). The dots are not
// scaled, so they stay round: their path is rebuilt when the zoom moves
// (the count-in only) and translated otherwise. Nothing here is a signal
// per frame; the run drives it through the BayView it is handed
// (`onReady`). Every picture here is a stand-in until the paintings
// arrive (STAND-INS.md).

import type { JSX } from 'solid-js'
import { createEffect, createMemo, createSignal, For, on, onCleanup, onMount, } from 'solid-js'
import { createPictureSet } from '@/components/room-kit/canvas-picture'
import type { LitStrip } from '@/components/room-kit/glide-reveal'
import type { GlideRibbonApi, StrokePoint, } from '@/components/room-kit/GlideRibbon'
import { GlideRibbon } from '@/components/room-kit/GlideRibbon'
import type { Plate } from '@/components/room-kit/plate-loader'
import { claimPlate, releasePlate } from '@/components/room-kit/plate-loader'
import { createResultBand } from '@/components/room-kit/result-band'
import type { GlidePath } from '@/lib/glide/glide-path'
import { targetAt } from '@/lib/glide/glide-path'
import { BAY_PLATE, bayArt, bayImage, BUBBLE_URL, RESULT_PLATE, } from './bay-art'
import { createBubbleStream } from './bay-bubbles'
import { BAY, DOTS, PLATES, PLAYHEAD_X, RESULT_ASPECT, RESULT_VIEW, WAVE, } from './bay-geometry'
import type { BayLayout, MercBox, Zoom } from './bay-layout'
import { frameY, horizonAt, MERC_INTRO_X, mercBoxAt, mercResultBox, pitchY, waveG, worldXOf, yOf, zoomAt, } from './bay-layout'
import { crestX, INTRO_CAMERA } from './bay-scroll'
import type { BayView, TraceSample } from './bay-view'
import type { WaveImages } from './bay-waves'
import { createBayWaves } from './bay-waves'
import { BuzzMarks } from './BuzzMarks'
import styles from './LipRollRoom.module.css'

/** The ribbon: the shared look, a little wider, as on the bridge. */
const RIBBON_REFERENCE_W = 390
const RIBBON_WIDEN = 1.15
/** The dots' SVG runs this far past the first and last waves, W. */
const DOTS_MARGIN = 1.6
const WAVES = 3
/** The sea-front's tiles, by world X (one W wide each). */
const FRONT_TILES = [-2, -1, 0, 1, 2, 3, 4]
/** A crest's top is lit once a strip reaches this near its middle (u). */
const TOP_U = 0.12
/** The foam's sparkles along a lit crest: their u, and how far over the line, W. */
const SPARKLES_U = [-0.3, -0.17, -0.05, 0.08, 0.2, 0.32]
const SPARKLE_OVER_W = 0.008
/** Bubbles' canvas resolution, at most. */
const BUBBLE_DPR = 2

export interface BaySceneProps {
  layout: BayLayout
  /** The glide path whose targets the dots follow. */
  path: GlidePath
  /** Reduced motion: the bay's parallax stops, no bubbles, the buzz holds still. */
  reduced: boolean
  /** The pulled-back result is showing. */
  showResult: boolean
  /** No animation at all: the fixtures' pinned frames. */
  still?: boolean
  /** Merc's view, placed by the scene. */
  merc: JSX.Element
  onReady: (view: BayView) => void
  /** Every picture shown has decoded (the fixtures wait for it). */
  onSettled?: () => void
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

/** Wave k's crest line as the path draws it, in world X and world y. */
function crestLine(path: GlidePath, k: number): [number, number][] {
  const wave = path.arches[k] as (typeof path.arches)[number] | undefined
  if (wave === undefined) return []
  const steps = 96
  const semitones = wave.topMidi - wave.rootMidi
  const out: [number, number][] = []
  for (let i = 0; i <= steps; i++) {
    const t = wave.start + ((wave.end - wave.start) * i) / steps
    const midi = targetAt(path, t) ?? wave.rootMidi
    out.push([
      crestX(k) - WAVE.a + (2 * WAVE.a * i) / steps,
      pitchY(midi, wave.rootMidi, semitones),
    ])
  }
  return out
}

/** Where the dots' layer puts world X under a zoom, before its translate. */
const localX = (layout: BayLayout, zoom: Zoom, x: number): number =>
  (zoom.sx * x + DOTS_MARGIN) * layout.unit

/** The voice's samples on screen, as strokes in px, broken at its gaps. */
function strokesOf(
  trace: readonly TraceSample[],
  camera: number,
  zoom: Zoom,
  layout: BayLayout,
): StrokePoint[][] {
  const strokes: StrokePoint[][] = []
  let current: StrokePoint[] = []
  const left = camera - PLAYHEAD_X / zoom.sx - 0.05
  for (const sample of trace) {
    if (sample.x < left) continue
    if (sample.gap && current.length > 0) {
      strokes.push(current)
      current = []
    }
    current.push({
      x: worldXOf(layout, zoom, camera, sample.x),
      y: yOf(layout, frameY(zoom, sample.y)),
      filling: sample.filling,
    })
  }
  if (current.length > 0) strokes.push(current)
  return strokes
}

export function BayScene(props: BaySceneProps): JSX.Element {
  let rootEl: HTMLDivElement | undefined
  let bay: HTMLDivElement | undefined
  let waveLayer: HTMLDivElement | undefined
  let frontLayer: HTMLDivElement | undefined
  let dotsLayer: HTMLDivElement | undefined
  let mercEl: HTMLDivElement | undefined
  let buzz: SVGSVGElement | undefined
  let bubbleCanvas: HTMLCanvasElement | undefined
  let resultLit: HTMLCanvasElement | undefined
  let resultHolder: HTMLDivElement | undefined
  let ribbon: GlideRibbonApi | null = null
  let bayPlate: Plate | null = null
  let resultPlate: Plate | null = null
  let bubbleImage: HTMLImageElement | null = null
  const waveHolders: HTMLDivElement[] = []
  const dotPaths: SVGPathElement[] = []
  const sparkleGroups: SVGGElement[] = []
  const [resultReady, setResultReady] = createSignal(false)

  const dpr = (): number => window.devicePixelRatio || 1
  const art = createMemo(() => bayArt(dpr()))
  const unit = (): number => props.layout.unit
  const bubbles = createBubbleStream()

  // The waves' two pictures, decoded off the main thread once a visit and
  // released when the room goes (room-kit/canvas-picture.ts).
  const wavePictures = createPictureSet(
    () => [art().waveUnlit, art().waveLit],
    bayImage,
  )
  const waveImages = async (): Promise<WaveImages> => {
    const [unlit, lit] = await wavePictures.get()
    if (unlit === undefined || lit === undefined) {
      throw new Error('bay art: the waves')
    }
    return { unlit, lit }
  }

  const waves = createBayWaves({
    holder: (k) => (waveHolders[k] as HTMLDivElement | undefined) ?? null,
    images: waveImages,
  })

  // ── The dots: rebuilt when the zoom moves, translated otherwise ──
  let dotsZoom = Number.NaN
  const placeDots = (zoom: Zoom): void => {
    const key = Math.round(zoom.sx * 1e5)
    if (key === dotsZoom) return
    dotsZoom = key
    const layout = props.layout
    for (let k = 0; k < WAVES; k++) {
      const points = crestLine(props.path, k)
      const d = points
        .map(
          ([x, y], i) =>
            `${i === 0 ? 'M' : 'L'}${localX(layout, zoom, x).toFixed(1)} ${yOf(layout, frameY(zoom, y)).toFixed(1)}`,
        )
        .join('')
      dotPaths[k]?.setAttribute('d', d)
      const group = sparkleGroups[k] as SVGGElement | undefined
      if (group === undefined) continue
      SPARKLES_U.forEach((u, i) => {
        const x = crestX(k) + u * WAVE.a
        const y =
          WAVE.rootY - WAVE.h * waveG(u, WAVE.f) - SPARKLE_OVER_W / zoom.sy
        const star = group.children[i] as SVGElement | undefined
        star?.setAttribute(
          'transform',
          `translate(${localX(layout, zoom, x).toFixed(1)} ${yOf(layout, frameY(zoom, y)).toFixed(1)})`,
        )
      })
    }
  }
  const litTops = new Set<number>()
  const lightTops = (strips: readonly LitStrip[]): void => {
    for (const strip of strips) {
      if (litTops.has(strip.arch)) continue
      if (strip.from <= TOP_U && strip.to >= -TOP_U) {
        litTops.add(strip.arch)
        sparkleGroups[strip.arch]?.setAttribute('data-lit', 'true')
      }
    }
  }
  const clearTops = (): void => {
    litTops.clear()
    for (const group of sparkleGroups) group.setAttribute('data-lit', 'false')
  }

  // ── The camera ─────────────────────────────────────────────
  let camera = INTRO_CAMERA
  let zoomNow = zoomAt(0)
  let zoomK = 0
  const moveTo = (next: number, z: number): void => {
    camera = next
    zoomK = z
    const zoom = zoomAt(z)
    zoomNow = zoom
    const layout = props.layout
    const u = unit()
    const tx = PLAYHEAD_X * layout.width - zoom.sx * camera * u
    const ty =
      (zoom.crestY - layout.top) * u - zoom.sy * (WAVE.crestY - layout.top) * u
    const world = `matrix(${zoom.sx.toFixed(5)},0,0,${zoom.sy.toFixed(5)},${tx.toFixed(2)},${ty.toFixed(2)})`
    if (waveLayer !== undefined) waveLayer.style.transform = world
    if (frontLayer !== undefined) frontLayer.style.transform = world
    placeDots(zoom)
    if (dotsLayer !== undefined) {
      const dx =
        PLAYHEAD_X * layout.width - (zoom.sx * camera + DOTS_MARGIN) * u
      dotsLayer.style.transform = `translate3d(${dx.toFixed(2)}px,0,0)`
    }
    if (bay !== undefined) {
      const back = PLATES.back.frame
      const travel = props.reduced ? 0 : (camera - INTRO_CAMERA) * BAY.parallax
      const bx = back.left * layout.width - travel * u
      const by =
        yOf(layout, horizonAt(z)) - (BAY.horizon - back.top) * layout.width
      bay.style.transform = `translate3d(${bx.toFixed(2)}px,${by.toFixed(2)}px,0)`
    }
  }

  /** His canvas keeps one size (a resize reallocates its GL buffers): scaled. */
  const placeMerc = (box: MercBox): void => {
    if (mercEl === undefined) return
    const k = box.size / props.layout.mercSize
    mercEl.style.transform = `translate3d(${box.left.toFixed(1)}px,${box.top.toFixed(1)}px,0) scale(${k.toFixed(3)})`
  }
  const setBuzz = (on: boolean): void => {
    if (buzz !== undefined && buzz.dataset.on !== String(on)) {
      buzz.dataset.on = String(on)
    }
  }

  const ribbonScale = (): number => (unit() / RIBBON_REFERENCE_W) * RIBBON_WIDEN

  // ── Bubbles ────────────────────────────────────────────────
  let bubblesDrawn = false
  const drawBubbles = (
    head: TraceSample | null,
    zoom: Zoom,
    cam: number,
  ): void => {
    const canvas = bubbleCanvas
    if (canvas === undefined || props.reduced) return
    bubbles.step(performance.now() / 1000, head)
    const live = bubbles.live()
    if (live.length === 0 && !bubblesDrawn) return
    const ctx = canvas.getContext('2d')
    if (ctx === null) return
    const layout = props.layout
    const res = Math.min(BUBBLE_DPR, dpr())
    const w = Math.round(layout.width * res)
    const h = Math.round(layout.height * res)
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w
      canvas.height = h
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    bubblesDrawn = live.length > 0
    if (bubbleImage === null) return
    ctx.setTransform(res, 0, 0, res, 0, 0)
    for (const b of live) {
      const size = b.size * layout.unit
      const x = worldXOf(layout, zoom, cam, b.x)
      const y = yOf(layout, frameY(zoom, b.y))
      ctx.globalAlpha = b.alpha
      ctx.drawImage(bubbleImage, x - size / 2, y - size / 2, size, size)
    }
    ctx.globalAlpha = 1
  }
  const clearBubbles = (): void => {
    bubbles.clear()
    bubblesDrawn = false
    const ctx = bubbleCanvas?.getContext('2d')
    if (ctx !== null && ctx !== undefined && bubbleCanvas !== undefined) {
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, bubbleCanvas.width, bubbleCanvas.height)
    }
  }

  // ── The result ─────────────────────────────────────────────
  // The lit band's picture, decoded off the main thread as the last wave
  // begins (room-kit/result-band.ts), so the result's frame only copies.
  const litBand = createResultBand(
    () => resultLit,
    () => art().resultLit,
    bayImage,
  )
  /** The result's lit band: the take's ranges, at screen 4's waves. */
  const paintResult = (
    lit: readonly (readonly (readonly [number, number])[])[],
  ): Promise<void> =>
    litBand.paint((width) =>
      lit.flatMap((ranges, k) => {
        const wave = RESULT_VIEW.waves[k] as
          | (typeof RESULT_VIEW.waves)[number]
          | undefined
        if (wave === undefined) return []
        return ranges.map(
          ([from, to]) =>
            [
              Math.max(0, Math.floor((wave.x + from * wave.a) * width)),
              Math.min(width, Math.ceil((wave.x + to * wave.a) * width)),
            ] as const,
        )
      }),
    )

  /** The last frame, for a ribbon that mounts after it. */
  let lastTrace: readonly TraceSample[] | null = null

  const view: BayView = {
    frame: (f) => {
      moveTo(f.camera, f.zoom)
      waves.paint(f.strips)
      lightTops(f.strips)
      lastTrace = f.trace
      ribbon?.draw(
        strokesOf(f.trace, f.camera, zoomNow, props.layout),
        ribbonScale(),
      )
      const head = f.voiced ? (f.trace.at(-1) ?? null) : null
      drawBubbles(head, zoomNow, f.camera)
      placeMerc(mercBoxAt(props.layout, zoomNow, f.merc.x, f.merc.feetY))
      setBuzz(f.voiced)
    },
    reset: (at) => {
      waves.reset()
      clearTops()
      clearBubbles()
      lastTrace = null
      ribbon?.draw([], ribbonScale())
      moveTo(at, 0)
      placeMerc(mercBoxAt(props.layout, zoomNow, MERC_INTRO_X, WAVE.rootY))
      setBuzz(true)
      setResultReady(false)
    },
    prepareResult: () => litBand.prepare(),
    result: (lit) => {
      if (resultHolder !== undefined && resultPlate === null) {
        resultPlate = claimPlate(RESULT_PLATE)
        resultPlate.img.alt = ''
        resultHolder.prepend(resultPlate.picture)
      }
      setBuzz(false)
      clearBubbles()
      void paintResult(lit).finally(() => {
        setResultReady(true)
        // A frame later, so his float to screen 4's place is a transition.
        requestAnimationFrame(() => placeMerc(mercResultBox(props.layout)))
      })
    },
  }

  onMount(() => {
    if (bay !== undefined) {
      bayPlate = claimPlate(BAY_PLATE)
      bayPlate.img.alt = ''
      bay.appendChild(bayPlate.picture)
    }
    if (BUBBLE_URL !== '') {
      void bayImage(BUBBLE_URL).then(
        (img) => (bubbleImage = img),
        () => undefined,
      )
    }
    moveTo(camera, zoomK)
    placeMerc(mercBoxAt(props.layout, zoomNow, MERC_INTRO_X, WAVE.rootY))
    setBuzz(true)
    props.onReady(view)
    if (props.onSettled !== undefined && rootEl !== undefined) {
      const done = props.onSettled
      // The waves' canvases paint once their pictures decode: after this.
      void Promise.all([
        imagesDecoded(rootEl),
        waveImages().catch(() => undefined),
      ]).then(done)
    }
  })

  onCleanup(() => {
    waves.dispose()
    wavePictures.release()
    litBand.release()
    bubbles.clear()
    if (bayPlate !== null) releasePlate(bayPlate)
    if (resultPlate !== null) releasePlate(resultPlate)
    bayPlate = null
    resultPlate = null
  })

  // ── Places, px ─────────────────────────────────────────────
  /** A box in the waves' layer: world X and world y (the run's frame). */
  const worldBox = (
    left: number,
    top: number,
    width: number,
    height: number,
  ): JSX.CSSProperties => ({
    left: `${(left * unit()).toFixed(1)}px`,
    top: `${((top - props.layout.top) * unit()).toFixed(1)}px`,
    width: `${(width * unit()).toFixed(1)}px`,
    height: `${(height * unit()).toFixed(1)}px`,
  })
  const waveFrame = PLATES['wave-unlit'].frame
  const front = PLATES['sea-front'].frame
  const back = PLATES.back.frame
  const waveBox = (k: number) =>
    worldBox(
      crestX(k) + waveFrame.left,
      WAVE.crestY + waveFrame.top,
      waveFrame.width,
      waveFrame.height,
    )
  const wavesList = Array.from({ length: WAVES }, (_, k) => k)
  const dotsWidth = (): number =>
    (crestX(WAVES - 1) + WAVE.a + 2 * DOTS_MARGIN) * unit()
  const dotPx = (): number => DOTS.diameter * unit()
  const spacingPx = (): number => DOTS.spacing * unit()

  // The dots are rebuilt whenever the layout or the path changes.
  createEffect(
    on(
      () => [props.layout, props.path],
      () => {
        dotsZoom = Number.NaN
        placeDots(zoomNow)
      },
    ),
  )

  /** The result's dotted crests, in screen 4's frame. */
  const resultDots = createMemo(() =>
    RESULT_VIEW.waves.map((w) => {
      const parts: string[] = []
      const steps = 64
      for (let i = 0; i <= steps; i++) {
        const u = -1 + (2 * i) / steps
        const x = (w.x + u * w.a) * props.layout.width
        const y = w.crestY + w.h * (1 - waveG(u, w.f))
        parts.push(
          `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${(y * props.layout.width).toFixed(1)}`,
        )
      }
      return parts.join('')
    }),
  )

  const resultBox = (): JSX.CSSProperties => ({
    top: `${(-props.layout.resultTop * props.layout.width).toFixed(1)}px`,
    height: `${(RESULT_ASPECT * props.layout.width).toFixed(1)}px`,
  })
  const resultBand = (): JSX.CSSProperties => {
    const f = PLATES['result-lit'].frame
    return {
      top: `${(f.top * props.layout.width).toFixed(1)}px`,
      height: `${(f.height * props.layout.width).toFixed(1)}px`,
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
      data-testid="lip-scene"
    >
      <div class={styles.take} data-testid="lip-take">
        <div
          ref={bay}
          class={styles.bay}
          style={{
            width: `${(back.width * props.layout.width).toFixed(1)}px`,
            height: `${(back.height * props.layout.width).toFixed(1)}px`,
          }}
          data-testid="lip-bay"
        />
        <div ref={waveLayer} class={styles.world} data-testid="lip-waves">
          <For each={wavesList}>
            {(k) => (
              <div
                ref={(el) => (waveHolders[k] = el)}
                class={styles.sprite}
                style={waveBox(k)}
                data-wave={k}
              >
                <img class={styles.fill} src={art().waveUnlit} alt="" />
              </div>
            )}
          </For>
        </div>
        <div ref={dotsLayer} class={styles.world} data-testid="lip-dots">
          <svg
            class={styles.dots}
            style={{
              width: `${dotsWidth().toFixed(1)}px`,
              height: `${props.layout.height}px`,
            }}
            viewBox={`0 0 ${dotsWidth().toFixed(1)} ${props.layout.height}`}
            aria-hidden="true"
          >
            <For each={wavesList}>
              {(k) => (
                <>
                  <path
                    ref={(el) => (dotPaths[k] = el)}
                    fill="none"
                    stroke={DOTS.colour}
                    stroke-width={dotPx().toFixed(2)}
                    stroke-linecap="round"
                    stroke-dasharray={`0 ${spacingPx().toFixed(2)}`}
                    data-testid="lip-target"
                  />
                  <g
                    ref={(el) => (sparkleGroups[k] = el)}
                    class={styles.sparkles}
                    data-lit="false"
                    data-testid="lip-sparkles"
                  >
                    <For each={SPARKLES_U}>
                      {(_, i) => (
                        <path
                          class={styles.sparkle}
                          style={{ 'animation-delay': `${i() * 0.23}s` }}
                          d={`M0 ${(-dotPx() * 0.9).toFixed(2)}L${(dotPx() * 0.22).toFixed(2)} 0L0 ${(dotPx() * 0.9).toFixed(2)}L${(-dotPx() * 0.22).toFixed(2)} 0Z M${(-dotPx() * 0.9).toFixed(2)} 0L0 ${(dotPx() * 0.22).toFixed(2)}L${(dotPx() * 0.9).toFixed(2)} 0L0 ${(-dotPx() * 0.22).toFixed(2)}Z`}
                        />
                      )}
                    </For>
                  </g>
                </>
              )}
            </For>
          </svg>
        </div>
        <GlideRibbon
          width={props.layout.width}
          height={props.layout.height}
          scale={ribbonScale()}
          class={styles.ribbon}
          testId="lip-ribbon"
          glowTestId="lip-ribbon-glow"
          onReady={(api) => {
            ribbon = api
            // The scene's first frame can come before the ribbon mounts.
            if (lastTrace !== null) {
              api.draw(
                strokesOf(lastTrace, camera, zoomNow, props.layout),
                ribbonScale(),
              )
            }
          }}
        />
        <canvas
          ref={bubbleCanvas}
          class={styles.ribbon}
          style={{
            width: `${props.layout.width}px`,
            height: `${props.layout.height}px`,
          }}
          aria-hidden="true"
          data-testid="lip-bubbles"
        />
      </div>
      <div
        ref={resultHolder}
        class={styles.result}
        style={resultBox()}
        data-testid="lip-result-view"
      >
        <canvas
          ref={resultLit}
          class={styles.resultLit}
          style={resultBand()}
          aria-hidden="true"
        />
        <svg
          class={styles.resultDots}
          viewBox={`0 0 ${props.layout.width} ${(RESULT_ASPECT * props.layout.width).toFixed(1)}`}
          aria-hidden="true"
        >
          <For each={resultDots()}>
            {(d) => (
              <path
                d={d}
                fill="none"
                stroke={DOTS.colour}
                stroke-width={(DOTS.diameter * props.layout.width).toFixed(2)}
                stroke-linecap="round"
                stroke-dasharray={`0 ${(DOTS.spacing * props.layout.width * 0.6).toFixed(2)}`}
              />
            )}
          </For>
        </svg>
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
        <BuzzMarks ref={(el) => (buzz = el)} />
      </div>
      <div class={styles.takeFront}>
        <div ref={frontLayer} class={styles.world} data-testid="lip-front">
          <For each={FRONT_TILES}>
            {(j) => (
              <img
                class={styles.sprite}
                src={art().seaFront}
                alt=""
                style={worldBox(j, front.top, 1.002, front.height)}
              />
            )}
          </For>
        </div>
      </div>
    </div>
  )
}
