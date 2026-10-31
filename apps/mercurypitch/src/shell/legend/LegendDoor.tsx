// ============================================================
// LegendDoor — the running Legend, before a take
// ============================================================
//
// The door of the Legend room (LegendRoom.tsx): a chip with the line's
// notes over the line drawn as a poster that lights as it plays
// (LegendPoster.tsx), its close, title and description, Hear the line and
// the original, what it asks for, the Founder's score and the singer's best
// as tiles, the counts, the board, and the past Legends to practise. Sing
// it and Practice are the room's own dock, over the door's foot.

import type { JSX } from 'solid-js'
import { createMemo, For, Show } from 'solid-js'
import { challengeToZenExercise } from '@/features/challenges/challenge-stage-model'
import type { ArchivedWeeklyChallenge, WeeklyBoard, WeeklyChallenge, } from '@/features/challenges/weekly-service'
import { podiumOf } from '@/features/challenges/weekly-service'
import { getComfortableMidiRange } from '@/lib/vocal-range'
import { vocalRangePreset } from '@/stores/settings-store'
import { CalendarIcon, ExternalIcon, PlayIcon, StopIcon, WarnIcon, } from '../icons'
import { posterView } from './legend-lane'
import { closesLine, countsLine, endedLine, notesLine, rangeLine, rangeSide, standingLine, } from './legend-lines'
import type { LegendTake } from './legend-take'
import { LegendPoster } from './LegendPoster'

/** The door's poster, drawn to scale (its viewBox). */
const POSTER_BOX = { width: 390, height: 230 }

/** The line's notes, at their written pitch, as the poster draws them. */
function posterLine(picked: WeeklyChallenge) {
  const definition = challengeToZenExercise({
    id: picked.id,
    title: picked.title,
    targetItems: picked.targetItems,
  })
  if (definition === null) return []
  return definition.targets.map((target) => ({
    startBeat: target.startBeat,
    durationBeats: target.durationBeats,
    midi: definition.defaultRootMidi + target.semitone,
  }))
}

export interface DoorProps {
  take: LegendTake
  now: () => number
  running: () => WeeklyChallenge | null
  reading: () => boolean
  unreachable: () => boolean
  onRetry: () => void
  board: () => WeeklyBoard | null
  archive: () => ArchivedWeeklyChallenge[]
}

/** The running Legend, its board, and the past ones. */
export function LegendDoor(props: DoorProps): JSX.Element {
  const range = (): 'above' | 'below' | null => {
    const picked = props.running()
    if (picked === null) return null
    return rangeSide(
      picked.targetItems,
      getComfortableMidiRange(vocalRangePreset()),
    )
  }
  const podium = () => (props.board()?.top ?? []).slice(0, 3)
  const poster = createMemo(() => {
    const picked = props.running()
    return picked === null ? [] : posterLine(picked)
  })

  return (
    <div class="mp-legend-door" data-testid="legend-door">
      <Show when={props.reading() && props.running() === null}>
        <p class="mp-legend-note mp-legend-empty" role="status">
          Loading the Legend
        </p>
      </Show>

      <Show when={!props.reading() && props.unreachable()}>
        <div class="mp-legend-empty">
          <div class="mp-set-note mp-set-note--warn" role="status">
            <WarnIcon size={20} />
            <p>
              <strong>Could not load the Legend.</strong> Check the connection
              and try again.
            </p>
          </div>
          <button
            type="button"
            class="mp-legend-btn mp-legend-btn--line"
            data-testid="legend-retry"
            onClick={() => props.onRetry()}
          >
            Try again
          </button>
        </div>
      </Show>

      <Show
        when={
          !props.reading() && !props.unreachable() && props.running() === null
        }
      >
        <p class="mp-legend-note mp-legend-empty" data-testid="legend-none">
          No Legend is open right now. The next one opens soon.
        </p>
      </Show>

      <Show when={props.running()}>
        {(picked) => (
          <section class="mp-legend-hero" data-testid="legend-hero">
            <Show when={notesLine(poster())}>
              {(line) => (
                <p class="mp-legend-chip" data-testid="legend-chip">
                  {line()}
                </p>
              )}
            </Show>
            <Show when={poster().length > 0}>
              <LegendPoster
                view={posterView(poster(), POSTER_BOX)}
                box={POSTER_BOX}
                sounding={props.take.lineNote}
                summary={`The line: ${notesLine(poster()) ?? ''}`}
              />
            </Show>
            <div class="mp-legend-door__text">
              <p class="mp-legend-door__when">
                <CalendarIcon size={16} />
                <span>{closesLine(picked().endsAt, props.now())}</span>
              </p>
              <h2 class="mp-legend-door__title">{picked().title}</h2>
              <Show when={picked().description}>
                <p class="mp-legend-door__body">{picked().description}</p>
              </Show>
            </div>
            <div class="mp-legend-hear">
              <button
                type="button"
                class="mp-legend-pill"
                data-testid="legend-hear"
                aria-pressed={props.take.linePlaying()}
                onClick={() => props.take.playLine(picked())}
              >
                <Show
                  when={props.take.linePlaying()}
                  fallback={<PlayIcon size={18} />}
                >
                  <StopIcon size={18} />
                </Show>
                {props.take.linePlaying() ? 'Stop the line' : 'Hear the line'}
              </button>
              <Show when={picked().hearItUrl}>
                {(url) => (
                  <a
                    class="mp-legend-orig"
                    href={url()}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Hear the original
                    <ExternalIcon size={17} />
                  </a>
                )}
              </Show>
            </div>
            <Show when={range()}>
              {(side) => (
                <p class="mp-legend-door__range" data-testid="legend-range">
                  {rangeLine(side(), vocalRangePreset())}
                </p>
              )}
            </Show>
            <Tiles picked={picked()} board={props.board()} />
            <Show when={props.board()}>
              {(scores) => (
                <Show when={countsLine(scores())}>
                  {(line) => <p class="mp-legend-door__counts">{line()}</p>}
                </Show>
              )}
            </Show>
          </section>
        )}
      </Show>

      <Show when={props.running() !== null ? props.board() : null}>
        {(scores) => (
          <section class="mp-legend-group" data-testid="legend-board">
            <h3 class="mp-legend-cap">The board</h3>
            <ol class="mp-legend-card mp-legend-podium">
              <For each={podium()}>
                {(entry) => (
                  <li
                    class="mp-legend-podium__row"
                    data-rank={entry.rank}
                    data-founder={entry.isFounder ? 'on' : undefined}
                  >
                    <span class="mp-legend-podium__rank">{entry.rank}</span>
                    <span class="mp-legend-podium__name">
                      {entry.displayName}
                    </span>
                    <span class="mp-legend-podium__score">
                      {Math.round(entry.best)}%
                    </span>
                  </li>
                )}
              </For>
            </ol>
            <Show when={standingLine(scores())}>
              {(line) => (
                <p
                  class="mp-legend-card mp-legend-you"
                  data-testid="legend-you"
                >
                  <span class="mp-legend-tag" aria-hidden="true">
                    You
                  </span>
                  <span class="mp-legend-you__words">{line()}</span>
                </p>
              )}
            </Show>
          </section>
        )}
      </Show>

      <Show when={props.archive().length > 0}>
        <section class="mp-legend-group" data-testid="legend-past">
          <h3 class="mp-legend-cap">Past Legends</h3>
          <ul class="mp-legend-card mp-legend-past">
            <For each={props.archive()}>
              {(past) => (
                <li class="mp-legend-past__row" data-legend-past={past.id}>
                  <div class="mp-legend-past__text">
                    <span class="mp-legend-past__title">{past.title}</span>
                    <span class="mp-legend-past__sub">{endedLine(past)}</span>
                    <Show when={podiumOf(past.results).length > 0}>
                      <span class="mp-legend-past__sub">
                        {podiumOf(past.results)
                          .map(
                            (place) =>
                              `${place.rank} ${place.displayName ?? 'Name withheld'}`,
                          )
                          .join(', ')}
                      </span>
                    </Show>
                  </div>
                  <button
                    type="button"
                    class="mp-legend-pill"
                    data-testid="legend-past-practice"
                    onClick={() => props.take.start(past, 'practice')}
                  >
                    Practice
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

/** What the Legend asks for, the Founder's score, and the singer's best. */
function Tiles(props: {
  picked: WeeklyChallenge
  board: WeeklyBoard | null
}): JSX.Element {
  const best = (): number | null => {
    const you = props.board?.you
    return you === null || you === undefined ? null : Math.round(you.best)
  }
  const count = (): number =>
    1 + (props.picked.founderScore === null ? 0 : 1) + (best() === null ? 0 : 1)
  return (
    <div
      class="mp-legend-tiles"
      style={{ '--tiles': String(count()) }}
      data-testid="legend-tiles"
    >
      <div class="mp-legend-tile">
        <b>{Math.round(props.picked.targetScore)}%</b>
        <span>it asks for</span>
      </div>
      {/* A 0% is a score: drawn, as the count above counts it. */}
      <Show when={props.picked.founderScore !== null}>
        <div class="mp-legend-tile">
          <b>{Math.round(props.picked.founderScore ?? 0)}%</b>
          <span>the Founder</span>
        </div>
      </Show>
      <Show when={best() !== null}>
        <div class="mp-legend-tile" data-you="true">
          <b>{best()}%</b>
          <span>your best</span>
        </div>
      </Show>
    </div>
  )
}
