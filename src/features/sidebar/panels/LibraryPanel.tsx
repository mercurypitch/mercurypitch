// Melody library — where the melody presets feed the surface. The
// 'sidebar-library' focus anchor lives inside LibraryTab.

import type { Component } from 'solid-js'
import styles from '@/components/AppSidebar.module.css'
import { LibraryTab } from '@/components/LibraryTab'

export const LibraryPanel: Component = () => (
  <div class={styles.sidebarSection}>
    <LibraryTab />
  </div>
)
