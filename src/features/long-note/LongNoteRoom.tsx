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
//            at the goal (half full) he steps out to cheer, and only steady
//            singing fills the top
//   result   the lantern as full as the take filled it, the seconds and the
//            steadiness, Merc out of the glass, Again and Done
//
// "How it works" (demo/) plays over the same room: Merc sings two takes
// through it while tooltips explain them. A first visit opens on it, and
// the "?" in the stage's corner plays it again at the start or a result.
//
// Merc's canvas sits BETWEEN the lantern's two layers (Lantern.tsx), so in
// the glass he is behind its highlights and frame, and his feet are in the
// liquid. The target line and the voice are drawn on both sides of him
// (VoiceTrace.tsx): in the glass behind him, over the frame and the room in
// front. Everything is placed from one measurement of the stage
// (`layoutStage`), in the lantern's own view-box units.

import type { JSX } from 'solid-js'
import { createEffect, createMemo, createSignal, Match, on, onCleanup, onMount, Show, Switch, } from 'solid-js'
import { CheckSmall, HelpCircle, Mic, Minus, Plus, Volume2, X, } from '@/components/icons'
import { nativeShellApi } from '@/stores/native-shell-store'
import { DEMO_COPY } from './demo/demo-cues'
import { LongNoteDemoLayer } from './demo/LongNoteDemoLayer'
import { useLongNoteDemo } from './demo/useLongNoteDemo'
import { LanternBack, LanternFront } from './Lantern'
import { CHIMNEY_BOTTOM, LANTERN_VIEW_H, LANTERN_VIEW_W, surfaceY, TARGET_LINE_Y, } from './lantern-geometry'
import styles from './LongNoteRoom.module.css'
import { MercView } from './MercView'
import { BESIDE_X, createLayoutGlide, layoutStage, MERC_UNITS, } from './stage-layout'
import { useLongNoteController } from './useLongNoteController'
import { TRACE_PX_PER_CENT, VoiceTrace } from './VoiceTrace'

export interface LongNoteRoomProps {
  /** Leave the room (Done). */
  onDone: () => void
}

// ── Where things go, in lantern view-box units ─────────────────

/** How small he gets to float inside the glass. */
const MERC_INSIDE_SCALE = 0.7
/**
 * Where his feet touch the floor, as a share of the canvas height from its
 * top. The renderer's front view puts the floor point under his centre at
 * 0.789 (target 0.67 up, pitch 0.13, distance 4.2, fov 30); the fronts of
 * his feet are nearer the camera and sit lower, at about 0.81 on the phone
 * walk, so that is the point that meets the ground line.
 */
const MERC_FEET = 0.81
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

function formatSeconds(seconds: number): string {
  return `${(Math.floor(seconds * 10) / 10).toFixed(1)} s`
}

export function LongNoteRoom(props: LongNoteRoomProps): JSX.Element {
  const room = useLongNoteController()
  const demo = useLongNoteDemo(room)
  /** The demo has the room: its controls are out of reach. */
  const demoBusy = (): boolean => demo.mode() !== 'idle'
  /**
   * The demo is singing a take: Merc's bubble and chip keep quiet, so the
   * take's pill and the tooltip speak one at a time.
   */
  const demoTake = (): boolean => demo.take() !== null
  let stageEl: HTMLDivElement | undefined
  const [stageSize, setStageSize] = createSignal({ width: 0, height: 0 })
  // Centred while Merc floats in the glass, moved over for him beside it;
  // gliding between the two.
  const layout = createLayoutGlide(() => {
    const { width, height } = stageSize()
    return layoutStage(width, height, room.mercPlace() === 'beside' ? 1 : 0)
  })

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
  })

  const phase = (): string => room.state().phase

  // Merc's canvas: one size, moved and scaled. The transform's origin is his
  // feet, so the same point lands on the ground or on the liquid.
  const mercBox = createMemo(() => {
    const { k } = layout()
    const size = MERC_UNITS * k
    const inside = room.mercPlace() === 'inside'
    const feetX = inside ? LANTERN_VIEW_W / 2 : BESIDE_X
    const feetY = inside
      ? Math.min(BOWL_FLOOR, surfaceY(room.lanternLevel()) + FLOAT_SINK)
      : GROUND_Y
    return {
      size,
      left: feetX * k - size / 2,
      top: feetY * k - size * MERC_FEET,
      scale: inside ? MERC_INSIDE_SCALE : 1,
    }
  })

  // A change of place eases across for the length of his hop; the rest of
  // the time his canvas follows the liquid frame by frame, with no easing to
  // lag behind it.
  const [hopping, setHopping] = createSignal(false)
  let hopTimer: ReturnType<typeof setTimeout> | undefined
  createEffect(
    on(
      room.mercPlace,
      () => {
        setHopping(true)
        clearTimeout(hopTimer)
        hopTimer = setTimeout(() => setHopping(false), 700)
      },
      { defer: true },
    ),
  )
  onCleanup(() => clearTimeout(hopTimer))

  const lineY = (): number => {
    const { k, top } = layout()
    return top + TARGET_LINE_Y * k
  }
  const anchorX = (): number => {
    const { k, left } = layout()
    return left + TRACE_HEAD_X * k
  }
  /** The tolerance band's half-height either side of the line, px. */
  const band = (): number => room.toleranceCents * TRACE_PX_PER_CENT
  const tracing = (): boolean => phase() === 'listen' || phase() === 'hold'
  /** The result shows the full lantern, as storyboard 3 does: no line. */
  const lineClass = (base: string): string =>
    phase() === 'result' ? `${base} ${styles.lineAway}` : base

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
      class={styles.room}
      data-phase={phase()}
      data-demo={demo.mode()}
      data-testid="long-note-room"
    >
      <div class={styles.top} inert={demoBusy()}>
        <Switch>
          <Match when={phase() === 'hold'}>
            <div class={styles.timer} data-testid="long-note-timer">
              {formatSeconds(room.hold().inBandSeconds)}
              <Show when={demo.fast()}>
                <span
                  class={styles.fast}
                  aria-hidden="true"
                  data-testid="long-note-demo-fast"
                >
                  {DEMO_COPY.fast}
                </span>
              </Show>
            </div>
            <div class={styles.chipRow} aria-live="polite">
              <Show when={demoTake() ? null : room.chip()}>
                {(text) => (
                  <span class={styles.chip} data-testid="long-note-chip">
                    {text()}
                  </span>
                )}
              </Show>
            </div>
          </Match>
          <Match when={phase() === 'result' ? room.summary() : null}>
            {(summary) => (
              <div class={styles.result} data-testid="long-note-result">
                <div class={styles.timer}>
                  {formatSeconds(summary().inBandSeconds)}
                </div>
                <Show when={summary().steadiness}>
                  {(steadiness) => (
                    <div
                      class={styles.steadiness}
                      data-testid="long-note-steadiness"
                    >
                      Steadiness {Math.round(steadiness())}
                    </div>
                  )}
                </Show>
              </div>
            )}
          </Match>
        </Switch>
        <Show when={room.line() !== '' && phase() !== 'hold' && !demoTake()}>
          <p
            class={styles.bubble}
            aria-live="polite"
            data-testid="long-note-line"
          >
            {room.line()}
          </p>
        </Show>
      </div>

      <div ref={stageEl} class={styles.stage} data-testid="long-note-stage">
        <div
          class={lineClass(styles.band)}
          style={{ top: `${lineY() - band()}px`, height: `${2 * band()}px` }}
        />
        <Show when={room.noteName() !== ''}>
          <button
            type="button"
            class={styles.noteTag}
            style={{ top: `${lineY()}px` }}
            onClick={() => room.hearNote()}
            aria-label={`Hear ${room.noteName()}`}
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
          />
          {/* He celebrates beside the lantern: his stars go on his far side. */}
          <MercView
            class={hopping() ? `${styles.merc} ${styles.mercHop}` : styles.merc}
            state={room.mercState}
            voice={room.mercVoice}
            sparkles="right"
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
            still={() => demo.still && room.script.active()}
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
        />
        <Show when={demo.canAsk()}>
          <button
            type="button"
            class={styles.ask}
            onClick={() => demo.ask()}
            aria-label={DEMO_COPY.ask}
            data-testid="long-note-ask"
          >
            <HelpCircle size={22} />
          </button>
        </Show>
        <Show when={demo.mode() === 'playing'}>
          <button
            type="button"
            class={styles.skip}
            onClick={() => demo.skip()}
            data-testid="long-note-demo-skip"
          >
            {DEMO_COPY.skip}
          </button>
        </Show>
      </div>

      <div
        class={styles.bottom}
        classList={{
          [styles.bottomAway]: demo.mode() === 'card' || demo.mode() === 'end',
        }}
        inert={demoBusy()}
      >
        <Switch>
          <Match when={phase() === 'result' && !room.script.active()}>
            <div class={styles.actions}>
              <button
                type="button"
                class={styles.again}
                onClick={() => room.again()}
                data-testid="long-note-again"
              >
                Again
              </button>
              <button
                type="button"
                class={styles.done}
                onClick={() => props.onDone()}
                data-testid="long-note-done"
              >
                Done
              </button>
            </div>
            <button
              type="button"
              class={styles.textButton}
              onClick={() => room.changeNote()}
            >
              Pick another note
            </button>
          </Match>
          <Match when={phase() === 'blocked'}>
            <p class={styles.blocked} role="alert">
              {room.state().block === 'denied'
                ? 'Merc needs the microphone to hear your note. Allow it in Settings, then try again.'
                : 'The microphone did not open. Check that no other app is using it, then try again.'}
            </p>
            <div class={styles.actions}>
              <Show
                when={
                  room.state().block === 'denied' &&
                  nativeShellApi()?.openAppSettings
                }
              >
                {(open) => (
                  <button
                    type="button"
                    class={styles.again}
                    onClick={() => void open()()}
                  >
                    Open Settings
                  </button>
                )}
              </Show>
              <button
                type="button"
                class={styles.done}
                onClick={() => room.start()}
              >
                Try again
              </button>
            </div>
          </Match>
          <Match when={phase() !== 'result' || room.script.active()}>
            {/* The picker keeps its place once the take starts, so the mic
                button stays under the finger that pressed it. The demo's
                take pill stands in it while the demo sings. */}
            <Show when={room.script.active()}>
              <div class={styles.takeSlot}>
                <Show when={demo.take()}>
                  {(take) => (
                    <span
                      class={styles.take}
                      data-take={take()}
                      data-testid="long-note-demo-take"
                    >
                      {take() === 'off' ? <X /> : <CheckSmall size={16} />}
                      {take() === 'off' ? DEMO_COPY.off : DEMO_COPY.on}
                    </span>
                  )}
                </Show>
              </div>
            </Show>
            <div
              class={styles.picker}
              classList={{
                [styles.pickerAway]: phase() !== 'intro',
                [styles.pickerOut]: room.script.active(),
              }}
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
            <button
              type="button"
              class={styles.mic}
              classList={{
                [styles.micListening]:
                  (phase() === 'listen' || phase() === 'hold') &&
                  !room.script.active(),
                [styles.micDemo]: room.script.active(),
                [styles.micPulse]: demo.micPulse(),
              }}
              disabled={phase() === 'starting'}
              aria-label={micLabel()}
              onClick={() => {
                if (phase() === 'listen' || phase() === 'hold') room.stop()
                else room.start()
              }}
              data-testid="long-note-mic"
            >
              <Mic />
            </button>
          </Match>
        </Switch>
      </div>
      <LongNoteDemoLayer demo={demo} room={room} />
    </div>
  )
}
