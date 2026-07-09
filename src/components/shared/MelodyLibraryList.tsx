import type { Component, JSX } from 'solid-js'
import { For, Show } from 'solid-js'
import { IconCheckSolid, IconMusicNote, IconSheetMusic, } from '@/components/hidden-features-icons'
import modalStyles from '@/components/Modal.module.css'
import styles from './MelodyLibraryList.module.css'

export type LibraryEntryKind = 'melody' | 'session'

export interface LibraryEntry {
  id: string
  kind: LibraryEntryKind
  title: string
  /** Free-form one-line meta (key • bpm • notes • plays …). */
  meta?: string
  /** Optional tag chips shown under the title. */
  tags?: string[]
  /** Original raw record — passed through to consumer callbacks
   *  (e.g. the playlist picker needs the full Melody / Session). */
  raw?: unknown
}

export interface MelodyLibraryListProps {
  entries: LibraryEntry[] // controlled, prepared by caller
  /** Restricts which kinds the list will render (also drives the
   *  fallback empty-state copy). */
  kinds?: LibraryEntryKind[] // default ['melody', 'session']

  /** 'single' = single-select highlight (replaces `.library-list`)
   *  'multi'  = checkbox/pill toggle (replaces `.melody-select-list`)  */
  mode?: 'single' | 'multi' // default 'multi'

  selectedIds?: ReadonlySet<string>
  onSelectionChange?: (ids: Set<string>) => void

  /** Single-select activate (e.g. double-click / Enter / single-click in
   *  'single' mode loads the melody). Optional in 'multi' mode. */
  onItemActivate?: (entry: LibraryEntry) => void

  /** When provided the list items become draggable. The component
   *  attaches a default `dataTransfer.setData('application/x-melody-id',
   *  entry.id)` and calls back so the SessionEditor can decorate the
   *  payload further (e.g. set its own session-builder MIME type). */
  onDragStart?: (entry: LibraryEntry, e: DragEvent) => void
  onDragEnd?: (entry: LibraryEntry, e: DragEvent) => void

  /** Optional inline search box. If absent the caller filters
   *  `entries` upstream (LibraryModal already does this). */
  showSearch?: boolean
  searchPlaceholder?: string

  emptyMessage?: string
  className?: string
  draggable?: boolean

  // Keep existing drop target props for SessionEditor backward compatibility
  onDragOver?: (e: DragEvent) => void
  onDrop?: (entry: LibraryEntry, e: DragEvent) => void

  // Keep custom renders
  renderActions?: (entry: LibraryEntry) => JSX.Element
  renderDetails?: (entry: LibraryEntry) => JSX.Element
}

export const MelodyLibraryList: Component<MelodyLibraryListProps> = (props) => {
  const mode = () => props.mode ?? 'multi'
  const kinds = () => props.kinds ?? ['melody', 'session']

  const isSelected = (id: string) => {
    return props.selectedIds?.has(id) ?? false
  }

  const filteredEntries = () =>
    (props.entries ?? []).filter((e) => kinds().includes(e.kind))

  const handleToggle = (entry: LibraryEntry) => {
    if (mode() === 'multi') {
      if (props.onSelectionChange && props.selectedIds) {
        const newSet = new Set(props.selectedIds)
        if (newSet.has(entry.id)) {
          newSet.delete(entry.id)
        } else {
          newSet.add(entry.id)
        }
        props.onSelectionChange(newSet)
      } else if (props.onItemActivate) {
        props.onItemActivate(entry)
      }
    } else {
      props.onItemActivate?.(entry)
    }
  }

  return (
    <div
      class={`${mode() === 'multi' ? styles.melodySelectList : modalStyles.libraryList} ${props.className ?? ''}`}
    >
      <Show
        when={filteredEntries().length > 0}
        fallback={
          <div class={styles.emptyState}>
            <p>{props.emptyMessage ?? 'No items found.'}</p>
          </div>
        }
      >
        <For each={filteredEntries()}>
          {(entry) => {
            const sel = isSelected(entry.id)

            if (mode() === 'multi') {
              return (
                <button
                  type="button"
                  class={`${styles.playlistPickerPill} ${sel ? styles.selected : ''}`}
                  onClick={() => handleToggle(entry)}
                  draggable={props.draggable ?? props.onDragStart !== undefined}
                  onDragStart={(e) => props.onDragStart?.(entry, e)}
                  onDragEnd={(e) => props.onDragEnd?.(entry, e)}
                  onDragOver={(e) => props.onDragOver?.(e)}
                  onDrop={(e) => props.onDrop?.(entry, e)}
                >
                  <span class={styles.playlistPickerIcon}>
                    {entry.kind === 'session' ? (
                      <IconSheetMusic />
                    ) : (
                      <IconMusicNote />
                    )}
                  </span>
                  <span class={styles.playlistPickerCopy}>
                    <span class={styles.selectItemTitle}>{entry.title}</span>
                    <span class={styles.selectItemMeta}>{entry.meta}</span>
                  </span>
                  <span class={styles.playlistPickerCheck}>
                    {sel ? <IconCheckSolid /> : '+'}
                  </span>
                </button>
              )
            }

            // Display / Single mode row (inherits existing .library-item styles from app.css)
            return (
              <div
                class={`library-item ${sel ? 'selected' : ''}`}
                onClick={() => handleToggle(entry)}
                draggable={props.draggable ?? props.onDragStart !== undefined}
                onDragStart={(e) => props.onDragStart?.(entry, e)}
                onDragEnd={(e) => props.onDragEnd?.(entry, e)}
                onDragOver={(e) => props.onDragOver?.(e)}
                onDrop={(e) => props.onDrop?.(entry, e)}
              >
                <div class="item-main">
                  <div class="item-title">{entry.title}</div>
                  <div class="item-meta">
                    <span>{entry.meta}</span>
                  </div>
                  <Show when={entry.tags && entry.tags.length > 0}>
                    <div class="item-tags">
                      <For each={entry.tags?.slice(0, 3)}>
                        {(tag) => <span class="tag-pill">{tag}</span>}
                      </For>
                      {(entry.tags?.length ?? 0) > 3 && (
                        <span class="tag-pill more">
                          +{(entry.tags?.length ?? 0) - 3}
                        </span>
                      )}
                    </div>
                  </Show>

                  {props.renderDetails?.(entry)}
                </div>

                <Show when={props.renderActions}>
                  <div class="item-actions">{props.renderActions?.(entry)}</div>
                </Show>
              </div>
            )
          }}
        </For>
      </Show>
    </div>
  )
}
