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
import { createEffect, createSignal, For, on, onCleanup, Show } from 'solid-js'
import { IconQuestion } from '@/components/exercise-icons'
import { EXERCISE_HELP } from './exercise-help'
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

  const help = () => EXERCISE_HELP[props.type]
  const isIdle = () => props.status() === 'idle'
  const isActive = () => props.status() === 'active'
  const isComplete = () => props.status() === 'complete'

  const scoreClass = (): string => {
    const s = props.resultScore() ?? 0
    if (s >= 80) return 'exercise-result-score-good'
    if (s >= 50) return 'exercise-result-score-ok'
    return 'exercise-result-score-poor'
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
    on([() => props.status(), timerMode], ([status, mode]) => {
      clearTimer()
      if (!props.autoTimer || status !== 'active' || typeof mode !== 'number') {
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
        <span class="exercise-score-display">
          {isIdle() ? '—' : `${Math.round(props.currentScore())}%`}
        </span>
      </div>

      <Show when={helpOpen()}>
        <div class="exercise-help-panel">
          <p class="exercise-help-summary">{help().summary}</p>
          <For each={help().body}>{(para) => <p>{para}</p>}</For>
        </div>
      </Show>

      <div class="exercise-canvas-area">
        <Show when={isIdle()}>
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
        </Show>

        <Show when={isActive()}>{props.activeContent}</Show>

        <Show when={isComplete() && props.resultScore() != null}>
          <div class="exercise-result-overlay">
            <div class={`exercise-result-score ${scoreClass()}`}>
              {props.resultScore()}%
            </div>
            <div class="exercise-result-label">{props.resultSummary}</div>
            <button
              class="exercise-btn exercise-btn-primary"
              onClick={() => props.onTryAgain()}
            >
              Try Again
            </button>
          </div>
        </Show>
      </div>

      <div class="exercise-controls">
        <Show when={isIdle()}>
          <div class="exercise-idle-controls">
            <Show when={props.idleSettings}>{props.idleSettings}</Show>
            <Show when={props.autoTimer}>
              <TimerToggle />
            </Show>
            <Show when={props.error?.() != null}>
              <div class="exercise-error">{props.error!()}</div>
            </Show>
            <button
              class="exercise-btn exercise-btn-primary exercise-idle-start"
              onClick={() => props.onStart()}
            >
              {props.startLabel ?? 'Start'}
            </button>
          </div>
        </Show>

        <Show when={isActive()}>
          <div class="exercise-active-controls">
            <Show when={props.autoTimer && typeof timerMode() === 'number'}>
              <span class="exercise-timer-countdown">
                {Math.ceil(remainingMs() / 1000)}s
              </span>
            </Show>
            <button
              class="exercise-btn exercise-btn-secondary"
              onClick={() => props.onStop()}
            >
              {props.stopLabel ?? 'Stop & Score'}
            </button>
          </div>
        </Show>

        <Show when={isComplete()}>
          <button
            class="exercise-btn exercise-btn-secondary"
            onClick={() => props.onChangeTarget()}
          >
            {props.changeTargetLabel ?? 'Change Target'}
          </button>
        </Show>
      </div>
    </div>
  )
}
