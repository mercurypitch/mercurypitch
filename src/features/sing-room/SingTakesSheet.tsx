// ============================================================
// Your takes — every summary this phone kept (device round 2, R4)
// ============================================================
//
// NOT `SingTakeSheet.tsx`, which is the end card for the take that has just
// finished and has two answers on it. This is the list of the ones already
// decided: it decides nothing, and its one control forgets a row.
//
// It is what the pitch pill's tap does. The coach mark promised taps that did
// nothing (R4), and a takes list is what the owner wanted the room to have
// anyway — the numbers were being kept, with one line of the newest of them
// ever read back.
//
// Remove does not ask. A take is four numbers and two timestamps, the row is
// the only place they are read, and a confirmation over a button somebody
// deliberately reached for is friction guarding nothing.

import type { Component } from 'solid-js'
import { For, Show } from 'solid-js'
import { Sheet } from '@/components/mobile/Sheet'
import type { SingTake } from '@/stores/sing-takes-store'
import styles from './sing-room.module.css'
import { singTakeRows } from './take-list'

/** The kit's minus-in-a-circle: remove, never delete-forever. */
const RemoveGlyph: Component = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.6"
    stroke-linecap="round"
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="8.5" />
    <path d="M8.5 12h7" />
  </svg>
)

interface SingTakesSheetProps {
  isOpen: boolean
  close: () => void
  takes: () => readonly SingTake[]
  onRemove: (id: string) => void
}

export const SingTakesSheet: Component<SingTakesSheetProps> = (props) => (
  <Sheet isOpen={props.isOpen} close={() => props.close()} ariaLabel="Your takes">
    <div class={styles.takeSheet} data-testid="sing-takes-sheet">
      <h2 class={styles.head}>Your takes</h2>

      <Show
        when={props.takes().length > 0}
        fallback={
          <p class={styles.body} data-testid="sing-takes-empty">
            No takes kept yet.
          </p>
        }
      >
        <ul class={styles.takeList}>
          <For each={singTakeRows(props.takes())}>
            {(row) => (
              <li class={styles.takeRow} data-testid="sing-takes-row">
                {/* One spoken line, and the two visible ones hidden from the
                    reader: "3 min · D3 to A4 · held within 12 cents" read out
                    is a sentence with two middle dots in it. */}
                <div class={styles.takeRowText}>
                  <span class={styles.srOnly}>{row.announce}</span>
                  <span class={styles.takeRowWhen} aria-hidden="true">
                    {row.when}
                  </span>
                  <span class={styles.takeRowStats} aria-hidden="true">
                    {`${row.duration} · ${row.range} · held within ${row.held}`}
                  </span>
                </div>
                <button
                  type="button"
                  class={styles.takeRowRemove}
                  aria-label={`Remove the take from ${row.when}`}
                  data-testid="sing-takes-remove"
                  onClick={() => props.onRemove(row.id)}
                >
                  <RemoveGlyph />
                  Remove
                </button>
              </li>
            )}
          </For>
        </ul>
      </Show>
    </div>
  </Sheet>
)
