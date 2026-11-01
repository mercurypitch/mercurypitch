// ============================================================
// useKaraokeNotesReading — the room's songs read for their notes, at rest
// ============================================================
//
// The room asks its notes reader (karaoke-notes-reader.ts) to read while it
// is at rest and lets go the moment it is not, as First note's room does
// with its own read (FirstNoteRoom.tsx): the read walks a vocal and runs the
// pitch read on the thread that draws the screen, so it must never compete
// with a song or a voice.
//
// At rest is all of these: the examples seeded, so their notes are there to
// be seen; a song on the stage that has loaded and is not playing; the app
// on the screen, and not in the small window; the mixer not reading notes
// of its own; Find by singing not listening; and no capture holding the
// microphone (micManager: the stem mixer's, Find by singing's, voice
// control's, any other's), save a hold that keeps the device open between
// two surfaces and captures nothing (BACKGROUND_HOLD_IDS). Anything else
// stops the read in flight, which is read again from its start at the next
// rest, and the room going stops it for good.
//
// What stopped a read is told to the console with it, so a phone's log says
// why a song was not ready.

import type { Accessor } from 'solid-js'
import { createEffect, createSignal, onCleanup, untrack } from 'solid-js'
import type { HostedMixerControls } from '@/components/stem-mixer-hosting'
import { BACKGROUND_HOLD_IDS, micManager } from '@/lib/mic-manager'
import { karaokeNotesWaiting, readKaraokeNotes, stopReadingKaraokeNotes, } from './karaoke-notes-reader'

export interface KaraokeNotesReadingDeps {
  /** The bundled examples are in the library, with their notes. */
  readonly seeded: Accessor<boolean>
  /** The song on the stage's mixer, once it has handed its controls over. */
  readonly mixer: Accessor<HostedMixerControls | null>
  /** The page is hidden: the app is behind another, or the phone locked. */
  readonly pageHidden: Accessor<boolean>
  /** The room is in the small window (picture-in-picture). */
  readonly inWindow: Accessor<boolean>
  /** Find by singing holds the mic, or is about to. */
  readonly findListening: Accessor<boolean>
}

/** Why the room is not at rest, in words for the console; null at rest. */
function busyWith(
  deps: KaraokeNotesReadingDeps,
  capturing: boolean,
): string | null {
  if (!deps.seeded()) return 'the examples are still being put in'
  const mixer = deps.mixer()
  if (mixer === null || mixer.loading()) return 'a song is loading'
  if (mixer.playing()) return 'a song is playing'
  if (mixer.findingNotes()) return 'the mixer is reading its own notes'
  if (deps.pageHidden()) return 'the app is hidden'
  if (deps.inWindow()) return 'the room is in the small window'
  if (deps.findListening()) return 'Find by singing is listening'
  if (capturing) return 'the microphone is on'
  return null
}

/** Read the room's songs for their notes while it rests. Call in the room. */
export function useKaraokeNotesReading(deps: KaraokeNotesReadingDeps): void {
  const [holders, setHolders] = createSignal<readonly string[]>([])
  onCleanup(
    micManager.subscribe((state) => {
      setHolders(state.consumers)
    }),
  )
  const capturing = (): boolean =>
    holders().some((id) => !BACKGROUND_HOLD_IDS.includes(id))

  createEffect(() => {
    const busy = busyWith(deps, capturing())
    if (busy !== null) {
      untrack(() => {
        stopReadingKaraokeNotes(busy)
      })
      return
    }
    // A song turning up waiting at rest is read too: one just separated,
    // or the session store loading after the room opened.
    karaokeNotesWaiting()
    untrack(readKaraokeNotes)
  })
  onCleanup(() => {
    stopReadingKaraokeNotes('the room closed')
  })
}
