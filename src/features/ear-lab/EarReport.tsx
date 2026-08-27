// ============================================================
// EarReport — what moved, and what you confuse. Inside the room.
//
// A report stage: the drill bar with a range control, then engraved
// plates. The Mercury Index over its sealed calibrations; one trace
// per threshold drill (practice silver, sealed brass, inverted so
// rising means improving, with the axis printed honestly); one
// confusion matrix per identification drill, the diagonal in signal
// and the worst pairs said as sentences with rates — "You answer Fa
// as Sol on 41% of attempts" is still the most actionable line the
// Ear Lab can produce. Confusions are not dated, so the range control
// moves the traces only, and the foot line says so.
//
// Confusion rates use tap-item attempts (mic answers do not touch
// items), so a rate is perception against a stable yardstick.
// ============================================================

import type { JSX } from 'solid-js'
import { createMemo, createSignal, For, Show } from 'solid-js'
import { bankItemState, LEAP_BANK, STACK_BANK } from '@/lib/ear/banks'
import type { ConfusionMatrix } from '@/lib/ear/confusion-report'
import { buildConfusionMatrix, topConfusions } from '@/lib/ear/confusion-report'
import { findThresholdDrill } from '@/lib/ear/drills'
import { HOME_DEGREES, homeItemState } from '@/lib/ear/item-bank'
import { INDEX_MAX } from '@/lib/ear/mercury-index'
import { calibrationHistory, earConfusions, earItemStates, thresholdHistory, } from '@/stores/ear-lab-store'
import styles from './EarReport.module.css'
import { StageBar } from './EarStage'
import stage from './EarStage.module.css'
import { dateLabel } from './instruments'
import type { TracePoint } from './ReadingTrace'
import { ReadingTrace } from './ReadingTrace'
import { useCompactStage } from './use-compact-stage'

export type ReportRange = '4w' | '12w' | 'all'

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

const RANGES: { id: ReportRange; label: string; weeks: number | null }[] = [
  { id: '4w', label: '4 wk', weeks: 4 },
  { id: '12w', label: '12 wk', weeks: 12 },
  { id: 'all', label: 'All', weeks: null },
]

interface ConfusionSection {
  drillId: string
  title: string
  /** Confusion-key labels in axis order. */
  labels: string[]
  /** Display name per label (axis ticks + sentences). */
  display: (label: string) => string
  /** Tap attempts for a label's item (rate denominator). */
  attemptsFor: (label: string) => number
}

const SECTIONS: ConfusionSection[] = [
  {
    drillId: 'home',
    title: 'Home',
    labels: HOME_DEGREES.map((d) => `deg-${d.degree}`),
    display: (label) => {
      const degree = HOME_DEGREES.find((d) => `deg-${d.degree}` === label)
      return degree ? `${degree.solfege} (${degree.degree})` : label
    },
    attemptsFor: (label) => {
      const degree = Number(label.replace('deg-', ''))
      return homeItemState(earItemStates(), degree).attempts
    },
  },
  {
    drillId: 'leap',
    title: 'Leap',
    labels: LEAP_BANK.map((item) => item.itemId),
    display: (label) =>
      LEAP_BANK.find((item) => item.itemId === label)?.label ?? label,
    attemptsFor: (label) => {
      const item = LEAP_BANK.find((i) => i.itemId === label)
      return item ? bankItemState(earItemStates(), item).attempts : 0
    },
  },
  {
    drillId: 'stack',
    title: 'Stack',
    labels: STACK_BANK.map((item) => item.itemId),
    display: (label) =>
      STACK_BANK.find((item) => item.itemId === label)?.name ?? label,
    attemptsFor: (label) => {
      const item = STACK_BANK.find((i) => i.itemId === label)
      return item ? bankItemState(earItemStates(), item).attempts : 0
    },
  },
  {
    drillId: 'contour',
    title: 'Contour',
    labels: ['up', 'down', 'same'],
    display: (label) => label,
    // Contour's expected labels are directions, not items — no
    // per-item denominator exists, so sentences show counts only and
    // the matrix has no diagonal.
    attemptsFor: () => 0,
  },
]

const THRESHOLDS = ['hairline', 'the-grid'] as const

interface EarReportProps {
  onBack: () => void
  /** Injectable clock, so tests can pin the window. */
  now?: () => number
}

export function EarReport(props: EarReportProps): JSX.Element {
  const [range, setRange] = createSignal<ReportRange>('12w')
  const compact = useCompactStage()
  const now = () => props.now?.() ?? Date.now()

  /** The oldest timestamp on file: the All range's left edge. */
  const earliest = createMemo(() => {
    const stamps = [
      ...calibrationHistory().map((run) => run.at),
      ...THRESHOLDS.flatMap((id) => thresholdHistory(id).map((r) => r.at)),
    ]
    return stamps.length > 0 ? Math.min(...stamps) : now() - WEEK_MS
  })
  const from = () => {
    const weeks = RANGES.find((r) => r.id === range())?.weeks ?? null
    return weeks === null ? earliest() : now() - weeks * WEEK_MS
  }
  const inRange = (at: number) => at >= from() && at <= now()

  const RangeControl = (): JSX.Element => (
    <div class={styles.range} role="group" aria-label="Range">
      <For each={RANGES}>
        {(option) => (
          <button
            type="button"
            aria-pressed={range() === option.id}
            onClick={() => setRange(option.id)}
          >
            {option.label}
          </button>
        )}
      </For>
    </div>
  )

  return (
    <section
      class={`${stage.stage} ${styles.report}`}
      data-testid="ear-report"
      aria-label="Ear Report"
    >
      <StageBar
        name="Ear Report"
        progress="What moved, and what you confuse"
        onBack={props.onBack}
        aside={
          <Show when={!compact()}>
            <RangeControl />
          </Show>
        }
      />
      <div class={styles.body}>
        <Show when={compact()}>
          <div class={styles.rangeRow}>
            <RangeControl />
          </div>
        </Show>
        <div class={styles.grid}>
          <IndexPlate from={from()} to={now()} inRange={inRange} />
          <ThresholdPlates from={from()} to={now()} inRange={inRange} />
          <For each={SECTIONS}>
            {(section) => <ConfusionPlate section={section} />}
          </For>
        </div>
        <p class={styles.foot}>
          Brass is sealed; silver is practice. The range moves the traces —
          confusions are counted for all time.
        </p>
      </div>
    </section>
  )
}

/* ── Plates ──────────────────────────────────────────────────── */

function Plate(props: {
  title: string
  id: string
  children: JSX.Element
}): JSX.Element {
  return (
    <section class={styles.plate} data-plate={props.id}>
      <h3 class={styles.plateTitle}>{props.title}</h3>
      {props.children}
    </section>
  )
}

function PlateNote(props: { children: JSX.Element }): JSX.Element {
  return <p class={styles.note}>{props.children}</p>
}

function signed(n: number): string {
  return n > 0 ? `+${n}` : `${n}`
}

interface WindowProps {
  from: number
  to: number
  inRange: (at: number) => boolean
}

function IndexPlate(props: WindowProps): JSX.Element {
  const runs = () => calibrationHistory()
  const points = (): TracePoint[] =>
    runs()
      .filter((run) => props.inRange(run.at))
      .map((run) => ({ at: run.at, value: run.index, sealed: true }))
  const latest = () => runs()[0] ?? null
  const previous = () => runs()[1] ?? null

  return (
    <Plate title="Mercury Index · sealed calibrations" id="index">
      <Show
        when={latest()}
        fallback={
          <PlateNote>
            No sealed calibrations yet — the mercury moves only when one says
            so. Run Calibration from the bench.
          </PlateNote>
        }
      >
        {(run) => (
          <>
            <Show
              when={points().length > 0}
              fallback={<PlateNote>No calibration in this range.</PlateNote>}
            >
              <ReadingTrace
                label="Mercury Index"
                points={points()}
                unit=""
                decimals={0}
                domain={[0, INDEX_MAX]}
                from={props.from}
                to={props.to}
              />
            </Show>
            <PlateNote>
              Sealed {dateLabel(run().at)} at <b>{run().index}</b> of{' '}
              {INDEX_MAX}
              <Show when={previous()}>
                {(prev) => (
                  <>
                    {' '}
                    · <b>{signed(run().index - prev().index)}</b> since{' '}
                    {dateLabel(prev().at)}
                  </>
                )}
              </Show>
              .
            </PlateNote>
          </>
        )}
      </Show>
    </Plate>
  )
}

function ThresholdPlates(props: WindowProps): JSX.Element {
  const withHistory = () =>
    THRESHOLDS.filter((id) => thresholdHistory(id).length > 0)

  return (
    <Show
      when={withHistory().length > 0}
      fallback={
        <Plate title="Thresholds over time" id="thresholds-empty">
          <PlateNote>
            No threshold readings yet — run Hairline or The Grid. Falling is
            improving, so the trace is drawn to rise.
          </PlateNote>
        </Plate>
      }
    >
      <For each={withHistory()}>
        {(drillId) => {
          const drill = findThresholdDrill(drillId)
          const unit =
            drill?.unitShort === 'ms' ? ' ms' : (drill?.unitShort ?? '')
          const decimals = drill?.unitShort === 'ms' ? 0 : 1
          const name = drill?.name ?? drillId
          const history = () => thresholdHistory(drillId)
          const points = (): TracePoint[] =>
            history()
              .filter((r) => props.inRange(r.at))
              .map((r) => ({
                at: r.at,
                value: r.value,
                sealed: r.source === 'calibration',
              }))
          const best = () => Math.min(...history().map((r) => r.value))
          const latest = () => history()[0]
          const fmt = (value: number) => `${value.toFixed(decimals)}${unit}`
          return (
            <Plate
              title={`${name} · threshold, rising is improving`}
              id={`trace-${drillId}`}
            >
              <Show
                when={points().length > 0}
                fallback={<PlateNote>Nothing in this range.</PlateNote>}
              >
                <ReadingTrace
                  label={`${name} threshold`}
                  points={points()}
                  unit={unit}
                  decimals={decimals}
                  invert
                  from={props.from}
                  to={props.to}
                />
              </Show>
              <PlateNote>
                Latest <b>{fmt(latest().value)}</b> · best <b>{fmt(best())}</b>.
                Brass marks are sealed calibrations; the silver line is
                practice.
              </PlateNote>
            </Plate>
          )
        }}
      </For>
    </Show>
  )
}

function ConfusionPlate(props: { section: ConfusionSection }): JSX.Element {
  const confusions = () => earConfusions(props.section.drillId)
  const matrix = () => buildConfusionMatrix(confusions(), props.section.labels)
  const top = () =>
    topConfusions(confusions(), {
      limit: 3,
      attemptsFor: props.section.attemptsFor,
    })

  return (
    <Plate
      title={`${props.section.title} · what you answer as what`}
      id={`confusion-${props.section.drillId}`}
    >
      <Show
        when={matrix().totalMisses > 0}
        fallback={
          <PlateNote>
            No misses recorded yet — play the drill and this map fills in.
          </PlateNote>
        }
      >
        <ConfusionMatrixView matrix={matrix()} section={props.section} />
        <ol class={styles.sentences}>
          <For each={top()}>
            {(confusion) => (
              <li>
                You answer <b>{props.section.display(confusion.expected)}</b> as{' '}
                <b>{props.section.display(confusion.answered)}</b>{' '}
                {confusion.rate !== null
                  ? `on ${Math.round(confusion.rate * 100)}% of attempts`
                  : `(${confusion.count} times)`}
                .
              </li>
            )}
          </For>
        </ol>
      </Show>
    </Plate>
  )
}

/** Rows are what played, columns are what you answered. The diagonal
 *  carries the right answers (attempts less misses) in signal, so a
 *  row reads "8 right, 2 heard as Mi" at a glance. */
function ConfusionMatrixView(props: {
  matrix: ConfusionMatrix
  section: ConfusionSection
}): JSX.Element {
  const display = (label: string) => props.section.display(label)
  const short = (label: string) => {
    const name = display(label)
    const cut = name.indexOf(' (')
    const base = cut > 0 ? name.slice(0, cut) : name
    return base.length > 4 ? base.slice(0, 4) : base
  }
  const rowMisses = (row: number) =>
    props.matrix.cells[row].reduce((a, b) => a + b, 0)
  /** Right answers for a row, when the drill keeps a per-item count.
   *  Mic answers book misses without touching items, so this floors
   *  at zero rather than pretending to a negative. */
  const hits = (row: number) => {
    const attempts = props.section.attemptsFor(props.matrix.labels[row])
    return attempts > 0 ? Math.max(0, attempts - rowMisses(row)) : 0
  }
  const maxHits = createMemo(() =>
    Math.max(0, ...props.matrix.labels.map((_, i) => hits(i))),
  )

  return (
    <div class={styles.matrixScroll}>
      <div
        class={styles.matrix}
        role="table"
        aria-label={`${props.section.title}: rows are what played, columns are what you answered`}
        style={{
          'grid-template-columns': `auto repeat(${props.matrix.labels.length}, minmax(30px, 1fr))`,
        }}
      >
        <div role="row" class={styles.matrixRow}>
          <span role="columnheader" class={styles.corner}>
            <span class={styles.srOnly}>
              What played, then what you answered
            </span>
          </span>
          <For each={props.matrix.labels}>
            {(label) => (
              <span
                role="columnheader"
                class={styles.head}
                title={display(label)}
              >
                {short(label)}
              </span>
            )}
          </For>
        </div>
        <For each={props.matrix.labels}>
          {(rowLabel, row) => (
            <div role="row" class={styles.matrixRow}>
              <span
                role="rowheader"
                class={styles.head}
                title={display(rowLabel)}
              >
                {short(rowLabel)}
              </span>
              <For each={props.matrix.labels}>
                {(colLabel, col) => {
                  const diagonal = () => row() === col()
                  const count = () =>
                    diagonal() ? hits(row()) : props.matrix.cells[row()][col()]
                  const heat = () => {
                    if (diagonal()) {
                      return maxHits() === 0 ? 0 : hits(row()) / maxHits()
                    }
                    return props.matrix.maxCount === 0
                      ? 0
                      : props.matrix.cells[row()][col()] / props.matrix.maxCount
                  }
                  const title = () =>
                    diagonal()
                      ? `Heard ${display(rowLabel)}, answered right: ${count()}`
                      : `Heard ${display(rowLabel)}, answered ${display(colLabel)}: ${count()}`
                  return (
                    <span
                      role="cell"
                      class={styles.cell}
                      classList={{
                        [styles.cellMiss]: !diagonal() && count() > 0,
                        [styles.cellHit]: diagonal() && count() > 0,
                      }}
                      style={{ '--heat': heat().toFixed(2) }}
                      title={title()}
                      aria-label={title()}
                    >
                      {count() > 0 ? count() : ''}
                    </span>
                  )
                }}
              </For>
            </div>
          )}
        </For>
      </div>
    </div>
  )
}
