// ============================================================
// SingingCanvasHud — floating glass overlays anchored to the
// singing canvas (like the Guitar 3D HUD). The live accuracy score
// and the recent-session scoreboard sit top-right; the pitch monitor
// docks bottom-left, mirroring the Guitar 3D input monitor. All three
// replace the old right-sidebar panels.
//
// Accuracy visibility follows the `showStats` toggle; the pitch monitor
// follows `showPitchDisplay`. The session scoreboard shows whenever there
// is session history (it moved off the sidebar — see AppSidebar).
// ============================================================

import type { Component } from 'solid-js'
import { For, Show } from 'solid-js'
import { sessionResults, showPitchDisplay, showStats } from '@/stores'
import type { NoteResult, PitchResult } from '@/types'
import { PitchDisplay } from './PitchDisplay'
import styles from './SingingCanvasHud.module.css'
import { StatsBars } from './StatsBars'

// How many recent sessions the scoreboard lists (most-recent-first).
// Code-configurable only, per the canvas-scoreboard design.
const RECENT_SESSIONS = 6

interface SingingCanvasHudProps {
  noteResults: () => NoteResult[]
  pitch: () => PitchResult | null
  targetNoteName: () => string | null
  liveScore: () => number | null
  /** Live singing-playback signal (the controller's, not the dead store one). */
  isPlaying: () => boolean
}

export const SingingCanvasHud: Component<SingingCanvasHudProps> = (props) => {
  // The sessions scoreboard is history, not live feedback — auto-collapse it
  // during playback so the melody has room. The live HUDs stay but dim (see
  // the `dimmed` class) so the melody beneath reads through.
  const showSessions = () => sessionResults().length > 0 && !props.isPlaying()
  return (
    <>
      <Show when={showStats() || showSessions()}>
        <div
          class={styles.accuracyHud}
          classList={{ [styles.dimmed]: props.isPlaying() }}
          data-testid="singing-canvas-hud"
        >
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

          <Show when={showSessions()}>
            <div
              id="session-history-panel"
              class={styles.card}
              data-testid="hud-sessions"
            >
              <div class={styles.cardTitle}>Sessions</div>
              <div id="session-history-list" class={styles.sessionList}>
                <For each={sessionResults().slice(0, RECENT_SESSIONS)}>
                  {(entry) => (
                    <div
                      class={styles.sessionRow}
                      data-testid="session-history-entry"
                    >
                      <span class={styles.sessionName}>
                        {entry.sessionName}
                      </span>
                      <span
                        class={
                          entry.score >= 80
                            ? styles.scoreHigh
                            : entry.score >= 50
                              ? styles.scoreMid
                              : styles.scoreLow
                        }
                        classList={{
                          [styles.sessionScore]: true,
                          // Literal markers kept for the sessions e2e selectors.
                          'session-history-score': true,
                          'score-high': entry.score >= 80,
                          'score-mid': entry.score >= 50 && entry.score < 80,
                          'score-low': entry.score < 50,
                        }}
                      >
                        {entry.score}%
                      </span>
                    </div>
                  )}
                </For>
              </div>
            </div>
          </Show>
        </div>
      </Show>

      <Show when={showPitchDisplay()}>
        <div
          class={styles.pitchHud}
          classList={{ [styles.dimmed]: props.isPlaying() }}
        >
          <div class={styles.card} data-testid="hud-pitch">
            <PitchDisplay
              pitch={props.pitch}
              targetNote={props.targetNoteName}
            />
          </div>
        </div>
      </Show>
    </>
  )
}
