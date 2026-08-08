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

/**
 * How far a window is allowed to have slipped against the tab.
 *
 * Sized by measurement, and it was wrong once: at 6 s, Dance of Death's own
 * MIDI export — 528 s of score against 517 s of audio — drifts past the cap
 * around the two-thirds mark, and every later window saturated at the limit.
 * Saturated windows cannot align, so the whole tail of the song scored as
 * wrong pitches and misses that were really the ruler slipping. 15 s covers
 * a 2% drift over a ten-minute song with room to spare.
 */
export const MAX_LOCAL_DRIFT_SECONDS = 15

export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((left, right) => left - right)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2
    : (sorted[middle] ?? 0)
}

/**
 * How far one window's offset may move from the previous window's.
 *
 * The continuity prior. A riff repeats, so a window in isolation often scores
 * HIGHER at an offset one riff-period away — every note lands on its
 * neighbour, pitch classes agree, and the whole window silently shifts onto
 * the wrong bar. Real drift between adjacent six-second windows is a fraction
 * of a second; an offset that jumps seconds from its neighbour is an alias,
 * not a measurement. Windows with an anchor search only this band, falling
 * back to the full range when the band finds nothing at all (a resync after
 * silence is real, and refusing it would pin the rest of the song wrong).
 */
export const OFFSET_CONTINUITY_SECONDS = 1.5

/**
 * The offset that lines this window up best.
 *
 * Candidates are scored on pitch-class agreement rather than exact pitch, so
 * that an octave error — the thing being measured — cannot drag the alignment
 * off and hide itself in the result. Ties break toward the anchor, because
 * between two offsets the notes cannot distinguish, the one that does not
 * claim the clock jumped is the smaller claim.
 */
export function bestWindowOffset(
  heard: readonly ScorableNote[],
  truth: readonly ScorableNote[],
  toleranceSeconds: number,
  anchorOffset: number | null = null,
): number {
  const candidates = new Set([anchorOffset ?? 0])
  for (const heardNote of heard) {
    for (const truthNote of truth) {
      const delta = truthNote.startSeconds - heardNote.startSeconds
      if (Math.abs(delta) <= MAX_LOCAL_DRIFT_SECONDS) {
        candidates.add(Math.round(delta * 200) / 200)
      }
    }
  }

  const home = anchorOffset ?? 0
  const pick = (allowed: (offset: number) => boolean) => {
    let best: { offset: number; score: number } | null = null
    for (const offset of candidates) {
      if (!allowed(offset)) continue
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
      if (
        best === null ||
        score > best.score ||
        (score === best.score &&
          Math.abs(offset - home) < Math.abs(best.offset - home))
      ) {
        best = { offset, score }
      }
    }
    return best
  }

  if (anchorOffset !== null) {
    const nearby = pick(
      (offset) => Math.abs(offset - anchorOffset) <= OFFSET_CONTINUITY_SECONDS,
    )
    if (nearby !== null && nearby.score > 0) return nearby.offset
  }
  return pick(() => true)?.offset ?? 0
}

/**
 * How far around a matched reference note to look for one at the heard pitch
 * before calling the pair a wrong pitch. Within a few hundred milliseconds a
 * root-and-fifth riff has both notes, and when the transcriber hears the root
 * but misses the fifth, time-nearest pairing hands the correct root to the
 * leftover fifth. Measured on a real bass stem that artifact WAS the headline
 * error: 314 of 596 "wrong pitch" pairs had the heard pitch in the tab within
 * this distance — including 234 of the 257 "+7" errors that sent two sessions
 * hunting a detector bug the audio says is not there.
 */
export const SHADOW_NEIGHBOUR_SECONDS = 0.35

/** How one heard note was judged, kept per note so the roll can colour it. */
export type NoteVerdict =
  | 'exact'
  | 'octave'
  | 'wrong-pitch'
  /**
   * Paired with a neighbouring reference note of a different pitch while the
   * tab holds a note of the heard pitch close by. The note itself is likely
   * right; the real defect underneath is the neighbour that went unheard.
   */
  | 'shadow'
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
  /** Pairs judged `shadow` — see the verdict; counted apart from wrongPitch. */
  shadowed: number
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
  /**
   * The offset each window aligned at, in window order. What a view needs to
   * draw the reference on the recording's own clock: without it the tab drifts
   * visibly off the audio — eleven seconds by the end of a ten-minute song —
   * and the drawing reads as transcription error when it is only the ruler.
   */
  windowOffsets: Array<{ startSeconds: number; offsetSeconds: number }>
  /** Per-heard-note verdicts, so a view can show where the errors are. */
  notes: ScoredNote[]
}

/**
 * Two passes: align, then match.
 *
 * Pass one finds a per-window offset, exactly as before. Pass two matches
 * GLOBALLY: every heard note is moved onto the reference clock by its window's
 * offset, candidate pairs within tolerance are collected, and pairs are taken
 * closest-first with each note — heard and reference — used once.
 *
 * Matching inside each window was tried and had two failure modes, one per
 * choice of bookkeeping. With a per-window used-set, overlapping truth windows
 * let one reference note be matched by several windows — five hundred phantom
 * matches on a real run, all double credit. With a global used-set consumed in
 * window order, early windows stole reference notes that belonged to later
 * heard notes, and two hundred real matches turned into misses. Closest-first
 * over the whole song has neither problem, and no order to be sensitive to.
 *
 * Pitch counts as correct only at the exact MIDI number; an octave error gets
 * its own column rather than being folded into "correct", because on a bass
 * line the octave is the part a player notices first.
 */
export function scoreAgainstTruth(
  heardNotes: readonly ScorableNote[],
  truthNotes: readonly ScorableNote[],
  toleranceSeconds: number,
): TranscriptionScore {
  const onsetErrors: number[] = []
  const offsets: Array<{ startSeconds: number; offsetSeconds: number }> = []
  const pitchErrors = new Map<number, number>()
  let exact = 0
  let octaveOff = 0
  let wrongPitch = 0
  let shadowed = 0

  const lastSecond = Math.max(
    heardNotes.at(-1)?.startSeconds ?? 0,
    truthNotes.at(-1)?.startSeconds ?? 0,
  )

  // Pass one: an offset per window, from pitch-class agreement.
  for (let start = 0; start <= lastSecond; start += WINDOW_SECONDS) {
    const heardWindow = heardNotes.filter(
      (note) =>
        note.startSeconds >= start &&
        note.startSeconds < start + WINDOW_SECONDS,
    )
    if (heardWindow.length === 0) continue
    const truthWindow = truthNotes.filter(
      (note) =>
        note.startSeconds >= start - MAX_LOCAL_DRIFT_SECONDS &&
        note.startSeconds < start + WINDOW_SECONDS + MAX_LOCAL_DRIFT_SECONDS,
    )
    if (truthWindow.length === 0) continue
    offsets.push({
      startSeconds: start,
      offsetSeconds: bestWindowOffset(
        heardWindow,
        truthWindow,
        toleranceSeconds,
        offsets.at(-1)?.offsetSeconds ?? null,
      ),
    })
  }

  /** The offset in force at a given moment — the last window at or before it. */
  const offsetAt = (seconds: number): number => {
    let inForce = offsets[0]?.offsetSeconds ?? 0
    for (const entry of offsets) {
      if (entry.startSeconds <= seconds) inForce = entry.offsetSeconds
      else break
    }
    return inForce
  }

  // Pass two: candidate pairs within tolerance, taken closest-first.
  interface Pair {
    heardIndex: number
    truthIndex: number
    gap: number
    errorMs: number
  }
  const pairs: Pair[] = []
  // Truth notes sorted by time with original indices, so each heard note scans
  // only its neighbourhood instead of the whole reference.
  const truthByTime = truthNotes
    .map((note, index) => ({ note, index }))
    .sort((left, right) => left.note.startSeconds - right.note.startSeconds)
  const truthStarts = truthByTime.map((entry) => entry.note.startSeconds)
  const firstAtOrAfter = (seconds: number): number => {
    let low = 0
    let high = truthStarts.length
    while (low < high) {
      const mid = (low + high) >> 1
      if ((truthStarts[mid] ?? Infinity) < seconds) low = mid + 1
      else high = mid
    }
    return low
  }

  heardNotes.forEach((heard, heardIndex) => {
    const at = heard.startSeconds + offsetAt(heard.startSeconds)
    for (
      let scan = firstAtOrAfter(at - toleranceSeconds);
      scan < truthByTime.length;
      scan += 1
    ) {
      const candidate = truthByTime[scan]
      if (candidate === undefined) break
      const delta = candidate.note.startSeconds - at
      if (delta > toleranceSeconds) break
      pairs.push({
        heardIndex,
        truthIndex: candidate.index,
        gap: Math.abs(delta),
        errorMs: delta * 1000,
      })
    }
  })
  pairs.sort((left, right) => left.gap - right.gap)

  const matchOfHeard = new Map<number, Pair>()
  const usedTruth = new Set<number>()
  for (const pair of pairs) {
    if (matchOfHeard.has(pair.heardIndex) || usedTruth.has(pair.truthIndex)) {
      continue
    }
    matchOfHeard.set(pair.heardIndex, pair)
    usedTruth.add(pair.truthIndex)
  }

  const notes: ScoredNote[] = heardNotes.map((heard, heardIndex) => {
    const match = matchOfHeard.get(heardIndex)
    if (match === undefined) {
      return {
        index: heardIndex,
        verdict: 'spurious' as const,
        truthMidi: null,
        onsetErrorMs: null,
      }
    }
    const truth = truthNotes[match.truthIndex]
    if (truth === undefined) {
      return {
        index: heardIndex,
        verdict: 'spurious' as const,
        truthMidi: null,
        onsetErrorMs: null,
      }
    }
    onsetErrors.push(match.errorMs)
    let verdict: NoteVerdict
    if (truth.midi === heard.midi) {
      exact += 1
      verdict = 'exact'
    } else if (Math.abs(truth.midi - heard.midi) % 12 === 0) {
      octaveOff += 1
      verdict = 'octave'
    } else {
      // Wrong pitch, or a shadow of a miss: if the reference holds a note at
      // the heard pitch near the one this paired with, the heard note is
      // probably right and its true counterpart was taken or unheard.
      const from = firstAtOrAfter(truth.startSeconds - SHADOW_NEIGHBOUR_SECONDS)
      let isShadow = false
      for (let scan = from; scan < truthByTime.length; scan += 1) {
        const neighbour = truthByTime[scan]
        if (neighbour === undefined) break
        if (
          neighbour.note.startSeconds >
          truth.startSeconds + SHADOW_NEIGHBOUR_SECONDS
        ) {
          break
        }
        if (neighbour.note.midi === heard.midi) {
          isShadow = true
          break
        }
      }
      if (isShadow) {
        shadowed += 1
        verdict = 'shadow'
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
    }
    return {
      index: heardIndex,
      verdict,
      truthMidi: truth.midi,
      onsetErrorMs: match.errorMs,
    }
  })
  const unmatched = heardNotes.length - matchOfHeard.size

  const absErrors = onsetErrors.map(Math.abs).sort((a, b) => a - b)
  return {
    heardCount: heardNotes.length,
    truthCount: truthNotes.length,
    exact,
    octaveOff,
    wrongPitch,
    shadowed,
    unmatched,
    missed: truthNotes.length - usedTruth.size,
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
      offsets.length > 1
        ? Math.max(...offsets.map((entry) => entry.offsetSeconds)) -
          Math.min(...offsets.map((entry) => entry.offsetSeconds))
        : 0,
    windowOffsets: offsets,
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
