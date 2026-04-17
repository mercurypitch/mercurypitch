// ============================================================
// Session Data Tests — validate static session templates
// ============================================================

import { describe, it, expect } from 'vitest';
import { PRACTICE_SESSIONS } from '@/data/sessions';

describe('PRACTICE_SESSIONS — static data integrity', () => {
  it('has at least 5 session templates', () => {
    expect(PRACTICE_SESSIONS.length).toBeGreaterThanOrEqual(5);
  });

  it('every session has a unique id', () => {
    const ids = PRACTICE_SESSIONS.map(s => s.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('every session has non-empty name and description', () => {
    for (const session of PRACTICE_SESSIONS) {
      expect(session.name.trim().length).toBeGreaterThan(0, `Session ${session.id} has empty name`);
      expect(session.description.trim().length).toBeGreaterThan(0, `Session ${session.id} has empty description`);
    }
  });

  it('every session has at least 3 items', () => {
    for (const session of PRACTICE_SESSIONS) {
      expect(session.items.length).toBeGreaterThanOrEqual(3, `Session ${session.id} has fewer than 3 items`);
    }
  });

  it('every item has a label', () => {
    for (const session of PRACTICE_SESSIONS) {
      for (const item of session.items) {
        expect(item.label?.trim().length).toBeGreaterThan(0, `Session ${session.id} item missing label`);
      }
    }
  });

  it('rest items have positive restMs', () => {
    for (const session of PRACTICE_SESSIONS) {
      for (const item of session.items) {
        if (item.type === 'rest') {
          expect(item.restMs).toBeDefined();
          expect(item.restMs!).toBeGreaterThan(0, `Rest item in ${session.id} has invalid restMs`);
        }
      }
    }
  });

  it('scale items have valid scaleType and positive beats', () => {
    for (const session of PRACTICE_SESSIONS) {
      for (const item of session.items) {
        if (item.type === 'scale') {
          expect(item.scaleType?.trim().length).toBeGreaterThan(0, `Scale item in ${session.id} missing scaleType`);
          expect(item.beats).toBeDefined();
          expect(item.beats!).toBeGreaterThan(0, `Scale item in ${session.id} has invalid beats`);
        }
      }
    }
  });

  it('every session has valid difficulty and category', () => {
    const validDifficulties = ['beginner', 'intermediate', 'advanced'];
    const validCategories = ['vocal', 'instrumental', 'ear-training', 'general'];
    for (const session of PRACTICE_SESSIONS) {
      expect(validDifficulties).toContain(session.difficulty);
      expect(validCategories).toContain(session.category);
    }
  });

  it('contains expected session IDs', () => {
    const ids = PRACTICE_SESSIONS.map(s => s.id);
    expect(ids).toContain('warmup-2min');
    expect(ids).toContain('deep-20min');
    expect(ids).toContain('vocal-5min');
  });

  it('advanced sessions have at least 8 items', () => {
    for (const session of PRACTICE_SESSIONS) {
      if (session.difficulty === 'advanced') {
        expect(session.items.length).toBeGreaterThanOrEqual(8, `${session.id} should have 8+ items`);
      }
    }
  });
});