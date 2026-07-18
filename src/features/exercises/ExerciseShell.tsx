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
import { MicButton } from '@/components/MicButton'
import { OptionsSheet } from '@/components/mobile/OptionsSheet'
import { EngineContext } from '@/contexts/EngineContext'
import { getDifficulty } from '@/features/practice-intelligence/difficulty-store'
import { haptics } from '@/lib/haptics'
import { isNarrow } from '@/lib/use-viewport'
import { getExerciseStats } from '@/stores/exercise-history-store'
import { EXERCISE_HELP } from './exercise-help'
import { ExerciseScoreHistory } from './ExerciseScoreHistory'
import { gradeForScore } from './feedback'
import type { ExerciseStatus, ExerciseType } from './types'

export interface AutoTimerConfig {
  /** Preset durations (seconds) offered alongside "Manual". */
  presets: number[]
  /** Called when the timer elapses — wire to the exercise's stop/score. */
  onElapse: () => void
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

export const ExerciseShell: Component<ExerciseShellProps> = (props) => {
  const [helpOpen, setHelpOpen] = createSignal(false)
  // 'manual' | seconds
  const [timerMode, setTimerMode] = createSignal<'manual' | number>('manual')
  const [remainingMs, setRemainingMs] = createSignal(0)

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
      }
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

  // ── Auto-timer: count down once the run is active, then auto-stop ──
  let timerHandle: ReturnType<typeof setInterval> | undefined
  const clearTimer = (): void => {
    if (timerHandle) clearInterval(timerHandle)
    timerHandle = undefined
  }
  // Arm only on the 'active' transition so the autoStart path and the
  // transient 'count-in' state never trigger a premature stop.
  createEffect(
    on([status, timerMode], ([statusValue, mode]) => {
      clearTimer()
      if (
        !props.autoTimer ||
        statusValue !== 'active' ||
        typeof mode !== 'number'
      ) {
        return
      }
      const end = performance.now() + mode * 1000
      setRemainingMs(mode * 1000)
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
  // ignoring presses while a form control or button is focused so it doesn't
  // hijack note pickers, selects, or typing.
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
        tag === 'BUTTON' ||
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

  const TimerToggle = (): JSX.Element => (
    <div
      class="exercise-timer-toggle"
      role="group"
      aria-label="Auto-score timer"
    >
      <button
        type="button"
        class="exercise-timer-segment"
        classList={{ active: timerMode() === 'manual' }}
        onClick={() => setTimerMode('manual')}
      >
        Manual
      </button>
      <For each={props.autoTimer!.presets}>
        {(sec) => (
          <button
            type="button"
            class="exercise-timer-segment"
            classList={{ active: timerMode() === sec }}
            onClick={() => setTimerMode(sec)}
          >
            {sec}s
          </button>
        )}
      </For>
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
        <h2 class="exercise-title">{props.title}</h2>
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

        <Show when={isActive()}>{props.activeContent}</Show>

        {/* Stop lives inside the exercise card, right under the action —
            it used to sit detached at the page bottom in a plain-text
            style (the secondary button's background var was undefined). */}
        <Show when={isActive()}>
          <div class="exercise-active-controls">
            <Show when={props.autoTimer && typeof timerMode() === 'number'}>
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
