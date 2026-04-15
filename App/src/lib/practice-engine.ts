// ============================================================
// Practice Engine — Mic, pitch detection, accuracy scoring
// ============================================================

import type {
  MelodyItem,
  MelodyNote,
  PitchResult,
  PitchSample,
  NoteResult,
  PracticeResult,
  AccuracyRating,
} from '@/types';
import { AudioEngine } from './audio-engine';
import { PitchDetector } from './pitch-detector';
import { freqToNote } from './scale-data';

// Accuracy bands (threshold in cents → band score)
const DEFAULT_BANDS: { threshold: number; band: number }[] = [
  { threshold: 0,  band: 100 },
  { threshold: 10, band: 90 },
  { threshold: 25, band: 75 },
  { threshold: 50, band: 50 },
  { threshold: 999, band: 0 },
];

export interface PracticeEngineCallbacks {
  onPitchDetected?: (pitch: PitchResult) => void;
  onNoteComplete?: (result: NoteResult) => void;
  onPracticeComplete?: (result: PracticeResult) => void;
  onMicStateChange?: (active: boolean, error?: string) => void;
}

export class PracticeEngine {
  private audioEngine: AudioEngine;
  private detector: PitchDetector;

  private callbacks: PracticeEngineCallbacks = {};

  // State
  private micActive = false;
  private sensitivity = 5;
  private sampleRate = 44100;
  private bufferSize = 2048;
  private bands: { threshold: number; band: number }[] = [...DEFAULT_BANDS];

  // Playback state (shared with melody engine)
  private isPlaying = false;
  private currentNoteIndex = -1;
  private currentTargetNote: MelodyNote | null = null;
  private currentTargetFreq = 0;
  private currentSamples: PitchSample[] = [];

  // Practice session
  private noteResults: NoteResult[] = [];
  private cyclesTotal = 1;
  private cyclesCurrent = 1;
  private allCycleResults: NoteResult[][] = [];
  private runsCompleted = 0;

  constructor(audioEngine: AudioEngine, options: { sensitivity?: number; sampleRate?: number; bufferSize?: number } = {}) {
    this.audioEngine = audioEngine;
    this.sensitivity = options.sensitivity ?? 5;
    this.sampleRate = options.sampleRate ?? 44100;
    this.bufferSize = options.bufferSize ?? 2048;
    this.detector = new PitchDetector({
      sampleRate: this.sampleRate,
      bufferSize: this.bufferSize,
      sensitivity: this.sensitivity,
    });
  }

  // ── Config ────────────────────────────────────────────────

  setSensitivity(value: number): void {
    this.sensitivity = Math.max(1, Math.min(10, value));
    this.detector.setSensitivity(this.sensitivity);
  }

  /** Apply all settings at once (called when settings change) */
  syncSettings(config: {
    detectionThreshold?: number;
    sensitivity?: number;
    minConfidence?: number;
    minAmplitude?: number;
    bands?: { threshold: number; band: number }[];
  }): void {
    if (config.sensitivity !== undefined) {
      this.sensitivity = Math.max(1, Math.min(10, config.sensitivity));
      this.detector.setSensitivity(this.sensitivity);
    }
    if (config.minConfidence !== undefined) {
      this.detector.setMinConfidence(config.minConfidence);
    }
    if (config.minAmplitude !== undefined) {
      this.detector.setMinAmplitude(config.minAmplitude);
    }
    if (config.bands !== undefined) {
      this.bands = [...config.bands];
    }
  }

  setCallbacks(callbacks: PracticeEngineCallbacks): void {
    this.callbacks = callbacks;
  }

  // ── Mic ──────────────────────────────────────────────────

  async startMic(): Promise<boolean> {
    try {
      await this.audioEngine.init();
      await this.audioEngine.resume();
      const ok = await this.audioEngine.startMic();
      if (ok) {
        this.micActive = true;
        this.detector.resetHistory();
        this.callbacks.onMicStateChange?.(true);
        return true;
      }
      this.callbacks.onMicStateChange?.(false, 'Microphone access denied');
      return false;
    } catch (err) {
      this.callbacks.onMicStateChange?.(false, String(err));
      return false;
    }
  }

  stopMic(): void {
    this.audioEngine.stopMic();
    this.micActive = false;
    this.callbacks.onMicStateChange?.(false);
  }

  isMicActive(): boolean {
    return this.micActive;
  }

  // ── Pitch Detection ──────────────────────────────────────

  detectPitch(): PitchResult | null {
    if (!this.micActive) return null;

    const timeData = this.audioEngine.getTimeData();
    const result = this.detector.detect(timeData);

    if (!result.noteName || result.frequency === 0) {
      return null;
    }

    return {
      frequency: result.frequency,
      clarity: result.clarity,
      noteName: result.noteName,
      octave: result.octave,
      cents: result.cents,
    };
  }

  // ── Note Tracking ────────────────────────────────────────

  /** Call this every animation frame while playing */
  update(): PitchResult | null {
    const pitch = this.detectPitch();

    if (pitch && this.isPlaying && this.currentTargetNote) {
      // Compute cents relative to target
      const cents = Math.round(1200 * Math.log2(pitch.frequency / this.currentTargetFreq));

      if (pitch.clarity >= 0.2) {
        this.currentSamples.push({
          freq: pitch.frequency,
          time: performance.now(),
          cents,
        });
      }
    }

    this.callbacks.onPitchDetected?.(pitch ?? {
      frequency: 0,
      clarity: 0,
      noteName: '',
      octave: 0,
      cents: 0,
    });

    return pitch;
  }

  /** Called when a new note starts */
  onNoteStart(note: MelodyNote, noteIndex: number): void {
    // Finalize the previous note's result
    if (this.currentNoteIndex >= 0 && this.currentSamples.length > 0) {
      this.finalizeNoteResult();
    }

    this.currentNoteIndex = noteIndex;
    this.currentTargetNote = note;
    this.currentTargetFreq = note.freq;
    this.currentSamples = [];
  }

  /** Called when playback completes */
  onPlaybackComplete(): NoteResult[] | null {
    if (this.currentNoteIndex >= 0 && this.currentSamples.length > 0) {
      this.finalizeNoteResult();
    }
    return this.noteResults.length > 0 ? this.noteResults : null;
  }

  private finalizeNoteResult(): void {
    if (!this.currentTargetNote) return;

    let avgCents: number | null = null;
    let totalError = 0;

    if (this.currentSamples.length > 0) {
      let sumCents = 0;
      let validCount = 0;
      for (const s of this.currentSamples) {
        if (s.cents !== null) {
          sumCents += Math.abs(s.cents);
          validCount++;
        }
      }
      avgCents = validCount > 0 ? sumCents / validCount : null;
      totalError = sumCents;
    }

    const rating = centsToRating(avgCents, this.bands);

    const result: NoteResult = {
      targetNote: this.currentTargetNote,
      samples: [...this.currentSamples],
      avgFreq: this.currentSamples.length > 0
        ? this.currentSamples.reduce((s, x) => s + x.freq, 0) / this.currentSamples.length
        : 0,
      avgCents: avgCents ?? 0,
      sampleCount: this.currentSamples.length,
      rating,
      totalError,
    };

    this.noteResults.push(result);
    this.callbacks.onNoteComplete?.(result);
  }

  // ── Playback lifecycle ────────────────────────────────────

  startSession(): void {
    this.isPlaying = true;
    this.noteResults = [];
    this.currentSamples = [];
    this.currentNoteIndex = -1;
  }

  endSession(): NoteResult[] {
    this.isPlaying = false;
    if (this.currentNoteIndex >= 0 && this.currentSamples.length > 0) {
      this.finalizeNoteResult();
    }
    const results = [...this.noteResults];
    return results;
  }

  resetSession(): void {
    this.noteResults = [];
    this.currentSamples = [];
    this.currentNoteIndex = -1;
    this.currentTargetNote = null;
    this.currentTargetFreq = 0;
    this.runsCompleted++;
  }

  // ── Score calculation ─────────────────────────────────────

  calculateScore(results: NoteResult[]): number {
    if (results.length === 0) return 0;
    let total = 0;
    for (const r of results) {
      total += ratingToScore(r.rating);
    }
    return Math.round(total / results.length);
  }

  calculatePracticeResult(results: NoteResult[]): PracticeResult {
    return {
      noteResults: results,
      score: this.calculateScore(results),
      avgCents: results.length > 0
        ? results.reduce((s, r) => s + Math.abs(r.avgCents), 0) / results.length
        : 0,
      noteCount: results.length,
    };
  }

  // ── Cleanup ───────────────────────────────────────────────

  destroy(): void {
    this.stopMic();
  }
}

// ============================================================
// Utility functions
// ============================================================

export function centsToRating(avgCents: number | null, bands?: { threshold: number; band: number }[]): AccuracyRating {
  // Use fixed thresholds matching the old app (not configurable) for rating labels
  // Bands are used only for the numeric score calculation
  if (avgCents === null) return 'off';
  if (avgCents <= 5)  return 'perfect';
  if (avgCents <= 15) return 'excellent';
  if (avgCents <= 25) return 'good';
  if (avgCents <= 50) return 'okay';
  return 'off';
}

export function centsToBand(avgCents: number | null, bands?: { threshold: number; band: number }[]): number {
  const useBands = bands ?? DEFAULT_BANDS;
  if (avgCents === null) return 0;
  for (const b of useBands) {
    if (avgCents <= b.threshold) return b.band;
  }
  return 0;
}

export function ratingToScore(rating: AccuracyRating): number {
  switch (rating) {
    case 'perfect':   return 100;
    case 'excellent': return 90;
    case 'good':     return 75;
    case 'okay':     return 50;
    case 'off':      return 0;
  }
}

export function scoreGrade(score: number): { label: string; cls: string } {
  if (score >= 90) return { label: 'Pitch Perfect!', cls: 'grade-perfect' };
  if (score >= 80) return { label: 'Excellent!',     cls: 'grade-excellent' };
  if (score >= 65) return { label: 'Good!',          cls: 'grade-good' };
  if (score >= 50) return { label: 'Okay!',           cls: 'grade-okay' };
  return               { label: 'Needs Work',          cls: 'grade-needs-work' };
}
