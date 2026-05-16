// ── JamCameraWidget ──────────────────────────────────────────────────
// Floating camera tray — compact thumbnails at bottom-right.
// Click any chip to expand/collapse that person's feed.
// Border color matches the peer's assigned pitch-trail color.

import type { Component } from 'solid-js'
import { createMemo, createSignal, For, Show } from 'solid-js'
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

// ── Widget root ──────────────────────────────────────────────────────

export const JamCameraWidget: Component = () => {
  const myId = jamPeerId

  // Derive color map from all peers in pitch history (same keys as canvases)
  const colorMap = createMemo(() => {
    const ids = Object.keys(jamPitchHistory())
    return buildPeerColorMap(ids)
  })

  const myColor = () => colorMap()[myId() ?? ''] ?? '#58a6ff'

  return (
    <div class={styles.tray}>
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
