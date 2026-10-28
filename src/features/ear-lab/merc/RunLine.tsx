// ============================================================
// The run line: where the run is, under the room's header. A staircase
// says its level and about how many questions are left, with the trace
// of the way it came; a rated run counts its rounds in neutral dots
// that fill as rounds pass and never say right or wrong; a calibration
// says its track. It counts, and the plate judges.
// ============================================================

import type { JSX } from 'solid-js'
import { For, Match, Switch } from 'solid-js'
import type { RoomRunLine, TracePoint } from '@/features/ear-lab/stage-room'
import styles from './room.module.css'

const TRACE_W = 72
const TRACE_H = 20

/** The staircase as a polyline, newest at the right, turns marked. */
function tracePoints(trace: readonly TracePoint[]): {
  line: string
  turns: Array<{ x: number; y: number }>
} {
  const shown = trace.slice(-16)
  if (shown.length === 0) return { line: '', turns: [] }
  const levels = shown.map((point) => Math.log(Math.max(point.level, 1e-3)))
  const lo = Math.min(...levels)
  const hi = Math.max(...levels)
  const span = hi - lo || 1
  const step = shown.length > 1 ? (TRACE_W - 4) / (shown.length - 1) : 0
  const coords = shown.map((point, i) => ({
    x: 2 + i * step,
    y: 2 + (1 - (levels[i] - lo) / span) * (TRACE_H - 4),
    turn: point.turn,
  }))
  return {
    line: coords.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' '),
    turns: coords.filter((c) => c.turn),
  }
}

function traceWords(trace: readonly TracePoint[]): string {
  const turns = trace.filter((point) => point.turn).length
  if (trace.length === 0) return 'The staircase has not moved yet'
  return `The staircase so far: ${trace.length} answers, ${turns} turn${
    turns === 1 ? '' : 's'
  }`
}

type LineOf<K extends RoomRunLine['kind']> = Extract<RoomRunLine, { kind: K }>

export function RunLine(props: { line: RoomRunLine }): JSX.Element {
  const threshold = (): LineOf<'threshold'> | null =>
    props.line.kind === 'threshold' ? props.line : null
  const calibration = (): LineOf<'calibration'> | null =>
    props.line.kind === 'calibration' ? props.line : null
  const rounds = (): LineOf<'rounds'> | null =>
    props.line.kind === 'rounds' ? props.line : null
  return (
    <div class={styles.runLine} data-testid="merc-run-line">
      <Switch>
        <Match when={threshold()}>
          {(line) => {
            const trace = () => tracePoints(line().trace)
            return (
              <div class={styles.pill}>
                <span class={styles.level}>{line().level}</span>
                <span class={styles.left}>about {line().left} left</span>
                <svg
                  class={styles.trace}
                  width={TRACE_W}
                  height={TRACE_H}
                  viewBox={`0 0 ${TRACE_W} ${TRACE_H}`}
                  role="img"
                  aria-label={traceWords(line().trace)}
                >
                  <polyline
                    points={trace().line}
                    fill="none"
                    stroke="#c5ced8"
                    stroke-width="1.4"
                    stroke-linejoin="round"
                  />
                  <For each={trace().turns}>
                    {(turn) => (
                      <circle cx={turn.x} cy={turn.y} r="2.2" fill="#e7c67d" />
                    )}
                  </For>
                </svg>
              </div>
            )
          }}
        </Match>
        <Match when={calibration()}>
          {(line) => (
            <div class={styles.pill}>
              <span class={styles.level}>
                Track {line().track} of {line().tracks}
              </span>
              <span class={styles.left}>about {line().left} left</span>
            </div>
          )}
        </Match>
        <Match when={rounds()}>
          {(line) => (
            <div class={styles.pill}>
              <span class={styles.left}>
                <b>
                  {line().noun ?? 'Round'} {line().round} of {line().total}
                </b>
              </span>
              <span
                class={styles.dots}
                role="img"
                aria-label={`${line().answered} of ${line().total} answered`}
              >
                <For each={Array.from({ length: line().total }, (_, i) => i)}>
                  {(i) => (
                    <span
                      class={styles.dot}
                      classList={{
                        [styles.dotAnswered]: i < line().answered,
                        [styles.dotNow]: i === line().round - 1,
                      }}
                    />
                  )}
                </For>
              </span>
              {line().extra === undefined ? null : (
                <span class={styles.left}>{line().extra}</span>
              )}
            </div>
          )}
        </Match>
      </Switch>
    </div>
  )
}
