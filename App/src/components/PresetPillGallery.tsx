// ============================================================
// PresetPillGallery — Scrollable pill gallery for recent presets
// Displays preset names as rounded buttons (GitHub-style status pills)
// Clicking a pill loads that preset
// ============================================================

import type { Component } from 'solid-js'
import { For, Show } from 'solid-js'
import { appStore, initPresets } from '@/stores/app-store'
import styles from '@/styles/PresetPillGallery.module.css'

export type PracticeSubMode = 'all' | 'random' | 'focus' | 'reverse'

interface PresetPillGalleryProps {
  _melody: () => unknown[]
  onLoad?: (name: string) => void
}

export const PresetPillGallery: Component<PresetPillGalleryProps> = (props) => {
  // Initialize presets if needed
  initPresets()

  // Reactive preset names from appStore
  const presetNames = () => Object.keys(appStore.presets()).sort()

  // Track recently used presets (top 8)
  const recentPresets = () => {
    const names = presetNames()
    const current = appStore.currentPresetName()
    // Get unique names, excluding current, limit to 8
    return names
      .filter((n) => n !== current)
      .slice(0, 8)
  }

  const handleLoad = (name: string) => {
    props.onLoad?.(name)
  }

  return (
    <Show when={presetNames().length > 1}>
      <div class={styles.presetPillGallery}>
        <h3 class={styles.galleryTitle}>Recent Melodies</h3>
        <div class={styles.galleryScroll}>
          <For each={recentPresets()}>
            {(name: string) => {
              const isCurrent = appStore.currentPresetName() === name

              return (
                <button
                  class={`${styles.pill} ${isCurrent ? styles.pillCurrent : ''}`}
                  onClick={() => handleLoad(name)}
                  title={isCurrent ? 'Currently loaded' : `Load "${name}"`}
                >
                  {name}
                  {isCurrent && <span class={styles.currentIndicator}>✓</span>}
                </button>
              )
            }}
          </For>
        </div>
      </div>
    </Show>
  )
}