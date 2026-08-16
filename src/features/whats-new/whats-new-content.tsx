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
import { Cloud, DeviceSync, Guitar, PianoKeys, Trophy, Voice, } from '@/components/icons'

export interface ReleaseHighlight {
  id: string
  title: string
  icon: () => JSX.Element
  /** What it is, in two or three sentences of plain language. */
  body: string
  /** The shortest real path to trying it. */
  tryIt: string
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
    'Two new rooms, a record of your practice that outlives the tab, and a library that travels with you.',
  highlights: [
    {
      id: 'progress',
      title: 'A Progress tab',
      icon: () => <Trophy />,
      body: 'Practice used to end when you closed the tab. Progress is the record it leaves: one honest moment picked out of your history, the evidence behind it, and a way straight back to the practice that can carry it forward. It reads as a map — the Resonance Atlas — and it is built from takes you have already sung, so it has something to say on the first visit rather than after a month.',
      tryIt:
        'Open the Progress tab. There is a share composer on the Mercury Pressing plate when a moment is worth showing someone.',
    },
    {
      id: 'piano-night',
      title: 'Piano Night',
      icon: () => <PianoKeys />,
      body: 'A room for the keyboard, the way Guitar Night is one for the guitar. It plays the music already on your device, and a connected MIDI keyboard can be mapped and practised against. The falling notes were tuned for tablets — the screen most people actually prop up on a piano.',
      tryIt:
        'Piano Night is in the Play group. Connect a MIDI keyboard first if you have one; it is offered on arrival.',
    },
    {
      id: 'guitar-night',
      title: 'Guitar Night has a rehearsal stage',
      icon: () => <Guitar />,
      body: 'The score room is stage-first now: it sounds the written part instead of playing a drum kit over silence, on a bass voice when the stage is showing a bass. There is a selectable string highway, a Jam Doctor that belongs to the stage, and phrase review tied to what you actually played rather than to the whole song.',
      tryIt:
        'Open Guitar Night and stage a score. Play a phrase, then open phrase review to see that phrase judged on its own.',
    },
    {
      id: 'library-travels',
      title: 'Your library follows you between devices',
      icon: () => <DeviceSync />,
      body: 'Sign in on a phone and the songs you separated on the desktop are listed there. Only the list travels — title, length, which stems exist — never the audio, which is your own material and stays on the device that made it. Songs the phone cannot play yet are marked as such rather than quietly missing. Two devices on the same network can also send a song straight across.',
      tryIt:
        'Sign in, open Karaoke, and look at your library. To move the audio itself, use the send-to-device door on the Karaoke Night rail.',
    },
    {
      id: 'drive-backup',
      title: 'Back your library up to your own Google Drive',
      icon: () => <Cloud />,
      body: 'Songs go into a plain folder in your Drive, in a format you can read without this app. It is your storage and your copy: nothing is uploaded to us, and a backup you can open elsewhere is the only kind worth trusting.',
      tryIt:
        'Settings, then Sync. The new Sync page also reports how much storage this browser has granted and whether your library is protected from eviction.',
    },
    {
      id: 'guided-voice',
      title: 'Guided Voice analysis',
      icon: () => <Voice />,
      body: 'The foundation for coach-led vocal work inside the app: local assessment that runs on your device, with the safety rails a voice needs built in rather than bolted on afterwards.',
      tryIt:
        'It shows up where the app already listens to you — the Analysis tab, and the guided practice flows.',
    },
  ],
  alsoIn: [
    'The tabs are grouped by what you came to do — four groups instead of one long row.',
    'The app adapts to televisions and slower devices, so a session on a living-room screen behaves like one.',
    'Loading stems shows real progress instead of counting whole stems and appearing to stall.',
    'Compose fits on a phone: the editor header no longer stacks five rows of controls above the notes.',
    'The guide vocal has its own microphone control, separate from everything else that makes noise.',
    'Notifications are one plain row at half the size, and no longer call everything an "Update".',
    'The microphone is asked for once, at your first practice, instead of on arrival.',
    'Every tab is reachable on a phone — the More sheet’s rows have labels again.',
  ],
}
