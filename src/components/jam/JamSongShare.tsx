// ── JamSongShare ──────────────────────────────────────────────────────
// "Only you can hear this" -- and the button that fixes it.
//
// Explicit rather than automatic. Encoding costs seconds of CPU and the
// transfer costs somebody's data, so it happens when the host asks, not
// the moment a local song is picked.
//
// Shown to everyone, because the receiving side has something to say too:
// a peer watching a song arrive should see that it is arriving, and a
// peer who cannot receive it should be told why rather than left
// wondering where the backing track went.

import type { Component } from 'solid-js'
import { Match, Show, Switch } from 'solid-js'
import { songPlayableInRoom } from '@/lib/jam/jam-song'
import { cancelJamSongShare, jamConnectedPeers, jamIsHost, jamShareState, jamSong, shareJamSongWithRoom, } from '@/stores/jam-store'
import styles from './JamSongShare.module.css'

/** A speaker with waves, for sending the song out to the room. */
const SendIcon: Component = () => (
  <svg
    viewBox="0 0 16 16"
    width="13"
    height="13"
    fill="none"
    stroke="currentColor"
    stroke-width="1.6"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path d="M2 6.5v3h2.5L8 12.5v-9L4.5 6.5H2Z" />
    <path d="M10.5 6a2.8 2.8 0 0 1 0 4" />
    <path d="M12.5 4a5.5 5.5 0 0 1 0 8" />
  </svg>
)

export const JamSongShare: Component = () => {
  /** Only the case the button exists for: my song, and people to send to. */
  const needsShare = () => {
    const song = jamSong()
    if (song === null) return false
    return (
      songPlayableInRoom(song, jamConnectedPeers().length).needsShare === true
    )
  }

  const state = () => jamShareState()
  const busy = () =>
    state().phase === 'encoding' ||
    state().phase === 'sending' ||
    state().phase === 'receiving'

  return (
    <Switch>
      {/* Something is moving. Shown to sender and receiver alike -- the
          person waiting for a song has more need of a progress bar than
          the person sending it. */}
      <Match when={busy()}>
        <div class={styles.share} role="status">
          <div class={styles.bar}>
            <div
              class={styles.fill}
              style={{ width: `${Math.round(state().ratio * 100)}%` }}
            />
          </div>
          <span class={styles.text}>{state().message}</span>
          <Show when={state().phase !== 'receiving' && jamIsHost()}>
            <button
              type="button"
              class={styles.link}
              onClick={cancelJamSongShare}
            >
              Stop
            </button>
          </Show>
        </div>
      </Match>

      <Match when={state().phase === 'error'}>
        <div class={styles.share} role="alert">
          <span class={styles.error}>{state().message}</span>
          <Show when={jamIsHost() && needsShare()}>
            <button
              type="button"
              class={styles.button}
              onClick={() => void shareJamSongWithRoom()}
            >
              Try again
            </button>
          </Show>
        </div>
      </Match>

      <Match when={state().phase === 'done'}>
        <div class={styles.share} role="status">
          <span class={styles.text}>{state().message}</span>
        </div>
      </Match>

      {/* The offer. Host only: it is their song and their upload. */}
      <Match when={needsShare() && jamIsHost()}>
        <div class={styles.share}>
          <span class={styles.text}>
            Only you can hear this one. The others see the words, the notes and
            everyone’s pitch.
          </span>
          <button
            type="button"
            class={styles.button}
            onClick={() => void shareJamSongWithRoom()}
          >
            <SendIcon />
            Send to the room
          </button>
        </div>
      </Match>
    </Switch>
  )
}
