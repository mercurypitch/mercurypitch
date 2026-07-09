// ── JamPeerList ─────────────────────────────────────────────────────
// Displays connected peers with status indicators and latency.

import type { Component } from 'solid-js'
import { For, Show } from 'solid-js'
import type { JamPeer } from '@/lib/jam/types'
import styles from './Jam.module.css'

interface JamPeerListProps {
  peers: JamPeer[]
}

const STATE_LABELS: Record<JamPeer['connectionState'], string> = {
  connecting: 'connecting...',
  connected: 'connected',
  disconnected: 'disconnected',
  failed: 'failed',
}

const peerItemStates: Record<JamPeer['connectionState'], string> = {
  connecting: styles.peerConnecting,
  connected: styles.peerConnected,
  disconnected: styles.peerDisconnected,
  failed: styles.peerFailed,
}

const peerDotStates: Record<JamPeer['connectionState'], string> = {
  connecting: styles.peerDotConnecting,
  connected: styles.peerDotConnected,
  disconnected: styles.peerDotDisconnected,
  failed: styles.peerDotFailed,
}

export const JamPeerList: Component<JamPeerListProps> = (props) => {
  return (
    <div class={styles.peerList}>
      <Show
        when={props.peers.length > 0}
        fallback={<p class={styles.peerEmpty}>Waiting for peers to join...</p>}
      >
        <h3 class={styles.peerHeading}>Peers ({props.peers.length})</h3>
        <For each={props.peers}>
          {(peer) => (
            <div
              class={`${styles.peerItem} ${peerItemStates[peer.connectionState]}`}
            >
              <div class={styles.peerInfo}>
                <span
                  class={`${styles.peerDot} ${peerDotStates[peer.connectionState]}`}
                />
                <span class={styles.peerName}>{peer.displayName}</span>
              </div>
              <div class={styles.peerMeta}>
                <span class={styles.peerState}>
                  {STATE_LABELS[peer.connectionState]}
                </span>
                <Show when={peer.latency > 0}>
                  <span class={styles.peerLatency}>{peer.latency}ms</span>
                </Show>
              </div>
            </div>
          )}
        </For>
      </Show>
    </div>
  )
}
