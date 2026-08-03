// ============================================================
// Voice History — local listening desk for kept voice takes
// ============================================================

/*
THESIS: Voice history is a listening desk organised by recurring practice
threads, never a generic voice-memo grid.
OWN-WORLD: MercuryPitch's dark Pitch Studio surfaces, ruled waveform fields,
quiet blue-violet accents, and compact native controls.
STORY: The singer enters a practice thread, sees its Take Topography become
Twin Trails, listens on one shared clock, and leaves subjective reflections.
FIRST VIEWPORT: A narrow thread rail sits beside Voice Atlas as the central
field; privacy and storage status stay in the header, with listening room
controls following the map instead of displacing it.
FORM: Context-first practice threads, the third grounded structure selected by
surface seed 828675af, extended through spectral cartography without replacing
the established Pitch Studio shell.
*/

import type { Component, JSX } from 'solid-js'
import { createEffect, createMemo, createSignal, For, onCleanup, onMount, Show, untrack, } from 'solid-js'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { IconMic } from '@/components/exercise-icons'
import { Pencil } from '@/components/icons'
import { VoiceTakeWaveform } from '@/components/VoiceTakeWaveform'
import type { VoiceTakeRecord } from '@/db/entities'
import type { VoiceStorageSnapshot } from '@/db/services/voice-take-service'
import { deleteVoiceTake, deleteVoiceThread, getVoiceStorageSnapshot, getVoiceTakeBlob, getVoiceTakeContour, listVoiceTakes, renameFreeformVoiceThread, updateVoiceTake, updateVoiceTakeReflections, wipeVoiceTakes, } from '@/db/services/voice-take-service'
import { trackEvent } from '@/lib/analytics'
import { installAudioUnlock, unlockAudio } from '@/lib/audio-unlock'
import { createMediaProgressLoop, isMediaPlaybackActive, mediaProgressFromPointer, } from '@/lib/media-progress-loop'
import type { DecodedVoiceAtlasContour } from '@/lib/voice-contour'
import type { FxRack, FxSettings } from '@/lib/voice-fx-rack'
import { createFxRack, FX_PRESETS } from '@/lib/voice-fx-rack'
import type { FreeformThreadTarget } from './freeform-voice-take'
import { createFreeformThreadTarget } from './freeform-voice-take'
import { FreeformVoiceRecorder } from './FreeformVoiceRecorder'
import { bindListeningRoomSettings } from './listening-room-settings'
import { PracticeLoomPanel } from './PracticeLoomPanel'
import { buildPracticeLoomRenderModel, buildVoiceAtlasRenderModel, } from './voice-atlas-model'
import type { VoiceReflection, VoiceReflectionKind } from './voice-reflections'
import { createVoiceReflection, parseVoiceReflections, } from './voice-reflections'
import { VoiceAtlasPanel } from './VoiceAtlasPanel'
import styles from './VoiceHistoryPage.module.css'
import { VoiceRoomPanel } from './VoiceRoomPanel'

interface VoiceThread {
  key: string
  title: string
  source: VoiceTakeRecord['source']
  takes: VoiceTakeRecord[]
}

type DeleteIntent =
  | { kind: 'take'; take: VoiceTakeRecord }
  | { kind: 'thread'; thread: VoiceThread }
  | { kind: 'all'; count: number }

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

const Waveform: Component<{
  take: VoiceTakeRecord
  active: boolean
  progress?: number
  playing?: boolean
  onSeek: (progress: number) => void
}> = (props) => {
  const currentProgress = (): number =>
    props.active ? (props.progress ?? 0) : 0
  const seekFromPointer = (event: PointerEvent): void => {
    const surface = event.currentTarget as HTMLDivElement
    const bounds = surface.getBoundingClientRect()
    props.onSeek(
      mediaProgressFromPointer(event.clientX, bounds.left, bounds.width),
    )
  }

  return (
    <div
      class={styles.waveform}
      classList={{ [styles.waveformActive]: props.active }}
      role="slider"
      tabindex="0"
      aria-label={`Seek ${props.take.title}`}
      aria-valuemin="0"
      aria-valuemax="100"
      aria-valuenow={Math.round(currentProgress() * 100)}
      aria-valuetext={`${Math.round(currentProgress() * 100)} percent`}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId)
        seekFromPointer(event)
      }}
      onPointerMove={(event) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          seekFromPointer(event)
        }
      }}
      onPointerUp={(event) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId)
        }
      }}
      onKeyDown={(event) => {
        const step = 0.05
        const current = currentProgress()
        const next =
          event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? 1
              : event.key === 'ArrowLeft' || event.key === 'ArrowDown'
                ? current - step
                : event.key === 'ArrowRight' || event.key === 'ArrowUp'
                  ? current + step
                  : null
        if (next === null) return
        event.preventDefault()
        props.onSeek(Math.max(0, Math.min(1, next)))
      }}
    >
      <VoiceTakeWaveform
        class={styles.waveformCanvas}
        peaks={props.take.peaks}
        progress={currentProgress()}
        playing={props.active && props.playing === true}
        showPlayhead={props.active}
      />
      <span class={styles.waveformHint} aria-hidden="true">
        Drag to seek
      </span>
    </div>
  )
}

export function VoiceHistoryPage(): JSX.Element {
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
  const [recorderTarget, setRecorderTarget] =
    createSignal<FreeformThreadTarget | null>(null)
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

  let audio: HTMLAudioElement | null = null
  let audioUrl: string | null = null
  let listeningContext: AudioContext | null = null
  let listeningSource: MediaElementAudioSourceNode | null = null
  let listeningRack: FxRack | null = null
  let uninstallAudioUnlock = (): void => undefined
  let recordLaunchButton: HTMLButtonElement | undefined
  let recorderReturnFocus: HTMLElement | null = null
  let renameInput: HTMLInputElement | undefined
  let renameButton: HTMLButtonElement | undefined
  let comparisonStarted = false
  let comparisonPendingComplete = false
  let contourLoadGeneration = 0
  let playbackTakeId: string | null = null
  let playbackIsCurrent = (): boolean => false
  const playbackRequests = createPlaybackRequestGate()
  const reflectionMutations = createTakeMutationQueue()
  const playbackProgress = createMediaProgressLoop(setProgress)

  const threads = createMemo<VoiceThread[]>(() => {
    const grouped = new Map<string, VoiceTakeRecord[]>()
    for (const take of takes()) {
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
        }
      })
      .sort((left, right) => {
        const comparisonDelta =
          Number(right.takes.length >= 2) - Number(left.takes.length >= 2)
        if (comparisonDelta !== 0) return comparisonDelta
        return (
          new Date(right.takes.at(-1)!.capturedAt).getTime() -
          new Date(left.takes.at(-1)!.capturedAt).getTime()
        )
      })
  })

  const selectedThread = createMemo(
    () => threads().find((thread) => thread.key === selectedKey()) ?? null,
  )
  const earlier = createMemo(
    () =>
      selectedThread()?.takes.find((take) => take.id === earlierId()) ?? null,
  )
  const later = createMemo(
    () => selectedThread()?.takes.find((take) => take.id === laterId()) ?? null,
  )
  const atlasLater = createMemo(() =>
    (selectedThread()?.takes.length ?? 0) >= 2 ? later() : null,
  )
  const comparisonPairPreset = createMemo<'full-span' | 'latest' | 'custom'>(
    () => {
      const thread = selectedThread()
      if (thread === null || thread.takes.length < 2) return 'full-span'
      const firstId = thread.takes[0]?.id
      const penultimateId = thread.takes.at(-2)?.id
      const lastId = thread.takes.at(-1)?.id
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
      thread !== null && thread.takes.length >= 3
        ? thread.takes.map((take) => take.id)
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
  const loomModel = createMemo(() => {
    const thread = selectedThread()
    const loadedContours = contours()
    return buildPracticeLoomRenderModel(
      (thread?.takes ?? []).map((take) => ({
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

  function disposeAudio(): void {
    playbackRequests.cancel()
    playbackIsCurrent = () => false
    playbackProgress.stop()
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
        setSelectedKey(loaded[0]?.comparisonKey ?? null)
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
    if (thread === null || thread.takes.length === 0) {
      setEarlierId(null)
      setLaterId(null)
      return
    }
    const currentEarlierIndex = thread.takes.findIndex(
      (take) => take.id === earlierId(),
    )
    const currentLaterIndex = thread.takes.findIndex(
      (take) => take.id === laterId(),
    )
    if (
      currentEarlierIndex >= 0 &&
      (thread.takes.length === 1
        ? currentLaterIndex === currentEarlierIndex
        : currentLaterIndex > currentEarlierIndex)
    ) {
      return
    }
    setEarlierId(thread.takes[0]!.id)
    setLaterId(thread.takes.at(-1)!.id)
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
    window.addEventListener('keydown', pausePlaybackWithSpace, true)
    void refresh()
  })
  onCleanup(() => {
    window.removeEventListener('keydown', pausePlaybackWithSpace, true)
    uninstallAudioUnlock()
    disposeAudio()
    disposeListeningContext()
  })

  // The helper establishes its own createEffect and reads this accessor there.
  // eslint-disable-next-line solid/reactivity
  bindListeningRoomSettings(roomSettings, () => listeningRack)

  function playTake(take: VoiceTakeRecord, fromComparison = false): void {
    unlockAudio(ensureListeningContext())
    const isCurrentTake = activeId() === take.id
    void playTakeAsync(take, fromComparison, isCurrentTake)
  }

  function pausePlaybackWithSpace(event: KeyboardEvent): void {
    if (event.code !== 'Space' || event.repeat || !playing()) return
    const target = event.target
    if (
      target instanceof Element &&
      target.closest('input, textarea, select, [contenteditable]') !== null
    ) {
      return
    }
    if (audio === null) return
    event.preventDefault()
    event.stopPropagation()
    playbackProgress.sample(audio)
    playbackProgress.stop()
    audio.pause()
    setPlaying(false)
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
    if (activeId() === take.id && audio !== null) {
      applyPlaybackSeek(audio, take, nextProgress)
      if (playing()) playbackProgress.start(audio)
      return
    }
    void playTakeAsync(take, fromComparison, false, nextProgress)
  }

  async function playTakeAsync(
    take: VoiceTakeRecord,
    fromComparison: boolean,
    isCurrentTake: boolean,
    requestedProgress?: number,
  ): Promise<void> {
    const takeId = take.id
    if (fromComparison && !comparisonStarted) {
      comparisonStarted = true
      comparisonPendingComplete = true
      trackEvent('voice_compare_start')
    }
    if (isCurrentTake && audio !== null) {
      const currentAudio = audio
      const requestIsCurrent = playbackIsCurrent
      if (currentAudio.paused) {
        try {
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
    const nextAudioUrl = URL.createObjectURL(blob)
    const nextAudio = new Audio(nextAudioUrl)
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
      playbackProgress.stop()
      setPlaying(false)
      setProgress(1)
      if (comparisonPendingComplete) {
        comparisonPendingComplete = false
        trackEvent('voice_compare_complete')
      }
    })
    nextAudio.addEventListener('error', () => {
      if (!requestIsCurrent() || audio !== nextAudio) return
      playbackProgress.stop()
      setPlaying(false)
      setPlayerError(
        'This browser could not decode the recording. Export it to keep the original file.',
      )
    })
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

  async function exportTake(take: VoiceTakeRecord): Promise<void> {
    let blob: Blob | null
    try {
      blob = await getVoiceTakeBlob(take.id)
    } catch {
      setPlayerError(
        'This take could not be opened from local storage and cannot be exported right now.',
      )
      return
    }
    if (blob === null) {
      setPlayerError('This take’s audio is missing and cannot be exported.')
      return
    }
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    const extension = take.mimeType.includes('mp4') ? 'm4a' : 'webm'
    anchor.href = url
    anchor.download = `${
      take.title
        .replace(/[^a-z0-9]+/gi, '-')
        .replace(/^-|-$/g, '')
        .toLowerCase() || 'voice-take'
    }-${take.capturedAt.slice(0, 10)}.${extension}`
    anchor.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    trackEvent('voice_export')
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
    const candidateIndex = thread.takes.findIndex((take) => take.id === id)
    const laterIndex = thread.takes.findIndex((take) => take.id === laterId())
    if (candidateIndex >= 0 && candidateIndex < laterIndex) {
      disposeAudio()
      setEarlierId(id)
      setAtlasSelectedId(id)
    }
  }

  function chooseLater(id: string): void {
    const thread = selectedThread()
    if (thread === null) return
    const earlierIndex = thread.takes.findIndex(
      (take) => take.id === earlierId(),
    )
    const candidateIndex = thread.takes.findIndex((take) => take.id === id)
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

  function chooseComparisonPair(preset: 'full-span' | 'latest'): void {
    const thread = selectedThread()
    if (thread === null || thread.takes.length < 2) return
    const nextEarlier =
      preset === 'latest' ? thread.takes.at(-2) : thread.takes[0]
    const nextLater = thread.takes.at(-1)
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
    recorderReturnFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null
    setRecorderTarget(createFreeformThreadTarget())
  }

  function openThreadRecorder(thread: VoiceThread): void {
    disposeAudio()
    recorderReturnFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null
    setRecorderTarget({
      comparisonKey: thread.key,
      title: thread.title,
    })
  }

  function closeRecorder(): void {
    const previous = recorderReturnFocus
    recorderReturnFocus = null
    setRecorderTarget(null)
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
    closeRecorder()
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
    queueMicrotask(() => renameButton?.focus())
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
            Keep meaningful takes on this device. Compare the same practice
            context over time.
          </p>
        </div>
        <div class={styles.headerActions}>
          <button
            ref={recordLaunchButton}
            type="button"
            class={styles.recordLaunch}
            onClick={openNewRecorder}
            disabled={recorderTarget() !== null}
          >
            <IconMic size={18} />
            New practice thread
          </button>
          <div class={styles.storageBadge} aria-label="Local voice storage">
            <span class={styles.storageDot} aria-hidden="true" />
            <strong>
              {storage() === null
                ? 'Checking local storage'
                : `${storage()!.takeCount} kept · ${formatBytes(storage()!.voiceBytes)}`}
            </strong>
            <span>
              {storage()?.persistent === true
                ? 'Protected from automatic cleanup'
                : 'On this device'}
            </span>
          </div>
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

      <Show when={recorderTarget()} keyed>
        {(target) => (
          <FreeformVoiceRecorder
            target={target}
            onClose={closeRecorder}
            onKept={handleFreeformKept}
            onStartNewThread={openNewRecorder}
          />
        )}
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
            <div class={styles.empty}>
              <div class={styles.emptyPulse} aria-hidden="true">
                <span />
              </div>
              <div>
                <h2>Your first thread starts with one kept take.</h2>
                <p>
                  Name something you want to repeat and record it here, or keep
                  a useful replay from Glass, an Exercise, or a Weekly Legend
                  result. A second matching take unlocks Earlier/Later.
                </p>
                <div class={styles.emptyActions}>
                  <button
                    type="button"
                    class={styles.primaryAction}
                    onClick={openNewRecorder}
                  >
                    <IconMic size={18} />
                    Record here
                  </button>
                  <a class={styles.secondaryAction} href="/glass">
                    Try Glass instead
                  </a>
                </div>
              </div>
            </div>
          }
        >
          <div class={styles.desk}>
            <aside class={styles.threadRail} aria-label="Practice threads">
              <div class={styles.railHeading}>
                <div>
                  <span>Practice threads</span>
                  <strong>{threads().length}</strong>
                </div>
                <p>Same context, kept over time.</p>
              </div>
              <For each={threads()}>
                {(thread) => (
                  <button
                    type="button"
                    class={styles.threadButton}
                    aria-pressed={selectedKey() === thread.key}
                    classList={{
                      [styles.threadSelected]: selectedKey() === thread.key,
                    }}
                    onClick={() => {
                      disposeAudio()
                      setRenamingKey(null)
                      setRenameError(null)
                      comparisonStarted = false
                      comparisonPendingComplete = false
                      setAtlasSelectedId(null)
                      setSelectedKey(thread.key)
                    }}
                  >
                    <span class={styles.threadSource}>{thread.source}</span>
                    <strong>{thread.title}</strong>
                    <span class={styles.threadMeta}>
                      {thread.takes.length}{' '}
                      {thread.takes.length === 1 ? 'take' : 'takes'}
                      <Show when={thread.takes.length >= 2}>
                        <i>Ready to compare</i>
                      </Show>
                    </span>
                  </button>
                )}
              </For>
            </aside>

            <div class={styles.workspace}>
              <Show when={selectedThread()} keyed>
                {(thread) => (
                  <>
                    <div class={styles.workspaceHead}>
                      <Show
                        when={renamingKey() === thread.key}
                        fallback={
                          <div>
                            <span>{thread.source} thread</span>
                            <h2>{thread.title}</h2>
                            <p>
                              {formatDate(thread.takes[0]!.capturedAt)} to{' '}
                              {formatDate(thread.takes.at(-1)!.capturedAt)}
                            </p>
                          </div>
                        }
                      >
                        <form class={styles.renameForm} onSubmit={submitRename}>
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
                                setRenameTitle(event.currentTarget.value)
                                if (event.currentTarget.value.trim() !== '') {
                                  setRenameError(null)
                                }
                              }}
                              onKeyDown={(event) => {
                                if (event.key === 'Escape') finishRenaming()
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
                              ref={renameButton}
                              type="button"
                              class={styles.renameThread}
                              onClick={() => startRenaming(thread)}
                              disabled={recorderTarget() !== null}
                            >
                              <Pencil size={14} />
                              Rename
                            </button>
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
                          <span class={styles.localSeal}>
                            Audio stays local
                          </span>
                        </div>
                      </Show>
                    </div>

                    <VoiceAtlasPanel
                      loading={contoursLoading()}
                      model={atlasModel()}
                      earlier={earlier()}
                      later={atlasLater()}
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
                      totalTakeCount={thread.takes.length}
                      pairPreset={comparisonPairPreset()}
                      onChoosePairPreset={chooseComparisonPair}
                      earlierSelector={
                        thread.takes.length < 2 ? undefined : (
                          <label>
                            Earlier take
                            <select
                              value={earlierId() ?? ''}
                              onChange={(event) =>
                                chooseEarlier(event.currentTarget.value)
                              }
                            >
                              <For each={thread.takes}>
                                {(take, index) => (
                                  <option
                                    value={take.id}
                                    disabled={
                                      index() >=
                                      thread.takes.findIndex(
                                        (candidate) =>
                                          candidate.id === laterId(),
                                      )
                                    }
                                  >
                                    {formatDate(take.capturedAt)} · Take{' '}
                                    {thread.takes.indexOf(take) + 1}
                                  </option>
                                )}
                              </For>
                            </select>
                          </label>
                        )
                      }
                      laterSelector={
                        thread.takes.length < 2 ? undefined : (
                          <label>
                            Later take
                            <select
                              value={laterId() ?? ''}
                              onChange={(event) =>
                                chooseLater(event.currentTarget.value)
                              }
                            >
                              <For each={thread.takes}>
                                {(take, index) => (
                                  <option
                                    value={take.id}
                                    disabled={
                                      index() <=
                                      thread.takes.findIndex(
                                        (candidate) =>
                                          candidate.id === earlierId(),
                                      )
                                    }
                                  >
                                    {formatDate(take.capturedAt)} · Take{' '}
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
                          void playTake(take, thread.takes.length >= 2)
                        }
                      }}
                      onSeek={(takeId, nextProgress) => {
                        const take = thread.takes.find(
                          (candidate) => candidate.id === takeId,
                        )
                        if (take !== undefined) {
                          selectAtlasTake(takeId)
                          seekTake(take, nextProgress, thread.takes.length >= 2)
                        }
                      }}
                      onSelect={selectAtlasTake}
                      onAddReflection={addReflection}
                      onRemoveReflection={removeReflection}
                    />

                    <Show when={thread.takes.length >= 3}>
                      <PracticeLoomPanel
                        loading={contoursLoading()}
                        model={loomModel()}
                        takes={thread.takes}
                        activeId={activeId()}
                        earlierId={earlierId()}
                        laterId={laterId()}
                        progress={progress()}
                        playing={playing()}
                        onPlay={(takeId) => {
                          const take = thread.takes.find(
                            (candidate) => candidate.id === takeId,
                          )
                          if (take !== undefined) {
                            playTake(take, true)
                          }
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

                    <VoiceRoomPanel
                      settings={roomSettings()}
                      onChange={setRoomSettings}
                    />

                    <section class={styles.timeline}>
                      <div class={styles.timelineHeading}>
                        <div>
                          <span>Thread history</span>
                          <h3>Every kept take</h3>
                        </div>
                        <div class={styles.historyDangerActions}>
                          <button
                            type="button"
                            class={styles.dangerLink}
                            onClick={() => removeThread(thread)}
                          >
                            Delete this thread
                          </button>
                          <button
                            type="button"
                            class={styles.dangerLink}
                            onClick={wipeAll}
                          >
                            Clear entire voice history
                          </button>
                        </div>
                      </div>
                      <For each={[...thread.takes].reverse()}>
                        {(take) => (
                          <article class={styles.takeRow}>
                            <button
                              type="button"
                              class={styles.favorite}
                              classList={{ [styles.favoriteOn]: take.favorite }}
                              onClick={() => toggleFavorite(take)}
                              aria-label={
                                take.favorite
                                  ? 'Remove favorite'
                                  : 'Mark favorite'
                              }
                              title={
                                take.favorite
                                  ? 'Remove favorite'
                                  : 'Mark favorite'
                              }
                            >
                              <svg viewBox="0 0 24 24" aria-hidden="true">
                                <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z" />
                              </svg>
                            </button>
                            <button
                              type="button"
                              class={styles.takeMain}
                              onClick={() => void playTake(take)}
                            >
                              <span class={styles.takeDate}>
                                {formatDate(take.capturedAt)}
                              </span>
                              <strong>{take.title}</strong>
                              <span>
                                {formatDuration(take.durationMs)} ·{' '}
                                {formatBytes(take.sizeBytes)}
                              </span>
                            </button>
                            <Waveform
                              take={take}
                              active={activeId() === take.id}
                              progress={progress()}
                              playing={playing()}
                              onSeek={(nextProgress) =>
                                seekTake(take, nextProgress)
                              }
                            />
                            <div class={styles.takeActions}>
                              <button
                                type="button"
                                onClick={() => void exportTake(take)}
                              >
                                Export
                              </button>
                              <button
                                type="button"
                                class={styles.deleteAction}
                                onClick={() => removeTake(take)}
                              >
                                Delete
                              </button>
                            </div>
                          </article>
                        )}
                      </For>
                    </section>
                  </>
                )}
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
