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
//            Merc floating on it inside the glass, a big timer and one chip
//   result   the lantern topped up, the seconds and the steadiness, Merc
//            out of the glass again, Again and Done
//
// Merc's canvas sits BETWEEN the lantern's two layers (Lantern.tsx), so in
// the glass he is behind its highlights and frame, and his feet are in the
// liquid. Everything is placed from one measurement of the stage
// (`layoutStage`), in the lantern's own view-box units.

import type { JSX } from 'solid-js'
import { createEffect, createMemo, createSignal, Match, on, onCleanup, onMount, Show, Switch, } from 'solid-js'
import { Mic, Minus, Plus, Volume2 } from '@/components/icons'
import { nativeShellApi } from '@/stores/native-shell-store'
import { LanternBack, LanternFront } from './Lantern'
import { LANTERN_VIEW_H, LANTERN_VIEW_W, surfaceY, TARGET_LINE_Y, } from './lantern-geometry'
import styles from './LongNoteRoom.module.css'
import { MercView } from './MercView'
import { useLongNoteController } from './useLongNoteController'
import { VoiceTrace } from './VoiceTrace'

export interface LongNoteRoomProps {
  /** Leave the room (Done). */
  onDone: () => void
}

// ── Where things go, in lantern view-box units ─────────────────

/** Merc's canvas, square, at full size (standing beside the lantern). */
const MERC_UNITS = 210
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
/** Beside the lantern: his centre, and the ground under the lantern's foot. */
const BESIDE_X = 230
const GROUND_Y = 370
/** The width the lantern and Merc beside it need, from the lantern's left. */
const LAYOUT_W = 372
/** How far his feet sink into the liquid. */
const FLOAT_SINK = 5
/** The chimney's left edge where the target line crosses it. */
const CHIMNEY_LEFT_AT_LINE = 47

interface StageLayout {
  /** px per view-box unit. */
  k: number
  /** The lantern box's offset in the stage, px. */
  left: number
  top: number
}

function layoutStage(width: number, height: number): StageLayout {
  const k = Math.max(
    0.2,
    Math.min((height * 0.96) / LANTERN_VIEW_H, (width - 24) / (LAYOUT_W - 28)),
  )
  // The lantern is centred; Merc beside it uses the room to its right.
  const left = width / 2 - (LANTERN_VIEW_W / 2) * k
  const top = height - LANTERN_VIEW_H * k
  return { k, left, top }
}

function formatSeconds(seconds: number): string {
  return `${(Math.floor(seconds * 10) / 10).toFixed(1)} s`
}

export function LongNoteRoom(props: LongNoteRoomProps): JSX.Element {
  const room = useLongNoteController()
  let stageEl: HTMLDivElement | undefined
  const [layout, setLayout] = createSignal<StageLayout>({
    k: 1,
    left: 0,
    top: 0,
  })

  onMount(() => {
    const measure = (): void => {
      if (stageEl === undefined) return
      setLayout(layoutStage(stageEl.clientWidth, stageEl.clientHeight))
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
    const feetY = inside ? surfaceY(room.lanternLevel()) + FLOAT_SINK : GROUND_Y
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
    return left + CHIMNEY_LEFT_AT_LINE * k
  }

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
    <div class={styles.room} data-phase={phase()} data-testid="long-note-room">
      <div class={styles.top}>
        <Switch>
          <Match when={phase() === 'hold'}>
            <div class={styles.timer} data-testid="long-note-timer">
              {formatSeconds(room.hold().inBandSeconds)}
            </div>
            <div class={styles.chipRow} aria-live="polite">
              <Show when={room.chip()}>
                {(text) => <span class={styles.chip}>{text()}</span>}
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
                    <div class={styles.steadiness}>
                      Steadiness {Math.round(steadiness())}
                    </div>
                  )}
                </Show>
              </div>
            )}
          </Match>
        </Switch>
        <Show when={room.line() !== '' && phase() !== 'hold'}>
          <p class={styles.bubble} aria-live="polite">
            {room.line()}
          </p>
        </Show>
      </div>

      <div ref={stageEl} class={styles.stage}>
        <VoiceTrace
          class={styles.trace}
          trace={room.trace}
          now={room.now}
          lineY={lineY}
          anchorX={anchorX}
          toleranceCents={room.toleranceCents}
          active={() => phase() === 'listen' || phase() === 'hold'}
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
            shining={room.shining}
          />
          <MercView
            class={hopping() ? `${styles.merc} ${styles.mercHop}` : styles.merc}
            state={room.mercState}
            voice={room.mercVoice}
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
            shining={() => room.shining() && phase() === 'result'}
          />
        </div>
      </div>

      <div class={styles.bottom}>
        <Switch>
          <Match when={phase() === 'result'}>
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
          <Match when={phase() !== 'result'}>
            {/* The picker keeps its place once the take starts, so the mic
                button stays under the finger that pressed it. */}
            <div
              class={styles.picker}
              classList={{ [styles.pickerAway]: phase() !== 'intro' }}
              aria-label="The note to hold"
              aria-hidden={phase() !== 'intro'}
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
                  phase() === 'listen' || phase() === 'hold',
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
    </div>
  )
}
