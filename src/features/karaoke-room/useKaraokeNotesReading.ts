// ============================================================
// useKaraokeNotesReading — the room's songs read for their notes, at rest
// ============================================================
//
// The room asks its notes reader (karaoke-notes-reader.ts) to read while it
// is at rest and lets go the moment it is not, as First note's room does
// with its own read (FirstNoteRoom.tsx): the read walks a vocal and runs the
// pitch read on the thread that draws the screen, so it must never compete
// with a song or a voice being heard.
//
// At rest is all of these: the examples seeded, so their notes are there to
// be seen; a song on the stage that has loaded and is not playing; the app
// on the screen, not in the small window, and not under a screen the shell
// pushed over the tab (tabCoveredByShell); the mixer not reading notes of
// its own; Find by singing not listening; and nothing capturing from the
// microphone (micManager). Three holds on the mic are not captures for this:
// one that keeps the device open and captures nothing (BACKGROUND_HOLD_IDS);
// the stage's own, which scores only while a song plays, when the read is
// stopped anyway; and voice control's, listening for its wake word. The read
// uses no mic, and gives the screen its moments as it goes.
//
// A read starts only after REST_DELAY_MS of rest, so a pause between two
// presses of play does not walk a vocal it throws away. Anything else stops
// the read in flight, which is read again from its start at the next rest,
// and the room going stops it for good. Why the room holds back is the
// reader's to say (`karaokeNotesHold`), for the console and the find sheet.

import type { Accessor } from 'solid-js'
import { createEffect, createMemo, createSignal, onCleanup, untrack, } from 'solid-js'
import type { HostedMixerControls } from '@/components/stem-mixer-hosting'
import { BACKGROUND_HOLD_IDS, micManager } from '@/lib/mic-manager'
import { tabCoveredByShell } from '@/stores/native-shell-store'
import type { NotesHold } from './karaoke-notes-reader'
import { karaokeNotesWaiting, readKaraokeNotes, stopReadingKaraokeNotes, } from './karaoke-notes-reader'

/** How long the room rests before a read starts, ms. */
export const REST_DELAY_MS = 3000

/** The stage's own hold on the mic (useStemMixerMicController.ts). */
const STAGE_MIC = 'stem-mixer'
/** Voice control's holds: 'voice-control#1' and on (local-whisper-listener.ts). */
const VOICE_CONTROL_MIC = 'voice-control#'

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

/** A hold on the mic that is not a capture for the read (see the header). */
function capturesNothingHere(id: string): boolean {
  return (
    BACKGROUND_HOLD_IDS.includes(id) ||
    id === STAGE_MIC ||
    id.startsWith(VOICE_CONTROL_MIC)
  )
}

/** Why the room is not at rest; null at rest. */
function busyWith(
  deps: KaraokeNotesReadingDeps,
  capturing: boolean,
): NotesHold | null {
  if (!deps.seeded()) return 'seeding'
  const mixer = deps.mixer()
  if (mixer === null || mixer.loading()) return 'loading'
  if (mixer.playing()) return 'playing'
  if (mixer.findingNotes()) return 'mixer'
  if (deps.pageHidden()) return 'hidden'
  if (deps.inWindow()) return 'window'
  if (tabCoveredByShell()) return 'covered'
  if (deps.findListening()) return 'find'
  if (capturing) return 'capture'
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
    holders().some((id) => !capturesNothingHere(id))
  const busy = createMemo(() => busyWith(deps, capturing()))

  // Set once the room has rested REST_DELAY_MS; anything else unsets it.
  const [rested, setRested] = createSignal(false)
  let timer: ReturnType<typeof setTimeout> | undefined
  createEffect(() => {
    const why = busy()
    clearTimeout(timer)
    setRested(false)
    untrack(() => {
      stopReadingKaraokeNotes(why ?? 'settling')
    })
    if (why !== null) return
    timer = setTimeout(() => {
      setRested(true)
    }, REST_DELAY_MS)
  })
  // A song turning up waiting at rest is read too: one just separated, or
  // the session store loading after the room opened.
  createEffect(() => {
    if (!rested()) return
    karaokeNotesWaiting()
    untrack(readKaraokeNotes)
  })
  onCleanup(() => {
    clearTimeout(timer)
    stopReadingKaraokeNotes('closed')
  })
}
