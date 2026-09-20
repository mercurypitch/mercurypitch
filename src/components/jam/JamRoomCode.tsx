// ── JamRoomCode ───────────────────────────────────────────────────────
// The room's code, and the button that copies the way in.
//
// These were two things side by side -- a pill with the code in it and a
// "Copy link" button next to it -- saying the same thing twice in a header
// that has no width to spare. The code is what people read aloud; the link
// is what they paste. One control carries both: the code is its label, and
// pressing it copies the link, which opens the room with nothing to type.
// The invite dialog still offers the two separately.
//
// The mark at its end is what says "this copies": a pill of monospace
// letters reads as a label, and nobody presses a label.

import type { Component } from 'solid-js'
import { createEffect, createSignal, onCleanup, Show } from 'solid-js'
import { Portal } from 'solid-js/web'
import { createPortalSkinBridge } from '@/components/portal-skin'
import { jamRoomLink } from '@/lib/jam/jam-room-link'
import styles from './JamRoomCode.module.css'

/** How long the tick stays before the mark goes back to "copy". */
const COPIED_MS = 2000
/** Between the pill and the note under it. */
const NOTE_GAP = 6
/** Clear of the viewport edge, so the note never sits flush against it. */
const NOTE_MARGIN = 8

export interface JamRoomCodeProps {
  roomId: string
  /** The room header's glass pill, or the sidebar card's flat one. */
  skin?: 'glass' | 'card'
}

/** Two sheets, one over the other: the usual sign for "copy". */
const CopyMark: Component = () => (
  <svg
    class={styles.mark}
    viewBox="0 0 16 16"
    width="12"
    height="12"
    fill="none"
    stroke="currentColor"
    stroke-width="1.6"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <rect x="5.5" y="5.5" width="8" height="8" rx="1.8" />
    <path d="M10.5 3.2V3a1.5 1.5 0 0 0-1.5-1.5H4A1.5 1.5 0 0 0 2.5 3v5A1.5 1.5 0 0 0 4 9.5h.2" />
  </svg>
)

const DoneMark: Component = () => (
  <svg
    class={styles.mark}
    viewBox="0 0 16 16"
    width="12"
    height="12"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path d="M3 8.5l3.2 3.2L13 4.8" />
  </svg>
)

export const JamRoomCode: Component<JamRoomCodeProps> = (props) => {
  const [copied, setCopied] = createSignal(false)
  const [noteAt, setNoteAt] = createSignal({ x: 0, y: 0 })
  const portalSkin = createPortalSkinBridge(copied)
  let button: HTMLButtonElement | undefined
  let note: HTMLSpanElement | undefined
  let timer: ReturnType<typeof setTimeout> | undefined

  onCleanup(() => {
    if (timer !== undefined) clearTimeout(timer)
  })

  /** Under the pill and centred on it, pulled back inside the window. */
  const placeNote = (): void => {
    if (button === undefined) return
    const pill = button.getBoundingClientRect()
    const width = note?.offsetWidth ?? 0
    const widest = Math.max(
      NOTE_MARGIN,
      window.innerWidth - width - NOTE_MARGIN,
    )
    const x = pill.left + pill.width / 2 - width / 2
    setNoteAt({
      x: Math.min(Math.max(NOTE_MARGIN, x), widest),
      y: pill.bottom + NOTE_GAP,
    })
  }

  // The note is drawn from the page's own root (see below), so it is placed
  // by hand and has to be told when the pill moves under it: the sidebar's
  // card scrolls, and a tablet turned on its side re-lays the header.
  createEffect(() => {
    if (!copied()) return
    placeNote()
    window.addEventListener('scroll', placeNote, true)
    window.addEventListener('resize', placeNote)
    onCleanup(() => {
      window.removeEventListener('scroll', placeNote, true)
      window.removeEventListener('resize', placeNote)
    })
  })

  /**
   * Say "copied" only once it has been.
   *
   * The clipboard refuses on an insecure origin and whenever the browser
   * decides the press was not a real one, and a tick that shows anyway
   * sends somebody off to paste a link they do not have.
   */
  const copyLink = (): void => {
    const clipboard = navigator.clipboard as Clipboard | undefined
    if (clipboard === undefined) return
    clipboard
      .writeText(jamRoomLink(props.roomId))
      .then(() => {
        setCopied(true)
        if (timer !== undefined) clearTimeout(timer)
        timer = setTimeout(() => {
          timer = undefined
          setCopied(false)
        }, COPIED_MS)
      })
      .catch(() => {
        setCopied(false)
      })
  }

  return (
    <button
      ref={(element) => {
        button = element
        portalSkin.anchorRef(element)
      }}
      type="button"
      class={styles.code}
      classList={{
        [styles.codeCard]: props.skin === 'card',
        [styles.codeCopied]: copied(),
      }}
      // Both skins are on screen at once with the sidebar open.
      data-testid={
        props.skin === 'card' ? 'jam-room-code-card' : 'jam-room-code'
      }
      data-copied={copied() ? '' : undefined}
      title={
        copied()
          ? 'Link copied'
          : 'Copy the link to this room. Anyone who opens it lands here.'
      }
      aria-label={`Room code ${props.roomId}. Copy the link to this room.`}
      onClick={copyLink}
    >
      <span class={styles.codeText}>{props.roomId}</span>
      <Show when={copied()} fallback={<CopyMark />}>
        <DoneMark />
      </Show>
      {/* Said aloud from here, where a screen reader is already listening
          by the time there is something to say. Nothing is drawn: the note
          people see is the one below. */}
      <span class={styles.spoken} role="status" aria-live="polite">
        <Show when={copied()}>Link copied</Show>
      </span>
      {/* Shown under the pill rather than inside it: a touch screen has no
          tooltip, and swapping the code for the word "Copied" would hide the
          one thing people read out.

          Drawn from the page's root, not from the header. The header is a
          layer of its own and the playback row under it is a later one, so
          a note that lived in here was painted first and covered: whatever
          z-index it had only ordered it among the header's own children. */}
      <Show when={copied()}>
        <Portal>
          <span
            ref={note}
            class={styles.toast}
            data-testid="jam-room-code-note"
            aria-hidden="true"
            style={{
              ...portalSkin.style(),
              left: `${noteAt().x}px`,
              top: `${noteAt().y}px`,
            }}
          >
            Link copied
          </span>
        </Portal>
      </Show>
    </button>
  )
}
