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

import type { Component } from 'solid-js'
import { createSignal, For, Show } from 'solid-js'
import { Sheet } from '@/components/mobile/Sheet'
import { contactFormUrl } from '@/lib/contact-links'
import { KARAOKE_IMPORT } from '@/lib/native-build'
import type { ImportRow, ImportRowState } from './karaoke-import-queue'
import { importRowLine, importRows, karaokeNewSongs, removeImport, removeImportedSong, retryImport, sendingTitle, showImportGate, } from './karaoke-import-queue'
import styles from './karaoke-room.module.css'
import type { RoomSong } from './karaoke-room-library'
import { KaraokeImport } from './KaraokeImport'

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

/** Three dots: a song's menu. */
const MoreGlyph: Component = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <circle cx="6" cy="12" r="1.7" />
    <circle cx="12" cy="12" r="1.7" />
    <circle cx="18" cy="12" r="1.7" />
  </svg>
)

/** The share a row's bar shows, or null for a row without one. */
function barOf(state: ImportRowState): number | null {
  if (state.kind === 'sending') return Math.floor(state.share * 100)
  if (state.kind === 'separating') return state.percent
  return null
}

/** What was sent and got nowhere yet costs nothing to remove. */
const REMOVABLE_WAITING: ReadonlySet<ImportRowState['kind']> = new Set([
  'waiting-turn',
  'waiting-network',
  'busy',
  'blocked',
])

const EXPIRED_SUPPORT = contactFormUrl(
  'support',
  'A Karaoke song expired on the server before it reached my phone.',
)

/** A song in the import queue: what it waits for, and what can be done. */
const QueueRow: Component<{ row: ImportRow }> = (props) => {
  const state = (): ImportRowState => props.row.state
  const failed = () => {
    const now = state()
    return now.kind === 'failed' ? now.reason : null
  }
  const RemoveButton: Component = () => (
    <button
      type="button"
      class={styles.queueAction}
      onClick={() => void removeImport(props.row.sessionId)}
    >
      Remove
    </button>
  )
  return (
    <li
      class={styles.queueRow}
      data-testid="karaoke-queue-row"
      data-state={state().kind}
    >
      <span class={styles.songArt} aria-hidden="true">
        <NoteGlyph />
      </span>
      <span class={styles.songText}>
        <span class={styles.songTitle}>{props.row.title}</span>
        <span class={styles.songSub}>{importRowLine(state())}</span>
        <Show when={barOf(state())}>
          {(share) => (
            <span
              class={styles.queueBar}
              role="progressbar"
              aria-label={props.row.title}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={share()}
            >
              <i style={{ width: `${share()}%` }} />
            </span>
          )}
        </Show>
        <Show when={failed() === 'expired'}>
          <span class={styles.songSub}>Separating it again uses a song.</span>
        </Show>
        <Show when={failed() !== null || REMOVABLE_WAITING.has(state().kind)}>
          <span class={styles.queueActions}>
            <Show when={failed() === 'expired'}>
              <button
                type="button"
                class={styles.queueAction}
                onClick={() => retryImport(props.row.sessionId)}
              >
                Separate again
              </button>
              <a
                class={styles.queueAction}
                href={EXPIRED_SUPPORT}
                target="_blank"
                rel="noopener noreferrer"
              >
                Ask support
              </a>
            </Show>
            <Show
              when={
                failed() !== null &&
                failed() !== 'expired' &&
                failed() !== 'missing'
              }
            >
              <button
                type="button"
                class={styles.queueAction}
                onClick={() => retryImport(props.row.sessionId)}
              >
                Try again
              </button>
            </Show>
            <Show
              when={(() => {
                const now = state()
                return now.kind === 'blocked' && !now.subscribed
              })()}
            >
              <button
                type="button"
                class={styles.queueAction}
                onClick={() => showImportGate()}
              >
                Subscribe
              </button>
            </Show>
            <RemoveButton />
          </span>
        </Show>
      </span>
    </li>
  )
}

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

  const queue = (): ImportRow[] => (KARAOKE_IMPORT ? importRows() : [])
  const [menuFor, setMenuFor] = createSignal<string | null>(null)

  const Row: Component<{ song: RoomSong }> = (row) => {
    const current = (): boolean => props.currentId() === row.song.sessionId
    const sub = (): string | null => row.song.credit ?? row.song.artist
    const isNew = (): boolean =>
      KARAOKE_IMPORT && karaokeNewSongs().includes(row.song.sessionId)
    const hasMenu = (): boolean => KARAOKE_IMPORT && row.song.kind === 'yours'
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
              <Show when={isNew()}>
                <span class={styles.newDot}>
                  <span class={styles.srOnly}> New</span>
                </span>
              </Show>
            </span>
            <Show when={sub()}>
              {(line) => <span class={styles.songSub}>{line()}</span>}
            </Show>
          </span>
          <Show when={formatSongDuration(row.song.durationSec)}>
            {(length) => <span class={styles.songLength}>{length()}</span>}
          </Show>
        </button>
        <Show when={hasMenu()}>
          <button
            type="button"
            class={styles.songMore}
            aria-label={`More for ${row.song.title}`}
            aria-haspopup="menu"
            aria-expanded={menuOpen()}
            onClick={() => setMenuFor(menuOpen() ? null : row.song.sessionId)}
          >
            <MoreGlyph />
          </button>
          <Show when={menuOpen()}>
            <div
              class={styles.songMenu}
              role="menu"
              aria-label={row.song.title}
            >
              <button
                type="button"
                role="menuitem"
                class={styles.songMenuItem}
                onClick={() => {
                  setMenuFor(null)
                  void removeImportedSong(row.song.sessionId)
                }}
              >
                Remove from this phone
              </button>
            </div>
          </Show>
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

        <Show when={KARAOKE_IMPORT}>
          <KaraokeImport />
          <Show when={sendingTitle()}>
            {(title) => (
              <p class={styles.keepOpen} role="status">
                {`Keep Mercury Pitch open until ${title()} is sent.`}
              </p>
            )}
          </Show>
        </Show>

        <Show when={KARAOKE_IMPORT || yours().length > 0}>
          <section class={styles.group}>
            <h3 class={styles.groupTitle}>Your songs</h3>
            <ul class={styles.songList}>
              <For each={queue()}>{(row) => <QueueRow row={row} />}</For>
              <For each={yours()}>{(song) => <Row song={song} />}</For>
            </ul>
            <Show when={queue().length === 0 && yours().length === 0}>
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
              Part of the app: they play with the phone offline.
            </p>
          </section>
        </Show>
      </div>
    </Sheet>
  )
}
