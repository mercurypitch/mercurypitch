// Display & visibility toggles — last section; advanced mode only (the
// practice-first UI keeps canvas defaults). Ball/playhead guard each
// other: at least one position indicator stays on.

import type { Component } from 'solid-js'
import { Show } from 'solid-js'
import styles from '@/components/AppSidebar.module.css'
import { CollapsibleSection } from '@/components/CollapsibleSection'
import { gridLinesVisible, setGridLinesVisible, setShowPitchDisplay, setShowPlaybackBall, setShowPlayhead, setShowStats, showPitchDisplay, showPlaybackBall, showPlayhead, showStats, } from '@/stores'
import { setShowSidebarNoteList, showSidebarNoteList, uiMode, } from '@/stores/settings-store'

export const DisplayPanel: Component = () => (
  <Show when={uiMode() === 'advanced'}>
    <CollapsibleSection title="Display" storageKey="sidebar-display-open">
      <div class={styles.visGrid} data-tour="singing.display">
        <div class={styles.visGridCell}>
          <span class={styles.visGridLabel}>Ball</span>
          <label class={['settings-toggle', styles.visGridToggle].join(' ')}>
            <input
              type="checkbox"
              checked={showPlaybackBall()}
              onChange={(e) => {
                const v = e.currentTarget.checked
                setShowPlaybackBall(v)
                if (!v && !showPlayhead()) setShowPlayhead(true)
              }}
            />
            <span class="settings-slider" />
          </label>
        </div>
        <div class={styles.visGridCell}>
          <span class={styles.visGridLabel}>Playhead</span>
          <label class={['settings-toggle', styles.visGridToggle].join(' ')}>
            <input
              type="checkbox"
              checked={showPlayhead()}
              onChange={(e) => {
                const v = e.currentTarget.checked
                setShowPlayhead(v)
                if (!v && !showPlaybackBall()) setShowPlaybackBall(true)
              }}
            />
            <span class="settings-slider" />
          </label>
        </div>
        <div class={styles.visGridCell}>
          <span class={styles.visGridLabel}>Grid</span>
          <label class={['settings-toggle', styles.visGridToggle].join(' ')}>
            <input
              type="checkbox"
              checked={gridLinesVisible()}
              onChange={(e) => {
                setGridLinesVisible(e.currentTarget.checked)
              }}
            />
            <span class="settings-slider" />
          </label>
        </div>
        <div class={styles.visGridCell}>
          <span class={styles.visGridLabel}>Notes</span>
          <label class={['settings-toggle', styles.visGridToggle].join(' ')}>
            <input
              type="checkbox"
              checked={showSidebarNoteList()}
              onChange={(e) => {
                setShowSidebarNoteList(e.currentTarget.checked)
              }}
            />
            <span class="settings-slider" />
          </label>
        </div>
        <div class={styles.visGridCell}>
          <span class={styles.visGridLabel}>Stats</span>
          <label class={['settings-toggle', styles.visGridToggle].join(' ')}>
            <input
              type="checkbox"
              checked={showStats()}
              onChange={(e) => {
                setShowStats(e.currentTarget.checked)
              }}
            />
            <span class="settings-slider" />
          </label>
        </div>
        <div class={styles.visGridCell}>
          <span class={styles.visGridLabel}>Pitch</span>
          <label class={['settings-toggle', styles.visGridToggle].join(' ')}>
            <input
              type="checkbox"
              checked={showPitchDisplay()}
              onChange={(e) => {
                setShowPitchDisplay(e.currentTarget.checked)
              }}
            />
            <span class="settings-slider" />
          </label>
        </div>
      </div>
    </CollapsibleSection>
  </Show>
)
