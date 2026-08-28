// ============================================================
// Voice History — local listening desk for kept voice takes
// ============================================================

/*
THESIS: Voice history is a listening desk organised by recurring practice
threads, with one focused listening mode visible at a time.
OWN-WORLD: MercuryPitch's dark Pitch Studio surfaces, ruled waveform fields,
quiet blue-violet accents, and compact native controls.
STORY: The singer chooses a thread, compares a pair, opens the longer pattern
only when it exists, and manages the complete take history without leaving the
same listening desk.
FIRST VIEWPORT: A compact thread rail controls a focused detail workspace;
Compare, Pattern, and All takes are mutually exclusive rather than one long
stack, and phones move deliberately from the list into one thread.
FORM: Context-first practice threads, the grounded structure selected by
surface seed 4d3b7772, extended through spectral cartography without replacing
the established Pitch Studio shell.
*/

import type { JSX } from 'solid-js'
import { createEffect, createMemo, createSignal, For, onCleanup, onMount, Show, untrack, } from 'solid-js'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { IconMic } from '@/components/exercise-icons'
import { ChevronLeft, MoreVertical, Sparkles } from '@/components/icons'
import { InfoPopover } from '@/components/InfoPopover'
import type { VoiceTakeRecord } from '@/db/entities'
import type { VoiceStorageSnapshot } from '@/db/services/voice-take-service'
import { deleteVoiceTake, deleteVoiceThread, getVoiceStorageSnapshot, getVoiceTakeBlob, getVoiceTakeContour, listVoiceTakes, renameFreeformVoiceThread, updateVoiceTake, updateVoiceTakeReflections, wipeVoiceTakes, } from '@/db/services/voice-take-service'
import { trackEvent } from '@/lib/analytics'
import { installAudioUnlock, unlockAudio } from '@/lib/audio-unlock'
import { EXERCISE_PITCH_HOLD } from '@/lib/domain/exercise-contracts'
import { midiToNoteName } from '@/lib/frequency-to-note'
import type { GuidedEvidence } from '@/lib/guided-voice'
import { isMediaPlaybackActive } from '@/lib/media-progress-loop'
import type { DecodedVoiceAtlasContour } from '@/lib/voice-contour'
import type { FxRack, FxSettings } from '@/lib/voice-fx-rack'
import { createFxRack, FX_PRESETS } from '@/lib/voice-fx-rack'
import { startExercise } from '@/stores/ui-store'
import type { DecodedVoicePlayback } from './decoded-voice-playback'
import { attemptDecodedVoicePlayback } from './decoded-voice-playback'
import type { FreeformThreadTarget } from './freeform-voice-take'
import { createFreeformThreadTarget } from './freeform-voice-take'
import type { FreeformRecorderCloseRequester } from './FreeformVoiceRecorder'
import { FreeformVoiceRecorder } from './FreeformVoiceRecorder'
import type { GuidedPracticeHandoff } from './guided-practice-handoff'
import { armGuidedPracticeHandoff, consumeGuidedPracticeReturn, guidedPracticeLaunchFromRecommendation, } from './guided-practice-handoff'
import type { GuidedVoiceTakeContextV1 } from './guided-voice-take'
import { isVoiceTakeComparisonEligible, parseGuidedVoiceTakeContext, } from './guided-voice-take'
import type { GuidedCloseRequester } from './GuidedVoiceCheck'
import { GuidedVoiceCheck } from './GuidedVoiceCheck'
import { bindListeningRoomSettings } from './listening-room-settings'
import { PracticeLoomPanel } from './PracticeLoomPanel'
import { buildPracticeLoomRenderModel, buildVoiceAtlasRenderModel, } from './voice-atlas-model'
import { createVoiceMediaProgressLoop } from './voice-media-progress'
import type { VoiceReflection, VoiceReflectionKind } from './voice-reflections'
import { createVoiceReflection, parseVoiceReflections, } from './voice-reflections'
import { downloadPreparedVoiceTake, prepareVoiceTakeExport, } from './voice-take-export'
import { VoiceAtlasPanel } from './VoiceAtlasPanel'
import styles from './VoiceHistoryPage.module.css'
import { VoicePlaybackTransport } from './VoicePlaybackTransport'
import { VoiceRoomPanel } from './VoiceRoomPanel'

interface VoiceThread {
  key: string
  title: string
  source: VoiceTakeRecord['source']
  takes: VoiceTakeRecord[]
  comparisonTakes: VoiceTakeRecord[]
}

interface SavedGuidedFocus {
  take: VoiceTakeRecord
  context: GuidedVoiceTakeContextV1 & {
    reading: NonNullable<GuidedVoiceTakeContextV1['reading']>
  }
  targetNote: string
}

interface SavedGuidedEvidenceMoment {
  id: string
  label: 'What held' | 'Current focus'
  seconds: number
  measurement: string
}

type ListeningDeskView = 'compare' | 'pattern' | 'takes'

type DeleteIntent =
  | { kind: 'take'; take: VoiceTakeRecord }
  | { kind: 'thread'; thread: VoiceThread }
  | { kind: 'all'; count: number }

interface PlaybackRequestOptions {
  requestedProgress?: number
  autoplay?: boolean
}

export function createPlaybackRequestGate(): {
  begin: () => () => boolean
  cancel: () => void
} {
  let generation = 0
  return {
    begin: () => {
      const request = ++generation
      return () => request === generation
    },
    cancel: () => {
      generation += 1
    },
  }
}

export function createTakeMutationQueue(): {
  enqueue: (takeId: string, mutation: () => Promise<void>) => Promise<void>
} {
  const tails = new Map<string, Promise<void>>()
  return {
    enqueue: (takeId, mutation) => {
      const previous = tails.get(takeId) ?? Promise.resolve()
      const current = previous.catch(() => undefined).then(mutation)
      tails.set(takeId, current)
      return current.finally(() => {
        if (tails.get(takeId) === current) tails.delete(takeId)
      })
    },
  }
}

function formatDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Unknown date'
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year:
      date.getFullYear() === new Date().getFullYear() ? undefined : 'numeric',
  }).format(date)
}

function formatDuration(durationMs: number): string {
  const seconds = Math.max(0, Math.round(durationMs / 1000))
  return seconds < 60
    ? `${seconds}s`
    : `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 ** 2).toFixed(bytes < 10 * 1024 ** 2 ? 1 : 0)} MB`
}

function threadTitle(take: VoiceTakeRecord): string {
  try {
    const context = JSON.parse(take.contextJson) as {
      targetLabel?: unknown
      threadTitle?: unknown
    }
    if (typeof context.threadTitle === 'string' && context.threadTitle !== '') {
      return context.threadTitle
    }
    if (typeof context.targetLabel === 'string' && context.targetLabel !== '') {
      return `Glass at ${context.targetLabel}`
    }
  } catch {
    // The saved title remains a complete fallback for old/corrupt context.
  }
  return take.title
}

function threadSourceLabel(source: VoiceTakeRecord['source']): string {
  if (source === 'freeform') return 'Free practice'
  if (source === 'guided') return 'Guided check'
  if (source === 'legend') return 'Weekly Legend'
  return source[0]!.toUpperCase() + source.slice(1)
}

export function buildVoiceThreads(
  takes: readonly VoiceTakeRecord[],
): VoiceThread[] {
  const grouped = new Map<string, VoiceTakeRecord[]>()
  for (const take of takes) {
    const current = grouped.get(take.comparisonKey) ?? []
    current.push(take)
    grouped.set(take.comparisonKey, current)
  }
  return [...grouped.entries()]
    .map(([key, threadTakes]) => {
      const sorted = [...threadTakes].sort(
        (left, right) =>
          new Date(left.capturedAt).getTime() -
          new Date(right.capturedAt).getTime(),
      )
      return {
        key,
        title: threadTitle(sorted.at(-1)!),
        source: sorted[0]!.source,
        takes: sorted,
        comparisonTakes: sorted.filter(isVoiceTakeComparisonEligible),
      }
    })
    .sort((left, right) => {
      const comparisonDelta =
        Number(right.comparisonTakes.length >= 2) -
        Number(left.comparisonTakes.length >= 2)
      if (comparisonDelta !== 0) return comparisonDelta
      return (
        new Date(right.takes.at(-1)!.capturedAt).getTime() -
        new Date(left.takes.at(-1)!.capturedAt).getTime()
      )
    })
}

export function findSavedGuidedFocus(
  thread: VoiceThread | null,
  preferredTakeId: string | null = null,
): SavedGuidedFocus | null {
  if (thread?.source !== 'guided') return null

  const latestFirst = [...thread.takes].reverse()
  const preferred = latestFirst.find((take) => take.id === preferredTakeId)
  const candidates =
    preferred === undefined
      ? latestFirst
      : [preferred, ...latestFirst.filter((take) => take.id !== preferred.id)]

  for (const take of candidates) {
    const context = parseGuidedVoiceTakeContext(take)
    const reading = context?.reading
    if (context === null || reading === null || reading === undefined) continue
    if (reading.recommendation.exercise.exerciseId !== EXERCISE_PITCH_HOLD) {
      continue
    }

    const retakeTask = reading.recommendation.retake.task
    const fittedCentre = retakeTask.parameters.fittedCentreMidiCents
    const fallbackCentre =
      retakeTask.targetMidiCents[
        Math.floor(retakeTask.targetMidiCents.length / 2)
      ]
    const targetMidiCents =
      typeof fittedCentre === 'number' && Number.isSafeInteger(fittedCentre)
        ? fittedCentre
        : fallbackCentre
    if (targetMidiCents === undefined) continue

    return {
      take,
      context: { ...context, reading },
      targetNote: midiToNoteName(targetMidiCents / 100),
    }
  }

  return null
}

function savedFocusCopy(focus: SavedGuidedFocus): {
  title: string
  detail: string
} {
  if (
    focus.context.reading.focusFinding.findingCode ===
    'pitch-centre.finding.reinforce-centre'
  ) {
    return {
      title: 'Make the centred pathway familiar.',
      detail:
        'Your guided landings repeatedly found the centre. Pitch Hold keeps that pathway familiar without raising the demand.',
    }
  }

  const settledEvidence = focus.context.assessment.evidence.find(
    (evidence) => evidence.id === focus.context.reading.focusFinding.evidenceId,
  )
  const settledMeasurement =
    settledEvidence?.availability === 'available' &&
    'measurement' in settledEvidence
      ? settledEvidence.measurement
      : null
  const allLandingsSettled =
    settledMeasurement?.kind === 'fraction' &&
    settledMeasurement.numerator === settledMeasurement.denominator
  return {
    title: 'Meet one clear centre without pushing.',
    detail: allLandingsSettled
      ? 'All three notes stayed near the target long enough, but they usually settled a little away from its centre. Pitch Hold keeps the next step narrow and repeatable.'
      : 'Some notes did not stay near the target long enough. Pitch Hold keeps the next step narrow and repeatable.',
  }
}

function formatSavedGuidedMeasurement(evidence: GuidedEvidence): string {
  if (evidence.availability !== 'available' || !('measurement' in evidence)) {
    return 'Evidence unavailable'
  }
  const measurement = evidence.measurement
  if (measurement.kind === 'fraction') {
    const unit =
      measurement.denominatorUnit === 'repetitions'
        ? 'landings'
        : measurement.denominatorUnit
    return `${measurement.numerator} of ${measurement.denominator} ${unit}`
  }
  return `${Math.round(measurement.value)} ${measurement.unit}`
}

function savedFocusEvidenceMoments(
  focus: SavedGuidedFocus,
): SavedGuidedEvidenceMoment[] {
  const reading = focus.context.reading
  return [
    { label: 'What held' as const, id: reading.positiveFinding.evidenceId },
    { label: 'Current focus' as const, id: reading.focusFinding.evidenceId },
  ].flatMap(({ label, id }) => {
    const evidence = focus.context.assessment.evidence.find(
      (item) => item.id === id,
    )
    if (
      evidence?.availability !== 'available' ||
      !('moments' in evidence) ||
      evidence.moments[0] === undefined
    ) {
      return []
    }
    const moment = evidence.moments[0]
    return [
      {
        id: `${label.toLowerCase().replaceAll(' ', '-')}:${moment.id}`,
        label,
        seconds: (moment.startSeconds + moment.endSeconds) / 2,
        measurement: formatSavedGuidedMeasurement(evidence),
      },
    ]
  })
}

export type VoiceHistoryLeaveRequester = (
  onResolved: (closed: boolean) => void,
) => void

interface VoiceHistoryPageProps {
  draftTitle?: string
  onDraftTitleChange?: (title: string) => void
  onLeaveRequestReady?: (request: VoiceHistoryLeaveRequester | null) => void
}

export function VoiceHistoryPage(props: VoiceHistoryPageProps): JSX.Element {
  const [takes, setTakes] = createSignal<VoiceTakeRecord[]>([])
  const [loading, setLoading] = createSignal(true)
  const [loadFailed, setLoadFailed] = createSignal(false)
  const [selectedKey, setSelectedKey] = createSignal<string | null>(null)
  const [earlierId, setEarlierId] = createSignal<string | null>(null)
  const [laterId, setLaterId] = createSignal<string | null>(null)
  const [atlasSelectedId, setAtlasSelectedId] = createSignal<string | null>(
    null,
  )
  const [storage, setStorage] = createSignal<VoiceStorageSnapshot | null>(null)
  const [activeId, setActiveId] = createSignal<string | null>(null)
  const [playing, setPlaying] = createSignal(false)
  const [progress, setProgress] = createSignal(0)
  const [playerError, setPlayerError] = createSignal<string | null>(null)
  const [exportNotice, setExportNotice] = createSignal<string | null>(null)
  const [exportingTakeId, setExportingTakeId] = createSignal<string | null>(
    null,
  )
  const [recorderTarget, setRecorderTarget] =
    createSignal<FreeformThreadTarget | null>(null)
  const [localDraftTitle, setLocalDraftTitle] = createSignal('')
  const newThreadDraftTitle = (): string =>
    props.draftTitle ?? localDraftTitle()
  const updateNewThreadDraftTitle = (title: string): void => {
    setLocalDraftTitle(title)
    props.onDraftTitleChange?.(title)
  }
  const [guidedProtocol, setGuidedProtocol] = createSignal<
    GuidedPracticeHandoff['retake'] | null
  >(null)
  const [guidedOpen, setGuidedOpen] = createSignal(false)
  const [guidedReturning, setGuidedReturning] = createSignal(false)
  const [guidedFocusTakeId, setGuidedFocusTakeId] = createSignal<string | null>(
    null,
  )
  const [pendingGuidedRefresh, setPendingGuidedRefresh] = createSignal<{
    comparisonKey: string
    takeId: string
  } | null>(null)
  const [renamingKey, setRenamingKey] = createSignal<string | null>(null)
  const [renameTitle, setRenameTitle] = createSignal('')
  const [renameError, setRenameError] = createSignal<string | null>(null)
  const [renameSaving, setRenameSaving] = createSignal(false)
  const [deleteIntent, setDeleteIntent] = createSignal<DeleteIntent | null>(
    null,
  )
  const [deleteBusy, setDeleteBusy] = createSignal(false)
  const [deleteError, setDeleteError] = createSignal<string | null>(null)
  const [roomSettings, setRoomSettings] = createSignal<FxSettings>({
    ...FX_PRESETS[0].settings,
  })
  const [contours, setContours] = createSignal<
    Record<string, DecodedVoiceAtlasContour | null>
  >({})
  const [contoursLoading, setContoursLoading] = createSignal(false)
  const [activeView, setActiveView] = createSignal<ListeningDeskView>('compare')
  const [mobileDetailOpen, setMobileDetailOpen] = createSignal(false)
  const [threadMenuOpen, setThreadMenuOpen] = createSignal(false)
  const [takeMenuId, setTakeMenuId] = createSignal<string | null>(null)
  const [allTakesSelectedId, setAllTakesSelectedId] = createSignal<
    string | null
  >(null)
  const [loomSelectedId, setLoomSelectedId] = createSignal<string | null>(null)

  let audio: HTMLAudioElement | null = null
  let audioUrl: string | null = null
  let listeningContext: AudioContext | null = null
  let listeningSource: MediaElementAudioSourceNode | null = null
  let listeningRack: FxRack | null = null
  let decodedPlayback: DecodedVoicePlayback | null = null
  let uninstallAudioUnlock = (): void => undefined
  let recordLaunchButton: HTMLButtonElement | undefined
  let guidedLaunchButton: HTMLButtonElement | undefined
  let guidedFocusCard: HTMLElement | undefined
  let guidedCheckAgainButton: HTMLButtonElement | undefined
  let requestRecorderClose: FreeformRecorderCloseRequester | null = null
  let recorderThreadDestination: string | null = null
  let requestGuidedClose: GuidedCloseRequester | null = null
  let guidedThreadDestination: string | null = null
  let guidedReturnTarget: 'launch' | 'saved-focus' = 'launch'
  let recorderReturnFocus: HTMLElement | null = null
  let recorderOpenedFromThread = false
  let threadDetailHeading: HTMLHeadingElement | undefined
  let renameInput: HTMLInputElement | undefined
  let threadMenuButton: HTMLButtonElement | undefined
  let comparisonStarted = false
  let comparisonPendingComplete = false
  let contourLoadGeneration = 0
  let playbackTakeId: string | null = null
  let playbackIsCurrent = (): boolean => false
  const playbackRequests = createPlaybackRequestGate()
  const reflectionMutations = createTakeMutationQueue()
  const playbackProgress = createVoiceMediaProgressLoop(setProgress, () => {
    const currentAudio = audio
    if (currentAudio !== null && playbackIsCurrent()) {
      finishHtmlPlayback(currentAudio)
    }
  })

  const threads = createMemo<VoiceThread[]>(() => buildVoiceThreads(takes()))

  const selectedThread = createMemo(
    () => threads().find((thread) => thread.key === selectedKey()) ?? null,
  )
  const selectedGuidedFocus = createMemo(() =>
    findSavedGuidedFocus(
      selectedThread(),
      // The Atlas selection is the singer's current comparison subject. A
      // practice return id only fills the short gap before that selection is
      // restored; it must not keep the Focus card pinned after they switch
      // between Earlier and Later.
      atlasSelectedId() ?? guidedFocusTakeId(),
    ),
  )
  // Keep the keyed workspace mounted for metadata writes within one thread.
  // The getters still expose the current takes, title, and reflections.
  const selectedThreadWorkspace = createMemo<VoiceThread | null>((previous) => {
    const current = selectedThread()
    if (current === null) return null
    if (previous?.key === current.key) return previous
    return {
      key: current.key,
      get title() {
        return selectedThread()?.title ?? current.title
      },
      get source() {
        return selectedThread()?.source ?? current.source
      },
      get takes() {
        return selectedThread()?.takes ?? current.takes
      },
      get comparisonTakes() {
        return selectedThread()?.comparisonTakes ?? current.comparisonTakes
      },
    }
  })
  const earlier = createMemo(
    () =>
      selectedThread()?.comparisonTakes.find(
        (take) => take.id === earlierId(),
      ) ?? null,
  )
  const later = createMemo(
    () =>
      selectedThread()?.comparisonTakes.find((take) => take.id === laterId()) ??
      null,
  )
  const allTakesSelected = createMemo(
    () =>
      selectedThread()?.takes.find(
        (take) => take.id === allTakesSelectedId(),
      ) ?? null,
  )
  const atlasLater = createMemo(() =>
    (selectedThread()?.comparisonTakes.length ?? 0) >= 2 ? later() : null,
  )
  const mainPlaybackTake = createMemo<VoiceTakeRecord | null>(() => {
    if (recorderTarget() !== null || guidedOpen()) return null
    const thread = selectedThread()
    if (thread === null) return null

    const loadedId = activeId()
    const loadedTake = thread.takes.find((take) => take.id === loadedId)
    if (loadedTake !== undefined) return loadedTake

    const selectedId =
      activeView() === 'compare'
        ? atlasSelectedId()
        : activeView() === 'pattern'
          ? loomSelectedId()
          : allTakesSelectedId()
    return (
      thread.takes.find((take) => take.id === selectedId) ??
      (activeView() === 'compare'
        ? (earlier() ?? atlasLater())
        : (thread.takes.at(-1) ?? null))
    )
  })
  const comparisonPairPreset = createMemo<'full-span' | 'latest' | 'custom'>(
    () => {
      const thread = selectedThread()
      if (thread === null || thread.comparisonTakes.length < 2) {
        return 'full-span'
      }
      const firstId = thread.comparisonTakes[0]?.id
      const penultimateId = thread.comparisonTakes.at(-2)?.id
      const lastId = thread.comparisonTakes.at(-1)?.id
      if (earlierId() === firstId && laterId() === lastId) return 'full-span'
      if (earlierId() === penultimateId && laterId() === lastId) return 'latest'
      return 'custom'
    },
  )
  const contourSelectionKey = createMemo(() => {
    const thread = selectedThread()
    const selectedIds = [earlier()?.id, atlasLater()?.id].filter(
      (id): id is string => id !== undefined,
    )
    const ids =
      thread !== null && thread.comparisonTakes.length >= 3
        ? thread.comparisonTakes.map((take) => take.id)
        : selectedIds
    return [...new Set(ids)].join('\n')
  })
  const atlasModel = createMemo(() => {
    const earlierTake = earlier()
    const laterTake = atlasLater()
    const loadedContours = contours()
    return buildVoiceAtlasRenderModel({
      earlier:
        earlierTake === null
          ? null
          : {
              contour: loadedContours[earlierTake.id] ?? null,
              durationSeconds: earlierTake.durationMs / 1000,
              analysisExpected: earlierTake.contourVersion !== undefined,
            },
      later:
        laterTake === null
          ? null
          : {
              contour: loadedContours[laterTake.id] ?? null,
              durationSeconds: laterTake.durationMs / 1000,
              analysisExpected: laterTake.contourVersion !== undefined,
            },
    })
  })
  const earlierContour = createMemo(() => {
    const take = earlier()
    return take === null ? null : (contours()[take.id] ?? null)
  })
  const laterContour = createMemo(() => {
    const take = atlasLater()
    return take === null ? null : (contours()[take.id] ?? null)
  })
  const loomModel = createMemo(() => {
    const thread = selectedThread()
    const loadedContours = contours()
    return buildPracticeLoomRenderModel(
      (thread?.comparisonTakes ?? []).map((take) => ({
        id: take.id,
        contour: loadedContours[take.id] ?? null,
        durationSeconds: take.durationMs / 1000,
        analysisExpected: take.contourVersion !== undefined,
      })),
    )
  })

  function ensureListeningContext(): AudioContext | null {
    if (listeningContext !== null && listeningContext.state !== 'closed') {
      return listeningContext
    }
    const WindowAudioContext =
      window.AudioContext ??
      (
        window as typeof window & {
          webkitAudioContext?: typeof AudioContext
        }
      ).webkitAudioContext
    if (WindowAudioContext === undefined) return null
    try {
      listeningContext = new WindowAudioContext()
      return listeningContext
    } catch {
      listeningContext = null
      return null
    }
  }

  function disposeListeningGraph(): void {
    listeningSource?.disconnect()
    listeningSource = null
    listeningRack?.dispose()
    listeningRack = null
  }

  function connectListeningRoom(element: HTMLAudioElement): void {
    const context = listeningContext
    if (context === null || context.state === 'closed') return
    disposeListeningGraph()
    let nextRack: FxRack | null = null
    let nextSource: MediaElementAudioSourceNode | null = null
    try {
      nextRack = createFxRack(context, { safetyLimiter: true })
      nextRack.setSettings(roomSettings())
      nextSource = context.createMediaElementSource(element)
      nextSource.connect(nextRack.input)
      listeningRack = nextRack
      listeningSource = nextSource
    } catch {
      nextRack?.dispose()
      // Once a media element has become a WebAudio source it no longer uses
      // its direct output. Keep dry playback alive if the FX graph fails.
      if (nextSource !== null) {
        nextSource.disconnect()
        try {
          nextSource.connect(context.destination)
          listeningSource = nextSource
        } catch {
          listeningSource = null
        }
      }
    }
  }

  function disposeListeningContext(): void {
    disposeListeningGraph()
    const current = listeningContext
    listeningContext = null
    if (current !== null && current.state !== 'closed') {
      void current.close().catch(() => undefined)
    }
  }

  function commitPlaybackEnded(): void {
    setPlaying(false)
    setProgress(1)
    if (comparisonPendingComplete) {
      comparisonPendingComplete = false
      trackEvent('voice_compare_complete')
    }
  }

  function finishHtmlPlayback(candidate: HTMLAudioElement): void {
    if (!playbackIsCurrent() || audio !== candidate) return
    playbackProgress.stop()
    // Safari can reach the media duration without promptly exposing `ended`.
    // Pause that terminal transport so a resolved play cannot leave stale UI.
    if (!candidate.ended && !candidate.paused) candidate.pause()
    commitPlaybackEnded()
  }

  function disposeAudio(): void {
    playbackRequests.cancel()
    playbackIsCurrent = () => false
    playbackProgress.stop()
    decodedPlayback?.dispose()
    decodedPlayback = null
    audio?.pause()
    audio = null
    disposeListeningGraph()
    playbackTakeId = null
    if (audioUrl !== null) URL.revokeObjectURL(audioUrl)
    audioUrl = null
    setActiveId(null)
    setPlaying(false)
    setProgress(0)
  }

  function changeActiveView(nextView: ListeningDeskView): void {
    if (activeView() === nextView) return
    disposeAudio()
    closeActionMenus()
    setActiveView(nextView)
  }

  async function refresh(currentKey: string | null = null): Promise<boolean> {
    if (takes().length === 0) setLoading(true)
    setLoadFailed(false)
    try {
      const [loaded, snapshot] = await Promise.all([
        listVoiceTakes(),
        getVoiceStorageSnapshot(),
      ])
      setTakes(loaded)
      setStorage(snapshot)
      const keys = new Set(loaded.map((take) => take.comparisonKey))
      if (currentKey !== null && keys.has(currentKey)) {
        setSelectedKey(currentKey)
      } else {
        setSelectedKey(buildVoiceThreads(loaded)[0]?.key ?? null)
      }
      return true
    } catch {
      setLoadFailed(true)
      return false
    } finally {
      setLoading(false)
    }
  }

  createEffect(() => {
    const thread = selectedThread()
    if (thread === null || thread.comparisonTakes.length === 0) {
      setEarlierId(null)
      setLaterId(null)
      return
    }
    const currentEarlierIndex = thread.comparisonTakes.findIndex(
      (take) => take.id === earlierId(),
    )
    const currentLaterIndex = thread.comparisonTakes.findIndex(
      (take) => take.id === laterId(),
    )
    if (
      currentEarlierIndex >= 0 &&
      (thread.comparisonTakes.length === 1
        ? currentLaterIndex === currentEarlierIndex
        : currentLaterIndex > currentEarlierIndex)
    ) {
      return
    }
    setEarlierId(thread.comparisonTakes[0]!.id)
    setLaterId(thread.comparisonTakes.at(-1)!.id)
  })

  createEffect(() => {
    const takeCount = selectedThread()?.comparisonTakes.length ?? 0
    if (activeView() === 'pattern' && takeCount < 3) {
      changeActiveView('compare')
    }
  })

  createEffect(() => {
    const thread = selectedThread()
    if (thread === null || thread.takes.length === 0) {
      setAllTakesSelectedId(null)
      return
    }
    if (!thread.takes.some((take) => take.id === allTakesSelectedId())) {
      setAllTakesSelectedId(thread.takes.at(-1)!.id)
    }
  })

  createEffect(() => {
    const thread = selectedThread()
    if (thread === null || thread.comparisonTakes.length === 0) {
      setLoomSelectedId(null)
      return
    }
    if (!thread.comparisonTakes.some((take) => take.id === loomSelectedId())) {
      setLoomSelectedId(later()?.id ?? thread.comparisonTakes.at(-1)!.id)
    }
  })

  createEffect(() => {
    const availableIds = [earlier()?.id, atlasLater()?.id].filter(
      (id): id is string => id !== undefined,
    )
    if (!availableIds.includes(atlasSelectedId() ?? '')) {
      setAtlasSelectedId(availableIds[0] ?? null)
    }
  })

  createEffect(() => {
    const selectionKey = contourSelectionKey()
    const ids =
      selectionKey === '' ? [] : [...new Set(selectionKey.split('\n'))]
    const generation = ++contourLoadGeneration
    if (ids.length === 0) {
      setContours({})
      setContoursLoading(false)
      return
    }
    setContoursLoading(true)
    void Promise.all(
      ids.map(async (id) => {
        try {
          return [id, await getVoiceTakeContour(id)] as const
        } catch {
          return [id, null] as const
        }
      }),
    )
      .then((loaded) => {
        if (generation !== contourLoadGeneration) return
        setContours(Object.fromEntries(loaded))
      })
      .finally(() => {
        if (generation === contourLoadGeneration) setContoursLoading(false)
      })
  })

  onMount(() => {
    trackEvent('voice_history_open')
    uninstallAudioUnlock = installAudioUnlock(() => listeningContext)
    window.addEventListener('keydown', togglePlaybackWithSpace, true)
    document.addEventListener('pointerdown', closeMenusFromOutsidePointer)
    document.addEventListener('keydown', closeMenusWithEscape)
    const guidedReturn = consumeGuidedPracticeReturn()
    if (guidedReturn === null) {
      void refresh()
    } else {
      // Practice returns to the evidence the singer just acted on. Keep the
      // immutable retake available behind Check again, but do not drop them
      // straight into another microphone flow before they can review it.
      setGuidedProtocol(null)
      setGuidedReturning(false)
      setGuidedOpen(false)
      setGuidedFocusTakeId(guidedReturn.takeId)
      setActiveView('compare')
      setMobileDetailOpen(true)
      const restoreOrigin = (refreshed: boolean): void => {
        if (!refreshed) return
        const origin =
          guidedReturn.takeId === null
            ? null
            : (takes().find((take) => take.id === guidedReturn.takeId) ?? null)
        if (origin !== null) {
          setSelectedKey(origin.comparisonKey)
          setAtlasSelectedId(origin.id)
          setAllTakesSelectedId(origin.id)
        }
        queueMicrotask(() => guidedFocusCard?.focus())
      }
      void refresh(guidedReturn.retake.comparisonFingerprint).then(
        // Defined inside onMount so Solid knows these signal reads happen in a
        // lifecycle scope even though refresh resolves asynchronously.
        restoreOrigin,
      )
    }
  })
  onCleanup(() => {
    window.removeEventListener('keydown', togglePlaybackWithSpace, true)
    document.removeEventListener('pointerdown', closeMenusFromOutsidePointer)
    document.removeEventListener('keydown', closeMenusWithEscape)
    uninstallAudioUnlock()
    disposeAudio()
    disposeListeningContext()
  })

  // The helper establishes its own createEffect and reads this accessor there.
  // eslint-disable-next-line solid/reactivity
  bindListeningRoomSettings(
    roomSettings,
    () => decodedPlayback ?? listeningRack,
  )

  function playTake(take: VoiceTakeRecord, fromComparison = false): void {
    unlockAudio(ensureListeningContext())
    const isCurrentTake = activeId() === take.id
    void playTakeAsync(take, fromComparison, isCurrentTake)
  }

  function blocksPlaybackShortcut(target: EventTarget | null): boolean {
    if (!(target instanceof Element)) return false
    return (
      target.closest(
        'textarea, [contenteditable], input:not([type="range"]), [role="dialog"], [role="alertdialog"], [aria-modal="true"], [role="menu"], [role="menuitem"]',
      ) !== null
    )
  }

  function canStartPlaybackFrom(target: EventTarget | null): boolean {
    if (!(target instanceof Element)) return true
    if (
      target.closest(
        'select, [role="slider"], [data-voice-playback-toggle], [data-voice-playback-scrubber], [data-voice-playback-seek]',
      ) !== null
    ) {
      return true
    }
    return (
      target.closest(
        'button, a[href], input, select, textarea, [contenteditable], [role="button"], [role="menuitem"]',
      ) === null
    )
  }

  function togglePlaybackWithSpace(event: KeyboardEvent): void {
    if (event.code !== 'Space' || event.repeat) return
    const target = event.target
    if (blocksPlaybackShortcut(target)) return
    const take = mainPlaybackTake()
    if (take === null || (!playing() && !canStartPlaybackFrom(target))) return

    event.preventDefault()
    event.stopImmediatePropagation()
    const thread = selectedThread()
    playTake(
      take,
      activeView() !== 'takes' && (thread?.comparisonTakes.length ?? 0) >= 2,
    )
  }

  function closeActionMenus(): void {
    setThreadMenuOpen(false)
    setTakeMenuId(null)
  }

  function closeMenusFromOutsidePointer(event: PointerEvent): void {
    const target = event.target
    if (
      target instanceof Element &&
      target.closest('[data-voice-action-menu]') !== null
    ) {
      return
    }
    closeActionMenus()
  }

  function closeMenusWithEscape(event: KeyboardEvent): void {
    if (
      event.key !== 'Escape' ||
      (!threadMenuOpen() && takeMenuId() === null)
    ) {
      return
    }
    const trigger = document.querySelector<HTMLButtonElement>(
      '[data-voice-action-menu] > button[aria-expanded="true"]',
    )
    event.preventDefault()
    closeActionMenus()
    queueMicrotask(() => trigger?.focus())
  }

  function applyPlaybackSeek(
    element: HTMLAudioElement,
    take: VoiceTakeRecord,
    nextProgress: number,
  ): boolean {
    const clamped = Math.max(0, Math.min(1, nextProgress))
    const mediaDuration =
      Number.isFinite(element.duration) && element.duration > 0
        ? element.duration
        : take.durationMs / 1000
    if (!Number.isFinite(mediaDuration) || mediaDuration <= 0) return false
    try {
      element.currentTime = mediaDuration * clamped
      setProgress(clamped)
      return true
    } catch {
      return false
    }
  }

  function seekTake(
    take: VoiceTakeRecord,
    nextProgress: number,
    fromComparison = false,
  ): void {
    unlockAudio(ensureListeningContext())
    if (activeId() === take.id && decodedPlayback !== null) {
      decodedPlayback.seek(nextProgress)
      return
    }
    if (activeId() === take.id && audio !== null) {
      applyPlaybackSeek(audio, take, nextProgress)
      if (playing()) playbackProgress.start(audio)
      return
    }
    void playTakeAsync(take, fromComparison, false, {
      requestedProgress: nextProgress,
      autoplay: false,
    })
  }

  async function playTakeAsync(
    take: VoiceTakeRecord,
    fromComparison: boolean,
    isCurrentTake: boolean,
    options: PlaybackRequestOptions = {},
  ): Promise<void> {
    const takeId = take.id
    const autoplay = options.autoplay !== false
    if (autoplay && fromComparison && !comparisonStarted) {
      comparisonStarted = true
      comparisonPendingComplete = true
      trackEvent('voice_compare_start')
    }
    if (isCurrentTake && decodedPlayback !== null) {
      const currentPlayback = decodedPlayback
      if (currentPlayback.playing) {
        currentPlayback.pause()
      } else {
        const started = await currentPlayback.play()
        if (
          !started &&
          playbackIsCurrent() &&
          decodedPlayback === currentPlayback
        ) {
          setPlayerError(
            'Playback was blocked. Tap play again to start the recording.',
          )
        }
      }
      return
    }
    if (isCurrentTake && audio !== null) {
      const currentAudio = audio
      const requestIsCurrent = playbackIsCurrent
      if (currentAudio.paused) {
        try {
          if (currentAudio.ended || progress() >= 1) {
            currentAudio.currentTime = 0
            setProgress(0)
          }
          await currentAudio.play()
          if (
            !requestIsCurrent() ||
            audio !== currentAudio ||
            !isMediaPlaybackActive(currentAudio)
          )
            return
          setPlaying(true)
          playbackProgress.start(currentAudio)
        } catch {
          if (!requestIsCurrent() || audio !== currentAudio) return
          setPlayerError(
            'Playback was blocked. Tap play again to start the recording.',
          )
        }
      } else {
        playbackProgress.sample(currentAudio)
        playbackProgress.stop()
        currentAudio.pause()
        setPlaying(false)
      }
      return
    }

    disposeAudio()
    const requestIsCurrent = playbackRequests.begin()
    playbackIsCurrent = requestIsCurrent
    playbackTakeId = takeId
    setPlayerError(null)
    let blob: Blob | null
    try {
      blob = await getVoiceTakeBlob(takeId)
    } catch {
      if (requestIsCurrent()) {
        playbackTakeId = null
        setPlayerError(
          'This take could not be opened from local storage. Try again or export it from the history list.',
        )
      }
      return
    }
    if (!requestIsCurrent()) return
    if (blob === null) {
      playbackTakeId = null
      setPlayerError(
        'This take’s audio is missing. Its history record remains available to delete.',
      )
      return
    }
    const decodedResult = await attemptDecodedVoicePlayback({
      context: ensureListeningContext(),
      blob,
      persistedMimeType: take.mimeType,
      settings: roomSettings(),
      autoplay,
      requestedProgress: options.requestedProgress,
      isCurrent: requestIsCurrent,
      onPrepared: (nextPlayback) => {
        decodedPlayback = nextPlayback
        setActiveId(takeId)
      },
      onDiscarded: (discardedPlayback) => {
        if (decodedPlayback === discardedPlayback) decodedPlayback = null
        setPlaying(false)
      },
      onProgress: (currentPlayback, nextProgress) => {
        if (requestIsCurrent() && decodedPlayback === currentPlayback) {
          setProgress(nextProgress)
        }
      },
      onPlayingChange: (currentPlayback, nextPlaying) => {
        if (requestIsCurrent() && decodedPlayback === currentPlayback) {
          setPlaying(nextPlaying)
        }
      },
      onEnded: (currentPlayback) => {
        if (requestIsCurrent() && decodedPlayback === currentPlayback) {
          commitPlaybackEnded()
        }
      },
      onError: (currentPlayback) => {
        if (requestIsCurrent() && decodedPlayback === currentPlayback) {
          setPlayerError(
            'Playback stopped unexpectedly. Tap play to try this take again.',
          )
        }
      },
    })
    if (decodedResult.status === 'cancelled') return
    if (decodedResult.status === 'handled') {
      if (
        decodedResult.started === false &&
        requestIsCurrent() &&
        decodedPlayback === decodedResult.playback
      ) {
        setPlayerError(
          'Playback was blocked. Tap play again to start the recording.',
        )
      }
      return
    }
    // A browser that cannot decode this WebM can still try its native media
    // element. That preserves dry playback as the final fallback.
    const nextAudioUrl = URL.createObjectURL(blob)
    const nextAudio = new Audio(nextAudioUrl)
    if (!autoplay) nextAudio.preload = 'metadata'
    nextAudio.setAttribute('playsinline', '')
    audioUrl = nextAudioUrl
    audio = nextAudio
    connectListeningRoom(nextAudio)
    nextAudio.addEventListener('timeupdate', () => {
      if (!requestIsCurrent() || audio !== nextAudio) return
      playbackProgress.sample(nextAudio)
    })
    nextAudio.addEventListener('play', () => {
      if (!requestIsCurrent() || audio !== nextAudio) return
      setPlaying(true)
      playbackProgress.start(nextAudio)
    })
    nextAudio.addEventListener('pause', () => {
      if (!requestIsCurrent() || audio !== nextAudio) return
      playbackProgress.sample(nextAudio)
      playbackProgress.stop()
      setPlaying(false)
    })
    nextAudio.addEventListener('ended', () => {
      if (!requestIsCurrent() || audio !== nextAudio) return
      finishHtmlPlayback(nextAudio)
    })
    nextAudio.addEventListener('error', () => {
      if (!requestIsCurrent() || audio !== nextAudio) return
      playbackProgress.stop()
      setPlaying(false)
      setPlayerError(
        'This browser could not decode the recording. Export it to keep the original file.',
      )
    })
    const requestedProgress = options.requestedProgress
    if (requestedProgress !== undefined) {
      const applyRequestedSeek = (): void => {
        if (!requestIsCurrent() || audio !== nextAudio) return
        applyPlaybackSeek(nextAudio, take, requestedProgress)
      }
      nextAudio.addEventListener('loadedmetadata', applyRequestedSeek, {
        once: true,
      })
      applyRequestedSeek()
    }
    setActiveId(takeId)
    if (!autoplay) return
    try {
      await nextAudio.play()
      if (
        !requestIsCurrent() ||
        audio !== nextAudio ||
        !isMediaPlaybackActive(nextAudio)
      )
        return
      setPlaying(true)
      playbackProgress.start(nextAudio)
    } catch {
      if (!requestIsCurrent() || audio !== nextAudio) return
      setPlayerError(
        'Playback was blocked. Tap play again to start the recording.',
      )
    }
  }

  async function exportTake(
    take: VoiceTakeRecord,
    threadTitle: string,
    ordinal: number,
  ): Promise<void> {
    if (exportingTakeId() !== null) return
    setExportingTakeId(take.id)
    setPlayerError(null)
    try {
      setExportNotice('Preparing a compatible audio file…')
      let blob: Blob | null
      try {
        blob = await getVoiceTakeBlob(take.id)
      } catch {
        setExportNotice(null)
        setPlayerError(
          'This take could not be opened from local storage and cannot be exported right now.',
        )
        return
      }
      if (blob === null) {
        setExportNotice(null)
        setPlayerError('This take’s audio is missing and cannot be exported.')
        return
      }
      try {
        const prepared = await prepareVoiceTakeExport(blob, {
          threadTitle,
          ordinal,
          mimeType: take.mimeType,
        })
        downloadPreparedVoiceTake(prepared.file)
        setTakeMenuId(null)
        setExportNotice(
          prepared.usedOriginalWebmFallback
            ? 'This browser could not turn this older WebM take into a WAV file. The original WebM recording was downloaded instead; some iPhone apps may list it as video.'
            : null,
        )
        trackEvent('voice_export')
      } catch {
        setExportNotice(null)
        setPlayerError('This take could not be prepared for export right now.')
      }
    } finally {
      if (exportingTakeId() === take.id) setExportingTakeId(null)
    }
  }

  function removeTake(take: VoiceTakeRecord): void {
    setDeleteError(null)
    setDeleteIntent({ kind: 'take', take })
  }

  function removeThread(thread: VoiceThread): void {
    setDeleteError(null)
    setDeleteIntent({ kind: 'thread', thread })
  }

  function confirmDelete(): void {
    const intent = deleteIntent()
    if (intent === null || deleteBusy()) return
    setDeleteBusy(true)
    setDeleteError(null)
    setPlayerError(null)
    void (async () => {
      try {
        if (intent.kind === 'take') {
          const key = intent.take.comparisonKey
          if (playbackTakeId === intent.take.id) disposeAudio()
          if (!(await deleteVoiceTake(intent.take.id))) {
            setDeleteError('The take could not be deleted. Please try again.')
            return
          }
          trackEvent('voice_delete')
          setDeleteError(null)
          setDeleteIntent(null)
          if (!(await refresh(key))) {
            setPlayerError(
              'The take was deleted, but voice history could not refresh. Reload the page to update the list.',
            )
            return
          }
          queueMicrotask(() => recordLaunchButton?.focus())
        } else if (intent.kind === 'thread') {
          if (intent.thread.takes.some((take) => take.id === playbackTakeId)) {
            disposeAudio()
          }
          if (!(await deleteVoiceThread(intent.thread.key))) {
            setDeleteError(
              'The practice thread could not be deleted. Please try again.',
            )
            return
          }
          trackEvent('voice_delete')
          setDeleteError(null)
          setDeleteIntent(null)
          if (!(await refresh())) {
            setPlayerError(
              'The thread was deleted, but voice history could not refresh. Reload the page to update the list.',
            )
            return
          }
          queueMicrotask(() => recordLaunchButton?.focus())
        } else {
          disposeAudio()
          if (!(await wipeVoiceTakes())) {
            setDeleteError(
              'Voice history could not be cleared. Please try again.',
            )
            return
          }
          setDeleteError(null)
          setDeleteIntent(null)
          if (!(await refresh())) {
            setPlayerError(
              'Voice history was cleared, but the page could not refresh. Reload the page to update the list.',
            )
            return
          }
          queueMicrotask(() => recordLaunchButton?.focus())
        }
      } catch {
        setDeleteError(
          intent.kind === 'take'
            ? 'The take could not be deleted. Please try again.'
            : intent.kind === 'thread'
              ? 'The practice thread could not be deleted. Please try again.'
              : 'Voice history could not be cleared. Please try again.',
        )
      } finally {
        setDeleteBusy(false)
      }
    })()
  }

  function toggleFavorite(take: VoiceTakeRecord): void {
    const next = !take.favorite
    void (async () => {
      const updated = await updateVoiceTake(take.id, { favorite: next })
      if (updated !== null) {
        setTakes((current) =>
          current.map((item) => (item.id === updated.id ? updated : item)),
        )
      }
    })()
  }

  function mutateReflections(
    takeId: string,
    mutation: (current: readonly VoiceReflection[]) => VoiceReflection[],
    failureMessage: string,
  ): void {
    void reflectionMutations
      .enqueue(takeId, async () => {
        // Read only after earlier writes settle; this is a snapshot, not a
        // reactive subscription owned by the queued callback.
        const take = untrack(takes).find((candidate) => candidate.id === takeId)
        if (take === undefined) return
        const current = parseVoiceReflections(
          take.reflectionsJson,
          take.reflectionsVersion,
        )
        const updated = await updateVoiceTakeReflections(
          takeId,
          mutation(current),
        )
        if (updated === null) throw new Error('Reflection update failed')
        setTakes((items) =>
          items.map((item) => (item.id === updated.id ? updated : item)),
        )
      })
      .catch(() => {
        setPlayerError(failureMessage)
      })
  }

  function addReflection(
    takeId: string,
    kind: VoiceReflectionKind,
    position: number,
    note: string,
  ): void {
    const reflection = createVoiceReflection({
      id: globalThis.crypto.randomUUID(),
      kind,
      position,
      note,
    })
    mutateReflections(
      takeId,
      (current) => [...current, reflection],
      'That reflection could not be saved on this device. Try again.',
    )
  }

  function removeReflection(takeId: string, reflectionId: string): void {
    mutateReflections(
      takeId,
      (current) =>
        current.filter((reflection) => reflection.id !== reflectionId),
      'That reflection could not be removed from this device. Try again.',
    )
  }

  function chooseEarlier(id: string): void {
    const thread = selectedThread()
    if (thread === null) return
    const candidateIndex = thread.comparisonTakes.findIndex(
      (take) => take.id === id,
    )
    const laterIndex = thread.comparisonTakes.findIndex(
      (take) => take.id === laterId(),
    )
    if (candidateIndex >= 0 && candidateIndex < laterIndex) {
      disposeAudio()
      setEarlierId(id)
      setAtlasSelectedId(id)
    }
  }

  function chooseLater(id: string): void {
    const thread = selectedThread()
    if (thread === null) return
    const earlierIndex = thread.comparisonTakes.findIndex(
      (take) => take.id === earlierId(),
    )
    const candidateIndex = thread.comparisonTakes.findIndex(
      (take) => take.id === id,
    )
    if (candidateIndex > earlierIndex) {
      disposeAudio()
      setLaterId(id)
      setAtlasSelectedId(id)
    }
  }

  function selectAtlasTake(id: string): void {
    if (atlasSelectedId() === id) return
    const isVisibleTake = earlier()?.id === id || atlasLater()?.id === id
    if (!isVisibleTake) return
    if (activeId() !== null) disposeAudio()
    setAtlasSelectedId(id)
  }

  function selectLoomTake(id: string): void {
    const thread = selectedThread()
    if (
      thread === null ||
      !thread.comparisonTakes.some((take) => take.id === id)
    ) {
      return
    }
    if (activeId() !== null && activeId() !== id) disposeAudio()
    setLoomSelectedId(id)
  }

  function chooseComparisonPair(preset: 'full-span' | 'latest'): void {
    const thread = selectedThread()
    if (thread === null || thread.comparisonTakes.length < 2) return
    const nextEarlier =
      preset === 'latest'
        ? thread.comparisonTakes.at(-2)
        : thread.comparisonTakes[0]
    const nextLater = thread.comparisonTakes.at(-1)
    if (nextEarlier === undefined || nextLater === undefined) return
    disposeAudio()
    setEarlierId(nextEarlier.id)
    setLaterId(nextLater.id)
    setAtlasSelectedId(nextEarlier.id)
  }

  function wipeAll(): void {
    setDeleteError(null)
    setDeleteIntent({ kind: 'all', count: takes().length })
  }

  function openNewRecorder(): void {
    disposeAudio()
    closeActionMenus()
    setActiveView('compare')
    recorderReturnFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null
    recorderOpenedFromThread = false
    setGuidedOpen(false)
    setGuidedReturning(false)
    setMobileDetailOpen(true)
    setRecorderTarget(createFreeformThreadTarget())
  }

  function openThreadRecorder(thread: VoiceThread): void {
    disposeAudio()
    closeActionMenus()
    setActiveView('compare')
    recorderReturnFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null
    recorderOpenedFromThread = true
    setGuidedOpen(false)
    setGuidedReturning(false)
    setMobileDetailOpen(true)
    setRecorderTarget({
      comparisonKey: thread.key,
      title: thread.title,
    })
  }

  function closeRecorder(options?: {
    keepMobileDetailOpen?: boolean
    restoreFocus?: boolean
  }): void {
    const previous = recorderReturnFocus
    const returnToThread = recorderOpenedFromThread
    const threadDestination = recorderThreadDestination
    recorderThreadDestination = null
    recorderReturnFocus = null
    recorderOpenedFromThread = false
    setRecorderTarget(null)
    if (threadDestination !== null) {
      commitThreadSelection(threadDestination)
      queueMicrotask(() => threadDetailHeading?.focus())
      return
    }
    if (!returnToThread && options?.keepMobileDetailOpen !== true) {
      setMobileDetailOpen(false)
    }
    if (options?.restoreFocus === false) return
    queueMicrotask(() => {
      if (previous?.isConnected === true) previous.focus()
      else recordLaunchButton?.focus()
    })
  }

  async function handleFreeformKept(comparisonKey: string): Promise<void> {
    if (!(await refresh(comparisonKey))) {
      throw new Error('Voice history refresh failed')
    }
    // A newly kept take becomes the new edge of the thread. Re-resolve the
    // default pair so the Atlas keeps showing the full Earlier-to-Later span.
    setEarlierId(null)
    setLaterId(null)
    setAtlasSelectedId(null)
    setMobileDetailOpen(true)
    closeRecorder({ keepMobileDetailOpen: true, restoreFocus: false })
    queueMicrotask(() => threadDetailHeading?.focus())
  }

  function openGuidedCheck(): void {
    disposeAudio()
    closeActionMenus()
    guidedReturnTarget = 'launch'
    setRecorderTarget(null)
    setGuidedProtocol(null)
    setGuidedReturning(false)
    setGuidedOpen(true)
    setMobileDetailOpen(true)
  }

  function openSavedGuidedRetake(focus: SavedGuidedFocus): void {
    disposeAudio()
    closeActionMenus()
    guidedReturnTarget = 'saved-focus'
    setRecorderTarget(null)
    setGuidedProtocol(focus.context.reading.recommendation.retake)
    setGuidedReturning(true)
    setGuidedOpen(true)
    setMobileDetailOpen(true)
  }

  function startSavedGuidedPractice(focus: SavedGuidedFocus): void {
    disposeAudio()
    closeActionMenus()
    const recommendation = focus.context.reading.recommendation
    const guidedPractice =
      guidedPracticeLaunchFromRecommendation(recommendation)
    armGuidedPracticeHandoff(
      {
        assessmentRunId: recommendation.returnDestination.assessmentRunId,
        takeId: focus.take.id,
        retake: recommendation.retake,
      },
      guidedPractice,
    )
    startExercise(EXERCISE_PITCH_HOLD, {
      notes: [midiToNoteName(guidedPractice.targetMidiCents / 100)],
      challengeName: 'Pitch Centre focus',
      guidedPractice,
    })
  }

  function restoreGuidedReturnFocus(
    returnTarget: 'launch' | 'saved-focus',
    attempt = 0,
  ): void {
    window.setTimeout(() => {
      const checkAgain =
        guidedCheckAgainButton?.isConnected === true
          ? guidedCheckAgainButton
          : undefined
      const focusCard =
        guidedFocusCard?.isConnected === true ? guidedFocusCard : undefined
      const target =
        returnTarget === 'saved-focus'
          ? (checkAgain ?? focusCard)
          : guidedLaunchButton
      if (target?.isConnected === true) {
        target.focus()
        return
      }
      // A first kept take swaps the empty state for the listening desk. Give
      // Solid one more render task to mount the exact invoking control.
      if (attempt < 2) restoreGuidedReturnFocus(returnTarget, attempt + 1)
    }, 0)
  }

  function closeGuidedCheck(): void {
    const pending = pendingGuidedRefresh()
    const returnTarget = guidedReturnTarget
    const threadDestination = guidedThreadDestination
    guidedThreadDestination = null
    setPendingGuidedRefresh(null)
    setGuidedOpen(false)
    setGuidedProtocol(null)
    setGuidedReturning(false)
    if (pending === null) {
      if (threadDestination !== null) {
        commitThreadSelection(threadDestination)
        queueMicrotask(() => threadDetailHeading?.focus())
        return
      }
      if (selectedThread() === null) setMobileDetailOpen(false)
      restoreGuidedReturnFocus(returnTarget)
      return
    }
    void refresh(pending.comparisonKey).then((refreshed) => {
      if (!refreshed) return
      setEarlierId(null)
      setLaterId(null)
      setAtlasSelectedId(pending.takeId)
      setAllTakesSelectedId(pending.takeId)
      setGuidedFocusTakeId(pending.takeId)
      setMobileDetailOpen(true)
      restoreGuidedReturnFocus(returnTarget)
    })
  }

  async function handleGuidedKept(
    comparisonKey: string,
    takeId: string,
  ): Promise<void> {
    guidedReturnTarget = 'saved-focus'
    // Refreshing an empty history switches the outer empty/desk branch and
    // would remount this still-open Guided Check at its briefing. Keep the
    // temporary result stable until the singer explicitly leaves it.
    if (takes().length === 0) {
      setPendingGuidedRefresh({ comparisonKey, takeId })
      return
    }
    if (!(await refresh(comparisonKey))) {
      throw new Error('Voice history refresh failed')
    }
    setEarlierId(null)
    setLaterId(null)
    setAtlasSelectedId(takeId)
    setAllTakesSelectedId(takeId)
    setGuidedFocusTakeId(takeId)
    setMobileDetailOpen(true)
  }

  function startRenaming(thread: VoiceThread): void {
    setRenamingKey(thread.key)
    setRenameTitle(thread.title)
    setRenameError(null)
    queueMicrotask(() => {
      renameInput?.focus()
      renameInput?.select()
    })
  }

  function finishRenaming(): void {
    setRenamingKey(null)
    setRenameTitle('')
    setRenameError(null)
    setRenameSaving(false)
    queueMicrotask(() => threadMenuButton?.focus())
  }

  function submitRename(event: SubmitEvent): void {
    event.preventDefault()
    const thread = selectedThread()
    const nextTitle = renameTitle().trim()
    if (thread === null || thread.source !== 'freeform') return
    if (nextTitle === '') {
      setRenameError('Enter a name for this practice thread.')
      renameInput?.focus()
      return
    }
    const comparisonKey = thread.key
    setRenameSaving(true)
    setRenameError(null)
    void (async () => {
      if (await renameFreeformVoiceThread(comparisonKey, nextTitle)) {
        if (await refresh(comparisonKey)) {
          finishRenaming()
        } else {
          setRenameError(
            'The thread was renamed, but the page could not refresh. Reload Hear Yourself to see it.',
          )
          setRenameSaving(false)
        }
      } else {
        setRenameError(
          'This practice thread could not be renamed. Try again without leaving the page.',
        )
        setRenameSaving(false)
      }
    })()
  }

  function commitThreadSelection(key: string): void {
    disposeAudio()
    closeActionMenus()
    setRenamingKey(null)
    setRenameError(null)
    comparisonStarted = false
    comparisonPendingComplete = false
    setAtlasSelectedId(null)
    setAllTakesSelectedId(null)
    setGuidedFocusTakeId(null)
    setActiveView('compare')
    setSelectedKey(key)
    setMobileDetailOpen(true)
  }

  function selectThread(key: string): void {
    if (recorderTarget() !== null) {
      if (requestRecorderClose === null) return
      recorderThreadDestination = key
      requestRecorderClose((closed) => {
        if (!closed && recorderThreadDestination === key) {
          recorderThreadDestination = null
        }
      })
      return
    }
    if (!guidedOpen()) {
      commitThreadSelection(key)
      return
    }
    if (requestGuidedClose === null) return
    guidedThreadDestination = key
    requestGuidedClose((closed) => {
      if (!closed) guidedThreadDestination = null
    })
  }

  function requestPageLeave(onResolved: (closed: boolean) => void): void {
    const resolveAfterChildCloses = (closed: boolean): void => {
      if (!closed) {
        onResolved(false)
        return
      }
      // Child close requesters resolve immediately before updating this page's
      // recorder/guide signal. Let that synchronous close finish before App
      // unmounts Hear Yourself for the requested tab.
      queueMicrotask(() => onResolved(true))
    }

    if (recorderTarget() !== null) {
      if (requestRecorderClose === null) {
        onResolved(false)
        return
      }
      requestRecorderClose(resolveAfterChildCloses)
      return
    }
    if (guidedOpen()) {
      if (requestGuidedClose === null) {
        onResolved(false)
        return
      }
      requestGuidedClose(resolveAfterChildCloses)
      return
    }
    onResolved(true)
  }

  createEffect(() => {
    const register = props.onLeaveRequestReady
    if (register === undefined) return
    // App navigation asks this page to close any temporary capture before it
    // changes tabs. The recorder and guide retain ownership of their exact
    // Keep/Discard confirmation rules.
    // eslint-disable-next-line solid/reactivity
    register((onResolved) => requestPageLeave(onResolved))
    onCleanup(() => register(null))
  })

  function selectAllTake(id: string): void {
    if (allTakesSelectedId() === id) return
    if (activeId() !== null) disposeAudio()
    closeActionMenus()
    setAllTakesSelectedId(id)
  }

  function returnToThreadList(): void {
    disposeAudio()
    closeActionMenus()
    setRenamingKey(null)
    setRenameError(null)
    setMobileDetailOpen(false)
  }

  function deleteDialogMessage(): JSX.Element {
    const intent = deleteIntent()
    if (intent?.kind === 'take') {
      return (
        <>
          Delete <strong>{intent.take.title}</strong> from this device? This
          cannot be undone.
          <Show when={deleteError()}>
            <span class={styles.deleteDialogError} role="alert">
              {deleteError()}
            </span>
          </Show>
        </>
      )
    }
    if (intent?.kind === 'thread') {
      return (
        <>
          Delete <strong>{intent.thread.title}</strong> and its{' '}
          {intent.thread.takes.length}{' '}
          {intent.thread.takes.length === 1 ? 'take' : 'takes'} from this
          device? Every other practice thread stays intact.
          <Show when={deleteError()}>
            <span class={styles.deleteDialogError} role="alert">
              {deleteError()}
            </span>
          </Show>
        </>
      )
    }
    return (
      <>
        Delete all {intent?.count ?? 0} kept takes from this device? Their audio
        cannot be recovered.
        <Show when={deleteError()}>
          <span class={styles.deleteDialogError} role="alert">
            {deleteError()}
          </span>
        </Show>
      </>
    )
  }

  return (
    <section class={styles.page} data-testid="voice-history-page">
      <div class={styles.header}>
        <div>
          <p class={styles.kicker}>Private voice history</p>
          <h1>Hear Yourself</h1>
          <p class={styles.intro}>
            A private listening desk for the voice you are becoming.
          </p>
        </div>
      </div>

      <Show when={playerError()}>
        <div class={styles.alert} role="alert">
          {playerError()}
          <button type="button" onClick={() => setPlayerError(null)}>
            Dismiss
          </button>
        </div>
      </Show>

      <Show when={exportNotice()}>
        <div class={styles.alert} role="status">
          {exportNotice()}
          <button type="button" onClick={() => setExportNotice(null)}>
            Dismiss
          </button>
        </div>
      </Show>

      <Show
        when={!loading() && !loadFailed()}
        fallback={
          <Show
            when={loadFailed()}
            fallback={
              <div class={styles.loading} role="status">
                Opening your local voice history…
              </div>
            }
          >
            <div class={styles.alert} role="alert">
              Your local voice history could not be opened. Your recordings have
              not been changed.
              <button type="button" onClick={() => void refresh()}>
                Try again
              </button>
            </div>
          </Show>
        }
      >
        <Show
          when={takes().length > 0}
          fallback={
            <Show
              when={guidedOpen()}
              keyed
              fallback={
                <Show
                  when={recorderTarget()}
                  keyed
                  fallback={
                    <div class={styles.empty}>
                      <div class={styles.emptyPulse} aria-hidden="true">
                        <span />
                      </div>
                      <div>
                        <h2>Start with one moment you can hear.</h2>
                        <p>
                          Take a short guided Pitch Centre check to find one
                          evidence-linked practice focus, or name something of
                          your own and record it freely. Audio stays on this
                          device.
                        </p>
                        <div class={styles.emptyActions}>
                          <button
                            ref={guidedLaunchButton}
                            type="button"
                            class={styles.primaryAction}
                            onClick={openGuidedCheck}
                          >
                            <Sparkles />
                            Find my next focus
                          </button>
                          <button
                            ref={recordLaunchButton}
                            type="button"
                            class={styles.emptySecondaryButton}
                            onClick={openNewRecorder}
                          >
                            <IconMic size={18} />
                            Record freely
                          </button>
                        </div>
                      </div>
                    </div>
                  }
                >
                  {(target) => (
                    <FreeformVoiceRecorder
                      target={target}
                      initialDraftTitle={newThreadDraftTitle()}
                      onClose={closeRecorder}
                      onCloseRequestReady={(request) => {
                        requestRecorderClose = request
                      }}
                      onDraftTitleChange={updateNewThreadDraftTitle}
                      onKept={handleFreeformKept}
                      onStartNewThread={openNewRecorder}
                    />
                  )}
                </Show>
              }
            >
              <GuidedVoiceCheck
                initialProtocol={guidedProtocol()}
                returningFromPractice={guidedReturning()}
                onClose={closeGuidedCheck}
                onCloseRequestReady={(request) => {
                  requestGuidedClose = request
                }}
                onKept={handleGuidedKept}
              />
            </Show>
          }
        >
          <div
            class={styles.desk}
            classList={{ [styles.deskDetail]: mobileDetailOpen() }}
          >
            <aside class={styles.threadRail} aria-label="Practice threads">
              <div class={styles.railHeading}>
                <div>
                  <span>Listening desk</span>
                  <strong>{threads().length}</strong>
                </div>
                <p>Choose one recurring practice context.</p>
              </div>
              <button
                ref={guidedLaunchButton}
                type="button"
                class={styles.guidedLaunch}
                onClick={openGuidedCheck}
                disabled={recorderTarget() !== null || guidedOpen()}
              >
                <Sparkles />
                Find my next focus
              </button>
              <button
                ref={recordLaunchButton}
                type="button"
                class={styles.recordLaunch}
                onClick={openNewRecorder}
                disabled={recorderTarget() !== null || guidedOpen()}
              >
                <IconMic size={18} />
                New practice thread
              </button>
              <div class={styles.threadList}>
                <For each={threads()}>
                  {(thread) => (
                    <button
                      type="button"
                      class={styles.threadButton}
                      aria-pressed={selectedKey() === thread.key}
                      classList={{
                        [styles.threadSelected]: selectedKey() === thread.key,
                      }}
                      onClick={() => selectThread(thread.key)}
                    >
                      <span class={styles.threadSource}>
                        {threadSourceLabel(thread.source)}
                      </span>
                      <strong>{thread.title}</strong>
                      <span class={styles.threadMeta}>
                        {thread.takes.length}{' '}
                        {thread.takes.length === 1 ? 'take' : 'takes'}
                        <Show when={thread.comparisonTakes.length >= 2}>
                          <i>Compare</i>
                        </Show>
                      </span>
                    </button>
                  )}
                </For>
              </div>
              <div
                class={styles.railStorageScope}
                aria-label="Local voice storage"
              >
                <div class={styles.railStorageSummary}>
                  <span class={styles.storageDot} aria-hidden="true" />
                  <div>
                    <strong>
                      {storage() === null
                        ? 'Checking storage'
                        : `${storage()!.takeCount} kept · ${formatBytes(storage()!.voiceBytes)}`}
                    </strong>
                    <small>
                      {storage()?.persistent === true
                        ? 'Protected on this device'
                        : 'Audio stays on this device'}
                    </small>
                  </div>
                </div>
                <button type="button" onClick={wipeAll}>
                  Clear entire voice history
                </button>
              </div>
            </aside>

            <div class={styles.workspace}>
              <Show when={recorderTarget() === null && !guidedOpen()}>
                <button
                  type="button"
                  class={styles.mobileBack}
                  onClick={returnToThreadList}
                >
                  <ChevronLeft />
                  Practice threads
                </button>
              </Show>

              <Show
                when={guidedOpen()}
                keyed
                fallback={
                  <Show
                    when={recorderTarget()}
                    keyed
                    fallback={
                      <Show when={selectedThreadWorkspace()} keyed>
                        {(thread) => (
                          <>
                            <div class={styles.workspaceHead}>
                              <Show
                                when={renamingKey() === thread.key}
                                fallback={
                                  <div class={styles.threadIdentity}>
                                    <span>
                                      {threadSourceLabel(thread.source)} thread
                                    </span>
                                    <h2 ref={threadDetailHeading} tabindex="-1">
                                      {thread.title}
                                    </h2>
                                    <p>
                                      {formatDate(thread.takes[0]!.capturedAt)}{' '}
                                      to{' '}
                                      {formatDate(
                                        thread.takes.at(-1)!.capturedAt,
                                      )}
                                      {' · '}
                                      {thread.takes.length}{' '}
                                      {thread.takes.length === 1
                                        ? 'take'
                                        : 'takes'}
                                    </p>
                                  </div>
                                }
                              >
                                <form
                                  class={styles.renameForm}
                                  onSubmit={submitRename}
                                >
                                  <label for="voice-thread-name">
                                    Practice thread name
                                  </label>
                                  <div class={styles.renameRow}>
                                    <input
                                      ref={renameInput}
                                      id="voice-thread-name"
                                      value={renameTitle()}
                                      maxlength={80}
                                      disabled={renameSaving()}
                                      aria-invalid={renameError() !== null}
                                      onInput={(event) => {
                                        setRenameTitle(
                                          event.currentTarget.value,
                                        )
                                        if (
                                          event.currentTarget.value.trim() !==
                                          ''
                                        ) {
                                          setRenameError(null)
                                        }
                                      }}
                                      onKeyDown={(event) => {
                                        if (event.key === 'Escape')
                                          finishRenaming()
                                      }}
                                    />
                                    <button
                                      type="submit"
                                      class={styles.saveRename}
                                      disabled={renameSaving()}
                                    >
                                      {renameSaving() ? 'Saving…' : 'Save name'}
                                    </button>
                                    <button
                                      type="button"
                                      class={styles.cancelRename}
                                      onClick={finishRenaming}
                                      disabled={renameSaving()}
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                  <Show when={renameError()}>
                                    <p class={styles.renameError} role="alert">
                                      {renameError()}
                                    </p>
                                  </Show>
                                </form>
                              </Show>

                              <Show when={renamingKey() !== thread.key}>
                                <div class={styles.workspaceActions}>
                                  <Show when={thread.source === 'freeform'}>
                                    <button
                                      type="button"
                                      class={styles.recordAnother}
                                      onClick={() => openThreadRecorder(thread)}
                                      disabled={recorderTarget() !== null}
                                    >
                                      <IconMic size={16} />
                                      Record another take
                                    </button>
                                  </Show>
                                  <div
                                    class={styles.actionMenuRoot}
                                    data-voice-action-menu
                                  >
                                    <button
                                      ref={threadMenuButton}
                                      type="button"
                                      class={styles.moreButton}
                                      aria-label="Thread actions"
                                      aria-haspopup="menu"
                                      aria-expanded={threadMenuOpen()}
                                      aria-controls="voice-thread-actions-menu"
                                      onClick={() => {
                                        setTakeMenuId(null)
                                        setThreadMenuOpen((open) => !open)
                                      }}
                                    >
                                      <MoreVertical size={18} />
                                    </button>
                                    <Show when={threadMenuOpen()}>
                                      <div
                                        id="voice-thread-actions-menu"
                                        class={styles.actionMenu}
                                        role="menu"
                                        aria-label="Thread actions"
                                      >
                                        <Show
                                          when={thread.source === 'freeform'}
                                        >
                                          <button
                                            type="button"
                                            role="menuitem"
                                            onClick={() => {
                                              setThreadMenuOpen(false)
                                              startRenaming(thread)
                                            }}
                                          >
                                            Rename thread
                                          </button>
                                        </Show>
                                        <button
                                          type="button"
                                          role="menuitem"
                                          class={styles.destructiveMenuItem}
                                          onClick={() => {
                                            setThreadMenuOpen(false)
                                            removeThread(thread)
                                          }}
                                        >
                                          Delete this thread
                                        </button>
                                      </div>
                                    </Show>
                                  </div>
                                </div>
                              </Show>
                            </div>

                            <Show when={selectedGuidedFocus()} keyed>
                              {(focus) => {
                                const copy = savedFocusCopy(focus)
                                const evidenceMoments =
                                  savedFocusEvidenceMoments(focus)
                                return (
                                  <section
                                    ref={guidedFocusCard}
                                    class={styles.savedFocus}
                                    aria-labelledby="saved-guided-focus-title"
                                    data-testid="saved-guided-focus"
                                    tabIndex={-1}
                                  >
                                    <div class={styles.savedFocusReading}>
                                      <div class={styles.savedFocusLabel}>
                                        <span>Saved Focus reading</span>
                                        <InfoPopover
                                          label="About this saved Focus reading"
                                          class={styles.savedFocusInfo}
                                          panelClass={
                                            styles.savedFocusInfoPanel
                                          }
                                        >
                                          <dl
                                            class={styles.savedFocusExplanation}
                                          >
                                            <div>
                                              <dt>What it means</dt>
                                              <dd>
                                                A reading of the three-note
                                                Pitch Centre task, not a general
                                                rating of your voice.
                                              </dd>
                                            </div>
                                            <div>
                                              <dt>How it is measured</dt>
                                              <dd>
                                                Each landing must hold confident
                                                detected pitch within 35 cents
                                                of its target for 300 ms. The
                                                centred pathway also requires
                                                all three landings and a typical
                                                settled error within 25 cents.
                                              </dd>
                                            </div>
                                            <div>
                                              <dt>Keep in mind</dt>
                                              <dd>
                                                This describes one fitted task
                                                in this recording. It cannot
                                                assess technique or vocal
                                                health.
                                              </dd>
                                            </div>
                                          </dl>
                                        </InfoPopover>
                                      </div>
                                      <h3 id="saved-guided-focus-title">
                                        {copy.title}
                                      </h3>
                                      <p>{copy.detail}</p>
                                      <small>
                                        What held: the guided landings carried
                                        enough clear pitch for a direct reading.
                                      </small>
                                      <div
                                        class={styles.savedFocusEvidence}
                                        aria-label="Saved Focus evidence"
                                      >
                                        <For each={evidenceMoments}>
                                          {(moment) => (
                                            <button
                                              type="button"
                                              data-voice-playback-seek
                                              aria-label={`Saved ${moment.label} at ${moment.seconds.toFixed(1)} seconds. ${moment.measurement}. Seek without playing.`}
                                              onClick={() =>
                                                seekTake(
                                                  focus.take,
                                                  moment.seconds /
                                                    Math.max(
                                                      0.001,
                                                      focus.take.durationMs /
                                                        1000,
                                                    ),
                                                )
                                              }
                                            >
                                              <span>{moment.label}</span>
                                              <strong>
                                                {moment.measurement}
                                              </strong>
                                              <time>
                                                {moment.seconds.toFixed(1)}s
                                              </time>
                                            </button>
                                          )}
                                        </For>
                                      </div>
                                    </div>
                                    <div class={styles.savedFocusRoute}>
                                      <div>
                                        <span>Matched next step</span>
                                        <strong>
                                          Pitch Hold · {focus.targetNote}
                                        </strong>
                                        <p>
                                          Continue with the fitted note, or
                                          repeat the exact same three-note
                                          check.
                                        </p>
                                      </div>
                                      <div class={styles.savedFocusActions}>
                                        <button
                                          ref={guidedCheckAgainButton}
                                          type="button"
                                          class={styles.savedFocusPrimary}
                                          onClick={() =>
                                            openSavedGuidedRetake(focus)
                                          }
                                        >
                                          <Sparkles />
                                          Check again
                                        </button>
                                        <button
                                          type="button"
                                          class={styles.savedFocusSecondary}
                                          onClick={() =>
                                            startSavedGuidedPractice(focus)
                                          }
                                        >
                                          Practise Pitch Hold
                                        </button>
                                      </div>
                                    </div>
                                  </section>
                                )
                              }}
                            </Show>

                            <div
                              class={styles.viewSwitcher}
                              role="group"
                              aria-label="Listening desk view"
                            >
                              <button
                                type="button"
                                aria-pressed={activeView() === 'compare'}
                                onClick={() => changeActiveView('compare')}
                              >
                                Compare
                              </button>
                              <Show when={thread.comparisonTakes.length >= 3}>
                                <button
                                  type="button"
                                  aria-pressed={activeView() === 'pattern'}
                                  onClick={() => changeActiveView('pattern')}
                                >
                                  Pattern
                                </button>
                              </Show>
                              <button
                                type="button"
                                aria-pressed={activeView() === 'takes'}
                                onClick={() => changeActiveView('takes')}
                              >
                                All takes
                                <span>{thread.takes.length}</span>
                              </button>
                            </div>

                            <div class={styles.viewContent}>
                              <Show when={activeView() === 'compare'}>
                                <VoiceAtlasPanel
                                  loading={contoursLoading()}
                                  model={atlasModel()}
                                  earlier={earlier()}
                                  later={atlasLater()}
                                  earlierContour={earlierContour()}
                                  laterContour={laterContour()}
                                  selectedId={atlasSelectedId()}
                                  activeId={activeId()}
                                  progress={progress()}
                                  playing={playing()}
                                  earlierReflections={parseVoiceReflections(
                                    earlier()?.reflectionsJson,
                                    earlier()?.reflectionsVersion,
                                  )}
                                  laterReflections={parseVoiceReflections(
                                    atlasLater()?.reflectionsJson,
                                    atlasLater()?.reflectionsVersion,
                                  )}
                                  totalTakeCount={thread.comparisonTakes.length}
                                  pairPreset={comparisonPairPreset()}
                                  roomPanel={
                                    <VoiceRoomPanel
                                      settings={roomSettings()}
                                      onChange={setRoomSettings}
                                    />
                                  }
                                  onChoosePairPreset={chooseComparisonPair}
                                  earlierSelector={
                                    thread.comparisonTakes.length <
                                    2 ? undefined : (
                                      <label>
                                        Earlier take
                                        <select
                                          value={earlierId() ?? ''}
                                          onChange={(event) =>
                                            chooseEarlier(
                                              event.currentTarget.value,
                                            )
                                          }
                                        >
                                          <For each={thread.comparisonTakes}>
                                            {(take, index) => (
                                              <option
                                                value={take.id}
                                                disabled={
                                                  index() >=
                                                  thread.comparisonTakes.findIndex(
                                                    (candidate) =>
                                                      candidate.id ===
                                                      laterId(),
                                                  )
                                                }
                                              >
                                                {formatDate(take.capturedAt)} ·
                                                Take{' '}
                                                {thread.takes.indexOf(take) + 1}
                                              </option>
                                            )}
                                          </For>
                                        </select>
                                      </label>
                                    )
                                  }
                                  laterSelector={
                                    thread.comparisonTakes.length <
                                    2 ? undefined : (
                                      <label>
                                        Later take
                                        <select
                                          value={laterId() ?? ''}
                                          onChange={(event) =>
                                            chooseLater(
                                              event.currentTarget.value,
                                            )
                                          }
                                        >
                                          <For each={thread.comparisonTakes}>
                                            {(take, index) => (
                                              <option
                                                value={take.id}
                                                disabled={
                                                  index() <=
                                                  thread.comparisonTakes.findIndex(
                                                    (candidate) =>
                                                      candidate.id ===
                                                      earlierId(),
                                                  )
                                                }
                                              >
                                                {formatDate(take.capturedAt)} ·
                                                Take{' '}
                                                {thread.takes.indexOf(take) + 1}
                                              </option>
                                            )}
                                          </For>
                                        </select>
                                      </label>
                                    )
                                  }
                                  onPlay={(takeId) => {
                                    const take = thread.takes.find(
                                      (candidate) => candidate.id === takeId,
                                    )
                                    if (take !== undefined) {
                                      playTake(
                                        take,
                                        thread.comparisonTakes.length >= 2,
                                      )
                                    }
                                  }}
                                  onSeek={(takeId, nextProgress) => {
                                    const take = thread.takes.find(
                                      (candidate) => candidate.id === takeId,
                                    )
                                    if (take !== undefined) {
                                      selectAtlasTake(takeId)
                                      seekTake(
                                        take,
                                        nextProgress,
                                        thread.comparisonTakes.length >= 2,
                                      )
                                    }
                                  }}
                                  onSelect={selectAtlasTake}
                                  onAddReflection={addReflection}
                                  onRemoveReflection={removeReflection}
                                />
                              </Show>

                              <Show when={activeView() === 'pattern'}>
                                <PracticeLoomPanel
                                  loading={contoursLoading()}
                                  model={loomModel()}
                                  takes={thread.comparisonTakes}
                                  activeId={activeId()}
                                  earlierId={earlierId()}
                                  laterId={laterId()}
                                  progress={progress()}
                                  playing={playing()}
                                  onSelect={selectLoomTake}
                                  onPlay={(takeId) => {
                                    const take = thread.takes.find(
                                      (candidate) => candidate.id === takeId,
                                    )
                                    if (take !== undefined) playTake(take, true)
                                  }}
                                  onSeek={(takeId, nextProgress) => {
                                    const take = thread.takes.find(
                                      (candidate) => candidate.id === takeId,
                                    )
                                    if (take !== undefined) {
                                      seekTake(take, nextProgress, true)
                                    }
                                  }}
                                />
                              </Show>

                              <Show when={activeView() === 'takes'}>
                                <section
                                  class={styles.allTakes}
                                  aria-labelledby="all-voice-takes-title"
                                >
                                  <div class={styles.allTakesHeading}>
                                    <div>
                                      <h3 id="all-voice-takes-title">
                                        All takes
                                      </h3>
                                      <p>
                                        Replay, export, favourite, or remove a
                                        saved take.
                                      </p>
                                    </div>
                                    <span>
                                      {thread.takes.length}{' '}
                                      {thread.takes.length === 1
                                        ? 'recording'
                                        : 'recordings'}
                                    </span>
                                  </div>
                                  <Show when={allTakesSelected()} keyed>
                                    {(take) => (
                                      <div class={styles.sharedTransport}>
                                        <VoicePlaybackTransport
                                          take={take}
                                          activeId={activeId()}
                                          progress={progress()}
                                          playing={playing()}
                                          eyebrow={`Selected · Take ${thread.takes.indexOf(take) + 1} · ${formatDate(take.capturedAt)} · ${formatBytes(take.sizeBytes)}`}
                                          tone="neutral"
                                          onPlay={() => playTake(take)}
                                          onSeek={(_takeId, nextProgress) =>
                                            seekTake(take, nextProgress)
                                          }
                                        />
                                      </div>
                                    )}
                                  </Show>
                                  <div class={styles.allTakesList}>
                                    <For each={[...thread.takes].reverse()}>
                                      {(take) => (
                                        <article
                                          class={styles.takeEntry}
                                          classList={{
                                            [styles.takeSelected]:
                                              allTakesSelectedId() === take.id,
                                            [styles.takePlaying]:
                                              activeId() === take.id &&
                                              playing(),
                                          }}
                                        >
                                          <button
                                            type="button"
                                            class={styles.takeSelect}
                                            aria-pressed={
                                              allTakesSelectedId() === take.id
                                            }
                                            onClick={() =>
                                              selectAllTake(take.id)
                                            }
                                          >
                                            <span
                                              class={styles.takeFavorite}
                                              classList={{
                                                [styles.takeFavoriteOn]:
                                                  take.favorite,
                                              }}
                                              aria-hidden="true"
                                            />
                                            <span class={styles.takeCopy}>
                                              <span>
                                                {formatDate(take.capturedAt)} ·
                                                Take{' '}
                                                {thread.takes.indexOf(take) + 1}
                                              </span>
                                              <strong>{take.title}</strong>
                                              <small>
                                                {formatDuration(
                                                  take.durationMs,
                                                )}{' '}
                                                · {formatBytes(take.sizeBytes)}
                                              </small>
                                            </span>
                                          </button>
                                          <div
                                            class={styles.takeActionMenu}
                                            data-voice-action-menu
                                          >
                                            <button
                                              type="button"
                                              class={styles.moreButton}
                                              aria-label={`Actions for ${take.title}`}
                                              aria-haspopup="menu"
                                              aria-expanded={
                                                takeMenuId() === take.id
                                              }
                                              aria-controls={`voice-take-actions-${take.id}`}
                                              onClick={() => {
                                                setThreadMenuOpen(false)
                                                setTakeMenuId((current) =>
                                                  current === take.id
                                                    ? null
                                                    : take.id,
                                                )
                                              }}
                                            >
                                              <MoreVertical size={18} />
                                            </button>
                                            <Show
                                              when={takeMenuId() === take.id}
                                            >
                                              <div
                                                id={`voice-take-actions-${take.id}`}
                                                class={`${styles.actionMenu} ${styles.takeMenu}`}
                                                role="menu"
                                                aria-label={`Actions for ${take.title}`}
                                              >
                                                <button
                                                  type="button"
                                                  role="menuitem"
                                                  onClick={() => {
                                                    setTakeMenuId(null)
                                                    toggleFavorite(take)
                                                  }}
                                                >
                                                  {take.favorite
                                                    ? 'Remove favorite'
                                                    : 'Mark favorite'}
                                                </button>
                                                <button
                                                  type="button"
                                                  role="menuitem"
                                                  disabled={
                                                    exportingTakeId() !== null
                                                  }
                                                  aria-busy={
                                                    exportingTakeId() ===
                                                    take.id
                                                  }
                                                  onClick={() => {
                                                    const ordinal =
                                                      thread.takes.indexOf(
                                                        take,
                                                      ) + 1
                                                    void exportTake(
                                                      take,
                                                      thread.title,
                                                      ordinal,
                                                    )
                                                  }}
                                                >
                                                  {exportingTakeId() === take.id
                                                    ? 'Preparing…'
                                                    : 'Export'}
                                                </button>
                                                <button
                                                  type="button"
                                                  role="menuitem"
                                                  class={
                                                    styles.destructiveMenuItem
                                                  }
                                                  onClick={() => {
                                                    setTakeMenuId(null)
                                                    removeTake(take)
                                                  }}
                                                >
                                                  Delete
                                                </button>
                                              </div>
                                            </Show>
                                          </div>
                                        </article>
                                      )}
                                    </For>
                                  </div>
                                </section>
                              </Show>
                            </div>
                          </>
                        )}
                      </Show>
                    }
                  >
                    {(target) => (
                      <FreeformVoiceRecorder
                        target={target}
                        initialDraftTitle={newThreadDraftTitle()}
                        onClose={closeRecorder}
                        onCloseRequestReady={(request) => {
                          requestRecorderClose = request
                        }}
                        onDraftTitleChange={updateNewThreadDraftTitle}
                        onKept={handleFreeformKept}
                        onStartNewThread={openNewRecorder}
                      />
                    )}
                  </Show>
                }
              >
                <GuidedVoiceCheck
                  initialProtocol={guidedProtocol()}
                  returningFromPractice={guidedReturning()}
                  onClose={closeGuidedCheck}
                  onCloseRequestReady={(request) => {
                    requestGuidedClose = request
                  }}
                  onKept={handleGuidedKept}
                />
              </Show>
            </div>
          </div>
        </Show>
      </Show>
      <ConfirmDialog
        open={deleteIntent() !== null}
        title={
          deleteIntent()?.kind === 'all'
            ? 'Clear all voice history?'
            : deleteIntent()?.kind === 'thread'
              ? 'Delete this practice thread?'
              : 'Delete this take?'
        }
        message={deleteDialogMessage()}
        confirmLabel={
          deleteBusy()
            ? 'Deleting…'
            : deleteIntent()?.kind === 'all'
              ? 'Clear history'
              : deleteIntent()?.kind === 'thread'
                ? 'Delete thread'
                : 'Delete take'
        }
        confirmPhrase={
          deleteIntent()?.kind === 'all' || deleteIntent()?.kind === 'thread'
            ? 'delete'
            : undefined
        }
        busy={deleteBusy()}
        onConfirm={confirmDelete}
        onCancel={() => {
          setDeleteError(null)
          setDeleteIntent(null)
        }}
      />
    </section>
  )
}
