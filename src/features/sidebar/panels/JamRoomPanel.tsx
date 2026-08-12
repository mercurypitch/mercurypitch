// The jam room, in the rail — THE roster, not a mirror of one. JamPanel
// used to keep its own collapsible peers sidebar inside the tab; that
// duplicate is gone (docs/plans/sidebar-per-tab.md §4, decision: the
// rail is the only roster) and the room's main area keeps every pixel
// for the stage. Renders nothing until a room is actually active.
//
// Default export: loaded lazily by the registry so the jam stack stays
// out of the shell chunk.

import type { Component } from 'solid-js'
import { createSignal, Show } from 'solid-js'
import { CollapsibleSection } from '@/components/CollapsibleSection'
import { JamPeerList } from '@/components/jam/JamPeerList'
import { JamPitchDisplay } from '@/components/jam/JamPitchDisplay'
import { jamConnectedPeers, jamIsMuted, jamPeers, jamRoomId, jamState, } from '@/stores/jam-store'
import styles from './JamRail.module.css'

const JamRoomPanel: Component = () => {
  const [linkCopied, setLinkCopied] = createSignal(false)
  const roomLink = (): string =>
    `${window.location.origin}/#/jam:${jamRoomId() ?? ''}`

  return (
    <Show when={jamState() === 'active'}>
      <CollapsibleSection title="Room" storageKey="sidebar-jam-room-open">
        <div class={styles.roomCard} data-tour="jam.rail-room">
          <div class={styles.codeRow}>
            <span class={styles.codeBadge}>{jamRoomId()}</span>
            <button
              class={styles.copyBtn}
              onClick={() => {
                navigator.clipboard.writeText(roomLink()).catch(() => {})
                setLinkCopied(true)
                setTimeout(() => setLinkCopied(false), 2000)
              }}
            >
              {linkCopied() ? 'Copied!' : 'Copy link'}
            </button>
          </div>
          <div class={styles.statusRow}>
            <span class={styles.statusDot} />
            <span>
              {jamConnectedPeers().length} peer
              {jamConnectedPeers().length !== 1 ? 's' : ''} connected
            </span>
            <Show when={jamIsMuted()}>
              <span class={styles.muted}>(muted)</span>
            </Show>
          </div>
          <JamPeerList peers={jamPeers()} />
          <JamPitchDisplay />
        </div>
      </CollapsibleSection>
    </Show>
  )
}

export default JamRoomPanel
