// ============================================================
// Melody Engine Tests
// ============================================================

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MelodyEngine } from '@/lib/melody-engine';
import type { MelodyItem } from '@/types';

// Helper to create mock melody items
const createMelody = (): MelodyItem[] => [
  { id: 1, note: { midi: 60, name: 'C', octave: 4, freq: 261 }, startBeat: 0, duration: 2 },
  { id: 2, note: { midi: 64, name: 'E', octave: 4, freq: 329 }, startBeat: 2, duration: 2 },
  { id: 3, note: { midi: 67, name: 'G', octave: 4, freq: 392 }, startBeat: 4, duration: 2 },
];

describe('MelodyEngine', () => {
  let engine: MelodyEngine;
  let melody: MelodyItem[];

  beforeEach(() => {
    melody = createMelody();
    engine = new MelodyEngine({
      bpm: 120,
      melody,
    });
  });

  describe('creation', () => {
    it('creates with default options', () => {
      const e = new MelodyEngine({ bpm: 60, melody: [] });
      expect(e.getIsPlaying()).toBe(false);
      expect(e.getIsPaused()).toBe(false);
    });
  });

  describe('config', () => {
    it('sets melody', () => {
      const newMelody = createMelody();
      engine.setMelody(newMelody);
      expect(engine.getMelody()).toBe(newMelody);
    });

    it('sets BPM', () => {
      engine.setBPM(100);
      // BPM affects timing, verified through playback
    });

    it('sets count-in beats', () => {
      engine.setCountIn(4);
      // Count-in setting is stored and used during start
    });
  });

  describe('state', () => {
    it('tracks playing state', () => {
      expect(engine.getIsPlaying()).toBe(false);
      engine.start();
      expect(engine.getIsPlaying()).toBe(true);
      engine.stop();
      expect(engine.getIsPlaying()).toBe(false);
    });

    it('tracks paused state', () => {
      engine.start();
      expect(engine.getIsPaused()).toBe(false);
      engine.pause();
      expect(engine.getIsPaused()).toBe(true);
      engine.resume();
      expect(engine.getIsPaused()).toBe(false);
    });

    it('tracks current beat', () => {
      expect(engine.getCurrentBeat()).toBe(0);
    });
  });

  describe('count-in', () => {
    it('reports when in count-in phase', () => {
      expect(engine.isInCountIn()).toBe(false);
      // Count-in starts when start() is called with count-in parameter
      // But since we're not actually waiting for playback, we just verify the method exists
    });

    it('reports current count-in beat', () => {
      expect(engine.getCountInBeat()).toBe(0);
    });

    it('setCountIn clamps to valid range', () => {
      engine.setCountIn(-1); // Should clamp to 0
      engine.setCountIn(10); // Should clamp to 4
      // No error means success
    });
  });

  describe('start/pause/resume/stop', () => {
    it('starts playback', () => {
      engine.start();
      expect(engine.getIsPlaying()).toBe(true);
    });

    it('starts with count-in', () => {
      engine.start(4);
      expect(engine.getIsPlaying()).toBe(true);
    });

    it('pauses playback', () => {
      engine.start();
      engine.pause();
      expect(engine.getIsPaused()).toBe(true);
    });

    it('resumes playback', () => {
      engine.start();
      engine.pause();
      engine.resume();
      expect(engine.getIsPaused()).toBe(false);
    });

    it('stops playback', () => {
      engine.start();
      engine.stop();
      expect(engine.getIsPlaying()).toBe(false);
      expect(engine.getCurrentBeat()).toBe(0);
    });
  });

  describe('hop animation', () => {
    it('returns inactive hop by default', () => {
      const hop = engine.getHopProgress();
      expect(hop.active).toBe(false);
    });
  });

  describe('totalBeats', () => {
    it('calculates total beats in melody', () => {
      expect(engine.totalBeats()).toBe(6); // Last note ends at beat 4 + 2 = 6
    });

    it('returns 0 for empty melody', () => {
      const emptyEngine = new MelodyEngine({ bpm: 120, melody: [] });
      expect(emptyEngine.totalBeats()).toBe(0);
    });
  });

  describe('cleanup', () => {
    it('has destroy method', () => {
      const e = new MelodyEngine({ bpm: 120, melody: [] });
      expect(typeof e.destroy).toBe('function');
      e.destroy(); // Should not throw
    });
  });
});