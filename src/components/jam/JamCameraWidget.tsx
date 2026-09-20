// ── JamCameraWidget ──────────────────────────────────────────────────
// Floating camera tray — compact thumbnails, draggable anywhere on screen.
// It starts docked in the bottom-right corner, beside the chat bubble, and
// stays beside it (whatever the chat is doing) until somebody drags it.
// Click any chip to expand/collapse that person's feed.
// Border color matches the peer's assigned pitch-trail color.

import type { Component } from 'solid-js'
import { createMemo, createSignal, For, Index, onCleanup, onMount, Show, } from 'solid-js'
import type { DragGestureOptions } from '@/components/shared/drag-gesture'
import { dragGesture } from '@/components/shared/drag-gesture'
import { buildPeerColorMap } from '@/lib/jam/peer-colors'
import { jamLocalStream, jamPeerId, jamPeers, jamPitchHistory, jamRemoteStreams, jamVideoEnabled, } from '@/stores/jam-store'
import styles from './JamCameraWidget.module.css'

// ── Individual camera chip ───────────────────────────────────────────

interface CamChipProps {
  stream: MediaStream | null
  name: string
  isLocal?: boolean
  videoOn?: boolean
  color?: string
}

const CamChip: Component<CamChipProps> = (props) => {
  const [expanded, setExpanded] = createSignal(false)
  const borderColor = () => props.color ?? 'var(--border)'
  const borderStyle = () =>
    `1px solid ${expanded() ? borderColor() : 'var(--border)'}`
  const glowStyle = () =>
    expanded()
      ? `0 0 12px ${borderColor()}55, 0 4px 16px rgba(0,0,0,0.5)`
      : undefined

  return (
    <div
      class={`${styles.chip} ${expanded() ? styles.expanded : ''}`}
      onClick={() => setExpanded((v) => !v)}
      title={expanded() ? 'Click to collapse' : 'Click to expand'}
    >
      <div
        class={styles.thumb}
        style={{
          border: borderStyle(),
          'box-shadow': glowStyle(),
        }}
      >
        <Show when={props.stream !== null && props.videoOn !== false}>
          {/* Always muted, local or remote. The stream carries the peer's
              microphone as well as their camera, and the room already
              plays that through its own element -- so an unmuted chip was
              a SECOND copy of everyone who turned their camera on. Twice
              the voice, and twice the gain around any feedback loop. */}
          <video
            ref={(el) => {
              if (props.stream !== null) {
                el.srcObject = props.stream
              }
            }}
            autoplay
            muted
            playsinline
            class={styles.video}
          />
        </Show>

        <Show when={props.stream === null || props.videoOn === false}>
          <div class={styles.camOff}>
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <line x1="1" y1="1" x2="23" y2="23" />
              <path d="M21 21H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3m3-3h6l2 3h4a2 2 0 0 1 2 2v9.34m-7.72-2.06A4 4 0 1 1 7.72 7.72" />
            </svg>
          </div>
        </Show>

        <Show when={props.isLocal === true}>
          <div
            class={styles.youDot}
            style={{
              background: borderColor(),
              'box-shadow': `0 0 4px ${borderColor()}`,
            }}
          />
        </Show>

        <span class={styles.expandHint} aria-hidden="true" />
      </div>

      <span
        class={styles.name}
        style={{ color: expanded() ? borderColor() : undefined }}
      >
        {props.isLocal === true ? 'You' : props.name}
      </span>
    </div>
  )
}

// ── Draggable tray ────────────────────────────────────────────────────

export const JamCameraWidget: Component = () => {
  const myId = jamPeerId

  /** Until the tray has been laid out and can be measured. */
  const FALLBACK_W = 100
  const FALLBACK_H = 76
  /** Clear of the screen edge and of the chat, the same 12px the chat uses. */
  const GAP = 12
  const EDGE = 20

  /**
   * Where the singer put the tray, or `null` while it is still docked.
   *
   * Docked is a rule, not a coordinate: "left of the chat, bottoms level".
   * It was a coordinate worked out once from the window's size, and then
   * pushed clear of a chat window assumed to be open and 340 by 440 -- so
   * with the chat shut the tray sat 440px in from the corner, over the
   * lanes, beside nothing. Reading the chat's real box puts it next to the
   * bubble, moves it aside when the chat opens and brings it back when the
   * chat shuts.
   */
  const [wanted, setWanted] = createSignal<{ x: number; y: number } | null>(
    null,
  )
  let dragging = false
  let dragStart = { x: 0, y: 0, px: 0, py: 0 }
  let trayRef: HTMLDivElement | undefined

  const colorMap = createMemo(() => {
    const ids = Object.keys(jamPitchHistory())
    return buildPeerColorMap(ids)
  })

  const myColor = () => colorMap()[myId() ?? ''] ?? '#58a6ff'

  const measured = (size: number | undefined, fallback: number): number =>
    size !== undefined && size > 0 ? size : fallback

  /** The chat's box as it is right now: a bubble, or the open window. */
  const chatBox = (): DOMRect | null => {
    const box = document
      .querySelector<HTMLElement>('[data-jam-chat]')
      ?.getBoundingClientRect()
    // No chat on screen, or one that has not been laid out.
    if (box === undefined || box.width === 0 || box.height === 0) return null
    return box
  }

  /** Where the tray goes, given where it is wanted. Always fully on screen. */
  const place = (want: { x: number; y: number } | null) => {
    const vw = window.innerWidth
    const vh = window.innerHeight
    const tw = measured(trayRef?.offsetWidth, FALLBACK_W)
    const th = measured(trayRef?.offsetHeight, FALLBACK_H)
    const chat = chatBox()

    if (want === null) {
      const right = chat === null ? vw - EDGE : chat.left - GAP
      const bottom = chat === null ? vh - EDGE : chat.bottom
      return {
        x: Math.max(0, Math.min(vw - tw, right - tw)),
        y: Math.max(0, Math.min(vh - th, bottom - th)),
      }
    }

    let cx = Math.max(0, Math.min(vw - tw, want.x))
    let cy = Math.max(0, Math.min(vh - th, want.y))

    // Never under the chat: step aside by the shorter way out.
    if (chat !== null) {
      const overlapsX = cx + tw > chat.left - GAP && cx < chat.right
      const overlapsY = cy + th > chat.top - GAP && cy < chat.bottom
      if (overlapsX && overlapsY) {
        const pushLeft = cx + tw - (chat.left - GAP)
        const pushUp = cy + th - (chat.top - GAP)
        if (pushLeft < pushUp) cx = Math.max(0, chat.left - GAP - tw)
        else cy = Math.max(0, chat.top - GAP - th)
      }
    }

    return { x: cx, y: cy }
  }

  const [pos, setPos] = createSignal(place(null))
  const settle = (): void => {
    setPos(place(wanted()))
  }

  const trayDrag: DragGestureOptions = {
    canStart: (event) =>
      (event.target as HTMLElement).closest(`.${styles.dragHandle}`) !== null,
    onStart: (event) => {
      dragging = true
      dragStart = {
        x: event.clientX,
        y: event.clientY,
        px: pos().x,
        py: pos().y,
      }
    },
    onMove: (event) => {
      const dx = event.clientX - dragStart.x
      const dy = event.clientY - dragStart.y
      setWanted({ x: dragStart.px + dx, y: dragStart.py + dy })
      settle()
    },
    onEnd: () => {
      dragging = false
      // Where it ended up is where it is wanted: a tray let go of under the
      // chat was moved clear, and must not slide back the next time the
      // chat's size changes. Re-settled in case it grew during the drag.
      if (wanted() !== null) setWanted(pos())
      settle()
    },
  }

  onMount(() => {
    // Settle again whenever the tray changes size (a chip expanding), the
    // chat does (it opens into a window), or the window does.
    const ro = new ResizeObserver(() => {
      if (!dragging) settle()
    })
    if (trayRef) ro.observe(trayRef)
    const chat = document.querySelector('[data-jam-chat]')
    if (chat !== null) ro.observe(chat)

    window.addEventListener('resize', settle, { passive: true })
    settle()

    onCleanup(() => {
      ro.disconnect()
      window.removeEventListener('resize', settle)
    })
  })

  return (
    <div
      ref={(element) => {
        trayRef = element
        dragGesture(element, () => trayDrag)
      }}
      class={styles.tray}
      data-testid="jam-camera-tray"
      style={{
        left: `${pos().x}px`,
        top: `${pos().y}px`,
        right: 'auto',
        bottom: 'auto',
      }}
    >
      {/* Drag handle */}
      <div class={styles.dragHandle} title="Drag to reposition">
        <div class={styles.dragDots}>
          <Index each={[0, 1, 2, 3, 4, 5]}>
            {() => <div class={styles.dragDot} />}
          </Index>
        </div>
      </div>

      {/* Local camera */}
      <CamChip
        stream={jamLocalStream()}
        name="You"
        isLocal
        videoOn={jamVideoEnabled()}
        color={myColor()}
      />

      {/* Remote cameras */}
      <For each={Object.entries(jamRemoteStreams())}>
        {([peerId, stream]) => {
          const peer = () => jamPeers().find((p) => p.id === peerId)
          const color = () => colorMap()[peerId] ?? '#f0883e'
          return (
            <CamChip
              stream={stream}
              name={peer()?.displayName ?? peerId.slice(0, 8)}
              videoOn={peer()?.hasVideo !== false}
              color={color()}
            />
          )
        }}
      </For>
    </div>
  )
}
