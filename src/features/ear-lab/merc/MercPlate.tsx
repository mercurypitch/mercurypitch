// ============================================================
// The room's plates: what a finished run reads, as a result on the
// stage (docs/plans/ear-lab-native-look.md, phase 3).
//
//   - A staircase's reading: the number counting along the staircase as
//     its way draws, the turns and misses on it, then the reading across
//     it; against the last reading, how many questions, turns and
//     replays, Practice or a short run's Provisional, where it slipped,
//     and no letter grade.
//   - A rated run's rating: the number moving from the rating the run
//     found as the run's dots fill in order, "higher is surer", the move,
//     rounds and names, and where it slipped, as counts. A slip between
//     two of the drill's items offers a pair practice on them.
//   - A pair practice's tally: the rounds named right, the two it was
//     on, and the rating it left alone.
//   - A calibration's seal: the Mercury Index counting from the old mark
//     to the new, the three tracks, and the glass with the mercury rising
//     to the new mark and the old one left faint.
//
// The numbers that count are drawn for the eye; the reading itself is
// in the words a screen reader gets, once.
// ============================================================

import type { JSX } from 'solid-js'
import { For, Match, Show, Switch } from 'solid-js'
import { dateLabel } from '@/features/ear-lab/instruments'
import type { PlateSlip, PracticePlate, RatingPlate, RoomPlate, ThresholdPlate, } from '@/features/ear-lab/stage-room'
import { calibrationHistory } from '@/stores/ear-lab-store'
import { Glass } from './Glass'
import { useEntryClock } from './lit/clock'
import { easeOut, lerp, progress } from './lit/draw'
import { countedLevel, LitStaircase, LitTracks, STAIRS_MS, TRACKS_MS, } from './lit/LitStaircase'
import { byTrack, staircaseMisses } from './lit/staircase'
import { comparedLine, directionWord, INDEX_MEANING, MEANING, practiseLabel, ratingMoveLine, roundsLine, SEALED_SMALL_PRINT, sealedMoveLine, staircaseSlipLine, staircaseStats, timesWord, tracksLine, untouchedLine, } from './merc-lines'
import styles from './plate.module.css'
import roomStyles from './room.module.css'

/** When a rated run's dots fill, and when its move shows beside the
 *  number. */
const DOTS_MS = { from: 300, to: 2700, moved: 3100 } as const
/** How long the seal's number counts: as long as the mercury rises. */
const SEAL_MS = 1400

export function ThresholdPlateView(props: {
  plate: ThresholdPlate
  short: boolean
}): JSX.Element {
  const clock = useEntryClock(STAIRS_MS.settled)
  const value = () => props.plate.value
  const unit = () => props.plate.unitShort.trim() || props.plate.unit
  /** A practice run's way; a calibration's tracks are the seal's. */
  const stairs = () =>
    props.plate.calibration
      ? []
      : (props.plate.trace ?? []).filter((point) => point.track === undefined)
  const drawn = (): boolean => value() !== null && stairs().length >= 2
  const shown = (): string => {
    const reading = value()
    if (reading === null) return '—'
    return props.plate.format(
      drawn() ? countedLevel(stairs(), reading, clock.t()) : reading,
    )
  }
  const misses = () => staircaseMisses(stairs(), props.plate.lowerIsBetter)
  return (
    <section
      class={styles.plate}
      aria-label="Reading"
      role="status"
      data-testid="ear-stage-plate"
      data-plate="threshold"
    >
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
        <span class={styles.number} aria-hidden="true">
          {shown()}
        </span>
        <Show when={value()}>
          {(reading) => (
            <>
              <span class={styles.unit} aria-hidden="true">
                {unit()}
              </span>
              <span class={roomStyles.srOnly}>
                {props.plate.format(reading())} {unit()}
              </span>
            </>
          )}
        </Show>
      </p>
      <Show when={value() !== null}>
        <p class={styles.direction}>
          {props.plate.unit} · {directionWord(props.plate.lowerIsBetter)}
        </p>
      </Show>
      <Show when={drawn() ? value() : null}>
        {(reading) => (
          <div class={styles.chart}>
            <LitStaircase
              points={stairs()}
              reading={reading()}
              unitShort={props.plate.unitShort}
              t={clock.t()}
            />
          </div>
        )}
      </Show>
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
      <Show when={misses().edge}>
        {(edge) => (
          <p class={styles.slipPill} data-testid="merc-plate-slips">
            <span class={styles.slipDot} aria-hidden="true" />
            <span class={styles.slipPillTitle}>Where it slipped</span>
            <span class={styles.slipPillCount}>
              {staircaseSlipLine({
                count: misses().count,
                edge: edge(),
                lowerIsBetter: props.plate.lowerIsBetter,
                format: props.plate.format,
                unitShort: props.plate.unitShort,
              })}
            </span>
          </p>
        )}
      </Show>
      {/* Why there is nothing to read, or nothing marked. A reading's
          own note is the glass's business, on the bench. */}
      <Show when={value() === null || props.plate.calibration}>
        <p class={styles.small}>{props.plate.note}</p>
      </Show>
    </section>
  )
}

/** A pair practice asked for from a slip: the room wakes the audio in
 *  the tap, then starts it. */
type PractiseHandler = (start: () => void) => void

/** The run's answers in order, as dots: right, missed or skipped, the
 *  first `filled` of them lit and the rest still to come. */
function RunDots(props: {
  outcomes: RatingPlate['outcomes']
  filled: number
}): JSX.Element {
  return (
    <Show when={props.outcomes.length > 0}>
      <div class={styles.dots} role="list" aria-label="Round by round">
        <For each={props.outcomes}>
          {(outcome, i) => (
            <span
              class={styles.dot}
              classList={{
                [styles.dotRight]: i() < props.filled && outcome.correct,
                [styles.dotMiss]:
                  i() < props.filled &&
                  !outcome.correct &&
                  outcome.skipped !== true,
                [styles.dotSkipped]:
                  i() < props.filled && outcome.skipped === true,
              }}
              data-dot={
                i() >= props.filled
                  ? 'coming'
                  : outcome.correct
                    ? 'right'
                    : outcome.skipped === true
                      ? 'skipped'
                      : 'missed'
              }
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

/** "Where it slipped": the run's slips, counted, the most often first,
 *  and under the first slip between two of the drill's items its offer
 *  of practice on them. */
function SlipList(props: {
  slips: readonly PlateSlip[]
  onPractise?: PractiseHandler
}): JSX.Element {
  const offered = () =>
    props.onPractise === undefined
      ? -1
      : props.slips.findIndex((slip) => slip.practise !== undefined)
  return (
    <Show when={props.slips.length > 0}>
      <section class={styles.slips} aria-labelledby="merc-slips-title">
        <h2 id="merc-slips-title" class={styles.slipsTitle}>
          Where it slipped
        </h2>
        <ul class={styles.slipList}>
          <For each={props.slips}>
            {(slip, i) => (
              <li class={styles.slip}>
                <span class={styles.slipName}>{slip.expected}</span>
                heard as
                <span class={styles.slipHeard}>{slip.answered}</span>
                <span class={styles.slipCount}>{timesWord(slip.count)}</span>
                <Show when={i() === offered() ? slip.practise : null}>
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
  const clock = useEntryClock(DOTS_MS.moved)
  const total = () => props.plate.outcomes.length
  const p = () => progress(clock.t(), DOTS_MS.from, DOTS_MS.to)
  /** The dots lit so far: one after another, all of them by the end. */
  const filled = (): number =>
    p() >= 1 ? total() : Math.min(total(), Math.floor(p() * (total() + 1)))
  /** The number, moving with the dots, or with time where there are
   *  none to move with. */
  const shown = (): number => {
    const { rating, before } = props.plate
    if (props.plate.rounds === 0) return rating
    const moved = total() > 0 ? filled() / total() : easeOut(p())
    return Math.round(lerp(before, rating, moved))
  }
  const delta = () => props.plate.rating - props.plate.before
  return (
    <>
      <section
        class={styles.plate}
        aria-label="Reading"
        role="status"
        data-testid="ear-stage-plate"
        data-plate="rating"
      >
        <div class={styles.kickerRow}>
          <p class={styles.kicker}>Reading</p>
          <span class={styles.badge}>
            {props.short ? "Today's short run" : 'Rated run'}
          </span>
        </div>
        <p class={styles.value}>
          <span class={styles.number} aria-hidden="true">
            {shown()}
          </span>
          <Show when={props.plate.rounds > 0 && delta() !== 0}>
            <span
              class={styles.delta}
              classList={{ [styles.deltaUp]: delta() > 0 }}
              style={{
                opacity: progress(clock.t(), DOTS_MS.to, DOTS_MS.moved),
              }}
              aria-hidden="true"
            >
              {delta() > 0 ? `+${delta()}` : `−${-delta()}`}
            </span>
          </Show>
          <span class={roomStyles.srOnly}>{props.plate.rating}</span>
        </p>
        <p class={styles.direction}>{props.plate.source} · higher is surer</p>
        <Show when={MEANING[props.drillId]}>
          {(meaning) => <p class={styles.meaning}>{meaning()}</p>}
        </Show>
        <RunDots outcomes={props.plate.outcomes} filled={filled()} />
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
              props.plate.replays,
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
        <RunDots
          outcomes={props.plate.outcomes}
          filled={props.plate.outcomes.length}
        />
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
              props.plate.replays,
            )}
          </p>
        </Show>
        <For each={props.plate.lines ?? []}>
          {(line) => <p class={styles.small}>{line}</p>}
        </For>
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
  const clock = useEntryClock(Math.max(SEAL_MS, TRACKS_MS.to))
  const index = () => props.plate.markedIndex ?? 0
  // The run just marked the newest seal; the one before it is the
  // faint line and the move's starting point.
  const previous = () => {
    const before = calibrationHistory().at(1)
    return before === undefined
      ? null
      : { index: before.index, on: dateLabel(before.at) }
  }
  const shown = (): number => {
    const old = previous()
    if (old === null) return index()
    const p = easeOut(progress(clock.t(), 0, SEAL_MS))
    return Math.round(lerp(old.index, index(), p))
  }
  const unit = () => props.plate.unitShort.trim()
  const tracks = () =>
    byTrack(props.plate.trace ?? [], props.plate.tracks?.length ?? 3)
  const readings = () =>
    (props.plate.tracks ?? []).map((value) =>
      value === null ? null : props.plate.format(value),
    )
  const tracksWords = () =>
    tracksLine(props.plate.tracks ?? [], props.plate.format, unit())
  return (
    <section
      class={styles.plate}
      aria-label="The sealed reading"
      role="status"
      data-testid="ear-stage-plate"
      data-plate="sealed"
    >
      <div class={styles.kickerRow}>
        <p class={styles.kicker}>Mercury Index</p>
        <span class={styles.badge}>Sealed</span>
      </div>
      <p class={styles.value}>
        <span class={styles.number} aria-hidden="true">
          {shown()}
        </span>
        <span class={roomStyles.srOnly}>{index()}</span>
      </p>
      <p class={styles.strong}>{sealedMoveLine(index(), previous())}</p>
      <p class={styles.direction}>{INDEX_MEANING}</p>
      <Show when={tracks().some((track) => track.length >= 2)}>
        <div class={styles.chart}>
          <LitTracks
            tracks={tracks()}
            readings={readings()}
            unitShort={props.plate.unitShort}
            t={clock.t()}
          />
        </div>
      </Show>
      <Show when={props.plate.value}>
        {(value) => (
          <p class={styles.strong}>
            {props.faculty}, sealed: {props.plate.format(value())} {unit()}
          </p>
        )}
      </Show>
      <p class={styles.stats}>
        <Show when={tracksWords() !== ''}>Tracks {tracksWords()} · </Show>
        {props.plate.trials} questions
      </p>
      <div class={styles.glassRow}>
        <Glass
          sealed={index()}
          sealedOn={dateLabel(Date.now())}
          estimate={null}
          previous={previous()?.index ?? null}
          width={314}
        />
      </div>
      <p class={styles.small}>{SEALED_SMALL_PRINT}</p>
    </section>
  )
}

// ── On the stage, and under it ──────────────────────────────────

/** The plate a run ended on, where the instrument stood: a staircase's
 *  reading, a calibration's seal, a rating, or a pair practice's tally.
 *  A drill that hands the room no plate shows its own. */
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
                  <ThresholdPlateView plate={threshold()} short={props.short} />
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
 *  again and Done. A seal's own plate is done with: Done, then the
 *  rulers. */
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
          <>
            <button
              type="button"
              class={roomStyles.primary}
              data-testid="merc-plate-done"
              onClick={() => props.onDone()}
            >
              Done
            </button>
            <button
              type="button"
              class={styles.plain}
              onClick={() => props.onRulers()}
            >
              What the Index counts
            </button>
          </>
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
