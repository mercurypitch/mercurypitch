// ============================================================
// The Karaoke room's library sheet (plan S8 §3, audit K7)
// ============================================================
//
// Opened from the song's title. It replaces zen's song sheet in the room:
// that one listed `originalFile.name`, so an example read as a file name and
// had no credit. Here a row is a song: its title, its artist or the credit
// its licence asks for, and its length. The song on the stage is marked, and
// a tap on another cues it.
//
// One vertical list, your songs first and then the examples. No group tabs,
// no playlists (the studio keeps those), and nothing that scrolls sideways:
// a long title wraps.
//
// Where songs can be imported (Stage 2, KARAOKE_IMPORT), Import heads the
// sheet, the queue's rows sit at the top of your songs with what each one
// waits for, a new song carries a dot until it is first sung, and each
// imported song has one menu item: Remove from this phone (plan §3, §6.4).
// All of that is KaraokeLibraryImports.tsx, reached only through the
// stand-ins below: each is a plain conditional on the constant, which a
// store build folds to nothing, and the Stage 2 modules drop out of it whole
// (apps/mercurypitch/vite.config.ts; assert-bundle.mjs STAGE 2 proves it).
// A `<Show when={KARAOKE_IMPORT}>` would not: its children are a function
// Rollup cannot see through, so they would stay in the store build.

import type { Component } from 'solid-js'
import { createSignal, For, Show } from 'solid-js'
import { Sheet } from '@/components/mobile/Sheet'
import { theDevice } from '@/lib/device-noun'
import { KARAOKE_IMPORT } from '@/lib/native-build'
import styles from './karaoke-room.module.css'
import { NoteGlyph } from './karaoke-room-glyphs'
import type { RoomSong } from './karaoke-room-library'
import type { ImportedSongMenuProps } from './KaraokeLibraryImports'
import { ImportedSongMenu, LibraryImportHead, libraryQueueLength, LibraryQueueRows, SongNewMark, } from './KaraokeLibraryImports'

/** "4:06": minutes and two-digit seconds, or null for no known length. */
export function formatSongDuration(seconds: number | null): string | null {
  if (seconds === null || !Number.isFinite(seconds) || seconds <= 0) return null
  const whole = Math.round(seconds)
  const minutes = Math.floor(whole / 60)
  return `${minutes}:${String(whole % 60).padStart(2, '0')}`
}

const CloseGlyph: Component = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.8"
    stroke-linecap="round"
    aria-hidden="true"
  >
    <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />
  </svg>
)

/** Three bars: the song on the stage. */
const OnStageGlyph: Component = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    aria-hidden="true"
  >
    <path d="M6 9v6M10 5v14M14 8v8M18 10.5v3" />
  </svg>
)

const ImportHead: Component = () =>
  KARAOKE_IMPORT ? <LibraryImportHead /> : null

const QueueRows: Component = () =>
  KARAOKE_IMPORT ? <LibraryQueueRows /> : null

const queueLength = (): number => (KARAOKE_IMPORT ? libraryQueueLength() : 0)

const NewMark: Component<{ sessionId: string }> = (props) =>
  KARAOKE_IMPORT ? <SongNewMark sessionId={props.sessionId} /> : null

const SongMenu: Component<ImportedSongMenuProps> = (props) =>
  KARAOKE_IMPORT ? <ImportedSongMenu {...props} /> : null

interface KaraokeLibrarySheetProps {
  isOpen: boolean
  close: () => void
  songs: () => readonly RoomSong[]
  /** The song on the stage, marked in the list. */
  currentId: () => string | null
  onPick: (song: RoomSong) => void
}

export const KaraokeLibrarySheet: Component<KaraokeLibrarySheetProps> = (
  props,
) => {
  const yours = (): RoomSong[] =>
    props.songs().filter((song) => song.kind === 'yours')
  const examples = (): RoomSong[] =>
    props.songs().filter((song) => song.kind === 'example')

  const [menuFor, setMenuFor] = createSignal<string | null>(null)

  const Row: Component<{ song: RoomSong }> = (row) => {
    const current = (): boolean => props.currentId() === row.song.sessionId
    const sub = (): string | null => row.song.credit ?? row.song.artist
    const menuOpen = (): boolean => menuFor() === row.song.sessionId
    return (
      <li class={styles.songItem}>
        <button
          type="button"
          class={styles.songRow}
          classList={{ [styles.songRowCurrent]: current() }}
          aria-current={current() ? 'true' : undefined}
          data-testid="karaoke-library-row"
          data-session={row.song.sessionId}
          onClick={() => props.onPick(row.song)}
        >
          <span class={styles.songArt} aria-hidden="true">
            <Show when={current()} fallback={<NoteGlyph />}>
              <OnStageGlyph />
            </Show>
          </span>
          <span class={styles.songText}>
            <span class={styles.songTitle}>
              {row.song.title}
              <NewMark sessionId={row.song.sessionId} />
            </span>
            <Show when={sub()}>
              {(line) => <span class={styles.songSub}>{line()}</span>}
            </Show>
          </span>
          <Show when={formatSongDuration(row.song.durationSec)}>
            {(length) => <span class={styles.songLength}>{length()}</span>}
          </Show>
        </button>
        <Show when={row.song.kind === 'yours'}>
          <SongMenu
            song={row.song}
            open={menuOpen()}
            onToggle={() => setMenuFor(menuOpen() ? null : row.song.sessionId)}
            onClose={() => setMenuFor(null)}
          />
        </Show>
      </li>
    )
  }

  return (
    <Sheet isOpen={props.isOpen} close={() => props.close()} ariaLabel="Songs">
      <div class={styles.library} data-testid="karaoke-library">
        <div class={styles.sheetHead}>
          <h2 class={styles.sheetTitle}>Songs</h2>
          <button
            type="button"
            class={styles.sheetClose}
            aria-label="Close"
            onClick={() => props.close()}
          >
            <CloseGlyph />
          </button>
        </div>

        <ImportHead />

        <Show when={KARAOKE_IMPORT || yours().length > 0}>
          <section class={styles.group}>
            <h3 class={styles.groupTitle}>Your songs</h3>
            <ul class={styles.songList}>
              <QueueRows />
              <For each={yours()}>{(song) => <Row song={song} />}</For>
            </ul>
            <Show when={queueLength() === 0 && yours().length === 0}>
              <p class={styles.groupNote}>Songs you import appear here.</p>
            </Show>
          </section>
        </Show>

        <Show when={examples().length > 0}>
          <section class={styles.group}>
            <h3 class={styles.groupTitle}>Examples</h3>
            <ul class={styles.songList}>
              <For each={examples()}>{(song) => <Row song={song} />}</For>
            </ul>
            <p class={styles.groupNote}>
              Part of the app: they play with {theDevice()} offline.
            </p>
          </section>
        </Show>
      </div>
    </Sheet>
  )
}
