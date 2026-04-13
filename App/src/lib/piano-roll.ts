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

  // Callbacks
  private onMelodyChange?: (melody: MelodyItem[]) => void;
  private onNoteSelect?: (note: MelodyItem | null) => void;

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
    this.melody = melody.map((item) => ({
      ...item,
      id: item.id ?? this.nextNoteId++,
    }));
    this.draw();
  }

  getMelody(): MelodyItem[] {
    return [...this.melody];
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

    // Clear
    container.querySelector('#roll-clear-all')?.addEventListener('click', () => {
      this.clearMelody();
      this.onMelodyChange?.([]);
    });

    // Playback controls
    container.querySelector('#roll-play-btn')?.addEventListener('click', () => {
      this.handlePlayClick();
    });

    container.querySelector('#roll-reset-btn')?.addEventListener('click', () => {
      this.resetPlayback();
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
  }

  private onGridMouseDown(e: MouseEvent): void {
    if (!this.gridCanvas) return;
    const rect = this.gridCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const beat = x / this.beatWidth;
    const row = Math.floor(y / this.rowHeight);

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
    const scaleIdx = this.totalRows - 1 - row;
    const scaleNote = this.scale[scaleIdx];
    if (!scaleNote || scaleNote.name.includes('=')) return;

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

    this.melody.push(item);
    this.selectedNoteId = id;
    this.onNoteSelect?.(item);
    this.emitMelodyChange();
    this.draw();
  }

  private eraseNote(note: MelodyItem): void {
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
    const scaleIdx = this.totalRows - 1 - row;
    for (const note of this.melody) {
      const noteRow = this.midiToRow(note.note.midi);
      if (noteRow === scaleIdx && beat >= note.startBeat && beat < note.startBeat + note.duration) {
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
      const scaleIdx = i < this.totalRows ? this.totalRows - 1 - i : -1;
      const note = scaleIdx >= 0 ? this.scale[scaleIdx] : null;
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
      const scaleIdx = i < this.totalRows ? this.totalRows - 1 - i : -1;
      const note = scaleIdx >= 0 ? this.scale[scaleIdx] : null;
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

      const x = note.startBeat * this.beatWidth;
      const y = rowIdx * this.rowHeight;
      const w = note.duration * this.beatWidth;
      const h = this.rowHeight - 2;
      const ry = y + 1;

      const isSelected = note.id === this.selectedNoteId;
      const isActive = highlightActive && this.activeBeat >= note.startBeat && this.activeBeat < note.startBeat + note.duration;

      let fillStyle = this.config.noteColors.normal;
      if (isActive) fillStyle = this.config.noteColors.active;
      if (isSelected) fillStyle = this.config.noteColors.selected;

      ctx.fillStyle = fillStyle;
      ctx.beginPath();
      ctx.roundRect(x + 1, ry, w - 2, h, 2);
      ctx.fill();

      // Selection border
      if (isSelected) {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(x + 1, ry, w - 2, h, 2);
        ctx.stroke();
      }
    }
  }
}
