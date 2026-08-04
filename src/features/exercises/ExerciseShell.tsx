// ============================================================
// ExerciseShell — shared chrome for every exercise runner
// ============================================================
//
// Owns the layout that used to be duplicated across all 18 exercise
// components: the header (back, "?" help toggle, title, score), the
// collapsible beginner help panel, the idle area (settings + description +
// Start beneath it), the active area (content + Stop + optional auto-timer),
// and the complete overlay with a SINGLE primary action. Exercise-specific
// JSX is passed in via slots so each component only supplies its canvas,
// metrics, idle placeholder and result summary.

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
import { haptics } from '@/lib/haptics'
import { isNarrow } from '@/lib/use-viewport'
import { getExerciseStats } from '@/stores/exercise-history-store'
import { EXERCISE_HELP } from './exercise-help'
import { ExerciseScoreHistory } from './ExerciseScoreHistory'
import { gradeForScore } from './feedback'
import type { RunTrace } from './last-run-trace'
import { lastRunTrace } from './last-run-trace'
import { RunTraceCanvas } from './RunTraceCanvas'
import { activeTimerSeconds, CUSTOM_MAX_SEC, CUSTOM_MIN_SEC, CUSTOM_STEP_SEC, customTimerSeconds, setCustomTimerSeconds, setTimerMode, TIMER_PRESETS, timerMode, } from './timer-preference'
import type { ExerciseStatus, ExerciseType } from './types'

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
  status: () => ExerciseStatus
  /** Live score 0-100 (shown in the header during a run). */
  currentScore: () => number
  /** Final score 0-100 once complete (drives the result overlay color). */
  resultScore: () => number | null
  error?: () => string | null
  onBack: () => void

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

  activeContent: JSX.Element
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
  const [remainingMs, setRemainingMs] = createSignal(0)
  // Opens the slider. Sticky while Custom is the selected mode so the value
  // stays adjustable between runs, rather than collapsing after every pick.
  const [customOpen, setCustomOpen] = createSignal(false)

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
  createEffect(
    on(status, (s, previous) => {
      if (s === 'active' && previous !== 'active') {
        const stats = getExerciseStats(props.type)
        setPrevBest(stats.totalPlays > 0 ? stats.bestScore : null)
        setPrevLast(stats.totalPlays > 0 ? stats.lastScore : null)
      }
      // Score reveal gets a haptic on devices that support it (Android):
      // celebratory for a strong run, a light tick otherwise.
      if (s === 'complete' && previous === 'active') {
        const score = props.resultScore()
        if (score !== null && score >= 80) haptics.success()
        else haptics.tapLight()
        // Snapshot the contour for the result card. The trace seam is global
        // and holds whatever ran last, so the type check keeps a previous
        // drill's shape from being shown under this one's score.
        const trace = lastRunTrace()
        setRunTrace(trace?.type === props.type ? trace : null)
      }
      if (s === 'active') setRunTrace(null)
    }),
  )
  const isNewBest = () => {
    const score = props.resultScore()
    if (score === null) return false
    const best = prevBest()
    return best !== null && score > best
  }
  const deltaVsLast = () => {
    const score = props.resultScore()
    const last = prevLast()
    if (score === null || last === null) return null
    return score - last
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
  createEffect(
    on([status, activeTimerSeconds], ([statusValue, seconds]) => {
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
          props.autoTimer!.onElapse()
        } else {
          setRemainingMs(rem)
        }
      }, 100)
    }),
  )
  onCleanup(clearTimer)

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
        props.onTryAgain()
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
        <h2 class="exercise-title" title={props.title}>
          {props.title}
        </h2>
        <div class="exercise-header-right">
          <span
            class="exercise-level-chip"
            title="Adaptive difficulty level (1-10) — adjusts to your recent scores"
          >
            Lv {getDifficulty(props.type)}
          </span>
          <Show when={engines}>
            <MicButton active={micOn()} onClick={toggleMic} />
          </Show>
          <span class="exercise-score-display">
            {isActive() ? `${Math.round(props.currentScore())}%` : '—'}
          </span>
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
      />

      <div
        class="exercise-canvas-area"
        classList={{ 'is-idle': isIdleLike(), 'is-active': isActive() }}
      >
        <Show when={isIdleLike()}>
          <ExerciseScoreHistory type={props.type} />
          {/* Description + settings + Start live together in the centre of the
              panel before the run; they slide out of view once it's active. A
              finished run returns here with the score now in the corner chip. */}
          <div class="exercise-idle-center">
            <Show when={isComplete() && props.resultScore() !== null}>
              <div
                class={`exercise-result-card grade-${gradeForScore(props.resultScore()!).toLowerCase()}`}
              >
                <div class="exercise-result-grade">
                  {gradeForScore(props.resultScore()!)}
                </div>
                <div class="exercise-result-main">
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
                  <div class="exercise-result-summary">
                    {props.resultSummary}
                  </div>
                  {/* The score says how well; the contour says where. */}
                  <Show when={runTrace()}>
                    {(trace) => <RunTraceCanvas trace={trace()} />}
                  </Show>
                </div>
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
            <div class="exercise-idle-controls">
              <Show when={props.idleSettings}>
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
              </Show>
              <Show when={props.autoTimer}>
                <TimerToggle />
              </Show>
              <Show when={props.error?.() != null}>
                <div class="exercise-error">{props.error!()}</div>
              </Show>
              <button
                class="exercise-btn exercise-btn-primary exercise-idle-start"
                onClick={() =>
                  isComplete() ? props.onTryAgain() : props.onStart()
                }
              >
                {isComplete() ? 'Try Again' : (props.startLabel ?? 'Start')}
              </button>
            </div>
          </div>
        </Show>

        <Show when={isActive()}>
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
          {props.activeContent}
        </Show>

        {/* Stop lives inside the exercise card, right under the action —
            it used to sit detached at the page bottom in a plain-text
            style (the secondary button's background var was undefined). */}
        <Show when={isActive()}>
          <div class="exercise-active-controls">
            <Show when={props.autoTimer && activeTimerSeconds() !== null}>
              <span class="exercise-timer-countdown">
                {Math.ceil(remainingMs() / 1000)}s
              </span>
            </Show>
            <button
              class="exercise-btn exercise-btn-stop"
              aria-label={props.stopLabel ?? 'Stop & Score'}
              onClick={() => props.onStop()}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
              >
                <rect x="6" y="6" width="12" height="12" rx="2" />
              </svg>
              <span class="exercise-btn-stop-label">
                {props.stopLabel ?? 'Stop & Score'}
              </span>
            </button>
          </div>
        </Show>
      </div>
    </div>
  )
}
