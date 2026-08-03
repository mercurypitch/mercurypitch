// ── JamSongShare ──────────────────────────────────────────────────────
// "Only you can hear this" -- and the button that fixes it.
//
// Lives in the room header, beside the room code and the transfer chip.
// It used to sit under the song's timeline, which is furniture: people
// read the words and the scrubber there, not notices, and the one thing
// in the room that needs acting on was the easiest thing to miss. The
// header is where the room's own state already lives.
//
// Explicit rather than automatic. Encoding costs seconds of CPU and the
// transfer costs somebody's data, so it happens when the host asks, not
// the moment a local song is picked.

import type { Component } from 'solid-js'
import { Match, Show, Switch } from 'solid-js'
import { songPlayableInRoom } from '@/lib/jam/jam-song'
import { jamConnectedPeers, jamIsHost, jamPeersMissingSong, jamShareState, jamSong, jamSongSentOnce, shareJamSongWithRoom, } from '@/stores/jam-store'
import styles from './JamSongShare.module.css'

/**
 * A speaker throwing waves outward, for sending the song to the room.
 *
 * The waves fade in turn rather than sitting still: a chip that animates
 * is one the eye finds in a header full of buttons, which is the entire
 * job here.
 */
const SendIcon: Component = () => (
  <svg
    class={styles.icon}
    viewBox="0 0 16 16"
    width="14"
    height="14"
    fill="none"
    stroke="currentColor"
    stroke-width="1.6"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path d="M2 6.5v3h2.5L8 12.5v-9L4.5 6.5H2Z" />
    <path class={styles.waveNear} d="M10.5 6a2.8 2.8 0 0 1 0 4" />
    <path class={styles.waveFar} d="M12.5 4a5.5 5.5 0 0 1 0 8" />
  </svg>
)

/** A song only this device can play, for the room of one. */
const SoloIcon: Component = () => (
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
    <path d="M11 6.5l3 3M14 6.5l-3 3" />
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

  const missing = () => jamPeersMissingSong()

  /** The whole story, for the tooltip -- the chip itself stays short. */
  const explain = () => {
    if (!alreadySent()) {
      return 'Only you can hear this one. The others see the words, the notes and everyone’s pitch. Send it so they can hear it too.'
    }
    const who = missing()
    if (who.length === 1) {
      return `${who[0]?.displayName ?? 'Someone'} cannot hear this one — they may have reloaded. Send it again.`
    }
    return `${who.length} people cannot hear this one. Send it again.`
  }

  return (
    <Switch>
      {/* One control, two situations. Sending the first time and sending to
          somebody who reloaded are the same action -- only the sentence
          differs -- and splitting them into two arms meant the re-send case
          shadowed the offer, so a host with a local song was told people
          "cannot hear this" before they had ever been offered the chance
          to send it. */}
      <Match when={jamIsHost() && !busy() && missing().length > 0}>
        <button
          type="button"
          class={styles.chip}
          title={explain()}
          onClick={() => void shareJamSongWithRoom(true)}
        >
          <SendIcon />
          <span class={styles.chipText}>
            <Show when={alreadySent()} fallback="Send the song">
              {missing().length === 1
                ? `${missing()[0]?.displayName ?? 'Someone'} can’t hear this`
                : `${missing().length} can’t hear this`}
            </Show>
          </span>
        </button>
      </Match>

      {/* Alone with a song only this device holds: nothing to send to, so
          it states the fact quietly rather than offering an action that
          would fail. No pulse -- there is nothing to act on. */}
      <Match when={needsShare() === false && isLocalOnly() && !busy()}>
        <span
          class={`${styles.chip} ${styles.chipQuiet}`}
          role="note"
          title="This song is on your device. Anyone who joins can be sent it."
        >
          <SoloIcon />
          <span class={styles.chipText}>Only you can hear this</span>
        </span>
      </Match>
    </Switch>
  )
}
