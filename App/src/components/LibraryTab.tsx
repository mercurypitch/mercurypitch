// ============================================================
// LibraryTab — Quick access to saved melodies
// ============================================================

import type { Component } from 'solid-js'
import { createMemo, For, onMount } from 'solid-js'
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

  const totalMelodies = createMemo(() => Object.keys(library().melodies).length)
  const totalPlaylists = createMemo(() => Object.keys(library().playlists).length)

  const handlePlay = (melody: MelodyData) => {
    melodyStore.loadMelody(melody.id)
    appStore.setCurrentPresetName(melody.name)
    appStore.setTempo(melody.bpm)
    appStore.setKeyName(melody.key)
    appStore.setScaleType(melody.scaleType)
    appStore.setOctave(melody.octave ?? 4)
  }

  onMount(() => {
    library()
  })

  const handleSessionPlay = () => {
    const sessions = melodyStore.getSessions()
    if (sessions.length > 0) {
      appStore.loadSession?.(sessions[0])
    }
  }

  return (
    <div class="library-tab">
      <div class="tab-header">
        <h3>Library</h3>
        <div class="tab-stats">
          <span class="stat-badge">{totalMelodies()} melodies</span>
          <span class="stat-badge">{totalPlaylists()} playlists</span>
        </div>
      </div>

      <div class="recent-list">
        <p class="section-label">Recent</p>
        {recentMelodies().length === 0 ? (
          <p class="empty-tip">No melodies yet. Click "Library" to create one!</p>
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

      <button class="library-tab-btn" onClick={handleSessionPlay}>
        <svg viewBox="0 0 24 24" width="14" height="14">
          <path fill="currentColor" d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM7 10h5v5H7z" />
        </svg>
        Sessions
      </button>
    </div>
  )
}