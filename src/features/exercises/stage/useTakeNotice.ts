// ============================================================
// useTakeNotice — keeping a finished run's voice take, and the notice
// ============================================================
//
// The shell's half of the take notice (take-notice.ts says what it shows):
// the singer's Keep, its retry and its discard, and when the notice is up.
// Keeping writes to this device only and can take a moment, so while it runs
// the shell's ways out (Back, Try Again, a routine's next run, a tab change)
// wait for it, and a run that starts meanwhile turns its answer stale rather
// than letting "Take kept" land on the next run's result.
//
// The notice says everything about the keep, in one place, so no toast is
// raised for it; the analytics events are kept as they were.
//
// The take comes before a badge (owner, 0.9.31's review): from the run's
// end until the take's question is answered or put away, and while "Take
// kept" says how it went, the take holds Merc's bubble (`holdsBubble`).
// An achievement waits behind it with its time not running, and comes to
// the bubble after; every other notice, a warning too, is a toast at once,
// so nothing covers the question and nothing else is held up (owner, 27 Nov
// 2026; the store's `setStageTakeHolds`). An unlock that came first used to
// stand over the question for its six seconds, and a Try Again or a Back
// pressed meanwhile lost the take without its question ever being asked.

import type { Accessor } from 'solid-js'
import { createEffect, createMemo, createSignal, on, onCleanup } from 'solid-js'
import { keepExerciseVoiceTake } from '@/features/exercises/exercise-voice-take'
import { trackEvent } from '@/lib/analytics'
import type { ExerciseVoiceCaptureController, ExerciseVoiceCaptureState, } from '@/lib/domain/exercise-voice-capture'
import { useLocalSaveNavigationLock } from '@/lib/local-save-navigation-lock'
import type { TakeKeepState, TakeNotice } from './take-notice'
import { TAKE_KEPT_LINGER_MS, takeNotice } from './take-notice'

export interface TakeNoticeOptions {
  /** The drill's name, which titles the kept take's thread. */
  title: () => string
  /** The run's temporary take; absent in a drill that records nothing. */
  capture: () => ExerciseVoiceCaptureController | undefined
  /** The finished run may speak of its take at all: it has a result card,
   *  and is not a guided hold that ended for comfort or wants another try. */
  offered: () => boolean
}

export interface TakeNoticeController {
  /** What the notice says now, or null when it has nothing to say. */
  notice: Accessor<TakeNotice | null>
  /** The capture's state while the run may speak of it, else null. */
  captureState: Accessor<ExerciseVoiceCaptureState | null>
  /**
   * The take has Merc's bubble, or is about to: its capture is still being
   * finished, its question waits for an answer, a keep is under way, or
   * its outcome is on show. Achievements wait while this holds, and other
   * notices are toasts.
   */
  holdsBubble: Accessor<boolean>
  /** A keep is being written: everything that would leave waits for it. */
  saving: Accessor<boolean>
  /** Keep the take, or retry a keep that failed. */
  keep: () => void
  /** The notice's close: dismiss "Take kept", throw the take away otherwise. */
  close: () => void
  /** Throw the temporary take away. */
  discard: () => void
  /** Forget the last run's keep: a new run has started, or is about to. */
  reset: () => void
}

export function useTakeNotice(
  options: TakeNoticeOptions,
): TakeNoticeController {
  const [keepState, setKeepState] = createSignal<TakeKeepState>('idle')
  const [storageFull, setStorageFull] = createSignal(false)
  const [keptSeen, setKeptSeen] = createSignal(false)
  // Each keep belongs to one run; a reset makes an answer still on its way
  // for an earlier run stale.
  let generation = 0
  let keptTimer: ReturnType<typeof setTimeout> | undefined

  const saving = (): boolean => keepState() === 'saving'
  useLocalSaveNavigationLock(saving, 'exercise voice-take keep')

  const captureState = createMemo<ExerciseVoiceCaptureState | null>(() => {
    const capture = options.capture()
    // Read only while offered: a drill's capture can be a stand-in with no
    // state until a run has finished.
    if (capture === undefined || !options.offered()) return null
    return capture.state()
  })

  const notice = createMemo<TakeNotice | null>(() => {
    const capture = captureState()
    if (capture === null) return null
    return takeNotice({
      keep: keepState(),
      capture,
      storageFull: storageFull(),
      keptSeen: keptSeen(),
    })
  })

  const holdsBubble = createMemo<boolean>(() => {
    const capture = captureState()
    if (capture === null) return false
    // A take still being finished has its question on the way: a notice
    // let in now would only be sent back to wait when the question came.
    return (
      notice() !== null || capture === 'recording' || capture === 'processing'
    )
  })

  const clearKeptTimer = (): void => {
    clearTimeout(keptTimer)
    keptTimer = undefined
  }

  // "Take kept" leaves by itself, and the brief is back.
  createEffect(
    on(keepState, (state) => {
      clearKeptTimer()
      if (state !== 'saved') return
      keptTimer = setTimeout(() => {
        keptTimer = undefined
        setKeptSeen(true)
      }, TAKE_KEPT_LINGER_MS)
    }),
  )
  onCleanup(clearKeptTimer)

  function reset(): void {
    generation += 1
    clearKeptTimer()
    setKeepState('idle')
    setStorageFull(false)
    setKeptSeen(false)
  }

  function keep(): void {
    if (saving()) return
    const take = options.capture()?.take()
    const exerciseTitle = options.title()
    if (take === null || take === undefined) return
    setKeepState('saving')
    trackEvent('voice_keep_attempt')
    const run = generation

    const failed = (full: boolean): void => {
      setStorageFull(full)
      setKeepState('error')
    }

    void (async () => {
      try {
        const result = await keepExerciseVoiceTake({ exerciseTitle, take })
        if (result.ok) {
          trackEvent('voice_keep_success')
          if (run !== generation) return
          setKeepState('saved')
          return
        }
        trackEvent('voice_keep_failure')
        if (run !== generation) return
        const full = result.quotaExceeded || !result.roomAvailable
        if (full) trackEvent('voice_storage_warning')
        failed(full)
      } catch {
        trackEvent('voice_keep_failure')
        if (run !== generation) return
        failed(false)
      }
    })()
  }

  function discard(): void {
    if (saving()) return
    options.capture()?.discard()
    reset()
  }

  function close(): void {
    if (keepState() === 'saved') {
      clearKeptTimer()
      setKeptSeen(true)
      return
    }
    discard()
  }

  return {
    notice,
    captureState,
    holdsBubble,
    saving,
    keep,
    close,
    discard,
    reset,
  }
}
