// Guitar Night stage adapts the shared 3D renderer into quiet Flow, Tab, and Neck views.
// ============================================================

import type { Accessor, JSX } from 'solid-js'
import { children, createEffect, createMemo, createSignal, For, lazy, onCleanup, onMount, Show, Suspense, } from 'solid-js'
import type { GuitarPerformanceStageSource } from '@/features/guitar/runtime/guitar-performance-contract'
import type { CameraState } from '@/features/guitar-tab-3d/renderer/camera'
import type { TabCameraPresetId } from '@/features/guitar-tab-3d/renderer/camera-presets'
import { TAB_CAMERA_PRESET_CHOICES, tabCameraPreset, } from '@/features/guitar-tab-3d/renderer/camera-presets'
import { tabFretX, tabStringLaneX, } from '@/features/guitar-tab-3d/renderer/canvas2d/highway-geometry'
import type { TabPresentation } from '@/features/guitar-tab-3d/renderer/TabRenderer'
import { VELVET_DISPLAY } from '@/features/guitar-tab-3d/renderer/TabRenderer'
import type { GuitarBendType } from '@/lib/guitar/guitar-notation'
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
export const GUITAR_NIGHT_CAMERA_PRESET_KEY = 'guitar-night-camera-preset-v1'
export const GUITAR_NIGHT_HANDEDNESS_KEY = 'guitar-night-handedness-v1'
export const GUITAR_NIGHT_EFFECTS_KEY = 'guitar-night-effects-v1'

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

type GuitarNightHandedness = 'right' | 'left'
type GuitarNightEffects = 'full' | 'reduced'

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
  ...tabCameraPreset('flow', { narrow: false }),
}

/** Portrait needs distance and a steeper view so every fret stays reachable. */
export const GUITAR_NIGHT_CAMERA_NARROW: CameraState = {
  ...tabCameraPreset('flow', { narrow: true }),
}

export interface TabWindowEntry {
  note: GuitarNote
  offsetPercent: number
  isActive: boolean
  isPast: boolean
}

export interface StageTabWindowIndex {
  notes: readonly GuitarNote[]
  /** Segment-tree maxima let moving windows skip expired score regions. */
  maxEndTree: readonly number[]
}

export interface NeckWindow {
  frets: readonly number[]
  activeNotes: readonly GuitarNote[]
  nextNotes: readonly GuitarNote[]
}

export interface StageNoteEvent {
  startBeat: number
  endBeat: number
  notes: readonly GuitarNote[]
}

export interface StageNoteIndex {
  events: readonly StageNoteEvent[]
  /** Segment-tree maxima let point queries skip every expired score region. */
  activeEndTree: readonly number[]
}

export interface StageEventContext {
  activeNotes: readonly GuitarNote[]
  nextNotes: readonly GuitarNote[]
}

const EVENT_TOLERANCE_BEATS = 0.0625
const NECK_WINDOW_FRETS = 13

function fillTabWindowEndTree(
  notes: readonly GuitarNote[],
  tree: number[],
  node: number,
  left: number,
  right: number,
): number {
  if (left === right) {
    const note = notes[left]
    const endBeat =
      note === undefined ? -Infinity : note.startBeat + note.duration
    tree[node] = endBeat
    return endBeat
  }
  const middle = Math.floor((left + right) / 2)
  const endBeat = Math.max(
    fillTabWindowEndTree(notes, tree, node * 2, left, middle),
    fillTabWindowEndTree(notes, tree, node * 2 + 1, middle + 1, right),
  )
  tree[node] = endBeat
  return endBeat
}

/** Compile every rendered note, including backing, for the lightweight Tab lane. */
export function buildStageTabWindowIndex(
  notes: readonly GuitarNote[],
): StageTabWindowIndex {
  const sorted = [...notes].sort(
    (left, right) => left.startBeat - right.startBeat,
  )
  const maxEndTree = Array.from(
    { length: Math.max(1, sorted.length * 4) },
    () => -Infinity,
  )
  if (sorted.length > 0) {
    fillTabWindowEndTree(sorted, maxEndTree, 1, 0, sorted.length - 1)
  }
  return { notes: sorted, maxEndTree }
}

function fillActiveEndTree(
  events: readonly StageNoteEvent[],
  tree: number[],
  node: number,
  left: number,
  right: number,
): number {
  if (left === right) {
    const endBeat = events[left]?.endBeat ?? -Infinity
    tree[node] = endBeat
    return endBeat
  }
  const middle = Math.floor((left + right) / 2)
  const leftEnd = fillActiveEndTree(events, tree, node * 2, left, middle)
  const rightEnd = fillActiveEndTree(
    events,
    tree,
    node * 2 + 1,
    middle + 1,
    right,
  )
  const endBeat = Math.max(leftEnd, rightEnd)
  tree[node] = endBeat
  return endBeat
}

/**
 * Compile score notes once so playback-time target lookups stay logarithmic.
 * Backing notes never enter the player-target index.
 */
export function buildStageNoteIndex(
  notes: readonly GuitarNote[],
): StageNoteIndex {
  const sorted = notes
    .filter((note) => (note.isBacking ?? false) === false)
    .sort((left, right) => left.startBeat - right.startBeat)
  const events: Array<{
    startBeat: number
    endBeat: number
    notes: GuitarNote[]
  }> = []

  for (const note of sorted) {
    const event = events.at(-1)
    if (
      event !== undefined &&
      Math.abs(note.startBeat - event.startBeat) <= EVENT_TOLERANCE_BEATS
    ) {
      event.notes.push(note)
      event.endBeat = Math.max(event.endBeat, note.startBeat + note.duration)
      continue
    }
    events.push({
      startBeat: note.startBeat,
      endBeat: note.startBeat + note.duration,
      notes: [note],
    })
  }

  const activeEndTree = Array.from(
    { length: Math.max(1, events.length * 4) },
    () => -Infinity,
  )
  if (events.length > 0) {
    fillActiveEndTree(events, activeEndTree, 1, 0, events.length - 1)
  }
  return { events, activeEndTree }
}

function upperBoundEventStart(
  events: readonly StageNoteEvent[],
  beat: number,
): number {
  let left = 0
  let right = events.length
  while (left < right) {
    const middle = Math.floor((left + right) / 2)
    if ((events[middle]?.startBeat ?? Infinity) <= beat) left = middle + 1
    else right = middle
  }
  return left
}

function lowerBoundEventStart(
  events: readonly StageNoteEvent[],
  beat: number,
): number {
  let left = 0
  let right = events.length
  while (left < right) {
    const middle = Math.floor((left + right) / 2)
    if ((events[middle]?.startBeat ?? Infinity) < beat) left = middle + 1
    else right = middle
  }
  return left
}

function collectActiveNotes(
  index: StageNoteIndex,
  playheadBeat: number,
  lastStartedEvent: number,
): GuitarNote[] {
  const active: GuitarNote[] = []
  if (lastStartedEvent < 0) return active

  const visit = (node: number, left: number, right: number) => {
    if (
      left > lastStartedEvent ||
      (index.activeEndTree[node] ?? -Infinity) <= playheadBeat
    ) {
      return
    }
    if (left === right) {
      const event = index.events[left]
      if (event === undefined) return
      for (const note of event.notes) {
        if (
          note.startBeat <= playheadBeat &&
          note.startBeat + note.duration > playheadBeat
        ) {
          active.push(note)
        }
      }
      return
    }
    const middle = Math.floor((left + right) / 2)
    visit(node * 2, left, middle)
    visit(node * 2 + 1, middle + 1, right)
  }

  if (index.events.length > 0) {
    visit(1, 0, index.events.length - 1)
  }
  return active
}

export function stageEventContext(
  index: StageNoteIndex,
  playheadBeat: number | null,
): StageEventContext {
  if (index.events.length === 0) {
    return { activeNotes: [], nextNotes: [] }
  }
  if (playheadBeat === null) {
    return { activeNotes: [], nextNotes: index.events[0]?.notes ?? [] }
  }

  const lastStartedEvent = upperBoundEventStart(index.events, playheadBeat) - 1
  const nextEvent =
    index.events[lowerBoundEventStart(index.events, playheadBeat - 0.02)]
  return {
    activeNotes: collectActiveNotes(index, playheadBeat, lastStartedEvent),
    nextNotes: nextEvent?.notes ?? [],
  }
}

function bendTechniqueSummary(
  bendType: GuitarBendType,
  amount: number,
): string {
  const interval = `${amount} ${amount === 1 ? 'semitone' : 'semitones'}`
  if (bendType === 'release') return `bend release ${interval}`
  if (bendType === 'bend-release') return `bend ${interval}, then release`
  if (bendType === 'hold') return `hold bend ${interval}`
  if (bendType === 'prebend') return `pre-bend ${interval}`
  if (bendType === 'prebend-bend') return `pre-bend, then bend ${interval}`
  if (bendType === 'prebend-release') {
    return `pre-bend ${interval}, then release`
  }
  if (bendType === 'custom') return `custom bend ${interval}`
  return `bend ${interval}`
}

function resolvedTechniqueFret(
  technique: { toFret?: number; toNoteId?: string },
  noteById: ReadonlyMap<string, GuitarNote>,
): number | undefined {
  return (
    (technique.toNoteId === undefined
      ? undefined
      : noteById.get(technique.toNoteId)?.fret) ?? technique.toFret
  )
}

function techniqueSummary(
  note: GuitarNote,
  noteById: ReadonlyMap<string, GuitarNote>,
): string {
  const labels = (note.notation?.techniques ?? []).map((technique) => {
    if (technique.kind === 'bend') {
      const amount = Math.abs(technique.semitones)
      return bendTechniqueSummary(technique.bendType, amount)
    }
    if (technique.kind === 'slide') {
      if (technique.slideType === 'into-from-below') {
        return 'slide in from below'
      }
      if (technique.slideType === 'into-from-above') {
        return 'slide in from above'
      }
      if (technique.slideType === 'out-up') return 'slide out upward'
      if (technique.slideType === 'out-down') return 'slide out downward'
      if (technique.slideType === 'pick-slide-up') return 'pick slide upward'
      if (technique.slideType === 'pick-slide-down') {
        return 'pick slide downward'
      }
      const targetFret = resolvedTechniqueFret(technique, noteById)
      return targetFret === undefined ? 'slide' : `slide to fret ${targetFret}`
    }
    if (technique.kind === 'hammer-on') {
      const targetFret = resolvedTechniqueFret(technique, noteById)
      return targetFret === undefined
        ? 'hammer-on'
        : `hammer-on to fret ${targetFret}`
    }
    if (technique.kind === 'pull-off') {
      const targetFret = resolvedTechniqueFret(technique, noteById)
      return targetFret === undefined
        ? 'pull-off'
        : `pull-off to fret ${targetFret}`
    }
    if (technique.kind === 'vibrato') return `${technique.width} vibrato`
    if (technique.kind === 'palm-mute') return 'palm mute'
    return 'let ring'
  })
  return [...new Set(labels)].join(', ')
}

function targetGroupSummary(
  targets: readonly GuitarNote[],
  tuning: InstrumentTuning,
  noteById: ReadonlyMap<string, GuitarNote>,
): string {
  if (targets.length === 0) return 'No target note.'
  const chord = targets.find((note) => {
    const label = note.notation?.chordLabel?.trim()
    return label !== undefined && label.length > 0
  })?.notation?.chordLabel
  const positions = targets
    .map((note) => {
      const string = tuning.labels[note.stringIndex]
      const position = note.fret === 0 ? 'open' : `fret ${note.fret}`
      return `${note.noteName}, string ${note.stringIndex + 1}${string === undefined ? '' : ` ${string}`}, ${position}`
    })
    .join('; ')
  const techniques = [
    ...new Set(
      targets.map((note) => techniqueSummary(note, noteById)).filter(Boolean),
    ),
  ]
  return `${chord === undefined ? '' : `${chord} chord: `}${positions}.${techniques.length === 0 ? '' : ` Technique: ${techniques.join('; ')}.`}`
}

export function nextStageEvent(
  notes: readonly GuitarNote[],
  playheadBeat: number | null,
): GuitarNote[] {
  return [
    ...stageEventContext(buildStageNoteIndex(notes), playheadBeat).nextNotes,
  ]
}

export function neckWindow(
  notes: readonly GuitarNote[],
  playheadBeat: number | null,
  maxFret = 24,
): NeckWindow {
  return neckWindowFromContext(
    stageEventContext(buildStageNoteIndex(notes), playheadBeat),
    maxFret,
  )
}

function neckWindowFromContext(
  context: StageEventContext,
  maxFret: number,
): NeckWindow {
  const { activeNotes, nextNotes } = context
  const focus = activeNotes.length > 0 ? activeNotes : nextNotes
  const focusFrets = focus.map((note) => note.fret).sort((a, b) => a - b)
  const median = focusFrets[Math.floor(focusFrets.length / 2)] ?? 6
  const laidMaxFret = Math.max(12, Math.min(24, maxFret))
  const lastStart = Math.max(0, laidMaxFret - (NECK_WINDOW_FRETS - 1))
  const start = Math.max(
    0,
    Math.min(lastStart, Math.round(median) - Math.floor(NECK_WINDOW_FRETS / 2)),
  )

  return {
    frets: Array.from(
      { length: NECK_WINDOW_FRETS },
      (_, index) => start + index,
    ),
    activeNotes,
    nextNotes,
  }
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
  index: StageTabWindowIndex,
  playheadBeat: number | null,
  windowBeats = TAB_WINDOW_BEATS,
): TabWindowEntry[] {
  const head = playheadBeat ?? 0
  const start = head - windowBeats * TAB_PLAYHEAD_RATIO
  const end = start + windowBeats

  const entries: TabWindowEntry[] = []
  if (index.notes.length === 0) return entries

  const visit = (node: number, left: number, right: number) => {
    if ((index.maxEndTree[node] ?? -Infinity) < start) return
    const first = index.notes[left]
    if (first === undefined || first.startBeat > end) return
    if (left !== right) {
      const middle = Math.floor((left + right) / 2)
      visit(node * 2, left, middle)
      visit(node * 2 + 1, middle + 1, right)
      return
    }
    if (first.startBeat + first.duration < start) return
    entries.push({
      note: first,
      offsetPercent: ((first.startBeat - start) / windowBeats) * 100,
      isActive:
        playheadBeat !== null &&
        first.startBeat <= playheadBeat &&
        first.startBeat + first.duration > playheadBeat,
      isPast: playheadBeat !== null && first.startBeat + first.duration <= head,
    })
  }
  visit(1, 0, index.notes.length - 1)
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
      <small>
        {props.tuning.name ?? props.tuning.labels.join(' ')}
        {(props.tuning.capo ?? 0) > 0 ? ` · capo ${props.tuning.capo}` : ''}
      </small>
    </div>
  )
}

function StageViewPicker(props: {
  showCameraChoices: boolean
  cameraPreset: TabCameraPresetId
  handedness: GuitarNightHandedness
  effects: GuitarNightEffects
  onCameraPreset(preset: TabCameraPresetId): void
  onHandedness(handedness: GuitarNightHandedness): void
  onEffects(effects: GuitarNightEffects): void
}) {
  return (
    <div
      class={styles.stageViewPicker}
      role="group"
      aria-label="Stage view and display settings"
    >
      <Show when={props.showCameraChoices}>
        <div
          class={styles.stageViewChoices}
          role="group"
          aria-label="Camera view"
        >
          <For each={TAB_CAMERA_PRESET_CHOICES}>
            {(choice) => (
              <button
                type="button"
                classList={{
                  [styles.stageViewChoiceActive]:
                    props.cameraPreset === choice.id,
                }}
                aria-pressed={props.cameraPreset === choice.id}
                onClick={() => props.onCameraPreset(choice.id)}
              >
                <strong>{choice.label}</strong>
                <small>{choice.description}</small>
              </button>
            )}
          </For>
        </div>
      </Show>
      <div class={styles.stageViewPreferences}>
        <button
          type="button"
          aria-pressed={props.handedness === 'left'}
          onClick={() =>
            props.onHandedness(props.handedness === 'left' ? 'right' : 'left')
          }
        >
          <span>Left-handed layout</span>
          <small>{props.handedness === 'left' ? 'On' : 'Off'}</small>
        </button>
        <button
          type="button"
          aria-pressed={props.effects === 'reduced'}
          onClick={() =>
            props.onEffects(props.effects === 'reduced' ? 'full' : 'reduced')
          }
        >
          <span>Reduced effects</span>
          <small>{props.effects === 'reduced' ? 'On' : 'Off'}</small>
        </button>
      </div>
    </div>
  )
}

export function GuitarNightStage(props: GuitarNightStageProps) {
  let stageRoot: HTMLElement | undefined
  let instrumentDetails: HTMLDetailsElement | undefined
  let instrumentSummary: HTMLElement | undefined
  let viewDetails: HTMLDetailsElement | undefined
  let viewSummary: HTMLElement | undefined
  const overlay = children(() => props.overlay)
  const narrowQuery = '(max-width: 720px)'
  const reducedMotionQuery = '(prefers-reduced-motion: reduce)'
  const matchesNarrowViewport = () =>
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia(narrowQuery).matches
  const [narrowViewport, setNarrowViewport] = createSignal(
    matchesNarrowViewport(),
  )
  const [systemReducedMotion, setSystemReducedMotion] = createSignal(false)
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
  const [cameraPresetId, setCameraPresetId] =
    createPersistedSignal<TabCameraPresetId>(
      GUITAR_NIGHT_CAMERA_PRESET_KEY,
      'flow',
      {
        validator: (value): value is TabCameraPresetId =>
          value === 'flow' ||
          value === 'player-neck' ||
          value === 'full-neck' ||
          value === 'phrase-focus',
      },
    )
  const [handedness, setHandedness] =
    createPersistedSignal<GuitarNightHandedness>(
      GUITAR_NIGHT_HANDEDNESS_KEY,
      'right',
      {
        validator: (value): value is GuitarNightHandedness =>
          value === 'right' || value === 'left',
      },
    )
  const [effects, setEffects] = createPersistedSignal<GuitarNightEffects>(
    GUITAR_NIGHT_EFFECTS_KEY,
    'full',
    {
      validator: (value): value is GuitarNightEffects =>
        value === 'full' || value === 'reduced',
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
    () =>
      `${tuning().stringCount}-string ${tuning().instrument}${tuning().name === undefined ? '' : ` in ${tuning().name}`}${(tuning().capo ?? 0) > 0 ? ` with capo ${tuning().capo}` : ''}`,
  )
  const notes = createMemo(() => [...props.source.notes()])
  const noteById = createMemo(
    () => new Map(notes().map((note) => [note.id, note] as const)),
  )
  const noteIndex = createMemo(() => buildStageNoteIndex(notes()))
  const tabWindowIndex = createMemo(() => buildStageTabWindowIndex(notes()))
  const actualPlayheadBeat = createMemo(() =>
    props.source.timeline.playheadBeat(),
  )
  const visualPlayheadBeat = createMemo(() =>
    guidePreviewBeat(notes(), actualPlayheadBeat()),
  )
  const actualEventContext = createMemo(() =>
    stageEventContext(noteIndex(), actualPlayheadBeat()),
  )
  const visualEventContext = createMemo(() =>
    stageEventContext(noteIndex(), visualPlayheadBeat()),
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
  const hasGuide = createMemo(() => notes().length > 0)
  const visibleTabNotes = createMemo(() =>
    tabWindowEntries(tabWindowIndex(), visualPlayheadBeat()),
  )
  const visibleTabNotesByString = createMemo(() => {
    const rows = Array.from(
      { length: tuning().stringCount },
      () => [] as TabWindowEntry[],
    )
    for (const entry of visibleTabNotes()) {
      rows[entry.note.stringIndex]?.push(entry)
    }
    return rows
  })
  const maxAuthoredFret = createMemo(() =>
    notes().reduce((highest, note) => Math.max(highest, note.fret), 12),
  )
  const neck = createMemo(() =>
    neckWindowFromContext(actualEventContext(), maxAuthoredFret()),
  )
  const displayedNeckFrets = createMemo(() =>
    handedness() === 'left' ? [...neck().frets].reverse() : neck().frets,
  )
  const activeNeckCells = createMemo(
    () =>
      new Set(
        neck().activeNotes.map((note) => `${note.stringIndex}:${note.fret}`),
      ),
  )
  const nextNeckCells = createMemo(
    () =>
      new Set(
        neck().nextNotes.map((note) => `${note.stringIndex}:${note.fret}`),
      ),
  )
  const canRetune = createMemo(
    () => props.onInstrument !== undefined && props.onStringCount !== undefined,
  )
  const instrumentSetupDisabled = createMemo(
    () => props.instrumentSetupDisabled?.() ?? false,
  )
  const display = createMemo(() => ({
    ...VELVET_DISPLAY,
    leftHanded: handedness() === 'left',
    motion: systemReducedMotion() ? ('reduced' as const) : ('full' as const),
    effects:
      effects() === 'reduced' || systemReducedMotion()
        ? ('reduced' as const)
        : ('full' as const),
  }))
  const phraseFocusX = createMemo(() => {
    const context = visualEventContext()
    const event =
      context.activeNotes.length > 0 ? context.activeNotes : context.nextNotes
    if (event.length === 0) return 0
    const ordered = [...event].sort((left, right) => {
      const leftPosition =
        flowPresentation() === 'string-highway' ? left.stringIndex : left.fret
      const rightPosition =
        flowPresentation() === 'string-highway' ? right.stringIndex : right.fret
      return leftPosition - rightPosition
    })
    const middle = ordered[Math.floor(ordered.length / 2)]
    if (middle === undefined) return 0
    const worldX =
      flowPresentation() === 'string-highway'
        ? tabStringLaneX(
            middle.stringIndex,
            tuning().stringCount,
            handedness() === 'left',
          )
        : tabFretX(middle.fret, maxAuthoredFret(), handedness() === 'left')
    return worldX * 0.42
  })
  const cameraPreset = createMemo(() =>
    tabCameraPreset(cameraPresetId(), {
      narrow: narrowViewport(),
      phraseFocusX: phraseFocusX(),
    }),
  )
  const cameraLabel = createMemo(
    () =>
      TAB_CAMERA_PRESET_CHOICES.find((choice) => choice.id === cameraPresetId())
        ?.label ?? 'Runway',
  )
  onMount(() => {
    let narrow: MediaQueryList | null = null
    let reduced: MediaQueryList | null = null
    const syncNarrow = () => setNarrowViewport(narrow?.matches ?? false)
    const syncMotion = () => setSystemReducedMotion(reduced?.matches ?? false)
    if (typeof window.matchMedia === 'function') {
      narrow = window.matchMedia(narrowQuery)
      reduced = window.matchMedia(reducedMotionQuery)
      syncNarrow()
      syncMotion()
      narrow.addEventListener?.('change', syncNarrow)
      reduced.addEventListener?.('change', syncMotion)
    }

    const closeStageDetails = (restoreFocus: boolean) => {
      const openView = viewDetails?.open === true
      const openInstrument = instrumentDetails?.open === true
      if (viewDetails !== undefined) viewDetails.open = false
      if (instrumentDetails !== undefined) instrumentDetails.open = false
      if (!restoreFocus) return
      if (openView) viewSummary?.focus()
      else if (openInstrument) instrumentSummary?.focus()
    }
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target
      if (!(target instanceof Node)) return
      if (
        viewDetails?.contains(target) === true ||
        instrumentDetails?.contains(target) === true
      ) {
        return
      }
      closeStageDetails(false)
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (viewDetails?.open !== true && instrumentDetails?.open !== true) return
      event.preventDefault()
      event.stopPropagation()
      closeStageDetails(true)
    }
    const handleToggle = (event: Event) => {
      const target = event.target
      if (!(target instanceof HTMLDetailsElement) || !target.open) return
      if (target === viewDetails || target === instrumentDetails) return
      closeStageDetails(false)
    }
    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown, true)
    document.addEventListener('toggle', handleToggle, true)
    onCleanup(() => {
      narrow?.removeEventListener?.('change', syncNarrow)
      reduced?.removeEventListener?.('change', syncMotion)
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown, true)
      document.removeEventListener('toggle', handleToggle, true)
    })
  })
  createEffect(() => {
    if (instrumentSetupDisabled() && instrumentDetails?.open === true) {
      instrumentDetails.open = false
    }
  })
  const openStageDisclosure = (opened: HTMLDetailsElement) => {
    if (!opened.open) return
    if (opened !== instrumentDetails && instrumentDetails !== undefined) {
      instrumentDetails.open = false
    }
    if (opened !== viewDetails && viewDetails !== undefined) {
      viewDetails.open = false
    }
    const room = stageRoot?.closest(
      '[data-testid="guitar-night-room"], [data-testid="guitar-night-score-room"]',
    )
    room
      ?.querySelectorAll<HTMLDetailsElement>('details[open]')
      .forEach((details) => {
        if (details !== opened) details.open = false
      })
  }
  const isListening = createMemo(() => props.listening?.() ?? false)
  const heardNote = createMemo(() => props.heardNote?.() ?? null)
  const heardCopy = createMemo(() => {
    const note = heardNote()
    if (!isListening()) return null
    if (note === null) return 'Play a clean note'
    const confidence = Math.round((props.heardClarity?.() ?? 0) * 100)
    return `${note} · ${confidence}% clear`
  })
  const targetSummary = createMemo(() => {
    const { activeNotes: active, nextNotes: upcoming } = actualEventContext()
    if (active.length > 0) {
      return `Current target: ${targetGroupSummary(active, tuning(), noteById())}`
    }
    return upcoming.length === 0
      ? 'No upcoming target.'
      : `Next target: ${targetGroupSummary(upcoming, tuning(), noteById())}`
  })
  const flowSummary = createMemo(() =>
    hasGuide()
      ? `${props.source.title()}. ${notes().length} guided notes approach ${flowPresentation() === 'string-highway' ? `${tuning().stringCount} string lanes on a ${instrumentLabel()} runway` : `a ${instrumentLabel()} fretboard grid`}. ${targetSummary()}`
      : `${props.source.title()}. Interactive ${instrumentLabel()} ${flowPresentation() === 'string-highway' ? 'string runway' : 'fretboard grid'}; no song tab is attached.`,
  )
  const tabSummary = createMemo(() =>
    hasGuide()
      ? `${props.source.title()}. Moving tablature with ${tuning().stringCount} string rows and ${notes().length} guided fret targets. ${targetSummary()}`
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
      ref={stageRoot}
      class={styles.performanceStage}
      aria-label="Guitar stage"
      data-testid="guitar-night-stage"
      data-camera-preset={cameraPresetId()}
      data-handedness={handedness()}
      data-effects={display().effects}
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
              onToggle={(event) => openStageDisclosure(event.currentTarget)}
            >
              <summary
                ref={instrumentSummary}
                aria-label={`${tuning().stringCount}-string ${tuning().instrument} setup`}
                aria-disabled={instrumentSetupDisabled()}
                onClick={(event) => {
                  if (instrumentSetupDisabled()) {
                    event.preventDefault()
                    return
                  }
                  if (
                    instrumentDetails?.open !== true &&
                    viewDetails !== undefined
                  ) {
                    viewDetails.open = false
                  }
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
          <details
            ref={viewDetails}
            class={`${styles.stageSetup} ${styles.stageViewMenu}`}
            onToggle={(event) => openStageDisclosure(event.currentTarget)}
          >
            <summary
              ref={viewSummary}
              aria-label={
                mode() === 'flow'
                  ? `Camera, ${cameraLabel()}`
                  : 'Display settings'
              }
              onClick={() => {
                if (
                  viewDetails?.open !== true &&
                  instrumentDetails !== undefined
                ) {
                  instrumentDetails.open = false
                }
              }}
            >
              {mode() === 'flow' ? 'Camera' : 'Display'}
              <Show when={mode() === 'flow'}>
                <span class={styles.stageSetupContext}> · {cameraLabel()}</span>
              </Show>
            </summary>
            <StageViewPicker
              showCameraChoices={mode() === 'flow'}
              cameraPreset={cameraPresetId()}
              handedness={handedness()}
              effects={effects()}
              onCameraPreset={(preset) => {
                setCameraPresetId(preset)
                if (viewDetails !== undefined) viewDetails.open = false
                queueMicrotask(() => viewSummary?.focus())
              }}
              onHandedness={setHandedness}
              onEffects={setEffects}
            />
          </details>
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
        <div
          class={styles.stageFlow}
          classList={{ [styles.stageFlowHidden]: mode() !== 'flow' }}
          aria-hidden={mode() !== 'flow'}
        >
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
              display={display}
              presentation={flowPresentation}
              showGizmo={() => false}
              ariaLabel={flowSummary}
              fallbackText={flowSummary}
              borderRadius={() => '0'}
              cameraPreset={cameraPreset}
              cameraAutoFollow={() => cameraPresetId() === 'phrase-focus'}
              reducedMotion={systemReducedMotion}
              reducedEffects={() => display().effects === 'reduced'}
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
        </div>

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
                        each={visibleTabNotesByString()[stringIndex()] ?? []}
                      >
                        {(entry) => (
                          <b
                            classList={{
                              [styles.stageTabNoteActive]: entry.isActive,
                              [styles.stageTabNotePast]: entry.isPast,
                              [styles.stageTabNoteBacking]:
                                entry.note.isBacking === true,
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
            aria-label={`${NECK_WINDOW_FRETS}-fret ${instrumentLabel()} neck. ${targetSummary()}`}
            role="img"
            data-handedness={handedness()}
          >
            <div class={styles.fretNumbers} aria-hidden="true">
              <For each={displayedNeckFrets()}>
                {(fret) => <span>{fret}</span>}
              </For>
            </div>
            <For each={tuning().labels}>
              {(_label, stringIndex) => (
                <div class={styles.neckString} aria-hidden="true">
                  <For each={displayedNeckFrets()}>
                    {(fret) => (
                      <span
                        classList={{
                          [styles.neckTarget]: activeNeckCells().has(
                            `${stringIndex()}:${fret}`,
                          ),
                          [styles.neckNextTarget]: nextNeckCells().has(
                            `${stringIndex()}:${fret}`,
                          ),
                        }}
                      />
                    )}
                  </For>
                </div>
              )}
            </For>
            <Show when={!hasGuide()}>
              <p>Free play · {tuning().labels.join(' ')}</p>
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
