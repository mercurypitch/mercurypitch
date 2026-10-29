// ============================================================
// The room's plates: what a finished run reads, engraved.
//
//   - A staircase's reading: the number in its unit and which way is
//     better, what it means, against the last reading, how many
//     questions, turns and replays, Practice or a short run's
//     Provisional, and no letter grade.
//   - A rated run's rating: the number, "higher is surer", its move
//     against the rating the run found, rounds and names, the dots of
//     the run in order, and where it slipped, as counts. A slip between
//     two of the drill's items offers a pair practice on them.
//   - A pair practice's tally: the rounds named right, the two it was
//     on, and the rating it left alone.
//   - A calibration's seal: the Mercury Index, its move from the last
//     seal, the three tracks, and the glass with the mercury rising to
//     the new mark and the old one left faint.
// ============================================================

import type { JSX } from 'solid-js'
import { For, Match, Show, Switch } from 'solid-js'
import { dateLabel } from '@/features/ear-lab/instruments'
import type { PlateSlip, PracticePlate, RatingPlate, RoomPlate, ThresholdPlate, } from '@/features/ear-lab/stage-room'
import { calibrationHistory } from '@/stores/ear-lab-store'
import { Glass, practiceEstimate } from './Glass'
import { comparedLine, directionWord, INDEX_MEANING, MEANING, practiseLabel, ratingMoveLine, roundsLine, SEALED_SMALL_PRINT, sealedMoveLine, staircaseStats, timesWord, tracksLine, untouchedLine, } from './merc-lines'
import styles from './plate.module.css'
import roomStyles from './room.module.css'

function Screws(): JSX.Element {
  return (
    <>
      <span class={`${styles.screw} ${styles.screwTl}`} aria-hidden="true" />
      <span class={`${styles.screw} ${styles.screwTr}`} aria-hidden="true" />
      <span class={`${styles.screw} ${styles.screwBl}`} aria-hidden="true" />
      <span class={`${styles.screw} ${styles.screwBr}`} aria-hidden="true" />
    </>
  )
}

export function ThresholdPlateView(props: {
  plate: ThresholdPlate
  drillId: string
  short: boolean
}): JSX.Element {
  const value = () => props.plate.value
  const unit = () => props.plate.unitShort.trim() || props.plate.unit
  return (
    <section
      class={styles.plate}
      aria-label="Reading"
      role="status"
      data-testid="ear-stage-plate"
      data-plate="threshold"
    >
      <Screws />
      <div class={styles.kickerRow}>
        <p class={styles.kicker}>{value() === null ? 'Stopped' : 'Reading'}</p>
        <span class={styles.badge}>
          {props.plate.calibration
            ? 'Sealed calibration'
            : props.short
              ? 'Provisional · short run'
              : props.plate.provisional
                ? 'Practice · provisional'
                : 'Practice'}
        </span>
      </div>
      <p class={styles.value}>
        <span class={styles.number}>
          {value() === null ? '—' : props.plate.format(value() as number)}
        </span>
        <Show when={value() !== null}>
          <span class={styles.unit}>{unit()}</span>
        </Show>
      </p>
      <Show when={value() !== null}>
        <p class={styles.direction}>
          {props.plate.unit} · {directionWord(props.plate.lowerIsBetter)}
        </p>
      </Show>
      <Show when={MEANING[props.drillId]}>
        {(meaning) => <p class={styles.meaning}>{meaning()}</p>}
      </Show>
      <div class={styles.rule} aria-hidden="true" />
      <Show when={value()}>
        {(reading) => (
          <p class={styles.strong}>
            {comparedLine({
              value: reading(),
              previous: props.plate.previous,
              lowerIsBetter: props.plate.lowerIsBetter,
              format: props.plate.format,
              unitShort: props.plate.unitShort,
            })}
          </p>
        )}
      </Show>
      <p class={styles.stats}>
        {staircaseStats(
          props.plate.trials,
          props.plate.turns,
          props.plate.replays,
        )}
      </p>
      <p class={styles.small}>{props.plate.note}</p>
    </section>
  )
}

/** A pair practice asked for from a slip: the room wakes the audio in
 *  the tap, then starts it. */
type PractiseHandler = (start: () => void) => void

/** The run's answers in order, as dots: right, missed or skipped. */
function RunDots(props: { outcomes: RatingPlate['outcomes'] }): JSX.Element {
  return (
    <Show when={props.outcomes.length > 0}>
      <div class={styles.dots} role="list" aria-label="Round by round">
        <For each={props.outcomes}>
          {(outcome) => (
            <span
              class={styles.dot}
              classList={{
                [styles.dotMiss]: !outcome.correct && outcome.skipped !== true,
                [styles.dotSkip]: outcome.skipped === true,
              }}
              role="listitem"
              aria-label={`${outcome.title}: ${
                outcome.correct
                  ? 'right'
                  : outcome.skipped === true
                    ? 'skipped'
                    : 'missed'
              }`}
            />
          )}
        </For>
      </div>
    </Show>
  )
}

/** "Where it slipped": the run's slips, counted, each between two of the
 *  drill's items with its offer of practice on them. */
function SlipList(props: {
  slips: readonly PlateSlip[]
  onPractise?: PractiseHandler
}): JSX.Element {
  return (
    <Show when={props.slips.length > 0}>
      <section class={styles.slips} aria-labelledby="merc-slips-title">
        <h2 id="merc-slips-title" class={styles.slipsTitle}>
          Where it slipped
        </h2>
        <ul class={styles.slipList}>
          <For each={props.slips}>
            {(slip) => (
              <li class={styles.slip}>
                <span class={styles.slipName}>{slip.expected}</span>
                heard as
                <span class={styles.slipHeard}>{slip.answered}</span>
                <span class={styles.slipCount}>{timesWord(slip.count)}</span>
                <Show
                  when={props.onPractise === undefined ? null : slip.practise}
                >
                  {(start) => (
                    <button
                      type="button"
                      class={styles.practise}
                      data-testid="merc-slip-practise"
                      onClick={() => props.onPractise?.(start())}
                    >
                      {practiseLabel(slip.expected, slip.answered)}
                    </button>
                  )}
                </Show>
              </li>
            )}
          </For>
        </ul>
      </section>
    </Show>
  )
}

export function RatingPlateView(props: {
  plate: RatingPlate
  drillId: string
  short: boolean
  onPractise?: PractiseHandler
}): JSX.Element {
  return (
    <>
      <section
        class={styles.plate}
        aria-label="Reading"
        role="status"
        data-testid="ear-stage-plate"
        data-plate="rating"
      >
        <Screws />
        <div class={styles.kickerRow}>
          <p class={styles.kicker}>Reading</p>
          <span class={styles.badge}>
            {props.short ? "Today's short run" : 'Rated run'}
          </span>
        </div>
        <p class={styles.value}>
          <span class={styles.number}>{props.plate.rating}</span>
        </p>
        <p class={styles.direction}>{props.plate.source} · higher is surer</p>
        <Show when={MEANING[props.drillId]}>
          {(meaning) => <p class={styles.meaning}>{meaning()}</p>}
        </Show>
        <div class={styles.rule} aria-hidden="true" />
        <Show
          when={props.plate.rounds > 0}
          fallback={
            <p class={styles.strong}>
              Stopped before the first answer. Nothing marked.
            </p>
          }
        >
          <p class={styles.strong}>
            {ratingMoveLine(props.plate.rating, props.plate.before)}
          </p>
          <p class={styles.stats}>
            {roundsLine(
              props.plate.rounds,
              props.plate.right,
              props.plate.rightWord ?? 'named',
            )}
          </p>
        </Show>
        <Show when={props.plate.settling}>
          {(left) => (
            <p class={styles.small}>
              Provisional: settling for {left()} more{' '}
              {props.plate.settlingNoun ?? 'answers'}
            </p>
          )}
        </Show>
        <For each={props.plate.lines ?? []}>
          {(line) => <p class={styles.small}>{line}</p>}
        </For>
        <RunDots outcomes={props.plate.outcomes} />
      </section>
      <SlipList slips={props.plate.slips} onPractise={props.onPractise} />
    </>
  )
}

/** A pair practice's plate: how many of its rounds were named right,
 *  the two it was on, and the rating it left alone. */
export function PracticePlateView(props: {
  plate: PracticePlate
  onPractise?: PractiseHandler
}): JSX.Element {
  const answered = (): boolean => props.plate.rounds > 0
  return (
    <>
      <section
        class={styles.plate}
        aria-label="Practice"
        role="status"
        data-testid="ear-stage-plate"
        data-plate="practice"
      >
        <Screws />
        <div class={styles.kickerRow}>
          <p class={styles.kicker}>Practice</p>
          <span class={styles.badge}>Nothing rated</span>
        </div>
        <p class={styles.value}>
          <span class={styles.number}>
            {answered() ? props.plate.right : '—'}
          </span>
          <Show when={answered()}>
            <span class={styles.unit}>of {props.plate.rounds}</span>
          </Show>
        </p>
        <p class={styles.direction}>
          {props.plate.against[0]} against {props.plate.against[1]}
        </p>
        <div class={styles.rule} aria-hidden="true" />
        <Show
          when={answered()}
          fallback={
            <p class={styles.strong}>
              Stopped before the first answer. Nothing marked.
            </p>
          }
        >
          <p class={styles.strong}>
            {untouchedLine(props.plate.source, props.plate.rating)}
          </p>
          <p class={styles.stats}>
            {roundsLine(
              props.plate.rounds,
              props.plate.right,
              props.plate.rightWord ?? 'named',
            )}
          </p>
        </Show>
        <RunDots outcomes={props.plate.outcomes} />
      </section>
      <SlipList slips={props.plate.slips} onPractise={props.onPractise} />
    </>
  )
}

/** A calibration's seal: the Mercury Index the run marked. */
export function SealedPlateView(props: {
  plate: ThresholdPlate
  faculty: string
}): JSX.Element {
  const index = () => props.plate.markedIndex ?? 0
  // The run just marked the newest seal; the one before it is the
  // faint line and the move's starting point.
  const previous = () => {
    const before = calibrationHistory().at(1)
    return before === undefined
      ? null
      : { index: before.index, on: dateLabel(before.at) }
  }
  const tracks = () =>
    tracksLine(
      props.plate.tracks ?? [],
      props.plate.format,
      props.plate.unitShort.trim(),
    )
  return (
    <>
      <section
        class={styles.plate}
        aria-label="The sealed reading"
        role="status"
        data-testid="ear-stage-plate"
        data-plate="sealed"
      >
        <Screws />
        <div class={styles.kickerRow}>
          <p class={styles.kicker}>Mercury Index</p>
          <span class={styles.badge}>Sealed</span>
        </div>
        <p class={styles.value}>
          <span class={styles.number}>{index()}</span>
        </p>
        <p class={styles.strong}>{sealedMoveLine(index(), previous())}</p>
        <p class={styles.meaning}>{INDEX_MEANING}</p>
        <div class={styles.rule} aria-hidden="true" />
        <Show when={props.plate.value}>
          {(value) => (
            <p class={styles.strong}>
              {props.faculty}, sealed: {props.plate.format(value())}{' '}
              {props.plate.unitShort.trim()}
            </p>
          )}
        </Show>
        <p class={styles.stats}>
          <Show when={tracks() !== ''}>Tracks {tracks()} · </Show>
          {props.plate.trials} questions
        </p>
        <p class={styles.small}>{SEALED_SMALL_PRINT}</p>
      </section>
      <div class={styles.glassRow}>
        <Glass
          sealed={index()}
          sealedOn={dateLabel(Date.now())}
          estimate={null}
          previous={previous()?.index ?? null}
          width={320}
        />
        <p class={styles.glassCaption}>
          Marked {dateLabel(Date.now())}.
          <Show when={previous()}>
            {(old) => ` The faint line is the old mark, ${old().index}.`}
          </Show>
        </p>
      </div>
    </>
  )
}

/** The glass under a practice plate: where the Column stands now. */
export function GlassUnderPlate(): JSX.Element {
  const sealed = () => calibrationHistory().at(0) ?? null
  const estimate = () => practiceEstimate()
  return (
    <div class={styles.glassRow}>
      <Glass
        sealed={sealed()?.index ?? null}
        sealedOn={sealed() ? dateLabel(sealed()?.at ?? 0) : null}
        estimate={estimate()}
        width={320}
      />
      <p class={styles.glassCaption}>
        <Show
          when={sealed()}
          fallback={`Not sealed yet${
            estimate() === null
              ? ''
              : ` · practice estimate ${estimate()}, not marked`
          }`}
        >
          {(run) =>
            `Index ${run().index}, sealed ${dateLabel(run().at)}${
              estimate() === null
                ? ''
                : ` · practice estimate ${estimate()}, not marked`
            }`
          }
        </Show>
      </p>
    </div>
  )
}

// ── On the desk, and under it ───────────────────────────────────

/** The plate a run ended on, where the instrument stood: a staircase's
 *  reading with the glass under it, a calibration's seal, a rating, or
 *  a pair practice's tally. A drill that hands the room no plate shows
 *  its own. */
export function PlateOnDesk(props: {
  plate: RoomPlate | null
  /** The drill's own plate, for a drill with no room data. */
  own: JSX.Element
  drillId: string
  short: boolean
  /** The faculty a seal is said under. */
  faculty: string
  /** A slip's offer of practice, taken. */
  onPractise?: PractiseHandler
}): JSX.Element {
  return (
    <Show when={props.plate} fallback={props.own}>
      {(shown) => (
        <Switch>
          <Match
            when={
              shown().kind === 'threshold' ? (shown() as ThresholdPlate) : null
            }
          >
            {(threshold) => (
              <Show
                when={threshold().markedIndex !== undefined}
                fallback={
                  <>
                    <ThresholdPlateView
                      plate={threshold()}
                      drillId={props.drillId}
                      short={props.short}
                    />
                    <GlassUnderPlate />
                  </>
                }
              >
                <SealedPlateView plate={threshold()} faculty={props.faculty} />
              </Show>
            )}
          </Match>
          <Match
            when={
              shown().kind === 'practice' ? (shown() as PracticePlate) : null
            }
          >
            {(practice) => (
              <PracticePlateView
                plate={practice()}
                onPractise={props.onPractise}
              />
            )}
          </Match>
          <Match
            when={shown().kind === 'rating' ? (shown() as RatingPlate) : null}
          >
            {(rating) => (
              <RatingPlateView
                plate={rating()}
                drillId={props.drillId}
                short={props.short}
                onPractise={props.onPractise}
              />
            )}
          </Match>
        </Switch>
      )}
    </Show>
  )
}

/** What next, under the plate: the main button follows the context, and
 *  Calibrate is the outlined second where a seal is on offer, then Run
 *  again and Done. A seal's own plate offers the rulers instead. */
export function PlateNext(props: {
  sealed: boolean
  label: string
  /** Run again has a button of its own unless the main one is it. */
  again: boolean
  calibrate: boolean
  onFollow: () => void
  onCalibrate: () => void
  onAgain: () => void
  onDone: () => void
  onRulers: () => void
}): JSX.Element {
  return (
    <div class={styles.next}>
      <Show
        when={!props.sealed}
        fallback={
          <div class={styles.pair}>
            <button
              type="button"
              class={styles.plain}
              onClick={() => props.onRulers()}
            >
              What the Index counts
            </button>
            <button
              type="button"
              class={roomStyles.primary}
              data-testid="merc-plate-done"
              onClick={() => props.onDone()}
            >
              Done
            </button>
          </div>
        }
      >
        <button
          type="button"
          class={roomStyles.primary}
          data-testid="merc-plate-next"
          onClick={() => props.onFollow()}
        >
          {props.label}
        </button>
        <Show when={props.calibrate}>
          <button
            type="button"
            class={roomStyles.secondary}
            onClick={() => props.onCalibrate()}
          >
            Calibrate <small>· sealed · about 50 questions</small>
          </button>
        </Show>
        <div class={styles.pair}>
          <Show when={props.again}>
            <button
              type="button"
              class={styles.plain}
              onClick={() => props.onAgain()}
            >
              Run again
            </button>
          </Show>
          <button
            type="button"
            class={styles.plain}
            data-testid="merc-plate-done"
            onClick={() => props.onDone()}
          >
            Done
          </button>
        </div>
      </Show>
    </div>
  )
}
