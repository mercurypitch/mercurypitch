// ============================================================
// Drum Night groove editor — pure canonical event editing
// ============================================================
//
// The editor owns no transport, audio, persistence, or UI state. Structural
// edits operate on one bounded prepared groove; swing and density remain
// reversible projections until the result is materialized back into the
// existing DrumSessionDocument boundary.

import type { DrumVoiceFamily } from '@/features/drum-night/session/drum-score'
import { drumScoreVoiceForGmKey } from '@/features/drum-night/session/drum-score'
import type { DrumSessionDocument } from '@/features/drum-night/session/drum-session'
import type { MidiSongPercussionHit, MidiSongPercussionSource, MidiSongPercussionTrack, MidiSongTrack, } from '@/lib/midi-song'
import { normalizeGeneralMidiPercussionKey } from '@/lib/percussion'

export const DRUM_GROOVE_SUBDIVISION_BEATS = 0.25
export const DRUM_GROOVE_STEPS_PER_BAR = 16
export const MAX_DRUM_GROOVE_HITS = 256
export const MAX_DRUM_GROOVE_UNDO_STEPS = 32
/** Full swing delays the second sixteenth of each pair to a 2:1 triplet feel. */
export const MAX_DRUM_GROOVE_SWING_OFFSET_BEATS = 1 / 12

export type EditableDrumGrooveBarCount = 1 | 2

export interface DrumGrooveFamilyMetadata {
  readonly id: DrumVoiceFamily
  readonly label: string
  readonly order: number
}

export const DRUM_GROOVE_FAMILIES: readonly DrumGrooveFamilyMetadata[] =
  Object.freeze([
    Object.freeze({ id: 'kick', label: 'Kick', order: 0 }),
    Object.freeze({ id: 'snare', label: 'Snare', order: 1 }),
    Object.freeze({ id: 'hi-hat', label: 'Hi-hat', order: 2 }),
    Object.freeze({ id: 'tom', label: 'Toms', order: 3 }),
    Object.freeze({ id: 'cymbal', label: 'Cymbals', order: 4 }),
    Object.freeze({ id: 'auxiliary', label: 'Auxiliary', order: 5 }),
  ])

export interface SourceDrumGrooveHitOrigin {
  readonly kind: 'source'
  readonly trackIndex: number
  readonly hitIndex: number
  readonly sourceHitId: string | null
  readonly authoredBeat: number
  readonly authoredStepIndex: number
  readonly authoredOffsetBeats: number
  /** Exact source evidence remains available even after a structural edit. */
  readonly sourceEvidence: Readonly<MidiSongPercussionSource> | null
  readonly canonicalHit: Readonly<MidiSongPercussionHit>
}

export interface EditorDrumGrooveHitOrigin {
  readonly kind: 'editor'
  readonly createdOrdinal: number
}

export type DrumGrooveHitOrigin =
  | SourceDrumGrooveHitOrigin
  | EditorDrumGrooveHitOrigin

export interface EditableDrumGrooveHit {
  /** Editor-local identity; stable for deterministic command replay. */
  readonly id: string
  readonly trackId: string
  /** Exact GM articulation. Families never substitute for this value. */
  readonly gmKey: number
  readonly family: DrumVoiceFamily
  readonly velocity: number
  readonly writtenDuration: number | null
  readonly stepIndex: number
  /** Authored microtiming retained independently from the swing projection. */
  readonly offsetBeats: number
  readonly origin: DrumGrooveHitOrigin
}

export interface DrumGrooveUndoSnapshot {
  readonly hits: readonly EditableDrumGrooveHit[]
  readonly swing: number
  readonly density: number
  readonly nextCreatedOrdinal: number
}

export interface EditableDrumGrooveState {
  readonly sourceDocument: DrumSessionDocument
  readonly barCount: EditableDrumGrooveBarCount
  readonly durationBeats: number
  readonly subdivisionBeats: typeof DRUM_GROOVE_SUBDIVISION_BEATS
  readonly stepCount: number
  readonly trackIds: readonly string[]
  readonly sourceHits: readonly EditableDrumGrooveHit[]
  readonly hits: readonly EditableDrumGrooveHit[]
  /** Normalized 0–1 amount; zero reproduces authored microtiming exactly. */
  readonly swing: number
  /** Normalized 0–1 active-hit projection; events remain in `hits`. */
  readonly density: number
  readonly nextCreatedOrdinal: number
  readonly revision: number
  readonly undoDepth: number
  /** Public for serializable/pure state; persistence is intentionally deferred. */
  readonly undoHistory: readonly DrumGrooveUndoSnapshot[]
}

export type DrumGrooveEditCommand =
  | {
      readonly type: 'add-hit'
      readonly gmKey: number
      readonly stepIndex: number
      readonly velocity?: number
      readonly trackId?: string
    }
  | {
      readonly type: 'move-hit'
      readonly hitId: string
      readonly stepIndex: number
    }
  | { readonly type: 'remove-hit'; readonly hitId: string }
  | { readonly type: 'set-swing'; readonly amount: number }
  | { readonly type: 'set-density'; readonly amount: number }
  | { readonly type: 'undo' }
  | { readonly type: 'reset' }

export type DrumGrooveEditFailureReason =
  | 'at-capacity'
  | 'hit-not-found'
  | 'invalid-gm-key'
  | 'invalid-step'
  | 'invalid-value'
  | 'occupied'
  | 'track-not-found'
  | 'undo-empty'
  | 'unchanged'

export interface DrumGrooveEditOutcome {
  readonly state: EditableDrumGrooveState
  readonly changed: boolean
  readonly reason: DrumGrooveEditFailureReason | null
}

export interface DrumGrooveFamilyGroup extends DrumGrooveFamilyMetadata {
  readonly gmKeys: readonly number[]
  readonly hitIds: readonly string[]
  readonly activeHitIds: readonly string[]
  readonly hitCount: number
  readonly activeHitCount: number
}

const COMMON_TIME_BEATS_PER_BAR = 4
const END_BEAT_EPSILON = 1e-9

function freezeSourceEvidence(
  source: MidiSongPercussionSource | undefined,
): Readonly<MidiSongPercussionSource> | null {
  return source === undefined ? null : Object.freeze({ ...source })
}

function cloneHit(hit: MidiSongPercussionHit): MidiSongPercussionHit {
  return {
    ...hit,
    ...(hit.source === undefined ? {} : { source: { ...hit.source } }),
  }
}

function clonePreparedDocument(
  document: DrumSessionDocument,
): DrumSessionDocument {
  const tracks: MidiSongTrack[] = document.canonicalSong.tracks.map((track) => {
    if (track.kind !== 'percussion') {
      return { ...track, notes: track.notes.map((note) => ({ ...note })) }
    }
    const percussionHits = track.percussionHits.map(cloneHit)
    return {
      ...track,
      notes: [],
      percussionHits,
      noteCount: percussionHits.length,
    }
  })
  const percussionTracks = tracks.filter(
    (track): track is MidiSongPercussionTrack => track.kind === 'percussion',
  )
  return {
    ...document,
    canonicalSong: {
      ...document.canonicalSong,
      ...(document.canonicalSong.tempoChanges === undefined
        ? {}
        : {
            tempoChanges: document.canonicalSong.tempoChanges.map((change) => ({
              ...change,
            })),
          }),
      ...(document.canonicalSong.timeSignatures === undefined
        ? {}
        : {
            timeSignatures: document.canonicalSong.timeSignatures.map(
              (signature) => ({ ...signature }),
            ),
          }),
      tracks,
    },
    percussionTracks,
  }
}

function validatePreparedDocument(
  document: DrumSessionDocument,
  durationBeats: number,
): void {
  if (document.sourceFormat !== 'prepared') {
    throw new Error(
      'The compact groove editor currently accepts prepared Drum Night sessions only.',
    )
  }
  if (
    document.pitchedTrackCount !== 0 ||
    document.canonicalSong.tracks.some((track) => track.kind !== 'percussion')
  ) {
    throw new Error(
      'Prepared groove editing cannot include pitched backing tracks.',
    )
  }
  if (document.percussionTracks.length === 0) {
    throw new Error('A prepared groove needs at least one percussion track.')
  }
  const trackIds = document.percussionTracks.map((track) => track.id)
  if (new Set(trackIds).size !== trackIds.length) {
    throw new Error('Prepared groove percussion track ids must be unique.')
  }

  const timeSignatures = document.canonicalSong.timeSignatures ?? []
  const opening = [...timeSignatures]
    .filter((signature) => signature.beat <= 0)
    .sort((left, right) => left.beat - right.beat)
    .at(-1) ?? { beat: 0, numerator: 4, denominator: 4 }
  if (opening.numerator !== 4 || opening.denominator !== 4) {
    throw new Error('The compact groove editor currently requires 4/4 meter.')
  }
  if (
    timeSignatures.some(
      (signature) =>
        signature.beat > 0 &&
        signature.beat < durationBeats &&
        (signature.numerator !== 4 || signature.denominator !== 4),
    )
  ) {
    throw new Error(
      'The compact groove editor cannot cross a time-signature change.',
    )
  }
}

function orderedHits(
  hits: readonly EditableDrumGrooveHit[],
): readonly EditableDrumGrooveHit[] {
  return Object.freeze(
    [...hits].sort(
      (left, right) =>
        left.stepIndex - right.stepIndex ||
        left.offsetBeats - right.offsetBeats ||
        left.gmKey - right.gmKey ||
        left.id.localeCompare(right.id),
    ),
  )
}

function freezeEditableHit(hit: EditableDrumGrooveHit): EditableDrumGrooveHit {
  return Object.freeze(hit)
}

function sourceHits(
  document: DrumSessionDocument,
  stepCount: number,
  durationBeats: number,
): readonly EditableDrumGrooveHit[] {
  const hits: EditableDrumGrooveHit[] = []
  for (const [trackIndex, track] of document.percussionTracks.entries()) {
    for (const [hitIndex, hit] of track.percussionHits.entries()) {
      if (hit.startBeat < 0 || hit.startBeat >= durationBeats) continue
      if (normalizeGeneralMidiPercussionKey(hit.gmKey) === null) {
        throw new Error(
          `Prepared groove hit ${hit.id ?? hitIndex} has an invalid GM key.`,
        )
      }
      if (
        !Number.isFinite(hit.startBeat) ||
        !Number.isFinite(hit.velocity) ||
        hit.velocity < 1 ||
        hit.velocity > 127
      ) {
        throw new Error(
          `Prepared groove hit ${hit.id ?? hitIndex} has invalid event data.`,
        )
      }
      const stepIndex = Math.min(
        stepCount - 1,
        Math.max(0, Math.round(hit.startBeat / DRUM_GROOVE_SUBDIVISION_BEATS)),
      )
      const canonicalHit = Object.freeze(cloneHit(hit))
      hits.push(
        freezeEditableHit({
          id: `source:${trackIndex}:${hitIndex}:${hit.id ?? 'anonymous'}`,
          trackId: track.id,
          gmKey: hit.gmKey,
          family: drumScoreVoiceForGmKey(hit.gmKey).family,
          velocity: Math.round(hit.velocity),
          writtenDuration:
            hit.writtenDuration === undefined ? null : hit.writtenDuration,
          stepIndex,
          offsetBeats:
            hit.startBeat - stepIndex * DRUM_GROOVE_SUBDIVISION_BEATS,
          origin: Object.freeze({
            kind: 'source',
            trackIndex,
            hitIndex,
            sourceHitId: hit.id ?? null,
            authoredBeat: hit.startBeat,
            authoredStepIndex: stepIndex,
            authoredOffsetBeats:
              hit.startBeat - stepIndex * DRUM_GROOVE_SUBDIVISION_BEATS,
            sourceEvidence: freezeSourceEvidence(hit.source),
            canonicalHit,
          }),
        }),
      )
      if (hits.length > MAX_DRUM_GROOVE_HITS) {
        throw new Error(
          `Prepared groove exceeds the ${MAX_DRUM_GROOVE_HITS}-hit editor limit.`,
        )
      }
    }
  }
  return orderedHits(hits)
}

function workingSnapshot(
  state: EditableDrumGrooveState,
): DrumGrooveUndoSnapshot {
  return Object.freeze({
    hits: state.hits,
    swing: state.swing,
    density: state.density,
    nextCreatedOrdinal: state.nextCreatedOrdinal,
  })
}

function nextHistory(
  state: EditableDrumGrooveState,
): readonly DrumGrooveUndoSnapshot[] {
  return Object.freeze(
    [...state.undoHistory, workingSnapshot(state)].slice(
      -MAX_DRUM_GROOVE_UNDO_STEPS,
    ),
  )
}

function nextState(
  state: EditableDrumGrooveState,
  next: Partial<
    Pick<
      EditableDrumGrooveState,
      'density' | 'hits' | 'nextCreatedOrdinal' | 'swing'
    >
  >,
): EditableDrumGrooveState {
  const undoHistory = nextHistory(state)
  return Object.freeze({
    ...state,
    ...next,
    revision: state.revision + 1,
    undoDepth: undoHistory.length,
    undoHistory,
  })
}

function unchanged(
  state: EditableDrumGrooveState,
  reason: DrumGrooveEditFailureReason,
): DrumGrooveEditOutcome {
  return Object.freeze({ state, changed: false, reason })
}

function changed(state: EditableDrumGrooveState): DrumGrooveEditOutcome {
  return Object.freeze({ state, changed: true, reason: null })
}

function validStep(state: EditableDrumGrooveState, stepIndex: number): boolean {
  return (
    Number.isInteger(stepIndex) && stepIndex >= 0 && stepIndex < state.stepCount
  )
}

function occupied(
  hits: readonly EditableDrumGrooveHit[],
  trackId: string,
  gmKey: number,
  stepIndex: number,
  exceptHitId?: string,
): boolean {
  return hits.some(
    (hit) =>
      hit.id !== exceptHitId &&
      hit.trackId === trackId &&
      hit.gmKey === gmKey &&
      hit.stepIndex === stepIndex,
  )
}

function normalizedAmount(value: number): number | null {
  if (!Number.isFinite(value)) return null
  return Math.min(1, Math.max(0, value))
}

/** Seed a bounded 16th-grid editor from an authored prepared groove. */
export function createEditableDrumGroove(
  document: DrumSessionDocument,
  options: { readonly barCount?: EditableDrumGrooveBarCount } = {},
): EditableDrumGrooveState {
  const barCount =
    options.barCount ??
    (document.durationBeats >= 8 ? (2 as const) : (1 as const))
  if (barCount !== 1 && barCount !== 2) {
    throw new Error('The compact groove editor supports one or two bars.')
  }
  const durationBeats = barCount * COMMON_TIME_BEATS_PER_BAR
  validatePreparedDocument(document, durationBeats)
  const sourceDocument = clonePreparedDocument(document)
  const stepCount = barCount * DRUM_GROOVE_STEPS_PER_BAR
  const initialHits = sourceHits(sourceDocument, stepCount, durationBeats)
  return Object.freeze({
    sourceDocument,
    barCount,
    durationBeats,
    subdivisionBeats: DRUM_GROOVE_SUBDIVISION_BEATS,
    stepCount,
    trackIds: Object.freeze(
      sourceDocument.percussionTracks.map((track) => track.id),
    ),
    sourceHits: initialHits,
    hits: initialHits,
    swing: 0,
    density: 1,
    nextCreatedOrdinal: 1,
    revision: 0,
    undoDepth: 0,
    undoHistory: Object.freeze([]),
  })
}

/** Apply one pure edit command; rejected commands return the original state. */
export function applyDrumGrooveCommand(
  state: EditableDrumGrooveState,
  command: DrumGrooveEditCommand,
): DrumGrooveEditOutcome {
  if (command.type === 'undo') {
    const previous = state.undoHistory.at(-1)
    if (previous === undefined) return unchanged(state, 'undo-empty')
    const undoHistory = Object.freeze(state.undoHistory.slice(0, -1))
    return changed(
      Object.freeze({
        ...state,
        ...previous,
        revision: state.revision + 1,
        undoDepth: undoHistory.length,
        undoHistory,
      }),
    )
  }

  if (command.type === 'reset') {
    if (
      state.hits === state.sourceHits &&
      state.swing === 0 &&
      state.density === 1 &&
      state.nextCreatedOrdinal === 1
    ) {
      return unchanged(state, 'unchanged')
    }
    return changed(
      nextState(state, {
        hits: state.sourceHits,
        swing: 0,
        density: 1,
        nextCreatedOrdinal: 1,
      }),
    )
  }

  if (command.type === 'set-swing' || command.type === 'set-density') {
    const amount = normalizedAmount(command.amount)
    if (amount === null) return unchanged(state, 'invalid-value')
    const key = command.type === 'set-swing' ? 'swing' : 'density'
    if (state[key] === amount) return unchanged(state, 'unchanged')
    return changed(nextState(state, { [key]: amount }))
  }

  if (command.type === 'remove-hit') {
    if (!state.hits.some((hit) => hit.id === command.hitId)) {
      return unchanged(state, 'hit-not-found')
    }
    return changed(
      nextState(state, {
        hits: orderedHits(state.hits.filter((hit) => hit.id !== command.hitId)),
      }),
    )
  }

  if (!validStep(state, command.stepIndex)) {
    return unchanged(state, 'invalid-step')
  }

  if (command.type === 'move-hit') {
    const hit = state.hits.find((candidate) => candidate.id === command.hitId)
    if (hit === undefined) return unchanged(state, 'hit-not-found')
    if (
      occupied(state.hits, hit.trackId, hit.gmKey, command.stepIndex, hit.id)
    ) {
      return unchanged(state, 'occupied')
    }
    if (hit.stepIndex === command.stepIndex && hit.offsetBeats === 0) {
      return unchanged(state, 'unchanged')
    }
    const moved = freezeEditableHit({
      ...hit,
      stepIndex: command.stepIndex,
      offsetBeats: 0,
    })
    return changed(
      nextState(state, {
        hits: orderedHits(
          state.hits.map((candidate) =>
            candidate.id === command.hitId ? moved : candidate,
          ),
        ),
      }),
    )
  }

  if (state.hits.length >= MAX_DRUM_GROOVE_HITS) {
    return unchanged(state, 'at-capacity')
  }
  if (normalizeGeneralMidiPercussionKey(command.gmKey) === null) {
    return unchanged(state, 'invalid-gm-key')
  }
  const trackId = command.trackId ?? state.trackIds[0]
  if (trackId === undefined || !state.trackIds.includes(trackId)) {
    return unchanged(state, 'track-not-found')
  }
  if (occupied(state.hits, trackId, command.gmKey, command.stepIndex)) {
    return unchanged(state, 'occupied')
  }
  if (command.velocity !== undefined && !Number.isFinite(command.velocity)) {
    return unchanged(state, 'invalid-value')
  }
  const velocity = Math.round(
    Math.min(127, Math.max(1, command.velocity ?? 100)),
  )
  const createdOrdinal = state.nextCreatedOrdinal
  const hit = freezeEditableHit({
    id: `editor:${String(createdOrdinal).padStart(4, '0')}`,
    trackId,
    gmKey: command.gmKey,
    family: drumScoreVoiceForGmKey(command.gmKey).family,
    velocity,
    writtenDuration: DRUM_GROOVE_SUBDIVISION_BEATS,
    stepIndex: command.stepIndex,
    offsetBeats: 0,
    origin: Object.freeze({ kind: 'editor', createdOrdinal }),
  })
  return changed(
    nextState(state, {
      hits: orderedHits([...state.hits, hit]),
      nextCreatedOrdinal: createdOrdinal + 1,
    }),
  )
}

function metricalPriority(stepIndex: number): number {
  if (stepIndex % DRUM_GROOVE_STEPS_PER_BAR === 0) return 5
  if (stepIndex % 4 === 0) return 4
  if (stepIndex % 2 === 0) return 3
  return 2
}

function familyPriority(family: DrumVoiceFamily): number {
  if (family === 'kick') return 6
  if (family === 'snare') return 5
  if (family === 'hi-hat') return 3
  if (family === 'tom') return 2
  if (family === 'cymbal') return 1
  return 0
}

/** Project density without deleting or rewriting any editable event. */
export function activeDrumGrooveHits(
  state: EditableDrumGrooveState,
): readonly EditableDrumGrooveHit[] {
  if (state.density >= 1) return state.hits
  if (state.density <= 0 || state.hits.length === 0) return Object.freeze([])
  const requested = Math.max(1, Math.round(state.hits.length * state.density))
  const selectedIds = new Set(
    [...state.hits]
      .sort(
        (left, right) =>
          metricalPriority(right.stepIndex) -
            metricalPriority(left.stepIndex) ||
          familyPriority(right.family) - familyPriority(left.family) ||
          right.velocity - left.velocity ||
          left.id.localeCompare(right.id),
      )
      .slice(0, requested)
      .map((hit) => hit.id),
  )
  return Object.freeze(state.hits.filter((hit) => selectedIds.has(hit.id)))
}

/** Stable lane metadata for a compact family-grouped editor or mixer. */
export function groupDrumGrooveHits(
  state: EditableDrumGrooveState,
): readonly DrumGrooveFamilyGroup[] {
  const activeIds = new Set(activeDrumGrooveHits(state).map((hit) => hit.id))
  return Object.freeze(
    DRUM_GROOVE_FAMILIES.map((metadata) => {
      const familyHits = state.hits.filter((hit) => hit.family === metadata.id)
      const activeHitIds = familyHits
        .filter((hit) => activeIds.has(hit.id))
        .map((hit) => hit.id)
      return Object.freeze({
        ...metadata,
        gmKeys: Object.freeze(
          [...new Set(familyHits.map((hit) => hit.gmKey))].sort(
            (left, right) => left - right,
          ),
        ),
        hitIds: Object.freeze(familyHits.map((hit) => hit.id)),
        activeHitIds: Object.freeze(activeHitIds),
        hitCount: familyHits.length,
        activeHitCount: activeHitIds.length,
      })
    }),
  )
}

function transformedStartBeat(
  state: EditableDrumGrooveState,
  hit: EditableDrumGrooveHit,
): number {
  const gridBeat = hit.stepIndex * DRUM_GROOVE_SUBDIVISION_BEATS
  const swingOffset =
    hit.stepIndex % 2 === 1
      ? state.swing * MAX_DRUM_GROOVE_SWING_OFFSET_BEATS
      : 0
  return Math.min(
    state.durationBeats - END_BEAT_EPSILON,
    Math.max(0, gridBeat + hit.offsetBeats + swingOffset),
  )
}

function materializedHit(
  state: EditableDrumGrooveState,
  hit: EditableDrumGrooveHit,
): MidiSongPercussionHit {
  const startBeat = transformedStartBeat(state, hit)
  const maximumWrittenDuration = Math.max(0, state.durationBeats - startBeat)
  const writtenDuration =
    hit.writtenDuration === null
      ? undefined
      : Math.min(maximumWrittenDuration, Math.max(0, hit.writtenDuration))
  const sourceHit =
    hit.origin.kind === 'source' ? hit.origin.canonicalHit : undefined
  return {
    ...(sourceHit ?? {}),
    id: sourceHit?.id ?? hit.id,
    gmKey: hit.gmKey,
    startBeat,
    velocity: hit.velocity,
    ...(writtenDuration === undefined ? {} : { writtenDuration }),
    ...(sourceHit?.source === undefined
      ? {}
      : { source: { ...sourceHit.source } }),
  }
}

/**
 * Materialize onto the existing session boundary. The returned document is a
 * client of the route's scheduler and tempo map; it creates no parallel clock.
 */
export function materializeDrumGrooveDocument(
  state: EditableDrumGrooveState,
): DrumSessionDocument {
  const active = activeDrumGrooveHits(state)
  const hitsByTrack = new Map<string, MidiSongPercussionHit[]>()
  for (const hit of active) {
    const trackHits = hitsByTrack.get(hit.trackId) ?? []
    trackHits.push(materializedHit(state, hit))
    hitsByTrack.set(hit.trackId, trackHits)
  }
  const tracks: MidiSongTrack[] = state.sourceDocument.canonicalSong.tracks.map(
    (track) => {
      if (track.kind !== 'percussion') return { ...track }
      const percussionHits = [...(hitsByTrack.get(track.id) ?? [])].sort(
        (left, right) =>
          left.startBeat - right.startBeat ||
          (left.id ?? '').localeCompare(right.id ?? ''),
      )
      return {
        ...track,
        notes: [],
        percussionHits,
        noteCount: percussionHits.length,
      }
    },
  )
  const percussionTracks = tracks.filter(
    (track): track is MidiSongPercussionTrack => track.kind === 'percussion',
  )
  return {
    ...state.sourceDocument,
    canonicalSong: {
      ...state.sourceDocument.canonicalSong,
      tracks,
    },
    percussionTracks,
    hitCount: active.length,
    droppedHitCount: percussionTracks.reduce(
      (total, track) => total + track.droppedHitCount,
      0,
    ),
    durationBeats: state.durationBeats,
  }
}
