// ============================================================
// Voice History — local listening desk for kept voice takes
// ============================================================

/*
THESIS: Voice history is a listening desk organised by recurring practice
threads, never a generic voice-memo grid.
OWN-WORLD: MercuryPitch's dark Pitch Studio surfaces, ruled waveform fields,
quiet blue-violet accents, and compact native controls.
STORY: The singer sees what is ready to compare, chooses Earlier and Later,
hears one dry take at a time, and can inspect/export/delete every local file.
FIRST VIEWPORT: A narrow thread rail sits beside one large comparison field;
privacy and storage status stay in the header, not in a separate settings maze.
FORM: Context-first practice threads, the third grounded structure selected by
surface seed 828675af; no challenger staging replaces the established shell.
*/

import type { Component, JSX } from 'solid-js'
import { createEffect, createMemo, createSignal, For, onCleanup, onMount, Show, } from 'solid-js'
import { IconMic } from '@/components/exercise-icons'
import { Pencil } from '@/components/icons'
import type { VoiceTakeRecord } from '@/db/entities'
import type { VoiceStorageSnapshot } from '@/db/services/voice-take-service'
import { deleteVoiceTake, getVoiceStorageSnapshot, getVoiceTakeBlob, listVoiceTakes, renameFreeformVoiceThread, updateVoiceTake, wipeVoiceTakes, } from '@/db/services/voice-take-service'
import { trackEvent } from '@/lib/analytics'
import type { FreeformThreadTarget } from './freeform-voice-take'
import { createFreeformThreadTarget } from './freeform-voice-take'
import { FreeformVoiceRecorder } from './FreeformVoiceRecorder'
import styles from './VoiceHistoryPage.module.css'

interface VoiceThread {
  key: string
  title: string
  source: VoiceTakeRecord['source']
  takes: VoiceTakeRecord[]
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
}> = (props) => (
  <div
    class={styles.waveform}
    classList={{ [styles.waveformActive]: props.active }}
    role="img"
    aria-label={`Waveform for ${props.take.title}`}
  >
    <For
      each={
        props.take.peaks.length > 0
          ? props.take.peaks
          : [0.12, 0.2, 0.16, 0.28, 0.18, 0.12]
      }
    >
      {(peak) => (
        <span
          class={styles.waveBar}
          style={{ height: `${Math.max(8, Math.round(peak * 100))}%` }}
        />
      )}
    </For>
    <Show when={props.active}>
      <span
        class={styles.waveProgress}
        style={{ transform: `scaleX(${props.progress ?? 0})` }}
        aria-hidden="true"
      />
    </Show>
  </div>
)

export function VoiceHistoryPage(): JSX.Element {
  const [takes, setTakes] = createSignal<VoiceTakeRecord[]>([])
  const [loading, setLoading] = createSignal(true)
  const [selectedKey, setSelectedKey] = createSignal<string | null>(null)
  const [earlierId, setEarlierId] = createSignal<string | null>(null)
  const [laterId, setLaterId] = createSignal<string | null>(null)
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

  let audio: HTMLAudioElement | null = null
  let audioUrl: string | null = null
  let recordLaunchButton: HTMLButtonElement | undefined
  let recorderReturnFocus: HTMLElement | null = null
  let renameInput: HTMLInputElement | undefined
  let renameButton: HTMLButtonElement | undefined
  let comparisonStarted = false
  let comparisonPendingComplete = false

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

  function disposeAudio(): void {
    audio?.pause()
    audio = null
    if (audioUrl !== null) URL.revokeObjectURL(audioUrl)
    audioUrl = null
    setActiveId(null)
    setPlaying(false)
    setProgress(0)
  }

  async function refresh(currentKey: string | null = null): Promise<void> {
    const [loaded, snapshot] = await Promise.all([
      listVoiceTakes(),
      getVoiceStorageSnapshot(),
    ])
    setTakes(loaded)
    setStorage(snapshot)
    setLoading(false)
    const keys = new Set(loaded.map((take) => take.comparisonKey))
    if (currentKey !== null && keys.has(currentKey)) setSelectedKey(currentKey)
    else setSelectedKey(loaded[0]?.comparisonKey ?? null)
  }

  createEffect(() => {
    const thread = selectedThread()
    if (thread === null || thread.takes.length === 0) {
      setEarlierId(null)
      setLaterId(null)
      return
    }
    setEarlierId(thread.takes[0]!.id)
    setLaterId(thread.takes.at(-1)!.id)
  })

  onMount(() => {
    trackEvent('voice_history_open')
    void refresh()
  })
  onCleanup(disposeAudio)

  function playTake(take: VoiceTakeRecord, fromComparison = false): void {
    const isCurrentTake = activeId() === take.id
    void playTakeAsync(take, fromComparison, isCurrentTake)
  }

  async function playTakeAsync(
    take: VoiceTakeRecord,
    fromComparison: boolean,
    isCurrentTake: boolean,
  ): Promise<void> {
    const takeId = take.id
    if (fromComparison && !comparisonStarted) {
      comparisonStarted = true
      comparisonPendingComplete = true
      trackEvent('voice_compare_start')
    }
    if (isCurrentTake && audio !== null) {
      if (audio.paused) {
        await audio.play()
        setPlaying(true)
      } else {
        audio.pause()
        setPlaying(false)
      }
      return
    }

    disposeAudio()
    setPlayerError(null)
    const blob = await getVoiceTakeBlob(takeId)
    if (blob === null) {
      setPlayerError(
        'This take’s audio is missing. Its history record remains available to delete.',
      )
      return
    }
    audioUrl = URL.createObjectURL(blob)
    audio = new Audio(audioUrl)
    audio.addEventListener('timeupdate', () => {
      if (
        audio === null ||
        !Number.isFinite(audio.duration) ||
        audio.duration <= 0
      )
        return
      setProgress(audio.currentTime / audio.duration)
    })
    audio.addEventListener('ended', () => {
      setPlaying(false)
      setProgress(1)
      if (comparisonPendingComplete) {
        comparisonPendingComplete = false
        trackEvent('voice_compare_complete')
      }
    })
    audio.addEventListener('error', () => {
      setPlaying(false)
      setPlayerError(
        'This browser could not decode the recording. Export it to keep the original file.',
      )
    })
    setActiveId(takeId)
    try {
      await audio.play()
      setPlaying(true)
    } catch {
      setPlayerError(
        'Playback was blocked. Tap play again to start the recording.',
      )
    }
  }

  async function exportTake(take: VoiceTakeRecord): Promise<void> {
    const blob = await getVoiceTakeBlob(take.id)
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
    URL.revokeObjectURL(url)
    trackEvent('voice_export')
  }

  function removeTake(take: VoiceTakeRecord): void {
    const confirmed = window.confirm(
      `Delete “${take.title}” from this device? This cannot be undone.`,
    )
    if (!confirmed) return
    const key = take.comparisonKey
    const wasActive = activeId() === take.id
    void (async () => {
      if (wasActive) disposeAudio()
      if (await deleteVoiceTake(take.id)) {
        trackEvent('voice_delete')
        await refresh(key)
      } else {
        setPlayerError('The take could not be deleted. Please try again.')
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

  function chooseEarlier(id: string): void {
    const thread = selectedThread()
    if (thread === null) return
    const candidateIndex = thread.takes.findIndex((take) => take.id === id)
    const laterIndex = thread.takes.findIndex((take) => take.id === laterId())
    if (candidateIndex >= 0 && candidateIndex < laterIndex) {
      disposeAudio()
      setEarlierId(id)
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
    }
  }

  function wipeAll(): void {
    if (
      !window.confirm(
        'Delete every kept voice take from this device? This cannot be undone.',
      )
    )
      return
    void (async () => {
      disposeAudio()
      if (await wipeVoiceTakes()) await refresh()
      else
        setPlayerError('Voice history could not be cleared. Please try again.')
    })()
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
    await refresh(comparisonKey)
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
        try {
          await refresh(comparisonKey)
          finishRenaming()
        } catch {
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
        when={!loading()}
        fallback={
          <div class={styles.loading}>Opening your local voice history…</div>
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
                    classList={{
                      [styles.threadSelected]: selectedKey() === thread.key,
                    }}
                    onClick={() => {
                      disposeAudio()
                      setRenamingKey(null)
                      setRenameError(null)
                      comparisonStarted = false
                      comparisonPendingComplete = false
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
              <Show when={selectedThread()}>
                {(thread) => (
                  <>
                    <div class={styles.workspaceHead}>
                      <Show
                        when={renamingKey() === thread().key}
                        fallback={
                          <div>
                            <span>{thread().source} thread</span>
                            <h2>{thread().title}</h2>
                            <p>
                              {formatDate(thread().takes[0]!.capturedAt)} to{' '}
                              {formatDate(thread().takes.at(-1)!.capturedAt)}
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
                      <Show when={renamingKey() !== thread().key}>
                        <div class={styles.workspaceActions}>
                          <Show when={thread().source === 'freeform'}>
                            <button
                              ref={renameButton}
                              type="button"
                              class={styles.renameThread}
                              onClick={() => startRenaming(thread())}
                              disabled={recorderTarget() !== null}
                            >
                              <Pencil size={14} />
                              Rename
                            </button>
                            <button
                              type="button"
                              class={styles.recordAnother}
                              onClick={() => openThreadRecorder(thread())}
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

                    <Show
                      when={thread().takes.length >= 2}
                      fallback={
                        <div class={styles.oneTake}>
                          <Waveform
                            take={thread().takes[0]!}
                            active={activeId() === thread().takes[0]!.id}
                            progress={progress()}
                          />
                          <div>
                            <h3>One more matching take unlocks comparison.</h3>
                            <p>
                              Replay this one now, then return to the same
                              practice context later.
                            </p>
                            <button
                              type="button"
                              onClick={() => void playTake(thread().takes[0]!)}
                            >
                              {activeId() === thread().takes[0]!.id && playing()
                                ? 'Pause take'
                                : 'Play take'}
                            </button>
                          </div>
                        </div>
                      }
                    >
                      <section
                        class={styles.compare}
                        aria-label="Earlier and later comparison"
                      >
                        <div class={styles.compareTopline}>
                          <div>
                            <span>A/B listening</span>
                            <h3>Then, now, and the space between.</h3>
                          </div>
                          <div
                            class={styles.progressTrack}
                            role="progressbar"
                            aria-label="Active comparison take playback"
                            aria-valuemin="0"
                            aria-valuemax="100"
                            aria-valuenow={Math.round(progress() * 100)}
                          >
                            <span
                              style={{ transform: `scaleX(${progress()})` }}
                            />
                          </div>
                        </div>
                        <p class={styles.srOnly} aria-live="polite">
                          {activeId() === earlier()?.id
                            ? `Earlier take ${playing() ? 'playing' : 'selected'}`
                            : activeId() === later()?.id
                              ? `Later take ${playing() ? 'playing' : 'selected'}`
                              : 'No comparison take selected'}
                        </p>
                        <div class={styles.compareSides}>
                          <For
                            each={[
                              { label: 'Earlier', take: earlier() },
                              { label: 'Later', take: later() },
                            ]}
                          >
                            {(side) => (
                              <div
                                class={styles.compareSide}
                                classList={{
                                  [styles.sideActive]:
                                    activeId() === side.take?.id,
                                }}
                                aria-label={`${side.label} take${
                                  activeId() === side.take?.id ? ', active' : ''
                                }`}
                                role="group"
                              >
                                <span class={styles.sideLabel}>
                                  {side.label}
                                </span>
                                <Show when={side.take}>
                                  {(take) => (
                                    <>
                                      <strong>
                                        {formatDate(take().capturedAt)}
                                      </strong>
                                      <span>
                                        {formatDuration(take().durationMs)} ·{' '}
                                        {formatBytes(take().sizeBytes)}
                                      </span>
                                      <Waveform
                                        take={take()}
                                        active={activeId() === take().id}
                                        progress={progress()}
                                      />
                                      <button
                                        type="button"
                                        class={styles.playButton}
                                        onClick={() =>
                                          void playTake(take(), true)
                                        }
                                        aria-pressed={
                                          activeId() === take().id && playing()
                                        }
                                      >
                                        {activeId() === take().id && playing()
                                          ? 'Pause'
                                          : `Play ${side.label}`}
                                      </button>
                                    </>
                                  )}
                                </Show>
                              </div>
                            )}
                          </For>
                        </div>
                        <div class={styles.takeSelectors}>
                          <label>
                            Earlier take
                            <select
                              value={earlierId() ?? ''}
                              onChange={(event) => {
                                const id = event.currentTarget.value
                                chooseEarlier(id)
                              }}
                            >
                              <For each={thread().takes}>
                                {(take, index) => (
                                  <option
                                    value={take.id}
                                    disabled={
                                      index() >=
                                      thread().takes.findIndex(
                                        (candidate) =>
                                          candidate.id === laterId(),
                                      )
                                    }
                                  >
                                    {formatDate(take.capturedAt)} · Take{' '}
                                    {thread().takes.indexOf(take) + 1}
                                  </option>
                                )}
                              </For>
                            </select>
                          </label>
                          <label>
                            Later take
                            <select
                              value={laterId() ?? ''}
                              onChange={(event) => {
                                const id = event.currentTarget.value
                                chooseLater(id)
                              }}
                            >
                              <For each={thread().takes}>
                                {(take, index) => (
                                  <option
                                    value={take.id}
                                    disabled={
                                      index() <=
                                      thread().takes.findIndex(
                                        (candidate) =>
                                          candidate.id === earlierId(),
                                      )
                                    }
                                  >
                                    {formatDate(take.capturedAt)} · Take{' '}
                                    {thread().takes.indexOf(take) + 1}
                                  </option>
                                )}
                              </For>
                            </select>
                          </label>
                        </div>
                      </section>
                    </Show>

                    <section class={styles.timeline}>
                      <div class={styles.timelineHeading}>
                        <div>
                          <span>Thread history</span>
                          <h3>Every kept take</h3>
                        </div>
                        <button
                          type="button"
                          class={styles.dangerLink}
                          onClick={wipeAll}
                        >
                          Clear all voice history
                        </button>
                      </div>
                      <For each={[...thread().takes].reverse()}>
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
    </section>
  )
}
