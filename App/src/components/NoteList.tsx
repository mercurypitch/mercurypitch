// ============================================================
// NoteList — Displays melody notes with accuracy band colors
// ============================================================

import { Component, createMemo, For } from 'solid-js';
import type { MelodyItem, NoteResult } from '@/types';

interface NoteListProps {
  melody: () => MelodyItem[];
  currentNoteIndex: () => number;
  noteResults: () => NoteResult[];
  isPlaying: () => boolean;
}

function centsToBand(avgCents: number): number {
  if (avgCents === null) return 0;
  if (avgCents <= 10) return 100;
  if (avgCents <= 25) return 90;
  if (avgCents <= 50) return 75;
  if (avgCents <= 999) return 50;
  return 0;
}

const BAND_CLASSES: Record<number | 'off', string> = {
  100: 'band-perfect',
  90: 'band-excellent',
  75: 'band-good',
  50: 'band-okay',
  0: 'band-off',
  off: 'band-off',
};

export const NoteList: Component<NoteListProps> = (props) => {
  // Deduplicate notes by MIDI (show each unique note once)
  const uniqueNotes = createMemo(() => {
    const seen = new Map<number, MelodyItem>();
    for (const item of props.melody()) {
      seen.set(item.note.midi, item);
    }
    return Array.from(seen.values());
  });

  // Map MIDI → result band
  const bandMap = createMemo(() => {
    const map = new Map<number, number | 'off'>();
    for (const r of props.noteResults()) {
      const midi = r.targetNote.midi;
      const band = centsToBand(r.avgCents);
      map.set(midi, band);
    }
    return map;
  });

  const getNoteIndex = (midi: number): number => {
    return props.melody().findIndex((item) => item.note.midi === midi);
  };

  return (
    <div id="note-list">
      <For each={uniqueNotes()}>
        {(item) => {
          const midi = item.note.midi;
          const isActive = () => {
            if (!props.isPlaying()) return false;
            const idx = getNoteIndex(midi);
            return idx === props.currentNoteIndex();
          };
          const band = () => bandMap().get(midi);
          const bandCls = () => {
            const b = band();
            return b !== undefined ? BAND_CLASSES[b] : '';
          };

          return (
            <div
              class={`note-item ${isActive() ? 'active' : ''} ${bandCls()}`}
              data-midi={midi}
            >
              <div class="note-dot" />
              <span class="note-name">{item.note.name}{item.note.octave}</span>
              <span class="note-freq">{item.note.freq.toFixed(0)}Hz</span>
            </div>
          );
        }}
      </For>
    </div>
  );
};
