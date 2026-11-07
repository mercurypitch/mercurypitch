// ============================================================
// KaraokeAirPlayHint — where the song and the lyrics are, on AirPlay
// ============================================================
//
// On AirPlay alone the song plays on the TV and nothing else does. AirPlay
// carries sound only: iOS gives an app a second screen with Screen
// Mirroring or a cable, never with AirPlay alone, so the lyrics stay on
// the phone. So while a song plays there, the room says where it plays
// (the receiver by the name the route gives it, and none where AirPlay is
// only suspected: `airPlayReceiver`), that the lyrics stay on this phone,
// and that Screen Mirroring puts the stage on the TV, and how.
//
// Until mp-v0.8.55 it said AirPlay could not carry the room's sound to a
// TV: on the owner's LG C2 the TV showed the song's name and a spinner, and
// no sound came from the TV or the phone. The Developer screen's AirPlay
// sound check (6 Nov 2026) found Web Audio alone on the TV, and not Web
// Audio beside a silent element, so the lock screen's carrier and the
// unlock clip now stand aside on AirPlay (native-device.ts in the app).
//
// LIVE. Up while a song plays on AirPlay alone (airplay-suspicion.ts: the
// route says airplay, or the room suspects it, and no screen is connected),
// and gone the moment either stops: the song paused or over, AirPlay gone,
// Screen Mirroring started. Nothing is read once and kept: the guess moves
// with each output check (output-check.ts: a room shown, a press of play,
// the app back in front, a change of route, a song playing a moment), and
// the hint with it, so a room left and opened again says where the sound
// goes then. Up to mp-v0.8.57 it was judged once, as a song started, and
// shown once a launch: a guess stale at that start kept it away, and one
// stale after AirPlay went kept it up.
//
// CLOSED FOR ONE CONNECTION. Its button (44 px) closes it for the stretch of
// AirPlay alone it was closed in (`airPlayConnection`): through pauses,
// songs and rooms, for as long as the sound stays there. Once AirPlay alone
// ends and begins again (another TV, or the same one taken again), it comes
// back with the song. Per connection rather than per launch, so a singer who
// moves to another TV is told where the song plays now. It asks nothing
// else: no focus moves to it, and the song plays on under it.
//
// Like the premium rooms' volume hint (RoomVolumeHint.tsx), its status
// region is always there, empty, so a screen reader hears the hint the
// moment it appears; only the card takes taps. It sits at the top of the
// stage, under the room header, over the song's title line rather than the
// words being sung (KaraokeAirPlayHint.module.css).

import type { Accessor } from 'solid-js'
import { createSignal, For, Show } from 'solid-js'
import { Tv, X } from '@/components/icons'
import type { HostedMixerControls } from '@/components/stem-mixer-hosting'
import { thisDeviceLower } from '@/lib/device-noun'
import { airPlayAlone, airPlayConnection, airPlayReceiver, } from '@/stores/airplay-suspicion'
import styles from './KaraokeAirPlayHint.module.css'
import { CLOSE_NOTICE } from './sound-stopped'

/** Where the stage goes, and how: Screen Mirroring, from Control Center. */
export const MIRRORING_STAGE =
  'Screen Mirroring puts the stage on the TV: open Control Center, tap Screen Mirroring, then choose your TV.'

/**
 * What the hint says, a line each: where the song plays, by the name the
 * route gives the receiver (null where AirPlay is only suspected), where
 * the lyrics are, and what Screen Mirroring adds.
 */
export function airPlayHintLines(receiver: string | null): readonly string[] {
  const where =
    receiver === null || receiver.trim() === ''
      ? 'The song is playing over AirPlay.'
      : `The song is playing on ${receiver} over AirPlay.`
  return [where, `The lyrics stay on ${thisDeviceLower()}.`, MIRRORING_STAGE]
}

/**
 * The stretch of AirPlay alone the hint was closed in, or null. Module-wide,
 * so the next room keeps the close: this module lives as long as the app.
 */
const [closedIn, setClosedIn] = createSignal<number | null>(null)

export interface KaraokeAirPlayHintProps {
  /** The mixer on the stage, or null between songs. */
  mixer: Accessor<HostedMixerControls | null>
}

export function KaraokeAirPlayHint(props: KaraokeAirPlayHintProps) {
  const playing = (): boolean => props.mixer()?.playing() === true
  // Followed, never read once: see LIVE.
  const up = (): boolean =>
    playing() && airPlayAlone() && closedIn() !== airPlayConnection()
  const lines = (): readonly string[] => airPlayHintLines(airPlayReceiver())
  return (
    <div class={styles.slot} role="status" data-testid="karaoke-airplay-slot">
      <Show when={up()}>
        <div class={styles.hint} data-testid="karaoke-airplay-hint">
          <span class={styles.icon} aria-hidden="true">
            <Tv />
          </span>
          <div class={styles.words}>
            <For each={lines()}>{(line) => <p>{line}</p>}</For>
          </div>
          <button
            type="button"
            class={styles.close}
            aria-label={CLOSE_NOTICE}
            onClick={() => setClosedIn(airPlayConnection())}
          >
            <X />
          </button>
        </div>
      </Show>
    </div>
  )
}

/** Tests only: a new launch, as far as the hint can tell. */
export function resetAirPlayHintForTests(): void {
  setClosedIn(null)
}
