// ============================================================
// LyricsSongPicker — LRCLIB "Search Lyrics Online" search bar + results
// ============================================================
// Extracted from the stem-mixer lyrics panel so the same search UI can be
// reused wherever a song has no synced lyrics — the studio panel (`panel`
// variant: header + footer + no-results fallback) and the zen karaoke stage
// (`inline` variant: just the search field + match list, with the manual
// LyricsUploader shown beneath it by the caller).
//
// Styled by the shared `.sm-song-picker-*` rules in StemMixerStyles, which is
// injected on every surface that mounts the mixer.

import type { Component } from 'solid-js'
import { For, onCleanup, onMount, Show } from 'solid-js'
import type { LyricsSearchMatch } from '@/lib/lyrics-service'
import { MagnifyingGlass } from './icons'

export interface LyricsSongPickerProps {
  matches: LyricsSearchMatch[]
  query: string
  onQueryChange: (v: string) => void
  onPick: (match: LyricsSearchMatch) => void
  onRefine: () => void
  /** Presentation: `panel` (studio, full chrome) or `inline` (zen, bare). */
  variant?: 'panel' | 'inline'
  /** Studio-only "Upload LRC / TXT File" footer button. */
  onUploadFile?: () => void
  /** Wire the Paste button; omit to hide it (zen relies on the uploader). */
  onPasteText?: (text: string, isLrc: boolean) => void
  /** Studio-only Cancel (returns to the uploader). Omit to hide. */
  onCancel?: () => void
  /** Autofocus the field on mount (the studio picker opens focused). */
  autoFocus?: boolean
}

const isLrcText = (text: string): boolean =>
  /^\[\d{1,3}:\d{2}/.test(text.trim())

export const LyricsSongPicker: Component<LyricsSongPickerProps> = (props) => {
  let inputRef: HTMLInputElement | undefined
  const inline = () => props.variant === 'inline'

  const lrclibQueryUrl = (): string => {
    const q = props.query?.trim()
    if (!q) return 'https://lrclib.net'
    return `https://lrclib.net/search/${encodeURIComponent(q)}`
  }

  onMount(() => {
    if (props.autoFocus === true) inputRef?.focus()

    // A global paste anywhere in the picker (outside a field) drops straight
    // into the lyrics, matching the studio's "just paste it" affordance.
    const handleGlobalPaste = (e: ClipboardEvent): void => {
      if (props.onPasteText === undefined) return
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return
      }
      const text = e.clipboardData?.getData('text')
      if (text !== undefined && text.trim().length > 0) {
        e.preventDefault()
        props.onPasteText(text, isLrcText(text))
      }
    }
    document.addEventListener('paste', handleGlobalPaste)
    onCleanup(() => document.removeEventListener('paste', handleGlobalPaste))
  })

  return (
    <div
      class="sm-song-picker"
      classList={{ 'sm-song-picker--inline': inline() }}
    >
      <Show when={!inline()}>
        <div class="sm-song-picker-header">Search Lyrics Online</div>
      </Show>

      <div class="sm-song-picker-search">
        <input
          ref={inputRef}
          type="text"
          class="sm-song-picker-input"
          value={props.query}
          onInput={(e) => props.onQueryChange(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') props.onRefine()
          }}
          placeholder="Artist - Title"
          aria-label="Search lyrics by artist and title"
        />
        <button
          class="sm-song-picker-search-btn"
          onClick={() => props.onRefine()}
          title="Search LRCLIB"
        >
          <MagnifyingGlass />
          <span>Search</span>
        </button>
        <Show when={props.onPasteText}>
          <button
            class="sm-song-picker-paste-btn"
            onClick={() => {
              void (async () => {
                try {
                  const text = await navigator.clipboard.readText()
                  if (text.trim().length > 0) {
                    props.onPasteText?.(text, isLrcText(text))
                  }
                } catch (err) {
                  console.warn('Clipboard paste failed', err)
                  const { showNotification } =
                    await import('@/stores/notifications-store')
                  showNotification(
                    'Your browser blocked clipboard access. Press Ctrl+V to paste instead.',
                    'warning',
                  )
                }
              })()
            }}
            title="Paste lyrics from clipboard"
          >
            Paste
          </button>
        </Show>
      </div>

      <Show
        when={props.matches.length > 0}
        fallback={
          <Show when={!inline()}>
            <div class="sm-song-picker-no-results">
              <span class="sm-song-picker-no-results-title">
                No matches yet
              </span>
              <span class="sm-song-picker-no-results-hint">
                Refine the artist and title above, or open LRCLIB to search
                there.
              </span>
              <a
                class="sm-song-picker-lrclib-link"
                href={lrclibQueryUrl()}
                target="_blank"
                rel="noopener noreferrer"
              >
                <MagnifyingGlass />
                Open LRCLIB
              </a>
            </div>
          </Show>
        }
      >
        <div class="sm-song-picker-count">
          {props.matches.length} match{props.matches.length === 1 ? '' : 'es'}
        </div>
        <div class="sm-song-picker-list">
          <For each={props.matches}>
            {(m) => (
              <button
                class="sm-song-picker-row"
                onClick={() => props.onPick(m)}
              >
                <span class="sm-song-picker-artist">{m.artist}</span>
                <span class="sm-song-picker-sep">–</span>
                <span class="sm-song-picker-title">{m.title}</span>
                <Show when={m.syncedLyrics !== undefined}>
                  <span class="sm-song-picker-badge">LRC</span>
                </Show>
              </button>
            )}
          </For>
        </div>
      </Show>

      <Show when={!inline() && (props.onCancel || props.onUploadFile)}>
        <div class="sm-song-picker-footer-actions">
          <Show when={props.onCancel}>
            <button
              class="sm-song-picker-footer-btn"
              onClick={() => props.onCancel?.()}
            >
              Cancel
            </button>
          </Show>
          <Show when={props.onUploadFile}>
            <button
              class="sm-song-picker-footer-btn sm-song-picker-footer-btn--primary"
              onClick={() => props.onUploadFile?.()}
            >
              Upload LRC / TXT file
            </button>
          </Show>
        </div>
      </Show>
    </div>
  )
}
