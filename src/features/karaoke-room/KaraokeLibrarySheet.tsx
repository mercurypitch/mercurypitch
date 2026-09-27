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

import type { Component } from 'solid-js'
import { For, Show } from 'solid-js'
import { Sheet } from '@/components/mobile/Sheet'
import styles from './karaoke-room.module.css'
import type { RoomSong } from './karaoke-room-library'

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

/** A note: a song in the list. */
const NoteGlyph: Component = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.7"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path d="M9.5 17.5V6.2l9-1.7v11" />
    <circle cx="7.2" cy="17.6" r="2.3" />
    <circle cx="16.2" cy="15.9" r="2.3" />
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

  const Row: Component<{ song: RoomSong }> = (row) => {
    const current = (): boolean => props.currentId() === row.song.sessionId
    const sub = (): string | null => row.song.credit ?? row.song.artist
    return (
      <li>
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
            <span class={styles.songTitle}>{row.song.title}</span>
            <Show when={sub()}>
              {(line) => <span class={styles.songSub}>{line()}</span>}
            </Show>
          </span>
          <Show when={formatSongDuration(row.song.durationSec)}>
            {(length) => <span class={styles.songLength}>{length()}</span>}
          </Show>
        </button>
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

        <Show when={yours().length > 0}>
          <section class={styles.group}>
            <h3 class={styles.groupTitle}>Your songs</h3>
            <ul class={styles.songList}>
              <For each={yours()}>{(song) => <Row song={song} />}</For>
            </ul>
          </section>
        </Show>

        <Show when={examples().length > 0}>
          <section class={styles.group}>
            <h3 class={styles.groupTitle}>Examples</h3>
            <ul class={styles.songList}>
              <For each={examples()}>{(song) => <Row song={song} />}</For>
            </ul>
            <p class={styles.groupNote}>
              Part of the app: they play with the phone offline.
            </p>
          </section>
        </Show>
      </div>
    </Sheet>
  )
}
