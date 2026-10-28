// ============================================================
// FirstNoteScreen: the First note exercise, on the shell's stack
// ============================================================
//
// The second Ear room (docs/plans/ear-rooms.md). The Sing room's picker and
// the Ear Lab's "With Merc" row push it, by id (premium-exercise-wiring.ts),
// and that tap has already started loading Merc's voice. NativeShell
// imports this file only on a build with the premium exercises
// (`PREMIUM_EXERCISES`), lazily, so the room and Merc's renderer load when
// it is first opened. Back pops it, and so does Done.
//
// It plays the example songs the app ships (native-only/karaoke/examples),
// from their stems at the app's own origin, or the singer's own songs from
// the phone's store, over the Karaoke room's theatre. The room sings Merc
// with his sampled voice, Echo's (merc-sampler.ts): the screen hands it in,
// so the room's feature reaches into no other feature. Until his set has
// loaded the call goes to the synth "ooh", as Echo's does.
//
// The two ways out to the Karaoke room, both the owner's requests (28 Oct
// 2026), are the screen's too, since only the shell can change the tab:
//
//   Sing on in Karaoke   the song on the Karaoke room's stage, playing from
//                        the place the singer came in on
//   Sing your own songs  for a singer with none split yet: the room's
//                        songs, where Import is, the way to Cloud
//
// Opening is the choice: the screen records First note as the last
// exercise the moment it mounts, as LongNoteScreen does for Long note.

import type { JSX } from 'solid-js'
import { onMount } from 'solid-js'
import { MERC_CALL } from '@/features/echo/merc-sampler'
import { FirstNoteRoom } from '@/features/first-note/FirstNoteRoom'
import { requestKaraokeLibrary, requestKaraokeSong, } from '@/features/karaoke-room/karaoke-room-store'
import { rememberLastExercise } from '@/features/premium-exercises/last-exercise'
import { TAB_KARAOKE } from '@/features/tabs/constants'
import { EXERCISE_FIRST_NOTE_STAGE } from '@/lib/domain/exercise-contracts'
import { popScreen } from './run-shell-store'
import { goToTab } from './shell-navigation'

export function FirstNoteScreen(): JSX.Element {
  onMount(() => rememberLastExercise(EXERCISE_FIRST_NOTE_STAGE))
  return (
    <FirstNoteRoom
      onDone={popScreen}
      voice={MERC_CALL}
      onSingOn={(sessionId, seconds) => {
        requestKaraokeSong(sessionId, { seekSec: seconds })
        goToTab(TAB_KARAOKE)
      }}
      onOwnSongs={() => {
        requestKaraokeLibrary()
        goToTab(TAB_KARAOKE)
      }}
    />
  )
}
