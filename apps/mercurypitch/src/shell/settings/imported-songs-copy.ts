// ============================================================
// The words for the singer's own Karaoke songs, in Settings and Storage
// ============================================================
//
// Settings, Karaoke ("Songs on this phone") and Storage ("Imported songs")
// say the same things about the same songs (plan S8 §9), so they say them
// from here. Songs, never credits.

import type { ImportedSongs } from '@/features/karaoke-room/karaoke-imported-songs'
import { formatBytes } from './storage-facts'

const songsWord = (count: number): string =>
  `${count} ${count === 1 ? 'song' : 'songs'}`

/** Settings: "7 songs · 71.2 MB"; the count alone when a size was never
 *  recorded, and "None" with none. */
export function importedSongsValue(songs: ImportedSongs): string {
  if (songs.count === 0) return 'None'
  return songs.bytes === null
    ? songsWord(songs.count)
    : `${songsWord(songs.count)} · ${formatBytes(songs.bytes)}`
}

/** Storage's line under "Imported songs" (mock 9c). */
export function importedSongsStorageLine(count: number): string {
  return count === 0
    ? 'None on this phone'
    : `${songsWord(count)}. The originals are still in Files.`
}

/** The question before removing them all, and what it leaves. */
export function removeImportedQuestion(count: number): {
  title: string
  text: string
} {
  return {
    title: `Remove ${count} imported ${count === 1 ? 'song' : 'songs'}?`,
    text: 'Their voice and music leave this phone. The originals are still in Files, and the example songs stay.',
  }
}

/** Said when some of them could not be removed. */
export function songsStuckLine(stuck: number): string {
  return stuck === 1
    ? '1 song could not be removed. It is still on this phone.'
    : `${stuck} songs could not be removed. They are still on this phone.`
}
