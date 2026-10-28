// ============================================================
// First note's songs: the pill over the mic, and the sheet it opens
// ============================================================
//
// Where a run's songs come from (first-note-choices.ts): the examples the
// app ships, the singer's own songs, or a mix. The pill sits over the mic
// at rest and names the choice; the sheet holds the three, and the
// singer's own songs with what the phone knows of each (the Ear rooms
// canvas, C1): the entries it found, how far a read has got, or that a
// song sits out, and why, in plain words (too few clear entries, too long
// for the phone to read, no voice in it). A singer with no song of their
// own split yet is told how one comes to be here, with the way to it when
// the shell offers one (A2: the Karaoke room's songs, where Import is).

import type { Component, JSX } from 'solid-js'
import { createMemo, For, Show } from 'solid-js'
import { Dynamic } from 'solid-js/web'
import { CheckSmall, ChevronDown, Music, StageCurtains, X, } from '@/components/icons'
import { Sheet } from '@/components/mobile/Sheet'
import { thisDeviceLower } from '@/lib/device-noun'
import type { FirstNoteSource } from './first-note-choices'
import { FIRST_NOTE_SOURCES, firstNoteSource, setFirstNoteSource, } from './first-note-choices'
import type { OwnSong, OwnSongFailure, OwnSongState, } from './first-note-own-songs'
import { ownSong, ownSongIds, ownSongs } from './first-note-own-songs'
import { OWN_SONG_MIN_ENTRIES } from './first-note-rules'
import { FIRST_NOTE_SONGS } from './first-note-songs'
import styles from './FirstNoteSongs.module.css'

/** Two songs crossing: a mix. */
const MixGlyph: Component = () => (
  <svg
    viewBox="0 0 24 24"
    width="20"
    height="20"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5" />
  </svg>
)

/** What each choice is called, on the pill and in the sheet. */
export const SOURCE_NAMES: Readonly<Record<FirstNoteSource, string>> = {
  examples: 'The examples',
  yours: 'Your songs',
  mix: 'A mix',
}

const SOURCE_ICONS: Readonly<Record<FirstNoteSource, Component>> = {
  examples: () => <StageCurtains size={20} />,
  yours: Music,
  mix: MixGlyph,
}

/** The song being read now, and how far: null while none is. */
export function readingNow(
  songs: readonly OwnSong[],
): { title: string; progress: number } | null {
  for (const song of songs) {
    if (song.state.kind === 'reading') {
      return { title: song.title, progress: song.state.progress }
    }
  }
  return null
}

/** The line under a choice in the sheet. */
export function sourceLine(
  source: FirstNoteSource,
  songs: readonly OwnSong[],
): string {
  if (source === 'examples') {
    return `${FIRST_NOTE_SONGS.length} songs that come with the app`
  }
  if (source === 'mix') return 'The examples and your songs, together'
  if (songs.length === 0) return 'Split a song in the Karaoke room first'
  const ready = songs.filter((song) => song.state.kind === 'ready').length
  const reading = readingNow(songs)
  if (reading !== null) return `Reading your songs: ${reading.progress}%`
  return ready === 1 ? '1 song ready' : `${ready} songs ready`
}

/** Why a song was not read, as the sheet says it: plain words, no error. */
export function failedLine(why: OwnSongFailure): string {
  switch (why) {
    case 'too-long':
      return `Left out: too long for ${thisDeviceLower()} to read`
    case 'no-voice':
      return 'Left out: there is no voice in it to read'
    case 'unreadable':
      return 'Could not read this song'
  }
}

/** What a song of the singer's own says under its name. */
export function songLine(state: OwnSongState): string {
  switch (state.kind) {
    case 'waiting':
      return 'Not read yet'
    case 'reading':
      return 'Reading the song'
    case 'ready':
      return state.entries.length === 1
        ? '1 entry'
        : `${state.entries.length} entries`
    case 'few':
      return state.entries === 0
        ? 'Left out: no clear entries in it'
        : `Left out: only ${state.entries} clear ${state.entries === 1 ? 'entry' : 'entries'}, it needs ${OWN_SONG_MIN_ENTRIES}`
    case 'failed':
      return failedLine(state.why)
  }
}

export interface FirstNoteSongsButtonProps {
  onOpen: () => void
}

/** The pill over the mic: the choice, and a read's progress while one runs. */
export function FirstNoteSongsButton(
  props: FirstNoteSongsButtonProps,
): JSX.Element {
  const reading = (): { title: string; progress: number } | null =>
    firstNoteSource() === 'examples' ? null : readingNow(ownSongs())
  const label = (): string => {
    const name = SOURCE_NAMES[firstNoteSource()]
    const now = reading()
    return now === null
      ? `Songs: ${name}`
      : `Songs: ${name}. Reading ${now.title}: ${now.progress}%`
  }
  return (
    <button
      type="button"
      class={styles.pill}
      aria-haspopup="dialog"
      aria-label={label()}
      onClick={() => props.onOpen()}
      data-testid="first-note-songs"
    >
      <Music />
      <span>{SOURCE_NAMES[firstNoteSource()]}</span>
      <Show when={reading()}>
        {(now) => (
          <span class={styles.pillNote} aria-hidden="true">
            {`${now().progress}%`}
          </span>
        )}
      </Show>
      <ChevronDown size={14} />
    </button>
  )
}

export interface FirstNoteSongsSheetProps {
  isOpen: boolean
  close: () => void
  /** The way to the Karaoke room's songs; absent where the shell has none. */
  onOwnSongs?: () => void
}

export function FirstNoteSongsSheet(
  props: FirstNoteSongsSheetProps,
): JSX.Element {
  const songs = (): OwnSong[] => ownSongs()
  return (
    <Sheet isOpen={props.isOpen} close={() => props.close()} ariaLabel="Songs">
      <div class={styles.sheet} data-testid="first-note-songs-sheet">
        <div class={styles.head}>
          <div>
            <h2 class={styles.title}>Songs</h2>
            <p class={styles.sub}>
              Where the band leads in from. Each run is up to six entries.
            </p>
          </div>
          <button
            type="button"
            class={styles.close}
            onClick={() => props.close()}
            aria-label="Close"
          >
            <X />
          </button>
        </div>

        <div class={styles.sources} role="radiogroup" aria-label="Sing from">
          <For each={FIRST_NOTE_SOURCES}>
            {(source) => (
              <button
                type="button"
                role="radio"
                class={styles.source}
                aria-checked={firstNoteSource() === source}
                onClick={() => setFirstNoteSource(source)}
                data-testid={`first-note-source-${source}`}
              >
                <span class={styles.sourceIcon} aria-hidden="true">
                  <Dynamic component={SOURCE_ICONS[source]} />
                </span>
                <span class={styles.sourceText}>
                  <span class={styles.sourceName}>{SOURCE_NAMES[source]}</span>
                  <span class={styles.sourceLine}>
                    {sourceLine(source, songs())}
                  </span>
                </span>
                <span class={styles.mark} aria-hidden="true">
                  <Show when={firstNoteSource() === source}>
                    <CheckSmall size={18} />
                  </Show>
                </span>
              </button>
            )}
          </For>
        </div>

        <section
          class={styles.section}
          aria-labelledby="first-note-your-songs"
          data-testid="first-note-your-songs"
        >
          <h3 id="first-note-your-songs" class={styles.sectionHead}>
            <span>Your songs</span>
            <Show when={songs().length > 0}>
              <span
                class={styles.sectionCount}
              >{`${songs().length} split`}</span>
            </Show>
          </h3>
          <Show
            when={songs().length > 0}
            fallback={<NoSongsYet onOwnSongs={props.onOwnSongs} />}
          >
            <ul class={styles.songs}>
              <For each={ownSongIds()}>
                {(sessionId) => <SongRow sessionId={sessionId} />}
              </For>
            </ul>
          </Show>
        </section>
      </div>
    </Sheet>
  )
}

/**
 * One song of the singer's own, and what the phone knows of it. Keyed by
 * its session, so a read's progress redraws the row, not a new one.
 */
function SongRow(props: { sessionId: string }): JSX.Element {
  const song = createMemo(() => ownSong(props.sessionId))
  const title = (): string => song()?.title ?? ''
  const state = (): OwnSongState => song()?.state ?? { kind: 'waiting' }
  const out = (): boolean => state().kind === 'few' || state().kind === 'failed'
  /** How far its read has got, or null while it is not being read. */
  const progress = (): number | null => {
    const now = state()
    return now.kind === 'reading' ? now.progress : null
  }
  return (
    <li
      class={styles.song}
      classList={{ [styles.songOut]: out() }}
      data-testid="first-note-own-song"
      data-state={state().kind}
    >
      <span class={styles.songIcon} aria-hidden="true">
        <Music />
      </span>
      <span class={styles.songText}>
        <span class={styles.songTitle}>{title()}</span>
        <span class={styles.songLine}>
          {songLine(state())}
          <Show when={progress() !== null}>
            <span
              class={styles.bar}
              role="progressbar"
              aria-label={`Reading ${title()}`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progress() ?? 0}
            >
              <span
                class={styles.barFill}
                style={{ width: `${progress() ?? 0}%` }}
              />
            </span>
            {`${progress() ?? 0}%`}
          </Show>
        </span>
      </span>
    </li>
  )
}

/** No song of the singer's own yet: how one comes to be here (A2). */
function NoSongsYet(props: { onOwnSongs?: () => void }): JSX.Element {
  return (
    <div class={styles.empty} data-testid="first-note-no-songs">
      <p class={styles.emptyTitle}>No songs of your own yet</p>
      <p class={styles.emptyLine}>
        First note plays a song you have split into its voice and its band, and
        stops where its singer comes in.
      </p>
      <ol class={styles.steps}>
        <li>
          <span class={styles.step} aria-hidden="true">
            1
          </span>
          Pick a song from Files
        </li>
        <li>
          <span class={styles.step} aria-hidden="true">
            2
          </span>
          Our servers take the voice out
        </li>
        <li>
          <span class={styles.step} aria-hidden="true">
            3
          </span>
          Come in on its first note, here
        </li>
      </ol>
      <Show when={props.onOwnSongs}>
        {(open) => (
          <button
            type="button"
            class={styles.cta}
            onClick={() => open()()}
            data-testid="first-note-own-songs"
          >
            <Music />
            Sing your own songs
          </button>
        )}
      </Show>
    </div>
  )
}
