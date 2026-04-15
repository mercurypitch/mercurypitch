// ============================================================
// Piano Roll Editor — Canvas-based note editor
// ============================================================

import type { MelodyItem, ScaleDegree, PianoRollConfig } from '@/types';

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

  // Effect state
  private selectedEffect: EffectType | null = null;

  // Undo/redo history
  private historyStack: MelodyItem[][] = [];
  private redoStack: MelodyItem[][] = [];
  private readonly maxHistorySize = 50;

  // Callbacks
  private onMelodyChange?: (melody: MelodyItem[]) => void;
  private onNoteSelect?: (note: MelodyItem | null) => void;

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
    this.rowHeight = this.config.rowHeight;
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

  setTotalBeats(beats: number): void {
    this.totalBeats = beats;
    this.buildCanvases();
    this.draw();
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
    this.totalBeats = Math.max(4, this.totalBeats - count);
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
        note: { midi: n.midi, name: noteInfo.name, octave: noteInfo.octave, freq: noteInfo.freq },
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
            <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M3 5h2V3c-1.1 0-2 .9-2 2zm0 8h2v-2H3v2zm4 8h2v-2H7v2zM3 9h2V7H3v2zm10-6h-2v2h2V3zm6 0v2h2c0-1.1-.9-2-2-2z"/></svg>
          </button>
        </div>
        <div class="roll-sep"></div>
        <div class="roll-effects-group">
          <span class="roll-effects-label">Effects:</span>
          <button class="roll-effect-btn slide-up" data-effect="slide-up" title="Slide up to next note">↑Slide</button>
          <button class="roll-effect-btn slide-down" data-effect="slide-down" title="Slide down to next note">↓Slide</button>
          <button class="roll-effect-btn ease-in" data-effect="ease-in" title="Ease in">EaseIn</button>
          <button class="roll-effect-btn ease-out" data-effect="ease-out" title="Ease out">EaseOut</button>
          <button class="roll-effect-btn vibrato" data-effect="vibrato" title="Vibrato effect">Vibrato</button>
        </div>
        <div class="roll-sep"></div>
        <div class="roll-octave-group">
          <button id="roll-octave-down" class="roll-octave-btn" title="Lower octave">-Oct</button>
          <span id="roll-octave-value" class="roll-octave-value">4</span>
          <button id="roll-octave-up" class="roll-octave-btn" title="Higher octave">+Oct</button>
        </div>
        <div class="roll-sep"></div>
        <div class="roll-undo-group">
          <button id="roll-undo-btn" class="roll-ctrl-btn" title="Undo (Ctrl+Z)" disabled>Undo</button>
          <button id="roll-redo-btn" class="roll-ctrl-btn" title="Redo (Ctrl+Shift+Z)" disabled>Redo</button>
        </div>
        <div class="roll-sep"></div>
        <div class="roll-bars-group">
          <button id="roll-bars-down" class="roll-bars-btn" title="Remove 4 bars">-4b</button>
          <button id="roll-bars-up" class="roll-bars-btn" title="Add 4 bars">+4b</button>
        </div>
        <div class="roll-sep"></div>
        <div class="roll-preset-group">
          <select id="roll-preset-select" class="roll-preset-select">
            <option value="">— Load Preset —</option>
          </select>
          <button id="roll-new-preset" class="roll-new-btn" title="New empty preset">+</button>
          <input type="text" id="roll-preset-name" class="roll-preset-name" placeholder="Preset name">
          <button id="roll-save-preset" class="roll-save-btn" title="Save preset">Save</button>
          <button id="roll-clear-all" class="roll-ctrl-btn danger" title="Clear all notes">Clear</button>
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

    const minWidth = this.totalBeats * this.beatWidth;
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

    // Effect buttons
    container.querySelectorAll('.roll-effect-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const effect = (btn as HTMLElement).dataset.effect as EffectType;
        // Toggle effect selection
        if (this.selectedEffect === effect) {
          this.selectedEffect = null;
          btn.classList.remove('active');
        } else {
          this.selectedEffect = effect;
          container.querySelectorAll('.roll-effect-btn').forEach((b) => b.classList.remove('active'));
          btn.classList.add('active');
        }
      });
    });

    // Clear
    container.querySelector('#roll-clear-all')?.addEventListener('click', () => {
      this.clearMelody();
      this.onMelodyChange?.([]);
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
    let octaveOffset = 0;
    container.querySelector('#roll-octave-up')?.addEventListener('click', () => {
      octaveOffset++;
      const display = container.querySelector('#roll-octave-value');
      if (display) display.textContent = String(octaveOffset >= 0 ? `+${octaveOffset}` : octaveOffset);
      // Emit event for app to update scale
      window.dispatchEvent(new CustomEvent('pitchperfect:octaveChange', { detail: { offset: octaveOffset } }));
    });

    container.querySelector('#roll-octave-down')?.addEventListener('click', () => {
      octaveOffset--;
      const display = container.querySelector('#roll-octave-value');
      if (display) display.textContent = String(octaveOffset >= 0 ? `+${octaveOffset}` : octaveOffset);
      // Emit event for app to update scale
      window.dispatchEvent(new CustomEvent('pitchperfect:octaveChange', { detail: { offset: octaveOffset } }));
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
}
