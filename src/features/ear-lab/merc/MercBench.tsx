// ============================================================
// MercBench — the Ear Lab tab with Merc (EAR_LAB_WITH_MERC).
//
// One room, one action, in the drill room's light (the bench mock-ups,
// approved 31 Oct). The Regulator Room at night with Merc on the desk,
// his line tied to the one filled button; the Mercury Index as the
// sealed plate draws it, or the bench's own words before a seal (and,
// before anything is measured, that today's three make the first); the
// glass, sealed fill and dated notch, practice only ever a faint
// labelled line, Calibrate beside it as the outlined second choice;
// Today, with its one filled button; the Ear rooms on a build that has
// them; the six stations in fixed slots, each in its own two lights,
// with its number, where the number comes from and which way is better;
// the Ear Path's orbs and next milestone; and the Ear Report, in a line.
//
// A run started here comes back here: Done returns to Today or to the
// station's sheet, the number it moved lit once.
// ============================================================

import type { JSX } from 'solid-js'
import { createEffect, createMemo, createSignal, For, on, onCleanup, onMount, Show, untrack, } from 'solid-js'
import { Dynamic, Portal } from 'solid-js/web'
import { MercPresence } from '@/components/room-kit/MercPresence'
import { VIEW_FOR_DRILL } from '@/features/ear-lab/drill-views'
import { IconCheck, IconChevron, IconEar, IconPlay, } from '@/features/ear-lab/ear-icons'
import type { EarLabView } from '@/features/ear-lab/EarLabDashboard'
import { headline } from '@/features/ear-lab/EarLabDashboard'
import { attemptedIds, currentEarPath } from '@/features/ear-lab/EarPath'
import { INSTRUMENT_ICON } from '@/features/ear-lab/instrument-icons'
import type { Instrument } from '@/features/ear-lab/instruments'
import { dateLabel, instrumentReading, INSTRUMENTS, } from '@/features/ear-lab/instruments'
import { requestRoomStart } from '@/features/ear-lab/stage-room'
import type { FacultyId } from '@/lib/ear/drills'
import { nextOnPath, pathCount } from '@/lib/ear/path'
import type { SprintSegment } from '@/lib/ear/sprint'
import { armSprintSegment, calibrationHistory, completeSprint, earToday, isSprintComplete, latestCalibration, sprintHistory, sprintProgress, todaysSprint, } from '@/stores/ear-lab-store'
import { registerRoomBack } from '@/stores/native-shell-store'
import { useWakeAudio } from './audio-wake'
import styles from './bench.module.css'
import { Glass, practiceEstimate } from './Glass'
import { IconQuestion } from './merc-icons'
import { benchDays, benchLine, FIRST_RUN_HEADLINE, glassCaption, REPORT_LINE, startLabel, TASK, } from './merc-lines'
import { PathOrbs } from './PathOrbs'
import { renewReminders } from './reminder'
import roomStyles from './room.module.css'
import { litAtOpen, setRoomOrigin, takeReturn } from './session'
import { HelpSheet } from './Sheets'
import { drillName, STATION_ORDER, stationCast, stationInstruments, stationReading, stationTitle, wildSongs, } from './stations'
import { StationSheet } from './StationSheet'
import { mercStill } from './stills'
import { TodayDone } from './TodayDone'

function segmentLength(segment: SprintSegment): string {
  return segment.kind === 'identification'
    ? `${segment.rounds} rounds`
    : `${segment.reversals} turns`
}

export interface MercBenchProps {
  onNavigate: (view: EarLabView) => void
  /** The Ear rooms row, on a build that carries them. */
  rooms?: JSX.Element
}

export function MercBench(props: MercBenchProps): JSX.Element {
  const wake = useWakeAudio()

  // ── Coming back from a run ────────────────────────────────────
  const returning = takeReturn()
  const [lit, setLit] = createSignal<string | null>(returning?.drillId ?? null)
  const [sheet, setSheet] = createSignal<FacultyId | null>(
    returning?.origin.kind === 'station' ? returning.origin.faculty : null,
  )
  const [dayDone, setDayDone] = createSignal(returning?.todayDone === true)
  const [help, setHelp] = createSignal(false)
  let todayCard: HTMLElement | undefined
  onMount(() => {
    if (returning?.origin.kind === 'today' && !dayDone()) {
      todayCard?.scrollIntoView({ block: 'center' })
    }
    // The light is once: a later visit shows the number plain.
    setTimeout(() => setLit(null), 2600)
  })
  // Android's back closes what the bench laid over the tab, the top
  // one first, before it leaves the tab.
  createEffect(() => {
    if (sheet() === null && !dayDone() && !help()) return
    onCleanup(
      // eslint-disable-next-line solid/reactivity -- answers each press of Back, like a handler
      registerRoomBack(() => {
        if (help()) setHelp(false)
        else if (sheet() !== null) setSheet(null)
        else setDayDone(false)
        return true
      }),
    )
  })

  // ── What the bench reads ──────────────────────────────────────
  const plan = createMemo(() => todaysSprint())
  const done = createMemo(() => new Set(sprintProgress().done))
  const remaining = () => plan().filter((s) => !done().has(s.drillId))
  const nextSegment = () => remaining()[0] ?? null
  const firstRun = createMemo(
    () => attemptedIds().size === 0 && latestCalibration() === null,
  )
  const milestones = createMemo(() => currentEarPath())
  // The orbs lit as the day opened, for the day's close: read once.
  const openedLit = untrack(() =>
    litAtOpen(
      earToday(),
      milestones()
        .filter((milestone) => milestone.lit)
        .map((milestone) => milestone.id),
    ),
  )
  // A day whose three are all done closes, as the bench's card does.
  createEffect(() => {
    if (plan().length > 0 && remaining().length === 0 && !isSprintComplete()) {
      completeSprint()
    }
  })
  // The morning reminders, if they were asked for: laid out again as the
  // Ear Lab opens, and as the day closes, which takes today's away.
  const dayClosed = createMemo(() => isSprintComplete())
  createEffect(on(dayClosed, (closed) => void renewReminders(closed)))

  const line = createMemo(() =>
    firstRun() ? { ...FIRST_RUN_HEADLINE, lede: '' } : headline(),
  )
  const sealed = () => latestCalibration()
  const estimate = () => practiceEstimate()
  /** The Index's move from the seal before: up is a finer ear. */
  const indexMove = (): { text: string; up: boolean } | null => {
    const [latest, before] = calibrationHistory()
    if (latest === undefined || before === undefined) return null
    const move = latest.index - before.index
    if (move === 0) return null
    return {
      text: `${move > 0 ? '+' : '\u2212'}${Math.abs(move)}`,
      up: move > 0,
    }
  }
  /** Today's place in the days at the bench: finished days, and today
   *  until it is finished too. */
  const day = () => sprintHistory().length + (isSprintComplete() ? 0 : 1)

  const merc = () => {
    const next = nextSegment()
    return benchLine({
      left: remaining().length,
      next: next === null ? null : drillName(next.drillId),
      firstRun: firstRun(),
    })
  }

  // ── Ways in ───────────────────────────────────────────────────
  const startToday = (segment: SprintSegment): void => {
    const view = VIEW_FOR_DRILL[segment.drillId]
    if (view === undefined) return
    wake()
    armSprintSegment(segment)
    setRoomOrigin({ kind: 'today' })
    requestRoomStart({ drillId: segment.drillId })
    props.onNavigate(view)
  }

  const startInstrument = (
    faculty: FacultyId,
    instrument: Instrument,
  ): void => {
    setSheet(null)
    setRoomOrigin({ kind: 'station', faculty })
    // The desk opens on its own landing; every other drill starts its run.
    if (instrument.drillId !== null && instrument.view !== 'desk') {
      wake()
      requestRoomStart({ drillId: instrument.drillId })
    }
    props.onNavigate(instrument.view)
  }

  const calibrate = (): void => {
    setRoomOrigin({ kind: 'bench' })
    props.onNavigate('calibration')
  }

  const start = () => {
    const segment = nextSegment()
    if (segment === null) return null
    return {
      segment,
      ...startLabel({
        name: drillName(segment.drillId),
        firstRun: firstRun(),
      }),
    }
  }

  const stationLabel = (faculty: FacultyId): string => {
    const cast = stationInstruments(faculty)
      .map((instrument) => instrument.name)
      .join(', ')
    const reading = stationReading(faculty)
    if (faculty === 'wild') return `Wild: the Field Book. ${wildSongs()}.`
    if (reading === null)
      return `${stationTitle(faculty)}: ${cast}. Unmeasured.`
    return `${stationTitle(faculty)}: ${cast}. ${reading.value}${
      reading.unit === '' ? '' : ` ${reading.unit}`
    }, ${reading.status}. ${reading.direction}.`
  }

  const litFaculty = () => {
    const drill = lit()
    if (drill === null) return null
    return INSTRUMENTS.find((i) => i.drillId === drill)?.faculty ?? null
  }

  return (
    <div class={styles.bench} data-testid="merc-bench" id="ear-lab-panel">
      <div class={styles.hero}>
        <img
          class={styles.painting}
          src="/ear-lab/regulator-room-portrait.webp"
          alt=""
          aria-hidden="true"
          draggable={false}
        />
        <div class={styles.heroNight} aria-hidden="true" />
        <div class={styles.heroShade} aria-hidden="true" />
        <div class={styles.topBar}>
          <h1 class={styles.tabTitle}>Ear Lab</h1>
          <button
            type="button"
            class={styles.round}
            aria-label="About the bench, and why there is no percent"
            data-testid="merc-bench-help"
            onClick={() => setHelp(true)}
          >
            <IconQuestion size={20} />
          </button>
        </div>
        <div class={styles.mercGlow} aria-hidden="true" />
        <div class={styles.deskShadow} aria-hidden="true" />
        <div class={styles.mercOnDesk}>
          <MercPresence
            state={() => 'point'}
            stillSrc={mercStill('point')}
            alt="Merc on the desk, pointing down at Today"
            size={104}
            testId="merc-bench-merc"
          />
        </div>
        <div class={styles.heroBubble} data-testid="merc-bench-line">
          <p>{merc()}</p>
        </div>
      </div>

      <div class={styles.sections}>
        <div>
          <div class={styles.indexHead}>
            <p class={styles.kicker}>Mercury Index</p>
            <span class={styles.badge} data-testid="merc-index-badge">
              {sealed() === null ? 'Not sealed' : 'Sealed'}
            </span>
          </div>
          <h2 class={styles.headline} data-testid="ear-bench-title">
            <Show when={sealed()} fallback={line().lead}>
              {(seal) => (
                <>
                  <span class={styles.srOnly}>{line().lead}</span>
                  <span class={styles.number} aria-hidden="true">
                    {seal().index}
                  </span>
                  <Show when={indexMove()}>
                    {(move) => (
                      <span
                        class={styles.indexMove}
                        classList={{ [styles.indexUp]: move().up }}
                        aria-hidden="true"
                      >
                        {move().text}
                      </span>
                    )}
                  </Show>
                </>
              )}
            </Show>
          </h2>
          <p class={styles.lede}>{line().rest}</p>
          <div class={styles.glassRow}>
            <Glass
              sealed={sealed()?.index ?? null}
              sealedOn={sealed() ? dateLabel(sealed()?.at ?? 0) : null}
              estimate={estimate()}
            />
            <button
              type="button"
              class={styles.calibrate}
              data-testid="merc-calibrate"
              onClick={calibrate}
            >
              Calibrate
            </button>
          </div>
          <p class={styles.caption}>
            {glassCaption({
              sealed: sealed()?.index ?? null,
              sealedOn: sealed() ? dateLabel(sealed()?.at ?? 0) : null,
              estimate: estimate(),
            })}
          </p>
        </div>

        <section
          class={styles.card}
          classList={{
            [styles.lit]: lit() !== null && returning?.origin.kind === 'today',
          }}
          aria-labelledby="merc-today"
          ref={todayCard}
          data-testid="merc-today"
        >
          <div class={styles.cardHead}>
            <h2 id="merc-today" class={styles.h2}>
              Today
            </h2>
            <span class={styles.count}>
              {plan().length - remaining().length} of {plan().length}
              {remaining().length === plan().length
                ? ' · about 3 min'
                : ' done'}
            </span>
            <span class={styles.days}>{benchDays(Math.max(1, day()))}</span>
          </div>
          <ul class={styles.todayList}>
            <For each={plan()}>
              {(segment) => {
                const finished = () => done().has(segment.drillId)
                const instrument = INSTRUMENTS.find(
                  (entry) => entry.drillId === segment.drillId,
                )
                const reading = () =>
                  instrument === undefined
                    ? null
                    : instrumentReading(instrument)
                return (
                  <li
                    class={styles.todayRow}
                    classList={{
                      [styles.todayDone]: finished(),
                      [styles.lit]: finished() && lit() === segment.drillId,
                    }}
                    data-testid="merc-today-row"
                    data-drill={segment.drillId}
                  >
                    <Show
                      when={finished()}
                      fallback={
                        <span
                          class={styles.todayDot}
                          classList={{
                            [styles.todayDotNext]:
                              nextSegment()?.drillId === segment.drillId,
                          }}
                          aria-hidden="true"
                        />
                      }
                    >
                      <span class={styles.todayCheck}>
                        <IconCheck size={12} />
                        <span class={styles.srOnly}>Done:</span>
                      </span>
                    </Show>
                    <span class={styles.todayName}>
                      {drillName(segment.drillId)}
                    </span>
                    <span>
                      <Show
                        when={finished() && reading()}
                        fallback={`${TASK[segment.drillId] ?? ''} · ${segmentLength(segment)}`}
                      >
                        {(now) =>
                          `${now().value}${now().unit === '' ? '' : ` ${now().unit}`}${
                            now().settling ? ' · settling' : ''
                          }`
                        }
                      </Show>
                    </span>
                  </li>
                )
              }}
            </For>
          </ul>
          <Show
            when={start()}
            fallback={
              <button
                type="button"
                class={styles.quiet}
                data-testid="merc-today-close"
                onClick={() => setDayDone(true)}
              >
                All three done. See the day
              </button>
            }
          >
            {(next) => (
              <button
                type="button"
                class={styles.primary}
                data-testid="merc-today-start"
                onClick={() => startToday(next().segment)}
              >
                <IconPlay size={18} />
                {next().label}
                <small>· {next().sub}</small>
              </button>
            )}
          </Show>
        </section>

        {props.rooms}

        <section aria-labelledby="merc-stations">
          <div class={styles.sectionHead}>
            <h2 id="merc-stations" class={styles.h2}>
              Stations
            </h2>
            <span class={styles.count}>{INSTRUMENTS.length} instruments</span>
          </div>
          <div class={styles.stations}>
            <For each={STATION_ORDER}>
              {(faculty) => {
                const lead = stationInstruments(faculty)[0]
                const Icon =
                  faculty === 'wild' || lead === undefined
                    ? IconEar
                    : INSTRUMENT_ICON[lead.view]
                const reading = () => stationReading(faculty)
                return (
                  <button
                    type="button"
                    class={styles.station}
                    classList={{ [styles.lit]: litFaculty() === faculty }}
                    aria-label={stationLabel(faculty)}
                    data-testid="merc-station"
                    data-faculty={faculty}
                    onClick={() => setSheet(faculty)}
                  >
                    <span class={styles.stationTop} aria-hidden="true">
                      <span class={styles.stationIcon}>
                        <Dynamic component={Icon} size={22} />
                      </span>
                      <span class={styles.stationNames}>
                        <span class={styles.stationTitle}>
                          {stationTitle(faculty)}
                        </span>
                        <span class={styles.stationCast}>
                          {stationCast(faculty)}
                        </span>
                      </span>
                    </span>
                    <Show
                      when={faculty !== 'wild' || reading() !== null}
                      fallback={
                        <>
                          <span class={styles.stationEmpty} aria-hidden="true">
                            {wildSongs()}
                          </span>
                          <span
                            class={styles.stationDirection}
                            aria-hidden="true"
                          >
                            rated per song
                          </span>
                        </>
                      }
                    >
                      <Show
                        when={reading()}
                        fallback={
                          <>
                            <span
                              class={styles.stationEmpty}
                              aria-hidden="true"
                            >
                              Unmeasured
                            </span>
                            <span
                              class={styles.stationDirection}
                              aria-hidden="true"
                            >
                              {faculty === 'resolution' || faculty === 'time'
                                ? 'lower is finer'
                                : 'higher is stronger'}
                            </span>
                          </>
                        }
                      >
                        {(now) => (
                          <>
                            <span
                              class={styles.stationReading}
                              aria-hidden="true"
                            >
                              <span
                                class={styles.stationValue}
                                classList={{
                                  [styles.stationValuePractice]: !now().sealed,
                                }}
                              >
                                {now().value}
                                {now().unit === '' ? '' : ` ${now().unit}`}
                              </span>
                              <span class={styles.stationStatus}>
                                {now().status}
                              </span>
                            </span>
                            <span
                              class={styles.stationDirection}
                              aria-hidden="true"
                            >
                              {now().direction}
                            </span>
                          </>
                        )}
                      </Show>
                    </Show>
                  </button>
                )
              }}
            </For>
          </div>
        </section>

        <section class={styles.card} aria-labelledby="merc-path">
          <div class={styles.cardHead}>
            <h2 id="merc-path" class={styles.h2}>
              The Ear Path
            </h2>
            <span class={styles.count}>
              {pathCount(milestones()).lit} of {pathCount(milestones()).of} lit
            </span>
          </div>
          <PathOrbs milestones={milestones()} litToday={null} />
          <p class={styles.pathLine}>
            <Show
              when={nextOnPath(milestones())}
              fallback="Every orb on the path is lit."
            >
              {(next) => `Next milestone: ${next().label}. ${next().note}`}
            </Show>
          </p>
        </section>

        <section class={styles.card}>
          <button
            type="button"
            class={styles.link}
            data-testid="merc-report"
            onClick={() => props.onNavigate('report')}
          >
            <span>
              <b>Ear Report</b>
              <small>{REPORT_LINE}</small>
            </span>
            <IconChevron size={18} class={styles.onward} />
          </button>
        </section>
      </div>

      {/* What the bench lays over the rail goes to <body>: the tab is a
          stacking context the rail sits above (bench.module.css). */}
      <Show when={sheet()}>
        {(faculty) => (
          <Portal>
            <div class={styles.layer}>
              <StationSheet
                faculty={faculty()}
                lit={lit()}
                onStart={(instrument) => startInstrument(faculty(), instrument)}
                onOpenFieldBook={() => {
                  setSheet(null)
                  setRoomOrigin({ kind: 'station', faculty: 'wild' })
                  props.onNavigate('field-book')
                }}
                onClose={() => setSheet(null)}
              />
            </div>
          </Portal>
        )}
      </Show>

      <Show when={dayDone()}>
        <Portal>
          <div class={styles.layer}>
            <TodayDone
              milestones={milestones()}
              litAtOpen={openedLit}
              onReport={() => {
                setDayDone(false)
                props.onNavigate('report')
              }}
              onClose={() => setDayDone(false)}
            />
          </div>
        </Portal>
      </Show>

      <Show when={help()}>
        <Portal>
          <div class={`${roomStyles.room} ${roomStyles.sheetHost}`}>
            <div class={roomStyles.sheetHostInner}>
              <HelpSheet
                name="Ear Lab"
                drillId=""
                description="Your ear, in units that cannot flatter you. The mercury moves only when a sealed calibration says so."
                onClose={() => setHelp(false)}
              />
            </div>
          </div>
        </Portal>
      </Show>
    </div>
  )
}
