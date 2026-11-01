// ============================================================
// Leap's lamp under the chip, and its result with a row a leap
// ============================================================
//
// The lamp names the leap being sung ("Up a fifth") in the lighthouse's
// warm light Home note's lamps have: an outline while Merc calls it and the
// singer sings it, lit once it lands, a dashed ring once it is missed.
//
// The result: leaps landed out of the run's, how quickly, at which level,
// and under them the leaps the run asked for, one row each (leap-run.ts
// leapRows), with the song that opens on it and a lamp a try. A row is a
// button: Merc sings that leap's two notes again (its first missed try's,
// else its last).

import type { JSX } from 'solid-js'
import { createUniqueId, For, Show } from 'solid-js'
import { ResultCard } from '@/components/room-kit/RoomHeader'
import type { RoundOutcome } from './leap-machine'
import type { LeapLevel } from './leap-rules'
import type { LeapRow, LeapSummary } from './leap-run'
import { detailLine, leapRows } from './leap-run'
import styles from './LeapResult.module.css'
import type { LeapLampView } from './useLeapController'

/** An arrow up or down, for the leap's way. */
function WayArrow(props: { up: boolean }): JSX.Element {
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
      <path d={props.up ? 'M12 19V5M6 11l6-6 6 6' : 'M12 5v14M6 13l6 6 6-6'} />
    </svg>
  )
}

const LAMP_SAID: Record<LeapLampView['state'], string> = {
  toCome: 'to sing',
  landed: 'landed',
  missed: 'missed',
}

/** The leap being sung, as a lamp under the chip. */
export function LeapLamp(props: { lamp: LeapLampView }): JSX.Element {
  return (
    <p
      class={styles.lamp}
      data-lamp={props.lamp.state}
      role="img"
      aria-label={`The leap: ${props.lamp.name.toLowerCase()}, ${LAMP_SAID[props.lamp.state]}`}
      data-testid="leap-lamp"
    >
      <WayArrow up={props.lamp.up} />
      {props.lamp.name}
    </p>
  )
}

/** The round a row plays again: its first missed try's, else its last. */
export function rowReplay(row: LeapRow): number {
  const missed = row.tries.find((t) => !t.landed)
  const last = row.tries[row.tries.length - 1]
  return (missed ?? last).round.index
}

/** A row's words for a screen reader, with what its tap does. */
function rowLabel(row: LeapRow): string {
  const song = row.song === null ? '' : `, ${row.song.title}`
  return `${row.name}${song}, ${row.landed} of ${row.tries.length} landed. Hear it again`
}

export interface LeapResultProps {
  summary: LeapSummary
  level: string
  /** The run's rules: how its leaps are named, and whether with songs. */
  rules: LeapLevel
  outcomes: readonly RoundOutcome[]
  /** The round heard again now, by its index; null for none. */
  playing: number | null
  /** Hear round `index` again. */
  onPlay: (index: number) => void
}

/** The result: leaps landed, how quickly, at which level, and each leap. */
export function LeapResult(props: LeapResultProps): JSX.Element {
  const headingId = `leap-rows-${createUniqueId()}`
  const rows = () => leapRows(props.outcomes, props.rules)
  return (
    <div class={styles.result}>
      <ResultCard
        value={`${props.summary.landed} of ${props.summary.rounds}`}
        detail={detailLine(props.summary)}
        testId="leap-result"
        detailTestId="leap-detail"
      />
      <Show when={props.level !== ''}>
        <p class={styles.levelNote} data-testid="leap-result-level">
          Leaps landed at {props.level}
        </p>
      </Show>
      <Show when={rows().length > 0}>
        <section
          class={styles.card}
          aria-labelledby={headingId}
          data-testid="leap-rows"
        >
          <div class={styles.cardHead}>
            <h2 id={headingId} class={styles.cardTitle}>
              By leap
            </h2>
            <span class={styles.cardHint}>Tap one to hear it</span>
          </div>
          <ul class={styles.rows}>
            <For each={rows()}>
              {(row) => (
                <li>
                  <button
                    type="button"
                    class={styles.row}
                    data-playing={
                      row.tries.some((t) => t.round.index === props.playing)
                        ? 'true'
                        : 'false'
                    }
                    data-song={row.song === null ? 'none' : 'named'}
                    aria-label={rowLabel(row)}
                    data-testid="leap-row"
                    onClick={() => props.onPlay(rowReplay(row))}
                  >
                    <span class={styles.rowText}>
                      <span class={styles.rowName}>{row.name}</span>
                      <Show when={row.song}>
                        {(song) => (
                          <span class={styles.rowSong}>{song().title}</span>
                        )}
                      </Show>
                    </span>
                    <span class={styles.tries} aria-hidden="true">
                      <For each={row.tries}>
                        {(attempt) => (
                          <span
                            class={styles.try}
                            data-landed={attempt.landed ? 'true' : 'false'}
                          />
                        )}
                      </For>
                    </span>
                    <span
                      class={styles.count}
                      data-all={
                        row.landed === row.tries.length ? 'true' : 'false'
                      }
                    >
                      {row.landed} of {row.tries.length}
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
