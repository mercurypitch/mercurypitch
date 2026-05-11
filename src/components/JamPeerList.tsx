// ── JamPeerList ─────────────────────────────────────────────────────
// Displays connected peers with status indicators and latency.

import type { Component } from 'solid-js'
import { For, Show } from 'solid-js'
import type { JamPeer } from '@/lib/jam-types'

interface JamPeerListProps {
  peers: JamPeer[]
}

const STATE_LABELS: Record<JamPeer['connectionState'], string> = {
  connecting: 'connecting...',
  connected: 'connected',
  disconnected: 'disconnected',
  failed: 'failed',
}

export const JamPeerList: Component<JamPeerListProps> = (props) => {
  return (
    <div class="jam-peer-list">
      <Show
        when={props.peers.length > 0}
        fallback={<p class="jam-peer-empty">Waiting for peers to join...</p>}
      >
        <h3 class="jam-peer-heading">Peers ({props.peers.length})</h3>
        <For each={props.peers}>
          {(peer) => (
            <div class={`jam-peer-item jam-peer-${peer.connectionState}`}>
              <div class="jam-peer-info">
                <span
                  class={`jam-peer-dot jam-peer-dot-${peer.connectionState}`}
                />
                <span class="jam-peer-name">{peer.displayName}</span>
              </div>
              <div class="jam-peer-meta">
                <span class="jam-peer-state">
                  {STATE_LABELS[peer.connectionState]}
                </span>
                <Show when={peer.latency > 0}>
                  <span class="jam-peer-latency">{peer.latency}ms</span>
                </Show>
              </div>
            </div>
          )}
        </For>
      </Show>
    </div>
  )
}
