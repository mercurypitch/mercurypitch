// ============================================================
// useProgressRecord — the Progress tab's loading, telemetry and share state
// ============================================================
//
// What the web page (ProgressRoute) and the native app's page
// (apps/mercurypitch/src/shell/progress) share, written once: the
// identity-safe read of the record, the snapshot built from it, which moment
// and history filter are chosen, the status the page draws (loading, empty,
// error, ready), the telemetry every interaction sends, and the share
// studio's detached evidence. Each page draws the snapshot in its own look;
// neither derives a claim of its own.
//
// A changed auth or session key never shows the previous singer's record
// while the replacement loads, and a share payload is dropped the moment the
// identity changes, so the next singer on the device cannot export the last
// one's moment.

import type { Accessor } from 'solid-js'
import { createEffect, createMemo, createResource, createSignal, onMount, } from 'solid-js'
import { accountHeld } from '@/db/services/auth-service'
import { sessionRecordVersion } from '@/db/services/session-service'
import { authVersion } from '@/db/services/user-service'
import { trackEvent } from '@/lib/analytics'
import type { ProgressModel } from './model'
import { loadProgressModel } from './progress-data'
import { buildProgressShareMoment } from './progress-share-model'
import { buildProgressPageSnapshot, findProgressMoment, progressMomentId, } from './progress-view-model'
import type { ProgressActionView, ProgressPageSnapshot, ProgressSurfaceStatus, } from './ProgressPage'
import type { ProgressShareExportStatus, ProgressShareMoment, } from './share-card'

export interface ProgressResourceSuccess {
  status: 'success'
  key: string
  model: ProgressModel
}

export interface ProgressResourceFailure {
  status: 'error'
  key: string
  error: unknown
  /** Kept only for a same-key refetch; identity/session rollovers stay blank. */
  model?: ProgressModel
}

export type ProgressResourceValue =
  | ProgressResourceSuccess
  | ProgressResourceFailure

export function progressResourceKey(
  authRevision: number,
  sessionRevision: number,
): string {
  return `auth:${authRevision}:sessions:${sessionRevision}`
}

const REQUIRED_SOURCES = [
  'sessions',
  'voiceprints',
  'account-activity',
  'recognition',
] as const

export function isProgressEmpty(model: ProgressModel): boolean {
  const requiredSourcesAvailable = REQUIRED_SOURCES.every(
    (id) =>
      model.coverage.find((item) => item.id === id)?.status !== 'unavailable',
  )
  return (
    requiredSourcesAvailable &&
    model.sessions.totalLoaded === 0 &&
    model.voiceprintGrowth.count === 0 &&
    model.recognition.milestones.length === 0 &&
    model.activityTotal === 0 &&
    model.league?.eligible !== true
  )
}

export function progressModelForKey(
  resolved: ProgressResourceValue | undefined,
  key: string,
): ProgressModel | undefined {
  return resolved?.key === key ? resolved.model : undefined
}

/** Missing evidence is factual coverage, not a request failure. */
export function hasProgressLoadFailure(model: ProgressModel): boolean {
  return model.coverage.some(
    (item) =>
      (REQUIRED_SOURCES as readonly string[]).includes(item.id) &&
      item.status === 'unavailable',
  )
}

const LOAD_FAILURE =
  'Progress could not load. Your saved practice is unchanged.'

function unavailableCoverageMessage(model: ProgressModel): string {
  const unavailable = model.coverage
    .filter((item) => item.status === 'unavailable')
    .map((item) => item.label)
  if (unavailable.length === 0) return 'Some updates could not be loaded.'
  return `${unavailable.slice(0, 2).join(' and ')}. The available record is still shown.`
}

/**
 * The empty record's way in. Exercises, not Singing: a plain Singing take
 * never banks a progress record (only the session-mode run does), so
 * `#/singing` sent the singer somewhere this empty state cannot be cleared
 * from.
 */
export const PROGRESS_EMPTY_ACTION: ProgressActionView = {
  id: 'start-exercise',
  label: 'Start an exercise',
  href: '#/exercises',
}

export interface ProgressRecord {
  /** The record for the identity on the device now, or undefined. */
  model: Accessor<ProgressModel | undefined>
  snapshot: Accessor<ProgressPageSnapshot | undefined>
  status: Accessor<ProgressSurfaceStatus>
  errorMessage: Accessor<string>
  emptyAction: ProgressActionView
  retry: () => void
  /** Choose one of the record's moments: the moment shown and shared. */
  selectMoment: (momentId: string) => void
  filterHistory: (filterId: string) => void
  changePeriod: (periodId: string) => void
  /** A next step taken from the page: counted, and a continuity one too. */
  recordAction: (action: { id: string; href?: string }) => void
  /** The share studio's moment: a detached snapshot, null when closed. */
  shareMoment: Accessor<ProgressShareMoment | null>
  shareOpen: Accessor<boolean>
  openShare: (momentId: string) => void
  closeShare: () => void
  recordShareOutcome: (outcome: ProgressShareExportStatus) => void
}

/**
 * Owns identity-safe data loading and interaction telemetry while the page
 * stays a pure surface. A changed auth/session key never renders the
 * previous singer's retained resource value during the replacement request.
 */
export function useProgressRecord(): ProgressRecord {
  const currentKey = (): string =>
    progressResourceKey(authVersion(), sessionRecordVersion())
  const [result, { refetch }] = createResource(
    currentKey,
    async (key, info): Promise<ProgressResourceValue> => {
      try {
        return {
          status: 'success',
          key,
          model: await loadProgressModel(),
        }
      } catch (error) {
        const retainedModel = progressModelForKey(info.value, key)
        return {
          status: 'error',
          key,
          error,
          ...(retainedModel === undefined ? {} : { model: retainedModel }),
        }
      }
    },
  )
  const currentResult = (): ProgressResourceValue | undefined => {
    const resolved = result()
    return resolved?.key === currentKey() ? resolved : undefined
  }
  const currentModel = (): ProgressModel | undefined => currentResult()?.model
  const currentFailure = (): ProgressResourceFailure | undefined => {
    const resolved = currentResult()
    return resolved?.status === 'error' ? resolved : undefined
  }

  const [selectedMomentId, setSelectedMomentId] = createSignal<string>()
  const [historyFilterId, setHistoryFilterId] = createSignal('all')
  const [shareOpen, setShareOpen] = createSignal(false)
  const [shareMoment, setShareMoment] =
    createSignal<ProgressShareMoment | null>(null)
  let shareHadTerminalOutcome = false
  let lastOpenedMomentKey = ''
  let shareAuthRevision = authVersion()

  onMount(() => trackEvent('progress_viewed'))

  createEffect(() => {
    const nextAuthRevision = authVersion()
    if (nextAuthRevision === shareAuthRevision) return
    shareAuthRevision = nextAuthRevision

    // The share payload is a detached evidence snapshot. Drop it immediately
    // when identity changes so the next singer on this device cannot inspect
    // or export the previous singer's moment while their own model reloads.
    shareHadTerminalOutcome = true
    setShareOpen(false)
    setShareMoment(null)
  })

  createEffect(() => {
    const model = currentModel()
    if (model === undefined) return
    const requestedId = selectedMomentId()
    if (
      requestedId !== undefined &&
      findProgressMoment(model, requestedId) !== undefined
    ) {
      return
    }
    setSelectedMomentId(progressMomentId(model.oneMoment))
  })

  createEffect(() => {
    const model = currentModel()
    const momentId = selectedMomentId()
    if (
      model === undefined ||
      momentId === undefined ||
      findProgressMoment(model, momentId) === undefined
    ) {
      return
    }
    const openedKey = `${currentKey()}:${momentId}`
    if (openedKey === lastOpenedMomentKey) return
    lastOpenedMomentKey = openedKey
    trackEvent('progress_moment_opened')
  })

  const snapshot = createMemo(() => {
    const model = currentModel()
    if (model === undefined) return undefined
    return buildProgressPageSnapshot(model, {
      accountHeld: accountHeld(),
      selectedMomentId: selectedMomentId(),
      historyFilterId: historyFilterId(),
    })
  })

  const status = createMemo((): ProgressSurfaceStatus => {
    const model = currentModel()
    if (model === undefined) {
      if (result.loading) return 'loading'
      return currentFailure() === undefined ? 'loading' : 'error'
    }
    if (currentFailure() !== undefined) return 'error'
    if (hasProgressLoadFailure(model)) return 'error'
    if (isProgressEmpty(model)) return 'empty'
    return 'ready'
  })

  const errorMessage = createMemo(() => {
    const failure = currentFailure()
    if (failure !== undefined) {
      return failure.error instanceof Error
        ? failure.error.message
        : LOAD_FAILURE
    }
    const model = currentModel()
    if (model !== undefined) return unavailableCoverageMessage(model)
    return LOAD_FAILURE
  })

  const selectMoment = (momentId: string): void => {
    const model = currentModel()
    if (
      model === undefined ||
      findProgressMoment(model, momentId) === undefined
    )
      return
    setSelectedMomentId(momentId)
    trackEvent('progress_moment_changed')
  }

  const openShare = (momentId: string): void => {
    const model = currentModel()
    if (model === undefined) return
    const moment = findProgressMoment(model, momentId)
    if (moment === undefined || moment.kind === 'empty') return
    setShareMoment(buildProgressShareMoment(moment, model))
    shareHadTerminalOutcome = false
    setShareOpen(true)
    trackEvent('progress_share_opened')
  }

  const closeShare = (): void => {
    if (!shareHadTerminalOutcome) trackEvent('progress_share_cancelled')
    setShareOpen(false)
    setShareMoment(null)
  }

  const recordShareOutcome = (outcome: ProgressShareExportStatus): void => {
    if (outcome.outcome === 'shared') {
      shareHadTerminalOutcome = true
      trackEvent('progress_share_completed')
    } else if (outcome.outcome === 'downloaded') {
      shareHadTerminalOutcome = true
      trackEvent('progress_share_downloaded')
    } else if (outcome.outcome === 'dismissed') {
      shareHadTerminalOutcome = true
      trackEvent('progress_share_cancelled')
    }
  }

  const recordAction = (action: { id: string; href?: string }): void => {
    trackEvent('progress_next_action_clicked')
    if (action.href === '#/settings/account') {
      trackEvent('progress_account_continuity_clicked')
    }
  }

  const filterHistory = (filterId: string): void => {
    setHistoryFilterId(filterId)
    trackEvent('progress_history_filtered')
  }

  return {
    model: currentModel,
    snapshot,
    status,
    errorMessage,
    emptyAction: PROGRESS_EMPTY_ACTION,
    retry: () => void refetch(),
    selectMoment,
    filterHistory,
    changePeriod: () => trackEvent('progress_period_changed'),
    recordAction,
    shareMoment,
    shareOpen,
    openShare,
    closeShare,
    recordShareOutcome,
  }
}
