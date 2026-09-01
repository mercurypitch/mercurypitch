// ============================================================
// FieldBookCard — the bench's list of songs the Lab can read.
//
// Every finished separation in the karaoke library is a page the
// Field Book can open: the vocal's landings and phrases, the roots
// moving underneath. The card shows what has been read of each and
// the Field Book's own rating; with no songs it points at Karaoke
// Night's upload, because that is the only way a page gets here.
// ============================================================

import type { JSX } from 'solid-js'
import { createMemo, For, Show } from 'solid-js'
import { TAB_KARAOKE } from '@/features/tabs/constants'
import { keyLabel, WILD_TRACKS } from '@/lib/ear/wild'
import { earPlayerRating } from '@/stores/ear-lab-store'
import { setActiveTab } from '@/stores/ui-store'
import type { UvrSession } from '@/stores/uvr-store'
import { IconSeal } from './ear-icons'
import styles from './FieldBookCard.module.css'
import type { WildReadingState } from './wild-store'
import { fieldBookSessions, songName, wildReadingState } from './wild-store'

interface FieldBookCardProps {
  onOpen: (sessionId: string) => void
}

const SHOWN = 6

/** The mean of the wild tracks that have been played, or null. */
export function fieldBookRating(): number | null {
  const played = WILD_TRACKS.map((track) => earPlayerRating(track)).filter(
    (rating) => rating.attempts > 0,
  )
  if (played.length === 0) return null
  return Math.round(
    played.reduce((sum, rating) => sum + rating.rating, 0) / played.length,
  )
}

function stateWord(state: WildReadingState): string {
  switch (state.status) {
    case 'unread':
      return 'Unread'
    case 'reading':
      // The number matters more than the word: a bare "Reading…" on a long
      // song is indistinguishable from a hang.
      return `Reading… ${state.progress?.pct ?? 0}%`
    case 'error':
      return 'Could not be read'
    case 'ready': {
      const book = state.reading?.book
      if (!book) return 'Read'
      const items = book.home.length + book.echo.length + book.bassline.length
      return `${keyLabel(book.key)} · ${items} items`
    }
  }
}

export function FieldBookCard(props: FieldBookCardProps): JSX.Element {
  const songs = createMemo(() => fieldBookSessions())
  const rating = createMemo(() => fieldBookRating())

  return (
    <section
      class={styles.card}
      data-tour="ear.fieldBook"
      aria-label="The Field Book"
    >
      <header class={styles.head}>
        <span class={styles.title}>The Field Book</span>
        <Show when={rating()}>
          {(value) => (
            <span class={styles.seal} title="The Field Book's own rating">
              <IconSeal size={12} />
              Wild {value()}
            </span>
          )}
        </Show>
      </header>

      <Show
        when={songs().length > 0}
        fallback={
          <div class={styles.empty}>
            <p class={styles.note}>
              No songs yet. Separate one in Karaoke Night and its page appears
              here.
            </p>
            <button
              type="button"
              class={styles.go}
              onClick={() => setActiveTab(TAB_KARAOKE)}
            >
              Open Karaoke Night
            </button>
          </div>
        }
      >
        <ol class={styles.list}>
          <For each={songs().slice(0, SHOWN)}>
            {(song: UvrSession) => (
              <li class={styles.row}>
                <span class={styles.rowMain}>
                  <span class={styles.song}>{songName(song)}</span>
                  <span class={styles.state}>
                    {stateWord(wildReadingState(song.sessionId))}
                  </span>
                </span>
                <button
                  type="button"
                  class={styles.go}
                  data-session={song.sessionId}
                  onClick={() => props.onOpen(song.sessionId)}
                >
                  Open
                </button>
              </li>
            )}
          </For>
        </ol>
      </Show>

      <p class={styles.note}>
        Your own songs, read once for the degrees the voice lands on, the
        phrases it sings and the roots that move under it. Rated on the Field
        Book's own tracks — the Column never moves for them.
      </p>
    </section>
  )
}
