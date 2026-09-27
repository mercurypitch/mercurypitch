// ============================================================
// The Karaoke room's memory: what it keeps across an unmount
// ============================================================
//
// The room is a tab, and a tab unmounts every time the singer leaves it. What
// must survive that lives here, at module scope, for the life of the app:
//
//   - the song on the stage, so coming back shows the same one;
//   - a parked song's place and its guide vocal, so a run the shell parked
//     comes back paused where it stopped (plan S8 §4.2);
//   - a song the studio handed back, until the room takes it (§11).
//
// The music level needs nothing here: the mixer keeps that one itself
// (`master-headroom.ts`), for every song.
//
// What must survive a relaunch is persisted:
//
//   - the last song sung, which the room cues on arrival (D1 A);
//   - the three settings the Options sheet holds. The lyrics size and the
//     notes share zen's own keys (plan §4.3), so a singer who set them in
//     the studio's player finds them set here.

import { createSignal, untrack } from 'solid-js'
import type { GuideLevel } from '@/components/stem-mixer-hosting'
import type { ZenLyricsSize } from '@/features/stem-mixer/zen-navigation'
import { ZEN_LYRICS_SIZES } from '@/features/stem-mixer/zen-navigation'
import { createPersistedSignal } from '@/lib/storage'

/** The session id of the last song the singer played in the room. */
export const KARAOKE_LAST_SONG_KEY = 'karaoke-room-last-song'
export const KARAOKE_PLAY_NEXT_KEY = 'karaoke-room-play-next'
export const KARAOKE_LYRICS_SIZE_KEY = 'sm-zen-lyrics-size'
export const KARAOKE_NOTE_GLYPHS_KEY = 'sm-zen-note-glyphs'
export const KARAOKE_PINNED_KEY = 'karaoke-room-pinned'

/** The options a singer can pin beside the gear, or none. */
export const KARAOKE_PINNABLE = ['lyrics-size', 'notes', 'play-next'] as const
export type KaraokePinnable = (typeof KARAOKE_PINNABLE)[number]
export type KaraokePinned = KaraokePinnable | 'none'

const isPinned = (value: unknown): value is KaraokePinned =>
  value === 'none' || (KARAOKE_PINNABLE as readonly unknown[]).includes(value)

/** What the Options sheet and the header call each lyrics size. */
export const KARAOKE_LYRICS_SIZE_LABELS: Record<ZenLyricsSize, string> = {
  smaller: 'Small',
  current: 'Medium',
  bigger: 'Large',
}

const isLyricsSize = (value: unknown): value is ZenLyricsSize =>
  (ZEN_LYRICS_SIZES as readonly unknown[]).includes(value)
const isBoolean = (value: unknown): value is boolean =>
  typeof value === 'boolean'

/** "Play the next song automatically": on, as zen's autoplay is (§5). */
const [playNext, setPlayNextSignal] = createPersistedSignal<boolean>(
  KARAOKE_PLAY_NEXT_KEY,
  true,
  { validator: isBoolean },
)
const [lyricsSize, setLyricsSizeSignal] = createPersistedSignal<ZenLyricsSize>(
  KARAOKE_LYRICS_SIZE_KEY,
  'current',
  { validator: isLyricsSize },
)
const [noteGlyphs, setNoteGlyphsSignal] = createPersistedSignal<boolean>(
  KARAOKE_NOTE_GLYPHS_KEY,
  false,
  { validator: isBoolean },
)

/**
 * The one option beside the gear (owner, 27 Sep). None by default: the
 * header stays Back, the room and the gear until the singer asks for more.
 */
const [pinned, setPinnedSignal] = createPersistedSignal<KaraokePinned>(
  KARAOKE_PINNED_KEY,
  'none',
  { validator: isPinned },
)

export const karaokePinned = pinned

export function setKaraokePinned(choice: KaraokePinned): void {
  setPinnedSignal(choice)
}

export const karaokePlayNext = playNext
export const karaokeLyricsSize = lyricsSize
export const karaokeNoteGlyphs = noteGlyphs

export function setKaraokePlayNext(on: boolean): void {
  setPlayNextSignal(on)
}

export function setKaraokeLyricsSize(size: ZenLyricsSize): void {
  setLyricsSizeSignal(size)
}

export function setKaraokeNoteGlyphs(on: boolean): void {
  setNoteGlyphsSignal(on)
}

/** The last song sung, or null on a first visit. */
export function lastSungSong(): string | null {
  try {
    const id = localStorage.getItem(KARAOKE_LAST_SONG_KEY)
    return id === null || id === '' ? null : id
  } catch {
    return null
  }
}

export function rememberSungSong(sessionId: string): void {
  try {
    localStorage.setItem(KARAOKE_LAST_SONG_KEY, sessionId)
  } catch {
    // A phone out of space still sings; the next arrival cues the first song.
  }
}

/** Where a parked song stopped. */
export interface ParkedSong {
  readonly sessionId: string
  /** Seconds into the song. */
  readonly seconds: number
  /** The guide vocal as it was, or null when the mixer never said. */
  readonly guide: GuideLevel | null
}

const [stagedSong, setStagedSong] = createSignal<string | null>(null)
let parkedSong: ParkedSong | null = null

/** The song on the stage when the room last had one. */
export const karaokeStagedSong = stagedSong

export function setKaraokeStagedSong(sessionId: string | null): void {
  setStagedSong(sessionId)
}

export function parkKaraokeSong(place: ParkedSong): void {
  parkedSong = place
}

/** The parked song, once: coming back takes it, and a stop drops it. */
export function takeParkedKaraokeSong(): ParkedSong | null {
  const place = parkedSong
  parkedSong = null
  return place
}

/**
 * A song the studio handed back (plan S8 §11): the room puts it on the
 * stage, playing. One request at a time; the room takes it once.
 */
export interface KaraokeSongRequest {
  readonly sessionId: string
}

const [songRequest, setSongRequest] = createSignal<KaraokeSongRequest | null>(
  null,
)

/** The song the studio last handed back and the room has not taken yet. */
export const karaokeSongRequest = songRequest

/**
 * Hand a song to the room. It is also the song on the stage from here on,
 * so a room that is not on the screen arrives on it.
 */
export function requestKaraokeSong(sessionId: string): void {
  setStagedSong(sessionId)
  setSongRequest({ sessionId })
}

/** The request, once: taking it clears it. */
export function takeKaraokeSongRequest(): KaraokeSongRequest | null {
  const request = untrack(songRequest)
  if (request !== null) setSongRequest(null)
  return request
}

/** Tests only: a room that has never been visited, with every default. */
export function resetKaraokeRoomForTests(): void {
  parkedSong = null
  setStagedSong(null)
  setSongRequest(null)
  setPlayNextSignal(true)
  setLyricsSizeSignal('current')
  setNoteGlyphsSignal(false)
  setPinnedSignal('none')
  try {
    localStorage.removeItem(KARAOKE_PINNED_KEY)
    localStorage.removeItem(KARAOKE_PLAY_NEXT_KEY)
    localStorage.removeItem(KARAOKE_LYRICS_SIZE_KEY)
    localStorage.removeItem(KARAOKE_NOTE_GLYPHS_KEY)
  } catch {
    // Nothing persisted to clear.
  }
}
