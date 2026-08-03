// ── JamTransport ──────────────────────────────────────────────────────
// One set of transport controls for whatever the room is running.
//
// A drill and a song are two engines -- a beat grid and an <audio>
// element -- and they used to carry two sets of buttons in two places. A
// room on a song showed both, and the drill's Play, wired to the same
// playing signal, started the song and then its beat timer ended and
// stopped it. Even after that was fixed, "which Play do I press" is not a
// question a room should ask.
//
// So: one bar. It knows which engine is loaded and calls the right pair
// of functions. The engines stay separate underneath, which is the honest
// arrangement -- beats and seconds really are different clocks -- but
// nothing above this line has to care.
//
// Host-only, like everything that drives the room.

import type { Component } from 'solid-js'
import { Show } from 'solid-js'
import { clearJamExercise, jamExerciseMelody, jamExercisePaused, jamExercisePlaying, jamIsHost, jamIsSongRoom, jamPlaybackPause, jamPlaybackPlay, jamPlaybackResume, jamPlaybackStop, jamSongPause, jamSongPlay, jamSongPositionSec, jamSongStop, } from '@/stores/jam-store'
import styles from './JamTransport.module.css'

interface JamTransportProps {
  onSelectExercise: () => void
  loopEnabled?: boolean
  onToggleLoop?: () => void
}

export const JamTransport: Component<JamTransportProps> = (props) => {
  /** Both engines report through the same pair of signals. */
  const isRunning = () => jamExercisePlaying() && !jamExercisePaused()
  const isPaused = () => jamExercisePlaying() && jamExercisePaused()
  const isStopped = () => !jamExercisePlaying()

  /** Is there anything to drive? A room with neither shows only the picker. */
  const hasSomething = () => jamIsSongRoom() || jamExerciseMelody() !== null

  const play = (): void => {
    if (jamIsSongRoom()) {
      // The element's own clock, by way of the store -- its timeupdate is
      // what writes the position, so this is where it actually is.
      jamSongPlay(jamSongPositionSec())
      return
    }
    if (isPaused()) jamPlaybackResume()
    else jamPlaybackPlay()
  }

  const pause = (): void => {
    if (jamIsSongRoom()) jamSongPause(jamSongPositionSec())
    else jamPlaybackPause()
  }

  const stop = (): void => {
    if (jamIsSongRoom()) jamSongStop()
    else jamPlaybackStop()
  }

  return (
    <Show when={jamIsHost()}>
      <div class={styles.bar}>
        {/* Choose what the room sings -- a drill or one of your songs. The
            marker lets the picker's dismiss-on-outside-click ignore this
            button; without it, one tap would close the picker on
            pointerdown and reopen it on click. */}
        <button
          data-jam-picker-toggle
          class={`${styles.btn} ${styles.btnSelect}`}
          onClick={() => props.onSelectExercise()}
          title="Choose a drill or a song"
          aria-label="Choose a drill or a song"
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M9 18V5l12-2v13" />
            <circle cx="6" cy="18" r="3" />
            <circle cx="18" cy="16" r="3" />
          </svg>
        </button>

        <Show when={hasSomething()}>
          <div class={styles.divider} />

          {/* Play (when stopped or paused) / Pause (when running) */}
          <Show
            when={isRunning()}
            fallback={
              <button
                class={`${styles.btn} ${isPaused() ? styles.btnResume : styles.btnPlay}`}
                onClick={play}
                title={
                  isPaused() ? 'Resume' : 'Start playback for everyone here'
                }
                aria-label={
                  isPaused() ? 'Resume' : 'Start playback for everyone here'
                }
              >
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
              </button>
            }
          >
            <button
              class={`${styles.btn} ${styles.btnPause}`}
              onClick={pause}
              title="Pause"
              aria-label="Pause"
            >
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <rect x="6" y="4" width="4" height="16" rx="1" />
                <rect x="14" y="4" width="4" height="16" rx="1" />
              </svg>
            </button>
          </Show>

          {/* Stop — disabled when already stopped */}
          <button
            class={`${styles.btn} ${isStopped() ? styles.btnStopIdle : styles.btnStop}`}
            disabled={isStopped()}
            onClick={stop}
            title={isStopped() ? 'Not playing' : 'Stop and go back to the top'}
            aria-label={
              isStopped() ? 'Not playing' : 'Stop and go back to the top'
            }
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <rect x="4" y="4" width="16" height="16" rx="2" />
            </svg>
          </button>

          {/* Loop belongs to the drill: a scale is meant to go round, and a
              song that restarted itself would trap the room in it. */}
          <Show when={!jamIsSongRoom() && props.onToggleLoop !== undefined}>
            <button
              class={`${styles.btn} ${props.loopEnabled === true ? styles.btnLoopOn : styles.btnLoopOff}`}
              onClick={() => props.onToggleLoop?.()}
              title={
                props.loopEnabled === true
                  ? 'Loop on — click to disable'
                  : 'Loop off — click to enable'
              }
              aria-label={
                props.loopEnabled === true
                  ? 'Loop on — click to disable'
                  : 'Loop off — click to enable'
              }
            >
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <polyline points="17 1 21 5 17 9" />
                <path d="M3 11V9a4 4 0 0 1 4-4h14" />
                <polyline points="7 23 3 19 7 15" />
                <path d="M21 13v2a4 4 0 0 1-4 4H3" />
              </svg>
            </button>
          </Show>

          {/* Clear the drill. A song is cleared by picking something else --
              there is no empty song room worth landing in. */}
          <Show when={!jamIsSongRoom()}>
            <button
              class={`${styles.btn} ${styles.btnClear}`}
              onClick={clearJamExercise}
              title="Clear the drill"
              aria-label="Clear the drill"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                <path d="M10 11v6M14 11v6" />
              </svg>
            </button>
          </Show>
        </Show>
      </div>
    </Show>
  )
}
