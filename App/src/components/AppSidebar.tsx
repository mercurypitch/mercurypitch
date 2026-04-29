// ============================================================
// AppSidebar — Shared sidebar component
// Contains: Key/Scale controls, Grid toggle, NoteList, PitchDisplay, Stats
// Visible in all tabs; NoteList, PitchDisplay, stats wrapped in Show for Practice only
// ============================================================

import type { Component } from 'solid-js'
import { createMemo, For, Show } from 'solid-js'
import { LibraryTab } from '@/components/LibraryTab'
import { NoteList } from '@/components/NoteList'
import { PitchDisplay } from '@/components/PitchDisplay'
import { KEY_OFFSETS, midiToFreq, midiToNote } from '@/lib/scale-data'
import { activeTab as appActiveTab, appStore, startWalkthrough } from '@/stores/app-store'
import { melodyStore } from '@/stores/melody-store'
import type { MelodyItem, NoteResult, PitchResult } from '@/types'

interface AppSidebarProps {
  /** Called when a preset is loaded */
  onPresetLoad?: (name: string) => void
  /** For octave shift handler from parent */
  onOctaveShift?: (delta: number) => void
  /** Open scale builder modal */
  onOpenScaleBuilder?: () => void
  /** Note list props (Practice tab) */
  melody: () => MelodyItem[]
  currentNoteIndex: () => number
  noteResults: () => NoteResult[]
  isPlaying: () => boolean
  /** Pitch display props (Practice tab) */
  pitch: () => PitchResult | null
  targetNoteName: () => string | null
  /** Additional CSS class (e.g. 'open' for mobile toggle) */
  class?: string
  /** Called when mobile close button is clicked */
  onClose?: () => void
}

export const AppSidebar: Component<AppSidebarProps> = (props) => {
  // Local alias for reactive tracking
  const activeTab = () => appActiveTab()
  const userSession = createMemo(() => appStore.userSession?.())
  return (
    <aside
      class={`app-sidebar${props.class !== undefined && props.class !== '' ? ` ${props.class}` : ''}`}
    >
      {/* Mobile close button */}
      <button
        class="sidebar-close-btn"
        onClick={props.onClose}
        title="Close menu"
      >
        <svg viewBox="0 0 24 24" width="18" height="18">
          <path
            fill="currentColor"
            d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"
          />
        </svg>
      </button>

      {/* Library button */}
      <button
        class="tour-btn"
        onClick={() => appStore.showLibrary()}
        title="View Library"
      >
        <svg viewBox="0 0 24 24" width="16" height="16">
          <path
            fill="currentColor"
            d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM7 10h5v5H7z"
          />
        </svg>
        Library
      </button>

      {/* Guide Tour button — interactive spotlight overlay */}
      <button
        class="tour-btn"
        onClick={startWalkthrough}
        title="Start Guide Tour"
      >
        <svg viewBox="0 0 24 24" width="16" height="16">
          <path
            fill="currentColor"
            d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"
          />
        </svg>
        Guide
      </button>

      {/* Scale section */}
      <div class="sidebar-section">
        <h2 class="panel-title">Scale</h2>

        <div id="scale-info">
          <span class="key-label">Key:</span>
          <select
            id="key-select"
            value={appStore.keyName()}
            onChange={(e) => {
              const newKey = e.currentTarget.value
              const currentKey = appStore.keyName()

              // Transpose existing melody notes if any
              const melody = melodyStore.getCurrentItems()
              if (melody.length > 0) {
                const currentOffset = KEY_OFFSETS[currentKey] ?? 0
                const newOffset = KEY_OFFSETS[newKey] ?? 0
                const delta = newOffset - currentOffset

                if (delta !== 0) {
                  const transposed = melody.map((item) => {
                    const newMidi = item.note.midi + delta
                    const { name, octave } = midiToNote(newMidi)
                    return {
                      ...item,
                      note: {
                        ...item.note,
                        midi: newMidi,
                        name,
                        octave,
                        freq: midiToFreq(newMidi),
                      },
                    }
                  })
                  melodyStore.setMelody(transposed)
                }
              }

              appStore.setKeyName(newKey)
              melodyStore.refreshScale(
                newKey,
                melodyStore.getCurrentOctave(),
                appStore.scaleType(),
              )
            }}
          >
            <option value="C">C</option>
            <option value="G">G</option>
            <option value="D">D</option>
            <option value="A">A</option>
            <option value="E">E</option>
            <option value="B">B</option>
            <option value="F">F</option>
            <option value="Bb">Bb</option>
          </select>

          <span class="octave-label">Oct:</span>
          <div class="octave-ctrl">
            <button
              class="octave-btn"
              title="Lower octave"
              onClick={() => props.onOctaveShift?.(-1)}
            >
              <svg viewBox="0 0 24 24" width="14" height="14">
                <path
                  fill="currentColor"
                  d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z"
                />
              </svg>
            </button>
            <span class="octave-value">{melodyStore.getCurrentOctave()}</span>
            <button
              class="octave-btn"
              title="Higher octave"
              onClick={() => props.onOctaveShift?.(1)}
            >
              <svg viewBox="0 0 24 24" width="14" height="14">
                <path
                  fill="currentColor"
                  d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z"
                />
              </svg>
            </button>
          </div>

          <span class="preset-label">Scale:</span>
          <select
            id="scale-select"
            value={appStore.scaleType()}
            onChange={(e) => {
              const st = e.currentTarget.value
              appStore.setScaleType(st)
              melodyStore.refreshScale(
                appStore.keyName(),
                melodyStore.getCurrentOctave(),
                st,
              )
            }}
          >
            <option value="major">Major</option>
            <option value="natural-minor">Minor (Natural)</option>
            <option value="harmonic-minor">Harmonic Minor</option>
            <option value="melodic-minor">Melodic Minor</option>
            <option value="dorian">Dorian</option>
            <option value="mixolydian">Mixolydian</option>
            <option value="phrygian">Phrygian</option>
            <option value="lydian">Lydian</option>
            <option value="pentatonic-major">Pentatonic Major</option>
            <option value="pentatonic-minor">Pentatonic Minor</option>
            <option value="blues">Blues</option>
            <option value="chromatic">Chromatic</option>
          </select>
          <button
            id="open-scale-builder"
            class="ctrl-btn roll-ctrl-btn"
            title="Build custom scale"
            onClick={() => props.onOpenScaleBuilder?.()}
          >
            <svg
              viewBox="0 0 24 24"
              width="14"
              height="14"
              style={{ 'margin-right': '4px' }}
            >
              <path
                fill="currentColor"
                d="M3 17v2h6v-2H3zM3 5v2h10V5H3zm10 16v-2h8v-2h-8v-2h-2v6h2zM7 9v2H3v2h4v2h2V9H7zm14 4v-2H11v2h10zm-6-4h2V7h4V5h-4V3h-2v6z"
              />
            </svg>
            Custom
          </button>
        </div>
      </div>

      {/* Library */}
      <div class="sidebar-section">
        <LibraryTab />
      </div>

      {/* Stats panel — Practice tab only */}
      <Show when={activeTab() === 'practice'}>
        <div class="sidebar-section">
          <div id="stats-panel">
            <h3>Accuracy</h3>
            <div id="stats-bars">
              <div class="stat-row" data-band="100">
                <span class="stat-label">Perfect</span>
                <div class="stat-bar-bg">
                  <div class="stat-bar" id="bar-100" />
                </div>
                <span class="stat-count" id="cnt-100">
                  0
                </span>
              </div>
              <div class="stat-row" data-band="90">
                <span class="stat-label">Excellent</span>
                <div class="stat-bar-bg">
                  <div class="stat-bar" id="bar-90" />
                </div>
                <span class="stat-count" id="cnt-90">
                  0
                </span>
              </div>
              <div class="stat-row" data-band="75">
                <span class="stat-label">Good</span>
                <div class="stat-bar-bg">
                  <div class="stat-bar" id="bar-75" />
                </div>
                <span class="stat-count" id="cnt-75">
                  0
                </span>
              </div>
              <div class="stat-row" data-band="50">
                <span class="stat-label">Okay</span>
                <div class="stat-bar-bg">
                  <div class="stat-bar" id="bar-50" />
                </div>
                <span class="stat-count" id="cnt-50">
                  0
                </span>
              </div>
              <div class="stat-row" data-band="0">
                <span class="stat-label">Off</span>
                <div class="stat-bar-bg">
                  <div class="stat-bar" id="bar-0" />
                </div>
                <span class="stat-count" id="cnt-0">
                  0
                </span>
              </div>
            </div>
            <div id="score-display">
              <span id="score-label">Score:</span>
              <span id="score-value" class="live-score-value">
                --
              </span>
            </div>

            {/* Session history — practice tab only */}
            <Show when={appStore.sessionResults().length > 0}>
              <div id="session-history-panel">
                <h3>Sessions</h3>
                <div id="session-history-list">
                  <For each={appStore.sessionResults()}>
                    {(entry) => (
                      <div class="session-history-entry">
                        <span class="session-history-name">
                          {entry.sessionName}
                        </span>
                        <span
                          class={`session-history-score ${entry.score >= 80 ? 'score-high' : entry.score >= 50 ? 'score-mid' : 'score-low'}`}
                        >
                          {entry.score}%
                        </span>
                      </div>
                    )}
                  </For>
                </div>
              </div>
            </Show>
          </div>
        </div>
      </Show>

      {/* Note list + pitch reference — Practice tab only (bottom-anchored) */}
      <Show when={activeTab() === 'practice'}>
        <div class="sidebar-section sidebar-notes-bottom">
          {/* Current session items display */}
          <div class="session-items-display">
            <h3>Session Items</h3>
            <div id="session-items-list">
              <Show when={userSession()?.items}>
                <For each={userSession()!.items}>
                  {(item) => (
                    <div class="session-item-entry">
                      <span class="session-item-label">{item.label}</span>
                      <span class="session-item-type">
                        {item.type === 'melody' ? '🎵' : item.type === 'scale' ? '♩' : '♪'}
                      </span>
                    </div>
                  )}
                </For>
              </Show>
              <Show when={!userSession()?.items || (userSession()?.items?.length ?? 0) === 0}>
                <p class="session-empty-tip">
                  No items in session
                </p>
              </Show>
            </div>
          </div>
          <NoteList
            melody={props.melody}
            currentNoteIndex={props.currentNoteIndex}
            noteResults={props.noteResults}
            isPlaying={props.isPlaying}
          />
          <PitchDisplay pitch={props.pitch} targetNote={props.targetNoteName} />
        </div>
      </Show>
    </aside>
  )
}
