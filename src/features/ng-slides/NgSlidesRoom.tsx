// ============================================================
// NgSlidesRoom: hum five slides, and the glass bridge lights
// ============================================================
//
// The premium Ng slides (design: DESIGN-ng-slides.md, storyboard
// 02-ng-slides; art: ART-FIDELITY.md 4). One room over a night river:
//
//   intro     the bridge unlit, Merc on the pier, his line, the mic
//   settle    no root yet: the singer hums an easy note first
//   run       the count-in (the first root's tone, the bridge rolling in),
//             then five slides: the bridge scrolls under the playhead,
//             the voice's ribbon follows the line, and the glass lights
//             wherever the voice followed it. "Slide 2 of 5" in the chip;
//             Merc rides the voice; he speaks only in the breaths
//   result    the view pulls back to the whole bridge, lit as the slides
//             lit it: the share lit, a chip for the jumps, the best,
//             Again and Done
//
// Drawn full-bleed (the shell's premium-rooms.ts, D1). The head's and the
// controls' heights are CSS custom properties (NgSlidesRoom.module.css),
// read here once a resize, so the bridge keeps Merc and the note names
// clear of both (bridge-layout.ts).
//
// The chip, the bubble, the result card, the mic, the result's buttons and
// the level control are the room kit's; this room brings its world
// (BridgeScene.tsx), its words and its test ids.
//
// "How it works" (demo/) plays over the same room: Merc hums one slide the
// way not to and one the way to, through the room's own engine, with the
// demo kit's layer, cards and take pill over it. A first visit opens on
// it; the "?" plays it again from the intro or a result.

import type { JSX } from 'solid-js'
import { createEffect, createMemo, createSignal, For, Match, on, onCleanup, onMount, Show, Switch, } from 'solid-js'
import { DemoLayer } from '@/components/demo-kit/DemoLayer'
import { DemoTakePill } from '@/components/demo-kit/DemoTakePill'
import { createFocusHandoff } from '@/components/room-kit/focus-handoff'
import { LevelControl } from '@/components/room-kit/LevelControl'
import { MERC_FEET, MercView } from '@/components/room-kit/MercView'
import type { MicState } from '@/components/room-kit/mic-state'
import { micLabel as labelFor } from '@/components/room-kit/mic-state'
import { prefersReducedMotion } from '@/components/room-kit/reduced-motion'
import { RoomAsk, RoomBarEnd } from '@/components/room-kit/RoomBar'
import { MicBlocked, MicButton, ResultActions, } from '@/components/room-kit/RoomControls'
import { ResultCard, RoomBubble, RoomChip, } from '@/components/room-kit/RoomHeader'
import surface from '@/components/room-kit/RoomSurface.module.css'
import type { ExerciseLevel } from '@/stores/exercise-level'
import { ARCH } from './bridge-geometry'
import type { BridgeLayout } from './bridge-layout'
import { layoutBridge, yOf } from './bridge-layout'
import { BridgeScene } from './BridgeScene'
import { DEMO_COPY } from './demo/demo-cues'
import { aimNgTip } from './demo/tip-targets'
import type { NgDemo } from './demo/useNgDemo'
import { useNgDemo } from './demo/useNgDemo'
import type { NgController } from './ng-controller-contract'
import { ngMicState } from './ng-machine'
import type { NgSummary } from './ng-run'
import { bestText, jumpsText, topsText } from './ng-run'
import styles from './NgSlidesRoom.module.css'
import { useNgController } from './useNgController'

export interface NgSlidesRoomProps {
  /** Leave the room (Done). */
  onDone: () => void
  /**
   * The run, when it is not the room's own: the dev fixtures' pinned
   * frames (fixture/NgFixture.tsx). Read once. A room on another's run has
   * no demo.
   */
  controller?: NgController
  /** No animation at all (the fixtures). */
  still?: boolean
  /** Every picture the scene shows has decoded (the fixtures wait for it). */
  onSettled?: () => void
}

/**
 * Merc's bubble sits this far down his canvas: just over his head (the
 * top of his head is 0.21 down it, measured on the intro fixture).
 */
const BUBBLE_OVER_MERC = 0.17
/** At the result the bubble sits this far over the controls, px. */
const RESULT_BUBBLE_GAP = 12

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
const START_LABEL = 'Start: hum the slides over the bridge'

/**
 * The level pill's lines (the room kit's LevelControl, in the bar beside
 * "?"): what each level asks of a slide. Ng slides reads the level as its
 * slides' rules (NG_SLIDES_LEVELS, DESIGN-ng-slides.md 3): how fast each
 * slide goes, how close to the line the voice must stay, whether the next
 * note plays in the breath, and whether the top must land in tune.
 */
const NG_LEVEL_LINES: Record<ExerciseLevel, string> = {
  learning:
    'Slow slides with plenty of room around the line. The next note plays in every breath.',
  singer:
    'Steady slides, closer to the line. The next note still plays in every breath.',
  professional:
    'Quick slides, close to the line, and no notes in the breaths. Each top must land in tune.',
}

/** "84%": the result's big number is the share of the bridge lit. */
export function litText(summary: NgSummary): string {
  return `${summary.litPct}%`
}

/** The result's chips: the jumps, and the tops at Pro. */
export function resultChips(summary: NgSummary): string[] {
  const tops = topsText(summary)
  return tops === null ? [jumpsText(summary)] : [jumpsText(summary), tops]
}

export function NgSlidesRoom(props: NgSlidesRoomProps): JSX.Element {
  // eslint-disable-next-line solid/reactivity -- read once, as documented
  const own = props.controller === undefined
  // eslint-disable-next-line solid/reactivity -- read once, as documented
  const room = props.controller ?? useNgController()
  const demo: NgDemo | null = own ? useNgDemo(room) : null
  const phase = (): string => room.state().phase
  const demoMode = (): string => demo?.mode() ?? 'idle'
  /** The demo has the room: its controls are out of reach. */
  const demoBusy = (): boolean => demoMode() !== 'idle'
  /**
   * The demo is humming a take: Merc's bubble and the chip keep quiet, so
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
      const controlsClear = bottom + cssPx(style, '--ng-controls-clear')
      setBox({
        width: rootEl.clientWidth,
        height,
        chipBottom: top + cssPx(style, '--ng-chip-clear'),
        controlsTop: height - controlsClear,
        controlsClear,
      })
    }
    measure()
    const observer = new ResizeObserver(measure)
    if (rootEl !== undefined) observer.observe(rootEl)
    onCleanup(() => observer.disconnect())
  })

  const layout = createMemo((): BridgeLayout | null => {
    const b = box()
    if (b === null || b.width <= 0 || b.height <= 0) return null
    return layoutBridge(b)
  })

  /** Merc's line over his head on the deck; at the result, over the buttons. */
  const bubbleBottom = (): number => {
    const l = layout()
    const b = box()
    if (l === null || b === null) return 0
    if (phase() === 'result') return b.controlsClear + RESULT_BUBBLE_GAP
    const head =
      yOf(l, ARCH.deckY) -
      l.mercSize * MERC_FEET +
      l.mercSize * BUBBLE_OVER_MERC
    return l.height - head
  }
  const showLine = (): boolean =>
    room.line() !== '' && phase() !== 'blocked' && !demoTake()
  const showLevel = (): boolean =>
    !scripted() &&
    (phase() === 'intro' || phase() === 'result' || phase() === 'blocked')
  /** The mic: ready, waiting through a count-in or a breath, or hearing a slide. */
  const micState = (): MicState =>
    ngMicState(room.state().phase, room.singing(), scripted())

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
      return `${litText(summary)} of the bridge lit. ${chips}. ${room.line()}`
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
    let id = 'ng-mic'
    if (mode === 'playing') id = 'ng-demo-skip'
    else if (phase() === 'result' && !scripted()) id = 'ng-again'
    else if (phase() === 'blocked') id = 'ng-retry'
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
      class={`${styles.room} ${surface.surface} mp-dark-stage`}
      data-phase={phase()}
      data-demo={demoMode()}
      data-testid="ng-slides-room"
      onFocusIn={(event) => focus.noteFocus(event)}
    >
      <Show when={layout()}>
        {(l) => (
          <BridgeScene
            layout={l()}
            path={room.lines().path}
            root={room.lines().root}
            reduced={reduced}
            showResult={room.showResult()}
            still={props.still}
            onSettled={props.onSettled}
            onReady={(view) => room.attach(view)}
            merc={
              <MercView
                state={room.mercState}
                voice={room.mercVoice}
                sparkles="left"
                testId="ng-merc"
              />
            }
          />
        )}
      </Show>

      <div class={styles.head} data-testid="ng-header" inert={demoBusy()}>
        <Switch>
          <Match when={phase() === 'result' ? room.summary() : null}>
            {(summary) => (
              <div class={styles.resultHead}>
                <ResultCard
                  value={litText(summary())}
                  detail="of the bridge lit"
                  testId="ng-result"
                  detailTestId="ng-result-label"
                />
                <div class={styles.chips}>
                  <For each={resultChips(summary())}>
                    {(text) => (
                      <span class={styles.pill} data-testid="ng-result-chip">
                        {text}
                      </span>
                    )}
                  </For>
                </div>
                <Show when={bestText(summary())}>
                  {(best) => (
                    <p class={styles.best} data-testid="ng-best">
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
                testId="ng-chip"
              />
            </div>
          </Match>
        </Switch>
      </div>

      <RoomBarEnd>
        <Show when={showLevel()}>
          <LevelControl lines={NG_LEVEL_LINES} testId="ng-level" />
        </Show>
        <Show when={demo?.canAsk() === true}>
          <RoomAsk
            onAsk={() => demo?.ask()}
            label={DEMO_COPY.ask}
            testId="ng-ask"
          />
        </Show>
      </RoomBarEnd>
      <Show when={demoMode() === 'playing'}>
        <button
          type="button"
          class={styles.skip}
          onClick={() => demo?.skip()}
          data-testid="ng-demo-skip"
        >
          {DEMO_COPY.skip}
        </button>
      </Show>

      <Show when={showLine()}>
        <div class={styles.bubble} style={{ bottom: `${bubbleBottom()}px` }}>
          <RoomBubble testId="ng-bubble">{room.line()}</RoomBubble>
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
              againTestId="ng-again"
              doneTestId="ng-done"
            />
          </Match>
          <Match when={phase() === 'blocked'}>
            <MicBlocked
              block={room.state().block}
              onRetry={() => room.start()}
              retryTestId="ng-retry"
            />
          </Match>
          <Match when={true}>
            {/* The demo's take pill stands over the mic while it hums. */}
            <Show when={scripted()}>
              <DemoTakePill
                take={demo?.take() ?? null}
                copy={DEMO_COPY}
                testId="ng-demo-take"
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
              testId="ng-mic"
            />
          </Match>
        </Switch>
      </div>
      <div class={styles.said} aria-live="polite" data-testid="ng-said">
        {said()}
      </div>
      <Show when={demo}>
        {(d) => (
          <DemoLayer
            demo={d()}
            aim={(tip, layer) => aimNgTip(tip.target, layer)}
            copy={DEMO_COPY}
            testId="ng-demo"
          />
        )}
      </Show>
    </div>
  )
}
