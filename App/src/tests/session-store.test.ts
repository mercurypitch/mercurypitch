// ============================================================
// Practice Session State Tests — appStore session lifecycle
// ============================================================

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  startPracticeSession,
  getCurrentSessionItem,
  advanceSessionItem,
  recordSessionItemResult,
  endPracticeSession,
  isInSessionMode,
  initSessionHistory,
  initPresets,
} from '@/stores/app-store';
import type { PracticeSession } from '@/types';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
  };
})();
Object.defineProperty(global, 'localStorage', { value: localStorageMock });

const makeSession = (id: string, itemCount: number): PracticeSession => ({
  id,
  name: `${id} name`,
  description: `${id} description`,
  difficulty: 'beginner',
  category: 'vocal',
  items: Array.from({ length: itemCount }, (_, i) => ({
    type: 'scale' as const,
    label: `Item ${i + 1}`,
    scaleType: 'major',
    beats: 8,
  })),
});

describe('startPracticeSession', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  it('marks session mode as active', () => {
    const session = makeSession('test-1', 3);
    startPracticeSession(session);
    expect(isInSessionMode()).toBe(true);
  });

  it('sets the session on the store', () => {
    const session = makeSession('test-1', 3);
    startPracticeSession(session);
    const item = getCurrentSessionItem();
    expect(item).toBeDefined();
    expect(item!.label).toBe('Item 1');
  });
});

describe('getCurrentSessionItem', () => {
  beforeEach(() => {
    localStorageMock.clear();
    // Init stores then clean any lingering session
    initSessionHistory();
    initPresets();
    endPracticeSession();
  });

  it('returns null when no session is active', () => {
    expect(getCurrentSessionItem()).toBeNull();
  });

  it('returns the first item after starting a session', () => {
    const session = makeSession('test-1', 4);
    startPracticeSession(session);
    const item = getCurrentSessionItem();
    expect(item!.label).toBe('Item 1');
  });
});

describe('advanceSessionItem', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  it('moves to the next item', () => {
    const session = makeSession('test-1', 4);
    startPracticeSession(session);
    expect(getCurrentSessionItem()!.label).toBe('Item 1');

    advanceSessionItem();
    expect(getCurrentSessionItem()!.label).toBe('Item 2');
  });

  it('does not advance past the last item', () => {
    const session = makeSession('test-1', 2);
    startPracticeSession(session);
    advanceSessionItem();
    advanceSessionItem(); // already at last item
    const item = getCurrentSessionItem();
    expect(item).toBeDefined();
  });
});

describe('recordSessionItemResult', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  it('records score for the current item', () => {
    const session = makeSession('test-1', 3);
    startPracticeSession(session);
    recordSessionItemResult(85);
    recordSessionItemResult(90);
    // Scores are stored internally
  });
});

describe('endPracticeSession', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  it('returns a SessionResult with averaged score', () => {
    const session = makeSession('end-test', 3);
    startPracticeSession(session);
    recordSessionItemResult(80);
    advanceSessionItem();
    recordSessionItemResult(90);
    advanceSessionItem();
    recordSessionItemResult(100);

    const result = endPracticeSession();
    expect(result).not.toBeNull();
    expect(result!.sessionId).toBe('end-test');
    expect(result!.totalItems).toBe(3);
    expect(result!.itemsCompleted).toBe(3);
    // (80 + 90 + 100) / 3 = 90
    expect(result!.score).toBe(90);
  });

  it('restores session mode to inactive', () => {
    const session = makeSession('end-test', 2);
    startPracticeSession(session);
    expect(isInSessionMode()).toBe(true);

    endPracticeSession();
    expect(isInSessionMode()).toBe(false);
  });

  it('persists result to localStorage', () => {
    // Snapshot calls before the operation
    const callsBefore = localStorageMock.setItem.mock.calls.length;

    const session = makeSession('persist-test', 2);
    startPracticeSession(session);
    recordSessionItemResult(75);
    endPracticeSession();

    // Find the session_results call that happened after our snapshot
    const sessionCall = localStorageMock.setItem.mock.calls.find(
      (call: string[]) =>
        call[0] === 'pitchperfect_session_results' &&
        localStorageMock.setItem.mock.calls.indexOf(call) >= callsBefore
    );
    expect(sessionCall).toBeDefined();
    const parsed = JSON.parse(sessionCall![1] as string);
    expect(parsed[0].sessionId).toBe('persist-test');
  });

  it('returns null when no session was active', () => {
    const result = endPracticeSession();
    expect(result).toBeNull();
  });

  it('handles zero recorded scores gracefully', () => {
    const session = makeSession('empty-test', 3);
    startPracticeSession(session);
    // no scores recorded

    const result = endPracticeSession();
    expect(result).not.toBeNull();
    expect(result!.score).toBe(0);
  });
});

describe('isInSessionMode', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  it('returns false initially', () => {
    expect(isInSessionMode()).toBe(false);
  });

  it('returns true when session is active', () => {
    const session = makeSession('mode-test', 2);
    startPracticeSession(session);
    expect(isInSessionMode()).toBe(true);
  });

  it('returns false after session ends', () => {
    const session = makeSession('mode-test', 2);
    startPracticeSession(session);
    endPracticeSession();
    expect(isInSessionMode()).toBe(false);
  });
});