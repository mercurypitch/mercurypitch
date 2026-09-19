// ============================================================
// LyricsAlignButtons — left, middle, right, as three buttons
// ============================================================
//
// The same choice LyricsAlignSelect offers, for a header with room to show
// all of it. The select is one chip because the stem mixer's header has six
// controls fighting for a row; its price is a menu drawn by the operating
// system, which in a room of glass panels looks like a system dialog that
// wandered in. A jam room's lyric header holds a label and nothing else, so
// it can afford three glyphs that say what they do and show which one is on.
//
// Same value type and the same accessor/setter pair as the select, so a
// host swaps one for the other without touching its state.
//
// A radio group rather than three toggles, because that is what it is:
// exactly one is on, and arrows moving the choice is what a keyboard user
// expects from one. Only the chosen button is in the tab order (roving
// tabindex) -- three tab stops for one setting is two too many in a room
// whose transport is also reached by Tab.

import type { Accessor, Component, Setter } from 'solid-js'
import { For } from 'solid-js'
import type { LyricsAlign } from '@/components/LyricsAlignIcon'
import { LYRICS_ALIGN_LABELS, LYRICS_ALIGNS, LyricsAlignIcon, } from '@/components/LyricsAlignIcon'
import styles from './LyricsAlignButtons.module.css'

export interface LyricsAlignButtonsProps {
  lyricsAlign: Accessor<LyricsAlign>
  setLyricsAlign: Setter<LyricsAlign>
}

/**
 * Where a key takes the choice, or null for a key that is not ours.
 *
 * Wraps at both ends, as the ARIA radio pattern asks: Right on the last
 * button is a request for the first, not a dead key.
 */
function nextAlignIndex(key: string, from: number): number | null {
  const last = LYRICS_ALIGNS.length - 1
  switch (key) {
    case 'ArrowRight':
    case 'ArrowDown':
      return from >= last ? 0 : from + 1
    case 'ArrowLeft':
    case 'ArrowUp':
      return from <= 0 ? last : from - 1
    case 'Home':
      return 0
    case 'End':
      return last
    default:
      return null
  }
}

export const LyricsAlignButtons: Component<LyricsAlignButtonsProps> = (
  props,
) => {
  let groupRef: HTMLDivElement | undefined

  /**
   * Bound natively (`on:keydown`), not through Solid's delegated
   * `onKeyDown`.
   *
   * Delegation runs from one listener on the document, so a host that
   * stops propagation anywhere above this group -- a dialog isolating its
   * keys from the transport, say -- would leave the arrows dead while
   * clicks still worked (docs/agent/MISTAKES.md has that one). A listener
   * on the group itself hears the key first, whatever sits above it.
   */
  const handleKeyDown = (event: KeyboardEvent): void => {
    if (event.altKey || event.ctrlKey || event.metaKey) return
    // From the button that has focus, which is the chosen one unless a
    // pointer put focus somewhere else first.
    const focused =
      event.target instanceof HTMLElement
        ? LYRICS_ALIGNS.indexOf(event.target.dataset.value as LyricsAlign)
        : -1
    const from =
      focused >= 0 ? focused : LYRICS_ALIGNS.indexOf(props.lyricsAlign())
    const next = nextAlignIndex(event.key, from)
    if (next === null) return
    const align = LYRICS_ALIGNS[next]
    if (align === undefined) return
    // Both, and the second matters as much as the first. The app's global
    // shortcuts listen on window and read Home as "back to the start" and
    // Up/Down as playback speed; a key spent choosing an alignment must
    // not also seek the song.
    event.preventDefault()
    event.stopPropagation()
    props.setLyricsAlign(align)
    // Focus follows the choice, so the next arrow starts from here and the
    // one tab stop is always the button that is on.
    groupRef
      ?.querySelector<HTMLButtonElement>(`[data-value="${align}"]`)
      ?.focus()
  }

  return (
    <div
      ref={groupRef}
      class={styles.group}
      role="radiogroup"
      aria-label="Lyric alignment"
      on:keydown={handleKeyDown}
    >
      <For each={LYRICS_ALIGNS}>
        {(align) => (
          <button
            type="button"
            role="radio"
            class={styles.btn}
            classList={{ [styles.btnOn]: props.lyricsAlign() === align }}
            // Not `data-align`: the lyric sheets this control drives carry
            // that attribute themselves, and anything looking for "the
            // aligned thing" would find a button first.
            data-value={align}
            aria-checked={props.lyricsAlign() === align}
            aria-label={LYRICS_ALIGN_LABELS[align]}
            title={LYRICS_ALIGN_LABELS[align]}
            tabIndex={props.lyricsAlign() === align ? 0 : -1}
            onClick={() => props.setLyricsAlign(align)}
          >
            <LyricsAlignIcon align={align} size={13} />
          </button>
        )}
      </For>
    </div>
  )
}
