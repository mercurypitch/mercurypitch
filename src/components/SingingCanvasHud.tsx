// ============================================================
// SingingCanvasHud — in-flow performance rail beside the singing stage.
//
// Accuracy visibility follows the `showStats` toggle; the pitch monitor
// follows `showPitchDisplay`. The session scoreboard shows whenever there
// is session history. Keeping these cards outside the canvas prevents them
// from obscuring melody lanes, notation, or the view switch.
// ============================================================

import type { Component } from 'solid-js'
import { For, Show } from 'solid-js'
import type { MascotState } from '@/components/Mascot'
import { MascotDock } from '@/components/MascotDock'
import { sessionResults, showMascot, showPitchDisplay, showStats, } from '@/stores'
import { getBandRating } from '@/stores/settings-store'
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
  // The sessions scoreboard is history, not live feedback, so it collapses
  // during playback while the two live monitor cards remain available.
  const showSessions = () => sessionResults().length > 0 && !props.isPlaying()
  // Merc reacts to your singing: idle at rest, sings on pitch, celebrates a
  // perfect note, cheers you on when you're off, and grooves during playback.
  const mascotState = (): MascotState => {
    if (props.isPlaying()) return 'listening'
    const p = props.pitch()
    if (p === null || p.frequency <= 0) return 'idle'
    if (props.targetNoteName() === null) return 'singing'
    const band = getBandRating(Math.abs(p.cents))
    if (band >= 100) return 'celebrate'
    if (band >= 75) return 'singing'
    return 'encouraging'
  }
  const mascotEnergy = () => props.liveScore() ?? 0

  return (
    <>
      <Show when={showMascot()}>
        <MascotDock state={mascotState} energy={mascotEnergy} />
      </Show>

      <aside
        class={styles.performanceRail}
        data-testid="singing-canvas-hud"
        aria-label="Live performance monitor"
      >
        <header class={styles.railHeader}>
          <span
            class={styles.liveIndicator}
            classList={{ [styles.liveIndicatorActive]: props.isPlaying() }}
            aria-hidden="true"
          />
          <span>
            <span class={styles.railKicker}>Performance</span>
            <strong>{props.isPlaying() ? 'Listening live' : 'Monitor'}</strong>
          </span>
        </header>

        <div class={styles.cards}>
          <Show when={showStats()}>
            <div class={styles.card} data-testid="hud-accuracy">
              <div class={styles.cardTitle}>Pitch accuracy</div>
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
              <div class={styles.cardTitle}>Input monitor</div>
              <PitchDisplay
                pitch={props.pitch}
                targetNote={props.targetNoteName}
              />
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

          <Show when={!showStats() && !showPitchDisplay() && !showSessions()}>
            <div class={styles.emptyRail}>
              Performance cards are hidden in Display settings.
            </div>
          </Show>
        </div>
        <footer class={styles.railFooter}>
          <span>
            {props.isPlaying() ? 'Tracking pitch' : 'Ready for input'}
          </span>
          <span class={styles.railValue}>
            {props.liveScore() === null ? '--' : `${props.liveScore()}%`}
          </span>
        </footer>
      </aside>
    </>
  )
}
