// ============================================================
// Melody Store — Melody items and scale data
// ============================================================

import { createSignal } from 'solid-js';
import { createStore } from 'solid-js/store';
import type { MelodyItem, ScaleDegree, MelodyNote } from '@/types';
import { buildSampleMelody, buildMultiOctaveScale } from '@/lib/scale-data';

// ── Melody items ─────────────────────────────────────────────

const [melodyItems, setMelodyItems] = createStore<MelodyItem[]>(
  buildSampleMelody('C', 4)
);

let _idCounter = 100;

export function generateId(): number {
  return ++_idCounter;
}

export function addMelodyNote(note: MelodyNote, startBeat: number, duration: number): void {
  setMelodyItems((items) => [
    ...items,
    { id: generateId(), note, startBeat, duration },
  ]);
}

export function removeMelodyNote(id: number): void {
  setMelodyItems((items) => items.filter((item) => item.id !== id));
}

export function updateMelodyNote(
  id: number,
  updates: Partial<Pick<MelodyItem, 'startBeat' | 'duration' | 'note'>>
): void {
  setMelodyItems(
    (item) => item.id === id,
    updates
  );
}

export function setMelody(newMelody: MelodyItem[]): void {
  setMelodyItems(newMelody.map((item, i) => ({ ...item, id: item.id ?? generateId() })));
}

export function clearMelody(): void {
  setMelodyItems([]);
}

// ── Scale data ───────────────────────────────────────────────

const [currentScale, setCurrentScale] = createSignal<ScaleDegree[]>(
  buildMultiOctaveScale('C', 3, 2, 'major')
);
const [currentOctave, setCurrentOctave] = createSignal<number>(3);

export function refreshScale(keyName: string, startOctave: number, scaleType: string): void {
  setCurrentOctave(startOctave);
  setCurrentScale(buildMultiOctaveScale(keyName, startOctave, 2, scaleType));
}

// ── Current note index (during playback) ────────────────────

const [currentNoteIndex, setCurrentNoteIndex] = createSignal<number>(-1);

export const melodyStore = {
  // Melody items
  items: melodyItems,
  setItems: setMelodyItems,
  addMelodyNote,
  removeMelodyNote,
  updateMelodyNote,
  setMelody,
  clearMelody,
  generateId,

  // Scale
  currentScale,
  setCurrentScale,
  refreshScale,
  currentOctave,
  setCurrentOctave,

  // Playback position
  currentNoteIndex,
  setCurrentNoteIndex,
};
