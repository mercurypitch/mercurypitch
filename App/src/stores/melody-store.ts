// ============================================================
// Melody Store — Melody items and scale data
// ============================================================

import { createSignal, onMount } from 'solid-js'
import { createStore } from 'solid-js/store'
import { buildMultiOctaveScale, buildSampleMelody } from '@/lib/scale-data'
import type { MelodyItem, MelodyNote, ScaleDegree } from '@/types'
import { appStore } from './app-store'

// ── Melody items ─────────────────────────────────────────────

const DEFAULT_MELODY_KEY = 'pitchperfect_default_melody'

function loadDefaultMelodyFromStorage(): MelodyItem[] {
  try {
    const stored = localStorage.getItem(DEFAULT_MELODY_KEY)
    if (stored !== null && stored !== '') {
      const parsed = JSON.parse(stored)
      if (Array.isArray(parsed)) return parsed
    }
  } catch {
    // Fail silently
  }
  return buildSampleMelody('C', 4)
}

function saveDefaultMelodyToStorage(melody: MelodyItem[]): void {
  try {
    localStorage.setItem(DEFAULT_MELODY_KEY, JSON.stringify(melody))
  } catch {
    // Fail silently
  }
}

const [melodyItems, setMelodyItems] = createStore<MelodyItem[]>(
  loadDefaultMelodyFromStorage(),
)

let _idCounter = 100

export function generateId(): number {
  return ++_idCounter
}

export function addMelodyNote(
  note: MelodyNote,
  startBeat: number,
  duration: number,
): void {
  setMelodyItems((items) => [
    ...items,
    { id: generateId(), note, startBeat, duration },
  ])
}

export function removeMelodyNote(id: number): void {
  setMelodyItems((items) => items.filter((item) => item.id !== id))
}

export function updateMelodyNote(
  id: number,
  updates: Partial<Pick<MelodyItem, 'startBeat' | 'duration' | 'note'>>,
): void {
  setMelodyItems((item) => item.id === id, updates)
}

export function setMelody(newMelody: MelodyItem[]): void {
  const updated = newMelody.map((item, _i) => ({ ...item, id: item.id ?? generateId() }))
  setMelodyItems(updated)
  saveDefaultMelodyToStorage(updated)
}

export function clearMelody(): void {
  setMelodyItems([])
}

// Save melody to localStorage whenever it changes (for default melody persistence)
onMount(() => {
  const currentMelody = melodyItems
  saveDefaultMelodyToStorage(currentMelody)
})

// ── Scale data ───────────────────────────────────────────────

const [currentScale, setCurrentScale] = createSignal<ScaleDegree[]>(
  buildMultiOctaveScale('C', 3, 2, 'major'),
)
const [currentOctave, setCurrentOctave] = createSignal<number>(3)

export function refreshScale(
  keyName: string,
  startOctave: number,
  scaleType: string,
): void {
  setCurrentOctave(startOctave)
  setCurrentScale(buildMultiOctaveScale(keyName, startOctave, 2, scaleType))
}

export function setOctave(octave: number): void {
  setCurrentOctave(octave)
}

export function setNumOctaves(num: number): void {
  setCurrentScale(
    buildMultiOctaveScale('C', currentOctave(), num, appStore.scaleType()),
  )
}

// ── Current note index (during playback) ────────────────────

const [currentNoteIndex, setCurrentNoteIndex] = createSignal<number>(-1)

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
  setOctave,
  setNumOctaves,
  currentOctave,
  setCurrentOctave,

  // Playback position
  currentNoteIndex,
  setCurrentNoteIndex,
}
