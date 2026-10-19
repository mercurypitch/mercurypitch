// ============================================================
// LineView: the sung line on screen (S7b beat 8)
// ============================================================
//
// Top to bottom: Merc's line in a bubble; Merc, a little smaller than on
// the beats before, since the line wants the room; the lane, its ten notes
// as bars at their pitches and times, a cursor running over them, and the
// singer's voice drawn across them in the turn; the words, lighting as the
// cursor reaches them; and, once it is scored, the chip: "8 of 10 notes on
// pitch". The foot holds the mic, its notice when it would not open, or
// Continue and Once more once the line is scored. The controller
// (useLine.ts) decides; this draws.
//
// On Merc's call the bars light in his colour as he sings them; in the
// singer's turn they light as the cursor passes, and the score marks each
// one hit (teal) or missed (dashed). The count-in is the cursor's run in
// from the lane's lead, two beats before the first note.
//
// Merc's line is read out by the layer's one live region (lineSaysText);
// the bubble is hidden from a screen reader so it is not read twice. The
// lane is a picture of what the words and the chip say, so it is hidden
// too, and Merc is decorative (MercView is aria-hidden).

import type { JSX } from 'solid-js'
import { createMemo, For, Match, Show, Switch } from 'solid-js'
import { micLabel as kitMicLabel } from '@/components/room-kit/mic-state'
import { MicBlocked, MicButton } from '@/components/room-kit/RoomControls'
import { LockIcon } from '../shell/icons'
import { lineFacts } from './line-score'
import line from './LineView.module.css'
import styles from './NativeOnboarding.module.css'
import { lineScoreText, lineVerdict, ONBOARDING_COPY } from './onboarding-copy'
import { LINE, LINE_SEC, LINE_SPAN, LINE_WORDS } from './sung-line'
import type { LineController, TracePoint } from './useLine'

/** The lane's lead before the first note, s: the count-in runs in from it. */
export const LEAD_IN_SEC = 1
/** The lane's room after the last note, s. */
const TAIL_SEC = 0.3
/** Semitones of room under the tonic and over the top note. */
const PAD = 2

export interface LineViewProps {
  controller: LineController
  /** Merc's line in the bubble (lineSaysText), or null for none. */
  line: string | null
  /** Continue: beat 9, or the Sing room. */
  onContinue: () => void
  /** Continue was tapped and what follows is being decided. */
  continuing: boolean
  /** Merc: the layer's own view of him. */
  merc: JSX.Element
}

/** What Merc says on the line, for the bubble and the live region. */
export function lineSaysText(controller: LineController): string | null {
  switch (controller.says()) {
    case null:
      return null
    case 'ask':
      return ONBOARDING_COPY.lineAsk
    case 'turn':
      return ONBOARDING_COPY.yourTurn
    case 'unheard':
      return ONBOARDING_COPY.lineUnheard
    case 'verdict': {
      const score = controller.state().score
      return score === null ? null : lineVerdict(lineFacts(score))
    }
  }
}

/** The lane's height, semitones: the line and PAD over and under it. */
const HEIGHT = LINE_SPAN + 2 * PAD

/**
 * The voice's strokes, as polyline points in the lane's own units: seconds
 * across, semitones down from `top`, kept just inside the lane. The trace
 * starts with the whole count-in and runs on past the line: only what falls
 * inside the lane is drawn.
 */
function strokes(points: readonly TracePoint[], top: number): string[] {
  const out: string[] = []
  let current: string[] = []
  for (const point of points) {
    if (point.at < -LEAD_IN_SEC || point.at > LINE_SEC + TAIL_SEC) continue
    if (point.fresh && current.length > 0) {
      out.push(current.join(' '))
      current = []
    }
    const y = Math.min(HEIGHT - 0.3, Math.max(0.3, top - point.midi))
    current.push(`${point.at.toFixed(3)},${y.toFixed(3)}`)
  }
  if (current.length > 0) out.push(current.join(' '))
  return out
}

export function LineView(props: LineViewProps): JSX.Element {
  const phase = () => props.controller.state().phase
  const cursor = () => props.controller.cursor()
  const score = () => props.controller.state().score
  /** The lane's top, MIDI: PAD over the line's highest note. */
  const top = () => props.controller.tonic() + LINE_SPAN + PAD
  const width = LEAD_IN_SEC + LINE_SEC + TAIL_SEC

  /** Each note: passed on this pass, and its verdict once scored. */
  const bars = createMemo(() =>
    LINE.map((note, index) => {
      const now = cursor()
      const verdict = score()?.notes[index] ?? null
      return {
        x1: note.at + 0.06,
        x2: note.at + note.seconds - 0.1,
        y: top() - (props.controller.tonic() + note.degree),
        passed: now !== null && now.at >= note.at,
        pass: now?.pass ?? null,
        hit: verdict?.hit ?? null,
      }
    }),
  )

  /** A word is lit once the cursor reaches its first note, and all once scored. */
  const lit = (word: number): boolean => {
    if (phase() === 'done') return true
    const now = cursor()
    const first = LINE.find((note) => note.word === word)
    return now !== null && first !== undefined && now.at >= first.at
  }

  const cursorAt = (): number | null => {
    const now = cursor()
    if (now === null) return null
    const x = (now.at + LEAD_IN_SEC) / width
    return Math.min(1, Math.max(0, x)) * 100
  }

  const micLabel = (): string => {
    switch (phase()) {
      case 'starting':
        return ONBOARDING_COPY.opening
      case 'call':
        return kitMicLabel('wait', ONBOARDING_COPY.singLine)
      case 'turn':
        return ONBOARDING_COPY.listening
      default:
        return ONBOARDING_COPY.singLine
    }
  }

  return (
    <div
      class={styles.beat}
      data-phase={phase()}
      data-testid="onboarding-sung-line"
    >
      <div class={styles.stage}>
        <div class={styles.bubbleRow}>
          <Show when={props.line}>
            {(text) => (
              <p
                class={styles.bubble}
                aria-hidden="true"
                data-testid="onboarding-line"
              >
                {text()}
              </p>
            )}
          </Show>
        </div>

        <div class={`${styles.merc} ${line.merc}`}>{props.merc}</div>

        <div
          class={line.lane}
          classList={{ [line.still]: props.controller.still() }}
          aria-hidden="true"
          data-testid="onboarding-sung-lane"
        >
          <svg
            class={line.svg}
            viewBox={`${-LEAD_IN_SEC} 0 ${width} ${HEIGHT}`}
            preserveAspectRatio="none"
          >
            <For each={bars()}>
              {(bar, index) => (
                <line
                  class={line.bar}
                  classList={{
                    [line.barCall]: bar.passed && bar.pass === 'call',
                    [line.barTurn]: bar.passed && bar.pass === 'turn',
                    [line.barHit]: bar.hit === true,
                    [line.barMiss]: bar.hit === false,
                  }}
                  x1={bar.x1}
                  x2={bar.x2}
                  y1={bar.y}
                  y2={bar.y}
                  data-note={index()}
                  data-pass={bar.passed ? (bar.pass ?? undefined) : undefined}
                  data-hit={
                    bar.hit === null ? undefined : bar.hit ? 'on' : 'off'
                  }
                />
              )}
            </For>
            <For each={strokes(props.controller.trace(), top())}>
              {(points) => <polyline class={line.trace} points={points} />}
            </For>
          </svg>
          <Show when={cursorAt()}>
            {(x) => (
              <span
                class={line.cursor}
                classList={{ [line.cursorCall]: cursor()?.pass === 'call' }}
                style={{ left: `${x()}%` }}
              />
            )}
          </Show>
        </div>

        <p class={line.words} data-testid="onboarding-sung-words">
          <For each={LINE_WORDS}>
            {(word, index) => (
              <>
                <span classList={{ [line.lit]: lit(index()) }}>
                  {word}
                </span>{' '}
              </>
            )}
          </For>
        </p>

        {/* Held in the flow, so nothing moves when the score arrives. */}
        <p
          class={line.score}
          classList={{ [styles.away]: score() === null }}
          data-shown={score() === null ? 'off' : 'on'}
          data-testid="onboarding-sung-score"
        >
          {score() === null
            ? lineScoreText(0, LINE.length)
            : lineScoreText(score()?.hit ?? 0, score()?.total ?? LINE.length)}
        </p>
      </div>

      <div class={styles.foot}>
        <Switch>
          <Match when={phase() === 'done'}>
            <div class={styles.ways}>
              <button
                type="button"
                class={styles.primary}
                disabled={props.continuing}
                aria-busy={props.continuing ? 'true' : undefined}
                onClick={() => props.onContinue()}
                data-testid="onboarding-continue"
              >
                {ONBOARDING_COPY.continue}
              </button>
              <button
                type="button"
                class={styles.secondary}
                disabled={props.continuing}
                onClick={() => props.controller.again()}
                data-testid="onboarding-sung-again"
              >
                {ONBOARDING_COPY.again}
              </button>
            </div>
          </Match>
          <Match when={phase() === 'blocked'}>
            <MicBlocked
              block={props.controller.state().block}
              onRetry={() => props.controller.again()}
              retryTestId="onboarding-retry"
            />
          </Match>
          <Match when={true}>
            <div class={styles.micWell}>
              <MicButton
                state={props.controller.micState()}
                level={props.controller.level}
                pulse={false}
                still={props.controller.still()}
                disabled={false}
                label={micLabel()}
                onClick={() => props.controller.tapMic()}
                testId="onboarding-mic"
              />
            </div>
            <p class={styles.caption} aria-hidden="true">
              {micLabel()}
            </p>
            <div class={styles.slot}>
              <p
                class={styles.fine}
                classList={{ [styles.away]: phase() !== 'ready' }}
              >
                {ONBOARDING_COPY.lineHow}
              </p>
            </div>
          </Match>
        </Switch>
        <p class={styles.promise}>
          <LockIcon size={14} /> {ONBOARDING_COPY.private}
        </p>
      </div>
    </div>
  )
}
