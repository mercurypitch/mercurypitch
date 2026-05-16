// ── JamCameraWidget ──────────────────────────────────────────────────
// Floating camera tray — compact thumbnails, draggable anywhere on screen.
// Default position: top-right (above the pitch strip area).
// Click any chip to expand/collapse that person's feed.
// Border color matches the peer's assigned pitch-trail color.

import type { Component } from 'solid-js'
import { createMemo, createSignal, For, Index, onCleanup, onMount, Show, } from 'solid-js'
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
          <video
            ref={(el) => {
              if (props.stream !== null) {
                el.srcObject = props.stream
              }
            }}
            autoplay
            muted={props.isLocal === true}
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
            <span>Cam off</span>
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

        <span class={styles.expandHint}>
          {expanded() ? 'collapse' : 'expand'}
        </span>
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

  // Default: top-right, 20px margin. Stored as top/right offset.
  const [pos, setPos] = createSignal({ x: window.innerWidth - 110, y: 80 })
  let dragging = false
  let dragStart = { x: 0, y: 0, px: 0, py: 0 }
  let trayRef: HTMLDivElement | undefined

  const colorMap = createMemo(() => {
    const ids = Object.keys(jamPitchHistory())
    return buildPeerColorMap(ids)
  })

  const myColor = () => colorMap()[myId() ?? ''] ?? '#58a6ff'

  const onPointerDown = (e: PointerEvent) => {
    // Only drag on the handle element
    const target = e.target as HTMLElement
    if (!target.closest(`.${styles.dragHandle}`)) return
    dragging = true
    dragStart = { x: e.clientX, y: e.clientY, px: pos().x, py: pos().y }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    e.preventDefault()
  }

  const onPointerMove = (e: PointerEvent) => {
    if (!dragging) return
    const dx = e.clientX - dragStart.x
    const dy = e.clientY - dragStart.y
    const vw = window.innerWidth
    const vh = window.innerHeight
    const tw = trayRef?.offsetWidth ?? 100
    const th = trayRef?.offsetHeight ?? 200
    setPos({
      x: Math.max(0, Math.min(vw - tw, dragStart.px + dx)),
      y: Math.max(0, Math.min(vh - th, dragStart.py + dy)),
    })
  }

  const onPointerUp = () => {
    dragging = false
  }

  onMount(() => {
    // Re-clamp on resize
    const onResize = () => {
      setPos((p) => ({
        x: Math.min(p.x, window.innerWidth - (trayRef?.offsetWidth ?? 100)),
        y: Math.min(p.y, window.innerHeight - (trayRef?.offsetHeight ?? 200)),
      }))
    }
    window.addEventListener('resize', onResize, { passive: true })
    onCleanup(() => window.removeEventListener('resize', onResize))
  })

  return (
    <div
      ref={trayRef}
      class={styles.tray}
      style={{
        left: `${pos().x}px`,
        top: `${pos().y}px`,
        right: 'auto',
        bottom: 'auto',
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
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
