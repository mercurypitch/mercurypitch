// ============================================================
// Melody Store Tests
// ============================================================

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { melodyStore, setMelody, clearMelody, generateId, addMelodyNote, removeMelodyNote, updateMelodyNote } from '@/stores/melody-store';
import type { MelodyItem, MelodyNote } from '@/types';

describe('MelodyStore', () => {
  beforeEach(() => {
    // Reset to sample melody
    setMelody([
      { id: 1, note: { name: 'C', octave: 4, midi: 60, freq: 261 }, startBeat: 0, duration: 2 },
      { id: 2, note: { name: 'E', octave: 4, midi: 64, freq: 329 }, startBeat: 2, duration: 2 },
      { id: 3, note: { name: 'G', octave: 4, midi: 67, freq: 392 }, startBeat: 4, duration: 2 },
    ]);
  });

  afterEach(() => {
    setMelody([]);
  });

  describe('initialization', () => {
    it('starts with some melody items', () => {
      expect(melodyStore.items.length).toBeGreaterThan(0);
    });

    it('has current scale', () => {
      expect(melodyStore.currentScale()).toBeDefined();
      expect(melodyStore.currentScale().length).toBeGreaterThan(0);
    });
  });

  describe('setMelody', () => {
    it('replaces current melody', () => {
      setMelody([
        { note: { name: 'A', octave: 4, midi: 69, freq: 440 }, startBeat: 0, duration: 4 },
      ]);
      expect(melodyStore.items.length).toBe(1);
      expect(melodyStore.items[0].note.name).toBe('A');
    });

    it('generates IDs for items without IDs', () => {
      setMelody([
        { note: { name: 'A', octave: 4, midi: 69, freq: 440 }, startBeat: 0, duration: 4 },
      ]);
      expect(melodyStore.items[0].id).toBeDefined();
      expect(typeof melodyStore.items[0].id).toBe('number');
    });

    it('preserves existing IDs', () => {
      setMelody([
        { id: 999, note: { name: 'A', octave: 4, midi: 69, freq: 440 }, startBeat: 0, duration: 4 },
      ]);
      expect(melodyStore.items[0].id).toBe(999);
    });
  });

  describe('clearMelody', () => {
    it('removes all melody items', () => {
      clearMelody();
      expect(melodyStore.items.length).toBe(0);
    });
  });

  describe('generateId', () => {
    it('generates unique IDs', () => {
      const id1 = generateId();
      const id2 = generateId();
      expect(id1).not.toBe(id2);
    });

    it('generates incrementing IDs', () => {
      const id1 = generateId();
      const id2 = generateId();
      expect(id2).toBe(id1 + 1);
    });
  });

  describe('addMelodyNote', () => {
    it('adds a new note', () => {
      const initialLength = melodyStore.items.length;
      addMelodyNote(
        { name: 'B', octave: 4, midi: 71, freq: 493 },
        8,
        2
      );
      expect(melodyStore.items.length).toBe(initialLength + 1);
    });

    it('appends at correct position', () => {
      addMelodyNote(
        { name: 'B', octave: 4, midi: 71, freq: 493 },
        8,
        2
      );
      const lastNote = melodyStore.items[melodyStore.items.length - 1];
      expect(lastNote.startBeat).toBe(8);
      expect(lastNote.note.name).toBe('B');
    });
  });

  describe('removeMelodyNote', () => {
    it('removes note by ID', () => {
      const noteToRemove = melodyStore.items[0];
      removeMelodyNote(noteToRemove.id);
      expect(melodyStore.items.find(n => n.id === noteToRemove.id)).toBeUndefined();
    });

    it('does nothing for non-existent ID', () => {
      const initialLength = melodyStore.items.length;
      removeMelodyNote(999999);
      expect(melodyStore.items.length).toBe(initialLength);
    });
  });

  describe('updateMelodyNote', () => {
    it('updates note properties', () => {
      const noteToUpdate = melodyStore.items[0];
      updateMelodyNote(noteToUpdate.id, { startBeat: 10 });
      const updated = melodyStore.items.find(n => n.id === noteToUpdate.id);
      expect(updated?.startBeat).toBe(10);
    });

    it('updates multiple properties', () => {
      const noteToUpdate = melodyStore.items[0];
      updateMelodyNote(noteToUpdate.id, { startBeat: 5, duration: 4 });
      const updated = melodyStore.items.find(n => n.id === noteToUpdate.id);
      expect(updated?.startBeat).toBe(5);
      expect(updated?.duration).toBe(4);
    });

    it('does nothing for non-existent ID', () => {
      // Should not throw
      updateMelodyNote(999999, { startBeat: 10 });
    });
  });

  describe('currentNoteIndex', () => {
    it('starts at -1 (no note playing)', () => {
      expect(melodyStore.currentNoteIndex()).toBe(-1);
    });

    it('can be set', () => {
      melodyStore.setCurrentNoteIndex(5);
      expect(melodyStore.currentNoteIndex()).toBe(5);
    });
  });

  describe('currentOctave', () => {
    it('starts at default octave', () => {
      expect(melodyStore.currentOctave()).toBeDefined();
      expect(typeof melodyStore.currentOctave()).toBe('number');
    });

    it('can be set', () => {
      melodyStore.setCurrentOctave(5);
      expect(melodyStore.currentOctave()).toBe(5);
    });
  });

  describe('refreshScale', () => {
    it('updates scale and octave', () => {
      const originalLength = melodyStore.currentScale().length;

      melodyStore.refreshScale('G', 4, 'major');

      expect(melodyStore.currentOctave()).toBe(4);
      expect(melodyStore.currentScale().length).toBe(originalLength);
    });
  });
});