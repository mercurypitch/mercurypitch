// Guitar Night score debug — played against authored, drawn, for development only.
// ============================================================
//
// The stage latch says "62%" and nothing else, which is the right amount for a
// player mid-take and useless when the number is wrong. This draws the two
// things the latch is derived from — the authored notes and the strikes that
// were actually heard — on one time/pitch plane, joins each authored note to
// the evidence that explains it, and says in words why that note did or did
// not count.
//
// Never shipped to players: every mount site is behind `import.meta.env.DEV`.
// It renders raw numbers the production surfaces deliberately withhold.

import type { Accessor } from 'solid-js'
import { createEffect, createMemo, createSignal, For, onCleanup, Show, } from 'solid-js'
import { Portal } from 'solid-js/web'
import type { GuitarLiveScoreSkipReason } from '@/lib/guitar/guitar-live-score'
import type { GuitarScoreDebugDiagnosis, GuitarScoreDebugModel, GuitarScoreDebugRow, } from '@/lib/guitar/guitar-score-debug'
import { describeGuitarScoreDiagnosis } from '@/lib/guitar/guitar-score-debug'
import { guitarAnalysisCost } from './guitar-analysis-cost'
import { guitarScoreTuning, resetGuitarScoreTuning, setGuitarScoreTuning, } from './guitar-score-tuning'
import styles from './GuitarNightScoreDebug.module.css'

interface GuitarNightScoreDebugProps {
  model: Accessor<GuitarScoreDebugModel | null>
  /** Transport position inside the pinned range; null when not running. */
  playheadSeconds: Accessor<number | null>
}

const OUTCOME_COLOR: Record<GuitarScoreDebugRow['outcome'], string> = {
  hit: '#34d399',
  miss: '#f87171',
  skipped: '#fbbf24',
  pending: '#64748b',
}

const PLAYED_COLOR = '#38bdf8'
const PLAYED_UNPITCHED_COLOR = '#a78bfa'
const DIFF_COLOR = 'rgba(248, 113, 113, 0.55)'
const HIT_DIFF_COLOR = 'rgba(52, 211, 153, 0.5)'

const SKIP_REASON_ORDER: readonly GuitarLiveScoreSkipReason[] = [
  'input-clipping',
  'input-noisy',
  'input-uncertain',
  'polyphonic-onset',
  'fast-passage',
  'event-gap',
]

const DIAGNOSIS_ORDER: readonly GuitarScoreDebugDiagnosis[] = [
  'matched',
  'no-attack-nearby',
  'attack-without-pitch',
  'clarity-below-floor',
  'octave-off',
  'wrong-pitch',
  'outside-timing-window',
  'event-consumed-elsewhere',
  'excluded',
  'pending',
]

function noteName(midi: number): string {
  const names = [
    'C',
    'C#',
    'D',
    'D#',
    'E',
    'F',
    'F#',
    'G',
    'G#',
    'A',
    'A#',
    'B',
  ]
  return `${names[((midi % 12) + 12) % 12] ?? '?'}${Math.floor(midi / 12) - 1}`
}

function signed(value: number): string {
  return `${value > 0 ? '+' : ''}${value}`
}

export function GuitarNightScoreDebug(props: GuitarNightScoreDebugProps) {
  const [showExpected, setShowExpected] = createSignal(true)
  const [showPlayed, setShowPlayed] = createSignal(true)
  const [showDiffs, setShowDiffs] = createSignal(true)
  const [showExcluded, setShowExcluded] = createSignal(true)
  const [follow, setFollow] = createSignal(true)
  const [windowSeconds, setWindowSeconds] = createSignal(8)
  const [selectedId, setSelectedId] = createSignal<string | null>(null)

  let canvas: HTMLCanvasElement | undefined
  const [size, setSize] = createSignal({ width: 0, height: 0 })

  const attachWrap = (element: HTMLDivElement): void => {
    if (typeof ResizeObserver === 'undefined') {
      setSize({ width: element.clientWidth, height: element.clientHeight })
      return
    }
    const observer = new ResizeObserver(() => {
      setSize({ width: element.clientWidth, height: element.clientHeight })
    })
    observer.observe(element)
    setSize({ width: element.clientWidth, height: element.clientHeight })
    onCleanup(() => observer.disconnect())
  }

  /** Visible time span, following the playhead unless the user pinned it. */
  const span = createMemo(() => {
    const model = props.model()
    if (model === null) return { start: 0, end: 1 }
    const width = Math.max(1, windowSeconds())
    if (!follow())
      return { start: 0, end: Math.max(width, model.durationSeconds) }
    const head = props.playheadSeconds() ?? model.throughSeconds
    const start = Math.max(0, head - width * 0.7)
    return { start, end: start + width }
  })

  const selectedRow = createMemo(() => {
    const id = selectedId()
    if (id === null) return null
    return props.model()?.rows.find((row) => row.targetId === id) ?? null
  })

  const draw = (): void => {
    const element = canvas
    const model = props.model()
    const { width, height } = size()
    if (element === undefined || width === 0 || height === 0) return
    const ratio = Math.min(2, globalThis.devicePixelRatio || 1)
    if (element.width !== Math.round(width * ratio)) {
      element.width = Math.round(width * ratio)
    }
    if (element.height !== Math.round(height * ratio)) {
      element.height = Math.round(height * ratio)
    }
    const context = element.getContext('2d')
    if (context === null) return
    context.setTransform(ratio, 0, 0, ratio, 0, 0)
    context.clearRect(0, 0, width, height)
    if (model === null) return

    const { start, end } = span()
    const seconds = Math.max(0.001, end - start)
    // The bottom strip carries strikes that never got a pitch: they have no
    // honest vertical position, and drawing them at zero would be a claim.
    const unpitchedLane = height - 10
    const plotTop = 14
    const plotBottom = unpitchedLane - 12
    const low = model.midiRange.low
    const high = Math.max(low + 1, model.midiRange.high)

    const x = (value: number): number => ((value - start) / seconds) * width
    const y = (midi: number): number =>
      plotBottom - ((midi - low) / (high - low)) * (plotBottom - plotTop)

    // Octave gridlines, so an octave error is visible as a whole row jump.
    context.strokeStyle = 'rgba(255, 255, 255, 0.06)'
    context.lineWidth = 1
    context.font = '9px ui-monospace, monospace'
    context.fillStyle = 'rgba(148, 163, 184, 0.6)'
    for (let midi = Math.ceil(low / 12) * 12; midi <= high; midi += 12) {
      const lineY = Math.round(y(midi)) + 0.5
      context.beginPath()
      context.moveTo(0, lineY)
      context.lineTo(width, lineY)
      context.stroke()
      context.fillText(noteName(midi), 2, lineY - 2)
    }

    // Second ticks.
    context.strokeStyle = 'rgba(255, 255, 255, 0.05)'
    for (let second = Math.ceil(start); second < end; second += 1) {
      const tickX = Math.round(x(second)) + 0.5
      context.beginPath()
      context.moveTo(tickX, 0)
      context.lineTo(tickX, height)
      context.stroke()
    }

    const visibleRows = model.rows.filter(
      (row) =>
        row.onsetSeconds >= start - 1 &&
        row.onsetSeconds <= end + 1 &&
        (showExcluded() || row.outcome !== 'skipped'),
    )

    if (showDiffs()) {
      for (const row of visibleRows) {
        const partner = row.matchedEventId ?? row.nearest?.eventId ?? null
        if (partner === null) continue
        const event = model.played.find((played) => played.eventId === partner)
        if (event === undefined || event.midi === null) continue
        context.strokeStyle =
          row.outcome === 'hit' ? HIT_DIFF_COLOR : DIFF_COLOR
        context.lineWidth = 1
        context.setLineDash(row.outcome === 'hit' ? [] : [3, 3])
        context.beginPath()
        context.moveTo(x(row.onsetSeconds), y(row.midi))
        context.lineTo(x(event.seconds), y(event.midi))
        context.stroke()
      }
      context.setLineDash([])
    }

    if (showExpected()) {
      for (const row of visibleRows) {
        const barY = y(row.midi)
        const barX = x(row.onsetSeconds)
        context.fillStyle = OUTCOME_COLOR[row.outcome]
        context.globalAlpha = row.outcome === 'skipped' ? 0.55 : 1
        context.fillRect(barX - 1, barY - 4, 3, 8)
        context.globalAlpha = 1
        if (row.targetId === selectedId()) {
          context.strokeStyle = '#f8fafc'
          context.lineWidth = 1
          context.strokeRect(barX - 5, barY - 8, 10, 16)
        }
      }
    }

    if (showPlayed()) {
      for (const event of model.played) {
        if (event.seconds < start - 1 || event.seconds > end + 1) continue
        const eventX = x(event.seconds)
        if (event.midi === null) {
          context.fillStyle = PLAYED_UNPITCHED_COLOR
          context.fillRect(eventX - 1, unpitchedLane - 4, 2, 8)
          continue
        }
        const eventY = y(event.midi)
        context.fillStyle =
          event.kind === 'attack' ? PLAYED_COLOR : 'rgba(56, 189, 248, 0.4)'
        context.beginPath()
        context.arc(
          eventX,
          eventY,
          event.kind === 'attack' ? 3 : 2,
          0,
          Math.PI * 2,
        )
        if (event.kind === 'attack') context.fill()
        else {
          context.strokeStyle = 'rgba(56, 189, 248, 0.6)'
          context.lineWidth = 1
          context.stroke()
        }
      }
    }

    const head = props.playheadSeconds()
    if (head !== null && head >= start && head <= end) {
      context.strokeStyle = 'rgba(248, 250, 252, 0.7)'
      context.lineWidth = 1
      const headX = Math.round(x(head)) + 0.5
      context.beginPath()
      context.moveTo(headX, 0)
      context.lineTo(headX, height)
      context.stroke()
    }
  }

  createEffect(() => {
    // Re-read every input the drawing depends on, so a signal change repaints.
    props.model()
    props.playheadSeconds()
    size()
    span()
    showExpected()
    showPlayed()
    showDiffs()
    showExcluded()
    selectedId()
    draw()
  })

  const pickAt = (clientX: number): void => {
    const model = props.model()
    const element = canvas
    if (model === null || element === undefined) return
    const bounds = element.getBoundingClientRect()
    const { start, end } = span()
    const at = start + ((clientX - bounds.left) / bounds.width) * (end - start)
    let best: GuitarScoreDebugRow | null = null
    let bestDistance = Number.POSITIVE_INFINITY
    for (const row of model.rows) {
      const distance = Math.abs(row.onsetSeconds - at)
      if (distance < bestDistance) {
        best = row
        bestDistance = distance
      }
    }
    setSelectedId(best?.targetId ?? null)
  }

  const summary = createMemo(() => props.model()?.summary ?? null)

  /**
   * MPM correlates up to a lag of half the buffer, so the deepest pitch it can
   * even represent is `sampleRate / (bufferSize / 2)`. Below that it does not
   * fail — it reports the octave above, with high confidence, which is the
   * worst possible failure for a scorer. Guitar low E is 82.4 Hz.
   */
  const analyserFloorHz = createMemo(() => {
    const rate = props.model()?.sampleRate ?? 48_000
    return rate / (guitarScoreTuning().performanceAnalyserSize / 2)
  })

  const lowestTargetHz = createMemo(() => {
    const midi = props.model()?.summary.lowestTargetMidi
    return midi === null || midi === undefined
      ? null
      : 440 * 2 ** ((midi - 69) / 12)
  })

  const analyserTooShort = createMemo(() => {
    const lowest = lowestTargetHz()
    return lowest !== null && analyserFloorHz() > lowest
  })

  const exportPayload = (): string => {
    const model = props.model()
    return JSON.stringify(
      {
        capturedAt: new Date().toISOString(),
        userAgent: globalThis.navigator?.userAgent ?? null,
        tuning: guitarScoreTuning(),
        analyser: {
          bufferSize: guitarScoreTuning().performanceAnalyserSize,
          floorHz: analyserFloorHz(),
          lowestTargetHz: lowestTargetHz(),
          belowLowestTarget: analyserTooShort(),
        },
        analysisCost: guitarAnalysisCost(),
        model,
      },
      null,
      2,
    )
  }

  const downloadTake = (): void => {
    const blob = new Blob([exportPayload()], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `guitar-score-take-${new Date()
      .toISOString()
      .replace(/[:.]/g, '-')}.json`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const copyTake = (): void => {
    void globalThis.navigator?.clipboard?.writeText(exportPayload())
  }

  const logTake = (): void => {
    const model = props.model()
    // Parked on the window as well: a console object can be inspected, but a
    // handle can be re-read later without scrolling for the log line.
    ;(globalThis as Record<string, unknown>).__guitarScoreDebug = model

    console.log('[GuitarScoreDebug] take', model)

    console.table(
      (model?.rows ?? []).map((row) => ({
        beat: row.startBeat,
        at: row.onsetSeconds,
        midi: row.midi,
        outcome: row.outcome,
        diagnosis: row.diagnosis,
        offsetMs: row.timingOffsetMs ?? row.nearest?.offsetMs ?? null,
        heardMidi: row.nearest?.midi ?? null,
        semitones: row.nearest?.semitoneDelta ?? null,
        clarity: row.nearest?.clarity ?? null,
      })),
    )
  }

  return (
    <section class={styles.panel} data-testid="guitar-score-debug">
      <div class={styles.head}>
        <h3 class={styles.title}>Score debug — played vs expected</h3>
        <div class={styles.chips}>
          <Show when={summary()} keyed>
            {(current) => (
              <>
                <span class={styles.chip}>
                  <span class={styles.chipLabel}>Hit</span>
                  <span class={styles.chipValue}>{current.hit}</span>
                </span>
                <span class={styles.chip}>
                  <span class={styles.chipLabel}>Miss</span>
                  <span class={styles.chipValue}>{current.missed}</span>
                </span>
                <span class={styles.chip}>
                  <span class={styles.chipLabel}>Excluded</span>
                  <span class={styles.chipValue}>{current.skipped}</span>
                </span>
                <span class={styles.chip}>
                  <span class={styles.chipLabel}>Targets</span>
                  <span class={styles.chipValue}>{current.targetCount}</span>
                </span>
                <span class={styles.chip}>
                  <span class={styles.chipLabel}>Attacks</span>
                  <span class={styles.chipValue}>
                    {current.attacksWithPitch}/{current.attackCount}
                  </span>
                </span>
                <Show when={props.model()} keyed>
                  {(model) => (
                    <span
                      class={`${styles.chip} ${
                        model.clock.coarseFallback ? styles.chipAlert : ''
                      }`}
                      title={
                        model.clock.coarseFallback
                          ? 'The audio worklet did not load. Attacks are timed on the main thread, which is coarse and much less sensitive.'
                          : 'Attacks are timed on the audio thread, sample-exact.'
                      }
                    >
                      <span class={styles.chipLabel}>Clock</span>
                      <span class={styles.chipValue}>
                        {model.clock.precision ?? '--'}
                        {model.clock.latencyProvenance === 'none'
                          ? ' · 0 ms'
                          : model.clock.latencyMs === null
                            ? ''
                            : ` · ${model.clock.latencyMs} ms`}
                      </span>
                    </span>
                  )}
                </Show>
                <span class={styles.chip}>
                  <span class={styles.chipLabel}>Med clarity</span>
                  <span class={styles.chipValue}>
                    {current.medianClarity ?? '--'}
                  </span>
                </span>
                <span class={styles.chip}>
                  <span class={styles.chipLabel}>Legato frames</span>
                  <span class={styles.chipValue}>
                    {current.pitchChangeCount}
                  </span>
                </span>
                <span
                  class={`${styles.chip} ${
                    current.droppedEventCount > 0 ||
                    current.detectedGapCount > 0
                      ? styles.chipAlert
                      : ''
                  }`}
                >
                  <span class={styles.chipLabel}>Events</span>
                  <span class={styles.chipValue}>
                    {current.observedEventCount}
                    {current.droppedEventCount > 0
                      ? ` -${current.droppedEventCount}`
                      : ''}
                    {current.detectedGapCount > 0
                      ? ` gaps ${current.detectedGapCount}`
                      : ''}
                  </span>
                </span>
                <span
                  class={`${styles.chip} ${
                    current.suggestedLatencyOffsetMs !== null &&
                    current.latencyEstimateReliable &&
                    Math.abs(current.suggestedLatencyOffsetMs) > 40
                      ? styles.chipAlert
                      : ''
                  }`}
                  title={
                    current.latencyEstimateReliable
                      ? 'Median heard-minus-authored over pitch-compatible strikes.'
                      : 'The spread is as large as the median, so these pairs are arbitrary. Try a sparse, slow passage.'
                  }
                >
                  <span class={styles.chipLabel}>Route delay</span>
                  <span class={styles.chipValue}>
                    {current.suggestedLatencyOffsetMs === null
                      ? '--'
                      : current.latencyEstimateReliable
                        ? `${signed(current.suggestedLatencyOffsetMs)} ms`
                        : 'not measurable'}
                    {current.offsetSpreadMs === null ||
                    !current.latencyEstimateReliable
                      ? ''
                      : ` ±${current.offsetSpreadMs}`}
                  </span>
                </span>
              </>
            )}
          </Show>
          <Show when={guitarAnalysisCost()}>
            {(cost) => (
              <span
                class={`${styles.chip} ${
                  cost().frameBudgetShare > 0.5 ? styles.chipAlert : ''
                }`}
                title={
                  'Median cost of one pitch detection, and how many completed per second. ' +
                  'MPM is quadratic in the window size, so this is the number that decides ' +
                  'whether a larger analyser is affordable. Above half a 60 Hz frame the ' +
                  'detector is competing with the renderer.'
                }
              >
                <span class={styles.chipLabel}>Detect cost</span>
                <span class={styles.chipValue}>
                  {cost().medianDetectMs} ms · {cost().detectionsPerSecond}/s ·{' '}
                  {Math.round(cost().frameBudgetShare * 100)}% frame
                </span>
              </span>
            )}
          </Show>
        </div>
      </div>

      <div class={styles.tuning}>
        <div class={styles.tuningHead}>
          <span>Matcher tuning — applies on the next Play</span>
          <button
            type="button"
            class={styles.tuningReset}
            onClick={() => resetGuitarScoreTuning()}
          >
            Reset
          </button>
        </div>
        <div class={styles.tuningGrid}>
          <label class={styles.tuningRow}>
            Early
            <input
              type="range"
              min="40"
              max="400"
              step="10"
              value={guitarScoreTuning().matchToleranceMs}
              onInput={(commit) =>
                setGuitarScoreTuning({
                  matchToleranceMs: Number.parseInt(
                    commit.currentTarget.value,
                    10,
                  ),
                })
              }
            />
            <span class={styles.tuningValue}>
              {guitarScoreTuning().matchToleranceMs} ms
            </span>
          </label>
          <label class={styles.tuningRow}>
            Late
            <input
              type="range"
              min="40"
              max="700"
              step="10"
              value={guitarScoreTuning().lateToleranceMs}
              onInput={(commit) =>
                setGuitarScoreTuning({
                  lateToleranceMs: Number.parseInt(
                    commit.currentTarget.value,
                    10,
                  ),
                })
              }
            />
            <span class={styles.tuningValue}>
              {guitarScoreTuning().lateToleranceMs} ms
            </span>
          </label>
          <label class={styles.tuningRow}>
            Clarity floor
            <input
              type="range"
              min="0.2"
              max="0.95"
              step="0.05"
              value={guitarScoreTuning().minimumPitchClarity}
              onInput={(commit) =>
                setGuitarScoreTuning({
                  minimumPitchClarity: Number.parseFloat(
                    commit.currentTarget.value,
                  ),
                })
              }
            />
            <span class={styles.tuningValue}>
              {guitarScoreTuning().minimumPitchClarity.toFixed(2)}
            </span>
          </label>
          <label class={styles.tuningRow}>
            Dense spacing
            <input
              type="range"
              min="0"
              max="300"
              step="10"
              disabled={guitarScoreTuning().judgeDenseTargets}
              value={guitarScoreTuning().denseTargetSpacingMs}
              onInput={(commit) =>
                setGuitarScoreTuning({
                  denseTargetSpacingMs: Number.parseInt(
                    commit.currentTarget.value,
                    10,
                  ),
                })
              }
            />
            <span class={styles.tuningValue}>
              {guitarScoreTuning().denseTargetSpacingMs} ms
            </span>
          </label>
          <label
            class={styles.toggle}
            title={
              'Evidence-first judges a chord or a dense run against what was ' +
              'actually heard. Off reverts to excluding them before any event ' +
              'is read, which is what reported 95% while grading 22% of a take.'
            }
          >
            <input
              type="checkbox"
              checked={guitarScoreTuning().scorePolicy === 'evidence-first'}
              onChange={(commit) =>
                setGuitarScoreTuning({
                  scorePolicy: commit.currentTarget.checked
                    ? 'evidence-first'
                    : 'exclude-first',
                })
              }
            />
            Judge hard passages, do not skip them
          </label>
          <label class={styles.toggle}>
            <input
              type="checkbox"
              checked={guitarScoreTuning().matchPitchChanges}
              onChange={(commit) =>
                setGuitarScoreTuning({
                  matchPitchChanges: commit.currentTarget.checked,
                })
              }
            />
            Score legato and slides
          </label>
          <label class={styles.toggle}>
            <input
              type="checkbox"
              checked={guitarScoreTuning().octaveTolerantPitch}
              onChange={(commit) =>
                setGuitarScoreTuning({
                  octaveTolerantPitch: commit.currentTarget.checked,
                })
              }
            />
            Octave tolerant
          </label>
          <label class={styles.tuningRow}>
            Analyser
            <select
              value={String(guitarScoreTuning().performanceAnalyserSize)}
              onChange={(commit) =>
                setGuitarScoreTuning({
                  performanceAnalyserSize: Number.parseInt(
                    commit.currentTarget.value,
                    10,
                  ),
                })
              }
            >
              <For each={[1024, 2048, 4096, 8192]}>
                {(option) => <option value={String(option)}>{option}</option>}
              </For>
            </select>
            <span
              class={`${styles.tuningValue} ${
                analyserTooShort() ? styles.analyserWarn : ''
              }`}
            >
              {analyserFloorHz().toFixed(0)} Hz
            </span>
          </label>
          <label class={styles.toggle}>
            <input
              type="checkbox"
              checked={guitarScoreTuning().judgeDenseTargets}
              onChange={(commit) =>
                setGuitarScoreTuning({
                  judgeDenseTargets: commit.currentTarget.checked,
                })
              }
            />
            Judge chords and fast runs
          </label>
        </div>
        <span class={styles.tuningNote}>
          Analyser changes need Listening turned off and on again; the rest
          apply on the next Play.
        </span>
        <Show when={props.model()} keyed>
          {(model) => (
            <span class={styles.tuningNote}>
              This run used {model.toleranceMs} ms early /{' '}
              {model.lateToleranceMs} ms late, clarity floor{' '}
              {model.minimumPitchClarity}, input {model.inputKind}.
            </span>
          )}
        </Show>
      </div>

      <div class={styles.toggles}>
        <label class={styles.toggle}>
          <input
            type="checkbox"
            checked={showExpected()}
            onChange={(commit) => setShowExpected(commit.currentTarget.checked)}
          />
          Expected
        </label>
        <label class={styles.toggle}>
          <input
            type="checkbox"
            checked={showPlayed()}
            onChange={(commit) => setShowPlayed(commit.currentTarget.checked)}
          />
          Played
        </label>
        <label class={styles.toggle}>
          <input
            type="checkbox"
            checked={showDiffs()}
            onChange={(commit) => setShowDiffs(commit.currentTarget.checked)}
          />
          Diff lines
        </label>
        <label class={styles.toggle}>
          <input
            type="checkbox"
            checked={showExcluded()}
            onChange={(commit) => setShowExcluded(commit.currentTarget.checked)}
          />
          Excluded
        </label>
        <label class={styles.toggle}>
          <input
            type="checkbox"
            checked={follow()}
            onChange={(commit) => setFollow(commit.currentTarget.checked)}
          />
          Follow playhead
        </label>
        <label class={styles.rangeToggle}>
          Window {windowSeconds()}s
          <input
            type="range"
            min="2"
            max="30"
            step="1"
            value={windowSeconds()}
            onInput={(commit) =>
              setWindowSeconds(Number.parseInt(commit.currentTarget.value, 10))
            }
          />
        </label>
      </div>

      <Show
        when={props.model()}
        fallback={
          <p class={styles.empty}>
            No run yet. Press Play with Listening on, and the take will appear
            here note by note.
          </p>
        }
      >
        <div class={styles.canvasWrap} ref={attachWrap}>
          <canvas
            class={styles.canvas}
            ref={canvas}
            onClick={(commit) => pickAt(commit.clientX)}
          />
        </div>
      </Show>

      <div class={styles.legend}>
        <span class={styles.legendItem}>
          <span
            class={styles.swatch}
            style={{ background: OUTCOME_COLOR.hit }}
          />
          hit
        </span>
        <span class={styles.legendItem}>
          <span
            class={styles.swatch}
            style={{ background: OUTCOME_COLOR.miss }}
          />
          miss
        </span>
        <span class={styles.legendItem}>
          <span
            class={styles.swatch}
            style={{ background: OUTCOME_COLOR.skipped }}
          />
          excluded
        </span>
        <span class={styles.legendItem}>
          <span class={styles.swatch} style={{ background: PLAYED_COLOR }} />
          strike heard
        </span>
        <span class={styles.legendItem}>
          <span
            class={styles.swatch}
            style={{ background: PLAYED_UNPITCHED_COLOR }}
          />
          strike with no pitch
        </span>
      </div>

      <div class={styles.exportRow}>
        <button
          type="button"
          class={styles.exportButton}
          disabled={props.model() === null}
          onClick={downloadTake}
        >
          Download take JSON
        </button>
        <button
          type="button"
          class={styles.exportButton}
          disabled={props.model() === null}
          onClick={copyTake}
        >
          Copy JSON
        </button>
        <button
          type="button"
          class={styles.exportButton}
          disabled={props.model() === null}
          onClick={logTake}
        >
          Log to console
        </button>
        <span class={styles.exportNote}>
          Console also parks it on window.__guitarScoreDebug
        </span>
      </div>
      <Show when={analyserTooShort()}>
        <p class={`${styles.exportNote} ${styles.analyserWarn}`}>
          The analyser bottoms out at {analyserFloorHz().toFixed(0)} Hz but this
          score reaches {lowestTargetHz()?.toFixed(1)} Hz. Notes under the floor
          are reported an octave high with high confidence. Raise the analyser.
        </p>
      </Show>
      <Show when={summary()} keyed>
        {(current) => (
          <div class={styles.breakdown}>
            <For
              each={DIAGNOSIS_ORDER.filter((key) => current.diagnoses[key] > 0)}
            >
              {(key) => (
                <span class={styles.breakdownItem}>
                  {key} {current.diagnoses[key]}
                </span>
              )}
            </For>
            <For
              each={SKIP_REASON_ORDER.filter(
                (key) => current.skipReasons[key] > 0,
              )}
            >
              {(key) => (
                <span
                  class={`${styles.breakdownItem} ${styles.breakdownExcluded}`}
                >
                  {key} {current.skipReasons[key]}
                </span>
              )}
            </For>
          </div>
        )}
      </Show>

      <Show
        when={selectedRow()}
        keyed
        fallback={
          <p class={styles.inspector}>
            <span class={styles.inspectorMuted}>
              Click the timeline to inspect the nearest authored note.
            </span>
          </p>
        }
      >
        {(row) => (
          <div class={styles.inspector}>
            <span class={styles.inspectorHead}>
              {noteName(row.midi)} (midi {row.midi}) at {row.onsetSeconds}s ·
              beat {Math.round(row.startBeat * 100) / 100} · {row.outcome}
            </span>
            <span>{describeGuitarScoreDiagnosis(row)}</span>
            <Show
              when={row.nearest}
              keyed
              fallback={
                <span class={styles.inspectorMuted}>
                  Nothing was struck within {props.model()?.searchWindowMs ?? 0}{' '}
                  ms either side.
                </span>
              }
            >
              {(nearest) => (
                <span class={styles.inspectorMuted}>
                  nearest strike {nearest.eventId} · {signed(nearest.offsetMs)}{' '}
                  ms ·{' '}
                  {nearest.midi === null
                    ? 'no pitch'
                    : `${noteName(nearest.midi)} (${signed(nearest.semitoneDelta ?? 0)} st)`}{' '}
                  · clarity {nearest.clarity ?? '--'} · level {nearest.level}
                </span>
              )}
            </Show>
          </div>
        )}
      </Show>
    </section>
  )
}

/**
 * Collapsed dock for the room to mount. Kept here so every call site is one
 * dev-gated line and the `details` chrome cannot drift between surfaces.
 */
type DockCorner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'

interface DockPlacement {
  corner: DockCorner
  /** Free position in px, set by dragging. Null means snapped to the corner. */
  offset: { left: number; top: number } | null
  open: boolean
}

const DOCK_STORAGE_KEY = 'guitar-night-score-debug-dock'
const DOCK_MARGIN = 12

const DOCK_CORNERS: readonly { id: DockCorner; label: string }[] = [
  { id: 'top-left', label: 'Snap top left' },
  { id: 'top-right', label: 'Snap top right' },
  { id: 'bottom-left', label: 'Snap bottom left' },
  { id: 'bottom-right', label: 'Snap bottom right' },
]

/**
 * Position deliberately does NOT survive a reload. A dock dragged somewhere
 * awkward, or snapped to a corner that a later layout change fills, becomes
 * unreachable with no obvious way back; starting bottom-left every time means
 * a refresh is always the way out. Only the open flag is remembered.
 */
function readDockPlacement(): DockPlacement {
  const fallback: DockPlacement = {
    corner: 'bottom-left',
    offset: null,
    open: false,
  }
  try {
    const raw = globalThis.localStorage?.getItem(DOCK_STORAGE_KEY)
    if (raw === null || raw === undefined) return fallback
    const parsed = JSON.parse(raw) as Partial<DockPlacement>
    return { ...fallback, open: parsed.open === true }
  } catch {
    return fallback
  }
}

/** A square with one quadrant filled: which corner this button snaps to. */
function CornerGlyph(props: { corner: DockCorner }) {
  const x = (): number => (props.corner.endsWith('right') ? 7 : 1)
  const y = (): number => (props.corner.startsWith('bottom') ? 7 : 1)
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
      <rect
        x="0.5"
        y="0.5"
        width="11"
        height="11"
        rx="2"
        fill="none"
        stroke="currentColor"
        stroke-width="1"
      />
      <rect x={x()} y={y()} width="4" height="4" rx="1" fill="currentColor" />
    </svg>
  )
}

/**
 * Floating dock for the room to mount. It has to float: the score room is
 * `height: 100%; overflow: hidden`, so an in-flow panel is clipped away. That
 * means it can also sit on top of the transport, hence the corner snaps and the
 * drag handle — a debug surface that hides the Play button is worse than none.
 */
export function GuitarNightScoreDebugDock(props: GuitarNightScoreDebugProps) {
  const [placement, setPlacement] =
    createSignal<DockPlacement>(readDockPlacement())
  let dock: HTMLDivElement | undefined

  const commit = (patch: Partial<DockPlacement>): void => {
    const next = { ...placement(), ...patch }
    setPlacement(next)
    try {
      globalThis.localStorage?.setItem(
        DOCK_STORAGE_KEY,
        JSON.stringify({ open: next.open }),
      )
    } catch {
      // A blocked storage should not cost the user their drag.
    }
  }

  const dockStyle = createMemo<Record<string, string>>(() => {
    const current = placement()
    if (current.offset !== null) {
      return {
        left: `${current.offset.left}px`,
        top: `${current.offset.top}px`,
        right: 'auto',
        bottom: 'auto',
      }
    }
    const style: Record<string, string> = {
      left: 'auto',
      top: 'auto',
      right: 'auto',
      bottom: 'auto',
    }
    style[current.corner.endsWith('right') ? 'right' : 'left'] =
      `${DOCK_MARGIN}px`
    style[current.corner.startsWith('bottom') ? 'bottom' : 'top'] =
      `${DOCK_MARGIN}px`
    return style
  })

  const beginDrag = (event: PointerEvent): void => {
    const element = dock
    if (element === undefined || event.button !== 0) return
    // Let the buttons in the bar do their own job.
    if ((event.target as HTMLElement).closest('button') !== null) return
    const bounds = element.getBoundingClientRect()
    const grabX = event.clientX - bounds.left
    const grabY = event.clientY - bounds.top
    const handle = event.currentTarget as HTMLElement
    handle.setPointerCapture(event.pointerId)

    const move = (moved: PointerEvent): void => {
      const maxLeft = Math.max(0, globalThis.innerWidth - bounds.width)
      const maxTop = Math.max(0, globalThis.innerHeight - bounds.height)
      setPlacement((current) => ({
        ...current,
        offset: {
          left: Math.min(maxLeft, Math.max(0, moved.clientX - grabX)),
          top: Math.min(maxTop, Math.max(0, moved.clientY - grabY)),
        },
      }))
    }
    const release = (): void => {
      handle.removeEventListener('pointermove', move)
      handle.removeEventListener('pointerup', release)
      handle.removeEventListener('pointercancel', release)
      commit({ offset: placement().offset })
    }
    handle.addEventListener('pointermove', move)
    handle.addEventListener('pointerup', release)
    handle.addEventListener('pointercancel', release)
  }

  // Portalled to the document body on purpose. The Guitar Night shell sets
  // `isolation: isolate` and several ancestors carry `backdrop-filter`, each of
  // which opens a stacking context: inside one, no z-index can lift the dock
  // above the app header, and a transformed ancestor would also re-anchor
  // `position: fixed` to itself. Leaving the subtree is the only real fix.
  return (
    <Portal>
      <div
        ref={dock}
        class={styles.dock}
        classList={{ [styles.dockOpen]: placement().open }}
        style={dockStyle()}
        data-testid="guitar-score-debug-dock"
      >
        <div class={styles.dockBar} onPointerDown={beginDrag}>
          <button
            type="button"
            class={styles.dockToggle}
            aria-expanded={placement().open}
            onClick={() => commit({ open: !placement().open })}
          >
            {placement().open ? 'Hide' : 'Score debug (dev only)'}
          </button>
          <span class={styles.dockGrip} aria-hidden="true">
            Drag
          </span>
          <span class={styles.dockCorners}>
            <For each={DOCK_CORNERS}>
              {(corner) => (
                <button
                  type="button"
                  class={styles.dockCornerButton}
                  classList={{
                    [styles.dockCornerActive]:
                      placement().corner === corner.id &&
                      placement().offset === null,
                  }}
                  aria-label={corner.label}
                  title={corner.label}
                  onClick={() => commit({ corner: corner.id, offset: null })}
                >
                  <CornerGlyph corner={corner.id} />
                </button>
              )}
            </For>
          </span>
        </div>
        <Show when={placement().open}>
          <div class={styles.dockBody}>
            <GuitarNightScoreDebug
              model={props.model}
              playheadSeconds={props.playheadSeconds}
            />
          </div>
        </Show>
      </div>
    </Portal>
  )
}
