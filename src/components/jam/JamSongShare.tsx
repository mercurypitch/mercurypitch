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
import { jamConnectedPeers, jamIsHost, jamPeersMissingSong, jamShareState, jamSong, jamSongSentOnce, shareJamSongWithRoom, } from '@/stores/jam-store'
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
  /** Whether the room would want the button, given who is here. */
  const needsShare = () => {
    const song = jamSong()
    if (song === null) return false
    return (
      songPlayableInRoom(song, jamConnectedPeers().length).needsShare === true
    )
  }

  /** A song only this device holds, whoever else is in the room. */
  const isLocalOnly = () => jamSong()?.origin === 'local'

  const state = () => jamShareState()
  const busy = () =>
    state().phase === 'encoding' ||
    state().phase === 'sending' ||
    state().phase === 'receiving'

  /**
   * Has this song already gone out once?
   *
   * NOT "does anybody have it": the person who reloaded re-reports no, and
   * if they were the only peer that reads as an untouched room -- so the
   * host would be told "only you can hear this" about a song they had just
   * sent them.
   */
  const alreadySent = () => jamSongSentOnce()

  return (
    <Switch>
      {/* One control, two situations. Sending the first time and sending to
          somebody who reloaded are the same action -- only the sentence
          differs -- and splitting them into two arms meant the re-send case
          shadowed the offer, so a host with a local song was told people
          "cannot hear this" before they had ever been offered the chance
          to send it. */}
      <Match when={jamIsHost() && !busy() && jamPeersMissingSong().length > 0}>
        <div class={styles.share} role="status">
          <span class={styles.text}>
            <Show
              when={alreadySent()}
              fallback="Only you can hear this one. The others see the words, the notes and everyone’s pitch."
            >
              {jamPeersMissingSong().length === 1
                ? `${jamPeersMissingSong()[0]?.displayName ?? 'Someone'} cannot hear this one — they may have reloaded.`
                : `${jamPeersMissingSong().length} people cannot hear this one.`}
            </Show>
          </span>
          <button
            type="button"
            class={styles.button}
            onClick={() => void shareJamSongWithRoom(true)}
          >
            <SendIcon />
            <Show when={alreadySent()} fallback="Send to the room">
              Send it to them
            </Show>
          </button>
        </div>
      </Match>

      {/* Alone with a song only this device holds: nothing to send to, so
          just say what the room will be like when somebody arrives. */}
      <Match when={needsShare() === false && isLocalOnly() && !busy()}>
        <div class={styles.share} role="note">
          <span class={styles.text}>
            Only you can hear this one — it is on your device. Anyone who joins
            can be sent it.
          </span>
        </div>
      </Match>
    </Switch>
  )
}
