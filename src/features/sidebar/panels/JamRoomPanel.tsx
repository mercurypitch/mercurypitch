// The jam room, in the rail — THE roster, not a mirror of one. JamPanel
// used to keep its own collapsible peers sidebar inside the tab; that
// duplicate is gone (docs/plans/sidebar-per-tab.md §4, decision: the
// rail is the only roster) and the room's main area keeps every pixel
// for the stage. Renders nothing until a room is actually active.
//
// Below the roster: what the room can sing. The popup over the transport
// is the same list, but it closes the moment a song is picked -- so going
// from one song to the next was open, scroll, tap, every time. This one
// stays put, which is what makes an evening of songs one tap each.
//
// Default export: loaded lazily by the registry so the jam stack stays
// out of the shell chunk.

import type { Component } from 'solid-js'
import { Show } from 'solid-js'
import { CollapsibleSection } from '@/components/CollapsibleSection'
import { JamNetworkPanel, jamNetworkPanelAvailable, } from '@/components/jam/JamNetworkPanel'
import { JamPeerList } from '@/components/jam/JamPeerList'
import { JamPickerList } from '@/components/jam/JamPickerList'
import { JamPitchDisplay } from '@/components/jam/JamPitchDisplay'
import { JamRoomCode } from '@/components/jam/JamRoomCode'
import { JamSourcePicker } from '@/components/jam/JamSourcePicker'
import { isNarrow } from '@/lib/use-viewport'
import { jamConnectedPeers, jamExerciseMelody, jamIsHost, jamIsMuted, jamPeers, jamRoomId, jamSong, jamState, } from '@/stores/jam-store'
import { setSidebarOpen, sidebarOpen } from '@/stores/ui-store'
import styles from './JamRail.module.css'

const JamRoomPanel: Component = () => {
  /** What the room is running, by name -- all a guest needs to know. */
  const nowSinging = (): string =>
    jamSong()?.title ?? jamExerciseMelody()?.name ?? ''
  /**
   * Whether the list can be seen at all.
   *
   * On a phone the rail is a drawer that slides off-screen rather than
   * leaving the page, so a closed one kept every row mounted: a second set
   * of song buttons nobody can see, in the tab order and in the way of
   * anything looking a song up by name. The list is rebuilt whenever the
   * library ticks, too -- work worth doing only for a list on screen.
   *
   * `isNarrow`, the width the drawer's own stylesheet turns on, and not
   * `isMobile`: that one is also true for any touch screen. A tablet keeps
   * the rail on the page at full width and never opens a drawer, so asking
   * "is this a touch device" left its list unmounted for good -- the songs
   * were in the popup and the sidebar had none.
   */
  const railIsDrawer = isNarrow
  const listOnScreen = (): boolean => !railIsDrawer() || sidebarOpen()

  return (
    <Show when={jamState() === 'active'}>
      {/* The sidebar spaces its PANELS, and both sections are one panel:
          without a gap of their own the list's header sat flush under the
          listening pill. */}
      <div class={styles.sections}>
        <CollapsibleSection title="Room" storageKey="sidebar-jam-room-open">
          <div class={styles.roomCard} data-tour="jam.rail-room">
            <div class={styles.codeRow}>
              <JamRoomCode roomId={jamRoomId() ?? ''} skin="card" />
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
        <CollapsibleSection
          title="Your sound"
          storageKey="sidebar-jam-source-open"
        >
          <JamSourcePicker />
        </CollapsibleSection>
        {/* Diagnostics sit under the roster, not over the stage: they are
            read between takes, and a panel this dense in the main area
            would be the loudest thing in the room. The gate lives inside
            the component so the rail never has to know the rule.
            NOT tree-shaken: it is a runtime check on the hostname and the
            URL, not a build constant, so the panel and its stylesheet are
            in every bundle and only the RENDER is withheld. */}
        <Show when={jamNetworkPanelAvailable()}>
          <CollapsibleSection
            title="Network diagnostics"
            storageKey="sidebar-jam-network-open"
            defaultOpen={false}
          >
            <JamNetworkPanel />
          </CollapsibleSection>
        </Show>
        <CollapsibleSection
          title="Songs and drills"
          storageKey="sidebar-jam-picker-open"
        >
          <div data-tour="jam.rail-picker">
            <Show
              when={jamIsHost()}
              fallback={
                // The host's list is the host's library: their separations,
                // their melodies. Showing a guest their OWN would offer rows
                // they cannot pick, so a guest is told the one true thing.
                <p class={styles.guestNote}>
                  <Show
                    when={nowSinging() !== ''}
                    fallback="Nothing is loaded yet."
                  >
                    Now in the room: <strong>{nowSinging()}</strong>.
                  </Show>{' '}
                  The host picks what the room sings.
                </p>
              }
            >
              {/* On a phone the rail is a drawer over the stage, so a pick
                folds it away; on a desk it stays, which is the point. */}
              <Show when={listOnScreen()}>
                <JamPickerList
                  variant="rail"
                  onPicked={() => {
                    if (railIsDrawer()) setSidebarOpen(false)
                  }}
                />
              </Show>
            </Show>
          </div>
        </CollapsibleSection>
      </div>
    </Show>
  )
}

export default JamRoomPanel
