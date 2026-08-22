// Guitar Night stage adapts the shared 3D renderer into quiet Flow, Tab, and Neck views.
// ============================================================

import type { Accessor, JSX } from 'solid-js'
import { children, createEffect, createMemo, createSignal, For, lazy, onCleanup, onMount, Show, Suspense, } from 'solid-js'
import { X } from '@/components/icons'
import { Sheet } from '@/components/mobile/Sheet'
import type { GuitarPerformanceStageSource } from '@/features/guitar/runtime/guitar-performance-contract'
import type { CameraState } from '@/features/guitar-tab-3d/renderer/camera'
import type { TabCameraPresetId } from '@/features/guitar-tab-3d/renderer/camera-presets'
import { TAB_CAMERA_PRESET_CHOICES, tabCameraPreset, } from '@/features/guitar-tab-3d/renderer/camera-presets'
import { tabFretX, tabStringLaneX, } from '@/features/guitar-tab-3d/renderer/canvas2d/highway-geometry'
import type { TabPresentation, TabSceneLoopSpan, } from '@/features/guitar-tab-3d/renderer/TabRenderer'
import { VELVET_DISPLAY } from '@/features/guitar-tab-3d/renderer/TabRenderer'
import type { GuitarBendType } from '@/lib/guitar/guitar-notation'
import type { GuitarNote } from '@/lib/guitar/guitar-synth'
import type { InstrumentTuning, StringedInstrument, } from '@/lib/guitar/instrument-tuning'
import { DEFAULT_GUITAR_TUNING, MAX_STRING_COUNT, MIN_STRING_COUNT, soundingOpenMidi, } from '@/lib/guitar/instrument-tuning'
import type { MidiTimeSignature } from '@/lib/midi-bars'
import { createPersistedSignal } from '@/lib/storage'
import styles from './GuitarNightApp.module.css'
import { GuitarNightSecondaryPart } from './GuitarNightSecondaryPart'
import { GuitarNightSheetView } from './sheet/GuitarNightSheetView'
import type { SheetLane } from './sheet/sheet-model'

const Guitar3DStage = lazy(async () => {
  const module = await import('@/features/guitar/ui/Guitar3DStage')
  return { default: module.Guitar3DStage }
})

export type GuitarNightStageMode = 'flow' | 'tab' | 'neck' | 'sheet'
export type GuitarNightStageView = 'highway' | 'grid' | 'tab' | 'neck' | 'sheet'

export interface GuitarNightNeckPosition {
  stringIndex: number
  stringLabel: string
  fret: number
  midi: number
}

export type GuitarNightNeckCellState =
  | 'idle'
  | 'found'
  | 'miss'
  | 'root'
  | 'third'
  | 'fifth'

export interface GuitarNightNeckInteraction {
  /** The exact fret window this activity owns. */
  frets: Accessor<readonly number[]>
  cellState(position: GuitarNightNeckPosition): GuitarNightNeckCellState
  /** Adds activity truth such as a chord-tone role to the button name. */
  cellLabel?(
    position: GuitarNightNeckPosition,
    state: GuitarNightNeckCellState,
  ): string
  onSelect(position: GuitarNightNeckPosition): void
}

export const GUITAR_NIGHT_FLOW_PRESENTATION_KEY =
  'guitar-night-flow-presentation-v1'
export const GUITAR_NIGHT_CAMERA_PRESET_KEY = 'guitar-night-camera-preset-v1'
export const GUITAR_NIGHT_HANDEDNESS_KEY = 'guitar-night-handedness-v1'
export const GUITAR_NIGHT_EFFECTS_KEY = 'guitar-night-effects-v1'
/** Dismissing the free-play note has to outlive the visit that dismissed it. */
export const GUITAR_NIGHT_FREE_PLAY_NOTE_KEY = 'guitar-night-free-play-note-v1'

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
  /** A focused activity may expose only the projections that help its task. */
  availableViews?: Accessor<readonly GuitarNightStageView[]>
  /**
   * Every part of the loaded score, stacked against one set of bar lines. Given
   * only where there is a score to read; the Sheet view is offered only then.
   */
  sheetLanes?: Accessor<readonly SheetLane[]>
  /** Bar lines for the sheet, when the score carried its own. */
  sheetTimeSignatures?: Accessor<readonly MidiTimeSignature[] | undefined>
  /** The part being graded, drawn in full ink on the sheet. */
  scoredTrackId?: Accessor<string | undefined>
  /** Authored-beat rehearsal loop. Time-based views render it read-only. */
  loopStart?: Accessor<number | null>
  loopEnd?: Accessor<number | null>
  loopActive?: Accessor<boolean>
  /**
   * One other part, drawn small in a corner of the moving views. Tapping it
   * reads that part instead, which is how the two are swapped.
   */
  secondaryLane?: Accessor<SheetLane | null>
  /** Reading a part's name on the sheet asks to score it instead. */
  onSelectTrack?(trackId: string): void
  /** Activities can turn the lightweight neck into an accessible touch surface. */
  neckInteraction?: GuitarNightNeckInteraction
  /** Activity-owned instruction for the interactive neck group. */
  neckLabel?: Accessor<string>
  /** Free-play hosts may replace the generic ready copy without inventing a guide. */
  idleStatus?: Accessor<{ label: string; detail: string }>
  /** Host-owned evidence may extend the signal faceplate without becoming stage chrome. */
  signalAccessory?: JSX.Element
  /** Focused beginner activities may remove expert display chrome entirely. */
  showHeader?: Accessor<boolean>
  /** Host-owned cues and sheets sit over the instrument without entering layout. */
  overlay?: JSX.Element
  /**
   * Free-play note: a host-owned line in place of the generic hint. The room
   * knows things the stage cannot — that a tab is attached, and that it plays
   * somewhere else — and a note that tells a player to attach what they have
   * already attached is worse than no note.
   */
  invitationNote?: Accessor<string>
  /** Free-play note: the host's own way out of it, e.g. attaching a tab. */
  invitationAction?: JSX.Element
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
  { id: 'sheet', label: 'Sheet' },
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

export interface StageTabLoopMarker {
  mark: 'A' | 'B'
  offsetPercent: number
}

export interface StageTabLoopWindow {
  markers: readonly StageTabLoopMarker[]
  range: { leftPercent: number; widthPercent: number } | null
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

/** Place read-only A/B context on the exact moving beat window used by Tab. */
export function tabLoopWindow(
  loopStart: number | null,
  loopEnd: number | null,
  playheadBeat: number | null,
  windowBeats = TAB_WINDOW_BEATS,
): StageTabLoopWindow {
  const window = Math.max(1, windowBeats)
  const head = playheadBeat ?? 0
  const windowStart = head - window * TAB_PLAYHEAD_RATIO
  const windowEnd = windowStart + window
  const marker = (
    mark: 'A' | 'B',
    beat: number | null,
  ): StageTabLoopMarker | null => {
    if (
      beat === null ||
      !Number.isFinite(beat) ||
      beat < windowStart ||
      beat > windowEnd
    ) {
      return null
    }
    return {
      mark,
      offsetPercent: ((beat - windowStart) / window) * 100,
    }
  }
  const markers = [marker('A', loopStart), marker('B', loopEnd)].filter(
    (value): value is StageTabLoopMarker => value !== null,
  )
  if (
    loopStart === null ||
    loopEnd === null ||
    !Number.isFinite(loopStart) ||
    !Number.isFinite(loopEnd) ||
    loopEnd <= loopStart ||
    loopEnd <= windowStart ||
    loopStart >= windowEnd
  ) {
    return { markers, range: null }
  }
  const clippedStart = Math.max(windowStart, loopStart)
  const clippedEnd = Math.min(windowEnd, loopEnd)
  const leftPercent = ((clippedStart - windowStart) / window) * 100
  return {
    markers,
    range: {
      leftPercent,
      widthPercent: ((clippedEnd - clippedStart) / window) * 100,
    },
  }
}

/** Beats count from one in player-facing copy, matching the transport rail. */
function formatStageBeat(beat: number): string {
  const counted = Math.max(0, beat) + 1
  const label = Number.isInteger(counted)
    ? String(counted)
    : counted.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')
  return `beat ${label}`
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
    <div class={styles.stageInstrument} data-guitar-night-secondary-protected>
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
      data-guitar-night-secondary-protected
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
  const signalAccessory = children(() => props.signalAccessory)
  const narrowQuery = '(max-width: 720px)'
  const reducedMotionQuery = '(prefers-reduced-motion: reduce)'
  const matchesNarrowViewport = () =>
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia(narrowQuery).matches
  const [narrowViewport, setNarrowViewport] = createSignal(
    matchesNarrowViewport(),
  )
  const [viewSheetOpen, setViewSheetOpen] = createSignal(false)
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
  // "that note needs to be closeable, especially on the mobile. Its hiding
  // half the screen." It is a hint, and a hint that cannot be got rid of is
  // furniture — so the dismissal persists rather than returning next visit.
  const [freePlayNoteDismissed, setFreePlayNoteDismissed] =
    createPersistedSignal<boolean>(GUITAR_NIGHT_FREE_PLAY_NOTE_KEY, false, {
      validator: (value): value is boolean => typeof value === 'boolean',
    })

  const [effects, setEffects] = createPersistedSignal<GuitarNightEffects>(
    GUITAR_NIGHT_EFFECTS_KEY,
    'full',
    {
      validator: (value): value is GuitarNightEffects =>
        value === 'full' || value === 'reduced',
    },
  )
  const secondaryLane = createMemo(() => props.secondaryLane?.() ?? null)
  const activeView = createMemo<GuitarNightStageView>(() => {
    const currentMode = mode()
    if (currentMode !== 'flow') return currentMode
    return flowPresentation() === 'string-highway' ? 'highway' : 'grid'
  })
  const availableViews = createMemo(() => {
    const offered = STAGE_VIEW_CHOICES.filter(
      (choice) => choice.id !== 'sheet' || props.sheetLanes !== undefined,
    )
    const configured = props.availableViews?.()
    if (configured === undefined || configured.length === 0) return offered
    const allowed = new Set(configured)
    return offered.filter((choice) => allowed.has(choice.id))
  })
  const hasFlowView = createMemo(() =>
    availableViews().some(
      (choice) => choice.id === 'highway' || choice.id === 'grid',
    ),
  )
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
  const authoredLoopStart = createMemo(() => {
    const value = props.loopStart?.() ?? null
    return value !== null && Number.isFinite(value) ? value : null
  })
  const authoredLoopEnd = createMemo(() => {
    const value = props.loopEnd?.() ?? null
    return value !== null && Number.isFinite(value) ? value : null
  })
  const loopSpan = createMemo<TabSceneLoopSpan | null>(() => {
    const startBeat = authoredLoopStart()
    const endBeat = authoredLoopEnd()
    if (startBeat === null || endBeat === null || endBeat <= startBeat) {
      return null
    }
    return {
      startBeat,
      endBeat,
      active: props.loopActive?.() === true,
    }
  })
  const tabLoop = createMemo(() =>
    tabLoopWindow(authoredLoopStart(), authoredLoopEnd(), visualPlayheadBeat()),
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
  const neckFrets = createMemo(
    () => props.neckInteraction?.frets() ?? neck().frets,
  )
  const displayedNeckFrets = createMemo(() =>
    handedness() === 'left' ? [...neckFrets()].reverse() : neckFrets(),
  )
  const neckCellId = (stringIndex: number, fret: number) =>
    `${stringIndex}:${fret}`
  const [rovingNeckCell, setRovingNeckCell] = createSignal('')
  createEffect(() => {
    if (props.neckInteraction === undefined) return
    const stringCount = tuning().stringCount
    const frets = displayedNeckFrets()
    const validCells = new Set(
      Array.from({ length: stringCount }, (_, stringIndex) =>
        frets.map((fret) => neckCellId(stringIndex, fret)),
      ).flat(),
    )
    if (validCells.has(rovingNeckCell())) return
    setRovingNeckCell(neckCellId(0, frets[0] ?? 0))
  })
  const focusNeckCell = (stringIndex: number, fret: number): void => {
    const id = neckCellId(stringIndex, fret)
    setRovingNeckCell(id)
    queueMicrotask(() => {
      stageRoot
        ?.querySelector<HTMLButtonElement>(
          `[data-string-index="${stringIndex}"][data-fret="${fret}"]`,
        )
        ?.focus()
    })
  }
  const navigateNeck = (
    event: KeyboardEvent,
    position: GuitarNightNeckPosition,
  ): void => {
    if (props.neckInteraction === undefined) return
    const frets = displayedNeckFrets()
    const fretIndex = Math.max(0, frets.indexOf(position.fret))
    let nextStringIndex = position.stringIndex
    let nextFretIndex = fretIndex

    if (event.key === 'ArrowLeft') nextFretIndex -= 1
    else if (event.key === 'ArrowRight') nextFretIndex += 1
    else if (event.key === 'ArrowUp') nextStringIndex -= 1
    else if (event.key === 'ArrowDown') nextStringIndex += 1
    else if (event.key === 'Home') nextFretIndex = 0
    else if (event.key === 'End') nextFretIndex = frets.length - 1
    else return

    event.preventDefault()
    nextStringIndex = Math.min(
      tuning().stringCount - 1,
      Math.max(0, nextStringIndex),
    )
    nextFretIndex = Math.min(frets.length - 1, Math.max(0, nextFretIndex))
    const nextFret = frets[nextFretIndex]
    if (nextFret !== undefined) focusNeckCell(nextStringIndex, nextFret)
  }
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
  createEffect(() => {
    const choices = availableViews()
    if (choices.some((choice) => choice.id === activeView())) return
    const first = choices[0]?.id
    if (first !== undefined) selectView(first)
  })
  const openStageDisclosure = (opened: HTMLDetailsElement) => {
    if (!opened.open) return
    if (opened !== instrumentDetails && instrumentDetails !== undefined) {
      instrumentDetails.open = false
    }
    if (opened !== viewDetails && viewDetails !== undefined) {
      viewDetails.open = false
    }
    const room = stageRoot?.closest('[data-stage-scope]')
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
  const idleStatus = createMemo(
    () =>
      props.idleStatus?.() ?? {
        label: 'Free play',
        detail: 'Your fretboard is ready',
      },
  )
  const accessibleStringLabel = (
    label: string,
    stringIndex: number,
  ): string => {
    const ordinal = `string ${stringIndex + 1}`
    if (label.toLowerCase() !== 'e') return `${ordinal}, ${label}`
    if (stringIndex === 0) return `${ordinal}, high E`
    if (stringIndex === tuning().stringCount - 1) return `${ordinal}, low E`
    return `${ordinal}, ${label}`
  }
  const targetSummary = createMemo(() => {
    const { activeNotes: active, nextNotes: upcoming } = actualEventContext()
    if (active.length > 0) {
      return `Current target: ${targetGroupSummary(active, tuning(), noteById())}`
    }
    return upcoming.length === 0
      ? 'No upcoming target.'
      : `Next target: ${targetGroupSummary(upcoming, tuning(), noteById())}`
  })
  const loopDescription = createMemo(() => {
    const span = loopSpan()
    if (span !== null) {
      return `Loop from ${formatStageBeat(span.startBeat)} to ${formatStageBeat(span.endBeat)}, ${span.active ? 'repeating' : 'ready'}.`
    }
    const start = authoredLoopStart()
    const end = authoredLoopEnd()
    if (start !== null) {
      return `Loop start at ${formatStageBeat(start)}; end not set.`
    }
    if (end !== null)
      return `Loop end at ${formatStageBeat(end)}; start not set.`
    return ''
  })
  const loopBadge = createMemo(() => {
    const span = loopSpan()
    if (span !== null) {
      return `Loop · A ${formatStageBeat(span.startBeat).replace('beat ', '')} · B ${formatStageBeat(span.endBeat).replace('beat ', '')}`
    }
    const start = authoredLoopStart()
    const end = authoredLoopEnd()
    if (start !== null) {
      return `Loop · A ${formatStageBeat(start).replace('beat ', '')} · set B`
    }
    if (end !== null) {
      return `Loop · set A · B ${formatStageBeat(end).replace('beat ', '')}`
    }
    return null
  })
  const flowSummary = createMemo(() =>
    hasGuide()
      ? `${props.source.title()}. ${notes().length} guided notes approach ${flowPresentation() === 'string-highway' ? `${tuning().stringCount} string lanes on a ${instrumentLabel()} runway` : `a ${instrumentLabel()} fretboard grid`}. ${targetSummary()} ${loopDescription()}`
      : `${props.source.title()}. Interactive ${instrumentLabel()} ${flowPresentation() === 'string-highway' ? 'string runway' : 'fretboard grid'}; no song tab is attached. ${loopDescription()}`,
  )
  const tabSummary = createMemo(() =>
    hasGuide()
      ? `${props.source.title()}. Moving tablature with ${tuning().stringCount} string rows and ${notes().length} guided fret targets. ${targetSummary()} ${loopDescription()}`
      : `${props.source.title()}. Empty ${tuning().stringCount}-string tablature; no song tab is attached. ${loopDescription()}`,
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
      <Show when={props.showHeader?.() ?? true}>
        <header class={styles.stageHeader}>
          <div
            data-guitar-night-secondary-protected
            classList={{
              [styles.stageSignalWithAccessory]:
                signalAccessory() !== undefined,
            }}
          >
            <span>
              {isListening()
                ? heardNote() === null
                  ? 'Listening'
                  : 'Heard now'
                : hasGuide()
                  ? 'Guide ready'
                  : idleStatus().label}
            </span>
            <strong>
              {heardCopy() ??
                (hasGuide()
                  ? actualPlayheadBeat() === null
                    ? readyGuideCopy()
                    : (props.guideLabel?.() ??
                      'Follow the next note into the neck')
                  : idleStatus().detail)}
            </strong>
            <Show when={signalAccessory()}>
              {(accessory) => (
                <div class={styles.stageSignalAccessory}>{accessory()}</div>
              )}
            </Show>
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
          <div
            class={styles.stageHeaderTools}
            data-guitar-night-secondary-protected
          >
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
            {/* Narrow screens get the mobile sheet instead of an in-place
                popup. The popup is a child of `.stageHeader`, which is
                `position: absolute; z-index: 6` — a stacking context — so the
                popup's own z-index only ordered it WITHIN that context and it
                was painted under the LEARN card and the bottom deck: partly
                visible, partly unreachable. `Sheet` portals to document.body,
                so it cannot be trapped by an ancestor at all. Same shape as
                JamPanel's picker. */}
            <Show
              when={!narrowViewport()}
              fallback={
                <button
                  type="button"
                  class={styles.stageViewTrigger}
                  aria-label={
                    mode() === 'flow'
                      ? `Camera, ${cameraLabel()}`
                      : 'Display settings'
                  }
                  aria-haspopup="dialog"
                  aria-expanded={viewSheetOpen()}
                  onClick={() => setViewSheetOpen(true)}
                >
                  {mode() === 'flow' ? 'Camera' : 'Display'}
                  <Show when={mode() === 'flow'}>
                    <span class={styles.stageSetupContext}>
                      {' '}
                      · {cameraLabel()}
                    </span>
                  </Show>
                </button>
              }
            >
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
                    <span class={styles.stageSetupContext}>
                      {' '}
                      · {cameraLabel()}
                    </span>
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
            </Show>
            <Sheet
              isOpen={viewSheetOpen() && narrowViewport()}
              close={() => setViewSheetOpen(false)}
              ariaLabel={
                mode() === 'flow'
                  ? 'Camera and display settings'
                  : 'Display settings'
              }
            >
              <StageViewPicker
                showCameraChoices={mode() === 'flow'}
                cameraPreset={cameraPresetId()}
                handedness={handedness()}
                effects={effects()}
                onCameraPreset={(preset) => {
                  setCameraPresetId(preset)
                  setViewSheetOpen(false)
                }}
                onHandedness={setHandedness}
                onEffects={setEffects}
              />
            </Sheet>
            <Show when={availableViews().length > 1}>
              <div
                class={styles.stageModes}
                role="group"
                aria-label="Stage view"
              >
                <For each={availableViews()}>
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
            </Show>
          </div>
        </header>
      </Show>

      <div
        class={styles.stageViewport}
        data-stage-mode={mode()}
        data-flow-presentation={flowPresentation()}
      >
        <Show when={hasFlowView()}>
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
                loopSpan={loopSpan}
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
            <p
              class={styles.stageGestureHint}
              data-guitar-night-secondary-protected
            >
              Drag / arrows to orbit · scroll / + − to zoom · R resets
            </p>
            <Show
              when={!hasGuide() && !isListening() && !freePlayNoteDismissed()}
            >
              <div
                class={styles.stageInvitation}
                data-testid="guitar-night-free-play-note"
              >
                <button
                  class={styles.stageInvitationClose}
                  type="button"
                  aria-label="Dismiss the free play note"
                  onClick={() => setFreePlayNoteDismissed(true)}
                >
                  <X />
                </button>
                <span>Free play</span>
                <strong>The room is yours.</strong>
                <small>
                  {props.invitationNote?.() ??
                    'Attach a tab or turn on Listening whenever you want a target.'}
                </small>
                {props.invitationAction}
              </div>
            </Show>
          </div>
        </Show>

        <Show when={mode() === 'tab'}>
          <div class={styles.stageTab}>
            <div
              class={styles.stageTabLanes}
              role="img"
              aria-label={tabSummary()}
            >
              <div class={styles.stageTabGuideLayer} aria-hidden="true">
                <Show when={tabLoop().range}>
                  {(range) => (
                    <div
                      class={styles.stageTabLoopRange}
                      data-active={
                        loopSpan()?.active === true ? 'true' : undefined
                      }
                      data-testid="guitar-night-tab-loop-range"
                      style={{
                        left: `${range().leftPercent}%`,
                        width: `${range().widthPercent}%`,
                      }}
                    />
                  )}
                </Show>
                <For each={tabLoop().markers}>
                  {(marker) => (
                    <div
                      class={styles.stageTabLoopMarker}
                      data-mark={marker.mark}
                      data-active={
                        loopSpan()?.active === true ? 'true' : undefined
                      }
                      data-testid={`guitar-night-tab-loop-marker-${marker.mark.toLowerCase()}`}
                      style={{ left: `${marker.offsetPercent}%` }}
                    >
                      <span>{marker.mark}</span>
                    </div>
                  )}
                </For>
                <div
                  class={styles.stageTabPlayhead}
                  style={{ left: `${TAB_PLAYHEAD_RATIO * 100}%` }}
                />
              </div>
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

        {/* The corner part belongs to the moving views. Tab is already a tab
            strip and Sheet already stacks every part, so neither needs it. */}
        <Show when={mode() !== 'tab' && mode() !== 'sheet' && secondaryLane()}>
          {(lane) => (
            <GuitarNightSecondaryPart
              lane={lane}
              playheadBeat={() => actualPlayheadBeat() ?? 0}
              layoutKey={() => activeView()}
              {...(props.onSelectTrack === undefined
                ? {}
                : { onSwap: props.onSelectTrack })}
            />
          )}
        </Show>

        <Show when={mode() === 'sheet'}>
          <div class={styles.stageSheet}>
            <GuitarNightSheetView
              lanes={() => props.sheetLanes?.() ?? []}
              playheadBeat={() => actualPlayheadBeat() ?? 0}
              loopStart={props.loopStart}
              loopEnd={props.loopEnd}
              loopActive={props.loopActive}
              {...(props.sheetTimeSignatures === undefined
                ? {}
                : { timeSignatures: props.sheetTimeSignatures })}
              {...(props.scoredTrackId === undefined
                ? {}
                : { scoredTrackId: props.scoredTrackId })}
              {...(props.onSelectTrack === undefined
                ? {}
                : { onSelectTrack: props.onSelectTrack })}
              emptyNote="No tab attached to this song. Load a tab later, or stay in free play."
            />
          </div>
        </Show>

        <Show when={mode() === 'neck'}>
          <div
            class={styles.stageNeck}
            aria-label={`${props.neckLabel?.() ?? `${displayedNeckFrets().length}-fret ${instrumentLabel()} neck. ${targetSummary()}`} ${loopDescription()}`}
            role={props.neckInteraction === undefined ? 'img' : 'group'}
            data-handedness={handedness()}
            data-interactive={
              props.neckInteraction === undefined ? undefined : 'true'
            }
          >
            <Show when={loopBadge()}>
              {(label) => (
                <span
                  class={styles.stageLoopStatus}
                  data-active={loopSpan()?.active === true ? 'true' : undefined}
                  aria-hidden="true"
                >
                  {label()}
                </span>
              )}
            </Show>
            <div
              class={styles.fretNumbers}
              aria-hidden="true"
              style={{
                'grid-template-columns': `repeat(${displayedNeckFrets().length}, minmax(1.15rem, 1fr))`,
              }}
            >
              <For each={displayedNeckFrets()}>
                {(fret) => <span>{fret}</span>}
              </For>
            </div>
            <For each={tuning().labels}>
              {(label, stringIndex) => (
                <div
                  class={styles.neckString}
                  role={
                    props.neckInteraction === undefined ? undefined : 'group'
                  }
                  aria-hidden={
                    props.neckInteraction === undefined ? 'true' : undefined
                  }
                  aria-label={
                    props.neckInteraction === undefined
                      ? undefined
                      : accessibleStringLabel(label, stringIndex())
                  }
                  style={{
                    'grid-template-columns': `repeat(${displayedNeckFrets().length}, minmax(1.15rem, 1fr))`,
                  }}
                >
                  <For each={displayedNeckFrets()}>
                    {(fret) => {
                      const position = (): GuitarNightNeckPosition => ({
                        stringIndex: stringIndex(),
                        stringLabel: label,
                        fret,
                        midi:
                          (soundingOpenMidi(tuning())[stringIndex()] ?? 0) +
                          fret,
                      })
                      const state = () =>
                        props.neckInteraction?.cellState(position()) ?? 'idle'
                      const positionLabel = () =>
                        `${accessibleStringLabel(label, stringIndex())}, ${fret === 0 ? 'open' : `fret ${fret}`}`
                      const stateLabel = () => {
                        const activityLabel =
                          props.neckInteraction?.cellLabel?.(
                            position(),
                            state(),
                          )
                        if (activityLabel !== undefined) {
                          return `, ${activityLabel}`
                        }
                        if (state() === 'found') return ', found'
                        if (state() === 'miss') return ', wrong selection'
                        if (state() === 'root') return ', root note'
                        if (state() === 'third') return ', major third'
                        if (state() === 'fifth') return ', perfect fifth'
                        return ', not marked'
                      }
                      const roleGlyph = () => {
                        if (state() === 'root') return 'R'
                        if (state() === 'third') return '3'
                        if (state() === 'fifth') return '5'
                        return null
                      }
                      return (
                        <Show
                          when={props.neckInteraction}
                          fallback={
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
                          }
                        >
                          {(interaction) => (
                            <button
                              type="button"
                              class={styles.neckPosition}
                              classList={{
                                [styles.neckPositionFound]: state() === 'found',
                                [styles.neckPositionMiss]: state() === 'miss',
                                [styles.neckPositionRoot]: state() === 'root',
                                [styles.neckPositionThird]: state() === 'third',
                                [styles.neckPositionFifth]: state() === 'fifth',
                              }}
                              aria-label={`${positionLabel()}${stateLabel()}`}
                              aria-pressed={state() === 'found'}
                              tabindex={
                                rovingNeckCell() ===
                                neckCellId(stringIndex(), fret)
                                  ? 0
                                  : -1
                              }
                              data-string-index={stringIndex()}
                              data-fret={fret}
                              data-midi={position().midi}
                              data-state={state()}
                              onFocus={() =>
                                setRovingNeckCell(
                                  neckCellId(stringIndex(), fret),
                                )
                              }
                              onKeyDown={(event) =>
                                navigateNeck(event, position())
                              }
                              onClick={() => interaction().onSelect(position())}
                            >
                              <span class={styles.visuallyHidden}>
                                {positionLabel()}
                              </span>
                              <Show when={roleGlyph()}>
                                {(glyph) => (
                                  <span
                                    class={styles.neckPositionGlyph}
                                    aria-hidden="true"
                                  >
                                    {glyph()}
                                  </span>
                                )}
                              </Show>
                            </button>
                          )}
                        </Show>
                      )
                    }}
                  </For>
                </div>
              )}
            </For>
            <Show when={!hasGuide() && props.neckInteraction === undefined}>
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
