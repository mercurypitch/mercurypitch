// ============================================================
// App Store — Global application state
// ============================================================

import { createSignal } from 'solid-js';
import { createStore } from 'solid-js/store';
import type { KeySignature } from '@/types';

// ── Key / Scale ─────────────────────────────────────────────

const [keyName, setKeyName] = createSignal<string>('C');
const [scaleType, setScaleType] = createSignal<string>('major');
const [bpm, setBpm] = createSignal<number>(120);
const [isRecording, setIsRecording] = createSignal<boolean>(false);

// ── Mic ──────────────────────────────────────────────────────

const [micActive, setMicActive] = createSignal<boolean>(false);
const [micError, setMicError] = createSignal<string | null>(null);

// ── Count-in ────────────────────────────────────────────────

export type CountInOption = 0 | 1 | 2 | 4;

const [countIn, setCountIn] = createSignal<CountInOption>(0);

// ── Practice ────────────────────────────────────────────────

const [practiceCount, setPracticeCount] = createSignal<number>(0);
const [lastScore, setLastScore] = createSignal<number | null>(null);

// ── Active tab ───────────────────────────────────────────────

export type ActiveTab = 'practice' | 'editor' | 'about';
const [activeTab, setActiveTab] = createSignal<ActiveTab>('practice');

// ── Presets ──────────────────────────────────────────────────

const PRESETS_KEY = 'pitchperfect_presets';
const LAST_PRESET_KEY = 'pitchperfect_lastpreset';
const SELECTED_PRESET_KEY = 'pitchperfect_selected_preset';

export interface PresetData {
  notes: Array<{ midi: number; startBeat: number; duration: number }>;
  totalBeats: number;
  bpm: number;
  scale: Array<{ midi: number; name: string; octave: number; freq: number }>;
}

export type PresetsStore = Record<string, PresetData>;

const [presets, setPresets] = createSignal<PresetsStore>({});
const [currentPresetName, setCurrentPresetName] = createSignal<string | null>(null);

function loadPresetsFromStorage(): PresetsStore {
  try {
    const raw = localStorage.getItem(PRESETS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function savePresetsToStorage(data: PresetsStore): void {
  try {
    localStorage.setItem(PRESETS_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('Failed to save presets:', e);
  }
}

export function initPresets(): void {
  const stored = loadPresetsFromStorage();
  if (Object.keys(stored).length > 0) {
    setPresets(stored);
  }
  const last = localStorage.getItem(LAST_PRESET_KEY);
  if (last) setCurrentPresetName(last);
}

export function savePreset(name: string, data: PresetData): void {
  const updated = { ...presets(), [name]: data };
  setPresets(updated);
  savePresetsToStorage(updated);
  setCurrentPresetName(name);
  localStorage.setItem(LAST_PRESET_KEY, name);
  localStorage.setItem(SELECTED_PRESET_KEY, name);
  window.dispatchEvent(new CustomEvent('pitchperfect:presetSaved', { detail: { name } }));
}

export function loadPreset(name: string): PresetData | null {
  return presets()[name] ?? null;
}

export function getPresetNames(): string[] {
  return Object.keys(presets()).sort();
}

export function deletePreset(name: string): void {
  const updated = { ...presets() };
  delete updated[name];
  setPresets(updated);
  savePresetsToStorage(updated);
  if (currentPresetName() === name) {
    setCurrentPresetName(null);
    localStorage.removeItem(LAST_PRESET_KEY);
    localStorage.removeItem(SELECTED_PRESET_KEY);
  }
  window.dispatchEvent(new CustomEvent('pitchperfect:presetDeleted', { detail: { name } }));
}

// ── Notifications ────────────────────────────────────────────

interface Notification {
  id: number;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
}

const [notifications, setNotifications] = createStore<Notification[]>([]);
let _notifId = 0;

export function showNotification(message: string, type: Notification['type'] = 'info'): void {
  const id = ++_notifId;
  setNotifications((n) => [...n, { id, message, type }]);
  setTimeout(() => {
    setNotifications((n) => n.filter((x) => x.id !== id));
  }, 3000);
}

export const appStore = {
  // Key / scale
  keyName,
  setKeyName,
  scaleType,
  setScaleType,
  bpm,
  setBpm,

  // Recording
  isRecording,
  setIsRecording,

  // Mic
  micActive,
  setMicActive,
  micError,
  setMicError,

  // Practice
  practiceCount,
  setPracticeCount,
  lastScore,
  setLastScore,

  // Count-in
  countIn,
  setCountIn,

  // Navigation
  activeTab,
  setActiveTab,

  // Notifications
  notifications,
  showNotification,

  // Presets
  presets,
  currentPresetName,
  initPresets,
  savePreset,
  loadPreset,
  getPresetNames,
  deletePreset,
};
