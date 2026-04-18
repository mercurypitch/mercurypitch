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

// ── Theme ────────────────────────────────────────────────────

export type ThemeMode = 'dark' | 'light';

const THEME_KEY = 'pitchperfect_theme';

function loadThemeFromStorage(): ThemeMode {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {}
  return 'dark'; // default to dark
}

const [theme, setThemeInternal] = createSignal<ThemeMode>(loadThemeFromStorage());

export function setTheme(mode: ThemeMode): void {
  setThemeInternal(mode);
  try {
    localStorage.setItem(THEME_KEY, mode);
  } catch {}
  // Apply theme to document
  document.documentElement.setAttribute('data-theme', mode);
  window.dispatchEvent(new CustomEvent('pitchperfect:themeChange', { detail: { theme: mode } }));
}

export function toggleTheme(): void {
  const next = theme() === 'dark' ? 'light' : 'dark';
  setTheme(next);
}

export function initTheme(): void {
  document.documentElement.setAttribute('data-theme', theme());
}

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
export const activeTab = createSignal<ActiveTab>('practice')[0];
export { setActiveTab as setActiveTab };

// ── Focus Mode ─────────────────────────────────────────────────
const [focusMode, setFocusMode] = createSignal(false);
export function enterFocusMode(): void { setFocusMode(true); }
export function exitFocusMode(): void { setFocusMode(false); }

// ── Welcome Screen (GH #131) ────────────────────────────────────
const WELCOME_KEY = 'pitchperfect_welcome_version';
const APP_VERSION = '0.1';

function shouldShowWelcome(): boolean {
  try {
    const shown = localStorage.getItem(WELCOME_KEY);
    // Show welcome on first visit or if version changed
    return shown !== APP_VERSION;
  } catch { return true; }
}

const [showWelcome, setShowWelcome] = createSignal(shouldShowWelcome());

export function dismissWelcome(): void {
  setShowWelcome(false);
  try {
    localStorage.setItem(WELCOME_KEY, APP_VERSION);
  } catch {}
}

// ── Settings ───────────────────────────────────────────────────

const SETTINGS_KEY = 'pitchperfect_settings';

export interface SettingsConfig {
  detectionThreshold: number; // 0.05–0.20 (default 0.10)
  sensitivity: number;        // 1–10 (default 5)
  minConfidence: number;      // 0.30–0.90 (default 0.50)
  minAmplitude: number;      // 1–10 (default 5)
  bands: AccuracyBand[];
  tonicAnchor: boolean;       // Play tonic reference tone before each run
}

const DEFAULT_BANDS: AccuracyBand[] = [
  { threshold: 0,   band: 100, color: '#3fb950' },
  { threshold: 10,  band: 90,  color: '#58a6ff' },
  { threshold: 25,  band: 75,  color: '#2dd4bf' },
  { threshold: 50,  band: 50,  color: '#d29922' },
  { threshold: 999, band: 0,  color: '#f85149' },
];

// ── Sensitivity Presets (UX feature) ─────────────────────────

export type SensitivityPreset = 'quiet' | 'home' | 'noisy';
export const SENSITIVITY_PRESETS: Record<SensitivityPreset, SettingsConfig> = {
  quiet: {
    detectionThreshold: 0.05,
    sensitivity: 9,
    minConfidence: 0.30,
    minAmplitude: 1,
    bands: DEFAULT_BANDS,
    tonicAnchor: false,
  },
  home: {
    detectionThreshold: 0.10,
    sensitivity: 5,
    minConfidence: 0.50,
    minAmplitude: 3,
    bands: DEFAULT_BANDS,
    tonicAnchor: false,
  },
  noisy: {
    detectionThreshold: 0.15,
    sensitivity: 8,
    minConfidence: 0.60,
    minAmplitude: 5,
    bands: DEFAULT_BANDS,
    tonicAnchor: false,
  },
};

const SENSITIVITY_PRESET_KEY = 'pitchperfect_sensitivity_preset';

function loadSensitivityPreset(): SensitivityPreset {
  try {
    const stored = localStorage.getItem(SENSITIVITY_PRESET_KEY);
    if (stored === 'quiet' || stored === 'home' || stored === 'noisy') return stored;
  } catch {}
  return 'home'; // default: some noise (home environment)
}

export function applySensitivityPreset(preset: SensitivityPreset): void {
  const config = SENSITIVITY_PRESETS[preset];
  setSettings(config);
  saveSettingsToStorage(config);
  try { localStorage.setItem(SENSITIVITY_PRESET_KEY, preset); } catch {}
  window.dispatchEvent(new CustomEvent('pitchperfect:sensitivityPresetChange', { detail: { preset } }));
}

const DEFAULT_SETTINGS: SettingsConfig = {
  detectionThreshold: 0.10,
  sensitivity: 5,
  minConfidence: 0.30,
  minAmplitude: 1,
  bands: DEFAULT_BANDS,
  tonicAnchor: false,
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

export function setTonicAnchor(enabled: boolean): void {
  setSettings((s) => {
    const updated = { ...s, tonicAnchor: enabled };
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

/** Reset presets signal (used by tests) */
export function _resetPresets(): void {
  setPresets({});
  setCurrentPresetName(null);
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

// ── ADSR Envelope ─────────────────────────────────────────────

export interface ADSRConfig {
  attack: number;  // 0–1000 ms (default 10)
  decay: number;    // 0–1000 ms (default 100)
  sustain: number;  // 0–100 (percentage, default 70)
  release: number;  // 0–2000 ms (default 200)
}

const ADSR_KEY = 'pitchperfect_adsr';
const DEFAULT_ADSR: ADSRConfig = {
  attack: 10,
  decay: 100,
  sustain: 70,
  release: 200,
};

function loadADSRFromStorage(): ADSRConfig {
  try {
    const raw = localStorage.getItem(ADSR_KEY);
    return raw ? JSON.parse(raw) : DEFAULT_ADSR;
  } catch {
    return DEFAULT_ADSR;
  }
}

const [adsr, setAdsr] = createSignal<ADSRConfig>(loadADSRFromStorage());

function saveADSRToStorage(data: ADSRConfig): void {
  try {
    localStorage.setItem(ADSR_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('Failed to save ADSR settings:', e);
  }
}

export function initADSR(): void {
  setAdsr(loadADSRFromStorage());
}

export function setAttack(value: number): void {
  setAdsr((a) => {
    const updated = { ...a, attack: Math.max(0, Math.min(1000, value)) };
    saveADSRToStorage(updated);
    return updated;
  });
}

export function setDecay(value: number): void {
  setAdsr((a) => {
    const updated = { ...a, decay: Math.max(0, Math.min(1000, value)) };
    saveADSRToStorage(updated);
    return updated;
  });
}

export function setSustain(value: number): void {
  setAdsr((a) => {
    const updated = { ...a, sustain: Math.max(0, Math.min(100, value)) };
    saveADSRToStorage(updated);
    return updated;
  });
}

export function setRelease(value: number): void {
  setAdsr((a) => {
    const updated = { ...a, release: Math.max(0, Math.min(2000, value)) };
    saveADSRToStorage(updated);
    return updated;
  });
}

// ── Reverb / Effects ────────────────────────────────────────

export type ReverbType = 'off' | 'room' | 'hall' | 'cathedral';

export interface ReverbConfig {
  wetness: number;   // 0–100 (percentage)
  type: ReverbType;
}

const REVERB_KEY = 'pitchperfect_reverb';
const DEFAULT_REVERB: ReverbConfig = {
  wetness: 30,
  type: 'room',
};

function loadReverbFromStorage(): ReverbConfig {
  try {
    const raw = localStorage.getItem(REVERB_KEY);
    return raw ? JSON.parse(raw) : DEFAULT_REVERB;
  } catch {
    return DEFAULT_REVERB;
  }
}

const [reverbConfig, setReverbConfigSignal] = createSignal<ReverbConfig>(loadReverbFromStorage());

function saveReverbToStorage(data: ReverbConfig): void {
  try {
    localStorage.setItem(REVERB_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('Failed to save reverb settings:', e);
  }
}

export function initReverb(): void {
  setReverbConfigSignal(loadReverbFromStorage());
}

export function setReverbWetness(value: number): void {
  setReverbConfigSignal((c) => {
    const updated = { ...c, wetness: Math.max(0, Math.min(100, value)) };
    saveReverbToStorage(updated);
    return updated;
  });
}

export function setReverbType(type: ReverbType): void {
  setReverbConfigSignal((c) => {
    const updated = { ...c, type };
    saveReverbToStorage(updated);
    return updated;
  });
}

// ── Playback Speed ──────────────────────────────────────────

const PLAYBACK_SPEED_KEY = 'pitchperfect_playback_speed';
const [playbackSpeed, setPlaybackSpeedSignal] = createSignal<number>(1.0);

function loadPlaybackSpeed(): number {
  try {
    const stored = localStorage.getItem(PLAYBACK_SPEED_KEY);
    if (stored) {
      const speed = parseFloat(stored);
      if (!isNaN(speed) && speed >= 0.25 && speed <= 2.0) return speed;
    }
  } catch {}
  return 1.0;
}

export function initPlaybackSpeed(): void {
  setPlaybackSpeedSignal(loadPlaybackSpeed());
}

export function setPlaybackSpeed(speed: number): void {
  const clamped = Math.max(0.25, Math.min(2.0, speed));
  setPlaybackSpeedSignal(clamped);
  try {
    localStorage.setItem(PLAYBACK_SPEED_KEY, String(clamped));
  } catch {}
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

// ── Session Results (reactive store for sidebar) ───────────────

import type { PracticeSession, SessionResult } from '@/types';
const [sessionResultsStore, setSessionResultsStore] = createStore<SessionResult[]>([]);

// ── Practice Session State ────────────────────────────────────

const [practiceSession, setPracticeSession] = createSignal<PracticeSession | null>(null);
const [sessionItemIndex, setSessionItemIndex] = createSignal(0);
const [sessionItemRepeat, setSessionItemRepeat] = createSignal(0); // how many times current item has repeated
const [sessionActive, setSessionActive] = createSignal(false);
const [sessionResults, setSessionResults] = createSignal<{ score: number }[]>([]);
const [sessionMode, setSessionMode] = createSignal(false); // true when in session flow

const SESSION_RESULTS_KEY = 'pitchperfect_session_results';

function loadSessionResults(): SessionResult[] {
  try {
    const raw = localStorage.getItem(SESSION_RESULTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveSessionResultsToStorage(data: SessionResult[]): void {
  try {
    localStorage.setItem(SESSION_RESULTS_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('Failed to save session results:', e);
  }
}

export function initSessionHistory(): void {
  setSessionHistory(loadSessionHistory());
  // Also load session results into reactive store
  setSessionResultsStore(loadSessionResults().slice(0, 5));
}

export function startPracticeSession(session: PracticeSession): void {
  setPracticeSession(session);
  setSessionItemIndex(0);
  setSessionItemRepeat(0);
  setSessionActive(true);
  setSessionMode(true);
  setSessionResults([]);
}

export function getCurrentSessionItem(): PracticeSession['items'][0] | null {
  const session = practiceSession();
  if (!session) return null;
  const idx = sessionItemIndex();
  if (idx < 0 || idx >= session.items.length) return null;
  return session.items[idx];
}

export function advanceSessionItem(): void {
  const session = practiceSession();
  if (!session) return;
  const currentItem = getCurrentSessionItem();
  const repeatCount = currentItem?.repeat ?? 1;
  const currentRepeat = sessionItemRepeat();
  if (currentRepeat < repeatCount - 1) {
    // Repeat this item
    setSessionItemRepeat(currentRepeat + 1);
  } else {
    // Move to next item
    const next = sessionItemIndex() + 1;
    if (next < session.items.length) {
      setSessionItemIndex(next);
      setSessionItemRepeat(0);
    }
  }
}

export function recordSessionItemResult(score: number): void {
  setSessionResults((prev) => [...prev, { score }]);
}

export function endPracticeSession(): SessionResult | null {
  const session = practiceSession();
  if (!session) return null;

  const scores = sessionResults();
  const totalScore = scores.length > 0
    ? Math.round(scores.reduce((s, r) => s + r.score, 0) / scores.length)
    : 0;

  const result: SessionResult = {
    sessionId: session.id,
    sessionName: session.name,
    completedAt: Date.now(),
    itemsCompleted: scores.length,
    totalItems: session.items.length,
    score: totalScore,
  };

  // Persist to localStorage
  const existing = loadSessionResults();
  saveSessionResultsToStorage([result, ...existing].slice(0, 50));

  // Update reactive store for sidebar display
  setSessionResultsStore([result, ...sessionResultsStore].slice(0, 5));

  setSessionActive(false);
  setPracticeSession(null);
  setSessionItemIndex(0);
  setSessionItemRepeat(0);
  setSessionMode(false);
  setSessionResults([]);

  return result;
}

export function isInSessionMode(): boolean {
  return sessionMode();
}

export function getSessionHistoryEntries(): SessionResult[] {
  return loadSessionResults();
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

  // Focus Mode
  focusMode,
  enterFocusMode,
  exitFocusMode,

  // Welcome Screen
  showWelcome,
  dismissWelcome,

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
  _resetPresets,

  // Settings
  settings,
  initSettings,
  setDetectionThreshold,
  setSensitivity,
  setMinConfidence,
  setMinAmplitude,
  setTonicAnchor,
  setBand,
  getBandRating,

  // Sensitivity Presets
  SENSITIVITY_PRESETS,
  applySensitivityPreset,
  sensitivityPreset: createSignal(loadSensitivityPreset()),

  // Theme
  theme,
  setTheme,
  toggleTheme,
  initTheme,

  // ADSR Envelope
  adsr,
  initADSR,
  setAttack,
  setDecay,
  setSustain,
  setRelease,

  // Reverb / Effects
  reverb: reverbConfig,
  initReverb,
  setReverbWetness,
  setReverbType,

  // Playback Speed
  playbackSpeed,
  initPlaybackSpeed,
  setPlaybackSpeed,

  // Session Results
  sessionResultsStore,

  // Session state (signals)
  sessionActive,
  sessionItemIndex,
  sessionItemRepeat,
  practiceSession,
  sessionResults,
  sessionMode,
  getCurrentSessionItem,
  startPracticeSession,
  advanceSessionItem,
  recordSessionItemResult,
  endPracticeSession,
  isInSessionMode,
};
