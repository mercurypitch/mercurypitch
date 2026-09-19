// ── JamPickerList ─────────────────────────────────────────────────────
// What the room can sing, as a list: the popup over the transport, the
// phone's sheet, and the room's section of the sidebar all render this.
//
// One component because they are one list. The state behind it -- the
// shelves, the row being loaded, why the last pick failed -- lives in
// jam-picker-store, so a song that is loading shows its spinner in every
// place the list is open, and an error does not hide in the one the host
// is not looking at.
//
// The sidebar differs in one way that matters: it stays open while the room
// sings. So its groups fold, it remembers which ones were folded, and the
// row that is running is marked -- which is what makes switching songs one
// tap instead of open, scroll, tap.

import type { Component } from 'solid-js'
import { Index, Show } from 'solid-js'
import { ChevronDown } from '@/components/icons'
import type { JamCatalogEntry } from '@/lib/jam/jam-catalog'
import { createPersistedSignal } from '@/lib/storage'
import type { JamPickerShelf } from '@/stores/jam-picker-store'
import { chooseJamPickerEntry, jamExamplesState, jamPickerActiveTargetId, jamPickerError, jamPickerShelves, jamPickingEntryId, } from '@/stores/jam-picker-store'
import styles from './JamPickerList.module.css'

/** `popup` floats over the stage; `sheet` is the same list with thumb-sized
 *  rows; `rail` is the sidebar, which folds and marks what is running. */
export type JamPickerVariant = 'popup' | 'sheet' | 'rail'

export interface JamPickerListProps {
  variant: JamPickerVariant
  /** The room accepted a pick -- the caller's cue to get out of the way. */
  onPicked?: () => void
}

/** Long lists start folded in the sidebar; the songs are what it is for. */
const FOLDED_BY_DEFAULT: ReadonlySet<JamPickerShelf['id']> = new Set([
  'exercises',
  'melodies',
])

const Row: Component<{
  entry: JamCatalogEntry
  onPicked?: () => void
}> = (props) => {
  const loading = (): boolean => jamPickingEntryId() === props.entry.id
  const running = (): boolean =>
    jamPickerActiveTargetId() === props.entry.targetId
  return (
    <button
      type="button"
      class={styles.item}
      classList={{ [styles.itemRunning]: running() }}
      disabled={jamPickingEntryId() !== null}
      aria-busy={loading()}
      aria-current={running() ? 'true' : undefined}
      onClick={() => {
        // Read now, in the handler: the answer arrives after an await, and
        // by then this is no longer a place props may be read from.
        const onPicked = props.onPicked
        void chooseJamPickerEntry(props.entry).then((accepted) => {
          if (accepted) onPicked?.()
        })
      }}
    >
      <span class={styles.name}>
        <span class={styles.nameText}>{props.entry.name}</span>
        <Show when={loading()}>
          <span class={styles.spinner} />
        </Show>
        <Show when={running() && !loading()}>
          <span class={styles.runningTag}>In the room</span>
        </Show>
      </span>
      <span class={styles.meta}>{props.entry.detail}</span>
    </button>
  )
}

/** One group of the sidebar's list: a header that folds its rows away. */
const FoldingShelf: Component<{
  shelf: JamPickerShelf
  onPicked?: () => void
}> = (props) => {
  const storageKey = (): string => `sidebar-jam-picker-${props.shelf.id}-open`
  const [open, setOpen] = createPersistedSignal<boolean>(
    // The shelf id is a stable constant per group; safe to read at init.
    storageKey(),
    !FOLDED_BY_DEFAULT.has(props.shelf.id), // eslint-disable-line solid/reactivity
  )
  return (
    <div class={styles.shelf}>
      <button
        type="button"
        class={styles.foldHeader}
        aria-expanded={open()}
        // The guide tour expands a folded group through this hook, the same
        // one CollapsibleSection exposes.
        data-collapsible={storageKey()}
        onClick={() => setOpen(!open())}
      >
        <span class={styles.shelfLabel}>{props.shelf.label}</span>
        <span class={styles.count}>{props.shelf.entries.length}</span>
        <span class={styles.chevron} data-open={open()}>
          <ChevronDown size={14} />
        </span>
      </button>
      <Show when={open()}>
        <div class={styles.rows}>
          <Index each={props.shelf.entries}>
            {(entry) => <Row entry={entry()} onPicked={props.onPicked} />}
          </Index>
        </div>
      </Show>
    </div>
  )
}

export const JamPickerList: Component<JamPickerListProps> = (props) => {
  return (
    <div class={styles.list} data-variant={props.variant}>
      <Show when={jamPickerError() !== ''}>
        <div class={styles.error} role="alert">
          {jamPickerError()}
        </div>
      </Show>
      <Show when={jamExamplesState() !== 'ready'}>
        <div class={styles.shelf}>
          <div class={styles.shelfLabel}>Example songs</div>
          <div class={styles.status} role="status">
            {jamExamplesState() === 'loading'
              ? 'Loading the example songs…'
              : 'The example songs are unavailable. Drills and melodies are still ready.'}
          </div>
        </div>
      </Show>
      {/* Index, not For, at both levels. The shelves are rebuilt whenever
          the session list ticks -- a separation in progress does that every
          second -- and For keys by object, so it would tear the whole list
          down each time: fine for a popup that is open for two seconds, not
          for a sidebar that is open all evening with a finger on a row. The
          shelves are always the same six in the same order, so by position
          is by identity. */}
      <Index each={jamPickerShelves()}>
        {(shelf) => (
          <Show when={shelf().entries.length > 0}>
            <Show
              when={props.variant === 'rail'}
              fallback={
                <div class={styles.shelf}>
                  <div class={styles.shelfLabel}>{shelf().label}</div>
                  <Index each={shelf().entries}>
                    {(entry) => (
                      <Row entry={entry()} onPicked={props.onPicked} />
                    )}
                  </Index>
                </div>
              }
            >
              <FoldingShelf shelf={shelf()} onPicked={props.onPicked} />
            </Show>
          </Show>
        )}
      </Index>
    </div>
  )
}
