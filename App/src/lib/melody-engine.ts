// ============================================================
// Melody Engine — Orchestrates melody playback with audio
// ============================================================

import type { MelodyItem, MelodyNote } from '@/types';
import { melodyIndexAtBeat } from './scale-data';

export interface MelodyEngineCallbacks {
  onNoteStart?: (note: MelodyNote, noteIndex: number) => void;
  onNoteEnd?: (note: MelodyNote, noteIndex: number) => void;
  onBeatUpdate?: (currentBeat: number) => void;
  onComplete?: () => void;
}

export interface MelodyEngineOptions {
  bpm: number;
  melody: MelodyItem[];
  onNoteStart?: (note: MelodyNote, noteIndex: number) => void;
  onNoteEnd?: (note: MelodyNote, noteIndex: number) => void;
  onBeatUpdate?: (currentBeat: number) => void;
  onComplete?: () => void;
}

export class MelodyEngine {
  private melody: MelodyItem[] = [];
  private bpm: number;
  private callbacks: MelodyEngineCallbacks;

  private isPlaying = false;
  private isPaused = false;
  private animFrameId: number | null = null;
  private playStartTime = 0;
  private pauseOffset = 0;
  private currentBeat = 0;
  private currentNoteIndex = -1;
  private hopActive = false;
  private hopStartTime = 0;
  private hopFromY = 0;
  private hopToY = 0;
  private hopDuration = 280;

  constructor(options: MelodyEngineOptions) {
    this.bpm = options.bpm;
    this.melody = options.melody;
    this.callbacks = {
      onNoteStart: options.onNoteStart,
      onNoteEnd: options.onNoteEnd,
      onBeatUpdate: options.onBeatUpdate,
      onComplete: options.onComplete,
    };
  }

  // ── Config ────────────────────────────────────────────────

  setMelody(melody: MelodyItem[]): void {
    this.melody = melody;
  }

  setBPM(bpm: number): void {
    this.bpm = bpm;
  }

  getMelody(): MelodyItem[] {
    return this.melody;
  }

  totalBeats(): number {
    let max = 0;
    for (const item of this.melody) {
      const end = item.startBeat + item.duration;
      if (end > max) max = end;
    }
    return max;
  }

  // ── State ─────────────────────────────────────────────────

  getIsPlaying(): boolean {
    return this.isPlaying;
  }

  getIsPaused(): boolean {
    return this.isPaused;
  }

  getCurrentBeat(): number {
    return this.currentBeat;
  }

  getCurrentNoteIndex(): number {
    return this.currentNoteIndex;
  }

  // ── Playback ──────────────────────────────────────────────

  start(): void {
    if (this.isPlaying) return;

    this.isPlaying = true;
    this.isPaused = false;
    this.currentBeat = 0;
    this.pauseOffset = 0;
    this.playStartTime = performance.now();
    this.hopActive = false;
    this.hopStartTime = 0;
    this.currentNoteIndex = -1;

    this._tick();
  }

  pause(): void {
    if (!this.isPlaying || this.isPaused) return;

    this.isPaused = true;
    this.pauseOffset = performance.now() - this.playStartTime;
    this._stopTick();
  }

  resume(): void {
    if (!this.isPlaying || !this.isPaused) return;

    this.isPaused = false;
    this.playStartTime = performance.now() - this.pauseOffset;
    this._tick();
  }

  stop(): void {
    this._stopTick();
    this.isPlaying = false;
    this.isPaused = false;
    this.currentBeat = 0;
    this.currentNoteIndex = -1;
  }

  private _tick(): void {
    this.animFrameId = requestAnimationFrame(() => this._onFrame());
  }

  private _stopTick(): void {
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }

  private _onFrame(): void {
    if (!this.isPlaying || this.isPaused) return;

    const elapsed = performance.now() - this.playStartTime;
    const beatsPerMs = this.bpm / 60000;
    this.currentBeat = elapsed * beatsPerMs;

    const total = this.totalBeats();

    // Check for end
    if (this.currentBeat >= total) {
      this.currentBeat = total;
      this.callbacks.onBeatUpdate?.(this.currentBeat);
      this.callbacks.onComplete?.();
      return;
    }

    // Check for note change
    const newIndex = melodyIndexAtBeat(this.melody, this.currentBeat);
    if (newIndex !== this.currentNoteIndex) {
      // End previous note
      if (this.currentNoteIndex >= 0) {
        this.callbacks.onNoteEnd?.(
          this.melody[this.currentNoteIndex].note,
          this.currentNoteIndex
        );
      }

      // Trigger hop
      if (this.currentNoteIndex >= 0 && newIndex >= 0) {
        this.hopFromY = this.currentNoteIndex;
        this.hopToY = newIndex;
        this.hopActive = true;
        this.hopStartTime = performance.now();
      }

      this.currentNoteIndex = newIndex;
      if (newIndex >= 0) {
        this.callbacks.onNoteStart?.(this.melody[newIndex].note, newIndex);
      }
    }

    this.callbacks.onBeatUpdate?.(this.currentBeat);
    this._tick();
  }

  // ── Hop animation ─────────────────────────────────────────

  getHopProgress(): { active: boolean; progress: number; from: number; to: number } {
    if (!this.hopActive) {
      return { active: false, progress: 0, from: 0, to: 0 };
    }
    const elapsed = performance.now() - this.hopStartTime;
    const progress = Math.min(1, elapsed / this.hopDuration);
    if (progress >= 1) this.hopActive = false;
    return { active: this.hopActive, progress, from: this.hopFromY, to: this.hopToY };
  }

  // ── Cleanup ───────────────────────────────────────────────

  destroy(): void {
    this._stopTick();
  }
}
