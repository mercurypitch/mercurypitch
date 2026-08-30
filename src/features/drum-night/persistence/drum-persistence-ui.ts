// ============================================================
// Drum persistence UI — storage-free view contracts and scalar labels
// ============================================================
//
// These projections deliberately exclude durable payloads, raw capture data,
// audio, and device setup. Lazy UI components consume only display-safe truth.

export interface DrumProjectLibraryRow {
  readonly id: string
  readonly name: string
  readonly variationLabel: string
  readonly barCount: number
  readonly hitCount: number
  readonly tempoBpm: number
  readonly editedAt: number
  readonly onStage: boolean
}

export type DrumProjectLibraryState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'loading' }
  | { readonly kind: 'error'; readonly message?: string }
  | {
      readonly kind: 'ready'
      readonly projects: readonly DrumProjectLibraryRow[]
      readonly skippedCount: number
      readonly futureCount: number
    }

export interface DrumCurrentProjectView {
  readonly id: string | null
  readonly name: string
  readonly suggestedName: string
  readonly dirty: boolean
  readonly persisted: boolean
}

export type DrumProjectOperationAction =
  | 'save'
  | 'open'
  | 'rename'
  | 'delete'
  | 'revert'
  | 'erase'

export type DrumProjectOperationState =
  | { readonly kind: 'idle' }
  | {
      readonly kind: 'pending'
      readonly action: DrumProjectOperationAction
      readonly projectId?: string
    }
  | {
      readonly kind: 'error'
      readonly action: DrumProjectOperationAction
      readonly message: string
    }

export interface DrumProjectLibraryView {
  readonly library: DrumProjectLibraryState
  readonly current: DrumCurrentProjectView
  readonly savePromptOpen: boolean
  readonly operation: DrumProjectOperationState
}

export interface DrumProjectLibraryProps {
  readonly view: DrumProjectLibraryView
  /** Return to the groove editor; renders the header back control when set. */
  readonly onBack?: () => void
  readonly onLoad: () => void
  readonly onRetry: () => void
  readonly onSaveCurrent: (name: string) => void
  readonly onRetrySave: () => void
  readonly onRevertCurrent: () => void
  readonly onCancelSavePrompt: () => void
  readonly onOpenProject: (projectId: string) => void
  readonly onSaveCurrentThenOpen: (
    projectId: string,
    currentName: string,
  ) => void
  readonly onDiscardCurrentThenOpen: (projectId: string) => void
  readonly onRenameProject: (projectId: string, name: string) => void
  readonly onDeleteProject: (projectId: string) => void
  readonly onEraseAll: () => void
}

export type DrumTakeHistoryMode = 'compact' | 'expanded'

export interface DrumTakeSummaryRow {
  readonly id: string
  readonly finishedAt: number
  readonly sourceLabel: string
  readonly variationLabel?: string
  readonly rangeLabel: string
  readonly matchedHitCount: number
  readonly targetHitCount: number
  readonly meanTimingOffsetMs: number | null
  readonly timingLabel: string
  readonly centredCount: number
  readonly earlyCount: number
  readonly lateCount: number
  readonly meanVelocityOffset: number | null
  readonly inputLabel: string
}

export type DrumTakeFinishState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'saving' }
  | { readonly kind: 'saved'; readonly message?: string }
  | { readonly kind: 'error'; readonly message?: string }

export type DrumTakeHistoryState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'loading' }
  | { readonly kind: 'error'; readonly message?: string }
  | {
      readonly kind: 'ready'
      readonly takes: readonly DrumTakeSummaryRow[]
      readonly skippedCount: number
      readonly futureCount: number
    }

export interface DrumTakeHistoryView {
  readonly capturedHitCount: number
  readonly canFinish: boolean
  readonly unavailableReason?: string
  readonly finish: DrumTakeFinishState
  readonly history: DrumTakeHistoryState
}

export interface DrumTakeHistoryProps {
  readonly mode: DrumTakeHistoryMode
  readonly view: DrumTakeHistoryView
  readonly onFinishTake: () => void
  readonly onRetryFinish: () => void
  readonly onDiscardFailedTake: () => void
  readonly onLoadHistory: () => void
  readonly onRetryHistory: () => void
}

export function formatPersistenceCount(
  value: number,
  singular: string,
  multiple = `${singular}s`,
): string {
  return `${value} ${value === 1 ? singular : multiple}`
}

export function formatPersistenceDate(
  timestamp: number,
  invalidCopy: string,
  prefix = '',
): string {
  const date = new Date(timestamp)
  if (!Number.isFinite(date.getTime())) return invalidCopy
  const formatted = new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
  return `${prefix}${formatted}`
}

export function formatSignedPersistenceMeasurement(
  value: number | null,
  unit: string,
): string {
  if (value === null) return 'Not measured'
  const rounded = Math.round(value)
  const sign = rounded > 0 ? '+' : rounded < 0 ? '−' : ''
  return `${sign}${Math.abs(rounded)} ${unit}`
}

export function drumProjectOperationLabel(
  action: DrumProjectOperationAction,
): string {
  if (action === 'save') return 'Saving project…'
  if (action === 'open') return 'Opening project…'
  if (action === 'rename') return 'Renaming project…'
  if (action === 'delete') return 'Deleting project…'
  if (action === 'revert') return 'Restoring saved project…'
  return 'Erasing Drum projects and takes…'
}
