// ============================================================
// Cue lifecycle — pure transitions enforcing the v0 one-active-cue policy
// ============================================================

import { CueDomainError } from './errors'
import { normalizeCueText } from './text'
import type { BesideCueStateV1, Cue, CueId, Instant } from './types'

export interface CreateCueInput {
  readonly id: CueId
  readonly pullCategoryId?: string
  readonly pullText: string
  readonly bSideSuggestionId?: string
  readonly bSideText: string
  readonly mascotSetId?: string
  readonly at: Instant
}

export interface ReplaceCueInput extends CreateCueInput {
  readonly replacedCueId: CueId
}

export interface CueMutationResult {
  readonly state: BesideCueStateV1
  readonly cue: Cue
}

/** Asserts the cue identity invariant for persisted or imported state. */
export function assertUniqueCueIds(state: BesideCueStateV1): void {
  const ids = new Set<CueId>()
  for (const cue of state.cues) {
    if (typeof cue.id !== 'string' || cue.id.trim() === '') {
      throw new CueDomainError('invalid_cue_id', 'Cue id must not be empty.')
    }
    if (ids.has(cue.id)) {
      throw new CueDomainError(
        'cue_id_conflict',
        `State contains duplicate cue ids: ${cue.id}`,
      )
    }
    ids.add(cue.id)
  }
}

export function assertOneActiveCue(state: BesideCueStateV1): void {
  assertUniqueCueIds(state)
  const activeCueIds = state.cues
    .filter((cue) => cue.status === 'active')
    .map((cue) => cue.id)

  if (activeCueIds.length > 1) {
    throw new CueDomainError(
      'active_cue_conflict',
      `State contains multiple active cues: ${activeCueIds.join(', ')}`,
    )
  }
}

function requireCue(state: BesideCueStateV1, cueId: CueId): Cue {
  assertUniqueCueIds(state)
  const cue = state.cues.find((candidate) => candidate.id === cueId)
  if (cue === undefined) {
    throw new CueDomainError('cue_not_found', `Cue not found: ${cueId}`)
  }
  return cue
}

function validateNewCueId(state: BesideCueStateV1, cueId: CueId): void {
  assertUniqueCueIds(state)
  if (cueId.trim() === '') {
    throw new CueDomainError('invalid_cue_id', 'Cue id must not be empty.')
  }
  if (state.cues.some((cue) => cue.id === cueId)) {
    throw new CueDomainError(
      'cue_id_conflict',
      `Cue id already exists: ${cueId}`,
    )
  }
}

function buildCue(
  state: BesideCueStateV1,
  input: CreateCueInput,
  status: Cue['status'],
): Cue {
  validateNewCueId(state, input.id)

  return {
    id: input.id,
    status,
    ...(input.pullCategoryId === undefined
      ? {}
      : { pullCategoryId: input.pullCategoryId }),
    pullText: normalizeCueText(input.pullText),
    ...(input.bSideSuggestionId === undefined
      ? {}
      : { bSideSuggestionId: input.bSideSuggestionId }),
    bSideText: normalizeCueText(input.bSideText),
    mascotSetId: input.mascotSetId ?? 'corktop-v1',
    createdAt: input.at,
    updatedAt: input.at,
  }
}

function replaceCueRecord(state: BesideCueStateV1, cue: Cue): BesideCueStateV1 {
  return {
    ...state,
    cues: state.cues.map((candidate) =>
      candidate.id === cue.id ? cue : candidate,
    ),
  }
}

function assertNoOtherActiveCue(state: BesideCueStateV1, cueId: CueId): void {
  const otherActiveCue = state.cues.find(
    (cue) => cue.status === 'active' && cue.id !== cueId,
  )
  if (otherActiveCue !== undefined) {
    throw new CueDomainError(
      'active_cue_conflict',
      `Cue ${otherActiveCue.id} is already active.`,
    )
  }
}

export function createCue(
  state: BesideCueStateV1,
  input: CreateCueInput,
): CueMutationResult {
  assertOneActiveCue(state)
  const cue = buildCue(state, input, 'draft')

  return {
    cue,
    state: { ...state, cues: [...state.cues, cue] },
  }
}

export function activateCue(
  state: BesideCueStateV1,
  cueId: CueId,
  at: Instant,
): CueMutationResult {
  assertOneActiveCue(state)
  const current = requireCue(state, cueId)
  if (current.status === 'active') return { state, cue: current }
  if (current.status === 'archived') {
    throw new CueDomainError(
      'invalid_cue_transition',
      'An archived cue cannot be activated.',
    )
  }
  assertNoOtherActiveCue(state, cueId)

  const cue: Cue = { ...current, status: 'active', updatedAt: at }
  return { cue, state: replaceCueRecord(state, cue) }
}

export function pauseCue(
  state: BesideCueStateV1,
  cueId: CueId,
  at: Instant,
): CueMutationResult {
  assertOneActiveCue(state)
  const current = requireCue(state, cueId)
  if (current.status === 'paused') return { state, cue: current }
  if (current.status !== 'active') {
    throw new CueDomainError(
      'invalid_cue_transition',
      'Only an active cue can be paused.',
    )
  }

  const cue: Cue = { ...current, status: 'paused', updatedAt: at }
  return { cue, state: replaceCueRecord(state, cue) }
}

export function resumeCue(
  state: BesideCueStateV1,
  cueId: CueId,
  at: Instant,
): CueMutationResult {
  assertOneActiveCue(state)
  const current = requireCue(state, cueId)
  if (current.status === 'active') return { state, cue: current }
  if (current.status !== 'paused') {
    throw new CueDomainError(
      'invalid_cue_transition',
      'Only a paused cue can be resumed.',
    )
  }
  assertNoOtherActiveCue(state, cueId)

  const cue: Cue = { ...current, status: 'active', updatedAt: at }
  return { cue, state: replaceCueRecord(state, cue) }
}

export function replaceCue(
  state: BesideCueStateV1,
  input: ReplaceCueInput,
): CueMutationResult {
  assertOneActiveCue(state)
  const replaced = requireCue(state, input.replacedCueId)
  if (replaced.status !== 'active' && replaced.status !== 'paused') {
    throw new CueDomainError(
      'invalid_cue_transition',
      'Only an active or paused cue can be replaced.',
    )
  }
  assertNoOtherActiveCue(state, replaced.id)

  // Validate the new cue before constructing the changed snapshot. This keeps
  // replacement atomic even when normalization or id validation fails.
  const cue = buildCue(state, input, 'active')
  const archived: Cue = {
    ...replaced,
    status: 'archived',
    updatedAt: input.at,
    archivedAt: input.at,
  }

  return {
    cue,
    state: {
      ...state,
      cues: [
        ...state.cues.map((candidate) =>
          candidate.id === archived.id ? archived : candidate,
        ),
        cue,
      ],
    },
  }
}
