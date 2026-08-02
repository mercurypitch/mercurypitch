// ── JamSongStage ──────────────────────────────────────────────────────
// A song room: lyrics left, one pitch lane per singer right.
//
// The audio element is the clock. Its currentTime is the truth, and the
// store's position follows it rather than the other way round -- an
// independent timer would drift against the audio within a verse, and
// then the lyrics would be wrong in a way that looks like bad timings.
//
// Only the host's transport commands move the playhead. A peer's element
// is seeked TO the broadcast position rather than driving it, which is
// what keeps a room together across the join.

import type { Component } from 'solid-js'
import { createEffect, onCleanup, onMount, Show } from 'solid-js'
import { jamExercisePaused, jamExercisePlaying, jamIsHost, jamPeerId, jamSong, jamSongPause, jamSongPlay, jamSongPositionSec, jamSongStop, setJamSongPositionSec, } from '@/stores/jam-store'
import { JamPeerLanes } from './JamPeerLanes'
import { JamSongLyrics } from './JamSongLyrics'
import styles from './JamSongStage.module.css'

/**
 * How far out of step a peer tolerates before correcting.
 *
 * Small enough that nobody is audibly behind, large enough that a peer is
 * not re-seeking on every message -- a seek is audible, so correcting a
 * 50ms drift would be worse than the drift.
 */
const RESYNC_THRESHOLD_SEC = 0.35

export const JamSongStage: Component = () => {
  let audioRef: HTMLAudioElement | undefined

  // The host's element drives the store; everyone else's follows it.
  onMount(() => {
    const el = audioRef
    if (el === undefined) return
    const onTime = () => {
      if (jamIsHost()) setJamSongPositionSec(el.currentTime)
    }
    el.addEventListener('timeupdate', onTime)
    onCleanup(() => el.removeEventListener('timeupdate', onTime))
  })

  // Follow the room's transport. A peer seeks only when it has drifted
  // past the threshold, so ordinary jitter does not cause an audible jump.
  createEffect(() => {
    const el = audioRef
    const target = jamSongPositionSec()
    if (el === undefined) return
    if (
      !jamIsHost() &&
      Math.abs(el.currentTime - target) > RESYNC_THRESHOLD_SEC
    ) {
      el.currentTime = target
    }
    if (jamExercisePlaying() && !jamExercisePaused()) {
      // Autoplay can still be refused; the room simply stays paused rather
      // than pretending it is playing.
      void el.play().catch(() => {})
    } else {
      el.pause()
    }
  })

  return (
    <Show when={jamSong()}>
      {(song) => (
        <div class={styles.stage}>
          <audio
            ref={audioRef}
            src={song().stems.instrumental}
            preload="auto"
            crossorigin="anonymous"
          />

          <div class={styles.transport}>
            <span class={styles.title}>
              {song().title}
              <Show when={song().artist}>
                <span class={styles.artist}> · {song().artist}</span>
              </Show>
            </span>
            {/* Host only: the same rule the drill transport follows, so a
                room never has two people fighting over the playhead. */}
            <Show when={jamIsHost()}>
              <div class={styles.buttons}>
                <button
                  class={styles.btn}
                  onClick={() =>
                    jamExercisePlaying() && !jamExercisePaused()
                      ? jamSongPause(audioRef?.currentTime ?? 0)
                      : jamSongPlay(audioRef?.currentTime ?? 0)
                  }
                >
                  {jamExercisePlaying() && !jamExercisePaused()
                    ? 'Pause'
                    : 'Play'}
                </button>
                <button class={styles.btn} onClick={() => jamSongStop()}>
                  Stop
                </button>
              </div>
            </Show>
          </div>

          <div class={styles.split}>
            <JamSongLyrics
              lines={song().lines}
              positionSec={jamSongPositionSec}
              showNotes={false}
            />
            <JamPeerLanes myPeerId={jamPeerId} />
          </div>
        </div>
      )}
    </Show>
  )
}
