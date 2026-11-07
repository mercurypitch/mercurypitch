// ============================================================
// The device, as the bridge hands it to a room under `src/`
// ============================================================
//
// What the Karaoke room needs and cannot import: the app's one AudioContext
// and its background hold (`packages/audio-io`, which the root package does
// not depend on), and the screen's keep-awake, the system's media controls,
// the picture-in-picture window and the phone's volume and route
// (`@irchiinnuss/mobile-runtime/platform`, which eslint keeps out of
// `src/`), and the Ear Lab's morning reminders (native-reminders.ts).
// Registered once from `main.tsx` through `registerNativeDevice`; the web
// registers nothing.

import type { SharedAudioLease } from '@irchiinnuss/audio-io'
import { acquireSharedAudioContext, holdSharedAudioContextInBackground, } from '@irchiinnuss/audio-io'
import { claimNowPlaying, keepAwake, micStopsOtherApps, onAudioOutput, onAudioRoute, onMediaAction, onNowPlayingHoldsAudio, onPictureInPicture, onTvLyrics, pictureInPictureNeedsLyrics, readAudioOutput, readTvLyrics, setNowPlaying, setPictureInPictureAutoEnter, setPictureInPictureLyrics, standNowPlayingAside, tellTheWindowTheClock, } from '@irchiinnuss/mobile-runtime/platform'
import { createEffect, createRoot, on, onCleanup } from 'solid-js'
import { checkBeforeEachStart, keepUnlockClipQuiet, standUnlockClipAside, } from '@/lib/audio-unlock'
import { EAR_LAB_WITH_MERC } from '@/lib/native-build'
import { notePageAudioContext } from '@/stores/airplay-suspicion'
import type { NativeDeviceApi } from '@/stores/native-shell-store'
import { checkForStart, webAudioAlone } from '@/stores/output-check'
import { createNativeReminders } from './native-reminders'
import { createTvStage } from './native-tv-stage'
import { logClockStates } from './shared-clock-log'

/**
 * The picture the system's media controls show with every song: behind it in
 * Android's media player and its notification, beside it on the lock screen.
 * native-only/now-playing.webp, served at the bundle's root (native-assets.mjs).
 */
const NOW_PLAYING_ARTWORK = '/now-playing.webp'

/** What TVLyrics.swift says of a TV: connected, and showing the lyrics. */
interface TvState {
  readonly connected: boolean
  readonly showing: boolean
}

/**
 * iOS: one thing about a connected TV, as it stands and then on every change
 * (TVLyrics.swift): whether it shows the room's lyrics, or whether a screen
 * is connected at all, by Screen Mirroring or a cable, whatever it shows.
 * The first read is dropped if a change was heard before it came back, or
 * once nobody listens.
 */
function watchTv(
  pick: (state: TvState) => boolean,
): (handler: (value: boolean) => void) => () => void {
  return (handler) => {
    let heard = false
    let listening = true
    const stop = onTvLyrics((state) => {
      heard = true
      handler(pick(state))
    })
    void readTvLyrics().then((state) => {
      if (listening && !heard && state !== null) handler(pick(state))
    })
    return () => {
      listening = false
      stop()
    }
  }
}

/**
 * A lease whose clock says every state it takes in the console, from the
 * moment the clock exists (shared-clock-log.ts). An unlock makes the clock
 * first, in the same gesture, so it is watched before it is resumed. The
 * clock's rate goes to the AirPlay guess as it is first seen: made without
 * a rate of its own, it runs at the rate of the output WebKit's session had
 * then, which the app's own session cannot see (airplay-suspicion.ts). Then
 * only: the clock is never closed, so a clock made at launch keeps the rate
 * it had then, and the output is read again with a context made for the
 * purpose whenever it matters (output-check.ts).
 */
function sayingClockStates(lease: SharedAudioLease): SharedAudioLease {
  const watch = (context: AudioContext | null): AudioContext | null => {
    if (context === null) return context
    logClockStates(context, 'shared')
    notePageAudioContext(context)
    return context
  }
  return {
    ...lease,
    ensure: () => watch(lease.ensure()),
    unlock: () => {
      watch(lease.ensure())
      return lease.unlock()
    },
  }
}

export function createNativeDevice(): NativeDeviceApi {
  // A TV that draws the room's whole stage, on the phone that can give one.
  const tvStage = createTvStage()
  return {
    micStopsOtherApps: micStopsOtherApps(),
    acquireAudio: (owner, options) =>
      sayingClockStates(acquireSharedAudioContext(owner, options)),
    keepAwake: (on) => {
      // A phone without the plugin keeps its own sleep rules; nothing about
      // a song is worth an unhandled rejection.
      void keepAwake(on).catch(() => undefined)
    },
    holdAudioInBackground: (owner) => holdSharedAudioContextInBackground(owner),
    nowPlaying: (song) => {
      // As with keep-awake: a phone without the plugin shows nothing.
      void setNowPlaying(
        song === null ? null : { ...song, artwork: NOW_PLAYING_ARTWORK },
      ).catch(() => undefined)
    },
    // Each with where it came from: a press, iOS taking the sound, the
    // lyrics window (the room's line of who paused the song says it).
    onMediaAction: (handler) => onMediaAction(handler),
    pictureInPictureAutoEnter: (on) => {
      // A phone without the window leaves the app as it always did.
      void setPictureInPictureAutoEnter(on).catch(() => undefined)
    },
    onPictureInPicture: (handler) => onPictureInPicture(handler),
    ...(tvStage === null ? {} : { tvStage }),
    pictureInPictureLyrics: pictureInPictureNeedsLyrics()
      ? (script) => {
          // As with the window itself: a phone without it shows nothing.
          void setPictureInPictureLyrics(script).catch(() => undefined)
        }
      : null,
    // A TV showing the same lyrics, on the phone whose window draws them,
    // its clock for when no Now Playing report carries one, and a screen
    // connected at all: mirroring, which is not AirPlay alone.
    ...(pictureInPictureNeedsLyrics()
      ? {
          onTvLyrics: watchTv((state) => state.showing),
          tvLyricsClock: (clock) => {
            tellTheWindowTheClock(clock)
          },
          onExternalScreen: watchTv((state) => state.connected),
        }
      : {}),
    // The volume and the route: read only, and none on a phone without
    // the plugin (both answer null and nothing). The route alone as well,
    // which the latency offset follows for as long as the app runs.
    audioOutput: {
      read: () => readAudioOutput(),
      watch: (handler) => onAudioOutput(handler),
      watchRoute: (handler) => onAudioRoute(handler),
    },
    // The day's close's "Remind me tomorrow", in the build that has the
    // Ear Lab with Merc; folded out of every other with the room itself.
    ...(EAR_LAB_WITH_MERC ? { reminders: createNativeReminders() } : {}),
  }
}

/**
 * While iOS's lock-screen carrier holds the playback session, the silent
 * unlock clip stands aside, so the two never compete for the lock screen or
 * a headset's press (see standUnlockClipAside), and a press of play has the
 * carrier take the session in its place. Once, from `main.tsx`.
 */
export function standUnlockClipAsideForNowPlaying(): () => void {
  return onNowPlayingHoldsAudio((holds) => {
    // Aside, a press of play has the carrier take the session instead.
    standUnlockClipAside(holds, claimNowPlaying)
  })
}

/**
 * While the page's sound goes to AirPlay alone (airplay-suspicion.ts),
 * nothing plays beside the room's Web Audio: the lock screen's carrier
 * stands aside, and the unlock clip keeps quiet. Over AirPlay to the
 * owner's LG C2, Web Audio alone reached the TV, and Web Audio beside a
 * silent element kept local did not (the Developer screen's AirPlay sound
 * check, 6 Nov 2026). Both come back as the sound leaves AirPlay, and with
 * the song playing the carrier puts it back on the lock screen.
 *
 * Fail safe at each start: a press of play, or a tap that would play the
 * clip, checks where the sound goes first, inside its gesture, and only a
 * check that says it stays here lets either play (output-check.ts,
 * `checkForStart`). Where the check says AirPlay, or cannot run, both stand
 * aside (`webAudioAlone`) until a check says otherwise: the song is heard,
 * and the lock screen may go without it. A cold start with AirPlay already
 * on, its clock made at launch on the speaker, played neither on the TV nor
 * on the phone without this (mp-v0.8.57). Once, from `main.tsx`; the stop
 * puts both back and takes the check away.
 */
export function standAsideOnAirPlay(): () => void {
  return createRoot((dispose) => {
    checkBeforeEachStart(checkForStart)
    createEffect(
      on(webAudioAlone, (alone) => {
        keepUnlockClipQuiet(alone)
        standNowPlayingAside(alone)
      }),
    )
    onCleanup(() => {
      checkBeforeEachStart(null)
      keepUnlockClipQuiet(false)
      standNowPlayingAside(false)
    })
    return dispose
  })
}
