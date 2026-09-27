// ============================================================
// The Karaoke room's library: one list, songs named as songs
// ============================================================
//
// Plan S8 §3. The singer's own songs first, newest first, then the examples
// in the order the bundle carries them. One vertical list: no group tabs, no
// playlists in V1.
//
// A row is a song, not a file (audit K7). An example is its title and its
// artist, with the credit its licence asks for wherever it is shown; the
// session row's own name is the file name the old tab showed, and is never
// used here. A song of the singer's own has no tags to read yet, so its title
// is the file's name without the extension until import reads them (§6).

import type { DemoSongManifest } from '@/features/karaoke-night/demo-song'
import { demoIsPlayable, demoSessionId, } from '@/features/karaoke-night/demo-song'
import { isExampleSession } from '@/features/karaoke-night/examples-library'
import { exampleManifests } from '@/features/karaoke-night/seed-examples'
import { ensureSessionHydrated } from '@/features/stem-mixer/karaoke-playlist-runner'
import type { UvrSession } from '@/stores/uvr-store'
import { getAllUvrSessionsReactive } from '@/stores/uvr-store'

/** Both stems, as URLs the mixer can open. */
export interface RoomStems {
  readonly vocal: string
  readonly instrumental: string
}

/** One song in the room's library. */
export interface RoomSong {
  readonly sessionId: string
  readonly title: string
  readonly artist: string | null
  readonly durationSec: number | null
  /** What the licence asks to be shown with the song, or null. */
  readonly credit: string | null
  readonly kind: 'example' | 'yours'
  readonly stems: RoomStems
}

/** "Josh Woodward · CC BY 4.0": the artist, then the licence. */
export function exampleCredit(manifest: DemoSongManifest): string | null {
  const artist = manifest.artist.trim()
  const license = (manifest.attribution?.license ?? '').trim()
  if (artist === '' && license === '') return null
  if (license === '') return artist
  if (artist === '') return license
  return `${artist} · ${license}`
}

function exampleSong(manifest: DemoSongManifest): RoomSong {
  return {
    sessionId: demoSessionId(manifest.slug),
    title: manifest.title,
    artist: manifest.artist.trim() === '' ? null : manifest.artist,
    durationSec: manifest.durationSec ?? null,
    credit: exampleCredit(manifest),
    kind: 'example',
    stems: {
      vocal: manifest.stems.vocal ?? '',
      instrumental: manifest.stems.instrumental ?? '',
    },
  }
}

const withoutExtension = (name: string): string =>
  name.replace(/\.[a-z0-9]{1,5}$/iu, '').trim()

function stemDuration(session: UvrSession): number | null {
  const meta = session.stemMeta
  const seconds = meta?.vocal?.duration ?? meta?.instrumental?.duration
  return typeof seconds === 'number' && seconds > 0 ? seconds : null
}

/** A song of the singer's own that can be sung: separated, both stems. */
function ownSong(session: UvrSession): RoomSong | null {
  if (session.status !== 'completed') return null
  if (isExampleSession(session)) return null
  const vocal = session.outputs?.vocal ?? ''
  const instrumental = session.outputs?.instrumental ?? ''
  if (vocal === '' || instrumental === '') return null
  const title = withoutExtension(session.originalFile?.name ?? '')
  return {
    sessionId: session.sessionId,
    title: title === '' ? 'Untitled song' : title,
    artist: null,
    durationSec: stemDuration(session),
    credit: null,
    kind: 'yours',
    stems: { vocal, instrumental },
  }
}

/**
 * The library, in the order the sheet lists it and Next steps through it.
 * Reactive: the session store and the examples' manifests are both signals.
 */
export function roomLibrary(): RoomSong[] {
  const yours = getAllUvrSessionsReactive()
    .map((session) => ({ session, song: ownSong(session) }))
    .filter(
      (entry): entry is { session: UvrSession; song: RoomSong } =>
        entry.song !== null,
    )
    .sort((left, right) => right.session.createdAt - left.session.createdAt)
    .map((entry) => entry.song)
  const examples = exampleManifests().filter(demoIsPlayable).map(exampleSong)
  return [...yours, ...examples]
}

/**
 * The song's stems, playable now. An example's are packaged files; a song of
 * the singer's own keeps its stems in the local db, and the URLs its row
 * carries die with the page that minted them, so they are minted again.
 */
export async function hydrateSong(song: RoomSong): Promise<RoomStems> {
  if (song.kind === 'example') return song.stems
  const session = getAllUvrSessionsReactive().find(
    (candidate) => candidate.sessionId === song.sessionId,
  )
  if (session === undefined) return song.stems
  const hydrated = await ensureSessionHydrated(session)
  return {
    vocal: hydrated.outputs?.vocal ?? song.stems.vocal,
    instrumental: hydrated.outputs?.instrumental ?? song.stems.instrumental,
  }
}
