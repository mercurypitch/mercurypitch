// ── JamSongShare ──────────────────────────────────────────────────────
// Who cannot hear the song -- and the button that fixes it.
//
// Lives in the room header, beside the room code and the transfer chip.
// It used to sit under the song's timeline, which is furniture: people
// read the words and the scrubber there, not notices, and the one thing
// in the room that needs acting on was the easiest thing to miss. The
// header is where the room's own state already lives.
//
// It says something only when there is somebody to say it about. Alone in
// a room, "only you can hear this" is true of every song ever loaded and
// tells nobody anything -- it read as a default the room always wore, and
// its sentence was what pushed the header onto a second row. A room of one
// gets a mark and an explanation on request; the sentence waits for a
// second person, which is the first moment it means something.
//
// Explicit rather than automatic. Encoding costs seconds of CPU and the
// transfer costs somebody's data, so it happens when the host asks, not
// the moment a local song is picked.

import type { Component } from 'solid-js'
import { createEffect, createSignal, Match, on, onCleanup, Switch, } from 'solid-js'
import { InfoPopover } from '@/components/InfoPopover'
import { rowHoldsOneLine } from '@/lib/jam/row-fit'
import { jamConnectedPeers, jamIsHost, jamPeersMissingSong, jamShareState, jamSong, jamSongSentOnce, shareJamSongWithRoom, } from '@/stores/jam-store'
import styles from './JamSongShare.module.css'

export interface JamSongShareProps {
  /**
   * What squeezes the row this sits in -- the room's header.
   *
   * The row itself is only as wide as what is in it, so a window that grows
   * does not change its size and would never be noticed from the row alone.
   */
  within?: () => HTMLElement | undefined
}

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
    class={styles.icon}
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

export const JamSongShare: Component<JamSongShareProps> = (props) => {
  /** A song only this device holds, whoever else is in the room. */
  const isLocalOnly = () => jamSong()?.origin === 'local'

  /** Nobody to send anything to. */
  const alone = () => jamConnectedPeers().length === 0

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
   * host would be offered a first send of a song they had just sent.
   */
  const alreadySent = () => jamSongSentOnce()

  const missing = () => jamPeersMissingSong()

  /** Who, in as few words as name them. */
  const who = (): string => {
    const list = missing()
    if (list.length === 1) return list[0]?.displayName ?? 'Someone'
    return `${list.length} people`
  }

  /** What the button says. Short: it shares a row with the whole room. */
  const label = (): string =>
    alreadySent() ? `${who()} can’t hear it` : 'Send the song'

  /** The whole story, for the tooltip and for a screen reader. */
  const explain = (): string => {
    if (!alreadySent()) {
      return 'Only you can hear this song. The others see the words, the notes and everyone’s pitch. Send it so they can hear it too.'
    }
    return missing().length === 1
      ? `${who()} cannot hear this song — they may have reloaded. Send it again.`
      : `${who()} cannot hear this song. Send it again.`
  }

  const [soloHost, setSoloHost] = createSignal<HTMLElement>()

  // ── Words while they fit ────────────────────────────────────────────
  // The chip gives up its words before the strip takes a second line --
  // see row-fit for why a stylesheet cannot do this. The icon still pulses
  // and still sends; what it says moves to the tooltip and the label.
  const [chip, setChip] = createSignal<HTMLElement>()

  const fit = (): void => {
    const element = chip()
    const row = element?.parentElement
    if (element === undefined || row === null || row === undefined) return
    // With its words first: that is the form worth having if there is room.
    delete element.dataset.compact
    if (!rowHoldsOneLine(row, element.offsetHeight)) {
      element.dataset.compact = ''
    }
  }

  createEffect(() => {
    const element = chip()
    if (element === undefined) return
    let watcher: ResizeObserver | undefined
    const outer = props.within?.()
    const watch = (): void => {
      const row = element.parentElement
      if (row === null) return
      fit()
      if (typeof ResizeObserver === 'undefined') return
      watcher = new ResizeObserver(fit)
      watcher.observe(row)
      if (outer !== undefined) watcher.observe(outer)
    }
    // A ref is handed over before its element is put in the page, so a chip
    // that appears mid-session (somebody joined) has no row yet on this
    // pass. It has one by the time the current update has finished.
    if (element.parentElement === null) queueMicrotask(watch)
    else watch()
    onCleanup(() => watcher?.disconnect())
  })

  // The words changing length is a reason to look again, and nothing about
  // the row's own size says they did.
  createEffect(on(label, () => queueMicrotask(fit), { defer: true }))

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
          ref={setChip}
          type="button"
          class={styles.chip}
          data-testid="jam-song-share"
          title={explain()}
          aria-label={`${label()}. ${explain()}`}
          onClick={() => void shareJamSongWithRoom(true)}
        >
          <SendIcon />
          <span class={styles.chipText}>{label()}</span>
        </button>
      </Match>

      {/* Alone with a song only this device holds: nothing to send, nobody
          to tell. A mark, and the explanation for whoever asks -- hover on
          a desk, a tap on a tablet, which has no hover to offer. */}
      <Match when={alone() && isLocalOnly() && !busy()}>
        <span
          class={styles.solo}
          data-testid="jam-song-solo"
          ref={(element) => setSoloHost(element)}
        >
          <InfoPopover
            class={styles.soloTrigger}
            icon={<SoloIcon />}
            label="Only you can hear this song"
            hoverAnchor={soloHost}
          >
            You are the only one here, and this song is on your device. Invite
            someone and you can send it to them.
          </InfoPopover>
        </span>
      </Match>
    </Switch>
  )
}
