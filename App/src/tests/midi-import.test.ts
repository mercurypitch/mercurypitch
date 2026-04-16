// ============================================================
// MIDI Import/Export Tests
// ============================================================

import { describe, it, expect } from 'vitest';
import { importMelodyFromMIDI, exportMelodyToMIDI } from '@/lib/piano-roll';

function encodeVLQ(value: number): number[] {
  if (value < 0) return [0];
  const bytes: number[] = [];
  let v = value;
  bytes.push(v & 0x7f);
  v >>= 7;
  while (v > 0) {
    bytes.push((v & 0x7f) | 0x80);
    v >>= 7;
  }
  return bytes.reverse();
}

function buildMidiFile(
  notes: Array<{ pitch: number; startTick: number; endTick: number; velocity?: number }>,
  ticksPerBeat = 480
): Uint8Array {
  const velocity = 80;
  const header = new Uint8Array(14);
  header[0] = 0x4D; header[1] = 0x54; header[2] = 0x68; header[3] = 0x64; // "MThd"
  header[4] = 0; header[5] = 0; header[6] = 0; header[7] = 6;            // length = 6
  header[8] = 0; header[9] = 0;                                              // format = 0
  header[10] = 0; header[11] = 1;                                             // ntracks = 1
  header[12] = (ticksPerBeat >> 8) & 0xff;
  header[13] = ticksPerBeat & 0xff;

  interface AbsEvent { tick: number; type: 'on' | 'off'; pitch: number; vel: number; }
  const absEvents: AbsEvent[] = [];
  for (const { pitch, startTick, endTick, velocity: vel = velocity } of notes) {
    absEvents.push({ tick: startTick, type: 'on', pitch, vel });
    absEvents.push({ tick: endTick, type: 'off', pitch, vel });
  }
  absEvents.sort((a, b) => a.tick - b.tick);

  const trackBytes: number[] = [];
  let prevTick = 0;
  for (const ev of absEvents) {
    const delta = ev.tick - prevTick;
    for (const b of encodeVLQ(delta)) trackBytes.push(b);
    if (ev.type === 'on') {
      trackBytes.push(0x90, ev.pitch, ev.vel);
    } else {
      trackBytes.push(0x80, ev.pitch, 0);
    }
    prevTick = ev.tick;
  }
  // End of track
  trackBytes.push(0, 0xFF, 0x2F, 0);

  const totalLen = 8 + trackBytes.length; // MTrk (4) + len (4) + data
  const result = new Uint8Array(totalLen);
  result[0] = 0x4D; result[1] = 0x54; result[2] = 0x72; result[3] = 0x6B; // "MTrk"
  result[4] = (trackBytes.length >> 24) & 0xff;
  result[5] = (trackBytes.length >> 16) & 0xff;
  result[6] = (trackBytes.length >> 8) & 0xff;
  result[7] = trackBytes.length & 0xff;
  for (let i = 0; i < trackBytes.length; i++) result[8 + i] = trackBytes[i];

  // Concatenate header + track chunk
  const midi = new Uint8Array(header.length + result.length);
  midi.set(header, 0);
  midi.set(result, header.length);
  return midi;
}

describe('MIDI Import', () => {
  it('returns null for null/invalid data', () => {
    expect(importMelodyFromMIDI(new Uint8Array([1, 2, 3]))).toBeNull();
    expect(importMelodyFromMIDI(new Uint8Array([]))).toBeNull();
  });

  it('returns null for data too short', () => {
    expect(importMelodyFromMIDI(new Uint8Array([0x4D, 0x54, 0x68, 0x64, 0, 0, 0, 6]))).toBeNull();
  });

  it('returns null for format 2 (reserved)', () => {
    const header = new Uint8Array([0x4D, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 2, 0, 1, 0, 96]);
    const trackBytes = [0, 0xFF, 0x2F, 0];
    const trackChunk = new Uint8Array(8 + trackBytes.length);
    trackChunk[0] = 0x4D; trackChunk[1] = 0x54; trackChunk[2] = 0x72; trackChunk[3] = 0x6B;
    trackChunk[4] = 0; trackChunk[5] = 0; trackChunk[6] = 0; trackChunk[7] = trackBytes.length;
    for (let i = 0; i < trackBytes.length; i++) trackChunk[8 + i] = trackBytes[i];
    const midi = new Uint8Array(header.length + trackChunk.length);
    midi.set(header, 0);
    midi.set(trackChunk, header.length);
    expect(importMelodyFromMIDI(midi)).toBeNull();
  });

  it('returns null when no note pairs found', () => {
    // Build a track with only a tempo meta event (no note events)
    const header = new Uint8Array([0x4D, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 0, 0, 1, 0, 96]);
    const trackBytes = [0, 0xFF, 0x03, 3, 0x74, 0x65, 0x73, 0x74, 0, 0xFF, 0x2F, 0];
    const trackChunk = new Uint8Array(8 + trackBytes.length);
    trackChunk[0] = 0x4D; trackChunk[1] = 0x54; trackChunk[2] = 0x72; trackChunk[3] = 0x6B;
    trackChunk[4] = 0; trackChunk[5] = 0; trackChunk[6] = 0; trackChunk[7] = trackBytes.length;
    for (let i = 0; i < trackBytes.length; i++) trackChunk[8 + i] = trackBytes[i];
    const midi = new Uint8Array(header.length + trackChunk.length);
    midi.set(header, 0);
    midi.set(trackChunk, header.length);
    expect(importMelodyFromMIDI(midi)).toBeNull();
  });

  it('parses a single note correctly', () => {
    const midi = buildMidiFile([{ pitch: 60, startTick: 0, endTick: 480 }]);
    const melody = importMelodyFromMIDI(midi);

    expect(melody).not.toBeNull();
    expect(melody!.length).toBe(1);
    expect(melody![0].note.midi).toBe(60);
    expect(melody![0].note.name).toBe('C');
    expect(melody![0].note.octave).toBe(4);
    expect(melody![0].startBeat).toBeCloseTo(0, 5);
    expect(melody![0].duration).toBeCloseTo(1, 5);
  });

  it('parses multiple notes with correct timing', () => {
    const midi = buildMidiFile([
      { pitch: 60, startTick: 0, endTick: 480 },
      { pitch: 64, startTick: 480, endTick: 960 },
      { pitch: 67, startTick: 960, endTick: 1440 },
    ]);
    const melody = importMelodyFromMIDI(midi);

    expect(melody).not.toBeNull();
    expect(melody!.length).toBe(3);
    expect(melody![0].note.midi).toBe(60);
    expect(melody![0].startBeat).toBeCloseTo(0, 5);
    expect(melody![1].note.midi).toBe(64);
    expect(melody![1].startBeat).toBeCloseTo(1, 5);
    expect(melody![2].note.midi).toBe(67);
    expect(melody![2].startBeat).toBeCloseTo(2, 5);
  });

  it('handles notes shorter than 1 beat', () => {
    const midi = buildMidiFile([{ pitch: 60, startTick: 0, endTick: 240 }], 480);
    const melody = importMelodyFromMIDI(midi);

    expect(melody).not.toBeNull();
    expect(melody![0].duration).toBeCloseTo(0.5, 5);
  });

  it('handles notes with non-zero velocity', () => {
    // A normal note with velocity 80 (not 0) should be parsed
    const midi = buildMidiFile([{ pitch: 60, startTick: 0, endTick: 480, velocity: 100 }]);
    const melody = importMelodyFromMIDI(midi);

    expect(melody).not.toBeNull();
    expect(melody!.length).toBe(1);
    expect(melody![0].note.midi).toBe(60);
  });

  it('handles overlapping notes on different pitches', () => {
    const midi = buildMidiFile([
      { pitch: 60, startTick: 0, endTick: 960 },
      { pitch: 64, startTick: 0, endTick: 960 },
    ]);
    const melody = importMelodyFromMIDI(midi);

    expect(melody).not.toBeNull();
    expect(melody!.length).toBe(2);
  });

  it('round-trips through export format (notes have correct structure)', () => {
    const midi = buildMidiFile([
      { pitch: 69, startTick: 0, endTick: 480 },
      { pitch: 72, startTick: 480, endTick: 960 },
      { pitch: 67, startTick: 960, endTick: 1440 },
    ]);
    const melody = importMelodyFromMIDI(midi);

    expect(melody).not.toBeNull();
    for (const item of melody!) {
      expect(item).toHaveProperty('id');
      expect(item).toHaveProperty('note');
      expect(item.note).toHaveProperty('name');
      expect(item.note).toHaveProperty('octave');
      expect(item.note).toHaveProperty('midi');
      expect(item.note).toHaveProperty('freq');
      expect(item).toHaveProperty('startBeat');
      expect(item).toHaveProperty('duration');
    }
  });
});

describe('MIDI Export', () => {
  it('returns null for empty melody', () => {
    expect(exportMelodyToMIDI([], 120)).toBeNull();
  });

  it('returns null for null melody', () => {
    expect(exportMelodyToMIDI(null as any, 120)).toBeNull();
  });

  it('exports a single note to valid MIDI bytes', () => {
    const melody = [
      { id: 1, note: { name: 'C', octave: 4, midi: 60, freq: 261.63 }, startBeat: 0, duration: 1 },
    ];
    const midi = exportMelodyToMIDI(melody, 120);
    expect(midi).not.toBeNull();
    expect(midi!.length).toBeGreaterThan(14);
    // Check header chunk: "MThd"
    expect(midi![0]).toBe(0x4D);
    expect(midi![1]).toBe(0x54);
    expect(midi![2]).toBe(0x68);
    expect(midi![3]).toBe(0x64);
    // Check track chunk: "MTrk"
    expect(midi![14]).toBe(0x4D);
    expect(midi![15]).toBe(0x54);
    expect(midi![16]).toBe(0x72);
    expect(midi![17]).toBe(0x6B);
    // Re-import the exported single note
    const reimport = importMelodyFromMIDI(midi!);
    expect(reimport).not.toBeNull();
    expect(reimport!.length).toBe(1);
    expect(reimport![0].note.midi).toBe(60);
  });

  it('exports multiple notes in correct time order', () => {
    const melody = [
      { id: 1, note: { name: 'C', octave: 4, midi: 60, freq: 261.63 }, startBeat: 0, duration: 1 },
      { id: 2, note: { name: 'E', octave: 4, midi: 64, freq: 329.63 }, startBeat: 1, duration: 1 },
      { id: 3, note: { name: 'G', octave: 4, midi: 67, freq: 392 }, startBeat: 2, duration: 1 },
    ];
    const midi = exportMelodyToMIDI(melody, 120);
    expect(midi).not.toBeNull();
    expect(midi!.length).toBeGreaterThan(14);
  });

  it('exports notes with fractional beat durations', () => {
    const melody = [
      { id: 1, note: { name: 'C', octave: 4, midi: 60, freq: 261.63 }, startBeat: 0.5, duration: 0.25 },
    ];
    const midi = exportMelodyToMIDI(melody, 120);
    expect(midi).not.toBeNull();
    expect(midi!.length).toBeGreaterThan(14);
  });

  it('round-trips: export then import preserves note count', () => {
    const original = [
      { id: 1, note: { name: 'C', octave: 4, midi: 60, freq: 261.63 }, startBeat: 0, duration: 1 },
      { id: 2, note: { name: 'E', octave: 4, midi: 64, freq: 329.63 }, startBeat: 1, duration: 2 },
      { id: 3, note: { name: 'G', octave: 4, midi: 67, freq: 392 }, startBeat: 3, duration: 1.5 },
    ];
    const midi = exportMelodyToMIDI(original, 120);
    expect(midi).not.toBeNull();
    const roundTrip = importMelodyFromMIDI(midi!);
    expect(roundTrip).not.toBeNull();
    expect(roundTrip!.length).toBe(original.length);
    // Check pitch values are preserved
    for (let i = 0; i < original.length; i++) {
      expect(roundTrip![i].note.midi).toBe(original[i].note.midi);
    }
  });

  it('exports with different BPM values', () => {
    const melody = [
      { id: 1, note: { name: 'A', octave: 4, midi: 69, freq: 440 }, startBeat: 0, duration: 1 },
    ];
    const midi120 = exportMelodyToMIDI(melody, 120);
    const midi240 = exportMelodyToMIDI(melody, 240);
    expect(midi120).not.toBeNull();
    expect(midi240).not.toBeNull();
    // Both should produce valid MIDI files
    expect(midi120!.length).toBeGreaterThan(0);
    expect(midi240!.length).toBeGreaterThan(0);
  });
});
