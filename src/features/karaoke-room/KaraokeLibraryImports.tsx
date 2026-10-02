// ============================================================
// The library's Stage 2: Import, the queue's rows, New, and Remove
// ============================================================
//
// Plan S8 §3, §6.4, §6.6. Where songs can be imported (KARAOKE_IMPORT),
// Import heads the library sheet, the queue's rows sit at the top of your
// songs with what each waits for and what can be done about it, a new song
// carries a dot until it is first sung, and each imported song has one menu
// item: Remove from this phone.
//
// Only the library sheet's stand-ins reach this module, each a plain
// conditional on the constant, so a store build references none of it and
// drops it whole with the rest of Stage 2 (apps/mercurypitch/vite.config.ts,
// proven by assert-bundle.mjs STAGE 2).

import type { Component } from 'solid-js'
import { For, Show } from 'solid-js'
import { contactFormUrl } from '@/lib/contact-links'
import { deviceNoun, thisDeviceLower } from '@/lib/device-noun'
import type { ImportRow, ImportRowState } from './karaoke-import-queue'
import { importRowLine, importRows, karaokeNewSongs, removeImport, removeImportedSong, retryImport, sendingTitle, showImportGate, } from './karaoke-import-queue'
import styles from './karaoke-room.module.css'
import { NoteGlyph } from './karaoke-room-glyphs'
import type { RoomSong } from './karaoke-room-library'
import { KaraokeImport } from './KaraokeImport'

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

/** Support, asked about a song that expired, from the device in hand. */
function expiredSupport(): string {
  return contactFormUrl(
    'support',
    `A Karaoke song expired on the server before it reached my ${deviceNoun()}.`,
  )
}

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
                href={expiredSupport()}
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

/** Import, and while a song is being sent, the line that asks to wait. */
export const LibraryImportHead: Component = () => (
  <>
    <KaraokeImport />
    <Show when={sendingTitle()}>
      {(title) => (
        <p class={styles.keepOpen} role="status">
          {`Keep Mercury Pitch open until ${title()} is sent.`}
        </p>
      )}
    </Show>
  </>
)

/** The queue's rows, newest first, at the top of your songs. */
export const LibraryQueueRows: Component = () => (
  <For each={importRows()}>{(row) => <QueueRow row={row} />}</For>
)

/** How many rows the queue shows. */
export function libraryQueueLength(): number {
  return importRows().length
}

/** The dot on a song not yet sung since it arrived. */
export const SongNewMark: Component<{ sessionId: string }> = (props) => (
  <Show when={karaokeNewSongs().includes(props.sessionId)}>
    <span class={styles.newDot}>
      <span class={styles.srOnly}> New</span>
    </span>
  </Show>
)

export interface ImportedSongMenuProps {
  song: RoomSong
  open: boolean
  onToggle: () => void
  onClose: () => void
}

/** An imported song's menu: its one item removes it from this phone. */
export const ImportedSongMenu: Component<ImportedSongMenuProps> = (props) => (
  <>
    <button
      type="button"
      class={styles.songMore}
      aria-label={`More for ${props.song.title}`}
      aria-haspopup="menu"
      aria-expanded={props.open}
      onClick={() => props.onToggle()}
    >
      <MoreGlyph />
    </button>
    <Show when={props.open}>
      <div class={styles.songMenu} role="menu" aria-label={props.song.title}>
        <button
          type="button"
          role="menuitem"
          class={styles.songMenuItem}
          onClick={() => {
            props.onClose()
            void removeImportedSong(props.song.sessionId)
          }}
        >
          Remove from {thisDeviceLower()}
        </button>
      </div>
    </Show>
  </>
)
