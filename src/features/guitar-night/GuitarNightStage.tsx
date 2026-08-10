// Guitar Night stage adapts the shared 3D renderer into quiet Flow, Tab, and Neck views.
// ============================================================

import type { Accessor, JSX } from 'solid-js'
import { children, createEffect, createMemo, createSignal, For, lazy, onCleanup, onMount, Show, Suspense, } from 'solid-js'
import type { GuitarPerformanceStageSource } from '@/features/guitar/runtime/guitar-performance-contract'
import type { CameraState } from '@/features/guitar-tab-3d/renderer/camera'
import type { TabPresentation } from '@/features/guitar-tab-3d/renderer/TabRenderer'
import { VELVET_DISPLAY } from '@/features/guitar-tab-3d/renderer/TabRenderer'
import type { GuitarNote } from '@/lib/guitar/guitar-synth'
import type { InstrumentTuning, StringedInstrument, } from '@/lib/guitar/instrument-tuning'
import { DEFAULT_GUITAR_TUNING, MAX_STRING_COUNT, MIN_STRING_COUNT, } from '@/lib/guitar/instrument-tuning'
import { createPersistedSignal } from '@/lib/storage'
import styles from './GuitarNightApp.module.css'

const Guitar3DStage = lazy(async () => {
  const module = await import('@/features/guitar/ui/Guitar3DStage')
  return { default: module.Guitar3DStage }
})

export type GuitarNightStageMode = 'flow' | 'tab' | 'neck'
type GuitarNightStageView = 'highway' | 'grid' | 'tab' | 'neck'

export const GUITAR_NIGHT_FLOW_PRESENTATION_KEY =
  'guitar-night-flow-presentation-v1'

interface GuitarNightStageProps {
  source: GuitarPerformanceStageSource
  /** Names the attached score while one is guiding the stage. */
  guideLabel?: Accessor<string | null>
  /** The instrument the rows describe. Absent means a standard six-string. */
  tuning?: Accessor<InstrumentTuning>
  /** Both handlers together enable the instrument picker over the rows. */
  onInstrument?: (instrument: StringedInstrument) => void
  onStringCount?: (count: number) => void
  /** Keep the displayed take stable while its score and voice are scheduled. */
  instrumentSetupDisabled?: Accessor<boolean>
  active: Accessor<boolean>
  listening?: Accessor<boolean>
  heardNote?: Accessor<string | null>
  heardClarity?: Accessor<number>
  initialMode?: GuitarNightStageMode
  /** Flow labels default to note names; beginner tab can ask for fret numbers. */
  flowLabelMode?: 'note' | 'fret'
  /** Host-owned cues and sheets sit over the instrument without entering layout. */
  overlay?: JSX.Element
}

const FRET_LABELS = Array.from({ length: 13 }, (_, index) => index)

const INSTRUMENT_CHOICES: readonly {
  id: StringedInstrument
  label: string
}[] = [
  { id: 'guitar', label: 'Guitar' },
  { id: 'bass', label: 'Bass' },
]

const STRING_COUNT_CHOICES = Array.from(
  { length: MAX_STRING_COUNT - MIN_STRING_COUNT + 1 },
  (_, index) => MIN_STRING_COUNT + index,
)

const STAGE_VIEW_CHOICES: readonly {
  id: GuitarNightStageView
  label: string
}[] = [
  { id: 'highway', label: 'Highway' },
  { id: 'grid', label: 'Grid' },
  { id: 'tab', label: 'Tab' },
  { id: 'neck', label: 'Neck' },
]

/** Tab shows the same span of music as Flow, so switching view keeps context. */
const TAB_WINDOW_BEATS = 8
/** Where the now-line sits, leaving a little played history behind it. */
export const TAB_PLAYHEAD_RATIO = 0.18

/** Guitar Night owns its cinematic framing without changing the legacy tab. */
export const GUITAR_NIGHT_CAMERA_WIDE: CameraState = {
  yaw: 0,
  pitch: 0.55,
  radius: 21,
  target: [0, -2, -12],
}

/** Portrait needs distance and a steeper view so every fret stays reachable. */
export const GUITAR_NIGHT_CAMERA_NARROW: CameraState = {
  yaw: 0,
  pitch: 0.75,
  radius: 32,
  target: [0, 2, -12],
}

export interface TabWindowEntry {
  note: GuitarNote
  offsetPercent: number
  isActive: boolean
  isPast: boolean
}

/**
 * Rest the visual window just before the score's first authored event. The
 * room has not started and no time is claimed; this is a still preview that
 * makes a long intro read as intentional instead of an empty renderer.
 */
export function guidePreviewBeat(
  notes: readonly GuitarNote[],
  playheadBeat: number | null,
): number | null {
  if (playheadBeat !== null) return playheadBeat
  const first = notes.reduce<number | null>(
    (earliest, note) =>
      earliest === null || note.startBeat < earliest
        ? note.startBeat
        : earliest,
    null,
  )
  return first === null ? null : first - 2.5
}

/**
 * Place the notes that fall inside the moving window, as a percentage across
 * it. Without a playhead the window rests at the top of the score so an
 * attached tab is readable before anything starts.
 */
export function tabWindowEntries(
  notes: readonly GuitarNote[],
  playheadBeat: number | null,
  windowBeats = TAB_WINDOW_BEATS,
): TabWindowEntry[] {
  const head = playheadBeat ?? 0
  const start = head - windowBeats * TAB_PLAYHEAD_RATIO
  const end = start + windowBeats

  const entries: TabWindowEntry[] = []
  for (const note of notes) {
    if (note.startBeat > end || note.startBeat + note.duration < start) continue
    entries.push({
      note,
      offsetPercent: ((note.startBeat - start) / windowBeats) * 100,
      isActive:
        playheadBeat !== null &&
        note.startBeat <= playheadBeat &&
        note.startBeat + note.duration > playheadBeat,
      isPast: playheadBeat !== null && note.startBeat + note.duration <= head,
    })
  }
  return entries
}

/**
 * Naming the instrument sits over the rows it renames, because that is where a
 * wrong answer is visible: bass notes on `e B G D A E` lines read as nonsense.
 */
function InstrumentPicker(props: {
  tuning: InstrumentTuning
  disabled: boolean
  onInstrument(instrument: StringedInstrument): void
  onStringCount(count: number): void
}) {
  return (
    <div class={styles.stageInstrument}>
      <div
        class={styles.stageInstrumentKind}
        role="group"
        aria-label="Instrument shown"
      >
        <For each={INSTRUMENT_CHOICES}>
          {(choice) => (
            <button
              type="button"
              classList={{
                [styles.stageInstrumentActive]:
                  props.tuning.instrument === choice.id,
              }}
              aria-pressed={props.tuning.instrument === choice.id}
              disabled={props.disabled}
              onClick={() => props.onInstrument(choice.id)}
            >
              {choice.label}
            </button>
          )}
        </For>
      </div>
      <label>
        <span class={styles.visuallyHidden}>Strings</span>
        <select
          value={props.tuning.stringCount}
          disabled={props.disabled}
          onChange={(event) =>
            props.onStringCount(Number(event.currentTarget.value))
          }
        >
          <For each={STRING_COUNT_CHOICES}>
            {(count) => <option value={count}>{count} strings</option>}
          </For>
        </select>
      </label>
      <small>{props.tuning.labels.join(' ')}</small>
    </div>
  )
}

function noteAtPlayhead(
  notes: readonly GuitarNote[],
  playheadBeat: number | null,
): GuitarNote | null {
  if (playheadBeat === null) return null
  return (
    notes.find(
      (note) =>
        note.startBeat <= playheadBeat &&
        note.startBeat + note.duration > playheadBeat,
    ) ?? null
  )
}

export function GuitarNightStage(props: GuitarNightStageProps) {
  let instrumentDetails: HTMLDetailsElement | undefined
  const overlay = children(() => props.overlay)
  const narrowQuery = '(max-width: 720px)'
  const matchesNarrowViewport = () =>
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia(narrowQuery).matches
  const [narrowViewport, setNarrowViewport] = createSignal(
    matchesNarrowViewport(),
  )
  const [mode, setMode] = createSignal<GuitarNightStageMode>(
    props.initialMode ?? 'flow',
  )
  const [flowPresentation, setFlowPresentation] =
    createPersistedSignal<TabPresentation>(
      GUITAR_NIGHT_FLOW_PRESENTATION_KEY,
      'string-highway',
      {
        validator: (value): value is TabPresentation =>
          value === 'string-highway' || value === 'fret-axis',
      },
    )
  const activeView = createMemo<GuitarNightStageView>(() => {
    const currentMode = mode()
    if (currentMode !== 'flow') return currentMode
    return flowPresentation() === 'string-highway' ? 'highway' : 'grid'
  })
  const selectView = (view: GuitarNightStageView) => {
    if (view === 'highway' || view === 'grid') {
      setFlowPresentation(view === 'highway' ? 'string-highway' : 'fret-axis')
      setMode('flow')
      return
    }
    setMode(view)
  }
  const tuning = createMemo(() => props.tuning?.() ?? DEFAULT_GUITAR_TUNING)
  const instrumentLabel = createMemo(
    () => `${tuning().stringCount}-string ${tuning().instrument}`,
  )
  const notes = createMemo(() => [...props.source.notes()])
  const actualPlayheadBeat = createMemo(() =>
    props.source.timeline.playheadBeat(),
  )
  const visualPlayheadBeat = createMemo(() =>
    guidePreviewBeat(notes(), actualPlayheadBeat()),
  )
  const firstGuideNote = createMemo(() =>
    notes().reduce<GuitarNote | null>(
      (earliest, note) =>
        earliest === null || note.startBeat < earliest.startBeat
          ? note
          : earliest,
      null,
    ),
  )
  const activeNote = createMemo(() =>
    noteAtPlayhead(notes(), actualPlayheadBeat()),
  )
  const hasGuide = createMemo(() => notes().length > 0)
  const visibleTabNotes = createMemo(() =>
    tabWindowEntries(notes(), visualPlayheadBeat()),
  )
  const canRetune = createMemo(
    () => props.onInstrument !== undefined && props.onStringCount !== undefined,
  )
  const instrumentSetupDisabled = createMemo(
    () => props.instrumentSetupDisabled?.() ?? false,
  )
  const cameraPreset = createMemo(() =>
    narrowViewport() ? GUITAR_NIGHT_CAMERA_NARROW : GUITAR_NIGHT_CAMERA_WIDE,
  )
  onMount(() => {
    if (typeof window.matchMedia !== 'function') return
    const query = window.matchMedia(narrowQuery)
    const sync = () => setNarrowViewport(query.matches)
    sync()
    query.addEventListener?.('change', sync)
    onCleanup(() => query.removeEventListener?.('change', sync))
  })
  createEffect(() => {
    if (instrumentSetupDisabled() && instrumentDetails?.open === true) {
      instrumentDetails.open = false
    }
  })
  const isListening = createMemo(() => props.listening?.() ?? false)
  const heardNote = createMemo(() => props.heardNote?.() ?? null)
  const heardCopy = createMemo(() => {
    const note = heardNote()
    if (!isListening()) return null
    if (note === null) return 'Play a clean note'
    const confidence = Math.round((props.heardClarity?.() ?? 0) * 100)
    return `${note} · ${confidence}% clear`
  })
  const flowSummary = createMemo(() =>
    hasGuide()
      ? `${props.source.title()}. ${notes().length} guided notes approach ${flowPresentation() === 'string-highway' ? `${tuning().stringCount} string lanes on a ${instrumentLabel()} runway` : `a ${instrumentLabel()} fretboard grid`}. ${firstGuideNote() === null ? '' : `The first note is ${firstGuideNote()!.noteName}, ${tuning().labels[firstGuideNote()!.stringIndex] ?? `string ${firstGuideNote()!.stringIndex + 1}`}, ${firstGuideNote()!.fret === 0 ? 'open' : `fret ${firstGuideNote()!.fret}`}.`}`
      : `${props.source.title()}. Interactive ${instrumentLabel()} ${flowPresentation() === 'string-highway' ? 'string runway' : 'fretboard grid'}; no song tab is attached.`,
  )
  const tabSummary = createMemo(() =>
    hasGuide()
      ? `${props.source.title()}. Moving tablature with ${tuning().stringCount} string rows and ${notes().length} guided fret targets.`
      : `${props.source.title()}. Empty ${tuning().stringCount}-string tablature; no song tab is attached.`,
  )
  const visualSource: GuitarPerformanceStageSource = {
    title: () => props.source.title(),
    notes: () => props.source.notes(),
    timeline: {
      positionSeconds: () => props.source.timeline.positionSeconds(),
      durationSeconds: () => props.source.timeline.durationSeconds(),
      playheadBeat: visualPlayheadBeat,
      tempoBpm: () => props.source.timeline.tempoBpm(),
    },
  }
  const readyGuideCopy = createMemo(() => {
    const note = firstGuideNote()
    if (note === null) return props.guideLabel?.() ?? 'Follow the next note'
    const stringLabel = tuning().labels[note.stringIndex]
    const position = note.fret === 0 ? 'open' : `fret ${note.fret}`
    return `First note · ${note.noteName}${stringLabel === undefined ? '' : ` on ${stringLabel}`} · ${position}`
  })

  return (
    <section
      class={styles.performanceStage}
      aria-label="Guitar stage"
      data-testid="guitar-night-stage"
      data-signal={
        isListening() ? 'listening' : hasGuide() ? 'guided' : 'free-play'
      }
    >
      <header class={styles.stageHeader}>
        <div>
          <span>
            {isListening()
              ? heardNote() === null
                ? 'Listening'
                : 'Heard now'
              : hasGuide()
                ? 'Guide ready'
                : 'Free play'}
          </span>
          <strong>
            {heardCopy() ??
              (hasGuide()
                ? actualPlayheadBeat() === null
                  ? readyGuideCopy()
                  : (props.guideLabel?.() ??
                    'Follow the next note into the neck')
                : 'Your fretboard is ready')}
          </strong>
        </div>
        <span
          class={styles.visuallyHidden}
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          {isListening()
            ? heardNote() === null
              ? 'Listening for a clean note'
              : `Heard ${heardNote()}`
            : ''}
        </span>
        <div class={styles.stageHeaderTools}>
          {/* The instrument names the rows in every view, so it belongs beside
              the view switch rather than inside one of them. */}
          <Show when={canRetune()}>
            <details
              ref={instrumentDetails}
              class={styles.stageSetup}
              classList={{
                [styles.stageSetupDisabled]: instrumentSetupDisabled(),
              }}
            >
              <summary
                aria-disabled={instrumentSetupDisabled()}
                onClick={(event) => {
                  if (instrumentSetupDisabled()) event.preventDefault()
                }}
              >
                {tuning().stringCount}-string {tuning().instrument}
              </summary>
              <InstrumentPicker
                tuning={tuning()}
                disabled={instrumentSetupDisabled()}
                onInstrument={(next) => props.onInstrument?.(next)}
                onStringCount={(count) => props.onStringCount?.(count)}
              />
            </details>
          </Show>
          <div class={styles.stageModes} role="group" aria-label="Stage view">
            <For each={STAGE_VIEW_CHOICES}>
              {(choice) => (
                <button
                  type="button"
                  classList={{
                    [styles.stageModeActive]: activeView() === choice.id,
                  }}
                  aria-pressed={activeView() === choice.id}
                  onClick={() => selectView(choice.id)}
                >
                  {choice.label}
                </button>
              )}
            </For>
          </div>
        </div>
      </header>

      <div
        class={styles.stageViewport}
        data-stage-mode={mode()}
        data-flow-presentation={flowPresentation()}
      >
        <Show when={mode() === 'flow'}>
          <Suspense
            fallback={
              <div class={styles.stageLoading} role="status">
                <span aria-hidden="true" />
                Setting the fretboard…
              </div>
            }
          >
            <Guitar3DStage
              source={visualSource}
              tuning={tuning}
              visibleBeatWindow={() => 8}
              showNoteLabels={() => props.flowLabelMode !== 'fret'}
              showFretboard={() => true}
              isActive={() => props.active() && mode() === 'flow'}
              display={() => VELVET_DISPLAY}
              presentation={flowPresentation}
              showGizmo={() => false}
              ariaLabel={flowSummary}
              fallbackText={flowSummary}
              borderRadius={() => '0'}
              cameraPreset={cameraPreset}
            />
          </Suspense>
          <p class={styles.stageGestureHint}>
            Drag / arrows to orbit · scroll / + − to zoom · R resets
          </p>
          <Show when={!hasGuide() && !isListening()}>
            <div class={styles.stageInvitation}>
              <span>Free play</span>
              <strong>The room is yours.</strong>
              <small>
                Attach a tab or turn on Listening whenever you want a target.
              </small>
            </div>
          </Show>
        </Show>

        <Show when={mode() === 'tab'}>
          <div class={styles.stageTab}>
            <div
              class={styles.stageTabLanes}
              role="img"
              aria-label={tabSummary()}
            >
              <div
                class={styles.stageTabPlayhead}
                aria-hidden="true"
                style={{ left: `${TAB_PLAYHEAD_RATIO * 100}%` }}
              />
              <For each={tuning().labels}>
                {(label, stringIndex) => (
                  <div class={styles.stageTabString}>
                    <span>{label}</span>
                    <i aria-hidden="true" />
                    <div aria-hidden="true">
                      <For
                        each={visibleTabNotes().filter(
                          (entry) => entry.note.stringIndex === stringIndex(),
                        )}
                      >
                        {(entry) => (
                          <b
                            classList={{
                              [styles.stageTabNoteActive]: entry.isActive,
                              [styles.stageTabNotePast]: entry.isPast,
                            }}
                            style={{ left: `${entry.offsetPercent}%` }}
                          >
                            {entry.note.fret}
                          </b>
                        )}
                      </For>
                    </div>
                  </div>
                )}
              </For>
            </div>
            <Show when={!hasGuide()}>
              <p>
                No tab attached to this song. Load a tab later, or stay in free
                play.
              </p>
            </Show>
          </div>
        </Show>

        <Show when={mode() === 'neck'}>
          <div
            class={styles.stageNeck}
            aria-label={
              activeNote() === null
                ? `Twelve-fret ${instrumentLabel()} neck with no target note`
                : `${instrumentLabel()} neck target: ${tuning().labels[activeNote()!.stringIndex] ?? `string ${activeNote()!.stringIndex + 1}`} string, fret ${activeNote()!.fret}`
            }
            role="img"
          >
            <div class={styles.fretNumbers} aria-hidden="true">
              <For each={FRET_LABELS}>{(fret) => <span>{fret}</span>}</For>
            </div>
            <For each={tuning().labels}>
              {(_label, stringIndex) => (
                <div class={styles.neckString} aria-hidden="true">
                  <For each={FRET_LABELS}>
                    {(fret) => (
                      <span
                        classList={{
                          [styles.neckTarget]:
                            activeNote()?.stringIndex === stringIndex() &&
                            activeNote()?.fret === fret,
                        }}
                      />
                    )}
                  </For>
                </div>
              )}
            </For>
            <Show when={!hasGuide()}>
              <p>Free play · standard {tuning().instrument} tuning</p>
            </Show>
          </div>
        </Show>
      </div>

      <Show when={overlay()}>
        {(resolvedOverlay) => (
          <div class={styles.stageOverlay}>{resolvedOverlay()}</div>
        )}
      </Show>
    </section>
  )
}
