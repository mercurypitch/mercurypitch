// Activity — streak calendar + practice heatmap. Advanced mode only:
// simple mode keeps the sidebar to practice essentials. Recent-session
// scores live in the top-right canvas scoreboard (SingingCanvasHud).

import type { Component } from 'solid-js'
import { Show } from 'solid-js'
import styles from '@/components/AppSidebar.module.css'
import { CollapsibleSection } from '@/components/CollapsibleSection'
import { StreakCalendar } from '@/components/StreakCalendar'
import { CalendarHeatmap } from '@/features/practice-intelligence/components/CalendarHeatmap'
import { uiMode } from '@/stores/settings-store'

export const ActivityPanel: Component = () => (
  <Show when={uiMode() === 'advanced'}>
    <CollapsibleSection title="Activity" storageKey="sidebar-activity-open">
      <div data-tour="singing.activity">
        <StreakCalendar />
        <div class={styles.heatmapWrapper}>
          <CalendarHeatmap weeks={8} />
        </div>
      </div>
    </CollapsibleSection>
  </Show>
)
