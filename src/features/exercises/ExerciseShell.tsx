// ============================================================
// ExerciseShell — shared chrome for every exercise runner
// ============================================================
//
// Owns the layout that used to be duplicated across all 18 exercise
// components: the header (back, "?" help toggle, title, score), the
// collapsible beginner help panel, the idle area (settings + description +
// Start beneath it), the active area (content + Stop + optional auto-timer),
// and the result card with a primary retry action plus explicit voice-take
// persistence choices. Exercise-specific JSX is passed in via slots so each
// component only supplies its canvas, metrics, idle placeholder and result
// summary.

import type { Component, JSX } from 'solid-js'
import { createEffect, createMemo, createSignal, For, on, onCleanup, onMount, Show, useContext, } from 'solid-js'
import { IconQuestion } from '@/components/exercise-icons'
import type { ExercisePitchTrackerProps } from '@/components/ExercisePitchTracker'
import { ExercisePitchTracker } from '@/components/ExercisePitchTracker'
import { MicButton } from '@/components/MicButton'
import { OptionsSheet } from '@/components/mobile/OptionsSheet'
import { EngineContext } from '@/contexts/EngineContext'
import { getDifficulty } from '@/features/practice-intelligence/difficulty-store'
import { holdMicForRoutine, releaseRoutineMicHold, } from '@/features/routines/routine-mic-hold'
import { RoutineRibbon } from '@/features/routines/RoutineRibbon'
import { segmentRunsExercise, useDailyRoutine, } from '@/features/routines/use-daily-routine'
import { trackEvent } from '@/lib/analytics'
import { haptics } from '@/lib/haptics'
import { isNarrow } from '@/lib/use-viewport'
import { getExerciseStats } from '@/stores/exercise-history-store'
import { showNotification } from '@/stores/notifications-store'
import { EXERCISE_HELP } from './exercise-help'
import { keepExerciseVoiceTake } from './exercise-voice-take'
import { ExerciseScoreHistory } from './ExerciseScoreHistory'
import { gradeForScore } from './feedback'
import type { RunTrace } from './last-run-trace'
import { lastRunTrace } from './last-run-trace'
import { RunTraceCanvas } from './RunTraceCanvas'
import { activeTimerSeconds, CUSTOM_MAX_SEC, CUSTOM_MIN_SEC, CUSTOM_STEP_SEC, customTimerSeconds, setCustomTimerSeconds, setTimerMode, TIMER_PRESETS, timerMode, } from './timer-preference'
import type { ExerciseStatus, ExerciseType, GuidedPracticeLaunchConfig, } from './types'
import type { ExerciseVoiceCaptureController } from './use-base-exercise'

export interface AutoTimerConfig {
  /** Preset durations (seconds). Defaults to the shared ladder. */
  presets?: number[]
  /** Called when the timer elapses — wire to the exercise's stop/score. */
  onElapse: () => void
}

/**
 * The live pitch tracker that sits above every drill's active content.
 *
 * It used to be rendered by each of the 18 exercise components, identically.
 * Hoisting it here means the things that are about to change about it — an
 * upcoming-target timeline, showing the finished run back — are one edit
 * instead of eighteen, and a drill can no longer forget it.
 */
export interface ExerciseTrackerConfig {
  pitchHistory: ExercisePitchTrackerProps['pitchHistory']
  /** Reference note the singer is aiming at right now, if there is one. */
  targetNoteMidi?: () => number | undefined
  /** Guide frequency (Hz) that moves over time — glides, sirens, vibrato. */
  movingTarget?: () => number | null
  /**
   * The targets after the current one, nearest first (MIDI). Supplied by the
   * drills that know their sequence, so the singer can prepare the next
   * interval; drills with one held target (Long Note, Pitch Hold, Drone) leave
   * it out — for them the flat line is already the whole truth.
   */
  upcomingTargets?: () => number[]
  /** Extra gate for drills that only track part of the run (Warmup's sing
   *  steps — breathing and hums have no pitch to plot). */
  when?: () => boolean
}

export interface ExerciseShellProps {
  type: ExerciseType
  title: string
  /**
   * The drill's mark, shown beside the title in the header.
   *
   * It used to open the idle panel at 48px with the title already spelled out
   * two rows above it, which cost a row of the panel to say something the
   * header had said. Beside the title it identifies the drill in the one place
   * that is on screen during a run as well.
   */
  icon?: JSX.Element
  status: () => ExerciseStatus
  /** Live score 0-100 (shown in the header during a run). */
  currentScore: () => number
  /** Final score 0-100 once complete (drives the result overlay color). */
  resultScore: () => number | null
  /** Temporary local audio for this run; omitted in shell-only tests. */
  voiceCapture?: ExerciseVoiceCaptureController
  error?: () => string | null
  onBack: () => void

  /** Reviewed, launch-scoped guided dose. Never written to global settings. */
  guidedPractice?: GuidedPracticeLaunchConfig
  /**
   * Confirms that a timer-finished guided run captured enough exercise-specific
   * evidence to count toward the prescribed dose. Guided runs fail closed when
   * this is omitted; an elapsed timer alone is not proof of a completed hold.
   */
  guidedCompletionReady?: () => boolean

  /** Settings shown in idle (note pickers, scale selects). Optional. */
  idleSettings?: JSX.Element
  /** When set, heavy idle settings move into a mobile bottom sheet behind a
   *  button with this label (keeps the Start CTA above the fold on phones);
   *  desktop always renders them inline. Only the content-heavy setups
   *  (Guided Warmup, Routine Runner) opt in. */
  settingsSheetLabel?: string
  /** Idle placeholder (icon + short hint). Falls back to the help summary. */
  idlePlaceholder?: JSX.Element
  onStart: () => void
  startLabel?: string

  /** Live pitch tracker drawn above activeContent. Omit for drills that plot
   *  nothing (Ear Training's listening-only rounds). */
  tracker?: ExerciseTrackerConfig

  /**
   * The one-line instruction for the current phase — "Listen", "Breathe",
   * "Glide C3 → C4, follow the dot".
   *
   * Separate from `activeContent` because of where it belongs on screen. On a
   * short viewport the tracker and the drill's own visual sit side by side,
   * and a phase line inside the drill's column ended up squeezed into the
   * narrow half, off to one side of a stage it is talking about. It reads for
   * the whole stage, so it goes above the whole stage.
   */
  activePhase?: JSX.Element

  activeContent: JSX.Element
  /**
   * The run's readouts — smoothness, accuracy, held seconds.
   *
   * Below the stage rather than inside it, for the mirror of the reason the
   * phase line is above it. A metrics row is wide and short; the drill's
   * visual is narrow and tall. Sharing a column, the row was the thing that
   * got squeezed, and on a short viewport it was also the thing that landed
   * under the Stop button.
   */
  activeFooter?: JSX.Element
  stopLabel?: string
  onStop: () => void

  /** Metrics line shown under the score in the result overlay. */
  resultSummary: JSX.Element
  onTryAgain: () => void
  onChangeTarget: () => void
  changeTargetLabel?: string

  /** Present only for drills that support a timed auto-score mode. */
  autoTimer?: AutoTimerConfig
}

/** "45s" under a minute, "1:30" above it — a bare "90s" reads as a typo. */
const formatRunLength = (seconds: number): string => {
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`
}

export const ExerciseShell: Component<ExerciseShellProps> = (props) => {
  const [helpOpen, setHelpOpen] = createSignal(false)
  const [voiceKeepState, setVoiceKeepState] = createSignal<
    'idle' | 'saving' | 'saved' | 'error'
  >('idle')
  const [remainingMs, setRemainingMs] = createSignal(0)
  const [guidedCompletedRepetitions, setGuidedCompletedRepetitions] =
    createSignal(0)
  const [lastGuidedRunCompleted, setLastGuidedRunCompleted] =
    createSignal(false)
  const [guidedRunNeedsEvidence, setGuidedRunNeedsEvidence] =
    createSignal(false)
  const [guidedStopReason, setGuidedStopReason] = createSignal<
    'paused' | 'discomfort' | null
  >(null)
  // Opens the slider. Sticky while Custom is the selected mode so the value
  // stays adjustable between runs, rather than collapsing after every pick.
  const [customOpen, setCustomOpen] = createSignal(false)
  let voiceKeepGeneration = 0
  let guidedResultCard: HTMLDivElement | undefined
  let guidedResultFocusTimer: ReturnType<typeof setTimeout> | undefined

  // Heavy idle settings → mobile bottom sheet (opt-in via settingsSheetLabel).
  const [settingsSheetOpen, setSettingsSheetOpen] = createSignal(false)
  const useSettingsSheet = () =>
    props.settingsSheetLabel !== undefined && isNarrow()

  const help = () => EXERCISE_HELP[props.type]
  // Memoize the status string. props.status() reads base.state(), which is
  // replaced every animation frame (elapsedMs), so reading it directly in the
  // auto-timer `on(...)` below would fire the effect ~60x/sec and perpetually
  // re-arm the timer. The memo only notifies when the status value changes.
  const status = createMemo(() => props.status())
  const isActive = () => status() === 'active'
  const isComplete = () => status() === 'complete'
  const guidedDurationSeconds = createMemo<number | null>(() => {
    const milliseconds = props.guidedPractice?.dose.durationMilliseconds
    return milliseconds !== null &&
      milliseconds !== undefined &&
      Number.isFinite(milliseconds) &&
      milliseconds > 0
      ? milliseconds / 1000
      : null
  })
  const guidedSets = () => props.guidedPractice?.dose.sets ?? null
  const guidedRepetitions = () => props.guidedPractice?.dose.repetitions ?? null
  const guidedTotalRepetitions = createMemo<number | null>(() => {
    const repetitions = guidedRepetitions()
    const sets = guidedSets()
    if (repetitions === null || sets === null) return null
    return repetitions * sets
  })
  const guidedDoseComplete = () => {
    const total = guidedTotalRepetitions()
    return total !== null && guidedCompletedRepetitions() >= total
  }
  const voiceCaptureHeading = createMemo(() => {
    if (voiceKeepState() === 'saving') return 'Keeping voice take'
    if (voiceKeepState() === 'saved') return 'Voice take kept'
    if (voiceKeepState() === 'error') return 'Could not keep voice take'
    const captureState = props.voiceCapture?.state()
    if (captureState === 'processing') return 'Preparing voice take'
    if (captureState === 'ready') return 'Keep this voice take?'
    if (captureState === 'unsupported' || captureState === 'error') {
      return 'Replay unavailable'
    }
    return 'Replay discarded'
  })
  // A finished run returns to the selector + Start screen, where a result
  // card (grade, personal-best delta, the exercise's metric summary) makes
  // the payoff moment explicit before the next attempt.
  const isIdleLike = () => status() === 'idle' || status() === 'complete'

  // Personal-best detection: snapshot the stats when a run STARTS — by the
  // time the run completes, the history already contains the new entry, so
  // comparing against a live read would never detect a PB.
  const [prevBest, setPrevBest] = createSignal<number | null>(null)
  const [prevLast, setPrevLast] = createSignal<number | null>(null)
  // The finished run's contour, shown back on the result card.
  const [runTrace, setRunTrace] = createSignal<RunTrace | null>(null)
  let guidedTimerCompletionPending = false
  createEffect(
    on(status, (s, previous) => {
      if (s === 'active' && previous !== 'active') {
        clearTimeout(guidedResultFocusTimer)
        guidedResultFocusTimer = undefined
        guidedTimerCompletionPending = false
        setLastGuidedRunCompleted(false)
        setGuidedRunNeedsEvidence(false)
        setGuidedStopReason(null)
        voiceKeepGeneration += 1
        setVoiceKeepState('idle')
        if (props.guidedPractice === undefined) {
          const stats = getExerciseStats(props.type)
          setPrevBest(stats.totalPlays > 0 ? stats.bestScore : null)
          setPrevLast(stats.totalPlays > 0 ? stats.lastScore : null)
        } else {
          setPrevBest(null)
          setPrevLast(null)
        }
      }
      // Score reveal gets a haptic on devices that support it (Android):
      // celebratory for a strong run, a light tick otherwise.
      if (s === 'complete' && previous === 'active') {
        const finishedByGuidedTimer =
          props.guidedPractice !== undefined && guidedTimerCompletionPending
        const completedTimedGuidedRun =
          finishedByGuidedTimer && props.guidedCompletionReady?.() === true
        setLastGuidedRunCompleted(completedTimedGuidedRun)
        setGuidedRunNeedsEvidence(
          finishedByGuidedTimer && !completedTimedGuidedRun,
        )
        if (completedTimedGuidedRun) {
          const total = guidedTotalRepetitions()
          setGuidedCompletedRepetitions((completed) =>
            total === null ? completed + 1 : Math.min(total, completed + 1),
          )
        }
        guidedTimerCompletionPending = false
        const score = props.resultScore()
        if (
          props.guidedPractice === undefined &&
          score !== null &&
          score >= 80
        ) {
          haptics.success()
        } else {
          haptics.tapLight()
        }
        // Snapshot the contour for the result card. The trace seam is global
        // and holds whatever ran last, so the type check keeps a previous
        // drill's shape from being shown under this one's score.
        const trace = lastRunTrace()
        setRunTrace(trace?.type === props.type ? trace : null)
        if (props.guidedPractice !== undefined) {
          guidedResultFocusTimer = setTimeout(() => {
            guidedResultCard?.focus()
          }, 0)
        }
      }
      if (s === 'active') setRunTrace(null)
    }),
  )
  const isNewBest = () => {
    if (props.guidedPractice !== undefined) return false
    const score = props.resultScore()
    if (score === null) return false
    const best = prevBest()
    return best !== null && score > best
  }
  const deltaVsLast = () => {
    if (props.guidedPractice !== undefined) return null
    const score = props.resultScore()
    const last = prevLast()
    if (score === null || last === null) return null
    return score - last
  }

  function keepVoiceTake(): void {
    const take = props.voiceCapture?.take()
    const exerciseTitle = props.title
    if (take === null || take === undefined) return
    setVoiceKeepState('saving')
    trackEvent('voice_keep_attempt')
    const generation = voiceKeepGeneration

    void (async () => {
      try {
        const result = await keepExerciseVoiceTake({ exerciseTitle, take })
        if (result.ok) {
          if (generation === voiceKeepGeneration) setVoiceKeepState('saved')
          trackEvent('voice_keep_success')
          showNotification(
            'Exercise take kept in Hear Yourself on this device.',
            'success',
            { channel: 'voice-take-save' },
          )
          return
        }

        if (generation === voiceKeepGeneration) setVoiceKeepState('error')
        trackEvent('voice_keep_failure')
        if (result.quotaExceeded || !result.roomAvailable) {
          trackEvent('voice_storage_warning')
          showNotification(
            'This device is too low on browser storage to keep the take. Export or clear space, then retry.',
            'warning',
            { channel: 'voice-take-save' },
          )
        } else {
          showNotification(
            'The take could not be kept. Its temporary copy remains until you retry or leave this exercise.',
            'error',
            { channel: 'voice-take-save' },
          )
        }
      } catch {
        if (generation === voiceKeepGeneration) setVoiceKeepState('error')
        trackEvent('voice_keep_failure')
        showNotification(
          'The take could not be kept. Its temporary copy remains until you retry or leave this exercise.',
          'error',
          { channel: 'voice-take-save' },
        )
      }
    })()
  }

  function tryAgain(): void {
    voiceKeepGeneration += 1
    setVoiceKeepState('idle')
    props.onTryAgain()
  }

  function activateIdlePrimary(): void {
    if (!isComplete()) {
      props.onStart()
      return
    }
    if (guidedDoseComplete() || guidedStopReason() === 'discomfort') {
      props.onBack()
      return
    }
    if (
      props.guidedPractice !== undefined &&
      !lastGuidedRunCompleted() &&
      !guidedRunNeedsEvidence() &&
      guidedStopReason() === null
    ) {
      return
    }
    tryAgain()
  }

  const idlePrimaryLabel = (): string => {
    if (!isComplete()) return props.startLabel ?? 'Start'
    if (guidedDoseComplete() || guidedStopReason() === 'discomfort') {
      return 'Return to Focus reading'
    }
    const total = guidedTotalRepetitions()
    if (props.guidedPractice !== undefined && total !== null) {
      const next = Math.min(total, guidedCompletedRepetitions() + 1)
      return lastGuidedRunCompleted()
        ? `Next hold · ${next} of ${total}`
        : `Retry hold · ${next} of ${total}`
    }
    return 'Try Again'
  }

  function reportGuidedDiscomfort(): void {
    if (props.guidedPractice === undefined) return
    voiceKeepGeneration += 1
    props.voiceCapture?.discard()
    setVoiceKeepState('idle')
    setGuidedStopReason('discomfort')
    queueMicrotask(() => guidedResultCard?.focus())
  }

  function reportGuidedPause(): void {
    if (props.guidedPractice === undefined) return
    setGuidedStopReason('paused')
    queueMicrotask(() => guidedResultCard?.focus())
  }

  function discardVoiceTake(): void {
    props.voiceCapture?.discard()
    setVoiceKeepState('idle')
  }

  // ── Mic toggle (header) ──
  // The mic is normally started by the exercise on Start, but a header toggle
  // lets the singer turn it on early to check input (the button shows a live
  // level fill) and off when done. Reads the shared engine so no per-exercise
  // wiring is needed; the exercise reuses an already-on mic when it starts.
  // useContext (not useEngines) so the shell still renders without an
  // EngineProvider, e.g. in unit tests — the mic button is simply omitted then.
  const engines = useContext(EngineContext)
  const practiceEngine = engines?.practiceEngine ?? null
  const [micOn, setMicOn] = createSignal(practiceEngine?.isMicActive() ?? false)
  onMount(() => {
    if (!practiceEngine) return
    const id = setInterval(() => setMicOn(practiceEngine.isMicActive()), 200)
    onCleanup(() => clearInterval(id))
  })
  const toggleMic = (): void => {
    if (!practiceEngine) return
    if (practiceEngine.isMicActive()) {
      practiceEngine.stopMic()
      setMicOn(false)
    } else {
      void practiceEngine.startMic()
      setMicOn(true)
    }
  }

  // ── Routine mic hold ──
  // A routine is a sequence, but each drill opens and closes the device on its
  // own, so the singer paid a fresh getUserMedia between every segment. Taking
  // a routine-scoped hold once a routine run is genuinely under way keeps the
  // mic open across the gap; the hold expires on its own, so nothing here can
  // leave it on. See routine-mic-hold.ts for why it never opens the device.
  const routine = useDailyRoutine()
  const runsCurrentSegment = (): boolean => {
    const seg = routine.currentSegment()
    return seg !== null && segmentRunsExercise(seg, props.type)
  }
  // ── Rep-aware relaunch ──
  // A multi-rep segment parks the singer on the result screen between runs,
  // where "Try Again" is the wrong verb: the routine asked for five runs and
  // this is simply the next one. Non-null exactly while banked runs remain
  // below the segment's ask — so run one still reads "Start", and the last
  // run's result reads "Try Again" like any finished drill.
  const repRun = createMemo(() => {
    if (!runsCurrentSegment()) return null
    const reps = routine.currentSegmentReps()
    const banked = routine.currentSegmentRuns()
    return reps > 1 && banked > 0 && banked < reps
      ? { next: banked + 1, reps }
      : null
  })
  createEffect(
    on(status, (s) => {
      if (s === 'active' && runsCurrentSegment()) holdMicForRoutine()
      // The last segment is done: there is no next drill to bridge to, and a
      // mic still open on the results screen is just a light left on.
      if (routine.isComplete()) releaseRoutineMicHold()
    }),
  )

  // ── Auto-timer: count down once the run is active, then auto-stop ──
  let timerHandle: ReturnType<typeof setInterval> | undefined
  const clearTimer = (): void => {
    if (timerHandle) clearInterval(timerHandle)
    timerHandle = undefined
  }
  // Arm only on the 'active' transition so the autoStart path and the
  // transient 'count-in' state never trigger a premature stop.
  const effectiveTimerSeconds = createMemo(
    () => guidedDurationSeconds() ?? activeTimerSeconds(),
  )
  createEffect(
    on([status, effectiveTimerSeconds], ([statusValue, seconds]) => {
      clearTimer()
      if (!props.autoTimer || statusValue !== 'active' || seconds === null) {
        return
      }
      const end = performance.now() + seconds * 1000
      setRemainingMs(seconds * 1000)
      timerHandle = setInterval(() => {
        const rem = end - performance.now()
        if (rem <= 0) {
          clearTimer()
          setRemainingMs(0)
          if (props.guidedPractice !== undefined) {
            guidedTimerCompletionPending = true
          }
          props.autoTimer!.onElapse()
        } else {
          setRemainingMs(rem)
        }
      }, 100)
    }),
  )
  onCleanup(() => {
    clearTimer()
    clearTimeout(guidedResultFocusTimer)
  })

  // Spacebar starts/stops the exercise (and restarts from the result screen),
  // ignoring presses while a text/form control is focused so it doesn't
  // hijack note pickers, selects, or typing. Buttons deliberately DON'T
  // opt out: after clicking Start (or any control) focus rests on that
  // button, and users expect Space to keep toggling the exercise — the
  // preventDefault below suppresses the native button re-activation, so
  // there's no double-trigger.
  onMount(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== ' ' && e.code !== 'Space') return
      // Ignore auto-repeat: holding Space would otherwise cycle
      // stop → try-again → stop… and log several spurious completed runs.
      if (e.repeat) return
      const el = e.target as HTMLElement | null
      const tag = el?.tagName
      if (
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT' ||
        el?.isContentEditable === true
      ) {
        return
      }
      const s = status()
      if (s === 'idle') {
        e.preventDefault()
        props.onStart()
      } else if (s === 'active') {
        e.preventDefault()
        props.onStop()
      } else if (s === 'complete') {
        e.preventDefault()
        activateIdlePrimary()
      }
    }
    window.addEventListener('keydown', onKey)
    onCleanup(() => window.removeEventListener('keydown', onKey))
  })

  const timerPresets = (): number[] =>
    props.autoTimer?.presets ?? [...TIMER_PRESETS]

  const chooseCustom = (): void => {
    setTimerMode('custom')
    setCustomOpen(true)
  }

  const TimerToggle = (): JSX.Element => (
    <div class="exercise-timer-field">
      <div
        class="exercise-timer-toggle"
        role="group"
        aria-label="Auto-score timer"
      >
        <button
          type="button"
          class="exercise-timer-segment"
          classList={{ active: timerMode() === 'manual' }}
          onClick={() => {
            setTimerMode('manual')
            setCustomOpen(false)
          }}
          title="No timer — you press Stop"
        >
          Manual
        </button>
        <For each={timerPresets()}>
          {(sec) => (
            <button
              type="button"
              class="exercise-timer-segment"
              classList={{ active: timerMode() === sec }}
              onClick={() => {
                setTimerMode(sec)
                setCustomOpen(false)
              }}
            >
              {sec}s
            </button>
          )}
        </For>
        <button
          type="button"
          class="exercise-timer-segment"
          classList={{ active: timerMode() === 'custom' }}
          aria-expanded={customOpen()}
          onClick={() =>
            timerMode() === 'custom'
              ? setCustomOpen((open) => !open)
              : chooseCustom()
          }
          title="Pick any length between the presets"
        >
          {timerMode() === 'custom' ? `${customTimerSeconds()}s` : 'Custom'}
        </button>
      </div>

      {/* The slider only exists while Custom is the chosen mode: a length
          nothing is going to use is a control that lies about what happens
          when the singer presses Start. */}
      <Show when={timerMode() === 'custom' && customOpen()}>
        <label class="exercise-timer-custom">
          <input
            type="range"
            min={CUSTOM_MIN_SEC}
            max={CUSTOM_MAX_SEC}
            step={CUSTOM_STEP_SEC}
            value={customTimerSeconds()}
            aria-label="Custom run length in seconds"
            onInput={(event) =>
              setCustomTimerSeconds(Number(event.currentTarget.value))
            }
          />
          <output class="exercise-timer-custom-value">
            {formatRunLength(customTimerSeconds())}
          </output>
        </label>
      </Show>
    </div>
  )

  const guidedDoseLabel = createMemo(() => {
    const parts: string[] = []
    const sets = guidedSets()
    const repetitions = guidedRepetitions()
    const seconds = guidedDurationSeconds()
    if (sets !== null) parts.push(`${sets} ${sets === 1 ? 'set' : 'sets'}`)
    if (repetitions !== null) {
      parts.push(`${repetitions} ${repetitions === 1 ? 'hold' : 'holds'}`)
    }
    if (seconds !== null) parts.push(`${formatRunLength(seconds)} each`)
    return parts.join(' · ')
  })

  const guidedProgressCopy = (): string => {
    if (guidedStopReason() === 'discomfort') return 'Dose ended'
    const total = guidedTotalRepetitions()
    if (total === null) return 'Reviewed bounded dose'
    if (isActive()) {
      return `Hold ${Math.min(total, guidedCompletedRepetitions() + 1)} of ${total}`
    }
    if (isComplete() && !lastGuidedRunCompleted()) {
      if (guidedRunNeedsEvidence()) {
        return `Hold ${Math.min(total, guidedCompletedRepetitions() + 1)} of ${total} needs another try`
      }
      return `Hold ${Math.min(total, guidedCompletedRepetitions() + 1)} of ${total} paused`
    }
    if (guidedDoseComplete()) return 'Guided dose complete'
    return `${guidedCompletedRepetitions()} of ${total} holds complete`
  }

  const guidedStopRuleCopy = (): string =>
    props.guidedPractice?.stopRuleId === 'guided.stop-on-discomfort-v1'
      ? 'Stop immediately if anything feels uncomfortable.'
      : 'Stop this guided set if anything feels uncomfortable.'

  return (
    <div class="exercise-runner">
      <div class="exercise-runner-header">
        <div class="exercise-header-left">
          <button class="back-btn" onClick={() => props.onBack()}>
            ← Back
          </button>
          <button
            class="exercise-help-btn"
            classList={{ active: helpOpen() }}
            aria-label="What is this exercise?"
            aria-expanded={helpOpen()}
            onClick={() => setHelpOpen((v) => !v)}
          >
            <IconQuestion size={18} />
          </button>
        </div>
        {/* The title shares the header row on a phone and ellipsises when
            it has to; the attribute keeps the full name reachable. */}
        <div class="exercise-header-title">
          <Show when={props.icon}>
            <span class="exercise-title-icon" aria-hidden="true">
              {props.icon}
            </span>
          </Show>
          <h2 class="exercise-title" title={props.title}>
            {props.title}
          </h2>
        </div>
        <div class="exercise-header-right">
          <span
            class="exercise-level-chip"
            title="Adaptive difficulty level (1-10) — adjusts to your recent scores"
          >
            {props.guidedPractice === undefined
              ? `Lv ${getDifficulty(props.type)}`
              : 'Guided'}
          </span>
          <Show when={engines}>
            <MicButton active={micOn()} onClick={toggleMic} />
          </Show>
          <Show when={props.guidedPractice === undefined}>
            <span class="exercise-score-display">
              {isActive() ? `${Math.round(props.currentScore())}%` : '—'}
            </span>
          </Show>
        </div>
      </div>

      <Show when={helpOpen()}>
        <div class="exercise-help-panel">
          <p class="exercise-help-summary">{help().summary}</p>
          <For each={help().body}>{(para) => <p>{para}</p>}</For>
        </div>
      </Show>

      {/* Renders itself only when this drill IS a segment of today's routine.
          Every exercise gets it for free by living in the shell — the
          alternative was 18 components each remembering to ask. */}
      <RoutineRibbon
        type={props.type}
        isRunning={() => status() === 'active' || status() === 'count-in'}
        isComplete={isComplete}
        onRunAgain={() => props.onTryAgain()}
      />

      <Show when={props.guidedPractice !== undefined}>
        <aside
          class="exercise-guided-dose"
          aria-label="Guided practice dose"
          aria-live="polite"
          aria-atomic="true"
        >
          <div class="exercise-guided-dose-heading">
            <span>Focus practice</span>
            <strong>{guidedProgressCopy()}</strong>
          </div>
          <p>{guidedDoseLabel()}</p>
          <small>{guidedStopRuleCopy()}</small>
        </aside>
      </Show>

      <div
        class="exercise-canvas-area"
        classList={{ 'is-idle': isIdleLike(), 'is-active': isActive() }}
      >
        <Show when={isIdleLike()}>
          <Show when={props.guidedPractice === undefined}>
            <ExerciseScoreHistory type={props.type} />
          </Show>
          {/* Description + settings + Start live together in the centre of the
              panel before the run; they slide out of view once it's active. A
              finished run returns here with the score now in the corner chip. */}
          <div class="exercise-idle-center">
            <Show when={isComplete() && props.resultScore() !== null}>
              {/* Between runs of a multi-rep segment the card stays compact:
                  no contour, no pop-in. The trace is analysis, and mid-rep
                  the singer needs pace — the full card returns on the
                  segment's last run and everywhere outside routines. */}
              <div
                ref={guidedResultCard}
                class="exercise-result-card"
                classList={{
                  [`grade-${gradeForScore(props.resultScore()!).toLowerCase()}`]:
                    props.guidedPractice === undefined,
                  'mid-reps': repRun() !== null,
                  'is-guided': props.guidedPractice !== undefined,
                }}
                role={props.guidedPractice === undefined ? undefined : 'status'}
                aria-live={
                  props.guidedPractice === undefined ? undefined : 'polite'
                }
                tabIndex={props.guidedPractice === undefined ? undefined : -1}
              >
                <Show when={props.guidedPractice === undefined}>
                  <div class="exercise-result-grade">
                    {gradeForScore(props.resultScore()!)}
                  </div>
                </Show>
                <div class="exercise-result-main">
                  <Show
                    when={props.guidedPractice === undefined}
                    fallback={
                      <div class="exercise-guided-result-title">
                        {guidedStopReason() === 'discomfort'
                          ? 'Stopped for comfort'
                          : lastGuidedRunCompleted()
                            ? 'Hold complete'
                            : guidedRunNeedsEvidence()
                              ? 'Hold needs another try'
                              : 'Hold paused'}
                      </div>
                    }
                  >
                    <div class="exercise-result-score">
                      {props.resultScore()}%
                      <Show when={isNewBest()}>
                        <span class="exercise-result-best">New best!</span>
                      </Show>
                      <Show
                        when={
                          !isNewBest() &&
                          deltaVsLast() !== null &&
                          deltaVsLast() !== 0
                        }
                      >
                        <span
                          class="exercise-result-delta"
                          classList={{ up: (deltaVsLast() ?? 0) > 0 }}
                        >
                          {(deltaVsLast() ?? 0) > 0 ? '+' : ''}
                          {deltaVsLast()} vs last
                        </span>
                      </Show>
                    </div>
                  </Show>
                  <Show
                    when={guidedStopReason() !== 'discomfort'}
                    fallback={
                      <p class="exercise-guided-stop-copy">
                        End this dose for today. No further hold is suggested.
                      </p>
                    }
                  >
                    <Show
                      when={!guidedRunNeedsEvidence()}
                      fallback={
                        <p class="exercise-guided-stop-copy">
                          We did not hear enough sustained voice to count this
                          hold. Check the microphone, then try the same hold
                          again.
                        </p>
                      }
                    >
                      <div class="exercise-result-summary">
                        {props.resultSummary}
                      </div>
                    </Show>
                  </Show>
                  {/* The score says how well; the contour says where. */}
                  <Show
                    when={
                      repRun() === null &&
                      guidedStopReason() !== 'discomfort' &&
                      !guidedRunNeedsEvidence()
                        ? runTrace()
                        : null
                    }
                  >
                    {(trace) => <RunTraceCanvas trace={trace()} />}
                  </Show>
                </div>
                <Show
                  when={
                    props.voiceCapture !== undefined &&
                    guidedStopReason() !== 'discomfort' &&
                    !guidedRunNeedsEvidence()
                  }
                >
                  <div class="exercise-result-voice">
                    <div class="exercise-result-voice-copy">
                      <strong>{voiceCaptureHeading()}</strong>
                      <span role="status" aria-live="polite">
                        {voiceKeepState() === 'saving'
                          ? 'Saving locally…'
                          : voiceKeepState() === 'saved'
                            ? 'Available in Hear Yourself on this device.'
                            : voiceKeepState() === 'error'
                              ? 'Could not keep it. The temporary replay is still available.'
                              : props.voiceCapture!.state() === 'processing'
                                ? 'Preparing the temporary local replay…'
                                : props.voiceCapture!.state() === 'ready'
                                  ? 'It stays temporary unless you explicitly keep it on this device.'
                                  : props.voiceCapture!.state() ===
                                      'unsupported'
                                    ? 'This browser can score the run but cannot record a replay.'
                                    : props.voiceCapture!.state() === 'error'
                                      ? 'No replay was captured. Your score is unchanged.'
                                      : 'Replay discarded. Your score is unchanged.'}
                      </span>
                    </div>
                    <Show
                      when={
                        props.voiceCapture!.state() === 'ready' ||
                        voiceKeepState() === 'saving' ||
                        voiceKeepState() === 'saved' ||
                        voiceKeepState() === 'error'
                      }
                    >
                      <div class="exercise-result-voice-actions">
                        <button
                          type="button"
                          class="exercise-btn exercise-keep-voice"
                          disabled={
                            voiceKeepState() === 'saving' ||
                            voiceKeepState() === 'saved'
                          }
                          onClick={keepVoiceTake}
                        >
                          {voiceKeepState() === 'saving'
                            ? 'Saving'
                            : voiceKeepState() === 'saved'
                              ? 'Kept'
                              : voiceKeepState() === 'error'
                                ? 'Retry Keep'
                                : 'Keep Take'}
                        </button>
                        <Show when={voiceKeepState() !== 'saved'}>
                          <button
                            type="button"
                            class="exercise-btn exercise-discard-voice"
                            onClick={discardVoiceTake}
                          >
                            Discard
                          </button>
                        </Show>
                      </div>
                    </Show>
                  </div>
                </Show>
              </div>
            </Show>
            <Show
              when={props.idlePlaceholder}
              fallback={
                <div class="exercise-idle-placeholder">
                  <p>{help().summary}</p>
                </div>
              }
            >
              {props.idlePlaceholder}
            </Show>
            {/* Two groups, not one column of five.
                The setup — a dial, a scale picker — is the part that needs
                room and the part a singer studies. The launch — how long, and
                go — is a decision made in a second and then never looked at
                again. Stacked, the second pushed the first off a short screen
                and the panel spent five rows saying what two can. Given width
                they sit beside each other; a phone keeps the stack, since it
                has height to spend and none to give sideways. */}
            <div class="exercise-idle-body">
              <Show when={props.idleSettings}>
                <div class="exercise-idle-setup">
                  {/* Heavy setups (settingsSheetLabel set) move into a bottom
                      sheet on phones so Start stays above the fold; inline
                      everywhere else. useSettingsSheet is false on desktop. */}
                  <Show when={useSettingsSheet()} fallback={props.idleSettings}>
                    <button
                      type="button"
                      class="exercise-btn exercise-settings-trigger"
                      onClick={() => setSettingsSheetOpen(true)}
                    >
                      {props.settingsSheetLabel}
                    </button>
                    <OptionsSheet
                      isOpen={settingsSheetOpen()}
                      close={() => setSettingsSheetOpen(false)}
                      ariaLabel={props.settingsSheetLabel ?? 'Settings'}
                    >
                      {props.idleSettings}
                    </OptionsSheet>
                  </Show>
                </div>
              </Show>
              <div class="exercise-idle-launch">
                <Show
                  when={props.autoTimer && props.guidedPractice === undefined}
                >
                  <TimerToggle />
                </Show>
                <Show when={props.error?.() != null}>
                  <div class="exercise-error">{props.error!()}</div>
                </Show>
                <Show when={!isComplete() && props.voiceCapture !== undefined}>
                  <p class="exercise-capture-note">
                    Scores save without audio. After the run, choose whether to
                    keep its temporary local replay.
                  </p>
                </Show>
                <Show
                  when={
                    props.guidedPractice !== undefined &&
                    isComplete() &&
                    !lastGuidedRunCompleted() &&
                    !guidedRunNeedsEvidence() &&
                    guidedStopReason() === null
                  }
                >
                  <div
                    class="exercise-guided-stop-question"
                    role="group"
                    aria-label="How did stopping feel?"
                  >
                    <span>How did stopping feel?</span>
                    <button
                      type="button"
                      class="exercise-btn exercise-guided-pause"
                      onClick={reportGuidedPause}
                    >
                      It felt fine; I just paused
                    </button>
                    <button
                      type="button"
                      class="exercise-btn exercise-guided-discomfort"
                      onClick={reportGuidedDiscomfort}
                    >
                      It felt uncomfortable
                    </button>
                  </div>
                </Show>
                <Show
                  when={
                    !(
                      props.guidedPractice !== undefined &&
                      isComplete() &&
                      !lastGuidedRunCompleted() &&
                      !guidedRunNeedsEvidence() &&
                      guidedStopReason() === null
                    )
                  }
                >
                  <button
                    class="exercise-btn exercise-btn-primary exercise-idle-start"
                    onClick={activateIdlePrimary}
                  >
                    {idlePrimaryLabel()}
                  </button>
                </Show>
              </div>
            </div>
          </div>
        </Show>

        {/* The stage exists so the run has exactly two boxes — the tracker and
            whatever the exercise draws — instead of the tracker plus however
            many top-level elements an exercise's fragment happens to spread
            into the card. Two boxes can be put side by side; a variable number
            of siblings cannot.

            It is also the scroll container now. It used to be the card, which
            is the Stop button's positioned ancestor, so `bottom: 14px` pinned
            Stop to the bottom of the SCROLLED CONTENT rather than the bottom
            of the card: on a short screen it drifted up over the exercise's
            own visuals and then off the bottom entirely. Scrolling in here
            leaves Stop anchored to the card where it belongs. */}
        <Show when={isActive()}>
          {/* Above the stage, not inside it. The instruction speaks for the
              whole run — both the tracker and the drill's own visual — so it
              spans both of them and stays centred whether they are stacked or
              side by side. Inside the drill's column it was squeezed into the
              narrow half, captioning the thing it was standing next to. It is
              also outside the scroll, since an instruction you have to scroll
              to is not an instruction. */}
          <Show when={props.activePhase}>
            <div class="exercise-active-phase">{props.activePhase}</div>
          </Show>
          <div class="exercise-active-stage">
            <Show when={props.tracker}>
              {(tracker) => (
                <Show when={tracker().when?.() ?? true}>
                  <ExercisePitchTracker
                    pitchHistory={tracker().pitchHistory}
                    isActive={isActive}
                    targetNoteMidi={tracker().targetNoteMidi}
                    movingTarget={tracker().movingTarget}
                    upcomingTargets={tracker().upcomingTargets}
                  />
                </Show>
              )}
            </Show>
            <div class="exercise-active-content">{props.activeContent}</div>
          </div>
          <Show when={props.activeFooter}>
            <div class="exercise-active-footer">{props.activeFooter}</div>
          </Show>
        </Show>

        {/* Stop lives inside the exercise card, right under the action —
            it used to sit detached at the page bottom in a plain-text
            style (the secondary button's background var was undefined). */}
        <Show when={isActive()}>
          <div class="exercise-active-controls">
            <Show when={props.autoTimer && effectiveTimerSeconds() !== null}>
              <span class="exercise-timer-countdown">
                {Math.ceil(remainingMs() / 1000)}s
              </span>
            </Show>
            <button
              class="exercise-btn exercise-btn-stop"
              aria-label={props.stopLabel ?? 'Stop & Score'}
              title={props.stopLabel ?? 'Stop & Score'}
              onClick={() => props.onStop()}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
              >
                <rect x="6" y="6" width="12" height="12" rx="2" />
              </svg>
            </button>
          </div>
        </Show>
      </div>
    </div>
  )
}
