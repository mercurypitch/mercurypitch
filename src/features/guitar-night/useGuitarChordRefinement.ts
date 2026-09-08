// Explicit post-stop proposals borrow the review's audition and never replace notes without acceptance.
import type { Accessor } from 'solid-js'
import { batch, createEffect, createMemo, createSignal, onCleanup, untrack, } from 'solid-js'
import type { GuitarRecordingDraft } from '@/db/services/guitar-recording-service'
import { createGuitarRecordingStore } from '@/db/services/guitar-recording-service'
import { createRefinedRecordingScore } from '@/lib/guitar/recording-refinement-score'
import type { GuitarPracticeScore } from '@/lib/guitar/recording-types'
import { sameRecordingPractice } from './accept-recording-practice'
import type { GuitarRecordingPlayback } from './useGuitarRecordingPlayback'

type RefinementProgress = {
  stage: 'loading' | 'decoding' | 'analysing'
  fraction: number
}

export function useGuitarChordRefinement(options: {
  draft: GuitarRecordingDraft
  open: Accessor<boolean>
  score: Accessor<GuitarPracticeScore>
  blocked: Accessor<boolean>
  /** One fresh completed take, never an existing/recovered melody. */
  autoStart?: Accessor<boolean>
  onAutoStart?(): void
  onScore(score: GuitarPracticeScore): void
  onSaved(): void
  playback: GuitarRecordingPlayback
  /** Tests may inject the real service over an isolated local database. */
  store?: ReturnType<typeof createGuitarRecordingStore>
}) {
  const store = options.store ?? createGuitarRecordingStore()
  const [progress, setProgress] = createSignal<RefinementProgress | null>(null)
  const [candidate, setCandidate] = createSignal<GuitarPracticeScore | null>(
    null,
  )
  const [comparison, setComparison] = createSignal<'current' | 'refined'>(
    'refined',
  )
  const [persisting, setPersisting] = createSignal(false)
  const [error, setError] = createSignal<string | null>(null)
  const [notice, setNotice] = createSignal<string | null>(null)
  const [backup, setBackup] = createSignal(options.draft.refinementBackup)
  const [expected, setExpected] = createSignal(
    options.draft.editableScore ?? null,
  )
  const [acceptedId, setAcceptedId] = createSignal(
    options.draft.recording.scoreId,
  )
  let previous: GuitarPracticeScore | null = null
  let controller: AbortController | null = null
  let generation = 0
  let disposed = false
  let autoStarted = false
  const running = () => progress() !== null
  const pendingReview = () => candidate() !== null
  const locked = () => running() || persisting() || pendingReview()
  const preview = createMemo(() =>
    comparison() === 'refined' ? candidate() : null,
  )
  const canRestore = createMemo(() => {
    const saved = backup()
    return (
      saved !== undefined &&
      saved.acceptedScoreId === acceptedId() &&
      JSON.stringify(options.score()) === JSON.stringify(expected()) &&
      JSON.stringify(saved.appliedScore) === JSON.stringify(expected())
    )
  })
  const cancel = () => {
    generation++
    controller?.abort()
    controller = null
    if (running() || pendingReview()) options.playback.pause()
    batch(() => {
      setProgress(null)
      setCandidate(null)
    })
    previous = null
  }
  createEffect(() => {
    if (!options.open()) untrack(cancel)
  })
  onCleanup(() => {
    disposed = true
    cancel()
  })

  const start = async () => {
    if (disposed || options.blocked() || locked() || !options.open()) return
    const blob = options.draft.blob
    if (blob === null) {
      setError(
        'This take has no saved audio to analyse. Its existing notes are still available.',
      )
      return
    }
    const base = structuredClone(options.score())
    const attempt = ++generation
    const abort = new AbortController()
    controller = abort
    options.playback.pause()
    batch(() => {
      setError(null)
      setNotice(null)
      setProgress({ stage: 'loading', fraction: 0 })
    })
    try {
      const { refineGuitarRecordingAudio } =
        await import('@/lib/transcription/guitar-recording-refinement')
      if (disposed || attempt !== generation) return
      const result = await refineGuitarRecordingAudio(blob, {
        signal: abort.signal,
        onProgress: (value) => {
          if (!disposed && attempt === generation) setProgress(value)
        },
      })
      if (disposed || attempt !== generation) return
      if (result.notes.length === 0) {
        setNotice(
          'No chord notes were found. Your current notes and recording are unchanged. Try a clean, dry phrase with clearly separated attacks.',
        )
        return
      }
      const refined = createRefinedRecordingScore(
        base,
        result.notes,
        globalThis.crypto.randomUUID(),
      )
      refined.score.refinement = {
        version: 1,
        model: 'basic-pitch',
        source: 'recorded-audio',
        modelSha256: result.modelSha256,
        decoderVersion: result.decoderVersion,
        createdAt: new Date().toISOString(),
        confidenceByNoteId: refined.confidenceByNoteId,
      }
      previous = base
      batch(() => {
        setComparison('refined')
        setCandidate(refined.score)
      })
      options.playback.setSource('notes')
    } catch (cause) {
      if (!disposed && attempt === generation && !abort.signal.aborted)
        setError(
          cause instanceof Error
            ? cause.message
            : 'Chord analysis failed. Your current notes are unchanged; try again.',
        )
    } finally {
      if (!disposed && attempt === generation) {
        controller = null
        setProgress(null)
      }
    }
  }

  const apply = async () => {
    const proposal = candidate()
    const before = previous
    if (
      proposal === null ||
      before === null ||
      persisting() ||
      options.blocked()
    )
      return
    setPersisting(true)
    setError(null)
    options.playback.pause()
    try {
      const saved = await store.applyRefinement({
        candidate: proposal,
        previousScore: before,
        expectedEditableScore: expected(),
        expectedAcceptedScoreId: acceptedId(),
        expectedFrames: options.draft.recording.frames,
      })
      // Closing cancels analysis, not an explicitly accepted database commit.
      // A still-mounted hidden review must reopen on the committed notes.
      if (disposed) return
      setBackup({
        version: 1,
        createdAt: saved.refinement!.createdAt,
        previousScore: before,
        appliedScore: saved,
        acceptedScoreId: acceptedId(),
        frames: options.draft.recording.frames,
      })
      setExpected(saved)
      batch(() => {
        options.onScore(saved)
        setCandidate(null)
      })
      previous = null
      setNotice(
        'Refined notes saved on this device. Review the suggested fingering, then Practice or export. Original audio and captured notes are unchanged.',
      )
      options.onSaved()
    } catch (cause) {
      if (!disposed)
        setError(
          cause instanceof Error
            ? cause.message
            : 'Could not save refined notes. The proposal is still available.',
        )
    } finally {
      if (!disposed) setPersisting(false)
    }
  }
  createEffect(() => {
    if (
      autoStarted ||
      options.autoStart?.() !== true ||
      !options.open() ||
      options.blocked()
    )
      return
    autoStarted = true
    untrack(() => {
      options.onAutoStart?.()
      void start()
    })
  })
  const restore = async () => {
    if (!canRestore() || locked() || options.blocked()) return
    const current = options.score()
    setPersisting(true)
    setError(null)
    options.playback.pause()
    try {
      const restored = await store.restoreRefinement(current)
      if (disposed) return
      batch(() => {
        setExpected(restored)
        options.onScore(restored)
        setBackup(undefined)
      })
      setNotice(
        'Previous notes restored. Original audio and accepted practice revisions are unchanged.',
      )
      options.onSaved()
    } catch (cause) {
      if (!disposed)
        setError(
          cause instanceof Error
            ? cause.message
            : 'Could not restore previous notes. Reopen the take and try again.',
        )
    } finally {
      if (!disposed) setPersisting(false)
    }
  }
  return {
    start,
    cancel,
    apply,
    restore,
    running,
    persisting,
    locked,
    pendingReview,
    candidate,
    preview,
    comparison,
    progress,
    error,
    notice,
    canRestore,
    hasBackup: () => backup() !== undefined,
    compare(value: 'current' | 'refined') {
      options.playback.pause()
      setComparison(value)
      options.playback.setSource('notes')
    },
    async saved(score: GuitarPracticeScore, accepted?: string): Promise<void> {
      const intended = structuredClone(score)
      const intendedAcceptedId = accepted ?? acceptedId()
      const state = await store.readRefinementState(intended.recordingId)
      if (disposed) return
      const current = state.editableScore ?? state.acceptedScore
      // Practice may reuse an immutable revision without rewriting corrections.
      // Read the actual baseline, but never adopt another tab's different edits.
      if (
        current == null ||
        state.acceptedScoreId !== intendedAcceptedId ||
        !sameRecordingPractice(current, intended) ||
        JSON.stringify(current.refinement ?? null) !==
          JSON.stringify(intended.refinement ?? null)
      )
        throw new Error(
          'These notes changed in another tab. Reopen the melody before refining it.',
        )
      batch(() => {
        setExpected(state.editableScore)
        setAcceptedId(state.acceptedScoreId)
        setBackup(state.refinementBackup)
      })
    },
  }
}

export type GuitarChordRefinement = ReturnType<typeof useGuitarChordRefinement>
