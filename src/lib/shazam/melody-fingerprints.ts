// ============================================================
// Melody Fingerprint Extraction & Indexing (Phase 1)
// Compresses MelodyData into pitch/chroma/interval/rhythm
// sequences optimized for DTW matching.
// ============================================================

import { createSignal } from 'solid-js'
import { getAllStemFingerprintData } from '@/db/services/uvr-service'
import { getAllMelodies } from '@/stores/melody-store'
import type { MelodyData } from '@/types'
import type { FingerprintError, FingerprintIndex, FingerprintResult, MelodyFingerprint, } from './types'

const SECONDS_PER_MINUTE = 60

/** In-memory fingerprint index -- rebuild on app init and library mutations */
let _index: FingerprintIndex = new Map()

/**
 * Reactive version counter. Bumped on every mutation so SolidJS
 * createMemo/createEffect consumers (e.g. the Shazam pill badge)
 * automatically re-evaluate when the index changes.
 */
const [_indexVersion, _bumpVersion] = createSignal(0)
const bumpIndex = () => _bumpVersion((v) => v + 1)

/**
 * Convert beat positions to seconds given a BPM.
 * beat 0 = 0s, beatDuration = 60 / bpm
 */
function beatsToSeconds(beat: number, bpm: number): number {
  return (beat / bpm) * SECONDS_PER_MINUTE
}

/**
 * Extract a melody fingerprint from a single MelodyData object.
 * Filters out rest items — only real notes contribute to the fingerprint.
 */
export function buildFingerprint(
  melody: MelodyData,
): MelodyFingerprint | FingerprintError {
  const notes = melody.items.filter((item) => item.isRest !== true)
  if (notes.length === 0) {
    return {
      melodyId: melody.id,
      name: melody.name,
      reason: 'No playable notes (all rests or empty)',
    }
  }

  const bpm = melody.bpm || 120
  const pitchSequence: number[] = []
  const chromaSequence: number[] = []
  const intervalSequence: number[] = []
  const durations: number[] = []
  const ioiSequence: number[] = []

  let prevStartSec = 0

  for (let i = 0; i < notes.length; i++) {
    const item = notes[i]
    const midi = item.note.midi

    pitchSequence.push(midi)
    chromaSequence.push(midi % 12)

    // Interval from previous note (absolute semitone delta, signed)
    if (i > 0) {
      intervalSequence.push(midi - notes[i - 1].note.midi)
    }

    // Duration in seconds
    const durSec = beatsToSeconds(item.duration, bpm)
    durations.push(durSec)

    // Inter-onset interval from previous note start
    const startSec = beatsToSeconds(item.startBeat, bpm)
    if (i > 0) {
      ioiSequence.push(startSec - prevStartSec)
    }
    prevStartSec = startSec
  }

  const totalBeats =
    notes.length > 0
      ? notes[notes.length - 1].startBeat + notes[notes.length - 1].duration
      : 0
  const durationSec = beatsToSeconds(totalBeats, bpm)

  return {
    melodyId: melody.id,
    name: melody.name,
    pitchSequence,
    ioiSequence,
    durations,
    durationSec,
    noteCount: notes.length,
    chromaSequence,
    intervalSequence,
    bpm,
    key: melody.key || 'C',
  }
}

/**
 * Build the in-memory fingerprint index from all melodies in the store.
 * Call on app init and whenever the melody library changes.
 */
export function buildFingerprintIndex(): FingerprintResult {
  const melodies = getAllMelodies()
  const fingerprints: FingerprintIndex = new Map()
  const errors: FingerprintError[] = []

  for (const melody of melodies) {
    const result = buildFingerprint(melody)
    if ('reason' in result) {
      errors.push(result)
    } else {
      fingerprints.set(melody.id, result)
    }
  }

  _index = fingerprints
  bumpIndex()
  return { fingerprints, errors }
}

/** Get the current fingerprint index. Returns empty map if not yet built. */
export function getFingerprintIndex(): FingerprintIndex {
  return _index
}

/** Get all fingerprints as an array (convenience for matching loops). */
export function getFingerprintArray(): MelodyFingerprint[] {
  // Read version so reactive consumers re-run when index changes
  void _indexVersion()
  return Array.from(_index.values())
}

/** Check if the fingerprint index has been built. */
export function isIndexBuilt(): boolean {
  return _index.size > 0
}

/** Add a single stem fingerprint to the runtime index. Overwrites existing entry for same melodyId. */
export function addStemFingerprint(fp: MelodyFingerprint): void {
  _index.set(fp.melodyId, fp)
  bumpIndex()
}

/** Remove a stem fingerprint from the runtime index by session ID. */
export function removeStemFingerprint(sessionId: string): void {
  _index.delete(`stem:${sessionId}`)
  bumpIndex()
}

/** Check if a stem fingerprint exists in the runtime index by session ID. */
export function hasStemFingerprint(sessionId: string): boolean {
  // Read version so reactive consumers (createMemo) track changes
  void _indexVersion()
  return _index.has(`stem:${sessionId}`)
}

/** Load all persisted stem fingerprints from IndexedDB and add to the runtime index.
 *  Returns the number of fingerprints loaded. */
export async function loadStemFingerprints(): Promise<number> {
  try {
    const fingerprints = await getAllStemFingerprintData()
    for (const fp of fingerprints) {
      _index.set(fp.melodyId, fp)
    }
    if (fingerprints.length > 0) bumpIndex()
    return fingerprints.length
  } catch {
    return 0
  }
}
