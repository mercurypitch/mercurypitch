// ============================================================
// StageScene — the theatre, the note's line, the trail, the countdown
// ============================================================
//
// First note's world is the Karaoke room's theatre (the native app's
// Broadway Theater, /karaoke/broadway-theater-portrait.webp): the curtain,
// the boards, the old microphone at the left. Over it, the exercise:
//
//   the line    the entry's note, a band of light across the curtain at the
//               round's own height, the level's tolerance wide. It shows
//               when the level says (first-note-rules.ts): from the start,
//               once the singer has come in, or once the voice has landed
//   the trail   the voice, drawn every frame of the turn by the
//               controller's sink (room-kit voice-trail.ts), gold while it
//               is in the band
//   countdown   while the band leads in: how far to the entry, and its last
//               four beats lighting one by one
//
// The trail is drawn every frame of the turn, so it is not a signal: the
// room hands its path and head to the controller's sink, which writes them
// directly. Placed from one measurement (first-note-layout.ts).

import type { JSX } from 'solid-js'
import { For, onMount, Show } from 'solid-js'
import type { StageLayout } from './first-note-layout'
import styles from './StageScene.module.css'
import type { Countdown } from './useFirstNoteController'

/** The theatre, as the native app ships it. */
export const THEATRE_ART = '/karaoke/broadway-theater-portrait.webp'

export interface StageSceneProps {
  layout: StageLayout
  /** The tolerance band's half-height, px. */
  bandHalf: number
  /** The note's line shows. */
  lineShown: boolean
  /** The singer's turn: the trail may show. */
  turn: boolean
  /** The voice is in the note's band, or the round has landed. */
  lit: boolean
  /** The lead-in's countdown, while the band plays. */
  countdown: Countdown | null
  /** The trail's path and head, for the controller's sink to write. */
  trailRef: (path: SVGPathElement, head: SVGCircleElement) => void
  /** The theatre's picture; THEATRE_ART by default. */
  art?: string
  /** Nothing moves (reduced motion, the fixtures). */
  still?: boolean
}

export function StageScene(props: StageSceneProps): JSX.Element {
  let trailEl: SVGPathElement | undefined
  let headEl: SVGCircleElement | undefined
  onMount(() => {
    if (trailEl !== undefined && headEl !== undefined) {
      props.trailRef(trailEl, headEl)
    }
  })
  const L = () => props.layout
  const beats = (): boolean[] => {
    const countdown = props.countdown
    if (countdown === null) return []
    return Array.from({ length: countdown.beats }, (_, i) => i < countdown.lit)
  }

  return (
    <div
      class={styles.scene}
      classList={{
        [styles.turn]: props.turn,
        [styles.lit]: props.lit,
        [styles.lineOn]: props.lineShown,
        [styles.still]: props.still === true,
      }}
      data-line={props.lineShown ? 'shown' : 'hidden'}
      data-testid="first-note-scene"
    >
      <img
        class={styles.art}
        src={props.art ?? THEATRE_ART}
        alt=""
        aria-hidden="true"
        draggable={false}
      />
      <div class={styles.shade} aria-hidden="true" />

      {/* The exercise: the note's band and line, the trail. */}
      <svg
        class={styles.overlay}
        width={L().width}
        height={L().height}
        viewBox={`0 0 ${L().width} ${L().height}`}
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="first-note-band" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stop-color="#ffd678" stop-opacity="0.15" />
            <stop offset="0.5" stop-color="#ffd678" stop-opacity="1" />
            <stop offset="1" stop-color="#ffd678" stop-opacity="0.15" />
          </linearGradient>
          {/* In user space: a level line has no height, and a gradient on
              its bounding box would paint nothing. */}
          <linearGradient
            id="first-note-line"
            gradientUnits="userSpaceOnUse"
            x1={0}
            y1={0}
            x2={L().width}
            y2={0}
          >
            <stop offset="0" stop-color="#ffe29a" stop-opacity="0.1" />
            <stop offset="0.5" stop-color="#ffe29a" stop-opacity="0.95" />
            <stop offset="1" stop-color="#ffe29a" stop-opacity="0.1" />
          </linearGradient>
        </defs>
        <rect
          x={0}
          y={L().lineY - props.bandHalf}
          width={L().width}
          height={props.bandHalf * 2}
          class={styles.band}
          fill="url(#first-note-band)"
          data-testid="first-note-band"
        />
        <line
          x1={0}
          y1={L().lineY}
          x2={L().width}
          y2={L().lineY}
          class={styles.line}
          stroke="url(#first-note-line)"
          data-testid="first-note-line"
        />
        <path ref={trailEl} class={styles.trail} d="" />
        <circle ref={headEl} class={styles.head} r={6} cx={-20} cy={-20} />
      </svg>

      <Show when={props.countdown}>
        {(countdown) => (
          <div
            class={styles.countdown}
            aria-hidden="true"
            data-testid="first-note-countdown"
          >
            <div class={styles.track}>
              <div
                class={styles.fill}
                style={{ transform: `scaleX(${countdown().progress})` }}
              />
              <span class={styles.mark} />
            </div>
            <Show when={countdown().beats > 0}>
              <ol class={styles.beats}>
                <For each={beats()}>
                  {(lit) => (
                    <li
                      class={styles.beat}
                      classList={{ [styles.beatLit]: lit }}
                      data-lit={lit ? 'true' : 'false'}
                    />
                  )}
                </For>
              </ol>
            </Show>
          </div>
        )}
      </Show>
    </div>
  )
}
