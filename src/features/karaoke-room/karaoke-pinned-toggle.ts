// ============================================================
// The one room option beside the gear, as it is now
// ============================================================
//
// The singer pins one of the room's options next to the gear
// (KaraokeRoomOptions.tsx): the text size, the notes over the lyrics, or
// Play next. This is that button as the shell draws it, read fresh each
// time the shell asks (KaraokeRoomStage.tsx registers it with the run's
// controls). The notes are there for every song their row is there for,
// with a ring while they are read.

import { cycleLyricsSize } from '@/features/stem-mixer/zen-navigation'
import type { PinnedRoomToggle } from '@/stores/native-shell-store'
import { KARAOKE_LYRICS_SIZE_LABELS, karaokeLyricsSize, karaokePinned, karaokePlayNext, setKaraokeLyricsSize, setKaraokePlayNext, } from './karaoke-room-store'
import type { KaraokeNotesOption } from './KaraokeRoomOptions'

export function pinnedRoomToggle(
  notes: KaraokeNotesOption,
): PinnedRoomToggle | null {
  switch (karaokePinned()) {
    case 'lyrics-size':
      return {
        icon: 'lyrics-size',
        label: `Text size: ${KARAOKE_LYRICS_SIZE_LABELS[karaokeLyricsSize()]}`,
        onToggle: () => {
          setKaraokeLyricsSize(cycleLyricsSize(karaokeLyricsSize()))
        },
      }
    case 'notes':
      return notes.offered()
        ? {
            icon: 'notes',
            label: 'Show notes over the lyrics',
            pressed: notes.on(),
            progress: notes.finding() ? notes.progress() : undefined,
            onToggle: notes.toggle,
          }
        : null
    case 'play-next':
      return {
        icon: 'play-next',
        label: 'Play the next song automatically',
        pressed: karaokePlayNext(),
        onToggle: () => {
          setKaraokePlayNext(!karaokePlayNext())
        },
      }
    default:
      return null
  }
}
