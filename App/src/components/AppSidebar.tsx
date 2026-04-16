// ============================================================
// AppSidebar — Shared sidebar component
// Contains: Key/Scale controls, Grid toggle, PresetSelector, NoteList, PitchDisplay, Stats
// Visible in all tabs; NoteList, PitchDisplay, stats wrapped in Show for Practice only
// ============================================================

import { Component, Show } from 'solid-js';
import {
  appStore,
  getNoteAccuracyMap,
} from '@/stores/app-store';
import { melodyStore } from '@/stores/melody-store';
import { PresetSelector } from '@/components/PresetSelector';
import { NoteList } from '@/components/NoteList';
import { PitchDisplay } from '@/components/PitchDisplay';
import { KEY_OFFSETS, midiToFreq, midiToNote } from '@/lib/scale-data';
import type { PresetData } from '@/stores/app-store';
import type { MelodyItem, NoteResult, PitchResult } from '@/types';

interface AppSidebarProps {
  /** Called when a preset is loaded */
  onPresetLoad?: (preset: PresetData) => void;
  /** For octave shift handler from parent */
  onOctaveShift?: (delta: number) => void;
  /** Note list props (Practice tab) */
  melody: () => MelodyItem[];
  currentNoteIndex: () => number;
  noteResults: () => NoteResult[];
  isPlaying: () => boolean;
  /** Pitch display props (Practice tab) */
  pitch: () => PitchResult | null;
  targetNoteName: () => string | null;
}

export const AppSidebar: Component<AppSidebarProps> = (props) => {
  return (
    <aside class="app-sidebar">
      {/* Scale section */}
      <div class="sidebar-section">
        <h2 class="panel-title">Scale</h2>

        <div id="scale-info">
          <span class="key-label">Key:</span>
          <select
            id="key-select"
            value={appStore.keyName()}
            onChange={(e) => {
              const newKey = e.currentTarget.value;
              const currentKey = appStore.keyName();

              // Transpose existing melody notes if any
              const melody = melodyStore.items;
              if (melody.length > 0) {
                const currentOffset = KEY_OFFSETS[currentKey] ?? 0;
                const newOffset = KEY_OFFSETS[newKey] ?? 0;
                const delta = newOffset - currentOffset;

                if (delta !== 0) {
                  const transposed = melody.map((item) => {
                    const newMidi = item.note.midi + delta;
                    const { name, octave } = midiToNote(newMidi);
                    return {
                      ...item,
                      note: {
                        ...item.note,
                        midi: newMidi,
                        name,
                        octave,
                        freq: midiToFreq(newMidi),
                      },
                    };
                  });
                  melodyStore.setMelody(transposed);
                }
              }

              appStore.setKeyName(newKey);
              melodyStore.refreshScale(newKey, melodyStore.currentOctave(), appStore.scaleType());
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
              <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z"/></svg>
            </button>
            <span class="octave-value">{melodyStore.currentOctave()}</span>
            <button
              class="octave-btn"
              title="Higher octave"
              onClick={() => props.onOctaveShift?.(1)}
            >
              <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z"/></svg>
            </button>
          </div>

          <span class="preset-label">Scale:</span>
          <select
            id="scale-select"
            value={appStore.scaleType()}
            onChange={(e) => {
              const st = e.currentTarget.value;
              appStore.setScaleType(st);
              melodyStore.refreshScale(appStore.keyName(), melodyStore.currentOctave(), st);
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
        </div>
      </div>

      {/* Grid lines toggle */}
      <div class="sidebar-section">
        <button
          id="grid-toggle-btn"
          class={`ctrl-btn roll-ctrl-btn ${appStore.gridLinesVisible() ? 'active' : ''}`}
          onClick={() => appStore.toggleGridLines()}
          title="Toggle grid lines"
        >
          <svg viewBox="0 0 24 24" width="14" height="14" style={{ "margin-right": "4px" }}>
            <path fill="currentColor" d="M20 2H4c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM8 20H4v-4h4v4zm0-6H4v-4h4v4zm0-6H4V4h4v4zm6 12h-4v-4h4v4zm0-6h-4v-4h4v4zm0-6h-4V4h4v4zm6 12h-4v-4h4v4zm0-6h-4v-4h4v4zm0-6h-4V4h4v4z"/>
          </svg>
          Grid
        </button>
      </div>

      {/* Preset selector */}
      <div class="sidebar-section">
        <PresetSelector
          onLoad={(preset) => {
            props.onPresetLoad?.(preset);
          }}
        />
      </div>

      {/* Stats panel — Practice tab only */}
      <Show when={appStore.activeTab() === 'practice'}>
        <div class="sidebar-section">
          <div id="stats-panel">
            <h3>Accuracy</h3>
            <div id="stats-bars">
              <div class="stat-row" data-band="100">
                <span class="stat-label">Perfect</span>
                <div class="stat-bar-bg"><div class="stat-bar" id="bar-100" /></div>
                <span class="stat-count" id="cnt-100">0</span>
              </div>
              <div class="stat-row" data-band="90">
                <span class="stat-label">Excellent</span>
                <div class="stat-bar-bg"><div class="stat-bar" id="bar-90" /></div>
                <span class="stat-count" id="cnt-90">0</span>
              </div>
              <div class="stat-row" data-band="75">
                <span class="stat-label">Good</span>
                <div class="stat-bar-bg"><div class="stat-bar" id="bar-75" /></div>
                <span class="stat-count" id="cnt-75">0</span>
              </div>
              <div class="stat-row" data-band="50">
                <span class="stat-label">Okay</span>
                <div class="stat-bar-bg"><div class="stat-bar" id="bar-50" /></div>
                <span class="stat-count" id="cnt-50">0</span>
              </div>
              <div class="stat-row" data-band="0">
                <span class="stat-label">Off</span>
                <div class="stat-bar-bg"><div class="stat-bar" id="bar-0" /></div>
                <span class="stat-count" id="cnt-0">0</span>
              </div>
            </div>
            <div id="score-display">
              <span id="score-label">Score:</span>
              <span id="score-value" class="live-score-value">--</span>
            </div>
          </div>
        </div>
      </Show>

      {/* Note list + pitch reference — Practice tab only (bottom-anchored) */}
      <Show when={appStore.activeTab() === 'practice'}>
        <div class="sidebar-section sidebar-notes-bottom">
          <NoteList
            melody={props.melody}
            currentNoteIndex={props.currentNoteIndex}
            noteResults={props.noteResults}
            isPlaying={props.isPlaying}
          />
          <PitchDisplay
            pitch={props.pitch}
            targetNote={props.targetNoteName}
          />
        </div>
      </Show>
    </aside>
  );
};
