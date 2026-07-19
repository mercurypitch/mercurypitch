// ============================================================
// LyricsVersionMenu — switch between saved lyric mappings
// ============================================================
// Header dropdown listing the Original / Edited / Auto-sync / Tapped
// mappings (see src/lib/lyrics-versions.ts). Only shown when two or more
// versions exist — with a single mapping there's nothing to switch.

import type { Component } from 'solid-js'
import type { Accessor } from 'solid-js'
import { createSignal, For, Show } from 'solid-js'
import type { LyricsVersion, LyricsVersionKind } from '@/lib/lyrics-versions'
import { VERSION_LABELS } from '@/lib/lyrics-versions'

export interface LyricsVersionMenuProps {
  versions: Accessor<LyricsVersion[]>
  activeKind: Accessor<LyricsVersionKind | null>
  onSwitch: (kind: LyricsVersionKind) => void
  onDelete: (kind: LyricsVersionKind) => void
}

export const LyricsVersionMenu: Component<LyricsVersionMenuProps> = (props) => {
  const [open, setOpen] = createSignal(false)
  const activeLabel = () => {
    const k = props.activeKind()
    return k !== null ? VERSION_LABELS[k] : 'Version'
  }

  return (
    <Show when={props.versions().length >= 2}>
      <div class="sm-lyrics-version">
        <button
          class="sm-lyrics-version-btn"
          classList={{ 'sm-lyrics-version-btn--open': open() }}
          onClick={(e) => {
            e.stopPropagation()
            setOpen((v) => !v)
          }}
          title="Switch between saved lyric mappings"
        >
          <svg viewBox="0 0 24 24" width="11" height="11">
            <path
              fill="currentColor"
              d="M4 6h11v2H4V6zm0 5h11v2H4v-2zm0 5h7v2H4v-2zm13.5-6.5L22 14l-4.5 4.5-1.4-1.4L18.2 15H14v-2h4.2l-2.1-2.1 1.4-1.4z"
            />
          </svg>
          <span class="sm-lyrics-version-label">{activeLabel()}</span>
        </button>
        <Show when={open()}>
          <div
            class="sm-lyrics-version-backdrop"
            onClick={(e) => {
              e.stopPropagation()
              setOpen(false)
            }}
          />
          <div class="sm-lyrics-version-menu">
            <For each={props.versions()}>
              {(version) => (
                <div
                  class="sm-lyrics-version-row"
                  classList={{
                    'sm-lyrics-version-row--active':
                      props.activeKind() === version.kind,
                  }}
                >
                  <button
                    class="sm-lyrics-version-pick"
                    onClick={(e) => {
                      e.stopPropagation()
                      props.onSwitch(version.kind)
                      setOpen(false)
                    }}
                  >
                    <span class="sm-lyrics-version-check">
                      <Show when={props.activeKind() === version.kind}>
                        <svg viewBox="0 0 24 24" width="12" height="12">
                          <path
                            fill="currentColor"
                            d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"
                          />
                        </svg>
                      </Show>
                    </span>
                    {VERSION_LABELS[version.kind]}
                  </button>
                  <Show when={props.versions().length >= 2}>
                    <button
                      class="sm-lyrics-version-del"
                      title={`Delete the ${VERSION_LABELS[version.kind]} mapping`}
                      aria-label={`Delete the ${VERSION_LABELS[version.kind]} mapping`}
                      onClick={(e) => {
                        e.stopPropagation()
                        props.onDelete(version.kind)
                        if (props.versions().length <= 1) setOpen(false)
                      }}
                    >
                      <svg viewBox="0 0 24 24" width="11" height="11">
                        <path
                          fill="currentColor"
                          d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"
                        />
                      </svg>
                    </button>
                  </Show>
                </div>
              )}
            </For>
          </div>
        </Show>
      </div>
    </Show>
  )
}
