// ============================================================
// LyricsVersionMenu — switch between saved lyric mappings
// ============================================================
// Header dropdown listing the Original / Edited / Auto-sync / Mapped
// mappings (see src/lib/lyrics-versions.ts). Shown when two or more
// versions exist (with a single mapping there's nothing to switch), or when
// a "Generate from vocal" action is wired in — that action must stay
// reachable even with one (or zero) versions.
//
// The menu and backdrop render through a Portal with fixed positioning:
// inside the stage panels an ancestor's fade (element opacity cannot be
// overridden from a child) left the open menu near-transparent and
// unreadable (owner testing). Portalled, the menu is always fully opaque
// and immune to panel overflow clipping too.

import type { Component } from 'solid-js'
import type { Accessor } from 'solid-js'
import { createEffect, createSignal, For, onCleanup, Show } from 'solid-js'
import { Portal } from 'solid-js/web'
import type { LyricsVersion, LyricsVersionKind } from '@/lib/lyrics-versions'
import { VERSION_LABELS } from '@/lib/lyrics-versions'

export interface LyricsVersionMenuProps {
  versions: Accessor<LyricsVersion[]>
  activeKind: Accessor<LyricsVersionKind | null>
  onSwitch: (kind: LyricsVersionKind) => void
  onDelete: (kind: LyricsVersionKind) => void
  /** Build a "From vocal" draft with Whisper. Optional — surfaces the
   *  action item (and the menu itself, even with < 2 versions) when set. */
  onGenerateFromVocal?: () => void
  generatingFromVocal?: Accessor<boolean>
  /** Live phase label while generating ("Fetching the listener… 42%",
   *  "Transcribing… 12s") — shown on the action item and, since the
   *  dropdown is usually closed during the long run, on the trigger too. */
  generatingLabel?: Accessor<string>
}

export const LyricsVersionMenu: Component<LyricsVersionMenuProps> = (props) => {
  const [open, setOpen] = createSignal(false)
  const [menuPos, setMenuPos] = createSignal({ top: 0, right: 0 })
  let triggerRef: HTMLButtonElement | undefined

  const openMenu = (): void => {
    const rect = triggerRef?.getBoundingClientRect()
    if (rect) {
      setMenuPos({
        top: rect.bottom + 4,
        right: Math.max(8, window.innerWidth - rect.right),
      })
    }
    setOpen(true)
  }

  // The fixed-position menu is anchored to a rect captured at open time —
  // a scroll or resize invalidates it, so just close (menus are brief).
  createEffect(() => {
    if (!open()) return
    const close = (): void => {
      setOpen(false)
    }
    window.addEventListener('scroll', close, { capture: true, passive: true })
    window.addEventListener('resize', close)
    onCleanup(() => {
      window.removeEventListener('scroll', close, { capture: true })
      window.removeEventListener('resize', close)
    })
  })

  const activeLabel = () => {
    // While a From-vocal draft is being generated the dropdown is usually
    // closed — the trigger doubles as the live status line.
    if (props.generatingFromVocal?.() === true) {
      return props.generatingLabel?.() ?? 'Listening to the vocal…'
    }
    const k = props.activeKind()
    return k !== null ? VERSION_LABELS[k] : 'Version'
  }

  return (
    <Show
      when={
        props.versions().length >= 2 || props.onGenerateFromVocal !== undefined
      }
    >
      <div class="sm-lyrics-version">
        <button
          ref={triggerRef}
          class="sm-lyrics-version-btn"
          classList={{ 'sm-lyrics-version-btn--open': open() }}
          onClick={(e) => {
            e.stopPropagation()
            if (open()) setOpen(false)
            else openMenu()
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
          <Portal>
            <div
              class="sm-lyrics-version-backdrop"
              onClick={(e) => {
                e.stopPropagation()
                setOpen(false)
              }}
            />
            <div
              class="sm-lyrics-version-menu"
              style={{
                position: 'fixed',
                top: `${menuPos().top}px`,
                right: `${menuPos().right}px`,
                left: 'auto',
              }}
            >
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
              <Show when={props.onGenerateFromVocal !== undefined}>
                <Show when={props.versions().length > 0}>
                  <div class="sm-lyrics-version-sep" />
                </Show>
                <button
                  class="sm-lyrics-version-action"
                  disabled={props.generatingFromVocal?.() === true}
                  title="Listen to the vocal stem and draft synced lyrics from it"
                  onClick={(e) => {
                    e.stopPropagation()
                    props.onGenerateFromVocal?.()
                    setOpen(false)
                  }}
                >
                  <span class="sm-lyrics-version-check">
                    <svg viewBox="0 0 24 24" width="12" height="12">
                      <path
                        fill="currentColor"
                        d="M12 14a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2z"
                      />
                    </svg>
                  </span>
                  {props.generatingFromVocal?.() === true
                    ? (props.generatingLabel?.() ?? 'Listening to the vocal…')
                    : 'Generate from vocal'}
                </button>
              </Show>
            </div>
          </Portal>
        </Show>
      </div>
    </Show>
  )
}
