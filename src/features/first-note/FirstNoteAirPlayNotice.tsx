// ============================================================
// FirstNoteAirPlayNotice — over AirPlay alone, where this room plays nothing
// ============================================================
//
// In the app First note plays through Web Audio alone wherever the phone
// can stream a stem (web-audio-song-player.ts), and Web Audio alone reaches
// a TV over AirPlay. Where the phone cannot (iOS before Safari 26's
// AudioDecoder, or the Developer screen's "Force the no-streaming path"),
// its stems are elements, and over AirPlay alone (the TV chosen under
// AirPlay, not Screen Mirroring) an element plays nothing, routed through
// Web Audio or not: the AirPlay sound check's button 6 was silent on the TV
// and on the phone (owner, 7 Nov 2026, mp-v0.8.57). There the room says
// so, and what carries its sound.
//
// It follows the sound as the app guesses it (airplay-suspicion.ts,
// `airPlayAlone`): up while the sound is on AirPlay alone, gone the moment
// it is not (Screen Mirroring connects, the phone is chosen again), and back
// if it returns. Keeping the guess fresh is the store's; this only reads it.
// Like Karaoke's hint (karaoke-room/KaraokeAirPlayHint.tsx), its status
// region is always there, empty, so a screen reader hears the words as they
// appear, and it takes no taps and no focus. It sits under the room's head,
// over the song's name, and waits while the result or the demo has the
// head of the room: the demo's band is Web Audio, and plays.

import type { JSX } from 'solid-js'
import { Show } from 'solid-js'
import { Tv } from '@/components/icons'
import { airPlayAlone } from '@/stores/airplay-suspicion'
import { nativeDeviceApi } from '@/stores/native-shell-store'
import styles from './FirstNoteAirPlayNotice.module.css'
import type { SongStreams } from './web-audio-song-player'
import { playsThroughWebAudio } from './web-audio-song-player'

/** What the room says over AirPlay alone (draft words, for maff to change). */
export const AIRPLAY_PLAYS_NOTHING =
  'Over AirPlay this room plays nothing. Screen Mirroring carries its sound: open Control Center, tap Screen Mirroring, then choose your TV.'

export interface FirstNoteAirPlayNoticeProps {
  /** How Karaoke streams a stem, as the app's screen handed it to the room. */
  streams?: SongStreams
  /** The head of the room is free: not the result's, not the demo's. */
  show: boolean
}

/** In the app, a run here plays its stems from elements: nothing over AirPlay alone. */
export function playsElementsInTheApp(
  streams: SongStreams | undefined,
): boolean {
  return nativeDeviceApi() !== null && !playsThroughWebAudio(streams)
}

export function FirstNoteAirPlayNotice(
  props: FirstNoteAirPlayNoticeProps,
): JSX.Element {
  const up = (): boolean =>
    props.show && playsElementsInTheApp(props.streams) && airPlayAlone()
  return (
    <div
      class={styles.slot}
      role="status"
      data-testid="first-note-airplay-slot"
    >
      <Show when={up()}>
        <p class={styles.notice} data-testid="first-note-airplay-notice">
          <span class={styles.icon} aria-hidden="true">
            <Tv />
          </span>
          <span>{AIRPLAY_PLAYS_NOTHING}</span>
        </p>
      </Show>
    </div>
  )
}
