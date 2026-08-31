// ============================================================
// Drum groove draft controller — session-local prepared-groove editing
// ============================================================
//
// Each First Pocket variation keeps an independent in-memory draft. Gesture
// previews and paging are UI state; only a committed command changes the
// canonical groove document consumed by Drum Night's existing scheduler.

import type { Accessor } from 'solid-js'
import { createMemo, createSignal } from 'solid-js'
import type { DrumSessionDocument } from '@/features/drum-night/session/drum-session'
import type { FirstPocketVariantId } from '@/features/drum-night/session/prepared-grooves'
import { createFirstPocketGroove, FIRST_POCKET_DEFAULT_VARIANT, FIRST_POCKET_VARIANTS, } from '@/features/drum-night/session/prepared-grooves'
import type { DrumGrooveEditCommand, DrumGrooveEditOutcome, EditableDrumGrooveHit, EditableDrumGrooveState, } from './groove-editor'
import { applyDrumGrooveCommand, createEditableDrumGroove, materializeDrumGrooveDocument, } from './groove-editor'

export const DRUM_GROOVE_PAGE_SIZES = [4, 8, 16] as const

export type DrumGroovePageSize = (typeof DRUM_GROOVE_PAGE_SIZES)[number]

export interface DrumGrooveMovePreview {
  readonly hitId: string
  readonly fromStepIndex: number
  readonly stepIndex: number
  readonly valid: boolean
}

export interface DrumGrooveDraftChange {
  readonly variantId: FirstPocketVariantId
  readonly command: DrumGrooveEditCommand
  readonly state: EditableDrumGrooveState
  readonly document: DrumSessionDocument
}

export interface DrumGrooveDraftControllerOptions {
  readonly initialVariantId?: FirstPocketVariantId
  readonly documents?: Readonly<
    Record<FirstPocketVariantId, DrumSessionDocument>
  >
  readonly onChange?: (change: DrumGrooveDraftChange) => void
}

export interface DrumGrooveDraftController {
  readonly variantId: Accessor<FirstPocketVariantId>
  readonly state: Accessor<EditableDrumGrooveState>
  readonly document: Accessor<DrumSessionDocument>
  readonly selectedHitId: Accessor<string | null>
  readonly selectedHit: Accessor<EditableDrumGrooveHit | null>
  readonly movePreview: Accessor<DrumGrooveMovePreview | null>
  readonly pageSize: Accessor<DrumGroovePageSize>
  readonly pageIndex: Accessor<number>
  readonly pageCount: Accessor<number>
  readonly pageStartStep: Accessor<number>
  readonly dirty: Accessor<boolean>
  readonly draftFor: (
    variantId: FirstPocketVariantId,
  ) => EditableDrumGrooveState
  readonly documentFor: (variantId: FirstPocketVariantId) => DrumSessionDocument
  /** Validate a complete prepared draft set without changing live editor state. */
  readonly canReplaceDrafts: (
    drafts: Readonly<Record<FirstPocketVariantId, EditableDrumGrooveState>>,
    activeVariantId: FirstPocketVariantId,
  ) => boolean
  /** Replace every prepared draft after a fully validated project restore. */
  readonly replaceDrafts: (
    drafts: Readonly<Record<FirstPocketVariantId, EditableDrumGrooveState>>,
    activeVariantId: FirstPocketVariantId,
  ) => boolean
  readonly selectVariant: (variantId: FirstPocketVariantId) => void
  readonly selectHit: (hitId: string | null) => boolean
  readonly setPageSize: (pageSize: DrumGroovePageSize) => void
  readonly setPageIndex: (pageIndex: number) => void
  readonly previousPage: () => void
  readonly nextPage: () => void
  readonly dispatch: (command: DrumGrooveEditCommand) => DrumGrooveEditOutcome
  readonly addHit: (gmKey: number, stepIndex: number) => DrumGrooveEditOutcome
  readonly removeSelectedHit: () => DrumGrooveEditOutcome | null
  readonly undo: () => DrumGrooveEditOutcome
  readonly reset: () => DrumGrooveEditOutcome
  readonly beginMovePreview: (hitId: string) => boolean
  readonly updateMovePreview: (stepIndex: number) => boolean
  readonly commitMovePreview: () => DrumGrooveEditOutcome | null
  readonly cancelMovePreview: () => void
}

type DraftRecord = Record<FirstPocketVariantId, EditableDrumGrooveState>

const VARIANT_IDS = new Set<FirstPocketVariantId>(
  FIRST_POCKET_VARIANTS.map((variant) => variant.id),
)

function defaultDocuments(): Record<FirstPocketVariantId, DrumSessionDocument> {
  return Object.fromEntries(
    FIRST_POCKET_VARIANTS.map((variant) => [
      variant.id,
      createFirstPocketGroove(variant.id).document,
    ]),
  ) as Record<FirstPocketVariantId, DrumSessionDocument>
}

function createDrafts(
  documents: Readonly<Record<FirstPocketVariantId, DrumSessionDocument>>,
): DraftRecord {
  return Object.fromEntries(
    FIRST_POCKET_VARIANTS.map((variant) => [
      variant.id,
      createEditableDrumGroove(documents[variant.id]),
    ]),
  ) as DraftRecord
}

function isDirty(state: EditableDrumGrooveState): boolean {
  return (
    state.hits !== state.sourceHits ||
    state.swing !== 0 ||
    state.density !== 1 ||
    state.nextCreatedOrdinal !== 1
  )
}

function boundedPageIndex(
  state: EditableDrumGrooveState,
  pageSize: DrumGroovePageSize,
  requestedPage: number,
): number {
  const count = Math.max(1, Math.ceil(state.stepCount / pageSize))
  const finitePage = Number.isFinite(requestedPage)
    ? Math.trunc(requestedPage)
    : 0
  return Math.min(count - 1, Math.max(0, finitePage))
}

export function createDrumGrooveDraftController(
  options: DrumGrooveDraftControllerOptions = {},
): DrumGrooveDraftController {
  const initialVariantId =
    options.initialVariantId !== undefined &&
    VARIANT_IDS.has(options.initialVariantId)
      ? options.initialVariantId
      : FIRST_POCKET_DEFAULT_VARIANT
  const documents = options.documents ?? defaultDocuments()
  const [variantId, setVariantId] =
    createSignal<FirstPocketVariantId>(initialVariantId)
  const [drafts, setDrafts] = createSignal<DraftRecord>(createDrafts(documents))
  const [selectedHitId, setSelectedHitId] = createSignal<string | null>(null)
  const [movePreview, setMovePreview] =
    createSignal<DrumGrooveMovePreview | null>(null)
  const [pageSize, setPageSizeSignal] = createSignal<DrumGroovePageSize>(16)
  const [pageIndex, setPageIndexSignal] = createSignal(0)

  const state = createMemo(() => drafts()[variantId()])
  const document = createMemo(() => materializeDrumGrooveDocument(state()))
  const selectedHit = createMemo(
    () => state().hits.find((hit) => hit.id === selectedHitId()) ?? null,
  )
  const pageCount = createMemo(() =>
    Math.max(1, Math.ceil(state().stepCount / pageSize())),
  )
  const pageStartStep = createMemo(() => pageIndex() * pageSize())
  const dirty = createMemo(() => isDirty(state()))

  function draftFor(
    requestedVariantId: FirstPocketVariantId,
  ): EditableDrumGrooveState {
    return drafts()[requestedVariantId]
  }

  function documentFor(
    requestedVariantId: FirstPocketVariantId,
  ): DrumSessionDocument {
    return materializeDrumGrooveDocument(draftFor(requestedVariantId))
  }

  function canReplaceDrafts(
    nextDrafts: Readonly<Record<FirstPocketVariantId, EditableDrumGrooveState>>,
    activeVariantId: FirstPocketVariantId,
  ): boolean {
    if (!VARIANT_IDS.has(activeVariantId)) return false
    for (const candidateVariantId of VARIANT_IDS) {
      const candidate = nextDrafts[candidateVariantId]
      if (
        candidate === undefined ||
        candidate.sourceDocument.sourceFormat !== 'prepared'
      ) {
        return false
      }
      try {
        materializeDrumGrooveDocument(candidate)
      } catch {
        return false
      }
    }

    return true
  }

  function replaceDrafts(
    nextDrafts: Readonly<Record<FirstPocketVariantId, EditableDrumGrooveState>>,
    activeVariantId: FirstPocketVariantId,
  ): boolean {
    if (!canReplaceDrafts(nextDrafts, activeVariantId)) return false

    setDrafts({ ...nextDrafts })
    setVariantId(activeVariantId)
    setSelectedHitId(null)
    setMovePreview(null)
    setPageIndexSignal(0)
    return true
  }

  function selectVariant(nextVariantId: FirstPocketVariantId): void {
    if (!VARIANT_IDS.has(nextVariantId) || nextVariantId === variantId()) return
    setVariantId(nextVariantId)
    setSelectedHitId(null)
    setMovePreview(null)
    setPageIndexSignal(0)
  }

  function selectHit(hitId: string | null): boolean {
    if (hitId === null) {
      setSelectedHitId(null)
      return true
    }
    if (!state().hits.some((hit) => hit.id === hitId)) return false
    setSelectedHitId(hitId)
    return true
  }

  function setPageSize(nextPageSize: DrumGroovePageSize): void {
    if (!DRUM_GROOVE_PAGE_SIZES.includes(nextPageSize)) return
    const currentStart = pageStartStep()
    setPageSizeSignal(nextPageSize)
    setPageIndexSignal(
      boundedPageIndex(
        state(),
        nextPageSize,
        Math.floor(currentStart / nextPageSize),
      ),
    )
    setMovePreview(null)
  }

  function setPageIndex(nextPageIndex: number): void {
    setPageIndexSignal(boundedPageIndex(state(), pageSize(), nextPageIndex))
    setMovePreview(null)
  }

  function previousPage(): void {
    setPageIndex(pageIndex() - 1)
  }

  function nextPage(): void {
    setPageIndex(pageIndex() + 1)
  }

  function dispatch(command: DrumGrooveEditCommand): DrumGrooveEditOutcome {
    const activeVariantId = variantId()
    const currentState = drafts()[activeVariantId]
    const outcome = applyDrumGrooveCommand(currentState, command)
    if (!outcome.changed) return outcome

    setDrafts((currentDrafts) => ({
      ...currentDrafts,
      [activeVariantId]: outcome.state,
    }))
    if (
      selectedHitId() !== null &&
      !outcome.state.hits.some((hit) => hit.id === selectedHitId())
    ) {
      setSelectedHitId(null)
    }
    const nextDocument = materializeDrumGrooveDocument(outcome.state)
    options.onChange?.({
      variantId: activeVariantId,
      command,
      state: outcome.state,
      document: nextDocument,
    })
    return outcome
  }

  function addHit(gmKey: number, stepIndex: number): DrumGrooveEditOutcome {
    const outcome = dispatch({ type: 'add-hit', gmKey, stepIndex })
    if (outcome.changed) {
      const added = outcome.state.hits.find(
        (hit) =>
          hit.gmKey === gmKey &&
          hit.stepIndex === stepIndex &&
          hit.origin.kind === 'editor' &&
          hit.origin.createdOrdinal === outcome.state.nextCreatedOrdinal - 1,
      )
      if (added !== undefined) setSelectedHitId(added.id)
    }
    return outcome
  }

  function removeSelectedHit(): DrumGrooveEditOutcome | null {
    const hitId = selectedHitId()
    if (hitId === null) return null
    return dispatch({ type: 'remove-hit', hitId })
  }

  function undo(): DrumGrooveEditOutcome {
    setMovePreview(null)
    return dispatch({ type: 'undo' })
  }

  function reset(): DrumGrooveEditOutcome {
    setMovePreview(null)
    const outcome = dispatch({ type: 'reset' })
    if (outcome.changed) setSelectedHitId(null)
    return outcome
  }

  function beginMovePreview(hitId: string): boolean {
    const hit = state().hits.find((candidate) => candidate.id === hitId)
    if (hit === undefined) return false
    setSelectedHitId(hit.id)
    setMovePreview({
      hitId: hit.id,
      fromStepIndex: hit.stepIndex,
      stepIndex: hit.stepIndex,
      valid: true,
    })
    return true
  }

  function updateMovePreview(stepIndex: number): boolean {
    const preview = movePreview()
    if (preview === null) return false
    const currentState = state()
    const hit = currentState.hits.find(
      (candidate) => candidate.id === preview.hitId,
    )
    if (
      hit === undefined ||
      !Number.isInteger(stepIndex) ||
      stepIndex < 0 ||
      stepIndex >= currentState.stepCount
    ) {
      return false
    }
    const occupied = currentState.hits.some(
      (candidate) =>
        candidate.id !== hit.id &&
        candidate.trackId === hit.trackId &&
        candidate.gmKey === hit.gmKey &&
        candidate.stepIndex === stepIndex,
    )
    setMovePreview({
      ...preview,
      stepIndex,
      valid: !occupied,
    })
    return !occupied
  }

  function commitMovePreview(): DrumGrooveEditOutcome | null {
    const preview = movePreview()
    setMovePreview(null)
    if (
      preview === null ||
      !preview.valid ||
      preview.stepIndex === preview.fromStepIndex
    ) {
      return null
    }
    return dispatch({
      type: 'move-hit',
      hitId: preview.hitId,
      stepIndex: preview.stepIndex,
    })
  }

  function cancelMovePreview(): void {
    setMovePreview(null)
  }

  return {
    variantId,
    state,
    document,
    selectedHitId,
    selectedHit,
    movePreview,
    pageSize,
    pageIndex,
    pageCount,
    pageStartStep,
    dirty,
    draftFor,
    documentFor,
    canReplaceDrafts,
    replaceDrafts,
    selectVariant,
    selectHit,
    setPageSize,
    setPageIndex,
    previousPage,
    nextPage,
    dispatch,
    addHit,
    removeSelectedHit,
    undo,
    reset,
    beginMovePreview,
    updateMovePreview,
    commitMovePreview,
    cancelMovePreview,
  }
}
