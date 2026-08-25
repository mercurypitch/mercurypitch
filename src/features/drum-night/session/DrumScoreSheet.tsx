// ============================================================
// Drum Score Sheet — windowed semantic percussion notation
// ============================================================
//
// THESIS: A real imported drum part reads as notation, not a piano roll.
// OWN-WORLD: Vellum marks, nickel staff lines, cyan playhead, amber accents.
// STORY: Read authored bars, follow one shared playhead, inspect exact events.
// FIRST VIEWPORT: Four desktop or two phone-ready bars, never an unbounded DOM.
// FORM: Pocket Console score view, extending the approved Kit Horizon world.

import type { Accessor, JSX } from 'solid-js'
import { createMemo, createSignal, createUniqueId, For, Match, onCleanup, onMount, Show, Switch, } from 'solid-js'
import type { DrumScoreDocument, DrumScoreEvent, DrumScoreIndex, DrumScoreWindow, } from './drum-score'
import { createDrumScoreIndex, drumScoreEventsNearBeat, drumScoreNextEvent, drumScoreWindow, drumScoreWindowBeatX, } from './drum-score'
import type { DrumSessionImportState } from './drum-session'
import { readyDrumSessionDocument } from './drum-session'
import styles from './DrumNightSessionViews.module.css'
import { DrumSessionStateView } from './DrumSessionStateView'

const MIN_BAR_WIDTH = 176
const SCORE_LEFT = 64
const SCORE_HEIGHT = 244

export interface DrumScoreSheetProps {
  session: Accessor<DrumSessionImportState>
  playheadBeat: Accessor<number>
  /** Reuse one whole-song index across score, seat and coaching surfaces. */
  scoreIndex?: Accessor<DrumScoreIndex | null>
  /** Pass a responsive accessor: four bars on desktop, two at phone width. */
  visibleBarCount?: Accessor<2 | 4>
}

function staffY(event: DrumScoreEvent): number {
  return 134 - event.voice.staffStep * 10
}

function eventVelocityRadius(event: DrumScoreEvent): number {
  return 4.5 + (event.hit.velocity / 127) * 2.5
}

function formattedQuarterPosition(event: DrumScoreEvent): string {
  const position = Math.round((event.beatInBar + 1) * 100) / 100
  return Number.isInteger(position) ? `${position}` : position.toFixed(2)
}

function sourceEvidence(event: DrumScoreEvent): string {
  const source = event.hit.source
  if (source === undefined) return 'source articulation not supplied'
  if (source.format === 'midi') {
    const channel =
      source.channel === undefined ? '' : `, MIDI channel ${source.channel + 1}`
    const key =
      source.midiKey === undefined ? '' : `, source key ${source.midiKey}`
    return `MIDI source${channel}${key}`
  }

  const sourceLabel = source.label?.trim()
  const details = [
    sourceLabel !== undefined && sourceLabel !== ''
      ? `label ${sourceLabel}`
      : null,
    source.articulationId === undefined
      ? null
      : `articulation ${source.articulationId}`,
    source.articulationIndex === undefined
      ? null
      : `table index ${source.articulationIndex}`,
    source.midiKey === undefined ? null : `source value ${source.midiKey}`,
  ].filter((detail): detail is string => detail !== null)
  return details.length === 0
    ? 'Guitar Pro source articulation retained without a label'
    : `Guitar Pro ${details.join(', ')}`
}

function writtenDuration(event: DrumScoreEvent): string {
  const duration = event.hit.writtenDuration
  return duration === undefined
    ? 'one-shot; no written duration supplied'
    : `written duration ${Math.round(duration * 100) / 100} quarter-note beats`
}

function eventDescription(event: DrumScoreEvent): string {
  return `${event.voice.label}, bar ${event.barIndex + 1}, quarter-note position ${formattedQuarterPosition(event)}, velocity ${event.hit.velocity}, ${writtenDuration(event)}, ${sourceEvidence(event)}`
}

interface ScoreNoteheadProps {
  event: DrumScoreEvent
  x: number
  active: boolean
}

function ScoreNotehead(props: ScoreNoteheadProps): JSX.Element {
  const y = (): number => staffY(props.event)
  const radius = (): number => eventVelocityRadius(props.event)
  const stemEndY = (): number =>
    props.event.voice.stemDirection === 'up' ? y() - 38 : y() + 38

  return (
    <g
      class={styles.scoreEvent}
      classList={{ [styles.isActive]: props.active }}
      data-gm-key={props.event.hit.gmKey}
      data-velocity={props.event.hit.velocity}
      aria-hidden="true"
    >
      <Switch>
        <Match when={props.event.voice.notehead === 'cross'}>
          <path
            d={`M${props.x - radius()} ${y() - radius()}L${props.x + radius()} ${y() + radius()}M${props.x + radius()} ${y() - radius()}L${props.x - radius()} ${y() + radius()}`}
          />
        </Match>
        <Match when={props.event.voice.notehead === 'diamond'}>
          <path
            d={`M${props.x} ${y() - radius()}L${props.x + radius()} ${y()}L${props.x} ${y() + radius()}L${props.x - radius()} ${y()}Z`}
          />
        </Match>
        <Match when={props.event.voice.notehead === 'normal'}>
          <ellipse cx={props.x} cy={y()} rx={radius()} ry={radius() * 0.72} />
        </Match>
      </Switch>
      <path
        class={styles.noteStem}
        d={
          props.event.voice.stemDirection === 'up'
            ? `M${props.x + radius()} ${y()}V${stemEndY()}`
            : `M${props.x - radius()} ${y()}V${stemEndY()}`
        }
      />
      <Show when={props.event.hit.velocity >= 108}>
        <path
          class={styles.accentMark}
          d={`M${props.x - 7} ${y() - 55}L${props.x} ${y() - 60}L${props.x + 7} ${y() - 55}`}
        />
      </Show>
    </g>
  )
}

function nowCopy(index: DrumScoreIndex, beat: number): string {
  const sounding = drumScoreEventsNearBeat(index, beat)
  if (sounding.events.length > 0) {
    const labels = [
      ...new Set(sounding.events.map((event) => event.voice.label)),
    ]
    const visibleLabels = labels.slice(0, 4)
    const hiddenVoiceCopy =
      labels.length <= visibleLabels.length
        ? ''
        : `, plus ${labels.length - visibleLabels.length} more mapped ${labels.length - visibleLabels.length === 1 ? 'voice' : 'voices'}`
    const simultaneousCopy =
      sounding.sourceEventCount <= labels.length
        ? ''
        : ` · ${sounding.sourceEventCount} simultaneous hits`
    const omittedCopy =
      sounding.omittedEventCount === 0
        ? ''
        : ` · ${sounding.omittedEventCount} outside the highlight limit`
    return `Now: ${visibleLabels.join(', ')}${hiddenVoiceCopy}${simultaneousCopy}${omittedCopy}`
  }
  const next = drumScoreNextEvent(index, beat)
  return next === null
    ? 'No later mapped hit within the score range'
    : `Next: ${next.voice.label} in bar ${next.barIndex + 1}`
}

function currentBarNumber(score: DrumScoreDocument, beat: number): number {
  const safeBeat = Number.isFinite(beat) ? Math.max(0, beat) : 0
  let low = 0
  let high = score.bars.length - 1
  while (low < high) {
    const mid = (low + high + 1) >> 1
    if ((score.bars[mid]?.startBeat ?? Number.POSITIVE_INFINITY) <= safeBeat) {
      low = mid
    } else {
      high = mid - 1
    }
  }
  return low + 1
}

function tempoCopy(score: DrumScoreDocument): string {
  return `${score.bpm} BPM opening · ${score.tempoChangeCount} ${score.tempoChangeCount === 1 ? 'tempo change' : 'tempo changes'}`
}

function omissionCopy(
  score: DrumScoreDocument,
  window: DrumScoreWindow,
): string | null {
  const parts: string[] = []
  if (window.omittedEventCount > 0) {
    parts.push(
      `${window.omittedEventCount} mapped ${window.omittedEventCount === 1 ? 'hit in these bars is' : 'hits in these bars are'} outside the ${window.events.length}-event display limit`,
    )
  }
  if (score.outOfRangeHitCount > 0) {
    parts.push(
      `${score.outOfRangeHitCount} ${score.outOfRangeHitCount === 1 ? 'hit falls' : 'hits fall'} beyond the 4,096-bar safety range`,
    )
  }
  return parts.length === 0
    ? null
    : `${parts.join('. ')}. None were moved into the last bar.`
}

interface MeterMark {
  readonly barIndex: number
  readonly localBarIndex: number
  readonly numerator: number
  readonly denominator: number
}

function meterAtBeat(
  score: DrumScoreDocument,
  beat: number,
): { readonly numerator: number; readonly denominator: number } {
  let selected = score.timeSignatures[0]!
  for (const signature of score.timeSignatures) {
    if (signature.beat > beat) break
    selected = signature
  }
  return selected
}

function meterMarks(
  score: DrumScoreDocument,
  window: DrumScoreWindow,
): readonly MeterMark[] {
  const marks: MeterMark[] = []
  let previous: ReturnType<typeof meterAtBeat> | null = null
  window.bars.forEach((bar, localBarIndex) => {
    const meter = meterAtBeat(score, bar.startBeat)
    if (
      localBarIndex === 0 ||
      previous === null ||
      meter.numerator !== previous.numerator ||
      meter.denominator !== previous.denominator
    ) {
      marks.push({
        barIndex: bar.index,
        localBarIndex,
        numerator: meter.numerator,
        denominator: meter.denominator,
      })
    }
    previous = meter
  })
  return marks
}

export function DrumScoreSheet(props: DrumScoreSheetProps): JSX.Element {
  const titleId = `drum-score-title-${createUniqueId()}`
  const descriptionId = `drum-score-description-${createUniqueId()}`
  const [viewportWidth, setViewportWidth] = createSignal(0)
  let viewportRef: HTMLDivElement | undefined
  let resizeObserver: ResizeObserver | null = null
  const document = createMemo(() => readyDrumSessionDocument(props.session()))
  const index = createMemo(() => {
    const provided = props.scoreIndex?.()
    if (provided !== undefined && provided !== null) return provided
    const current = document()
    return current === null ? null : createDrumScoreIndex(current)
  })
  const score = createMemo(() => index()?.score ?? null)
  const visibleBarCount = createMemo(() => props.visibleBarCount?.() ?? 4)
  const windowAnchorBeat = createMemo(() => {
    const current = score()
    if (current === null) return 0
    const barCount = visibleBarCount()
    const currentBar = currentBarNumber(current, props.playheadBeat()) - 1
    const pageStart = Math.floor(currentBar / barCount) * barCount
    const startBar = Math.min(pageStart, Math.max(0, current.bars.length - 1))
    return current.bars[startBar]?.startBeat ?? 0
  })
  const window = createMemo((): DrumScoreWindow | null => {
    const current = index()
    return current === null
      ? null
      : drumScoreWindow(current, windowAnchorBeat(), {
          barCount: visibleBarCount(),
        })
  })
  const renderedBarCount = createMemo(() =>
    Math.max(1, window()?.bars.length ?? 1),
  )
  const canvasWidth = createMemo(() =>
    Math.max(
      viewportWidth(),
      SCORE_LEFT * 2 + renderedBarCount() * MIN_BAR_WIDTH,
    ),
  )
  const barWidth = createMemo(
    () => (canvasWidth() - SCORE_LEFT * 2) / renderedBarCount(),
  )
  const playheadX = createMemo(() => {
    const current = window()
    return current === null
      ? SCORE_LEFT
      : drumScoreWindowBeatX(
          current,
          props.playheadBeat(),
          barWidth(),
          SCORE_LEFT,
        )
  })
  const activeEvents = createMemo(() => {
    const current = index()
    return current === null
      ? []
      : drumScoreEventsNearBeat(current, props.playheadBeat()).events
  })
  const activeHits = createMemo(
    () => new Set(activeEvents().map((event) => event.hit)),
  )
  const announcedBar = createMemo(() => {
    const current = score()
    return current === null
      ? null
      : currentBarNumber(current, props.playheadBeat())
  })

  const measureViewport = (): void => {
    const width = viewportRef?.clientWidth ?? 0
    if (!Number.isFinite(width) || width <= 0) return
    setViewportWidth(Math.round(width))
  }

  const setViewportRef = (element: HTMLDivElement): void => {
    if (viewportRef !== undefined && viewportRef !== element) {
      resizeObserver?.unobserve(viewportRef)
    }
    viewportRef = element
    measureViewport()
    resizeObserver?.observe(element)
  }

  onMount(() => {
    measureViewport()
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver((entries) => {
        const width = entries[0]?.contentRect.width ?? 0
        if (Number.isFinite(width) && width > 0) {
          setViewportWidth(Math.round(width))
          return
        }
        measureViewport()
      })
    }
    if (resizeObserver !== null && viewportRef !== undefined) {
      resizeObserver.observe(viewportRef)
    }
    globalThis.window.addEventListener('resize', measureViewport)
    onCleanup(() => {
      resizeObserver?.disconnect()
      globalThis.window.removeEventListener('resize', measureViewport)
    })
  })

  return (
    <Show
      when={score()}
      keyed
      fallback={<DrumSessionStateView state={props.session} context="score" />}
    >
      {(currentScore) => {
        const currentIndex = index()!
        return (
          <Show when={window()} keyed>
            {(currentWindow) => {
              const omitted = omissionCopy(currentScore, currentWindow)
              const meters = meterMarks(currentScore, currentWindow)
              const meterDescription = meters
                .map(
                  (meter) =>
                    `bar ${meter.barIndex + 1}: ${meter.numerator}/${meter.denominator}`,
                )
                .join(', ')
              return (
                <section class={styles.scoreSheet} aria-labelledby={titleId}>
                  <header class={styles.viewHeader}>
                    <div>
                      <span class={styles.viewKicker}>Percussion score</span>
                      <h2 id={titleId}>{currentScore.title}</h2>
                    </div>
                    <p>
                      {currentScore.hitCount} mapped hits · authored attack span{' '}
                      {currentScore.durationBeats.toFixed(2)} quarter-note beats
                      · {tempoCopy(currentScore)}
                    </p>
                  </header>

                  <figure class={styles.scoreFigure}>
                    <div
                      ref={setViewportRef}
                      class={styles.scoreViewport}
                      tabindex="0"
                      aria-label="Windowed percussion score"
                    >
                      <svg
                        class={styles.scoreSvg}
                        width={canvasWidth()}
                        height={SCORE_HEIGHT}
                        viewBox={`0 0 ${canvasWidth()} ${SCORE_HEIGHT}`}
                        preserveAspectRatio="none"
                        role="img"
                        aria-labelledby={`${titleId} ${descriptionId}`}
                      >
                        <desc id={descriptionId}>
                          Bars {currentWindow.startBarIndex + 1} through{' '}
                          {currentWindow.endBarIndex + 1}, with{' '}
                          {currentWindow.events.length} indexed authored
                          percussion hits. Note size reflects source velocity.
                          The cyan line follows the shared session playhead.
                          Meter: {meterDescription}.
                        </desc>
                        <For each={currentWindow.bars}>
                          {(bar, localIndex) => {
                            const x = () =>
                              SCORE_LEFT + localIndex() * barWidth()
                            return (
                              <g class={styles.scoreBar} aria-hidden="true">
                                <For each={[94, 114, 134, 154, 174]}>
                                  {(y) => (
                                    <path
                                      d={`M${x()} ${y}H${x() + barWidth()}`}
                                    />
                                  )}
                                </For>
                                <path
                                  class={styles.barLine}
                                  d={`M${x()} 86V182`}
                                />
                                <text x={x() + 10} y="76">
                                  {bar.index + 1}
                                </text>
                              </g>
                            )
                          }}
                        </For>
                        <For each={meters}>
                          {(meter) => (
                            <text
                              class={styles.scoreMeterMark}
                              x={
                                SCORE_LEFT +
                                meter.localBarIndex * barWidth() +
                                12
                              }
                              y="211"
                              aria-hidden="true"
                            >
                              {meter.numerator}/{meter.denominator}
                            </text>
                          )}
                        </For>
                        <path
                          class={styles.barLine}
                          d={`M${canvasWidth() - SCORE_LEFT} 86V182`}
                          aria-hidden="true"
                        />
                        <For each={currentWindow.events}>
                          {(event) => (
                            <ScoreNotehead
                              event={event}
                              x={drumScoreWindowBeatX(
                                currentWindow,
                                event.hit.startBeat,
                                barWidth(),
                                SCORE_LEFT,
                              )}
                              active={activeHits().has(event.hit)}
                            />
                          )}
                        </For>
                        <path
                          class={styles.scorePlayhead}
                          d={`M${playheadX()} 54V194`}
                          aria-hidden="true"
                        />
                      </svg>
                    </div>
                    <figcaption>
                      <span>{nowCopy(currentIndex, props.playheadBeat())}</span>
                      <span aria-live="polite">
                        Bar {announcedBar() ?? '—'} · showing{' '}
                        {currentWindow.bars.length}{' '}
                        {currentWindow.bars.length === 1 ? 'bar' : 'bars'}
                      </span>
                    </figcaption>
                  </figure>

                  <ul
                    class={styles.scoreMeterSummary}
                    aria-label="Meter in displayed score"
                  >
                    <For each={meters}>
                      {(meter) => (
                        <li>
                          Bar {meter.barIndex + 1} · {meter.numerator}/
                          {meter.denominator}
                        </li>
                      )}
                    </For>
                  </ul>

                  <details class={styles.semanticEvents}>
                    <summary>Read this score window as an event list</summary>
                    <ol>
                      <For each={currentWindow.semanticEvents}>
                        {(event) => <li>{eventDescription(event)}</li>}
                      </For>
                    </ol>
                    <Show when={currentWindow.semanticOmittedCount > 0}>
                      <p class={styles.semanticLimitNotice}>
                        {currentWindow.semanticOmittedCount} more events in this
                        score window are drawn but omitted from the semantic
                        list.
                      </p>
                    </Show>
                  </details>
                  <Show when={omitted !== null}>
                    <p class={styles.mappingNotice} role="status">
                      {omitted}
                    </p>
                  </Show>
                  <Show when={currentScore.droppedHitCount > 0}>
                    <p class={styles.mappingNotice} role="status">
                      {currentScore.droppedHitCount} unsupported source{' '}
                      {currentScore.droppedHitCount === 1
                        ? 'event was'
                        : 'events were'}{' '}
                      reported but not mapped, drawn, or substituted.
                    </p>
                  </Show>
                </section>
              )
            }}
          </Show>
        )
      }}
    </Show>
  )
}
