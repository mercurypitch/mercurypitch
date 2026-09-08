// Guitar recorder owns explicit capture intent, never playback or the player's existing monitoring lease.
import type { Accessor } from 'solid-js'
import { batch, createEffect, createMemo, createSignal, onCleanup, onMount, untrack, } from 'solid-js'
import type { GuitarRecordingDraft } from '@/db/services/guitar-recording-service'
import { createGuitarRecordingStore } from '@/db/services/guitar-recording-service'
import type { GuitarElectricAmpParameters } from '@/lib/guitar/guitar-electric-amp'
import type { InstrumentTuning } from '@/lib/guitar/instrument-tuning'
import { startGuitarRecordingCapture } from '@/lib/guitar/recording-capture'
import { acquireGuitarRecordingLock } from '@/lib/guitar/recording-lock'
import type { GuitarPracticeScore, GuitarRecordedNote, GuitarRecording, GuitarRecordingBacking, } from '@/lib/guitar/recording-types'
import { GUITAR_DETECTOR_VERSION, GUITAR_RECORDING_LIMIT_SECONDS, } from '@/lib/guitar/recording-types'
import { midiToNote } from '@/lib/scale-data'
import type { GuitarListeningController } from './useGuitarListeningController'

interface GuitarRecordingOptions {
  listening: Pick<
    GuitarListeningController,
    | 'recordingInput'
    | 'inputProfile'
    | 'recordableStream'
    | 'error'
    | 'stop'
    | 'monitorInputChannel'
    | 'status'
  >
  startListening(): Promise<boolean>
  amp: Accessor<GuitarElectricAmpParameters>
  tuning: Accessor<InstrumentTuning>
  backing: Accessor<GuitarRecordingBacking | null>
  playing: Accessor<boolean>
  blocked: Accessor<boolean>
  clearLoop(): void
}

export function useGuitarRecordingController(options: GuitarRecordingOptions) {
  const [state, setState] = createSignal<
    'idle' | 'preparing' | 'recording' | 'stopping'
  >('idle')
  const [error, setError] = createSignal<string | null>(null)
  const [duration, setDuration] = createSignal(0)
  const [noteCount, setNoteCount] = createSignal(0)
  const [heardNote, setHeardNote] = createSignal<string | null>(null)
  const [captureRow, setCaptureRow] = createSignal<GuitarRecording | null>(null)
  const [completedNotes, setCompletedNotes] = createSignal<
    readonly GuitarRecordedNote[]
  >([])
  const [pendingNote, setPendingNote] = createSignal<GuitarRecordedNote | null>(
    null,
  )
  const [draft, setDraft] = createSignal<GuitarRecordingDraft | null>(null)
  const [previewScore, setPreviewScore] =
    createSignal<GuitarPracticeScore | null>(null)
  const [reviewOpen, setReviewOpen] = createSignal(false)
  const [catalogue, setCatalogue] = createSignal<GuitarRecording[]>([])
  const busy = createMemo(() => state() !== 'idle')
  let capture: Awaited<ReturnType<typeof startGuitarRecordingCapture>> | null =
    null
  let abort: AbortController | null = null
  let activeId: string | null = null
  let ownsInput = false
  let disposed = false
  let generation = 0
  let selectionGeneration = 0
  let startFrame: number | null = null
  let backingPlaying = false
  let pinnedInput: ReturnType<GuitarListeningController['recordingInput']> =
    null
  let completion: Promise<void> = Promise.resolve()
  let releaseDraft: (() => void) | null = null
  let startWrite: Promise<void> = Promise.resolve()
  const store = () => createGuitarRecordingStore()
  const releaseOwnedInput = (): void => {
    const release = ownsInput
    ownsInput = false
    if (release) options.listening.stop()
  }
  const refresh = async (): Promise<void> => {
    try {
      const rows = await store().list()
      if (!disposed) setCatalogue(rows)
    } catch (cause) {
      if (!disposed)
        setError(
          cause instanceof Error
            ? cause.message
            : 'Saved recordings could not be loaded.',
        )
    }
  }
  onMount(() => void refresh())
  const recover = async (
    id: string,
    request: { review?: boolean } = {},
  ): Promise<void> => {
    if (busy()) {
      if (request.review === false)
        throw new Error('Finish recording before switching melodies.')
      return
    }
    const attempt = ++selectionGeneration
    setError(null)
    let release: (() => void) | null = null
    try {
      release = await acquireGuitarRecordingLock(id)
      if (disposed || attempt !== selectionGeneration) return
      if (release === null)
        throw new Error(
          'This melody is still recording in another tab. Stop it there before recovering it here.',
        )
      let result = await store().load(id)
      if (disposed || attempt !== selectionGeneration) return
      if (result.recording.state === 'capturing') {
        if (
          typeof navigator.locks?.request !== 'function' &&
          Date.now() - Date.parse(result.recording.updatedAt) < 15000
        )
          throw new Error(
            'This draft may still be recording. Stop it in the other tab, or wait 15 seconds before recovering it.',
          )
        await store().finish(
          id,
          {
            frames: result.recording.frames,
            notes: result.notes,
            clockAnomalies: result.recording.clockAnomalies,
            interruption:
              'Recovered after recording was interrupted. The last unsaved audio block may be missing.',
          },
          result.recording.audioStartFrame,
        )
        result = await store().load(id)
      }
      if (disposed || attempt !== selectionGeneration) return
      // Switching never discards the previous draft's durable audio/evidence.
      // A late load must not replace a newer selection or a fresh capture.
      batch(() => {
        setDraft(result)
        setPreviewScore(null)
        setReviewOpen(request.review !== false)
      })
      await refresh()
    } catch (cause) {
      if (!disposed && attempt === selectionGeneration)
        setError(
          cause instanceof Error
            ? cause.message
            : 'The draft could not be recovered.',
        )
      if (request.review === false) throw cause
    } finally {
      release?.()
    }
  }
  const stop = async (reason: string | null = null): Promise<void> => {
    if (!busy()) return
    setState('stopping')
    if (capture !== null) await capture.stop(reason).catch(() => undefined)
    else {
      generation++
      abort?.abort()
      // Keep ownership until the pending permission request settles: a late
      // grant must still be closed in start's finally block.
      if (ownsInput) options.listening.stop()
    }
    await completion
  }
  const start = async (): Promise<void> => {
    if (busy() || options.blocked()) return
    selectionGeneration++
    if (options.listening.inputProfile() === 'midi') {
      setError(
        'Choose Direct input or Room mic to record both audio and notes. MIDI-only recording is not available yet.',
      )
      return
    }
    const attempt = ++generation
    const amp = options.amp()
    const tuning = structuredClone(options.tuning())
    backingPlaying = options.playing()
    ownsInput = options.listening.recordableStream() === null
    abort = new AbortController()
    startWrite = Promise.resolve()
    setState('preparing')
    setError(null)
    setDuration(0)
    setNoteCount(0)
    setHeardNote(null)
    setCaptureRow(null)
    setCompletedNotes([])
    setPendingNote(null)
    setDraft(null)
    setReviewOpen(false)
    options.clearLoop()
    try {
      if (ownsInput && !(await options.startListening()))
        throw new Error(
          options.listening.error() ?? 'Audio input did not start.',
        )
      if (disposed || attempt !== generation) return
      const input = options.listening.recordingInput()
      if (input === null)
        throw new Error(
          'No audio input is available. Turn on Listening and try again.',
        )
      pinnedInput = input
      const now = new Date().toISOString()
      const id = globalThis.crypto.randomUUID()
      releaseDraft = await acquireGuitarRecordingLock(id)
      if (releaseDraft === null)
        throw new Error('This draft is already recording in another tab.')
      if (disposed || attempt !== generation) return
      activeId = id
      startFrame = null
      const row: GuitarRecording = {
        id,
        version: 1,
        detectorVersion: GUITAR_DETECTOR_VERSION,
        title: `Guitar melody · ${new Date(now).toLocaleString()}`,
        createdAt: now,
        updatedAt: now,
        state: 'capturing',
        sampleRate: input.context.sampleRate,
        inputChannel: input.channel,
        inputKind:
          options.listening.inputProfile() === 'interface'
            ? 'interface'
            : 'microphone',
        frames: 0,
        chunks: 0,
        audioStartFrame: null,
        clockAnomalies: 0,
        interruption: null,
        amp,
        tuning,
        backing: null,
        takeId: null,
        scoreId: null,
      }
      await store().begin(row)
      if (!disposed) setCaptureRow(row)
      if (disposed || attempt !== generation) {
        await store().discard(id)
        return
      }
      capture = await startGuitarRecordingCapture({
        id,
        input,
        signal: abort.signal,
        onStart(frame) {
          startFrame = frame
          backingPlaying = options.playing()
          const backing = options.playing() ? options.backing() : null
          const anchor =
            backing === null
              ? null
              : {
                  ...backing,
                  startSeconds: Math.max(
                    0,
                    backing.startSeconds -
                      Math.max(
                        0,
                        input.context.currentTime -
                          frame / input.context.sampleRate,
                      ) *
                        backing.rate,
                  ),
                }
          startWrite = store().started(id, frame, anchor)
          void startWrite.catch(() =>
            untrack(() => void stop('The recording start could not be saved.')),
          )
          if (!disposed && state() !== 'stopping') setState('recording')
        },
        onPreview(preview) {
          if (!disposed && attempt === generation && activeId === id)
            batch(() => {
              setDuration(preview.frames / input.context.sampleRate)
              setNoteCount((count) => count + preview.notes.length)
              if (preview.notes.length)
                setCompletedNotes((notes) => [...notes, ...preview.notes])
              setPendingNote(preview.pendingNote)
              const pitch = preview.pitch?.midi
              const named = pitch == null ? null : midiToNote(Math.round(pitch))
              setHeardNote(
                named === null ? null : `${named.name}${named.octave}`,
              )
            })
        },
        async onChunk(chunk) {
          await startWrite
          await store().checkpoint(chunk)
        },
      })
      completion = capture.done
        .then(async (summary) => {
          if (!disposed) setState('stopping')
          await startWrite
          await store().finish(id, summary, startFrame)
          if (!disposed) {
            const loaded = await store().load(id)
            if (disposed) return
            setDraft(loaded)
            setReviewOpen(true)
          }
        })
        .catch((cause: unknown) => {
          if (!disposed)
            setError(
              cause instanceof Error
                ? cause.message
                : 'Recording was interrupted. Recover the saved draft.',
            )
        })
        .finally(() => {
          capture = null
          pinnedInput = null
          activeId = null
          releaseOwnedInput()
          releaseDraft?.()
          releaseDraft = null
          if (!disposed) {
            setState('idle')
            void refresh()
          }
        })
    } catch (cause) {
      if (!disposed)
        setError(
          cause instanceof Error ? cause.message : 'Recording could not start.',
        )
    } finally {
      if (capture === null) {
        releaseOwnedInput()
        releaseDraft?.()
        releaseDraft = null
        if (!disposed) {
          setState('idle')
          void refresh()
        }
      }
    }
  }
  createEffect(() => {
    const recording = state() === 'recording'
    const stream = options.listening.recordableStream()
    const channel = options.listening.monitorInputChannel()
    const status = options.listening.status()
    const playing = options.playing()
    const blocked = options.blocked()
    if (!recording) return
    if (
      blocked ||
      stream !== pinnedInput?.stream ||
      channel !== pinnedInput.channel ||
      status !== 'listening' ||
      playing !== backingPlaying
    ) {
      untrack(
        () =>
          void stop(
            'Recording ended because playback or the audio route changed.',
          ),
      )
    }
  })
  onMount(() => {
    const visibility = (): void => {
      if (document.hidden)
        void stop('Recording paused when the tab was hidden.')
    }
    const beforeUnload = (event: BeforeUnloadEvent): void => {
      if (busy()) {
        event.preventDefault()
        event.returnValue = ''
      }
    }
    document.addEventListener('visibilitychange', visibility)
    window.addEventListener('beforeunload', beforeUnload)
    onCleanup(() => {
      document.removeEventListener('visibilitychange', visibility)
      window.removeEventListener('beforeunload', beforeUnload)
    })
  })
  onCleanup(() => {
    disposed = true
    selectionGeneration++
    void stop('The room was closed. Recover the saved draft to keep it.')
    if (capture === null) abort?.abort()
  })
  const previewNotes = createMemo(() => {
    if (!busy()) return draft()?.notes ?? []
    const pending = pendingNote()
    return pending === null ? completedNotes() : [...completedNotes(), pending]
  })
  return {
    state,
    busy,
    error,
    duration,
    // Read-only visual clock. Never drive capture/evidence from render frames
    // or wait for worker + IndexedDB checkpoints to move the highway.
    captureSeconds: () =>
      state() === 'recording' && pinnedInput !== null && startFrame !== null
        ? Math.min(
            GUITAR_RECORDING_LIMIT_SECONDS,
            Math.max(
              0,
              pinnedInput.context.currentTime -
                startFrame / pinnedInput.context.sampleRate,
            ),
          )
        : duration(),
    noteCount,
    heardNote,
    previewScore,
    setPreviewScore,
    previewRecording: () =>
      busy() ? captureRow() : (draft()?.recording ?? null),
    previewNotes,
    draft,
    reviewOpen,
    catalogue,
    start,
    stop,
    recover,
    refresh,
    setReviewOpen,
    setDraft,
    activeId: () => activeId,
    async discard(id: string) {
      await store().discard(id)
      if (!disposed && draft()?.recording.id === id) {
        selectionGeneration++
        batch(() => {
          setDraft(null)
          setPreviewScore(null)
          setReviewOpen(false)
        })
      }
      await refresh()
    },
    async remove(id: string) {
      if (busy()) throw new Error('Finish recording before removing a melody.')
      const release = await acquireGuitarRecordingLock(id)
      if (release === null)
        throw new Error(
          'This melody is in use in another tab. Close it there and try again.',
        )
      try {
        await store().remove(id)
        if (!disposed)
          setCatalogue((rows) => rows.filter((row) => row.id !== id))
        if (!disposed && draft()?.recording.id === id) {
          selectionGeneration++
          batch(() => {
            setDraft(null)
            setPreviewScore(null)
            setReviewOpen(false)
          })
        }
        await refresh()
      } finally {
        release()
      }
    },
  }
}
export type GuitarRecordingController = ReturnType<
  typeof useGuitarRecordingController
>
