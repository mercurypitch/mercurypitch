// ============================================================
// SingingCanvasHud — floating glass overlays anchored to the
// singing canvas, stacked in the top-right corner (like the
// Guitar 3D HUD). Holds the live accuracy score and the pitch
// monitor that used to live in the right sidebar.
//
// Visibility is driven by the same `showStats` / `showPitchDisplay`
// signals the sidebar toggles already control.
// ============================================================

import type { Component } from 'solid-js'
import { Show } from 'solid-js'
import { showPitchDisplay, showStats } from '@/stores'
import type { NoteResult, PitchResult } from '@/types'
import { PitchDisplay } from './PitchDisplay'
import styles from './SingingCanvasHud.module.css'
import { StatsBars } from './StatsBars'

interface SingingCanvasHudProps {
  noteResults: () => NoteResult[]
  pitch: () => PitchResult | null
  targetNoteName: () => string | null
  liveScore: () => number | null
}

export const SingingCanvasHud: Component<SingingCanvasHudProps> = (props) => {
  return (
    <div class={styles.hud} data-testid="singing-canvas-hud">
      <Show when={showStats()}>
        <div class={styles.card} data-testid="hud-accuracy">
          <div class={styles.cardTitle}>Accuracy</div>
          <StatsBars noteResults={props.noteResults} />
          <div class={styles.scoreRow} data-testid="score-display">
            <span class={styles.scoreLabel} data-testid="score-label">
              Score
            </span>
            <span class={styles.scoreValue} data-testid="score-value">
              {props.liveScore() !== null ? `${props.liveScore()}%` : '--'}
            </span>
          </div>
        </div>
      </Show>

      <Show when={showPitchDisplay()}>
        <div class={styles.card} data-testid="hud-pitch">
          <PitchDisplay pitch={props.pitch} targetNote={props.targetNoteName} />
        </div>
      </Show>
    </div>
  )
}
