// ============================================================
// Harmony's task under the chip, and its result with a row a line
// ============================================================
//
// The task names what the line asks ("A third above") in the harmony's
// gold: an outline while Merc calls it and the singer sings it, lit once
// the line is sung in harmony, a dashed ring once a note of it is missed.
//
// The result: lines sung in harmony out of the run's, the notes in them, at
// which level, and under them each line (harmony-run.ts harmonyRows) by its
// harmony's notes, with a lamp a note. A row is a button: Merc sings that
// line again in two voices, his and the harmony, so the singer hears the
// pair together (the room's mock-ups, 1 Nov 2026).

import type { JSX } from 'solid-js'
import { createUniqueId, For, Show } from 'solid-js'
import { ResultCard } from '@/components/room-kit/RoomHeader'
import type { LineOutcome } from './harmony-machine'
import type { HarmonyRow, HarmonySummary } from './harmony-run'
import { detailLine, harmonyRows } from './harmony-run'
import styles from './HarmonyResult.module.css'

/** How the task's lamp stands: to sing, sung in harmony, or a note missed. */
export type HarmonyTaskState = 'toCome' | 'landed' | 'missed'

/** Two notes, a third apart: the task's own mark. */
function ThirdMark(): JSX.Element {
  return (
    <svg
      viewBox="0 0 24 24"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      stroke-width="2.2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path d="M4 17h9M11 8h9" />
      <path d="M7 13l3-3 3 3" />
    </svg>
  )
}

const TASK_SAID: Record<HarmonyTaskState, string> = {
  toCome: 'to sing',
  landed: 'sung in harmony',
  missed: 'a note missed',
}

/** The line's task, as a lamp under the chip. */
export function HarmonyTask(props: {
  name: string
  state: HarmonyTaskState
}): JSX.Element {
  return (
    <p
      class={styles.lamp}
      data-lamp={props.state}
      role="img"
      aria-label={`The task: ${props.name.toLowerCase()}, ${TASK_SAID[props.state]}`}
      data-testid="harmony-task"
    >
      <ThirdMark />
      {props.name}
    </p>
  )
}

/** A row's words for a screen reader, with what its tap does. */
function rowLabel(row: HarmonyRow, playing: boolean): string {
  const how = playing ? 'Playing it in two voices' : 'Hear it in two voices'
  return `${row.label}, ${row.names}, ${row.landed} of ${row.notes.length} in harmony. ${how}`
}

export interface HarmonyResultProps {
  summary: HarmonySummary
  level: string
  outcomes: readonly LineOutcome[]
  /** The line heard again now, by its index; null for none. */
  playing: number | null
  /** Hear line `index` again, in two voices. */
  onPlay: (index: number) => void
  /** The lines' card, for the room to keep Merc's line clear of it. */
  cardRef?: (el: HTMLElement) => void
}

/** The result: lines in harmony, the notes in them, the level, each line. */
export function HarmonyResult(props: HarmonyResultProps): JSX.Element {
  const headingId = `harmony-rows-${createUniqueId()}`
  const rows = () => harmonyRows(props.outcomes)
  return (
    <div class={styles.result}>
      <ResultCard
        value={`${props.summary.inHarmony} of ${props.summary.lines}`}
        detail={detailLine(props.summary)}
        testId="harmony-result"
        detailTestId="harmony-detail"
      />
      <Show when={props.level !== ''}>
        <p class={styles.levelNote} data-testid="harmony-result-level">
          Lines in harmony at {props.level}
        </p>
      </Show>
      <Show when={rows().length > 0}>
        <section
          ref={(el) => props.cardRef?.(el)}
          class={styles.card}
          aria-labelledby={headingId}
          data-testid="harmony-rows"
        >
          <div class={styles.cardHead}>
            <h2 id={headingId} class={styles.cardTitle}>
              By line
            </h2>
            <span class={styles.cardHint}>Tap one for both voices</span>
          </div>
          <ul class={styles.rows}>
            <For each={rows()}>
              {(row, i) => (
                <li>
                  <button
                    type="button"
                    class={styles.row}
                    data-playing={props.playing === i() ? 'true' : 'false'}
                    aria-label={rowLabel(row, props.playing === i())}
                    data-testid="harmony-row"
                    onClick={() => props.onPlay(i())}
                  >
                    <span class={styles.rowText}>
                      <span class={styles.rowName}>{row.label}</span>
                      <span class={styles.rowNotes}>{row.names}</span>
                    </span>
                    <span class={styles.dots} aria-hidden="true">
                      <For each={row.notes}>
                        {(landed) => (
                          <span
                            class={styles.dot}
                            data-landed={landed ? 'true' : 'false'}
                          />
                        )}
                      </For>
                    </span>
                    <span
                      class={styles.count}
                      data-all={
                        row.landed === row.notes.length ? 'true' : 'false'
                      }
                    >
                      {row.landed} of {row.notes.length}
                    </span>
                  </button>
                </li>
              )}
            </For>
          </ul>
        </section>
      </Show>
    </div>
  )
}
