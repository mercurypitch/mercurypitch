// ============================================================
// App Store — Global application state
// ============================================================

import { createSignal } from 'solid-js';
import { createStore } from 'solid-js/store';
import type { AccuracyBand } from '@/types';

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

// ── Grid ──────────────────────────────────────────────────────

const GRID_KEY = 'pitchperfect_grid';
function loadGridVisibility(): boolean {
  try { return localStorage.getItem(GRID_KEY) !== 'false'; } catch { return true; }
}
const [gridLinesVisible, setGridLinesVisible] = createSignal<boolean>(loadGridVisibility());

export function toggleGridLines(): void {
  const next = !gridLinesVisible();
  setGridLinesVisible(next);
  try { localStorage.setItem(GRID_KEY, String(next)); } catch {}
  window.dispatchEvent(new CustomEvent('pitchperfect:gridToggle', { detail: { visible: next } }));
}

export function setGridLines(visible: boolean): void {
  setGridLinesVisible(visible);
  try { localStorage.setItem(GRID_KEY, String(visible)); } catch {}
  window.dispatchEvent(new CustomEvent('pitchperfect:gridToggle', { detail: { visible } }));
}

// ── Active tab ───────────────────────────────────────────────

export type ActiveTab = 'practice' | 'editor' | 'settings';
const [activeTab, setActiveTab] = createSignal<ActiveTab>('practice');

// ── Settings ───────────────────────────────────────────────────

const SETTINGS_KEY = 'pitchperfect_settings';

export interface SettingsConfig {
  detectionThreshold: number; // 0.05–0.20 (default 0.10)
  sensitivity: number;        // 1–10 (default 5)
  minConfidence: number;      // 0.30–0.90 (default 0.50)
  minAmplitude: number;      // 1–10 (default 5)
  bands: AccuracyBand[];
}

const DEFAULT_BANDS: AccuracyBand[] = [
  { threshold: 0,   band: 100, color: '#3fb950' },
  { threshold: 10,  band: 90,  color: '#58a6ff' },
  { threshold: 25,  band: 75,  color: '#2dd4bf' },
  { threshold: 50,  band: 50,  color: '#d29922' },
  { threshold: 999, band: 0,  color: '#f85149' },
];

const DEFAULT_SETTINGS: SettingsConfig = {
  detectionThreshold: 0.10,
  sensitivity: 5,
  minConfidence: 0.50,
  minAmplitude: 5,
  bands: DEFAULT_BANDS,
};

const [settings, setSettings] = createSignal<SettingsConfig>(DEFAULT_SETTINGS);

function loadSettingsFromStorage(): SettingsConfig {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? JSON.parse(raw) : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function saveSettingsToStorage(data: SettingsConfig): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('Failed to save settings:', e);
  }
}

export function initSettings(): void {
  setSettings(loadSettingsFromStorage());
}

export function setDetectionThreshold(value: number): void {
  setSettings((s) => {
    const updated = { ...s, detectionThreshold: Math.max(0.05, Math.min(0.20, value)) };
    saveSettingsToStorage(updated);
    return updated;
  });
}

export function setSensitivity(value: number): void {
  setSettings((s) => {
    const updated = { ...s, sensitivity: Math.max(1, Math.min(10, value)) };
    saveSettingsToStorage(updated);
    return updated;
  });
}

export function setMinConfidence(value: number): void {
  setSettings((s) => {
    const updated = { ...s, minConfidence: Math.max(0.30, Math.min(0.90, value)) };
    saveSettingsToStorage(updated);
    return updated;
  });
}

export function setMinAmplitude(value: number): void {
  setSettings((s) => {
    const updated = { ...s, minAmplitude: Math.max(1, Math.min(10, value)) };
    saveSettingsToStorage(updated);
    return updated;
  });
}

export function setBand(index: number, threshold: number): void {
  setSettings((s) => {
    const bands = [...s.bands];
    // Keep sorted by threshold
    bands[index] = { ...bands[index], threshold };
    bands.sort((a, b) => a.threshold - b.threshold);
    const updated = { ...s, bands };
    saveSettingsToStorage(updated);
    return updated;
  });
}

export function getBandRating(avgCents: number | null): number {
  const currentBands = settings().bands;
  if (avgCents === null) return 0;
  for (const b of currentBands) {
    if (avgCents <= b.threshold) return b.band;
  }
  return 0;
}

// ── Presets ──────────────────────────────────────────────────

const PRESETS_KEY = 'pitchperfect_presets';
const LAST_PRESET_KEY = 'pitchperfect_lastpreset';
const SELECTED_PRESET_KEY = 'pitchperfect_selected_preset';

export interface PresetData {
  notes: Array<{ midi: number; startBeat: number; duration: number; effectType?: string; linkedTo?: number[] }>;
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

export function getPresets(): PresetsStore {
  return presets();
}

export function getCurrentPresetName(): string | null {
  return currentPresetName();
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

// ── Session History ──────────────────────────────────────────

export interface SessionHistoryEntry {
  id: number;
  timestamp: number;
  score: number;
  avgCents: number;
  noteCount: number;
  noteResults: Array<{ midi: number; avgCents: number; rating: string }>;
}

const SESSION_HISTORY_KEY = 'pitchperfect_session_history';
const MAX_HISTORY_ENTRIES = 50;

const [sessionHistory, setSessionHistory] = createStore<SessionHistoryEntry[]>([]);

function loadSessionHistory(): SessionHistoryEntry[] {
  try {
    const raw = localStorage.getItem(SESSION_HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveSessionHistoryToStorage(data: SessionHistoryEntry[]): void {
  try {
    localStorage.setItem(SESSION_HISTORY_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('Failed to save session history:', e);
  }
}

export function initSessionHistory(): void {
  setSessionHistory(loadSessionHistory());
}

export function saveSession(entry: Omit<SessionHistoryEntry, 'id' | 'timestamp'>): void {
  const id = Date.now();
  const newEntry: SessionHistoryEntry = { ...entry, id, timestamp: Date.now() };
  const updated = [newEntry, ...sessionHistory].slice(0, MAX_HISTORY_ENTRIES);
  setSessionHistory(updated);
  saveSessionHistoryToStorage(updated);
}

export function clearSessionHistory(): void {
  setSessionHistory([]);
  localStorage.removeItem(SESSION_HISTORY_KEY);
}

export function getSessionHistory(): SessionHistoryEntry[] {
  return sessionHistory;
}

// Compute per-note accuracy map from session history (midi -> avg score %)
export function getNoteAccuracyMap(): Map<number, number> {
  const accMap = new Map<number, number[]>();
  for (const entry of sessionHistory) {
    for (const nr of entry.noteResults) {
      if (!accMap.has(nr.midi)) accMap.set(nr.midi, []);
      accMap.get(nr.midi)!.push(nr.avgCents >= -5 ? 100 : Math.max(0, 100 - Math.abs(nr.avgCents) * 5));
    }
  }
  const result = new Map<number, number>();
  for (const [midi, scores] of accMap) {
    result.set(midi, Math.round(scores.reduce((a, b) => a + b, 0) / scores.length));
  }
  return result;
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

  // Grid
  gridLinesVisible,
  toggleGridLines,
  setGridLines,

  // Notifications
  notifications,
  showNotification,

  // Session History
  sessionHistory,
  initSessionHistory,
  saveSession,
  clearSessionHistory,
  getSessionHistory,
  getNoteAccuracyMap,

  // Presets
  presets,
  currentPresetName,
  setCurrentPresetName,
  initPresets,
  savePreset,
  loadPreset,
  getPresetNames,
  deletePreset,

  // Settings
  settings,
  initSettings,
  setDetectionThreshold,
  setSensitivity,
  setMinConfidence,
  setMinAmplitude,
  setBand,
  getBandRating,
};
