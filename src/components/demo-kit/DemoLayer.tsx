// ============================================================
// DemoLayer — a demo's tooltips, cards and progress, over its room
// ============================================================
//
// One layer over the whole room. It never takes a tap except on its cards:
// the room underneath goes on drawing the demo's takes (useExerciseDemo.ts).
// Each tooltip is placed when it shows, from rects measured off the screen
// (the room's `aim`, tip-place.ts), and a soft glow marks what it explains.
// The play card offers the demo when a first visit has no sound yet; the
// end card hands the room over ("Your turn", Watch again, Try it). A polite
// live region says every tooltip, take and card out loud.
//
// Every part's test id starts with the layer's own (`testId`), so a room's
// tests and markers keep its own names.

import type { JSX } from 'solid-js'
import { createSignal, onCleanup, onMount, Show } from 'solid-js'
import { Play } from '@/components/icons'
import styles from './DemoLayer.module.css'
import type { TipPlace } from './tip-place'
import { placeTip } from './tip-place'
import type { TipAim, TipTarget } from './tip-target'
import type { DemoTip, ExerciseDemo } from './useExerciseDemo'

/** The cards' words. */
export interface DemoLayerCopy {
  readonly cardTitle: string
  readonly cardLine: string
  readonly notNow: string
  readonly watchButton: string
  readonly endTitle: string
  readonly again: string
  readonly tryIt: string
}

export interface DemoLayerProps<C extends string, T extends string> {
  demo: ExerciseDemo<C, T>
  /**
   * Where a tooltip points and the room it stays inside, measured from the
   * layer as the room is drawn now; null leaves it unplaced.
   */
  aim: (tip: DemoTip<C, T>, layer: HTMLElement) => TipAim | null
  copy: DemoLayerCopy
  testId: string
}

/** A tooltip is never wider than this. */
const MAX_TIP_WIDTH = 240
/** A tooltip wraps to this many lines at most, wherever a place allows. */
const MAX_TIP_LINES = 3

/** The card's height at `MAX_TIP_LINES` lines, from its own style. */
function tallestTip(card: HTMLElement): number {
  const style = window.getComputedStyle(card)
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

interface Placed {
  place: TipPlace
  glow: TipTarget['glow']
}

function TipCard<C extends string, T extends string>(props: {
  tip: DemoTip<C, T>
  layer: () => HTMLDivElement | undefined
  aim: DemoLayerProps<C, T>['aim']
  testId: string
}): JSX.Element {
  let measurer: HTMLDivElement | undefined
  const [placed, setPlaced] = createSignal<Placed | null>(null)

  const layout = (): void => {
    const layer = props.layer()
    if (layer === undefined || measurer === undefined) return
    const aim = props.aim(props.tip, layer)
    if (aim === null) return
    const box = measurer
    const place = placeTip({
      ...aim.target,
      bounds: aim.bounds,
      maxWidth: MAX_TIP_WIDTH,
      maxHeight: tallestTip(box),
      size: (maxWidth) => {
        box.style.maxWidth = `${maxWidth}px`
        return { w: box.offsetWidth, h: box.offsetHeight }
      },
    })
    setPlaced(place === null ? null : { place, glow: aim.target.glow })
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
            data-testid={`${props.testId}-glow`}
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
        data-testid={`${props.testId}-tip`}
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

export function DemoLayer<C extends string, T extends string>(
  props: DemoLayerProps<C, T>,
): JSX.Element {
  let layer: HTMLDivElement | undefined
  const busy = (): boolean => props.demo.mode() !== 'idle'
  const id = (part: string): string => `${props.testId}-${part}`

  return (
    <div
      ref={layer}
      class={styles.layer}
      data-mode={props.demo.mode()}
      data-testid={props.testId}
    >
      <div class={styles.vignette} classList={{ [styles.on]: busy() }} />
      <Show when={busy() ? props.demo.run() : null} keyed>
        {(run) => (
          <div class={styles.progress} aria-hidden="true">
            <div
              class={styles.progressFill}
              classList={{ [styles.progressDone]: props.demo.mode() === 'end' }}
              style={{ 'animation-duration': `${run.seconds}s` }}
              data-testid={id('progress')}
            />
          </div>
        )}
      </Show>
      <Show when={props.demo.tip()} keyed>
        {(tip) => (
          <TipCard
            tip={tip}
            layer={() => layer}
            aim={props.aim}
            testId={props.testId}
          />
        )}
      </Show>
      <Show when={props.demo.mode() === 'card'}>
        <section
          class={styles.card}
          aria-labelledby={id('card-title')}
          data-testid={id('card')}
        >
          <h2 id={id('card-title')} class={styles.cardTitle}>
            {props.copy.cardTitle}
          </h2>
          <p class={styles.cardLine}>{props.copy.cardLine}</p>
          <div class={styles.cardActions}>
            <button
              type="button"
              class={styles.secondary}
              onClick={() => props.demo.dismiss()}
              data-testid={id('not-now')}
            >
              {props.copy.notNow}
            </button>
            <button
              type="button"
              ref={focusOnMount}
              class={styles.primary}
              onClick={() => props.demo.ask()}
              data-testid={id('watch')}
            >
              <Play />
              {props.copy.watchButton}
            </button>
          </div>
        </section>
      </Show>
      <Show when={props.demo.mode() === 'end'}>
        <section
          class={styles.card}
          aria-labelledby={id('end-title')}
          data-testid={id('end')}
        >
          <h2 id={id('end-title')} class={styles.cardTitle}>
            {props.copy.endTitle}
          </h2>
          <div class={styles.cardActions}>
            <button
              type="button"
              class={styles.secondary}
              onClick={() => props.demo.ask()}
              data-testid={id('again')}
            >
              {props.copy.again}
            </button>
            <button
              type="button"
              ref={focusOnMount}
              class={styles.primary}
              onClick={() => props.demo.tryIt()}
              data-testid={id('try')}
            >
              {props.copy.tryIt}
            </button>
          </div>
        </section>
      </Show>
      <p class={styles.said} aria-live="polite" data-testid={id('said')}>
        {props.demo.said()}
      </p>
    </div>
  )
}
