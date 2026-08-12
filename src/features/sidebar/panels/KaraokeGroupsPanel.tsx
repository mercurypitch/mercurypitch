// Song groups in the rail — the Karaoke library's group filter, lifted
// out of the panel body so the session list keeps its vertical space
// (docs/plans/sidebar-per-tab.md §4, "the big win"). The selection lives
// in uvr-store; on a phone UvrPanel still renders its inline copy inside
// the drawerless layout, driving the same signal.
//
// Default export: the registry loads this panel lazily so the karaoke
// stack stays out of the shell chunk.

import type { Component } from 'solid-js'
import { CollapsibleSection } from '@/components/CollapsibleSection'
import { SessionGroupTabs } from '@/components/SessionGroupTabs'
import { karaokeActiveGroupId, setKaraokeActiveGroupId, } from '@/stores/uvr-store'
import styles from './KaraokeRail.module.css'

const KaraokeGroupsPanel: Component = () => (
  <CollapsibleSection
    title="Song groups"
    storageKey="sidebar-karaoke-groups-open"
  >
    <div class={styles.groupsWrap} data-tour="karaoke.rail-groups">
      <SessionGroupTabs
        activeGroupId={karaokeActiveGroupId()}
        onSelectGroup={setKaraokeActiveGroupId}
      />
    </div>
  </CollapsibleSection>
)

export default KaraokeGroupsPanel
