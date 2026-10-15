// ============================================================
// LongNoteRoom — hold one note while the lantern fills with light
// ============================================================
//
// The premium Long note (design: premium-exercises/LONG-NOTE-DESIGN.md,
// storyboard 01-long-note). Three screens in one room:
//
//   intro    the empty lantern, the target line through it, Merc beside it
//            breathing in, the note to hold and one big microphone button
//   hold     the voice line flowing along the target, the light rising,
//            Merc floating on it inside the glass, a big timer and one chip;
//            at the goal (half full) he steps out to cheer, and steady
//            singing fills the top (a less steady voice, part of it)
//   result   the lantern as full as the take filled it, the seconds and the
//            steadiness, Merc out of the glass, Again and Done
//
// "How it works" (demo/) plays over the same room: Merc sings two takes
// through it while tooltips explain them. A first visit opens on it, and
// the "?" in the stage's corner plays it again at the start or a result.
// The level in the corner across from it (LongNoteLevel.tsx) sets how much
// room the note has and how steady the top asks the voice to be.
//
// The head, the mic, the result's buttons and the level control are the
// room kit's (src/components/room-kit/); the demo's layer, cards and take
// pill are the demo kit's (src/components/demo-kit/). This room brings its
// world (the lantern, Merc in it, the line), its words and its test ids.
//
// Merc's canvas sits BETWEEN the lantern's two layers (Lantern.tsx), so in
// the glass he is behind its highlights and frame, and his feet are in the
// liquid. The target line and the voice are drawn on both sides of him
// (VoiceTrace.tsx): in the glass behind him, over the frame and the room in
// front. Everything is placed from one measurement of the stage
// (`layoutStage`), in the lantern's own view-box units.

import type { JSX } from 'solid-js'
import { createEffect, createMemo, createSignal, Match, on, onCleanup, onMount, Show, Switch, untrack, } from 'solid-js'
import { DemoLayer } from '@/components/demo-kit/DemoLayer'
import { DemoTakePill } from '@/components/demo-kit/DemoTakePill'
import { HelpCircle, Minus, Plus, Volume2 } from '@/components/icons'
import { createFocusHandoff } from '@/components/room-kit/focus-handoff'
import { MERC_FEET, MercView } from '@/components/room-kit/MercView'
import { MicBlocked, MicButton, ResultActions, } from '@/components/room-kit/RoomControls'
import { ResultCard, RoomBubble, RoomChip, RoomHeader, RoomTimer, } from '@/components/room-kit/RoomHeader'
import { DEMO_COPY } from './demo/demo-cues'
import { aimLongNoteTip } from './demo/tip-targets'
import type { LongNoteDemo } from './demo/useLongNoteDemo'
import { useLongNoteDemo } from './demo/useLongNoteDemo'
import { LanternBack, LanternFront } from './Lantern'
import { CHIMNEY_BOTTOM, LANTERN_VIEW_H, LANTERN_VIEW_W, surfaceY, TARGET_LINE_Y, } from './lantern-geometry'
import { formatHoldSeconds } from './long-note-entry'
import { LongNoteLevel } from './LongNoteLevel'
import styles from './LongNoteRoom.module.css'
import { BESIDE_X, createLayoutGlide, layoutStage, MERC_UNITS, } from './stage-layout'
import type { LongNoteController } from './useLongNoteController'
import { useLongNoteController } from './useLongNoteController'
import { TRACE_PX_PER_CENT, VoiceTrace } from './VoiceTrace'

export interface LongNoteRoomProps {
  /** Leave the room (Done). */
  onDone: () => void
  /**
   * The run, when it is not the room's own: the dev fixtures' pinned
   * frames (fixture/LongNoteFixture.tsx). Read once. A room on another's
   * run has no demo.
   */
  controller?: LongNoteController
  /** No animation at all (the fixtures). */
  still?: boolean
  /** Every picture the room shows has decoded (the fixtures wait for it). */
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

// ── Where things go, in lantern view-box units ─────────────────

/** How small he gets to float inside the glass. */
const MERC_INSIDE_SCALE = 0.7
/** The ground under the lantern's foot, where he stands beside it. */
const GROUND_Y = 370
/**
 * How far his feet sink into the liquid: he stands on its surface, the
 * bottoms of his feet 5 units under its middle line as in storyboard 2,
 * and the front lip passes under them.
 */
const FLOAT_SINK = 3
/** Where he stands while the liquid is too shallow to float him. */
const BOWL_FLOOR = CHIMNEY_BOTTOM - 4
/**
 * Where the voice's newest point lands: past the glass, where storyboard
 * 2's ribbon ends, short of the note's name.
 */
const TRACE_HEAD_X = 240

export function LongNoteRoom(props: LongNoteRoomProps): JSX.Element {
  // eslint-disable-next-line solid/reactivity -- read once, as documented
  const own = props.controller === undefined
  // eslint-disable-next-line solid/reactivity -- read once, as documented
  const room = props.controller ?? useLongNoteController()
  const demo: LongNoteDemo | null = own ? useLongNoteDemo(room) : null
  const demoMode = (): string => demo?.mode() ?? 'idle'
  /** The demo has the room: its controls are out of reach. */
  const demoBusy = (): boolean => demoMode() !== 'idle'
  /**
   * The demo is singing a take: Merc's bubble and chip keep quiet, so the
   * take's pill and the tooltip speak one at a time.
   */
  const demoTake = (): boolean => (demo?.take() ?? null) !== null
  let stageEl: HTMLDivElement | undefined
  const [stageSize, setStageSize] = createSignal({ width: 0, height: 0 })
  // Centred while Merc floats in the glass, moved over for him beside it;
  // gliding between the two. `settled` is where a glide is going.
  const settled = createMemo(() => {
    const { width, height } = stageSize()
    return layoutStage(width, height, room.mercPlace() === 'beside' ? 1 : 0)
  })
  const layout = createLayoutGlide(() => settled())

  onMount(() => {
    const measure = (): void => {
      if (stageEl === undefined) return
      setStageSize({
        width: stageEl.clientWidth,
        height: stageEl.clientHeight,
      })
    }
    measure()
    const observer = new ResizeObserver(measure)
    if (stageEl !== undefined) observer.observe(stageEl)
    onCleanup(() => {
      observer.disconnect()
    })
    if (props.onSettled !== undefined && rootEl !== undefined) {
      // The lantern's plates are in the room from its first frame.
      void imagesDecoded(rootEl).then(props.onSettled)
    }
  })

  const phase = (): string => room.state().phase

  // A change of place eases across for the length of his hop; the rest of
  // the time his canvas follows the liquid frame by frame, with no easing to
  // lag behind it.
  const [hopping, setHopping] = createSignal(false)
  let hopTimer: ReturnType<typeof setTimeout> | undefined
  const hop = (): void => {
    setHopping(true)
    clearTimeout(hopTimer)
    hopTimer = setTimeout(() => setHopping(false), 700)
  }
  createEffect(on(room.mercPlace, hop, { defer: true }))
  // A stage that moves mid-hop gives him a new end to aim at: the hop runs
  // its full length again from there, so his ease and the glide both land
  // before he takes the new size.
  createEffect(
    on(
      settled,
      () => {
        if (untrack(hopping)) hop()
      },
      { defer: true },
    ),
  )
  onCleanup(() => clearTimeout(hopTimer))

  // The canvas's size, in px per view unit: where a glide ends, but held
  // while he hops. The hop eases his transform in CSS (.mercHop) and a new
  // width and height would land at once: on the hop's first frame the old
  // transform sat on the new box, and he shrank and jumped against the hop
  // (review B2 of PR 973, N1). The hop outlasts the glide, so the size
  // still changes once a move, as the hop ends.
  const [boxK, setBoxK] = createSignal(untrack(() => settled().k))
  createEffect(() => {
    const end = settled().k
    if (!hopping()) setBoxK(end)
  })

  // Merc's canvas: one size, moved and scaled. The transform's origin is his
  // feet, so the same point lands on the ground or on the liquid. The glide
  // itself is in the scale, so the renderer sizes its canvas, and rebuilds
  // its render targets, once a move rather than on each of its frames.
  // While he hops he aims straight at where the glide ends. The hop's CSS
  // ease starts again from where it is at each new transform, so an aim
  // that moved with every glide frame left the ease trailing the glide, and
  // the new size cut the rest short in one frame as the hop ended.
  const mercBox = createMemo(() => {
    const { k } = hopping() ? settled() : layout()
    const end = boxK()
    const size = MERC_UNITS * end
    const inside = room.mercPlace() === 'inside'
    const feetX = inside ? LANTERN_VIEW_W / 2 : BESIDE_X
    const feetY = inside
      ? Math.min(BOWL_FLOOR, surfaceY(room.lanternLevel()) + FLOAT_SINK)
      : GROUND_Y
    return {
      size,
      left: feetX * k - size / 2,
      top: feetY * k - size * MERC_FEET,
      scale: (inside ? MERC_INSIDE_SCALE : 1) * (k / end),
    }
  })

  const lineY = (): number => {
    const { k, top } = layout()
    return top + TARGET_LINE_Y * k
  }
  const anchorX = (): number => {
    const { k, left } = layout()
    return left + TRACE_HEAD_X * k
  }
  /** The tolerance band's half-height either side of the line, px. */
  const band = (): number => room.toleranceCents() * TRACE_PX_PER_CENT
  const tracing = (): boolean => phase() === 'listen' || phase() === 'hold'
  /** The result shows the full lantern, as storyboard 3 does: no line. */
  const lineClass = (base: string): string =>
    phase() === 'result' ? `${base} ${styles.lineAway}` : base

  /** Why the note will not play now, and when it will. */
  const hearLater = (): string =>
    room.script.active()
      ? `Hear ${room.noteName()} after the demo.`
      : `Hear ${room.noteName()} after the take: the mic is listening.`
  /** The picker's own Hear button is on screen. */
  const pickerHears = (): boolean =>
    phase() === 'intro' && !room.script.active()

  /**
   * What a screen reader hears, from one polite region that is there from
   * the start: the chip while the voice is held, the result and Merc's line
   * after it, his line otherwise. The demo speaks for itself (its layer's
   * region), so the room keeps quiet while it runs.
   */
  const said = (): string => {
    if (demoBusy() || room.script.active()) return ''
    if (phase() === 'hold') return room.chip() ?? ''
    const summary = phase() === 'result' ? room.summary() : null
    if (summary === null) return room.line()
    const seconds = formatHoldSeconds(summary.inBandSeconds).replace(
      ' s',
      ' seconds',
    )
    const steadiness =
      summary.steadiness === null
        ? ''
        : ` Steadiness ${Math.round(summary.steadiness)}.`
    return `${seconds}.${steadiness} ${room.line()}`
  }

  // Focus on a control the room takes away goes to the one in its place.
  let rootEl: HTMLDivElement | undefined
  const focus = createFocusHandoff()
  const mainControl = (): HTMLElement | null => {
    const mode = demoMode()
    // The demo's cards take focus themselves.
    if (mode === 'card' || mode === 'end') return null
    let id = 'long-note-mic'
    if (mode === 'playing') id = 'long-note-demo-skip'
    else if (phase() === 'result' && !room.script.active()) {
      id = 'long-note-again'
    } else if (phase() === 'blocked') id = 'long-note-retry'
    return rootEl?.querySelector<HTMLElement>(`[data-testid="${id}"]`) ?? null
  }
  createEffect(
    on([phase, demoMode], () => focus.handOff(mainControl), { defer: true }),
  )

  /**
   * The result's line under the seconds. None without a steadiness, and
   * none at 0 or NaN, which the card has always hidden.
   */
  const steadinessLine = (steadiness: number | null): string | null =>
    steadiness === null || steadiness === 0 || Number.isNaN(steadiness)
      ? null
      : `Steadiness ${Math.round(steadiness)}`

  const micLabel = (): string => {
    switch (phase()) {
      case 'starting':
        return 'Opening the microphone'
      case 'listen':
        return 'Listening. Tap to stop'
      case 'hold':
        return 'Listening. Tap to finish'
      default:
        return room.noteName() === ''
          ? 'Start: sing any easy note'
          : `Start: hold ${room.noteName()}`
    }
  }

  return (
    <div
      ref={rootEl}
      class={`${styles.room} mp-dark-stage`}
      classList={{ [styles.still]: props.still === true }}
      data-phase={phase()}
      data-demo={demoMode()}
      data-testid="long-note-room"
      onFocusIn={(event) => focus.noteFocus(event)}
    >
      <RoomHeader inert={demoBusy()}>
        <Switch>
          <Match when={phase() === 'hold'}>
            <RoomTimer testId="long-note-timer">
              {formatHoldSeconds(room.hold().inBandSeconds)}
              <Show when={demo?.fast() === true}>
                <span
                  class={styles.fast}
                  aria-hidden="true"
                  data-testid="long-note-demo-fast"
                >
                  {DEMO_COPY.fast}
                </span>
              </Show>
            </RoomTimer>
            <RoomChip
              text={demoTake() ? null : room.chip()}
              testId="long-note-chip"
            />
          </Match>
          <Match when={phase() === 'result' ? room.summary() : null}>
            {(summary) => (
              <ResultCard
                value={formatHoldSeconds(summary().inBandSeconds)}
                detail={steadinessLine(summary().steadiness)}
                testId="long-note-result"
                detailTestId="long-note-steadiness"
              />
            )}
          </Match>
        </Switch>
        <Show when={room.line() !== '' && phase() !== 'hold' && !demoTake()}>
          <RoomBubble testId="long-note-line">{room.line()}</RoomBubble>
        </Show>
      </RoomHeader>

      <div ref={stageEl} class={styles.stage} data-testid="long-note-stage">
        <div
          class={lineClass(styles.band)}
          style={{ top: `${lineY() - band()}px`, height: `${2 * band()}px` }}
          data-testid="long-note-band"
        />
        <Show when={room.noteName() !== ''}>
          {/* The line's note, which plays on a tap. While the take listens
              it cannot, and says so. In the intro the picker's Hear is the
              same control, so a screen reader is offered that one. */}
          <button
            type="button"
            class={styles.noteTag}
            style={{ top: `${lineY()}px` }}
            onClick={() => room.hearNote()}
            disabled={!room.canHear()}
            title={room.canHear() ? undefined : hearLater()}
            aria-label={`Hear ${room.noteName()}`}
            aria-hidden={pickerHears() ? 'true' : undefined}
            tabIndex={pickerHears() ? -1 : undefined}
            data-testid="long-note-note"
          >
            {room.noteName()}
          </button>
        </Show>
        <div
          class={styles.lantern}
          data-testid="long-note-lantern"
          style={{
            left: `${layout().left}px`,
            top: `${layout().top}px`,
            width: `${LANTERN_VIEW_W * layout().k}px`,
            height: `${LANTERN_VIEW_H * layout().k}px`,
          }}
        >
          <LanternBack
            level={room.lanternLevel}
            glow={room.lanternGlow}
            shine={room.shine}
            paused={props.still}
          />
          {/* In the glass the line and the voice pass behind Merc. */}
          <VoiceTrace
            class={lineClass(styles.trace)}
            style={{
              left: `${-layout().left}px`,
              top: `${-layout().top}px`,
              width: `${layout().width}px`,
              height: `${layout().height}px`,
            }}
            testId="long-note-trace-inner"
            region="inside"
            trace={room.trace}
            now={room.now}
            lineY={lineY}
            anchorX={anchorX}
            lantern={layout}
            active={tracing}
            muted={() => phase() === 'result'}
            still={props.still}
          />
          {/* He celebrates beside the lantern: his stars go on his far side. */}
          <MercView
            class={hopping() ? `${styles.merc} ${styles.mercHop}` : styles.merc}
            state={room.mercState}
            voice={room.mercVoice}
            sparkles="right"
            testId="long-note-merc"
            style={{
              width: `${mercBox().size}px`,
              height: `${mercBox().size}px`,
              transform: `translate(${mercBox().left}px, ${mercBox().top}px) scale(${mercBox().scale})`,
              'transform-origin': `50% ${MERC_FEET * 100}%`,
            }}
          />
          <LanternFront
            level={room.lanternLevel}
            glow={room.lanternGlow}
            shine={room.shine}
            // Reduced motion: the demo shows the full lantern unsparkled.
            still={() => demo?.still === true && room.script.active()}
            paused={props.still}
          />
        </div>
        {/* Out of the glass they cross the lantern's frame in front. */}
        <VoiceTrace
          class={lineClass(styles.trace)}
          region="outside"
          trace={room.trace}
          now={room.now}
          lineY={lineY}
          anchorX={anchorX}
          lantern={layout}
          active={tracing}
          muted={() => phase() === 'result'}
          still={props.still}
        />
        <Show when={demo?.canAsk() === true}>
          <LongNoteLevel class={styles.level} />
          <button
            type="button"
            class={styles.ask}
            onClick={() => demo?.ask()}
            aria-label={DEMO_COPY.ask}
            data-testid="long-note-ask"
          >
            <HelpCircle size={22} />
          </button>
        </Show>
        <Show when={demoMode() === 'playing'}>
          <button
            type="button"
            class={styles.skip}
            onClick={() => demo?.skip()}
            data-testid="long-note-demo-skip"
          >
            {DEMO_COPY.skip}
          </button>
        </Show>
      </div>

      <div
        class={styles.bottom}
        classList={{
          [styles.bottomAway]: demoMode() === 'card' || demoMode() === 'end',
        }}
        inert={demoBusy()}
      >
        <Switch>
          <Match when={phase() === 'result' && !room.script.active()}>
            <ResultActions
              onAgain={() => room.again()}
              onDone={() => props.onDone()}
              againTestId="long-note-again"
              doneTestId="long-note-done"
            />
            <button
              type="button"
              class={styles.textButton}
              onClick={() => room.changeNote()}
            >
              Pick another note
            </button>
          </Match>
          <Match when={phase() === 'blocked'}>
            <MicBlocked
              block={room.state().block}
              onRetry={() => room.start()}
              retryTestId="long-note-retry"
            />
          </Match>
          <Match when={phase() !== 'result' || room.script.active()}>
            {/* The picker keeps its place once the take starts, so the mic
                button stays under the finger that pressed it. The demo's
                take pill stands in it while the demo sings. */}
            <Show when={room.script.active()}>
              <DemoTakePill
                take={demo?.take() ?? null}
                copy={DEMO_COPY}
                testId="long-note-demo-take"
              />
            </Show>
            <div
              class={styles.picker}
              classList={{
                [styles.pickerAway]: phase() !== 'intro',
                [styles.pickerOut]: room.script.active(),
              }}
              role="group"
              aria-label="The note to hold"
              aria-hidden={phase() !== 'intro'}
              data-testid="long-note-picker"
            >
              <button
                type="button"
                class={styles.step}
                onClick={() => room.nudge(-1)}
                disabled={phase() !== 'intro'}
                aria-label="A note lower"
                data-testid="long-note-lower"
              >
                <Minus size={18} />
              </button>
              <Show
                when={room.noteName() !== ''}
                fallback={
                  <span class={styles.hear} data-testid="long-note-any">
                    Any easy note
                  </span>
                }
              >
                <button
                  type="button"
                  class={styles.hear}
                  onClick={() => room.hearNote()}
                  disabled={phase() !== 'intro'}
                  aria-label={`Hear ${room.noteName()}`}
                >
                  <Volume2 />
                  <span>{room.noteName()}</span>
                </button>
              </Show>
              <button
                type="button"
                class={styles.step}
                onClick={() => room.nudge(1)}
                disabled={phase() !== 'intro'}
                aria-label="A note higher"
                data-testid="long-note-higher"
              >
                <Plus size={18} />
              </button>
            </div>
            <MicButton
              listening={
                (phase() === 'listen' || phase() === 'hold') &&
                !room.script.active()
              }
              demo={room.script.active()}
              pulse={demo?.micPulse() === true}
              disabled={phase() === 'starting'}
              label={micLabel()}
              onClick={() => {
                if (phase() === 'listen' || phase() === 'hold') room.stop()
                else room.start()
              }}
              testId="long-note-mic"
            />
          </Match>
        </Switch>
      </div>
      <div class={styles.said} aria-live="polite" data-testid="long-note-said">
        {said()}
      </div>
      <Show when={demo}>
        {(d) => (
          <DemoLayer
            demo={d()}
            aim={(tip, layer) =>
              aimLongNoteTip(tip.target, layer, room.lanternLevel())
            }
            copy={DEMO_COPY}
            testId="long-note-demo"
          />
        )}
      </Show>
    </div>
  )
}
