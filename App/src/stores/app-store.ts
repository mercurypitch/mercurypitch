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

// ── Practice ────────────────────────────────────────────────

const [practiceCount, setPracticeCount] = createSignal<number>(0);
const [lastScore, setLastScore] = createSignal<number | null>(null);

// ── Active tab ───────────────────────────────────────────────

export type ActiveTab = 'practice' | 'editor' | 'about';
const [activeTab, setActiveTab] = createSignal<ActiveTab>('practice');

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

  // Navigation
  activeTab,
  setActiveTab,

  // Notifications
  notifications,
  showNotification,
};
