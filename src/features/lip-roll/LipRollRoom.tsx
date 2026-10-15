// ============================================================
// LipRollRoom: buzz your lips over three waves, and the bay lights
// ============================================================
//
// The premium Lip roll (design: DESIGN-lip-roll.md, storyboard
// 03-lip-roll; L0: lip-l0/L0-REPORT.md). One room over a night bay:
//
//   intro     the first wave unlit, its dotted crest, Merc at its foot
//             buzzing, his line, the mic
//   settle    no root yet: the singer sings an easy note first
//   run       the count-in (the first root's tone, the bay rolling in
//             while the camera zooms from screen 1's wave to the run's),
//             then three waves: the bay scrolls under the playhead, the
//             voice's ribbon follows the dots and sheds bubbles, and each
//             wave lights wherever the voice followed it. "Wave 2 of 3" in
//             the chip; Merc rides the voice; he speaks only in the breaths
//   result    the view pulls back to the whole bay, its three waves lit
//             as the take lit them: the share lit, a chip for the breaks
//             (and the jumps, and the tops at Pro), the best, Again and
//             Done
//
// Drawn full-bleed (the shell's premium-rooms.ts, D1). The chip's and the
// controls' heights are CSS custom properties (LipRollRoom.module.css),
// read here once a resize, so the bay keeps Merc clear of both
// (bay-layout.ts). Merc's sound rings are off for the whole room: the
// buzz beside his mouth is the bay's own mark (BuzzMarks.tsx).
//
// The chip, the bubble, the result card, the mic, the result's buttons and
// the level control are the room kit's; this room brings its world
// (BayScene.tsx), its words and its test ids.
//
// "How it works" (demo/) plays over the same room: Merc buzzes one wave
// the way not to and one the way to, through the room's own engine, with
// the demo kit's layer, cards and take pill over it. A first visit opens
// on it; the "?" plays it again from the intro or a result.

import type { JSX } from 'solid-js'
import { createEffect, createMemo, createSignal, For, Match, on, onCleanup, onMount, Show, Switch, } from 'solid-js'
import { DemoLayer } from '@/components/demo-kit/DemoLayer'
import { DemoTakePill } from '@/components/demo-kit/DemoTakePill'
import type { Rect } from '@/components/demo-kit/tip-place'
import { createFocusHandoff } from '@/components/room-kit/focus-handoff'
import { MercView } from '@/components/room-kit/MercView'
import type { MicState } from '@/components/room-kit/mic-state'
import { micLabel as labelFor } from '@/components/room-kit/mic-state'
import { prefersReducedMotion } from '@/components/room-kit/reduced-motion'
import { RoomAsk, RoomBarEnd } from '@/components/room-kit/RoomBar'
import { MicBlocked, MicButton, ResultActions, } from '@/components/room-kit/RoomControls'
import { ResultCard, RoomBubble, RoomChip, } from '@/components/room-kit/RoomHeader'
import { WAVE } from './bay-geometry'
import type { BayLayout } from './bay-layout'
import { layoutBay, MERC_INTRO_X, mercBoxAt, zoomAt } from './bay-layout'
import { BayScene } from './BayScene'
import { DEMO_COPY } from './demo/demo-cues'
import { aimLipTip } from './demo/tip-targets'
import type { LipDemo } from './demo/useLipDemo'
import { useLipDemo } from './demo/useLipDemo'
import { lipMicState } from './lip-machine'
import type { LipSummary } from './lip-run'
import { bestText, resultChips } from './lip-run'
import { LipLevel } from './LipLevel'
import styles from './LipRollRoom.module.css'
import type { LipController } from './useLipController'
import { useLipController } from './useLipController'

export interface LipRollRoomProps {
  /** Leave the room (Done). */
  onDone: () => void
  /**
   * The run, when it is not the room's own: the dev fixtures' pinned
   * frames (fixture/LipFixture.tsx). Read once. A room on another's run
   * has no demo.
   */
  controller?: LipController
  /** No animation at all (the fixtures). */
  still?: boolean
  /** Every picture the scene shows has decoded (the fixtures wait for it). */
  onSettled?: () => void
}

/**
 * Merc's bubble sits this far down his canvas: just over his head (the
 * top of his head is about 0.2 down it).
 */
const BUBBLE_OVER_MERC = 0.17
/** At the result the bubble sits this far over the controls, px. */
const RESULT_BUBBLE_GAP = 12
/**
 * How far ahead a tooltip keeps clear of Merc, s: the longest a tooltip
 * stays up inside a take (demo-cues.ts), while he rides on under it.
 */
const TIP_LANE_SECONDS = 3.2

interface RoomBox {
  readonly width: number
  readonly height: number
  readonly chipBottom: number
  readonly controlsTop: number
  readonly controlsClear: number
}

const cssPx = (style: CSSStyleDeclaration, name: string): number => {
  const value = Number.parseFloat(style.getPropertyValue(name))
  return Number.isFinite(value) ? value : 0
}

/** What the mic says at rest: a tap starts a run. */
const START_LABEL = 'Start: buzz your lips over the waves'

/** "88%": the result's big number is the share of the waves lit. */
export function litText(summary: LipSummary): string {
  return `${summary.litPct}%`
}

export function LipRollRoom(props: LipRollRoomProps): JSX.Element {
  // eslint-disable-next-line solid/reactivity -- read once, as documented
  const own = props.controller === undefined
  // eslint-disable-next-line solid/reactivity -- read once, as documented
  const room = props.controller ?? useLipController()
  const demo: LipDemo | null = own ? useLipDemo(room) : null
  const phase = (): string => room.state().phase
  const demoMode = (): string => demo?.mode() ?? 'idle'
  /** The demo has the room: its controls are out of reach. */
  const demoBusy = (): boolean => demoMode() !== 'idle'
  /**
   * The demo is buzzing a take: Merc's bubble and the chip keep quiet, so
   * the take's pill and the tooltip speak one at a time.
   */
  const demoTake = (): boolean => (demo?.take() ?? null) !== null
  const scripted = (): boolean => room.script.active()
  let rootEl: HTMLDivElement | undefined
  const [box, setBox] = createSignal<RoomBox | null>(null)
  const reduced = prefersReducedMotion()

  onMount(() => {
    const measure = (): void => {
      if (rootEl === undefined) return
      const style = window.getComputedStyle(rootEl)
      const top = Number.parseFloat(style.paddingTop) || 0
      const bottom = Number.parseFloat(style.paddingBottom) || 0
      const height = rootEl.clientHeight
      const controlsClear = bottom + cssPx(style, '--lip-controls-clear')
      setBox({
        width: rootEl.clientWidth,
        height,
        chipBottom: top + cssPx(style, '--lip-chip-clear'),
        controlsTop: height - controlsClear,
        controlsClear,
      })
    }
    measure()
    const observer = new ResizeObserver(measure)
    if (rootEl !== undefined) observer.observe(rootEl)
    onCleanup(() => observer.disconnect())
  })

  const layout = createMemo((): BayLayout | null => {
    const b = box()
    if (b === null || b.width <= 0 || b.height <= 0) return null
    return layoutBay(b)
  })

  /**
   * Merc's line over his head as he waits at a root, at the intro's camera
   * or the run's, whichever holds him higher: the count-in zooms between
   * the two while he listens. At the result, over the buttons on the
   * right, clear of him on the left (screen 4).
   */
  const bubbleBottom = (): number => {
    const l = layout()
    const b = box()
    if (l === null || b === null) return 0
    if (phase() === 'result') return b.controlsClear + RESULT_BUBBLE_GAP
    const head = Math.min(
      ...[0, 1].map((z) => {
        const merc = mercBoxAt(l, zoomAt(z), MERC_INTRO_X, WAVE.rootY)
        return merc.top + merc.size * BUBBLE_OVER_MERC
      }),
    )
    return l.height - head
  }
  const showLine = (): boolean =>
    room.line() !== '' && phase() !== 'blocked' && !demoTake()
  const showLevel = (): boolean =>
    !scripted() &&
    (phase() === 'intro' || phase() === 'result' || phase() === 'blocked')
  /** The mic: ready, waiting through a count-in or a breath, or hearing a wave. */
  const micState = (): MicState =>
    lipMicState(room.state().phase, room.riding(), scripted())

  /** Merc's canvas over the next moments of the demo's take, px. */
  const mercLane = (): Rect[] => {
    const l = layout()
    if (l === null) return []
    return room.mercAhead(TIP_LANE_SECONDS).map((spot) => {
      const box = mercBoxAt(l, zoomAt(spot.zoom), spot.x, spot.feetY)
      return { x: box.left, y: box.top, w: box.size, h: box.size }
    })
  }

  /**
   * What a screen reader hears, from one polite region there from the
   * start: the result and Merc's line at the result, the chip and his line
   * during a run, his line otherwise.
   */
  const said = (): string => {
    // The demo speaks for itself (its layer's region).
    if (demoBusy() || scripted()) return ''
    const summary = phase() === 'result' ? room.summary() : null
    if (summary !== null) {
      const chips = resultChips(summary).join('. ')
      return `${litText(summary)} of the waves lit. ${chips}. ${room.line()}`
    }
    const chip = room.chip()
    return chip === null ? room.line() : `${chip}. ${room.line()}`.trim()
  }

  // Focus on a control the room takes away goes to the one in its place.
  const focus = createFocusHandoff()
  const mainControl = (): HTMLElement | null => {
    const mode = demoMode()
    // The demo's cards take focus themselves.
    if (mode === 'card' || mode === 'end') return null
    let id = 'lip-mic'
    if (mode === 'playing') id = 'lip-demo-skip'
    else if (phase() === 'result' && !scripted()) id = 'lip-again'
    else if (phase() === 'blocked') id = 'lip-retry'
    return rootEl?.querySelector<HTMLElement>(`[data-testid="${id}"]`) ?? null
  }
  createEffect(
    on([phase, demoMode], () => focus.handOff(mainControl), { defer: true }),
  )

  const micLabel = (): string => {
    if (scripted()) return START_LABEL
    if (phase() === 'starting') return 'Opening the microphone'
    if (phase() === 'settle') return 'Listening for your note. Tap to stop'
    return labelFor(micState(), START_LABEL)
  }

  return (
    <div
      ref={rootEl}
      class={`${styles.room} mp-dark-stage`}
      data-phase={phase()}
      data-demo={demoMode()}
      data-testid="lip-roll-room"
      onFocusIn={(event) => focus.noteFocus(event)}
    >
      <Show when={layout()}>
        {(l) => (
          <BayScene
            layout={l()}
            path={room.path()}
            reduced={reduced}
            showResult={room.showResult()}
            still={props.still}
            onSettled={props.onSettled}
            onReady={(view) => room.attach(view)}
            merc={
              <MercView
                state={room.mercState}
                voice={room.mercVoice}
                rings={false}
                sparkles="left"
                testId="lip-merc"
              />
            }
          />
        )}
      </Show>

      <div class={styles.head} data-testid="lip-header" inert={demoBusy()}>
        <Switch>
          <Match when={phase() === 'result' ? room.summary() : null}>
            {(summary) => (
              <div class={styles.resultHead}>
                <ResultCard
                  value={litText(summary())}
                  detail="of the waves lit"
                  testId="lip-result"
                  detailTestId="lip-result-label"
                />
                <div class={styles.chips}>
                  <For each={resultChips(summary())}>
                    {(text) => (
                      <span class={styles.pill} data-testid="lip-result-chip">
                        {text}
                      </span>
                    )}
                  </For>
                </div>
                <Show when={bestText(summary())}>
                  {(best) => (
                    <p class={styles.best} data-testid="lip-best">
                      {best()}
                    </p>
                  )}
                </Show>
              </div>
            )}
          </Match>
          <Match when={phase() !== 'result'}>
            <div class={styles.chip}>
              <RoomChip
                text={demoTake() ? null : room.chip()}
                testId="lip-chip"
              />
            </div>
          </Match>
        </Switch>
      </div>

      <RoomBarEnd>
        <Show when={showLevel()}>
          <LipLevel />
        </Show>
        <Show when={demo?.canAsk() === true}>
          <RoomAsk
            onAsk={() => demo?.ask()}
            label={DEMO_COPY.ask}
            testId="lip-ask"
          />
        </Show>
      </RoomBarEnd>
      <Show when={demoMode() === 'playing'}>
        <button
          type="button"
          class={styles.skip}
          onClick={() => demo?.skip()}
          data-testid="lip-demo-skip"
        >
          {DEMO_COPY.skip}
        </button>
      </Show>

      <Show when={showLine()}>
        <div
          class={styles.bubble}
          classList={{ [styles.bubbleResult]: phase() === 'result' }}
          style={{ bottom: `${bubbleBottom()}px` }}
        >
          <RoomBubble testId="lip-bubble">{room.line()}</RoomBubble>
        </div>
      </Show>

      <div
        class={styles.bottom}
        classList={{
          [styles.bottomAway]: demoMode() === 'card' || demoMode() === 'end',
        }}
        inert={demoBusy()}
      >
        <Switch>
          <Match when={phase() === 'result' && !scripted()}>
            <ResultActions
              onAgain={() => room.start()}
              onDone={() => props.onDone()}
              againTestId="lip-again"
              doneTestId="lip-done"
            />
          </Match>
          <Match when={phase() === 'blocked'}>
            <MicBlocked
              block={room.state().block}
              onRetry={() => room.start()}
              retryTestId="lip-retry"
            />
          </Match>
          <Match when={true}>
            {/* The demo's take pill stands over the mic while it buzzes. */}
            <Show when={scripted()}>
              <DemoTakePill
                take={demo?.take() ?? null}
                copy={DEMO_COPY}
                testId="lip-demo-take"
              />
            </Show>
            <MicButton
              state={micState()}
              level={room.micLevel}
              pulse={demo?.micPulse() === true}
              still={props.still}
              disabled={phase() === 'starting'}
              label={micLabel()}
              onClick={() => {
                if (phase() === 'intro') room.start()
                else room.stop()
              }}
              testId="lip-mic"
            />
          </Match>
        </Switch>
      </div>
      <div class={styles.said} aria-live="polite" data-testid="lip-said">
        {said()}
      </div>
      <Show when={demo}>
        {(d) => (
          <DemoLayer
            demo={d()}
            aim={(tip, layer) => aimLipTip(tip.target, layer, mercLane())}
            copy={DEMO_COPY}
            testId="lip-demo"
          />
        )}
      </Show>
    </div>
  )
}
