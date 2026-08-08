// ============================================================
// Scoring a transcription against a tab
// ============================================================
//
// Shared by `node scripts/transcribe-bench.mjs` and the Lab's transcription
// bench, so a number on screen and a number in a terminal cannot disagree —
// the same arrangement `lrc-compare.ts` has with the mapping differ.
//
// Nothing here touches audio, the DOM or a clock. Given two lists of notes it
// returns how well one describes the other, and that is all.

/** The minimum a note needs for scoring: when it starts and what pitch it is. */
export interface ScorableNote {
  midi: number
  startSeconds: number
}

/**
 * What choosing a reference track needs to know about one.
 *
 * Deliberately only the labels: a Guitar Pro track carries beats and a scored
 * track carries seconds, and requiring notes here would mean converting a
 * whole song just to read its name off.
 */
export interface ReferenceTrackLabels {
  name: string
  instrumentName: string
}

/**
 * Align in windows, not once for the whole song.
 *
 * A tab and a recording of it do not share a clock. Dance of Death's own MIDI
 * export runs 528 s against a 517 s recording — about two percent long, which
 * is eleven seconds of drift by the end. One constant offset cannot fit that,
 * and forcing one does not degrade gracefully: it lands on whatever offset
 * happens to match most, which can be tens of seconds from the truth and makes
 * every number downstream fiction. Windows sidestep the whole question, and a
 * bench does not need a global fit to answer "how did we do around here".
 */
export const WINDOW_SECONDS = 6

/** How far a window is allowed to have slipped against the tab. */
export const MAX_LOCAL_DRIFT_SECONDS = 6

export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((left, right) => left - right)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2
    : (sorted[middle] ?? 0)
}

/**
 * The offset that lines this window up best.
 *
 * Candidates are scored on pitch-class agreement rather than exact pitch, so
 * that an octave error — the thing being measured — cannot drag the alignment
 * off and hide itself in the result.
 */
export function bestWindowOffset(
  heard: readonly ScorableNote[],
  truth: readonly ScorableNote[],
  toleranceSeconds: number,
): number {
  const candidates = new Set([0])
  for (const heardNote of heard) {
    for (const truthNote of truth) {
      const delta = truthNote.startSeconds - heardNote.startSeconds
      if (Math.abs(delta) <= MAX_LOCAL_DRIFT_SECONDS) {
        candidates.add(Math.round(delta * 200) / 200)
      }
    }
  }
  let best = { offset: 0, score: -1 }
  for (const offset of candidates) {
    let score = 0
    for (const heardNote of heard) {
      const at = heardNote.startSeconds + offset
      for (const truthNote of truth) {
        if (Math.abs(truthNote.startSeconds - at) > toleranceSeconds) continue
        if ((truthNote.midi - heardNote.midi) % 12 === 0) {
          score += 1
          break
        }
      }
    }
    if (score > best.score) best = { offset, score }
  }
  return best.offset
}

/** How one heard note was judged, kept per note so the roll can colour it. */
export type NoteVerdict =
  | 'exact'
  | 'octave'
  | 'wrong-pitch'
  /** Heard, with no reference note anywhere near it in time. */
  | 'spurious'

export interface ScoredNote {
  /** Index into the heard list this verdict belongs to. */
  index: number
  verdict: NoteVerdict
  /** Reference pitch it was matched against, null when spurious. */
  truthMidi: number | null
  /** Heard minus reference, in milliseconds after the window's own offset. */
  onsetErrorMs: number | null
}

export interface TranscriptionScore {
  heardCount: number
  truthCount: number
  exact: number
  octaveOff: number
  wrongPitch: number
  /** Heard notes with no reference note near them. */
  unmatched: number
  /** Reference notes nothing was matched to. */
  missed: number
  precision: number
  recall: number
  octaveTolerantPrecision: number
  onsetMedianMs: number | null
  onsetP50Ms: number | null
  onsetP95Ms: number | null
  /** Commonest wrong-pitch intervals, reference minus heard, biggest first. */
  pitchErrors: Array<[number, number]>
  /** How far the per-window offsets spread — large means real drift. */
  windowOffsetSpread: number
  /** Per-heard-note verdicts, so a view can show where the errors are. */
  notes: ScoredNote[]
}

/**
 * Greedy nearest-in-time match inside each window, each reference note used
 * once. Pitch counts as correct only at the exact MIDI number; an octave error
 * gets its own column rather than being folded into "correct", because on a
 * bass line the octave is the part a player notices first.
 */
export function scoreAgainstTruth(
  heardNotes: readonly ScorableNote[],
  truthNotes: readonly ScorableNote[],
  toleranceSeconds: number,
): TranscriptionScore {
  const onsetErrors: number[] = []
  const offsets: number[] = []
  const pitchErrors = new Map<number, number>()
  const notes: ScoredNote[] = []
  let exact = 0
  let octaveOff = 0
  let wrongPitch = 0
  let unmatched = 0
  let matchedTruth = 0

  // Verdicts are addressed by the caller's own index, so a view can line them
  // up with its note list without depending on the order they were scored in.
  const indexOfHeard = new Map<ScorableNote, number>()
  heardNotes.forEach((note, index) => indexOfHeard.set(note, index))

  const lastSecond = Math.max(
    heardNotes.at(-1)?.startSeconds ?? 0,
    truthNotes.at(-1)?.startSeconds ?? 0,
  )

  for (let start = 0; start <= lastSecond; start += WINDOW_SECONDS) {
    const end = start + WINDOW_SECONDS
    const heardWindow = heardNotes.filter(
      (note) => note.startSeconds >= start && note.startSeconds < end,
    )
    if (heardWindow.length === 0) continue
    const truthWindow = truthNotes.filter(
      (note) =>
        note.startSeconds >= start - MAX_LOCAL_DRIFT_SECONDS &&
        note.startSeconds < end + MAX_LOCAL_DRIFT_SECONDS,
    )
    if (truthWindow.length === 0) {
      unmatched += heardWindow.length
      for (const heard of heardWindow) {
        notes.push({
          index: indexOfHeard.get(heard) ?? -1,
          verdict: 'spurious',
          truthMidi: null,
          onsetErrorMs: null,
        })
      }
      continue
    }

    const offset = bestWindowOffset(heardWindow, truthWindow, toleranceSeconds)
    offsets.push(offset)
    const used = new Set<number>()

    for (const heard of heardWindow) {
      const at = heard.startSeconds + offset
      let bestIndex = -1
      let bestGap = Infinity
      for (let index = 0; index < truthWindow.length; index += 1) {
        if (used.has(index)) continue
        const candidate = truthWindow[index]
        if (candidate === undefined) continue
        const gap = Math.abs(candidate.startSeconds - at)
        if (gap > toleranceSeconds) continue
        if (gap < bestGap) {
          bestGap = gap
          bestIndex = index
        }
      }
      const heardIndex = indexOfHeard.get(heard) ?? -1
      if (bestIndex === -1) {
        unmatched += 1
        notes.push({
          index: heardIndex,
          verdict: 'spurious',
          truthMidi: null,
          onsetErrorMs: null,
        })
        continue
      }
      used.add(bestIndex)
      const truth = truthWindow[bestIndex]
      if (truth === undefined) continue
      const onsetErrorMs = (truth.startSeconds - at) * 1000
      onsetErrors.push(onsetErrorMs)

      let verdict: NoteVerdict
      if (truth.midi === heard.midi) {
        exact += 1
        verdict = 'exact'
      } else if (Math.abs(truth.midi - heard.midi) % 12 === 0) {
        octaveOff += 1
        verdict = 'octave'
      } else {
        wrongPitch += 1
        verdict = 'wrong-pitch'
        // What KIND of wrong matters. Errors clustered at a few semitones are
        // the detector hearing a harmonic or a neighbour; errors spread evenly
        // are the matcher pairing notes that have nothing to do with each
        // other, which is a fault in the bench and not in the transcription.
        const delta = truth.midi - heard.midi
        pitchErrors.set(delta, (pitchErrors.get(delta) ?? 0) + 1)
      }
      notes.push({
        index: heardIndex,
        verdict,
        truthMidi: truth.midi,
        onsetErrorMs,
      })
    }
    matchedTruth += used.size
  }

  const absErrors = onsetErrors.map(Math.abs).sort((a, b) => a - b)
  return {
    heardCount: heardNotes.length,
    truthCount: truthNotes.length,
    exact,
    octaveOff,
    wrongPitch,
    unmatched,
    missed: truthNotes.length - matchedTruth,
    precision: heardNotes.length > 0 ? exact / heardNotes.length : 0,
    recall: truthNotes.length > 0 ? exact / truthNotes.length : 0,
    octaveTolerantPrecision:
      heardNotes.length > 0 ? (exact + octaveOff) / heardNotes.length : 0,
    onsetMedianMs: median(onsetErrors),
    onsetP50Ms: median(absErrors),
    onsetP95Ms:
      absErrors.length > 0
        ? (absErrors[
            Math.min(absErrors.length - 1, Math.floor(absErrors.length * 0.95))
          ] ?? null)
        : null,
    pitchErrors: [...pitchErrors.entries()]
      .sort((left, right) => right[1] - left[1])
      .slice(0, 10),
    windowOffsetSpread:
      offsets.length > 1 ? Math.max(...offsets) - Math.min(...offsets) : 0,
    notes,
  }
}

const BASS_HINTS = /bass|b\.|bajo|basse/i

/**
 * Which track of a tab is the reference. Named match first, then anything that
 * looks like a bass, then the first track — a guess is better than refusing,
 * as long as the caller is told which one it got.
 */
export function pickReferenceTrack<T extends ReferenceTrackLabels>(
  tracks: readonly T[],
  wanted: string | null = null,
): T | null {
  if (tracks.length === 0) return null
  if (wanted !== null && wanted !== '') {
    const found = tracks.find((track) =>
      `${track.name} ${track.instrumentName}`
        .toLowerCase()
        .includes(wanted.toLowerCase()),
    )
    if (found !== undefined) return found
    return null
  }
  return (
    tracks.find((track) =>
      BASS_HINTS.test(`${track.name} ${track.instrumentName}`),
    ) ??
    tracks[0] ??
    null
  )
}

/** The commonest pitches, biggest first — a quick shape-of-the-line check. */
export function pitchHistogram(
  notes: readonly ScorableNote[],
  limit = 12,
): Array<[number, number]> {
  const counts = new Map<number, number>()
  for (const note of notes) {
    counts.set(note.midi, (counts.get(note.midi) ?? 0) + 1)
  }
  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, limit)
}
