// ============================================================
// AppSidebar — Shared sidebar component
// Contains: Key/Scale controls, Grid toggle, NoteList, PitchDisplay, Stats
// Visible in all tabs; NoteList, PitchDisplay, stats wrapped in Show for Practice only
// ============================================================

import type { Component } from 'solid-js'
import { createSignal, For, Show } from 'solid-js'
import { CharacterIcons } from '@/components/CharacterIcons'
import { LibraryTab } from '@/components/LibraryTab'
import { NoteList } from '@/components/NoteList'
import { PitchDisplay } from '@/components/PitchDisplay'
import { StatsBars } from '@/components/StatsBars'
import { KEY_OFFSETS, midiToFreq, midiToNote } from '@/lib/scale-data'
import { activeTab as appActiveTab, sessionResults, showNotification, } from '@/stores'
import { keyName, scaleType, setKeyName, setScaleType } from '@/stores'
import { melodyStore } from '@/stores/melody-store'
import { showSidebarNoteList } from '@/stores/settings-store'
import type { MelodyItem, NoteResult, PitchResult } from '@/types'

interface AppSidebarProps {
  /** Called when a preset is loaded */
  onPresetLoad?: (name: string) => void
  /** For octave shift handler from parent */
  onOctaveShift?: (delta: number) => void
  /** Open scale builder modal */
  onOpenScaleBuilder?: () => void
  /** Open Learn walkthroughs */
  onOpenLearn?: () => void
  /** Open Guide tours */
  onOpenGuide?: () => void
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
  /** Called when the mobile close button is clicked */
  onClose?: () => void
}

export const AppSidebar: Component<AppSidebarProps> = (props) => {
  // Local alias for reactive tracking
  const activeTab = () => appActiveTab()
  const [viewOctave, setViewOctave] = createSignal(
    melodyStore.getCurrentOctave(),
  )

  const handleViewOctaveShift = (delta: number): void => {
    if (activeTab() === 'editor') {
      // Editor is allowed to mutate the actual melody (transpose notes).
      props.onOctaveShift?.(delta)
      setViewOctave(melodyStore.getCurrentOctave())
      return
    }

    // Practice/sidebar playback setup is view-only: change the displayed
    // scale/octave reference without modifying the user's saved melody.
    const nextOctave = Math.max(1, Math.min(6, viewOctave() + delta))
    setViewOctave(nextOctave)
    melodyStore.setOctave(nextOctave)
    melodyStore.refreshScale(keyName(), nextOctave, scaleType())
  }

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

      {/* Learn + Guide buttons */}
      <div class="walkthrough-control-group">
        <button
          class="walkthrough-control-btn"
          onClick={() => props.onOpenLearn?.()}
          title="View PitchPerfect walkthroughs"
        >
          <svg viewBox="0 0 24 24" width="18" height="18">
            <path
              fill="currentColor"
              d="M21 5c-1.11-.35-2.33-.5-3.5-.5-1.95 0-4.05.4-5.5 1.5-1.45-1.1-3.55-1.5-5.5-1.5S2.45 4.9 1 6v14.65c0 .25.25.5.5.5.1 0 .15-.05.25-.05C3.1 20.45 5.05 20 6.5 20c1.95 0 4.05.4 5.5 1.5 1.35-.85 3.8-1.5 5.5-1.5 1.65 0 3.43.3 4.5 1.5.15.15.35.05.5 0 .1-.1.1-.25 0-.35C21.25 20 21 19.75 21 19.5V5z"
            />
          </svg>
          <span class="walkthrough-control-text">Learn</span>
        </button>
        <button
          class="walkthrough-control-btn walkthrough-control-btn-guide"
          onClick={() => props.onOpenGuide?.()}
          title="Interactive guide tours"
        >
          <svg viewBox="0 0 24 24" width="18" height="18">
            <path
              fill="currentColor"
              d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"
            />
          </svg>
          <span class="walkthrough-control-text">Guide</span>
        </button>
      </div>

      <CharacterIcons
        onSelect={(name) => showNotification(`Selected ${name}!`, 'info')}
      />

      {/* Scale section */}
      <div class="sidebar-section">
        <h2 class="panel-title">Playback Setup</h2>

        <div id="scale-info">
          <select
            id="key-select"
            value={keyName()}
            onChange={(e) => {
              const newKey = e.currentTarget.value
              const currentKey = keyName()

              // In Editor tab, the key dropdown is an editing operation and
              // may transpose the actual melody. In Practice/sidebar usage it
              // must be view-only: update key/scale display, but never write
              // transposed notes back into the user's melody.
              const melody = melodyStore.getCurrentItems()
              if (activeTab() === 'editor' && melody.length > 0) {
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

              setKeyName(newKey)
              melodyStore.refreshScale(
                newKey,
                melodyStore.getCurrentOctave(),
                scaleType(),
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

          <div class="octave-ctrl">
            <button
              class="octave-btn"
              title="Lower octave"
              onClick={() => handleViewOctaveShift(-1)}
            >
              <svg viewBox="0 0 24 24" width="14" height="14">
                <path
                  fill="currentColor"
                  d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z"
                />
              </svg>
            </button>
            <span class="octave-value">{viewOctave()}</span>
            <button
              class="octave-btn"
              title="Higher octave"
              onClick={() => handleViewOctaveShift(1)}
            >
              <svg viewBox="0 0 24 24" width="14" height="14">
                <path
                  fill="currentColor"
                  d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z"
                />
              </svg>
            </button>
          </div>

          <select
            id="scale-select"
            class="sidebar-session-select sidebar-scale-select"
            value={scaleType()}
            onChange={(e) => {
              const st = e.currentTarget.value
              setScaleType(st)
              melodyStore.refreshScale(
                keyName(),
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
            <StatsBars noteResults={props.noteResults} />
            <div id="score-display">
              <span id="score-label">Score:</span>
              <span id="score-value" class="live-score-value">
                --
              </span>
            </div>

            {/* Session history — practice tab only */}
            <Show when={sessionResults().length > 0}>
              <div id="session-history-panel">
                <h3>Sessions</h3>
                <div id="session-history-list">
                  <For each={sessionResults()}>
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
          <Show when={showSidebarNoteList()}>
            <NoteList
              melody={props.melody}
              currentNoteIndex={props.currentNoteIndex}
              noteResults={props.noteResults}
              isPlaying={props.isPlaying}
            />
          </Show>
          <PitchDisplay pitch={props.pitch} targetNote={props.targetNoteName} />
        </div>
      </Show>
    </aside>
  )
}
