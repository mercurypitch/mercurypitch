// Daily Routine — the retention surface, shown wherever practice starts.

import type { Component } from 'solid-js'
import styles from '@/components/AppSidebar.module.css'
import { DailyRoutinePanel } from '@/features/routines/DailyRoutinePanel'

export const RoutinePanel: Component = () => (
  <div class={styles.sidebarSection} data-tour="singing.daily-routine">
    <DailyRoutinePanel />
  </div>
)
