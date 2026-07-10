// ============================================================
// ExerciseFeedback — live game-feel layer for note-based drills
// ============================================================
//
// Drop-in strip rendered inside an exercise's activeContent. Reads only the
// base exercise state (metrics published by the controller) and adds the
// three things the UX audit found missing from every run:
//
//   1. a VISIBLE response window — a draining bar while the singer's slot
//      is open (metrics.matchWindowMs + the phase timestamp the base stamps)
//   2. TIER feedback per note — Perfect/Great/Close/Missed word + a quiet
//      blip, replacing the bare percentage
//   3. a COMBO counter — consecutive notes ≥75 build ×N; a miss resets it
//
// Controllers already publish everything needed (phase, matchWindowMs,
// lastNoteScore, notesCompleted) — integrating an exercise is one JSX line.

import type { Component } from 'solid-js'
import { createEffect, createSignal, on, Show } from 'solid-js'
import type { ScoreTier } from './feedback'
import { COMBO_THRESHOLD, playTierSfx, tierForScore } from './feedback'
import type { ExerciseState } from './types'

export interface ExerciseFeedbackProps {
  state: () => ExerciseState
  /** Mute the per-note blips (defaults to on). */
  silent?: boolean
}

export const ExerciseFeedback: Component<ExerciseFeedbackProps> = (props) => {
  const metrics = () => props.state().metrics
  const phase = () => metrics().phase ?? 0

  // ── Response-window bar ──
  // phase 2 = the singer's turn; the base stamps phaseStartedMs on every
  // phase change and elapsedMs ticks per frame, so the fill is pure math.
  const windowFraction = () => {
    const m = metrics()
    const total = m.matchWindowMs ?? 0
    if (phase() !== 2 || total <= 0) return null
    const started = m.phaseStartedMs ?? 0
    const elapsed = props.state().elapsedMs - started
    return Math.max(0, Math.min(1, 1 - elapsed / total))
  }

  // ── Tier flash + combo, driven by completed-note count ──
  const [flash, setFlash] = createSignal<ScoreTier | null>(null)
  const [combo, setCombo] = createSignal(0)
  let flashTimer: ReturnType<typeof setTimeout> | undefined

  createEffect(
    on(
      () => metrics().notesCompleted ?? 0,
      (count, prevCount) => {
        if (count === 0) {
          // Fresh run (metrics reset) — clear the streak.
          setCombo(0)
          setFlash(null)
          return
        }
        if (prevCount === undefined || count <= prevCount) return
        const score = metrics().lastNoteScore ?? 0
        const tier = tierForScore(score)
        setCombo((c) => (score >= COMBO_THRESHOLD ? c + 1 : 0))
        setFlash(tier)
        if (props.silent !== true) playTierSfx(tier)
        clearTimeout(flashTimer)
        flashTimer = setTimeout(() => setFlash(null), 900)
      },
    ),
  )

  return (
    <div class="exercise-feedback">
      <Show when={windowFraction() !== null}>
        <div class="exercise-window-bar" aria-hidden="true">
          <div
            class="exercise-window-fill"
            style={{ width: `${(windowFraction() ?? 0) * 100}%` }}
          />
        </div>
      </Show>
      <div class="exercise-feedback-row">
        <Show when={flash()}>
          <span class={`exercise-tier-flash ${flash()!.className}`}>
            {flash()!.label}
          </span>
        </Show>
        <Show when={combo() >= 2}>
          <span class="exercise-combo">x{combo()}</span>
        </Show>
      </div>
    </div>
  )
}
