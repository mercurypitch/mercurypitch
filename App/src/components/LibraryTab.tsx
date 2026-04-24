// ============================================================
// LibraryTab — Quick access to saved melodies and sessions
// ============================================================

import type { Component } from 'solid-js'
import { createMemo, For, onMount } from 'solid-js'
import type { PRACTICE_SESSIONS } from '@/data/sessions'
import { appStore } from '@/stores/app-store'
import { melodyStore } from '@/stores/melody-store'
import type { MelodyData } from '@/types'

export const LibraryTab: Component = () => {
  const library = createMemo(() => melodyStore.getMelodyLibrary())

  const recentMelodies = createMemo(() => {
    const items = Object.values(library().melodies) as MelodyData[]
    return [...items]
      .sort((a: MelodyData, b: MelodyData) => (b.lastPlayed ?? b.playCount ?? 0) - (a.lastPlayed ?? a.playCount ?? 0))
      .slice(0, 5)
  })

  const _totalMelodies = createMemo(() => Object.keys(library().melodies).length)
  const _totalPlaylists = createMemo(() => Object.keys(library().playlists).length)

  const openLibrary = () => {
    appStore.showLibrary()
    appStore.setActiveTab('editor')
  }

  const openSessionLibrary = (): void => {
    appStore.showSessionLibrary()
    appStore.setActiveTab('editor')
  }

  const openPresetsLibrary = () => {
    appStore.showPresetsLibrary()
    appStore.setActiveTab('editor')
  }

  const handlePlay = (melody: MelodyData) => {
    // Load and set up the melody data
    melodyStore.loadMelody(melody.id)
    appStore.setCurrentPresetName(melody.name)
    appStore.setTempo(melody.bpm)
    appStore.setKeyName(melody.key)
    appStore.setScaleType(melody.scaleType)
    appStore.setOctave(melody.octave ?? 4)
    // Trigger auto-play from the signal
    window.__autoPlayMelody = melody.id
  }

  const _handlePlaySession = (_session: typeof PRACTICE_SESSIONS[number]): void => {}

  onMount(() => {
    library()
  })

  return (
    <div class="library-tab">
      <div class="tab-header">
        <h3>Library</h3>
        <div class="tab-actions">
          <button class="tab-action-btn" onClick={openLibrary} title="Open Melodies">
            <svg viewBox="0 0 24 24" width="14" height="14">
              <path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
            </svg>
            Melodies
          </button>
          <button class="tab-action-btn" onClick={openPresetsLibrary} title="Open Presets">
            <svg viewBox="0 0 24 24" width="14" height="14">
              <path fill="currentColor" d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-2 10h-4v4h-2v-4H7v-2h4V7h2v4h4v2z" />
            </svg>
            Presets
          </button>
          <button class="tab-action-btn" onClick={openSessionLibrary} title="Open Sessions">
            <svg viewBox="0 0 24 24" width="14" height="14">
              <path fill="currentColor" d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM7 10h5v5H7z" />
            </svg>
            Sessions
          </button>
        </div>
      </div>

      {/* Recent Melodies Section - always shown */}
      <div class="recent-section">
        <p class="section-label">Recent Melodies</p>
        {recentMelodies().length === 0 ? (
          <p class="empty-tip">No melodies yet. Click "Melodies" to create one!</p>
        ) : (
          <For each={recentMelodies()}>
            {(m) => (
              <div class="recent-item" onClick={() => handlePlay(m)}>
                <span class="recent-name">{m.name}</span>
                <span class="recent-meta">{m.bpm} BPM</span>
              </div>
            )}
          </For>
        )}
      </div>

      {/* Quick Actions */}
      <div class="quick-actions">
        <button class="quick-action-btn" onClick={openPresetsLibrary}>
          <svg viewBox="0 0 24 24" width="14" height="14">
            <path fill="currentColor" d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-2 10h-4v4h-2v-4H7v-2h4V7h2v4h4v2z" />
          </svg>
          Quick Start
        </button>
        <button class="quick-action-btn" onClick={openSessionLibrary}>
          <svg viewBox="0 0 24 24" width="14" height="14">
            <path fill="currentColor" d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM7 10h5v5H7z" />
          </svg>
          Sessions
        </button>
      </div>
    </div>
  )
}