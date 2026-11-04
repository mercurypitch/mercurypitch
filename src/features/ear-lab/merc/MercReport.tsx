// ============================================================
// The Ear Report in the room's light (docs/plans/ear-lab-native-look.md,
// "The Ear Report", from the mock-ups on the Ear Lab Native Bench
// canvas): what moved, and what the ear mixes up, drawn as the native tab
// draws everything else. The web's report (EarReport.tsx) keeps its
// engraved plates; both read the same data (report-data.ts).
//
//   the bar      a round back button, the title and its line, staying
//                at the top while the report scrolls under it
//   Merc         his line from the numbers: how the Index moved since
//                the seal before, and the mix-up that slips most
//   the range    4 weeks, 12 weeks or all; it moves the traces only
//   the Index    the number as the bench shows it, its seals on a lit line
//   what moved   each threshold in its station's lights: sealed marks
//                bright, practice dashed, drawn so finer is higher
//   mix-ups      each drill's map, what played down the side and what
//                was answered across; a miss glows in the station's
//                light, brighter the more it happens; the three that
//                slip most said in words
//   quiet rows   drills with nothing to show yet, together
//
// It opens at its own top, and Android's back takes it back to the bench.
// ============================================================

import type { JSX } from 'solid-js'
import { createMemo, createSignal, For, onCleanup, onMount, Show, } from 'solid-js'
import { Dynamic } from 'solid-js/web'
import { MercPresence } from '@/components/room-kit/MercPresence'
import type { ConfusionMatrix, TopConfusion } from '@/lib/ear/confusion-report'
import { buildConfusionMatrix, topConfusions } from '@/lib/ear/confusion-report'
import { findThresholdDrill } from '@/lib/ear/drills'
import type { CalibrationRunEntry } from '@/stores/ear-lab-store'
import { calibrationHistory, earConfusions, thresholdHistory, } from '@/stores/ear-lab-store'
import { registerRoomBack } from '@/stores/native-shell-store'
import { IconBack } from '../ear-icons'
import type { EarLabView } from '../EarLabDashboard'
import { iconForDrill } from '../instrument-icons'
import { dateLabel } from '../instruments'
import type { ConfusionSection, ReportRange, TracePoint } from '../report-data'
import { CONFUSION_SECTIONS, DEFAULT_REPORT_RANGE, REPORT_RANGES, REPORT_THRESHOLDS, reportEarliest, reportFrom, } from '../report-data'
import bench from './bench.module.css'
import { HistoryChart } from './HistoryChart'
import styles from './report.module.css'
import { mapLabels, reportLine, sealsCaption, timesWord, worstMixUp, } from './report-lines'
import { setRoomOrigin } from './session'
import { stationOf, stationTitle } from './stations'
import { mercStill } from './stills'
import { openAtTop } from './tab-scroll'

export interface MercReportProps {
  onBack: () => void
  /** The tab's other views: Calibrate opens the sealed protocol. */
  onNavigate: (view: EarLabView) => void
  /** Injectable clock, so tests can pin the window. */
  now?: () => number
}

/** The range switch's words. */
const RANGE_WORDS: Record<ReportRange, string> = {
  '4w': '4 weeks',
  '12w': '12 weeks',
  all: 'All',
}

/** "+31", "−4"; nothing for no move, as the bench writes it. */
function sealMove(
  latest: CalibrationRunEntry,
  before: CalibrationRunEntry | undefined,
): { text: string; up: boolean } | null {
  if (before === undefined) return null
  const move = latest.index - before.index
  if (move === 0) return null
  return { text: `${move > 0 ? '+' : '−'}${Math.abs(move)}`, up: move > 0 }
}

interface MapSection {
  section: ConfusionSection
  matrix: ConfusionMatrix
  top: TopConfusion[]
}

export function MercReport(props: MercReportProps): JSX.Element {
  const [range, setRange] = createSignal<ReportRange>(DEFAULT_REPORT_RANGE)
  const now = (): number => props.now?.() ?? Date.now()
  const earliest = createMemo(() => reportEarliest(now()))
  const from = (): number => reportFrom(range(), now(), earliest())
  const inRange = (at: number): boolean => at >= from() && at <= now()

  const seals = (): CalibrationRunEntry[] => calibrationHistory()
  const maps = createMemo((): MapSection[] =>
    CONFUSION_SECTIONS.map((section) => {
      const confusions = earConfusions(section.drillId)
      return {
        section,
        matrix: buildConfusionMatrix(confusions, section.labels),
        top: topConfusions(confusions, { limit: 3 }),
      }
    }),
  )
  const drawn = (): MapSection[] =>
    maps().filter((map) => map.matrix.totalMisses > 0)
  const quiet = (): MapSection[] =>
    maps().filter((map) => map.matrix.totalMisses === 0)
  const line = (): string => reportLine(seals(), worstMixUp(maps()))

  let root: HTMLElement | undefined
  onMount(() => openAtTop(root))
  // Android's back: to the bench, as the back button.
  onCleanup(
    // eslint-disable-next-line solid/reactivity -- answers each press of Back, like a handler
    registerRoomBack(() => {
      props.onBack()
      return true
    }),
  )

  const calibrate = (): void => {
    setRoomOrigin({ kind: 'bench' })
    props.onNavigate('calibration')
  }

  return (
    <section
      ref={root}
      class={`${bench.layer} ${styles.report}`}
      data-testid="merc-report-screen"
      aria-labelledby="merc-report-title"
    >
      <div class={styles.bar}>
        <div class={styles.barRow}>
          <button
            type="button"
            class={styles.round}
            aria-label="Back to the Ear Lab"
            data-testid="merc-report-back"
            onClick={() => props.onBack()}
          >
            <IconBack size={20} />
          </button>
          <div class={styles.identity}>
            <h1 id="merc-report-title" class={styles.title}>
              Ear Report
            </h1>
            <p class={styles.subtitle}>
              What moved, and what your ear mixes up
            </p>
          </div>
        </div>
      </div>

      <div class={styles.column}>
        <div class={styles.mercLine}>
          <div class={styles.mercBox}>
            <div class={styles.mercGlow} aria-hidden="true" />
            <MercPresence
              state={() => 'point'}
              stillSrc={mercStill('point')}
              size={74}
              class={styles.merc}
              testId="merc-report-merc"
            />
          </div>
          <div class={styles.bubble}>
            <p data-testid="merc-report-line">{line()}</p>
          </div>
        </div>

        <div class={styles.range} role="group" aria-label="Range of the traces">
          <For each={REPORT_RANGES}>
            {(option) => (
              <button
                type="button"
                class={styles.rangeButton}
                aria-pressed={range() === option.id}
                data-range={option.id}
                onClick={() => setRange(option.id)}
              >
                {RANGE_WORDS[option.id]}
              </button>
            )}
          </For>
        </div>

        <IndexCard
          seals={seals()}
          range={range()}
          from={from()}
          to={now()}
          inRange={inRange}
          onCalibrate={calibrate}
        />

        <section aria-labelledby="merc-report-moved">
          <SectionHead
            id="merc-report-moved"
            title="What moved"
            caption="Each instrument's threshold over the range."
          />
          <Moved from={from()} to={now()} inRange={inRange} />
        </section>

        <section aria-labelledby="merc-report-mixups">
          <SectionHead
            id="merc-report-mixups"
            title="What your ear mixes up"
            caption="Down the side what played, across the top what you answered."
          />
          <For each={drawn()}>{(map) => <MixUpCard map={map} />}</For>
          <Show when={quiet().length > 0}>
            <QuietRow
              drillIds={quiet().map((map) => map.section.drillId)}
              testId="merc-report-quiet-mixups"
            >
              <Show
                when={drawn().length > 0}
                fallback="No mix-ups yet. Play Home, Leap, Stack or Contour and their maps fill in."
              >
                <Names names={quiet().map((map) => map.section.title)} />{' '}
                {quiet().length === 1
                  ? 'has no mix-ups yet. Its map fills in at the first one.'
                  : 'have no mix-ups yet. Their maps fill in at the first one.'}
              </Show>
            </QuietRow>
          </Show>
        </section>

        <p class={styles.foot}>
          Bright marks are sealed calibrations; the dashed line is practice. The
          range moves the traces. Mix-ups count for all time.
        </p>
      </div>
    </section>
  )
}

function SectionHead(props: {
  id: string
  title: string
  caption: string
}): JSX.Element {
  return (
    <div class={styles.sectionHead}>
      <h2 id={props.id} class={styles.h2}>
        {props.title}
      </h2>
      <p class={styles.caption}>{props.caption}</p>
    </div>
  )
}

/** "Leap", "Leap and Stack", "Hairline, Leap and Stack", each in bold. */
function Names(props: { names: readonly string[] }): JSX.Element {
  return (
    <For each={props.names}>
      {(name, i) => (
        <>
          {i() === 0 ? '' : i() === props.names.length - 1 ? ' and ' : ', '}
          <b>{name}</b>
        </>
      )}
    </For>
  )
}

/* ── The Index ───────────────────────────────────────────────── */

function IndexCard(props: {
  seals: readonly CalibrationRunEntry[]
  range: ReportRange
  from: number
  to: number
  inRange: (at: number) => boolean
  onCalibrate: () => void
}): JSX.Element {
  const points = (): TracePoint[] =>
    props.seals
      .filter((run) => props.inRange(run.at))
      .map((run) => ({ at: run.at, value: run.index, sealed: true }))
  return (
    <section
      class={`${styles.card} ${styles.indexCard}`}
      data-plate="index"
      aria-labelledby="merc-report-index"
    >
      <div class={styles.indexHead}>
        <h2 id="merc-report-index" class={styles.kicker}>
          Mercury Index
        </h2>
        <span class={styles.badge}>
          {props.seals.length === 0 ? 'Not sealed' : 'Sealed'}
        </span>
      </div>
      <Show
        when={props.seals[0]}
        fallback={
          <>
            <p class={styles.emptyTitle}>No seal yet</p>
            <p class={styles.emptyLead}>
              The mercury moves only when a calibration says so: about four
              minutes, three instruments.
            </p>
            <button
              type="button"
              class={styles.calibrate}
              data-testid="merc-report-calibrate"
              onClick={() => props.onCalibrate()}
            >
              Calibrate
            </button>
          </>
        }
      >
        {(seal) => {
          const before = (): CalibrationRunEntry | undefined => props.seals[1]
          const move = () => sealMove(seal(), before())
          return (
            <>
              <p class={styles.indexValue}>
                <span
                  class={styles.indexNumber}
                  data-testid="merc-report-index"
                >
                  {seal().index}
                </span>
                <Show when={move()}>
                  {(m) => (
                    <span
                      class={styles.indexMove}
                      classList={{ [styles.indexUp]: m().up }}
                      data-testid="merc-report-move"
                    >
                      {m().text}
                    </span>
                  )}
                </Show>
              </p>
              <p class={styles.lead}>
                Sealed {dateLabel(seal().at)}.
                <Show when={before()}>
                  {(b) => ` On ${dateLabel(b().at)} it was ${b().index}.`}
                </Show>
              </p>
              <Show when={points().length > 0}>
                <HistoryChart
                  label="The Mercury Index"
                  points={points()}
                  from={props.from}
                  to={props.to}
                  format={(value) => `${Math.round(value)}`}
                  area
                />
              </Show>
              <p class={styles.note} data-testid="merc-report-seals">
                {sealsCaption(points().length, props.range)}
              </p>
            </>
          )
        }}
      </Show>
    </section>
  )
}

/* ── What moved ──────────────────────────────────────────────── */

function Moved(props: {
  from: number
  to: number
  inRange: (at: number) => boolean
}): JSX.Element {
  const traced = (): string[] =>
    REPORT_THRESHOLDS.filter((id) => thresholdHistory(id).length > 0)
  const untraced = (): string[] =>
    REPORT_THRESHOLDS.filter((id) => thresholdHistory(id).length === 0)
  const name = (id: string): string => findThresholdDrill(id)?.name ?? id
  return (
    <>
      <For each={traced()}>
        {(drillId) => (
          <TraceCard
            drillId={drillId}
            from={props.from}
            to={props.to}
            inRange={props.inRange}
          />
        )}
      </For>
      <Show when={untraced().length > 0}>
        <QuietRow drillIds={untraced()} testId="merc-report-quiet-moved">
          <Names names={untraced().map(name)} />{' '}
          {untraced().length === 1
            ? 'has no readings yet. Its first run draws the first mark.'
            : 'have no readings yet. Their first run draws the first mark.'}
        </QuietRow>
      </Show>
    </>
  )
}

function TraceCard(props: {
  drillId: string
  from: number
  to: number
  inRange: (at: number) => boolean
}): JSX.Element {
  // eslint-disable-next-line solid/reactivity -- a card is made for one drill
  const drillId = props.drillId
  const drill = findThresholdDrill(drillId)
  const decimals = drill?.unitShort === 'ms' ? 0 : 1
  const unit = drill?.unitShort ?? ''
  const format = (value: number): string =>
    `${value.toFixed(decimals)} ${unit}`.trim()
  // The axis prints its round ends without a trailing nought: "10 ¢".
  const tick = (value: number): string =>
    `${Number(value.toFixed(decimals))} ${unit}`.trim()
  const name = drill?.name ?? drillId
  const faculty = stationOf(drillId) ?? 'resolution'
  const history = () => thresholdHistory(drillId)
  const points = (): TracePoint[] =>
    history()
      .filter((reading) => props.inRange(reading.at))
      .map((reading) => ({
        at: reading.at,
        value: reading.value,
        sealed: reading.source === 'calibration',
      }))
  // Newest first: the reading it stands at now, and its finest.
  const latest = (): number => history()[0]?.value ?? 0
  const best = (): number => Math.min(...history().map((r) => r.value))
  return (
    <section
      class={`${styles.card} ${styles.lit}`}
      data-faculty={faculty}
      data-plate={`trace-${drillId}`}
      aria-label={name}
    >
      <div class={styles.cardTop}>
        <span class={styles.disc} aria-hidden="true">
          <Dynamic component={iconForDrill(drillId)} size={20} />
        </span>
        <span class={styles.names}>
          <span class={styles.name}>{name}</span>
          <span class={styles.small}>{stationTitle(faculty)}</span>
        </span>
        <span class={styles.reading}>
          <span class={styles.small}>
            <b class={styles.readingValue}>{latest().toFixed(decimals)}</b>{' '}
            <b class={styles.readingUnit}>{unit}</b>
          </span>
          <span class={styles.small}>best {format(best())}</span>
        </span>
      </div>
      <Show
        when={points().length > 0}
        fallback={<p class={styles.note}>Nothing in this range.</p>}
      >
        <div class={styles.trace}>
          <HistoryChart
            label={name}
            points={points()}
            from={props.from}
            to={props.to}
            format={format}
            tick={tick}
            invert
          />
        </div>
      </Show>
      <p class={styles.note}>
        Lower is finer, so the line climbs as you sharpen.
      </p>
    </section>
  )
}

/* ── Mix-ups ─────────────────────────────────────────────────── */

function MixUpCard(props: { map: MapSection }): JSX.Element {
  // eslint-disable-next-line solid/reactivity -- a card is made for one drill
  const section = props.map.section
  const faculty = stationOf(section.drillId) ?? 'function'
  const matrix = (): ConfusionMatrix => props.map.matrix
  const shown = (): string[] => mapLabels(matrix())
  const cell = (row: string, col: string): number =>
    matrix().cells[section.labels.indexOf(row)][section.labels.indexOf(col)]
  return (
    <section
      class={`${styles.card} ${styles.lit} ${styles.mapCard}`}
      data-faculty={faculty}
      data-plate={`confusion-${section.drillId}`}
      aria-label={section.title}
    >
      <div class={styles.cardTop}>
        <span class={styles.disc} aria-hidden="true">
          <Dynamic component={iconForDrill(section.drillId)} size={20} />
        </span>
        <span class={styles.names}>
          <span class={styles.name}>{section.title}</span>
          <span class={styles.small}>
            {stationTitle(faculty)} ·{' '}
            {section.items ? 'what you answer as what' : 'which way it went'}
          </span>
        </span>
      </div>
      <Show when={shown().length < section.labels.length}>
        <p class={styles.note}>Only the ones with a mix-up.</p>
      </Show>
      <div class={styles.mapScroll}>
        <div
          class={styles.map}
          role="table"
          aria-label={`${section.title}: down the side what played, across the top what you answered`}
          style={{ '--cols': String(shown().length) }}
        >
          <div role="row" class={styles.mapRow}>
            <span role="columnheader">
              <span class={bench.srOnly}>What played</span>
            </span>
            <For each={shown()}>
              {(label) => (
                <span
                  role="columnheader"
                  class={styles.colHead}
                  aria-label={section.spoken(label)}
                >
                  {section.short(label)}
                </span>
              )}
            </For>
          </div>
          <For each={shown()}>
            {(row) => (
              <div role="row" class={styles.mapRow}>
                <span
                  role="rowheader"
                  class={styles.rowHead}
                  aria-label={section.spoken(row)}
                >
                  {section.short(row)}
                </span>
                <For each={shown()}>
                  {(col) => {
                    const right = (): boolean => section.items && row === col
                    const count = (): number => (right() ? 0 : cell(row, col))
                    const hot = (): boolean =>
                      count() > 0 && count() === matrix().maxCount
                    const said = (): string =>
                      right()
                        ? `${section.spoken(row)}: the right answer`
                        : `${section.spoken(row)} answered as ${section.spoken(col)}: ${count() === 0 ? 'never' : timesWord(count())}`
                    return (
                      <span
                        role="cell"
                        class={styles.cell}
                        classList={{
                          [styles.cellRight]: right(),
                          [styles.cellMiss]: count() > 0,
                          [styles.cellHot]: hot(),
                        }}
                        style={
                          count() > 0
                            ? {
                                '--heat': (
                                  0.16 +
                                  (0.5 * count()) / matrix().maxCount
                                ).toFixed(2),
                              }
                            : undefined
                        }
                        aria-label={said()}
                        data-count={count()}
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
      <ul class={styles.slips} aria-label={`${section.title}: what slips most`}>
        <For each={props.map.top}>
          {(confusion) => (
            <li class={styles.slip}>
              <span class={styles.slipDot} aria-hidden="true" />
              <span class={styles.slipWords}>
                You answer <b>{section.spoken(confusion.expected)}</b> as{' '}
                <b>{section.spoken(confusion.answered)}</b>
              </span>
              <span class={styles.slipCount}>{timesWord(confusion.count)}</span>
            </li>
          )}
        </For>
      </ul>
    </section>
  )
}

/* ── Drills with nothing to show yet ─────────────────────────── */

function QuietRow(props: {
  drillIds: readonly string[]
  testId: string
  children: JSX.Element
}): JSX.Element {
  return (
    <div class={`${styles.card} ${styles.quiet}`} data-testid={props.testId}>
      <span class={styles.quietIcons} aria-hidden="true">
        <For each={props.drillIds}>
          {(drillId) => (
            <span
              class={`${styles.disc} ${styles.discSmall}`}
              data-faculty={stationOf(drillId) ?? undefined}
            >
              <Dynamic component={iconForDrill(drillId)} size={16} />
            </span>
          )}
        </For>
      </span>
      <p>{props.children}</p>
    </div>
  )
}
