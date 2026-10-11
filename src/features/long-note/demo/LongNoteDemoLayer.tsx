// ============================================================
// LongNoteDemoLayer — the demo's tooltips, cards and progress, over the room
// ============================================================
//
// One layer over the whole room. It never takes a tap except on its cards:
// the room underneath goes on drawing the demo's takes (useLongNoteDemo.ts).
// Each tooltip is placed when it shows, from rects measured off the screen
// (tip-targets.ts, tip-place.ts), and a soft glow marks what it explains.
// A polite live region says every tooltip, take and card out loud.

import type { JSX } from 'solid-js'
import { createSignal, onCleanup, onMount, Show } from 'solid-js'
import { Play } from '@/components/icons'
import type { LongNoteController } from '../useLongNoteController'
import { DEMO_COPY } from './demo-cues'
import styles from './LongNoteDemo.module.css'
import type { TipPlace } from './tip-place'
import { placeTip } from './tip-place'
import type { DemoScene, TipTarget } from './tip-targets'
import { tipTarget } from './tip-targets'
import type { DemoTip, LongNoteDemo } from './useLongNoteDemo'

export interface LongNoteDemoLayerProps {
  demo: LongNoteDemo
  room: LongNoteController
}

/** A tooltip is never wider than this. */
const MAX_TIP_WIDTH = 240
/** A tooltip wraps to this many lines at most, wherever a place allows. */
const MAX_TIP_LINES = 3

/** The card's height at `MAX_TIP_LINES` lines, from its own style. */
function tallestTip(card: HTMLElement): number {
  const style = getComputedStyle(card)
  const px = (value: string): number => parseFloat(value) || 0
  const line = px(style.lineHeight)
  if (line === 0) return Infinity
  const frame =
    px(style.paddingTop) +
    px(style.paddingBottom) +
    px(style.borderTopWidth) +
    px(style.borderBottomWidth)
  // One px for the rounding of a fractional line height.
  return MAX_TIP_LINES * line + frame + 1
}

/** The room's parts, measured from the layer (which covers the room). */
function measureScene(layer: HTMLElement, level: number): DemoScene | null {
  const root = layer.parentElement
  if (root === null) return null
  const origin = layer.getBoundingClientRect()
  const rectOf = (selector: string): DemoScene['stage'] => {
    const el = root.querySelector(selector)
    if (el === null) return null
    const r = el.getBoundingClientRect()
    if (r.width === 0 && r.height === 0) return null
    return {
      x: r.left - origin.left,
      y: r.top - origin.top,
      w: r.width,
      h: r.height,
    }
  }
  const id = (testId: string): DemoScene['stage'] =>
    rectOf(`[data-testid="${testId}"]`)
  return {
    room: { x: 0, y: 0, w: origin.width, h: origin.height },
    stage: id('long-note-stage'),
    lantern: id('long-note-lantern'),
    note: id('long-note-note'),
    timer: id('long-note-timer'),
    chip: id('long-note-chip'),
    result: id('long-note-result'),
    score: id('long-note-steadiness'),
    mic: id('long-note-mic'),
    picker: id('long-note-picker'),
    merc: id('long-note-merc'),
    controls: [
      id('long-note-demo-skip'),
      id('long-note-ask'),
      id('long-note-demo-take'),
      id('long-note-demo-fast'),
    ].filter((rect) => rect !== null),
    level,
  }
}

interface Placed {
  place: TipPlace
  glow: TipTarget['glow']
}

function TipCard(props: {
  tip: DemoTip
  layer: () => HTMLDivElement | undefined
  level: () => number
}): JSX.Element {
  let measurer: HTMLDivElement | undefined
  const [placed, setPlaced] = createSignal<Placed | null>(null)

  const layout = (): void => {
    const layer = props.layer()
    if (layer === undefined || measurer === undefined) return
    const scene = measureScene(layer, props.level())
    const target = scene === null ? null : tipTarget(props.tip.target, scene)
    if (scene === null || target === null) return
    const box = measurer
    const place = placeTip({
      ...target,
      bounds: scene.room,
      maxWidth: MAX_TIP_WIDTH,
      maxHeight: tallestTip(box),
      size: (maxWidth) => {
        box.style.maxWidth = `${maxWidth}px`
        return { w: box.offsetWidth, h: box.offsetHeight }
      },
    })
    setPlaced(place === null ? null : { place, glow: target.glow })
  }

  onMount(() => {
    // After the room has drawn the moment this tooltip explains.
    const frame = requestAnimationFrame(layout)
    window.addEventListener('resize', layout)
    onCleanup(() => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', layout)
    })
  })

  return (
    <>
      <div
        ref={measurer}
        class={`${styles.tip} ${styles.measure}`}
        aria-hidden="true"
      >
        {props.tip.text}
      </div>
      <Show when={placed()?.glow}>
        {(glow) => (
          <div
            class={styles.glow}
            data-kind={glow().kind}
            data-testid="long-note-demo-glow"
            style={{
              left: `${glow().rect.x}px`,
              top: `${glow().rect.y}px`,
              width: `${glow().rect.w}px`,
              height: `${glow().rect.h}px`,
            }}
          />
        )}
      </Show>
      <div
        class={styles.tip}
        classList={{ [styles.tipWaiting]: placed() === null }}
        data-side={placed()?.place.side}
        data-tip={props.tip.id}
        data-testid="long-note-demo-tip"
        aria-hidden="true"
        style={(() => {
          const place = placed()?.place
          if (place === undefined) return {}
          return {
            left: `${place.box.x}px`,
            top: `${place.box.y}px`,
            width: `${place.box.w}px`,
            '--arrow': `${place.arrow}px`,
          }
        })()}
      >
        {props.tip.text}
      </div>
    </>
  )
}

/** Focus the card's main button when it appears: the room behind is inert. */
function focusOnMount(el: HTMLButtonElement): void {
  onMount(() => el.focus({ preventScroll: true }))
}

export function LongNoteDemoLayer(props: LongNoteDemoLayerProps): JSX.Element {
  let layer: HTMLDivElement | undefined
  const busy = (): boolean => props.demo.mode() !== 'idle'

  return (
    <div
      ref={layer}
      class={styles.layer}
      data-mode={props.demo.mode()}
      data-testid="long-note-demo"
    >
      <div class={styles.vignette} classList={{ [styles.on]: busy() }} />
      <Show when={busy() ? props.demo.run() : null} keyed>
        {(run) => (
          <div class={styles.progress} aria-hidden="true">
            <div
              class={styles.progressFill}
              classList={{ [styles.progressDone]: props.demo.mode() === 'end' }}
              style={{ 'animation-duration': `${run.seconds}s` }}
              data-testid="long-note-demo-progress"
            />
          </div>
        )}
      </Show>
      <Show when={props.demo.tip()} keyed>
        {(tip) => (
          <TipCard
            tip={tip}
            layer={() => layer}
            level={() => props.room.lanternLevel()}
          />
        )}
      </Show>
      <Show when={props.demo.mode() === 'card'}>
        <section
          class={styles.card}
          aria-labelledby="long-note-demo-card-title"
          data-testid="long-note-demo-card"
        >
          <h2 id="long-note-demo-card-title" class={styles.cardTitle}>
            {DEMO_COPY.cardTitle}
          </h2>
          <p class={styles.cardLine}>{DEMO_COPY.cardLine}</p>
          <div class={styles.cardActions}>
            <button
              type="button"
              class={styles.secondary}
              onClick={() => props.demo.dismiss()}
              data-testid="long-note-demo-not-now"
            >
              {DEMO_COPY.notNow}
            </button>
            <button
              type="button"
              ref={focusOnMount}
              class={styles.primary}
              onClick={() => props.demo.ask()}
              data-testid="long-note-demo-watch"
            >
              <Play />
              {DEMO_COPY.watchButton}
            </button>
          </div>
        </section>
      </Show>
      <Show when={props.demo.mode() === 'end'}>
        <section
          class={styles.card}
          aria-labelledby="long-note-demo-end-title"
          data-testid="long-note-demo-end"
        >
          <h2 id="long-note-demo-end-title" class={styles.cardTitle}>
            {DEMO_COPY.endTitle}
          </h2>
          <div class={styles.cardActions}>
            <button
              type="button"
              class={styles.secondary}
              onClick={() => props.demo.ask()}
              data-testid="long-note-demo-again"
            >
              {DEMO_COPY.again}
            </button>
            <button
              type="button"
              ref={focusOnMount}
              class={styles.primary}
              onClick={() => props.demo.tryIt()}
              data-testid="long-note-demo-try"
            >
              {DEMO_COPY.tryIt}
            </button>
          </div>
        </section>
      </Show>
      <p
        class={styles.said}
        aria-live="polite"
        data-testid="long-note-demo-said"
      >
        {props.demo.said()}
      </p>
    </div>
  )
}
