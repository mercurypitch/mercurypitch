// ============================================================
// Shareable URL — Encode/decode preset data in URL query params
// ============================================================

import type { MelodyItem, ScaleDefinition, NoteName } from '@/types';
import { midiToNote } from '@/lib/scale-data';

export interface SharedPreset {
  /** Comma-separated note data: midi.startBeat.duration,midi.startBeat.duration,... */
  n: string;
  /** BPM */
  bpm?: number;
  /** Key name (C, G, D, etc.) */
  k?: string;
  /** Scale type */
  s?: string;
  /** Total beats */
  beats?: number;
}

/**
 * Encode melody data into a compact URL parameter string.
 * Format: `n=m60s0d2,m64s2d2` using 'm'/s/d prefixes to avoid decimal conflicts
 */
export function encodeMelodyToURL(melody: MelodyItem[], bpm?: number, key?: string, scaleType?: string, totalBeats?: number): string {
  const params = new URLSearchParams();

  // Encode notes using prefixes to avoid decimal conflicts
  // Format: m{midi}s{startBeat}d{duration}
  const noteStr = melody
    .map((item) => {
      // Use Math.round to ensure clean numbers, avoid decimal point issues
      const start = Math.round(item.startBeat * 10) / 10;
      const dur = Math.round(item.duration * 10) / 10;
      return `m${item.note.midi}s${start}d${dur}`;
    })
    .join(',');

  params.set('n', noteStr);

  if (bpm) params.set('bpm', String(bpm));
  if (key) params.set('k', key);
  if (scaleType) params.set('s', scaleType);
  if (totalBeats) params.set('beats', String(totalBeats));

  return params.toString();
}

/**
 * Decode melody data from URL parameters.
 * Expects format: m{midi}s{startBeat}d{duration}
 */
export function decodeMelodyFromURL(params: URLSearchParams): {
  melody: MelodyItem[];
  bpm?: number;
  key?: string;
  scaleType?: string;
  totalBeats?: number;
} | null {
  const noteStr = params.get('n');
  if (!noteStr) return null;

  try {
    const melody: MelodyItem[] = [];
    const notes = noteStr.split(',');

    for (const note of notes) {
      // Parse format: m{midi}s{startBeat}d{duration}
      // e.g., m60s0d2, m64s2d2
      const midiMatch = note.match(/^m(\d+)s([\d.]+)d([\d.]+)$/);
      if (!midiMatch) continue;

      const midi = parseInt(midiMatch[1], 10);
      const startBeat = parseFloat(midiMatch[2]);
      const duration = parseFloat(midiMatch[3]);

      if (isNaN(midi) || isNaN(startBeat) || isNaN(duration)) continue;

      // Basic validation
      if (midi < 21 || midi > 108) continue; // Piano range
      if (startBeat < 0 || duration <= 0) continue;

      // Decode note name from MIDI
      const noteInfo = midiToNote(midi);
      melody.push({
        id: melody.length + 1,
        note: { midi, name: noteInfo.name as NoteName, octave: noteInfo.octave, freq: 0 },
        startBeat,
        duration,
      });
    }

    if (melody.length === 0) return null;

    return {
      melody,
      bpm: params.has('bpm') ? parseInt(params.get('bpm')!, 10) : undefined,
      key: params.get('k') || undefined,
      scaleType: params.get('s') || undefined,
      totalBeats: params.has('beats') ? parseInt(params.get('beats')!, 10) : undefined,
    };
  } catch {
    return null;
  }
}

/**
 * Generate a shareable URL for the current preset.
 */
export function generateShareURL(melody: MelodyItem[], bpm?: number, key?: string, scaleType?: string, totalBeats?: number): string {
  const query = encodeMelodyToURL(melody, bpm, key, scaleType, totalBeats);
  const base = window.location.origin + window.location.pathname;
  return `${base}?${query}`;
}

/**
 * Read preset data from current URL and return decoded melody.
 */
export function loadFromURL(): {
  melody: MelodyItem[];
  bpm?: number;
  key?: string;
  scaleType?: string;
  totalBeats?: number;
} | null {
  const params = new URLSearchParams(window.location.search);
  return decodeMelodyFromURL(params);
}

/**
 * Update the URL with current preset data without triggering navigation.
 */
export function updateURL(melody: MelodyItem[], bpm?: number, key?: string, scaleType?: string, totalBeats?: number): void {
  const query = encodeMelodyToURL(melody, bpm, key, scaleType, totalBeats);
  const newURL = `${window.location.pathname}?${query}`;
  window.history.replaceState({}, '', newURL);
}

/**
 * Copy share URL to clipboard and return success status.
 */
export async function copyShareURL(melody: MelodyItem[], bpm?: number, key?: string, scaleType?: string, totalBeats?: number): Promise<boolean> {
  const url = generateShareURL(melody, bpm, key, scaleType, totalBeats);
  try {
    await navigator.clipboard.writeText(url);
    return true;
  } catch {
    // Fallback for older browsers
    const textarea = document.createElement('textarea');
    textarea.value = url;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand('copy');
      document.body.removeChild(textarea);
      return true;
    } catch {
      document.body.removeChild(textarea);
      return false;
    }
  }
}

/**
 * Check if current URL contains shareable preset data.
 */
export function hasSharedPresetInURL(): boolean {
  const params = new URLSearchParams(window.location.search);
  return params.has('n');
}