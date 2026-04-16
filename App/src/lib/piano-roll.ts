// ============================================================
// Piano Roll Editor — Canvas-based note editor
// ============================================================

import type { MelodyItem, ScaleDegree, PianoRollConfig, NoteName } from '@/types';
import type { InstrumentType } from '@/lib/audio-engine';

export const PIANO_ROLL_CONFIG: PianoRollConfig = {
  rowHeight: 22,
  beatWidth: 48,
  pianoWidth: 62,
  rulerHeight: 28,
  beatsPerBar: 4,
  minDuration: 0.25,
  noteColors: {
    normal: 'rgba(88, 166, 255, 0.75)',
    selected: 'rgba(88, 166, 255, 1.0)',
    active: 'rgba(63, 185, 80, 0.85)',
    ghost: 'rgba(88, 166, 255, 0.35)',
  },
};

// ============================================================
// MIDI Export
// ============================================================

/** Encode a melody as a Standard MIDI File (Format 1). */
export function exportMelodyToMIDI(
  melody: MelodyItem[],
  bpm: number
): Uint8Array | null {
  if (!melody || melody.length === 0) return null;

  const TICKS_PER_BEAT = 480;

  function writeVarLen(value: number): number[] {
    const bytes: number[] = [];
    let v = Math.floor(value);
    bytes.push(v & 0x7f);
    while ((v >>= 7) > 0) {
      bytes.push((v & 0x7f) | 0x80);
    }
    bytes.reverse();
    return bytes;
  }

  // Build absolute event list
  const absEvents: Array<{
    tick: number;
    delta: number;
    type: number;
    subtype?: number;
    note?: number;
    velocity?: number;
    data?: number[];
  }> = [];

  // Tempo meta event (0xFF 0x51)
  const microsecondsPerBeat = Math.round(60000000 / bpm);
  absEvents.push({
    tick: 0,
    delta: 0,
    type: 0xff,
    subtype: 0x51,
    data: [
      (microsecondsPerBeat >> 16) & 0xff,
      (microsecondsPerBeat >> 8) & 0xff,
      microsecondsPerBeat & 0xff,
    ],
  });

  // Time signature (0xFF 0x58)
  absEvents.push({ tick: 0, delta: 0, type: 0xff, subtype: 0x58, data: [0x04, 0x02, 0x18, 0x08] });

  // Note events
  melody.forEach((item) => {
    const midi = item.note?.midi ?? 60;
    const tickOn = Math.round(item.startBeat * TICKS_PER_BEAT);
    const tickOff = Math.round((item.startBeat + item.duration) * TICKS_PER_BEAT);
    absEvents.push({ tick: tickOn, delta: 0, type: 0x90, note: midi, velocity: 80 });
    absEvents.push({ tick: tickOff, delta: 0, type: 0x80, note: midi, velocity: 0 });
  });

  // Sort by tick
  absEvents.sort((a, b) => a.tick - b.tick);

  // Recompute deltas
  let prevTick = 0;
  absEvents.forEach((e) => {
    const d = e.tick - prevTick;
    e.delta = d;
    prevTick = e.tick;
  });

  // Serialize track
  const trackData: number[] = [];
  absEvents.forEach((e) => {
    trackData.push(...writeVarLen(e.delta));
    if (e.type === 0xff) {
      trackData.push(e.subtype!);
      if (e.data) {
        trackData.push(e.data.length);
        trackData.push(...e.data);
      } else {
        trackData.push(0);
      }
    } else {
      trackData.push(e.type, e.note!, e.velocity!);
    }
  });

  // End of track (0xFF 0x2F 0x00)
  trackData.push(0xff, 0x2f, 0x00);

  // Header chunk
  const header = [
    0x4d, 0x54, 0x68, 0x64, // MThd
    0x00, 0x00, 0x00, 0x06, // length 6
    0x00, 0x01,             // format 1
    0x00, 0x01,             // 1 track
    0x01, 0xe0,             // 480 ticks/beat
  ];

  // Track chunk
  const trackLen = trackData.length;
  const track = [
    0x4d, 0x54, 0x72, 0x6b, // MTrk
    (trackLen >> 24) & 0xff,
    (trackLen >> 16) & 0xff,
    (trackLen >> 8) & 0xff,
    trackLen & 0xff,
    ...trackData,
  ];

  const midiData = new Uint8Array(header.length + track.length);
  midiData.set(header, 0);
  midiData.set(track, header.length);
  return midiData;
}

/** Trigger a browser download of a MIDI file. */
export function downloadMIDI(melody: MelodyItem[], bpm: number, filename?: string): boolean {
  const data = exportMelodyToMIDI(melody, bpm);
  if (!data) {
    alert('No melody to export. Add some notes first.');
    return false;
  }
  const blob = new Blob([new Uint8Array(data)], { type: 'audio/midi' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || 'pitchperfect-melody.mid';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return true;
}

// ============================================================
// Note ID generation
// ============================================================

let _nextId = 1;
export function generateNoteId(): number {
  return _nextId++;
}

// ============================================================
// Piano Roll Editor
// ============================================================

export interface PianoRollOptions {
  container: HTMLElement;
  scale?: ScaleDegree[];
  bpm?: number;
  totalBeats?: number;
  onMelodyChange?: (melody: MelodyItem[]) => void;
  onNoteSelect?: (note: MelodyItem | null) => void;
  onInstrumentChange?: (instrument: InstrumentType) => void;
}

export type PlaybackState = 'stopped' | 'playing' | 'paused';
export type ActiveTool = 'place' | 'erase' | 'select';
export type EffectType = 'slide-up' | 'slide-down' | 'ease-in' | 'ease-out' | 'vibrato';

export class PianoRollEditor {
  private container: HTMLElement;
  private scale: ScaleDegree[] = [];
  private melody: MelodyItem[] = [];
  private bpm: number;
  private totalBeats: number;

  // DOM elements
  private pianoCanvas: HTMLCanvasElement | null = null;
  private gridCanvas: HTMLCanvasElement | null = null;
  private rulerCanvas: HTMLCanvasElement | null = null;
  private pianoCtx: CanvasRenderingContext2D | null = null;
  private gridCtx: CanvasRenderingContext2D | null = null;
  private rulerCtx: CanvasRenderingContext2D | null = null;
  private gridContainer: HTMLElement | null = null;

  // Dimensions
  private readonly config = PIANO_ROLL_CONFIG;
  private rowHeight: number;
  private beatWidth: number;
  private zoomLevel: number;
  private pianoWidth: number;
  private rulerHeight: number;
  private totalRows = 0;
  private stretchedWidth = 0;

  // Playback
  private playbackState: PlaybackState = 'stopped';
  private playAnimationId: number | null = null;
  private playStartTime = 0;
  private pauseStartTime = 0;
  private activeBeat = 0;
  private isSeeking = false;
  private seekStartX = 0;

  // Interaction
  private selectedNoteId: number | null = null;
  private activeTool: ActiveTool = 'place';
  private isDragging = false;
  private isResizing = false;
  private resizeHandle: 'left' | 'right' | null = null;
  private dragStartX = 0;
  private dragStartY = 0;
  private dragStartBeat = 0;
  private dragStartDuration = 0;
  private selectedDuration = 1;
  private nextNoteId = 1;

  // Scale/Octave state (matches old app)
  private octave = 4;
  private numOctaves = 1;
  private mode = 'major';

  // Effect state
  private selectedEffect: EffectType | null = null;

  // Undo/redo history
  private historyStack: MelodyItem[][] = [];
  private redoStack: MelodyItem[][] = [];
  private readonly maxHistorySize = 50;

  // Callbacks
  private onMelodyChange?: (melody: MelodyItem[]) => void;
  private onNoteSelect?: (note: MelodyItem | null) => void;
  private onPlayClick?: () => void;
  private onResetClick?: () => void;
  private onInstrumentChange?: (instrument: InstrumentType) => void;

  // Presets
  private presetData: Record<string, {
    notes: Array<{ midi: number; startBeat: number; duration: number; effectType?: string; linkedTo?: number[] }>;
    totalBeats: number;
    bpm: number;
    scale: Array<{ midi: number; name: string; octave: number; freq: number }>;
  }> = {};
  private currentPresetName: string | null = null;

  constructor(options: PianoRollOptions) {
    this.container = options.container;
    this.scale = options.scale ?? [];
    this.bpm = options.bpm ?? 120;
    this.totalBeats = options.totalBeats ?? 16;
    this.onMelodyChange = options.onMelodyChange;
    this.onNoteSelect = options.onNoteSelect;
    this.onInstrumentChange = options.onInstrumentChange;
    this.rowHeight = this.config.rowHeight;
    this.zoomLevel = 1.0;
    this.beatWidth = this.config.beatWidth;
    this.pianoWidth = this.config.pianoWidth;
    this.rulerHeight = this.config.rulerHeight;
    this.totalRows = this.scale.length;

    this.buildDOM();
    this.attachEventListeners();
    this.draw();
  }

  // ============================================================
  // Public API
  // ============================================================

  setMelody(melody: MelodyItem[]): void {
    this.clearHistory();
    this.melody = melody.map((item) => ({
      ...item,
      id: item.id ?? this.nextNoteId++,
    }));
    this.draw();
  }

  getMelody(): MelodyItem[] {
    return [...this.melody];
  }

  // ============================================================
  // Undo/Redo
  // ============================================================

  /** Push current state to history stack before making changes */
  private pushHistory(): void {
    // Save a deep copy of current melody
    this.historyStack.push(JSON.parse(JSON.stringify(this.melody)));
    // Limit history size
    if (this.historyStack.length > this.maxHistorySize) {
      this.historyStack.shift();
    }
    // Clear redo stack on new action
    this.redoStack = [];
  }

  /** Undo the last action */
  undo(): boolean {
    if (this.historyStack.length === 0) return false;
    // Save current state to redo stack
    this.redoStack.push(JSON.parse(JSON.stringify(this.melody)));
    // Restore previous state
    this.melody = this.historyStack.pop()!;
    this.emitMelodyChange();
    this.draw();
    this.updateUndoRedoButtons();
    return true;
  }

  /** Redo the last undone action */
  redo(): boolean {
    if (this.redoStack.length === 0) return false;
    // Save current state to history stack
    this.historyStack.push(JSON.parse(JSON.stringify(this.melody)));
    // Restore next state
    this.melody = this.redoStack.pop()!;
    this.emitMelodyChange();
    this.draw();
    this.updateUndoRedoButtons();
    return true;
  }

  /** Check if undo is available */
  canUndo(): boolean {
    return this.historyStack.length > 0;
  }

  /** Check if redo is available */
  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  /** Clear all history (call on preset load or melody clear) */
  clearHistory(): void {
    this.historyStack = [];
    this.redoStack = [];
    this.updateUndoRedoButtons();
  }

  /** Update undo/redo button disabled states */
  private updateUndoRedoButtons(): void {
    const undoBtn = this.container.querySelector('#roll-undo-btn') as HTMLButtonElement;
    const redoBtn = this.container.querySelector('#roll-redo-btn') as HTMLButtonElement;
    if (undoBtn) undoBtn.disabled = !this.canUndo();
    if (redoBtn) redoBtn.disabled = !this.canRedo();
  }

  setScale(scale: ScaleDegree[]): void {
    this.scale = scale;
    this.totalRows = scale.length;
    this.buildCanvases();
    this.draw();
  }

  setBPM(bpm: number): void {
    this.bpm = bpm;
  }

  setInstrument(instrument: InstrumentType): void {
    this.onInstrumentChange?.(instrument);
  }

  setTotalBeats(beats: number): void {
    this.totalBeats = beats;
    this.buildCanvases();
    this.draw();
  }

  zoomIn(): void {
    this.zoomLevel = Math.min(3.0, this.zoomLevel + 0.2);
    this.beatWidth = this.config.beatWidth * this.zoomLevel;
    this.buildCanvases();
    this.draw();
  }

  zoomOut(): void {
    this.zoomLevel = Math.max(0.3, this.zoomLevel - 0.2);
    this.beatWidth = this.config.beatWidth * this.zoomLevel;
    this.buildCanvases();
    this.draw();
  }

  setZoom(level: number): void {
    this.zoomLevel = Math.max(0.3, Math.min(3.0, level));
    this.beatWidth = this.config.beatWidth * this.zoomLevel;
    this.buildCanvases();
    this.draw();
  }

  updateZoomDisplay(): void {
    const el = this.container.querySelector('#roll-zoom-value');
    if (el) el.textContent = Math.round(this.zoomLevel * 100) + '%';
  }

  fitToView(): void {
    if (!this.gridContainer) return;
    const containerWidth = this.gridContainer.clientWidth - this.pianoWidth;
    const minWidth = this.totalBeats * this.config.beatWidth;
    if (containerWidth > 0 && minWidth > 0) {
      this.setZoom(containerWidth / minWidth);
    }
  }

  setCurrentNote(index: number): void {
    if (index < 0) {
      this.activeBeat = 0;
    } else {
      const item = this.melody[index];
      if (item) {
        this.activeBeat = item.startBeat;
      }
    }
    this.drawWithPlayhead();
  }

  setPlaybackState(state: PlaybackState): void {
    this.playbackState = state;
  }

  addBeats(count: number): void {
    this.totalBeats += count;
    this.buildCanvases();
    this.draw();
  }

  removeBeats(count: number): void {
    const newTotal = Math.max(4, this.totalBeats - count);
    // Check if any notes would be trimmed
    const wouldTrim = this.melody.some(n => n.startBeat + n.duration > newTotal);
    if (wouldTrim && !confirm('This will trim some notes. Continue?')) return;
    // Trim notes that extend beyond the new total
    this.melody = this.melody
      .filter(n => n.startBeat < newTotal)
      .map(n => n.startBeat + n.duration > newTotal ? { ...n, duration: newTotal - n.startBeat } : n);
    this.totalBeats = newTotal;
    this.buildCanvases();
    this.draw();
  }

  clearMelody(): void {
    this.melody = [];
    this.selectedNoteId = null;
    this.onNoteSelect?.(null);
    this.draw();
  }

  // ============================================================
  // Preset Management
  // ============================================================

  loadPresets(): void {
    try {
      const raw = localStorage.getItem('pitchperfect_presets');
      if (raw) {
        this.presetData = JSON.parse(raw);
      }
    } catch {
      this.presetData = {};
    }
    this.populatePresetSelect();
  }

  private populatePresetSelect(): void {
    const select = this.container.querySelector('#roll-preset-select') as HTMLSelectElement | null;
    if (!select) return;

    select.innerHTML = '<option value="">— Load Preset —</option>';
    const names = Object.keys(this.presetData).sort();
    for (const name of names) {
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      select.appendChild(opt);
    }
    if (this.currentPresetName) {
      select.value = this.currentPresetName;
    }
  }

  saveCurrentPreset(name: string): void {
    if (!name.trim()) return;

    this.presetData[name] = {
      notes: this.melody.map((n) => ({
        midi: n.note.midi,
        startBeat: n.startBeat,
        duration: n.duration,
        effectType: n.effectType,
        linkedTo: n.linkedTo,
      })),
      totalBeats: this.totalBeats,
      bpm: this.bpm,
      scale: this.scale.map((s) => ({ midi: s.midi, name: s.name, octave: s.octave, freq: s.freq })),
    };

    try {
      localStorage.setItem('pitchperfect_presets', JSON.stringify(this.presetData));
    } catch (e) {
      console.warn('Failed to save preset:', e);
    }

    this.currentPresetName = name;
    this.populatePresetSelect();
    localStorage.setItem('pitchperfect_lastpreset', name);
    localStorage.setItem('pitchperfect_selected_preset', name);

    const select = this.container.querySelector('#roll-preset-select') as HTMLSelectElement | null;
    if (select) select.value = name;

    const nameInput = this.container.querySelector('#roll-preset-name') as HTMLInputElement | null;
    if (nameInput) nameInput.value = name;

    window.dispatchEvent(new CustomEvent('pitchperfect:presetSaved', { detail: { name } }));
  }

  loadPresetByName(name: string): void {
    const preset = this.presetData[name];
    if (!preset) return;

    this.melody = preset.notes.map((n) => {
      const noteInfo = this.scale.find((s) => s.midi === n.midi) ?? {
        midi: n.midi,
        name: '?',
        octave: 4,
        freq: 440,
      };
      const item: MelodyItem = {
        id: this.nextNoteId++,
        note: { midi: n.midi, name: noteInfo.name as NoteName, octave: noteInfo.octave, freq: noteInfo.freq },
        startBeat: n.startBeat,
        duration: n.duration,
      };
      // Restore effect data if present
      if (n.effectType) {
        item.effectType = n.effectType as EffectType;
      }
      if (n.linkedTo) {
        item.linkedTo = n.linkedTo;
      }
      return item;
    });

    this.totalBeats = preset.totalBeats || 16;
    if (preset.bpm) {
      this.bpm = preset.bpm;
      // Notify app to update BPM
      window.dispatchEvent(new CustomEvent('pitchperfect:presetLoaded', { detail: { name, bpm: this.bpm } }));
    }

    this.currentPresetName = name;
    this.buildCanvases();
    this.draw();
    this.updateBeatInfo();
    localStorage.setItem('pitchperfect_lastpreset', name);
    localStorage.setItem('pitchperfect_selected_preset', name);

    const nameInput = this.container.querySelector('#roll-preset-name') as HTMLInputElement | null;
    if (nameInput) nameInput.value = name;

    window.dispatchEvent(new CustomEvent('pitchperfect:presetLoaded', { detail: { name, bpm: this.bpm } }));
  }

  private updateBeatInfo(): void {
    const info = this.container.querySelector('#roll-beat-info');
    if (info) info.textContent = `${this.totalBeats} beats`;
  }

  destroy(): void {
    if (this.playAnimationId !== null) {
      cancelAnimationFrame(this.playAnimationId);
    }
    this.container.innerHTML = '';
  }

  // ============================================================
  // DOM Construction
  // ============================================================

  private buildDOM(): void {
    this.container.innerHTML = `
      <div class="roll-toolbar">
        <div class="roll-tool-group">
          <button class="roll-tool-btn active" data-tool="place" title="Place notes">
            <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
          </button>
          <button class="roll-tool-btn" data-tool="erase" title="Erase notes">
            <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
          </button>
          <button class="roll-tool-btn" data-tool="select" title="Select notes">
            <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/></svg>
          </button>
        </div>
        <div class="roll-sep"></div>
        <div class="roll-durations">
          <label class="dur-label">Dur:</label>
          <button class="dur-btn" data-dur="0.25">1/16</button>
          <button class="dur-btn" data-dur="0.5">1/8</button>
          <button class="dur-btn active" data-dur="1">1/4</button>
          <button class="dur-btn" data-dur="2">1/2</button>
          <button class="dur-btn" data-dur="3">3/4</button>
          <button class="dur-btn" data-dur="4">1</button>
        </div>
        <div class="roll-sep"></div>
        <div class="roll-octave-group">
          <label class="octave-label">Oct:</label>
          <button id="roll-octave-down" class="octave-btn" title="Lower octave">-</button>
          <span id="roll-octave-value" class="octave-value">${this.octave}</span>
          <button id="roll-octave-up" class="octave-btn" title="Higher octave">+</button>
        </div>
        <div class="roll-sep"></div>
        <div class="roll-octaves-group">
          <label class="octaves-label">Rows:</label>
          <button id="roll-octaves-minus" class="octave-btn" title="Fewer octaves">-</button>
          <span id="roll-octaves-value" class="octave-value">${this.numOctaves}</span>
          <button id="roll-octaves-plus" class="octave-btn" title="More octaves">+</button>
        </div>
        <div class="roll-sep"></div>
        <div class="roll-mode-group">
          <label class="mode-label">Scale:</label>
          <select id="roll-mode-select" class="roll-mode-select">
            <option value="major">Major</option>
            <option value="natural-minor">Natural Minor</option>
            <option value="harmonic-minor">Harmonic Minor</option>
            <option value="melodic-minor">Melodic Minor</option>
            <option value="dorian">Dorian</option>
            <option value="mixolydian">Mixolydian</option>
            <option value="phrygian">Phrygian</option>
            <option value="lydian">Lydian</option>
            <option value="pentatonic-major">Pentatonic</option>
            <option value="pentatonic-minor">Minor Pentatonic</option>
            <option value="blues">Blues</option>
            <option value="chromatic">Chromatic</option>
          </select>
        </div>
        <div class="roll-sep"></div>
        <div class="roll-bars-group">
          <button id="roll-bars-down" class="roll-bars-btn" title="Remove 4 bars">-4b</button>
          <button id="roll-bars-up" class="roll-bars-btn" title="Add 4 bars">+4b</button>
        </div>
        <div class="roll-sep"></div>
        <div class="roll-zoom-group">
          <button id="roll-zoom-out" class="roll-zoom-btn" title="Zoom out (Ctrl+-)">-</button>
          <span id="roll-zoom-value" class="zoom-value">100%</span>
          <button id="roll-zoom-in" class="roll-zoom-btn" title="Zoom in (Ctrl++)">+</button>
          <button id="roll-zoom-fit" class="roll-zoom-btn" title="Fit to view">Fit</button>
        </div>
        <div class="roll-sep"></div>
        <div class="roll-undo-group">
          <button id="roll-undo-btn" class="roll-undo-btn" title="Undo (Ctrl+Z)" disabled>
            <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M12.5 8c-2.65 0-5.05.99-6.9 2.6L2 7v9h9l-3.62-3.62c1.39-1.16 3.16-1.88 5.12-1.88 3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8z"/></svg>
          </button>
          <button id="roll-redo-btn" class="roll-redo-btn" title="Redo (Ctrl+Y)" disabled>
            <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M18.4 10.6C16.55 8.99 14.15 8 11.5 8c-4.65 0-8.58 3.03-9.96 7.22L3.9 16c1.05-3.19 4.05-5.5 7.6-5.5 1.95 0 3.73.72 5.12 1.88L13 16h9V7l-3.6 3.6z"/></svg>
          </button>
        </div>
        <div class="roll-sep"></div>
        <div class="roll-preset-group">
          <select id="roll-preset-select" class="roll-preset-select">
            <option value="">— Load Preset —</option>
          </select>
          <button id="roll-new-preset" class="roll-new-btn" title="New empty preset">+</button>
          <input type="text" id="roll-preset-name" class="roll-preset-name" placeholder="Preset name">
          <button id="roll-save-preset" class="roll-save-btn" title="Save preset">Save</button>
          <button id="roll-share-preset" class="roll-share-btn" title="Share preset (copy URL)">Share</button>
          <button id="roll-export-midi" class="roll-export-btn" title="Export melody as MIDI file">Export MIDI</button>
          <button id="roll-clear-all" class="roll-ctrl-btn danger" title="Clear all notes">Clear</button>
        </div>
        <div class="roll-sep"></div>
        <div class="roll-effects-row">
          <span class="roll-effects-label">Effects:</span>
          <button id="roll-action-slide-up" class="roll-action-btn slide-up" title="Create ascending slide between selected notes">
            <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M4 20l8-16 8 16z"/></svg>
          </button>
          <button id="roll-action-slide-down" class="roll-action-btn slide-down" title="Create descending slide between selected notes">
            <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M4 4l8 16 8-16z"/></svg>
          </button>
          <button id="roll-action-ease-in" class="roll-action-btn ease-in" title="Create ease-in slide">
            <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M4 12h4l4-6 8 10z"/></svg>
          </button>
          <button id="roll-action-ease-out" class="roll-action-btn ease-out" title="Create ease-out slide">
            <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M4 12l4-6 4 6h12z"/></svg>
          </button>
          <button id="roll-action-vibrato" class="roll-action-btn vibrato" title="Create vibrato on selected note">
            <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M3 12c3-4 6 4 9 0s6 4 9 0"/></svg>
          </button>
        </div>
        <div class="roll-sep"></div>
        <div class="roll-instrument-group">
          <label class="instrument-label">Instr:</label>
          <select id="roll-instrument-select" class="roll-instrument-select">
            <option value="sine">Sine</option>
            <option value="piano">Piano</option>
            <option value="organ">Organ</option>
            <option value="strings">Strings</option>
            <option value="synth">Synth</option>
          </select>
        </div>
        <div class="roll-sep"></div>
        <div class="roll-play-group">
          <button id="roll-play-btn" class="roll-play-btn" title="Start playback">
            <svg id="roll-play-icon" viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M8 5v14l11-7z"/></svg>
            <svg id="roll-pause-icon" viewBox="0 0 24 24" width="16" height="16" style="display:none"><path fill="currentColor" d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
            <span>Start</span>
          </button>
          <button id="roll-reset-btn" class="roll-reset-btn" title="Reset playback" disabled>
            <svg viewBox="0 0 24 24" width="16" height="16"><rect x="6" y="6" width="12" height="12" fill="currentColor"/></svg>
            <span>Reset</span>
          </button>
        </div>
      </div>
      <div class="roll-main-area">
        <div class="roll-grid-wrapper">
          <div class="roll-ruler-container">
            <canvas class="roll-ruler"></canvas>
          </div>
          <canvas class="roll-piano"></canvas>
          <div class="roll-grid-container">
            <canvas class="roll-grid"></canvas>
          </div>
        </div>
      </div>
      <div class="roll-status">
        <span id="roll-note-info">Click on the grid to place notes</span>
        <span id="roll-beat-info">${this.totalBeats} beats</span>
      </div>
    `;

    this.pianoCanvas = this.container.querySelector('.roll-piano') as HTMLCanvasElement;
    this.gridCanvas = this.container.querySelector('.roll-grid') as HTMLCanvasElement;
    this.rulerCanvas = this.container.querySelector('.roll-ruler') as HTMLCanvasElement;
    this.gridContainer = this.container.querySelector('.roll-grid-container') as HTMLElement;

    this.pianoCtx = this.pianoCanvas.getContext('2d');
    this.gridCtx = this.gridCanvas.getContext('2d');
    this.rulerCtx = this.rulerCanvas.getContext('2d');

    this.buildCanvases();
  }

  private buildCanvases(): void {
    const dpr = window.devicePixelRatio || 1;
    const totalHeight = this.totalRows * this.rowHeight;

    const minWidth = this.totalBeats * this.beatWidth * this.zoomLevel;
    const containerWidth = this.gridContainer?.clientWidth ?? 0;
    this.stretchedWidth = containerWidth > 0 ? Math.max(minWidth, containerWidth - this.pianoWidth) : minWidth;

    // Piano canvas
    if (this.pianoCanvas) {
      this.pianoCanvas.width = this.pianoWidth * dpr;
      this.pianoCanvas.height = totalHeight * dpr;
      this.pianoCanvas.style.height = totalHeight + 'px';
      this.pianoCtx = this.pianoCanvas.getContext('2d');
      if (this.pianoCtx) this.pianoCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    // Ruler canvas spans full width (piano + grid)
    const rulerWidth = this.pianoWidth + this.stretchedWidth;
    if (this.rulerCanvas) {
      this.rulerCanvas.width = rulerWidth * dpr;
      this.rulerCanvas.height = this.rulerHeight * dpr;
      this.rulerCanvas.style.width = rulerWidth + 'px';
      this.rulerCanvas.style.height = this.rulerHeight + 'px';
      this.rulerCtx = this.rulerCanvas.getContext('2d');
      if (this.rulerCtx) this.rulerCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    // Grid canvas
    if (this.gridCanvas) {
      this.gridCanvas.width = this.stretchedWidth * dpr;
      this.gridCanvas.height = totalHeight * dpr;
      this.gridCanvas.style.width = this.stretchedWidth + 'px';
      this.gridCanvas.style.height = totalHeight + 'px';
      this.gridCtx = this.gridCanvas.getContext('2d');
      if (this.gridCtx) this.gridCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
  }

  // ============================================================
  // Event Listeners
  // ============================================================

  private attachEventListeners(): void {
    const container = this.container;

    // Tool buttons
    container.querySelectorAll('.roll-tool-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const tool = (btn as HTMLElement).dataset.tool as ActiveTool;
        this.activeTool = tool;
        container.querySelectorAll('.roll-tool-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });

    // Duration buttons
    container.querySelectorAll('.dur-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.selectedDuration = parseFloat((btn as HTMLElement).dataset.dur ?? '1');
        container.querySelectorAll('.dur-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });

    // Effect action buttons
    container.querySelector('#roll-action-slide-up')?.addEventListener('click', () => this._applyEffect('slide-up'));
    container.querySelector('#roll-action-slide-down')?.addEventListener('click', () => this._applyEffect('slide-down'));
    container.querySelector('#roll-action-ease-in')?.addEventListener('click', () => this._applyEffect('ease-in'));
    container.querySelector('#roll-action-ease-out')?.addEventListener('click', () => this._applyEffect('ease-out'));
    container.querySelector('#roll-action-vibrato')?.addEventListener('click', () => this._applyEffect('vibrato'));

    // Clear
    container.querySelector('#roll-clear-all')?.addEventListener('click', () => {
      this.clearMelody();
      this.onMelodyChange?.([]);
    });

    // Instrument selection
    container.querySelector('#roll-instrument-select')?.addEventListener('change', (e) => {
      const target = e.target as HTMLSelectElement;
      this.setInstrument(target.value as any);
    });

    // Playback controls
    container.querySelector('#roll-play-btn')?.addEventListener('click', () => {
      this.handlePlayClick();
      this.onPlayClick?.();
    });

    container.querySelector('#roll-reset-btn')?.addEventListener('click', () => {
      this.resetPlayback();
      this.onResetClick?.();
    });

    // Grid mouse events
    this.gridCanvas?.addEventListener('mousedown', (e) => this.onGridMouseDown(e));
    this.gridCanvas?.addEventListener('mousemove', (e) => this.onGridMouseMove(e));
    this.gridCanvas?.addEventListener('mouseup', (e) => this.onGridMouseUp(e));
    this.gridCanvas?.addEventListener('mouseleave', (e) => this.onGridMouseLeave(e));
    this.gridCanvas?.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      this.onRightClick(e);
    });

    // Ruler drag-to-seek (click and drag on ruler to scrub playback position)
    this.rulerCanvas?.addEventListener('mousedown', (e) => {
      this.isSeeking = true;
      this.seekStartX = e.clientX;
      this.seekToRulerPosition(e);
    });

    document.addEventListener('mousemove', (e) => {
      if (this.isSeeking) {
        this.seekToRulerPosition(e);
      }
    });

    document.addEventListener('mouseup', () => {
      this.isSeeking = false;
    });

    // Scroll sync ruler
    this.gridContainer?.addEventListener('scroll', () => {
      if (this.rulerCanvas && this.gridContainer) {
        this.rulerCanvas.style.transform = `translateX(${-this.gridContainer.scrollLeft}px)`;
      }
    });

    // Keyboard
    document.addEventListener('keydown', (e) => this.onKeyDown(e));

    // Window resize
    window.addEventListener('resize', () => {
      this.buildCanvases();
      this.draw();
    });

    // Preset management
    container.querySelector('#roll-preset-select')?.addEventListener('change', (e) => {
      const name = (e.target as HTMLSelectElement).value;
      if (name) {
        this.loadPresetByName(name);
        // Sync to melody store for practice tab
        window.dispatchEvent(new CustomEvent('pitchperfect:presetLoaded', { detail: { name, bpm: this.bpm, melody: this.getMelody() } }));
      }
    });

    container.querySelector('#roll-save-preset')?.addEventListener('click', () => {
      const nameInput = container.querySelector('#roll-preset-name') as HTMLInputElement | null;
      const name = nameInput?.value?.trim();
      if (name) {
        this.saveCurrentPreset(name);
      }
    });

    container.querySelector('#roll-new-preset')?.addEventListener('click', () => {
      const nameInput = container.querySelector('#roll-preset-name') as HTMLInputElement | null;
      if (nameInput) nameInput.value = '';
      this.currentPresetName = null;
      this.clearMelody();
    });

    // Octave controls
    container.querySelector('#roll-octave-up')?.addEventListener('click', () => {
      this._shiftOctave(1);
    });
    container.querySelector('#roll-octave-down')?.addEventListener('click', () => {
      this._shiftOctave(-1);
    });

    // Rows (numOctaves) controls
    container.querySelector('#roll-octaves-plus')?.addEventListener('click', () => {
      this.setNumOctaves(this.numOctaves + 1);
      const display = container.querySelector('#roll-octaves-value');
      if (display) display.textContent = String(this.numOctaves);
    });
    container.querySelector('#roll-octaves-minus')?.addEventListener('click', () => {
      this.setNumOctaves(this.numOctaves - 1);
      const display = container.querySelector('#roll-octaves-value');
      if (display) display.textContent = String(this.numOctaves);
    });

    // Scale mode select
    container.querySelector('#roll-mode-select')?.addEventListener('change', (e) => {
      const target = e.target as HTMLSelectElement;
      this.setMode(target.value);
    });

    // Share preset button
    container.querySelector('#roll-share-preset')?.addEventListener('click', () => {
      this._sharePreset();
    });

    // Export MIDI button
    container.querySelector('#roll-export-midi')?.addEventListener('click', () => {
      const melody = this.getMelody();
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      downloadMIDI(melody, this.bpm, `pitchperfect-${timestamp}.mid`);
    });

    // Bar controls
    container.querySelector('#roll-bars-up')?.addEventListener('click', () => {
      this.addBeats(4);
      this.updateBeatInfo();
    });

    container.querySelector('#roll-bars-down')?.addEventListener('click', () => {
      this.removeBeats(4);
      this.updateBeatInfo();
    });

    // Zoom controls
    container.querySelector('#roll-zoom-in')?.addEventListener('click', () => {
      this.zoomIn();
      this.updateZoomDisplay();
    });
    container.querySelector('#roll-zoom-out')?.addEventListener('click', () => {
      this.zoomOut();
      this.updateZoomDisplay();
    });
    container.querySelector('#roll-zoom-fit')?.addEventListener('click', () => {
      this.fitToView();
      this.updateZoomDisplay();
    });

    // Undo/redo buttons
    container.querySelector('#roll-undo-btn')?.addEventListener('click', () => {
      this.updateUndoRedoButtons();
      this.undo();
    });

    container.querySelector('#roll-redo-btn')?.addEventListener('click', () => {
      this.updateUndoRedoButtons();
      this.redo();
    });

    // Listen for preset changes from other tabs to refresh preset list
    window.addEventListener('pitchperfect:presetSaved', () => {
      this.loadPresets();
    });

    // Initialize zoom display
    this.updateZoomDisplay();
  }

  private onGridMouseDown(e: MouseEvent): void {
    if (!this.gridCanvas) return;
    const rect = this.gridCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const beat = x / this.beatWidth;
    const row = Math.floor(y / this.rowHeight);

    // Capture history for potential drag/resize operations
    if (this.activeTool === 'place' || this.activeTool === 'select') {
      const existingNote = this.findNoteAt(beat, row);
      if (existingNote) {
        this.pushHistory();
      }
    }

    if (this.activeTool === 'place') {
      const existingNote = this.findNoteAt(beat, row);
      if (existingNote) {
        // Select existing note
        this.selectedNoteId = existingNote.id ?? null;
        this.onNoteSelect?.(existingNote);
        // Start resize if near edges
        const noteX = existingNote.startBeat * this.beatWidth;
        const noteW = existingNote.duration * this.beatWidth;
        if (x - noteX < 6) {
          this.isResizing = true;
          this.resizeHandle = 'left';
        } else if (noteX + noteW - x < 6) {
          this.isResizing = true;
          this.resizeHandle = 'right';
        } else {
          this.isDragging = true;
          this.dragStartX = x;
          this.dragStartBeat = existingNote.startBeat;
        }
      } else {
        // Place new note
        this.selectedNoteId = null;
        this.onNoteSelect?.(null);
        this.placeNote(beat, row, this.selectedDuration);
      }
    } else if (this.activeTool === 'erase') {
      const note = this.findNoteAt(beat, row);
      if (note) {
        this.eraseNote(note);
      }
    } else if (this.activeTool === 'select') {
      const note = this.findNoteAt(beat, row);
      if (note) {
        this.selectedNoteId = note.id ?? null;
        this.onNoteSelect?.(note);
      } else {
        this.selectedNoteId = null;
        this.onNoteSelect?.(null);
      }
    }

    this.draw();
  }

  private onGridMouseMove(e: MouseEvent): void {
    if (!this.gridCanvas) return;
    const rect = this.gridCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (this.isDragging && this.selectedNoteId !== null) {
      const note = this.melody.find((n) => (n.id ?? 0) === this.selectedNoteId);
      if (note) {
        const deltaBeat = Math.round((x - this.dragStartX) / this.beatWidth);
        note.startBeat = Math.max(0, this.dragStartBeat + deltaBeat);
        this.emitMelodyChange();
        this.draw();
      }
    } else if (this.isResizing && this.selectedNoteId !== null) {
      const note = this.melody.find((n) => (n.id ?? 0) === this.selectedNoteId);
      if (note) {
        if (this.resizeHandle === 'right') {
          const endBeat = Math.round(x / this.beatWidth);
          note.duration = Math.max(this.config.minDuration, endBeat - note.startBeat);
        } else if (this.resizeHandle === 'left') {
          const newStart = Math.round(x / this.beatWidth);
          const oldEnd = note.startBeat + note.duration;
          note.startBeat = Math.max(0, Math.min(newStart, oldEnd - this.config.minDuration));
          note.duration = oldEnd - note.startBeat;
        }
        this.emitMelodyChange();
        this.draw();
      }
    } else if (this.isDragging) {
      // Placing a note
      this.draw();
    }
  }

  private onGridMouseUp(e: MouseEvent): void {
    this.isDragging = false;
    this.isResizing = false;
    this.resizeHandle = null;
  }

  private onGridMouseLeave(_e: MouseEvent): void {
    this.isDragging = false;
    this.isResizing = false;
  }

  private onRightClick(e: MouseEvent): void {
    if (!this.gridCanvas) return;
    const rect = this.gridCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const beat = x / this.beatWidth;
    const row = Math.floor(y / this.rowHeight);
    const note = this.findNoteAt(beat, row);
    if (note) {
      this.eraseNote(note);
    }
  }

  private onKeyDown(e: KeyboardEvent): void {
    // Zoom: Ctrl++ / Ctrl+- (or Ctrl+scroll)
    if ((e.ctrlKey || e.metaKey) && (e.key === '+' || e.key === '=')) {
      e.preventDefault();
      this.zoomIn();
      this.updateZoomDisplay();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && (e.key === '-' || e.key === '_')) {
      e.preventDefault();
      this.zoomOut();
      this.updateZoomDisplay();
      return;
    }

    // Undo: Ctrl+Z (or Cmd+Z on Mac)
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
      e.preventDefault();
      if (this.undo()) return;
    }
    // Redo: Ctrl+Shift+Z or Ctrl+Y
    if ((e.ctrlKey || e.metaKey) && ((e.key === 'z' && e.shiftKey) || e.key === 'y')) {
      e.preventDefault();
      if (this.redo()) return;
    }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (this.selectedNoteId !== null) {
        const note = this.melody.find((n) => (n.id ?? 0) === this.selectedNoteId);
        if (note) {
          this.eraseNote(note);
          this.selectedNoteId = null;
          this.onNoteSelect?.(null);
          this.draw();
        }
      }
    } else if (e.key === 'Escape') {
      this.selectedNoteId = null;
      this.onNoteSelect?.(null);
      this.draw();
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      // Navigate to next/prev note in melody
      const sortedNotes = [...this.melody].sort((a, b) => a.startBeat - b.startBeat);
      if (sortedNotes.length === 0) return;

      const currentIdx = this.selectedNoteId !== null
        ? sortedNotes.findIndex((n) => (n.id ?? 0) === this.selectedNoteId)
        : -1;

      let newIdx: number;
      if (e.key === 'ArrowUp') {
        newIdx = currentIdx <= 0 ? sortedNotes.length - 1 : currentIdx - 1;
      } else {
        newIdx = currentIdx >= sortedNotes.length - 1 ? 0 : currentIdx + 1;
      }
      const noteToSelect = sortedNotes[newIdx];
      this.selectedNoteId = noteToSelect.id ?? null;
      this.onNoteSelect?.(noteToSelect);
      this.draw();
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      // Move selected note by half beat
      if (this.selectedNoteId !== null) {
        const note = this.melody.find((n) => (n.id ?? 0) === this.selectedNoteId);
        if (note) {
          this.pushHistory();
          const delta = e.key === 'ArrowLeft' ? -0.5 : 0.5;
          note.startBeat = Math.max(0, note.startBeat + delta);
          this.emitMelodyChange();
          this.draw();
        }
      }
    }
  }

  // ============================================================
  // Note Operations
  // ============================================================

  private placeNote(beat: number, row: number, duration: number): void {
    const scaleNote = this.scale[row];
    if (!scaleNote || scaleNote.name.includes('=')) return;

    this.pushHistory();

    const snappedBeat = Math.floor(beat) + (beat % 1 >= 0.5 ? 0.5 : 0);
    const id = this.nextNoteId++;

    const item: MelodyItem = {
      id,
      note: {
        midi: scaleNote.midi,
        name: scaleNote.name as MelodyItem['note']['name'],
        octave: scaleNote.octave,
        freq: scaleNote.freq,
      },
      duration,
      startBeat: snappedBeat,
    };

    // Apply effect if one is selected
    if (this.selectedEffect) {
      item.effectType = this.selectedEffect;
      if (this.selectedEffect === 'slide-up' || this.selectedEffect === 'slide-down') {
        item.linkedTo = [];
      }
    }

    this.melody.push(item);
    this.selectedNoteId = id;
    this.onNoteSelect?.(item);
    this.emitMelodyChange();
    this.draw();
  }

  private eraseNote(note: MelodyItem): void {
    this.pushHistory();
    const noteId = note.id;
    if (noteId === undefined) return;
    // Remove from any linkedTo references in other notes (matches old app behavior)
    for (const n of this.melody) {
      if (n.linkedTo) {
        const idx = n.linkedTo.indexOf(noteId);
        if (idx !== -1) n.linkedTo.splice(idx, 1);
      }
    }
    const idx = this.melody.indexOf(note);
    if (idx !== -1) {
      this.melody.splice(idx, 1);
      if (this.selectedNoteId === note.id) {
        this.selectedNoteId = null;
        this.onNoteSelect?.(null);
      }
      this.emitMelodyChange();
      this.draw();
    }
  }

  private findNoteAt(beat: number, row: number): MelodyItem | null {
    for (const note of this.melody) {
      const noteRow = this.midiToRow(note.note.midi);
      if (noteRow === row && beat >= note.startBeat && beat < note.startBeat + note.duration) {
        return note;
      }
    }
    return null;
  }

  private midiToRow(midi: number): number {
    for (let i = 0; i < this.scale.length; i++) {
      if (this.scale[i].midi === midi) return i;
    }
    return -1;
  }

  private emitMelodyChange(): void {
    this.onMelodyChange?.([...this.melody]);
  }

  // ============================================================
  // Playback
  // ============================================================

  private handlePlayClick(): void {
    if (this.melody.length === 0) return;

    const playBtn = this.container.querySelector('#roll-play-btn') as HTMLButtonElement;
    const playIcon = this.container.querySelector('#roll-play-icon') as SVGElement;
    const pauseIcon = this.container.querySelector('#roll-pause-icon') as SVGElement;
    const resetBtn = this.container.querySelector('#roll-reset-btn') as HTMLButtonElement;

    if (this.playbackState === 'stopped') {
      this.playbackState = 'playing';
      this.playStartTime = performance.now();
      this.pauseStartTime = 0;
      this.startAnimation();

      playIcon.style.display = 'none';
      pauseIcon.style.display = 'block';
      playBtn.querySelector('span')!.textContent = 'Pause';
      resetBtn.disabled = false;
    } else if (this.playbackState === 'playing') {
      this.pauseStartTime = performance.now();
      this.playbackState = 'paused';
      if (this.playAnimationId !== null) {
        cancelAnimationFrame(this.playAnimationId);
        this.playAnimationId = null;
      }

      playIcon.style.display = 'block';
      pauseIcon.style.display = 'none';
      playBtn.querySelector('span')!.textContent = 'Continue';
    } else if (this.playbackState === 'paused') {
      const pauseDuration = performance.now() - this.pauseStartTime;
      this.playStartTime += pauseDuration;
      this.playbackState = 'playing';
      this.startAnimation();

      playIcon.style.display = 'none';
      pauseIcon.style.display = 'block';
      playBtn.querySelector('span')!.textContent = 'Pause';
    }
  }

  private resetPlayback(): void {
    this.playbackState = 'stopped';
    if (this.playAnimationId !== null) {
      cancelAnimationFrame(this.playAnimationId);
      this.playAnimationId = null;
    }

    const playBtn = this.container.querySelector('#roll-play-btn') as HTMLButtonElement;
    const playIcon = this.container.querySelector('#roll-play-icon') as SVGElement;
    const pauseIcon = this.container.querySelector('#roll-pause-icon') as SVGElement;
    const resetBtn = this.container.querySelector('#roll-reset-btn') as HTMLButtonElement;

    playIcon.style.display = 'block';
    pauseIcon.style.display = 'none';
    playBtn.querySelector('span')!.textContent = 'Start';
    resetBtn.disabled = true;

    this.activeBeat = 0;
    this.gridContainer!.scrollLeft = 0;
    this.draw();
  }

  private startAnimation(): void {
    const self = this;
    const animate = () => {
      if (self.playbackState !== 'playing') return;

      const elapsed = performance.now() - self.playStartTime;
      self.activeBeat = (elapsed / 60000) * self.bpm;

      // Scroll grid to keep playhead visible
      const playheadX = self.activeBeat * self.beatWidth;
      const containerWidth = self.gridContainer?.clientWidth ?? 0;
      const targetScroll = playheadX - containerWidth * 0.3;
      if (targetScroll > 0) {
        self.gridContainer!.scrollLeft = targetScroll;
      }

      self.drawWithPlayhead();

      // Play tones for notes that start at current beat
      const win = window as Window & { pianoRollAudioEngine?: { playNote: (freq: number, durationMs: number, effectType?: string) => void } };
      if (win.pianoRollAudioEngine) {
        const sortedNotes = [...self.melody].sort((a, b) => a.startBeat - b.startBeat);
        const durationMs = self.beatWidth * (60000 / self.bpm);
        for (const note of sortedNotes) {
          if (Math.abs(note.startBeat - self.activeBeat) < 0.05) {
            const freq = note.note.freq;
            win.pianoRollAudioEngine.playNote(freq, note.duration * durationMs, note.effectType);
          }
        }
      }

      // Check if playback is done
      const sortedNotes = [...self.melody].sort((a, b) => a.startBeat - b.startBeat);
      const lastNote = sortedNotes[sortedNotes.length - 1];
      if (self.activeBeat >= lastNote.startBeat + lastNote.duration) {
        self.resetPlayback();
        return;
      }

      self.playAnimationId = requestAnimationFrame(animate);
    };

    this.playAnimationId = requestAnimationFrame(animate);
  }

  private seekToRulerPosition(e: MouseEvent): void {
    const rect = this.rulerCanvas?.getBoundingClientRect();
    if (!rect || !this.gridContainer) return;

    const x = e.clientX - rect.left;
    const beat = Math.max(0, Math.min(this.totalBeats, x / this.beatWidth));
    const targetScroll = beat * this.beatWidth - rect.width / 2;
    this.gridContainer.scrollLeft = Math.max(0, targetScroll);

    // Update playhead position visually
    this.activeBeat = beat;
    this.drawGridWithPlayhead();

    // If playback is active, also update the playback start time so
    // playback continues from the new position on mouseup
    if (this.playbackState === 'playing') {
      this.playStartTime = performance.now() - (beat / this.bpm) * 60000;
    }
  }

  // ============================================================
  // Drawing
  // ============================================================

  draw(): void {
    this.drawPiano();
    this.drawRuler();
    this.drawGrid();
  }

  private drawWithPlayhead(): void {
    this.drawPiano();
    this.drawRulerWithPlayhead();
    this.drawGridWithPlayhead();
  }

  private drawPiano(): void {
    if (!this.pianoCtx) return;
    const ctx = this.pianoCtx;
    const totalHeight = this.totalRows * this.rowHeight;

    ctx.clearRect(0, 0, this.pianoWidth, totalHeight);
    ctx.fillStyle = '#161b22';
    ctx.fillRect(0, 0, this.pianoWidth, totalHeight);

    // Draw keys (highest note at top)
    for (let i = 0; i < this.totalRows; i++) {
      const y = i * this.rowHeight;
      const scaleNote = this.scale[i];
      if (!scaleNote) continue;

      const isBlack = scaleNote.name.includes('#');

      // White key background for black keys
      if (isBlack) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
        ctx.fillRect(0, y, this.pianoWidth, this.rowHeight);
      }

      // Key label
      ctx.fillStyle = isBlack ? '#484f58' : '#8b949e';
      ctx.font = '9px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(scaleNote.name, this.pianoWidth / 2, y + this.rowHeight / 2);

      // Bottom border
      ctx.strokeStyle = '#21262d';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(0, y + this.rowHeight);
      ctx.lineTo(this.pianoWidth, y + this.rowHeight);
      ctx.stroke();
    }

    // Right border
    ctx.strokeStyle = '#30363d';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(this.pianoWidth - 1, 0);
    ctx.lineTo(this.pianoWidth - 1, totalHeight);
    ctx.stroke();
  }

  private drawRuler(): void {
    if (!this.rulerCtx) return;
    const ctx = this.rulerCtx;
    const rulerWidth = this.pianoWidth + this.stretchedWidth;

    ctx.clearRect(0, 0, rulerWidth, this.rulerHeight);
    ctx.fillStyle = '#161b22';
    ctx.fillRect(0, 0, rulerWidth, this.rulerHeight);

    // Beat markers (offset by piano width)
    for (let b = 0; b <= this.totalBeats; b++) {
      const x = this.pianoWidth + b * this.beatWidth;
      const isBar = b % this.config.beatsPerBar === 0;

      ctx.strokeStyle = isBar ? '#484f58' : '#30363d';
      ctx.lineWidth = isBar ? 1 : 0.5;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, this.rulerHeight);
      ctx.stroke();

      if (isBar) {
        const barNum = Math.floor(b / this.config.beatsPerBar) + 1;
        ctx.fillStyle = '#8b949e';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(barNum + '', x + this.beatWidth * this.config.beatsPerBar / 2, this.rulerHeight / 2);
        ctx.textBaseline = 'alphabetic';
      }
    }

    // Bottom border
    ctx.strokeStyle = '#30363d';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, this.rulerHeight - 1);
    ctx.lineTo(rulerWidth, this.rulerHeight - 1);
    ctx.stroke();
  }

  private drawRulerWithPlayhead(): void {
    if (!this.rulerCtx) return;
    const ctx = this.rulerCtx;
    const rulerWidth = this.pianoWidth + this.stretchedWidth;

    ctx.clearRect(0, 0, rulerWidth, this.rulerHeight);
    ctx.fillStyle = '#161b22';
    ctx.fillRect(0, 0, rulerWidth, this.rulerHeight);

    for (let b = 0; b <= this.totalBeats; b++) {
      const x = this.pianoWidth + b * this.beatWidth;
      const isBar = b % this.config.beatsPerBar === 0;

      ctx.strokeStyle = isBar ? '#484f58' : '#30363d';
      ctx.lineWidth = isBar ? 1 : 0.5;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, this.rulerHeight);
      ctx.stroke();

      if (isBar) {
        const barNum = Math.floor(b / this.config.beatsPerBar) + 1;
        ctx.fillStyle = '#8b949e';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(barNum + '', x + this.beatWidth * this.config.beatsPerBar / 2, this.rulerHeight / 2);
        ctx.textBaseline = 'alphabetic';
      }
    }

    ctx.strokeStyle = '#30363d';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, this.rulerHeight - 1);
    ctx.lineTo(rulerWidth, this.rulerHeight - 1);
    ctx.stroke();

    // Playhead triangle
    const playheadX = this.pianoWidth + this.activeBeat * this.beatWidth;
    ctx.save();
    ctx.fillStyle = '#58a6ff';
    ctx.shadowColor = 'rgba(88, 166, 255, 0.5)';
    ctx.shadowBlur = 4;
    const triSize = 6;
    ctx.beginPath();
    ctx.moveTo(playheadX, this.rulerHeight);
    ctx.lineTo(playheadX - triSize, this.rulerHeight - triSize - 1);
    ctx.lineTo(playheadX + triSize, this.rulerHeight - triSize - 1);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  private drawGrid(): void {
    if (!this.gridCtx) return;
    const ctx = this.gridCtx;
    const totalHeight = this.totalRows * this.rowHeight;

    ctx.clearRect(0, 0, this.stretchedWidth, totalHeight);
    ctx.fillStyle = '#0d1117';
    ctx.fillRect(0, 0, this.stretchedWidth, totalHeight);

    // Horizontal lines
    for (let i = 0; i <= this.totalRows; i++) {
      const y = i * this.rowHeight;
      const note = i < this.totalRows ? this.scale[i] : null;
      const isBlack = note && note.name.includes('#');

      if (isBlack) {
        ctx.fillStyle = 'rgba(26, 31, 39, 0.5)';
        ctx.fillRect(0, y, this.stretchedWidth, this.rowHeight);
      }

      ctx.strokeStyle = '#21262d';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(this.stretchedWidth, y);
      ctx.stroke();
    }

    // Vertical lines
    for (let b = 0; b <= this.totalBeats; b++) {
      const x = b * this.beatWidth;
      const isBar = b % this.config.beatsPerBar === 0;
      ctx.strokeStyle = isBar ? '#30363d' : '#21262d';
      ctx.lineWidth = isBar ? 1 : 0.5;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, totalHeight);
      ctx.stroke();
    }

    // Note blocks
    this.drawNoteBlocks(ctx, false);
  }

  private drawGridWithPlayhead(): void {
    if (!this.gridCtx) return;
    const ctx = this.gridCtx;
    const totalHeight = this.totalRows * this.rowHeight;

    ctx.clearRect(0, 0, this.stretchedWidth, totalHeight);
    ctx.fillStyle = '#0d1117';
    ctx.fillRect(0, 0, this.stretchedWidth, totalHeight);

    // Horizontal lines
    for (let i = 0; i <= this.totalRows; i++) {
      const y = i * this.rowHeight;
      const note = i < this.totalRows ? this.scale[i] : null;
      const isBlack = note && note.name.includes('#');

      if (isBlack) {
        ctx.fillStyle = 'rgba(26, 31, 39, 0.5)';
        ctx.fillRect(0, y, this.stretchedWidth, this.rowHeight);
      }

      ctx.strokeStyle = '#21262d';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(this.stretchedWidth, y);
      ctx.stroke();
    }

    // Vertical lines
    for (let b = 0; b <= this.totalBeats; b++) {
      const x = b * this.beatWidth;
      const isBar = b % this.config.beatsPerBar === 0;
      ctx.strokeStyle = isBar ? '#30363d' : '#21262d';
      ctx.lineWidth = isBar ? 1 : 0.5;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, totalHeight);
      ctx.stroke();
    }

    // Note blocks with active highlight
    this.drawNoteBlocks(ctx, true);

    // Playhead line
    const playheadX = this.activeBeat * this.beatWidth;
    ctx.save();
    ctx.strokeStyle = '#58a6ff';
    ctx.lineWidth = 2;
    ctx.shadowColor = 'rgba(88, 166, 255, 0.5)';
    ctx.shadowBlur = 4;
    ctx.beginPath();
    ctx.moveTo(playheadX, 0);
    ctx.lineTo(playheadX, totalHeight);
    ctx.stroke();
    ctx.restore();
  }

  private drawNoteBlocks(ctx: CanvasRenderingContext2D, highlightActive: boolean): void {
    for (const note of this.melody) {
      const rowIdx = this.midiToRow(note.note.midi);
      if (rowIdx < 0) continue;

      let x = note.startBeat * this.beatWidth;
      let y = rowIdx * this.rowHeight;
      let w = note.duration * this.beatWidth;
      const h = this.rowHeight - 2;
      let ry = y + 1;

      if (w < 2) continue;

      const isSelected = note.id === this.selectedNoteId;
      const isActive = highlightActive && this.activeBeat >= note.startBeat && this.activeBeat < note.startBeat + note.duration;
      const cornerRadius = 4;

      // Diagonal rendering for slide notes
      let diagY = 0;
      if (!isActive && note.effectType && (note.effectType === 'slide-up' || note.effectType === 'slide-down') && note.linkedTo && note.linkedTo.length > 0) {
        const targetId = note.linkedTo[0];
        const target = this.melody.find((n) => n.id === targetId);
        if (target) {
          const targetRow = this.midiToRow(target.note.midi);
          diagY = (targetRow - rowIdx) * this.rowHeight;
          diagY = Math.max(-h * 0.45, Math.min(h * 0.45, diagY));
        }
      }

      // Shadow for active vs normal notes
      if (isActive) {
        ctx.shadowColor = 'rgba(63,185,80,0.6)';
        ctx.shadowBlur = 8;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
      } else {
        ctx.shadowColor = 'rgba(0,0,0,0.3)';
        ctx.shadowBlur = 3;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 1;
      }

      // Draw note block with diagonal skew for slides
      ctx.beginPath();
      if (diagY !== 0) {
        // Draw parallelogram shape for slides
        ctx.moveTo(x + cornerRadius, ry + diagY / 2);
        ctx.lineTo(x + w - cornerRadius, ry + diagY / 2);
        ctx.quadraticCurveTo(x + w, ry + diagY / 2, x + w, ry + diagY / 2 + cornerRadius);
        ctx.lineTo(x + w, ry + h + diagY / 2 - cornerRadius);
        ctx.quadraticCurveTo(x + w, ry + h + diagY / 2, x + w - cornerRadius, ry + h + diagY / 2);
        ctx.lineTo(x + cornerRadius, ry + h + diagY / 2);
        ctx.quadraticCurveTo(x, ry + h + diagY / 2, x, ry + h + diagY / 2 - cornerRadius);
        ctx.lineTo(x, ry + diagY / 2 + cornerRadius);
        ctx.quadraticCurveTo(x, ry + diagY / 2, x + cornerRadius, ry + diagY / 2);
        ctx.closePath();
      } else if (w < 2 * cornerRadius) {
        ctx.roundRect(x, ry, 2 * cornerRadius, h, [cornerRadius, cornerRadius, cornerRadius, cornerRadius]);
      } else {
        ctx.roundRect(x, ry, w, h, cornerRadius);
      }

      // Fill and stroke
      let fillColor = this.config.noteColors.normal;
      let strokeColor = 'rgba(88,166,255,0.5)';
      let strokeWidth = 1;

      if (isActive) {
        fillColor = this.config.noteColors.active;
        strokeColor = 'rgba(63,185,80,0.9)';
        strokeWidth = 1.5;
      } else if (isSelected) {
        fillColor = this.config.noteColors.selected;
        strokeColor = '#8fc9ff';
        strokeWidth = 1.5;
      }

      ctx.fillStyle = fillColor;
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = strokeWidth;
      ctx.fill();
      ctx.stroke();

      // Reset shadow
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;

      // Wavy top edge for vibrato notes
      if (!isActive && note.effectType === 'vibrato' && w > 14) {
        const waveAmp = 2.5;
        const wavePeriod = w / 3;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let wx = 0; wx <= w; wx++) {
          const wy = ry + 2 + Math.sin((wx / wavePeriod) * Math.PI * 2) * waveAmp;
          if (wx === 0) {
            ctx.moveTo(x + wx, wy);
          } else {
            ctx.lineTo(x + wx, wy);
          }
        }
        ctx.stroke();
      }

      // Effect badge on top-right of notes with effects
      if (note.effectType && w > 18) {
        const badgeColor = note.effectType === 'vibrato' ? '#ff6b6b' :
          note.effectType === 'slide-up' || note.effectType === 'slide-down' ? '#4ecdc4' :
            '#ffe66d';
        ctx.fillStyle = badgeColor;
        ctx.beginPath();
        ctx.arc(x + w - 5, ry + 5, 3, 0, Math.PI * 2);
        ctx.fill();
      }

      // Note name text (only when wide enough and not active)
      if (w > 18 && !isActive) {
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.font = 'bold 9px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(note.note.name, x + w / 2, ry + h / 2);
        ctx.textBaseline = 'alphabetic';
      }

      // Resize handles on selected notes
      if (isSelected && w > 12) {
        const handleW = 6;
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.fillRect(x + 1, ry + h / 2 - 4, handleW, 8);
        ctx.fillRect(x + w - handleW - 1, ry + h / 2 - 4, handleW, 8);
      }
    }
  }

  // ============================================================
  // Octave / Scale methods (matching old app interface)
  // ============================================================

  /**
   * Shift all notes by an octave and rebuild the scale.
   */
  private _shiftOctave(delta: number): void {
    const newOctave = this.octave + delta;
    if (newOctave < 1 || newOctave > 6) return;
    this.octave = newOctave;

    const display = this.container.querySelector('#roll-octave-value');
    if (display) display.textContent = String(this.octave);

    // Transpose all notes by the octave delta
    const MIDI_OCTAVE_SHIFT = 12;
    for (const note of this.melody) {
      note.note.midi += delta * MIDI_OCTAVE_SHIFT;
      note.note.freq = 440 * Math.pow(2, (note.note.midi - 69) / 12);
    }

    // Rebuild scale with new octave
    window.dispatchEvent(new CustomEvent('pitchperfect:octaveChange', {
      detail: { octave: this.octave, numOctaves: this.numOctaves }
    }));

    this.draw();
    this.onMelodyChange?.(this.melody);
  }

  /**
   * Set the number of octave rows displayed (1-3).
   */
  setNumOctaves(n: number): void {
    n = Math.max(1, Math.min(3, Math.round(n)));
    if (n === this.numOctaves) return;
    this.numOctaves = n;

    window.dispatchEvent(new CustomEvent('pitchperfect:octaveChange', {
      detail: { octave: this.octave, numOctaves: this.numOctaves }
    }));
  }

  /**
   * Set the scale mode (major, minor, etc.) and rebuild scale.
   */
  setMode(mode: string): void {
    if (mode === this.mode) return;
    this.mode = mode;

    window.dispatchEvent(new CustomEvent('pitchperfect:modeChange', {
      detail: { mode }
    }));
  }

  // ============================================================
  // Effect application
  // ============================================================

  private _getSelectedNotes(): MelodyItem[] {
    if (this.selectedNoteId === null) return [];
    return this.melody.filter((n) => n.id === this.selectedNoteId);
  }

  private _applyEffect(type: EffectType): void {
    if (this.selectedNoteId === null) return;
    const note = this.melody.find((n) => n.id === this.selectedNoteId);
    if (!note) return;

    this.pushHistory();

    if (type === 'vibrato') {
      // Apply vibrato to selected notes (if multiple selected)
      const selected = this._getSelectedNotes();
      if (selected.length > 1) {
        selected.forEach((n: MelodyItem) => {
          n.effectType = 'vibrato';
          n.linkedTo = [];
        });
      } else {
        // Single note vibrato
        note.effectType = 'vibrato';
        note.linkedTo = [];
      }
    } else {
      // Slides and ease need 2 selected notes
      const selected = this._getSelectedNotes();
      if (selected.length !== 2) {
        window.alert('Slides require exactly 2 notes selected (order by time). Vibrato works on 1 or more notes.');
        return;
      }

      // Sort by start beat to determine direction
      const sorted = [...selected].sort((a, b) => a.startBeat - b.startBeat);
      const first = sorted[0];
      const second = sorted[1];

      // Validation based on effect type
      if (type === 'slide-up' && second.note.midi <= first.note.midi) {
        window.alert('Ascending slide requires the second note to be higher than the first.');
        return;
      }
      if (type === 'slide-down' && second.note.midi >= first.note.midi) {
        window.alert('Descending slide requires the second note to be lower than the first.');
        return;
      }
      if ((type === 'ease-in' || type === 'ease-out') && second.note.midi === first.note.midi) {
        window.alert('Ease In/Out requires two notes at different pitches.');
        return;
      }

      // Apply effect and extend first note's duration to meet second note
      first.effectType = type;
      first.linkedTo = [second.id!];
      first.duration = Math.max(first.duration, second.startBeat - first.startBeat + 0.5);
    }

    this.draw();
    this.onMelodyChange?.(this.melody);
  }

  // ============================================================
  // Share preset
  // ============================================================

  private _sharePreset(): void {
    const url = this._buildShareURL();
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(() => {
        // Brief visual feedback
        const btn = this.container.querySelector('#roll-share-preset');
        if (btn) {
          const orig = btn.textContent;
          btn.textContent = 'Copied!';
          setTimeout(() => { btn.textContent = orig; }, 1500);
        }
      }).catch(() => {
        window.prompt('Copy this URL:', url);
      });
    } else {
      window.prompt('Copy this URL:', url);
    }
  }

  private _buildShareURL(): string {
    const presetData = {
      n: this.melody.map((note) => ({
        m: note.note.midi,
        s: note.startBeat,
        d: note.duration,
        e: note.effectType || null,
        l: note.linkedTo || [],
      })),
      b: this.totalBeats,
      p: this.bpm,
    };
    const json = JSON.stringify(presetData);
    const encoded = btoa(unescape(encodeURIComponent(json)));
    return window.location.origin + window.location.pathname + '?preset=' + encoded;
  }
}
