import { freqToMidi, midiToFreq, midiToNote } from '@/lib/scale-data'
import type { MelodyItem, NoteName } from '@/types'
import type { TimeStampedPitchSample } from '@/types/pitch-algorithms'

export interface SegmentPitchesOptions {
  /** Minimum clarity (0-1) to consider a pitch valid */
  minClarity?: number
  /** Minimum duration in seconds to consider it a distinct note */
  minDuration?: number
  /** Maximum gap in seconds to bridge across */
  maxGap?: number
  /** Pitch tolerance in semitones (e.g. 0.5) */
  pitchTolerance?: number
  /** BPM, used to convert times to beats for MelodyItem */
  bpm?: number
  /** Max gap in seconds for dropout bridging (look-ahead for same-pitch resumption) */
  dropoutBridgeMax?: number
}

/**
 * Converts a continuous stream of raw pitch samples into discrete melody notes.
 */
export function segmentPitchesToNotes(
  samples: TimeStampedPitchSample[],
  options: SegmentPitchesOptions = {},
): MelodyItem[] {
  const minClarity = options.minClarity ?? 0.6
  const minDuration = options.minDuration ?? 0.08 // 80ms, matches merger default
  const maxGap = options.maxGap ?? 0.1 // 100ms
  const pitchTolerance = options.pitchTolerance ?? 0.5
  const bpm = options.bpm ?? 120
  const dropoutBridgeMax = options.dropoutBridgeMax ?? 0.2 // 200ms look-ahead for bridging

  if (samples.length === 0) return []

  const validSamples = samples.filter(
    (s) => s.freq !== null && s.freq > 0 && s.clarity >= minClarity,
  )
  if (validSamples.length === 0) return []

  // Add midi value to each valid sample
  const midiSamples = validSamples.map((s) => ({
    time: s.time,
    freq: s.freq!,
    midi: freqToMidi(s.freq!),
  }))

  // Sort by time just in case
  midiSamples.sort((a, b) => a.time - b.time)

  const rawNotes: {
    startTime: number
    endTime: number
    midiSum: number
    count: number
  }[] = []

  let currentNote = {
    startTime: midiSamples[0].time,
    endTime: midiSamples[0].time,
    midiSum: midiSamples[0].midi,
    count: 1,
  }

  for (let i = 1; i < midiSamples.length; i++) {
    const s = midiSamples[i]
    const currentAvgMidi = currentNote.midiSum / currentNote.count

    const timeDiff = s.time - currentNote.endTime
    const pitchDiff = Math.abs(s.midi - currentAvgMidi)

    // Bridge momentary dropouts: if the gap exceeds maxGap but pitch matches
    // (±pitchTolerance) AND there's a same-pitch resumption within
    // dropoutBridgeMax, don't split — treat it as a single sustained note.
    const pitchMatches = pitchDiff <= pitchTolerance
    const isDropoutGap =
      timeDiff > maxGap && timeDiff <= dropoutBridgeMax && pitchMatches

    if ((timeDiff <= maxGap && pitchMatches) || isDropoutGap) {
      // Continue the current note
      currentNote.endTime = s.time
      currentNote.midiSum += s.midi
      currentNote.count++
    } else {
      // End current note and start a new one
      rawNotes.push(currentNote)
      currentNote = {
        startTime: s.time,
        endTime: s.time,
        midiSum: s.midi,
        count: 1,
      }
    }
  }
  rawNotes.push(currentNote)

  // Phase 1: filter out notes shorter than minDuration
  const beatsPerSecond = bpm / 60
  const minDurNotes = rawNotes.filter(
    (n) => n.endTime - n.startTime >= minDuration,
  )

  // Phase 2: isolated-singleton filter — drop short notes (<100ms) that have
  // large gaps (>200ms) on both sides. These are typically spurious detections,
  // not part of a musical phrase.
  const SINGLETON_MAX_DUR = 0.1
  const SINGLETON_MIN_GAP = 0.2
  const filteredNotes =
    minDurNotes.length <= 1
      ? minDurNotes
      : minDurNotes.filter((n, i) => {
          const dur = n.endTime - n.startTime
          if (dur >= SINGLETON_MAX_DUR) return true
          const gapBefore =
            i === 0 ? Infinity : n.startTime - minDurNotes[i - 1].endTime
          const gapAfter =
            i === minDurNotes.length - 1
              ? Infinity
              : minDurNotes[i + 1].startTime - n.endTime
          return !(
            gapBefore > SINGLETON_MIN_GAP && gapAfter > SINGLETON_MIN_GAP
          )
        })

  let nextId = 1
  const melodyItems: MelodyItem[] = []

  for (const n of filteredNotes) {
    const durationSec = n.endTime - n.startTime
    const avgMidi = Math.round(n.midiSum / n.count)
    const noteInfo = midiToNote(avgMidi)

    melodyItems.push({
      id: nextId++,
      startBeat: n.startTime * beatsPerSecond,
      duration: durationSec * beatsPerSecond,
      note: {
        midi: avgMidi,
        name: noteInfo.name as NoteName,
        octave: noteInfo.octave,
        freq: midiToFreq(avgMidi),
      },
    })
  }

  return melodyItems
}
