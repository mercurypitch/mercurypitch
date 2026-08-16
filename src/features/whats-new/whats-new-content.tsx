// ============================================================
// What's New — the v0.9.0 release, in the visitor's terms
// ============================================================
//
// Content, not code. Every entry is drawn from the CHANGELOG's Unreleased
// section, cut down to the handful somebody would actually change their
// evening over — a release page that lists twenty-nine bullets is a
// changelog, and there is already one of those.
//
// Each entry answers two questions in order: what is it, and what do I do
// to try it. The second is the one that gets a feature used, so `tryIt`
// names real controls; if a `tryIt` here cannot be followed by looking at
// the app, this file is wrong and should be fixed rather than reworded.

import type { JSX } from 'solid-js'
import { Cloud, DeviceSync, Guitar, Mic, PianoKeys, Trophy, WaveformBars, } from '@/components/icons'
import { openMercurySing } from '@/features/mercury-sing/mercury-sing-store'
import { PIANO_NIGHT_PATH } from '@/features/piano-night/route'
import { TAB_PROGRESS } from '@/features/tabs/constants'
import { navigateTo } from '@/lib/hash-router'
import { openSettingsSection, setActiveTab } from '@/stores/ui-store'

/** The standalone Guitar Night room. No constant of its own yet; the two
 *  in-app doors to it (GuitarPage) hard-code the same path. */
const GUITAR_NIGHT_PATH = '/guitar-night'

/**
 * The night rooms are their own pages, not tabs, so reaching one is a real
 * navigation out of the app shell — the same thing the "karaoke night" voice
 * command does. Worth it: the room IS the feature being announced, and a
 * reader who has to go hunting for it mostly does not.
 */
function openNightRoom(path: string): void {
  window.location.assign(path)
}

export interface ReleaseHighlight {
  id: string
  title: string
  icon: () => JSX.Element
  /** What it is, in two or three sentences of plain language. */
  body: string
  /** The shortest real path to trying it. */
  tryIt: string
  /**
   * Optional: take the reader there. Reading "open the Progress tab" on a
   * phone and then having to go find it is most of the reason a release
   * page gets closed without anything being tried.
   */
  go?: { label: string; run: () => void }
}

export interface Release {
  version: string
  /** Display date. Written down rather than computed — a release has one. */
  date: string
  /** One line for the whole release, above the highlights. */
  headline: string
  highlights: ReleaseHighlight[]
  /** Everything else worth a sentence, without its own card. */
  alsoIn: string[]
}

export const RELEASE_0_9_0: Release = {
  version: '0.9.0',
  date: 'August 2026',
  headline:
    'Two rooms for players, a record of your practice that outlives the tab, your library on every device, and an app you can talk to.',
  highlights: [
    {
      id: 'progress',
      title: 'A Progress tab',
      icon: () => <Trophy />,
      body: 'Practice used to end when you closed the tab. Progress is the record it leaves: one honest moment picked out of your history, the evidence behind it, and a way straight back to the practice that can carry it forward. It reads as a map rather than a wall of cards, and it is built from takes you have already sung, so it has something to say on your first visit.',
      tryIt: 'Everything you have already sung is in there now.',
      go: {
        label: 'Open Progress',
        run: () => {
          setActiveTab(TAB_PROGRESS)
        },
      },
    },
    {
      id: 'voice-commands',
      title: 'Talk to the app',
      icon: () => <Mic />,
      body: 'Say "play", "stop", "pause", "rewind", "faster" — and the app does it, whether you are in the mixer, on the Guitar Night or Karaoke Night stage, or anywhere in the app itself. It is built for the moment your hands are on an instrument and your phone is across the room.',
      tryIt:
        'Tap the mic pill in the bottom-left corner to start listening — its cog sets everything up — or press V, and Shift+V for the list of what it understands.',
      go: {
        label: 'Voice settings',
        run: () => {
          openSettingsSection('singing', 'voice-control')
        },
      },
    },
    {
      id: 'mercury-sing',
      title: 'Mercury Sing — find a song by singing it',
      icon: () => <WaveformBars />,
      body: 'Sing it, hum the melody, or say a line of the lyrics, and the app finds that song in your own library and opens it ready to play. Say "Shazam sing" or "name that song" from anywhere. It needs a reasonably modern browser for the on-device listening, and tells you plainly when a device cannot do it.',
      tryIt:
        'Separate a song or two first — it searches what you already have — then hum a chorus.',
      go: {
        label: 'Find a song',
        run: () => {
          openMercurySing()
        },
      },
    },
    {
      id: 'piano-night',
      title: 'Piano Night',
      icon: () => <PianoKeys />,
      body: 'A room for keyboard players. It plays the music already on your device, and a connected MIDI keyboard can be mapped and practised against, with falling notes that were tuned for tablets — the screen most people actually prop up on a piano.',
      tryIt:
        'Connect a MIDI keyboard first if you have one — it is offered on arrival. There is a door to the room in the Piano tab too.',
      go: {
        label: 'Open Piano Night',
        run: () => {
          openNightRoom(PIANO_NIGHT_PATH)
        },
      },
    },
    {
      id: 'guitar-night',
      title: 'Guitar Night',
      icon: () => <Guitar />,
      body: 'A room for guitarists. Load a score and play along on the view that suits you — a 3D stage, a flat fretboard, or written tab — with a built-in tuner, and a Jam Doctor that listens to what you actually played and tells you where it drifted, phrase by phrase rather than as one verdict on the whole song.',
      tryIt:
        'Tune up first, then stage a score and play a phrase. There is a door to the room in the Guitar tab too.',
      go: {
        label: 'Open Guitar Night',
        run: () => {
          openNightRoom(GUITAR_NIGHT_PATH)
        },
      },
    },
    {
      id: 'library-travels',
      title: 'Your library, on every device',
      icon: () => <DeviceSync />,
      body: 'Sign in and your songs and playlists show up on every device on your account — phone, tablet, computer, TV. When you want the audio itself on another device, send it straight across: phone or tablet to the TV, computer to your phone, any direction you need.',
      tryIt:
        'Sign in, then use send/receive — beside the upload box here, or on the Karaoke Night rail.',
      go: {
        label: 'Open Karaoke',
        run: () => {
          navigateTo({ type: 'uvr-upload' })
        },
      },
    },
    {
      id: 'drive-backup',
      title: 'Back your library up to your own Google Drive',
      icon: () => <Cloud />,
      body: 'Songs go into a plain folder in your Drive, in a format you can read without this app. It is your storage and your copy, and a backup you can open elsewhere is the only kind worth trusting.',
      tryIt:
        'Settings, then Sync. That page also reports how much room this browser has given the library.',
      go: {
        label: 'Drive settings',
        run: () => {
          openSettingsSection('sync', 'drive-backup')
        },
      },
    },
  ],
  alsoIn: [
    'Loading a separated song shows real progress instead of counting whole stems and appearing to stall.',
    'The app adapts to televisions and slower devices, so a session on a living-room screen behaves like one.',
    'Compose fits on a phone — the editor header no longer stacks five rows of controls above the notes.',
    'The tabs are grouped by what you came to do, instead of one long row.',
    'The guide vocal has its own microphone control, separate from everything else that makes noise.',
    'Notifications are one plain row at half the size, and no longer call everything an "Update".',
    'The microphone is asked for once, at your first practice, instead of on arrival.',
  ],
}
