// ============================================================
// Guitar Pro (.gp/.gp3/.gp4/.gp5/.gpx) → MidiSong mapping
// ============================================================
//
// Pure mapping from an alphaTab Score into the app's existing MidiSong shape, so
// imported tabs flow through the SAME pipeline as imported MIDI (saveMidiSong →
// track mixer → loadSong). alphaTab is imported as a TYPE only here, so this
// module carries no runtime dependency on it — the actual library is loaded
// on demand by gp-import.ts when a file is opened.

import type * as alphaTab from '@coderline/alphatab'
import type { GuitarBendType, GuitarNoteNotation, GuitarSlideType, GuitarTechnique, } from '@/lib/guitar/guitar-notation'
import type { MidiTimeSignature } from '@/lib/midi-bars'
import type { MidiSong, MidiSongNote, MidiSongPercussionHit, MidiSongPercussionTrack, MidiSongTrack, MidiTempoChange, } from '@/lib/midi-song'
import { gmInstrumentName } from '@/lib/midi-song'
import { guitarProDynamicVelocity, resolveGuitarProPercussion, } from '@/lib/tab/gp-percussion'

/** alphaTab playback ticks per quarter note. */
const TICKS_PER_QUARTER = 960

/** alphaTab BendPoint offsets always run from 0 to 60. */
const BEND_POINT_MAX_OFFSET = 60

export interface GpSongProjectionOptions {
  /** Reject before emitting more canonical notes/hits than the owner can hold. */
  readonly maximumEvents?: number
}

export class GpSongProjectionLimitError extends Error {
  readonly name = 'GpSongProjectionLimitError'

  constructor(readonly maximumEvents: number) {
    super(
      `This Guitar Pro file contains more than ${maximumEvents.toLocaleString()} musical events, which exceeds the configured safe import limit.`,
    )
  }
}

class GpSongProjectionBudget {
  private emittedEvents = 0

  constructor(private readonly maximumEvents: number) {}

  emit(): void {
    this.emittedEvents += 1
    if (this.emittedEvents > this.maximumEvents) {
      throw new GpSongProjectionLimitError(this.maximumEvents)
    }
  }
}

function projectionEventLimit(requested: number | undefined): number {
  if (requested === undefined) return Number.POSITIVE_INFINITY
  if (!Number.isFinite(requested)) return Number.POSITIVE_INFINITY
  return Math.max(0, Math.floor(requested))
}

const BEND_TYPES: Readonly<Record<number, GuitarBendType>> = {
  1: 'custom',
  2: 'bend',
  3: 'release',
  4: 'bend-release',
  5: 'hold',
  6: 'prebend',
  7: 'prebend-bend',
  8: 'prebend-release',
}

const SLIDE_IN_TYPES: Readonly<Record<number, GuitarSlideType>> = {
  1: 'into-from-below',
  2: 'into-from-above',
}

const SLIDE_OUT_TYPES: Readonly<Record<number, GuitarSlideType>> = {
  1: 'shift',
  2: 'legato',
  3: 'out-up',
  4: 'out-down',
  5: 'pick-slide-down',
  6: 'pick-slide-up',
}

function sourceNoteId(
  trackIndex: number,
  staff: alphaTab.model.Staff,
  note: alphaTab.model.Note,
): string {
  return `gp-t${trackIndex}-s${staff.index}-n${note.id}`
}

function linkedTechniqueTarget(
  trackIndex: number,
  staff: alphaTab.model.Staff,
  target: alphaTab.model.Note | null,
): { toFret?: number; toNoteId?: string } {
  if (target === null) return {}
  return {
    ...(target.fret < 0 ? {} : { toFret: target.fret }),
    toNoteId: sourceNoteId(trackIndex, staff, target),
  }
}

function noteTechniques(
  note: alphaTab.model.Note,
  beat: alphaTab.model.Beat,
  trackIndex: number,
  staff: alphaTab.model.Staff,
): GuitarTechnique[] {
  const techniques: GuitarTechnique[] = []
  const bendPoints = (note.bendPoints ?? []).map((point) => ({
    at: Math.min(1, Math.max(0, point.offset / BEND_POINT_MAX_OFFSET)),
    // alphaTab stores bend values in quarter tones.
    semitones: point.value / 2,
  }))
  const bendType =
    BEND_TYPES[note.bendType as number] ??
    (bendPoints.length > 0 ? 'custom' : undefined)
  if (bendType !== undefined) {
    const maxSemitones = bendPoints.reduce(
      (largest, point) => Math.max(largest, Math.abs(point.semitones)),
      Math.abs((note.maxBendPoint?.value ?? 0) / 2),
    )
    techniques.push({
      kind: 'bend',
      bendType,
      semitones: maxSemitones,
      ...(bendPoints.length === 0 ? {} : { points: bendPoints }),
    })
  }

  const slideInType = SLIDE_IN_TYPES[note.slideInType as number]
  if (slideInType !== undefined) {
    techniques.push({
      kind: 'slide',
      slideType: slideInType,
      ...(note.fret < 0 ? {} : { toFret: note.fret }),
    })
  }

  const slideOutType = SLIDE_OUT_TYPES[note.slideOutType as number]
  if (slideOutType !== undefined) {
    techniques.push({
      kind: 'slide',
      slideType: slideOutType,
      ...linkedTechniqueTarget(trackIndex, staff, note.slideTarget),
    })
  }

  if (note.isHammerPullOrigin || note.hammerPullDestination !== null) {
    const target = note.hammerPullDestination
    // alphaTab exposes hammer-on/pull-off as one source flag. The fret motion
    // disambiguates it; without a linked destination the score does not prove
    // which mark it was, so do not invent one.
    if (target !== null && target.fret !== note.fret) {
      techniques.push({
        kind: target.fret < note.fret ? 'pull-off' : 'hammer-on',
        ...linkedTechniqueTarget(trackIndex, staff, target),
      })
    }
  }

  const vibrato = Math.max(note.vibrato as number, beat.vibrato as number)
  if (vibrato > 0) {
    techniques.push({
      kind: 'vibrato',
      width: vibrato >= 2 ? 'wide' : 'slight',
    })
  }
  if (note.isPalmMute || beat.isPalmMute) {
    techniques.push({ kind: 'palm-mute' })
  }
  if (note.isLetRing || beat.isLetRing) {
    techniques.push({ kind: 'let-ring' })
  }

  return techniques
}

function noteNotation(
  note: alphaTab.model.Note,
  beat: alphaTab.model.Beat,
  trackIndex: number,
  staff: alphaTab.model.Staff,
): GuitarNoteNotation | undefined {
  const chordLabel = beat.chord?.name.trim() ?? ''
  const techniques = noteTechniques(note, beat, trackIndex, staff)
  if (chordLabel === '' && techniques.length === 0) return undefined
  return {
    ...(chordLabel === '' ? {} : { chordLabel }),
    ...(techniques.length === 0 ? {} : { techniques }),
  }
}

interface TrackSourceSetup {
  tuning: readonly number[]
  tuningName?: string
  capo: number
}

function staffSourceSetup(
  staff: alphaTab.model.Staff,
): TrackSourceSetup | null {
  if (staff.tuning.length < 4 || staff.tuning.length > 8) return null
  const tuningName = staff.tuningName.trim()
  return {
    tuning: [...staff.tuning],
    ...(tuningName === '' ? {} : { tuningName }),
    capo: Math.max(0, Math.round(staff.capo)),
  }
}

function sameSourceSetup(
  left: TrackSourceSetup,
  right: TrackSourceSetup,
): boolean {
  return (
    left.capo === right.capo &&
    left.tuningName === right.tuningName &&
    left.tuning.length === right.tuning.length &&
    left.tuning.every((midi, index) => midi === right.tuning[index])
  )
}

function notePlaybackDuration(
  note: alphaTab.model.Note,
  beat: alphaTab.model.Beat,
): number {
  const start = beat.absolutePlaybackStart
  let end = start + beat.playbackDuration
  let destination = note.tieDestination
  const visited = new Set<alphaTab.model.Note>()

  while (
    destination !== null &&
    destination.isTieDestination &&
    !visited.has(destination)
  ) {
    visited.add(destination)
    const destinationBeat = destination.beat
    end = Math.max(
      end,
      destinationBeat.absolutePlaybackStart + destinationBeat.playbackDuration,
    )
    destination = destination.tieDestination
  }

  return Math.max(0, end - start)
}

function percussionTrackToMidiSongTrack(
  track: alphaTab.model.Track,
  index: number,
  budget: GpSongProjectionBudget,
): MidiSongPercussionTrack | null {
  const percussionHits: MidiSongPercussionHit[] = []
  let droppedHitCount = 0

  for (const staff of track.staves) {
    for (const bar of staff.bars) {
      for (const voice of bar.voices) {
        for (const beat of voice.beats) {
          if (beat.isRest) continue
          const startBeat = beat.absolutePlaybackStart / TICKS_PER_QUARTER
          for (const note of beat.notes) {
            if (note.isTieDestination) continue
            budget.emit()
            const resolved = resolveGuitarProPercussion(
              track,
              note.percussionArticulation,
            )
            if (resolved === null) {
              droppedHitCount += 1
              continue
            }
            const writtenDuration = beat.playbackDuration / TICKS_PER_QUARTER
            percussionHits.push({
              id: sourceNoteId(index, staff, note),
              gmKey: resolved.gmKey,
              startBeat,
              velocity: guitarProDynamicVelocity(note.dynamics as number),
              ...(writtenDuration > 0 ? { writtenDuration } : {}),
              source: resolved.source,
            })
          }
        }
      }
    }
  }

  if (percussionHits.length === 0 && droppedHitCount === 0) return null
  percussionHits.sort((left, right) => left.startBeat - right.startBeat)
  const name = track.name.trim()
  return {
    id: `gp-t${index}`,
    kind: 'percussion',
    name: name === '' ? 'Drums' : name,
    instrumentName: 'General MIDI Drum Kit',
    noteCount: percussionHits.length,
    notes: [],
    percussionHits,
    droppedHitCount,
  }
}

function trackToMidiSongTrack(
  track: alphaTab.model.Track,
  index: number,
  budget: GpSongProjectionBudget,
): MidiSongTrack | null {
  if (track.isPercussion) {
    return percussionTrackToMidiSongTrack(track, index, budget)
  }
  const info = track.playbackInfo

  const notes: MidiSongNote[] = []
  let sourceSetup: TrackSourceSetup | undefined
  let sourceSetupConflicts = false
  for (const staff of track.staves) {
    // Tuning is high string first (e.g. [64,59,55,50,45,40]); its length is the
    // string count, so 7/8-string tabs resolve to the right lane.
    const tuning = staff.tuning
    const staffSetup = staffSourceSetup(staff)
    if (staffSetup !== null) {
      if (sourceSetup === undefined) sourceSetup = staffSetup
      else if (!sameSourceSetup(sourceSetup, staffSetup)) {
        sourceSetupConflicts = true
      }
    }
    for (const bar of staff.bars) {
      for (const voice of bar.voices) {
        for (const beat of voice.beats) {
          if (beat.isRest) continue
          const startBeat = beat.absolutePlaybackStart / TICKS_PER_QUARTER
          for (const note of beat.notes) {
            if (note.isDead || note.isTieDestination) continue
            const midi = note.realValue
            if (!Number.isFinite(midi)) continue
            const duration =
              notePlaybackDuration(note, beat) / TICKS_PER_QUARTER
            if (duration <= 0) continue
            budget.emit()
            const id = sourceNoteId(index, staff, note)
            const fret = note.fret
            // alphaTab numbers strings from the lowest physical string while
            // MidiSong stores them from highest to lowest. Preserve that
            // authored row directly: sounding pitch cannot recover it for
            // harmonics, alternate fingerings, or unison notes.
            const stringIndex = tuning.length - note.string
            const hasAuthoredFingering =
              fret >= 0 && stringIndex >= 0 && stringIndex < tuning.length
            const notation = noteNotation(note, beat, index, staff)
            const out: MidiSongNote = hasAuthoredFingering
              ? {
                  id,
                  midi,
                  startBeat,
                  duration,
                  stringIndex,
                  fret,
                  authoredFingering: true,
                }
              : { id, midi, startBeat, duration }
            // Let-ring is exposed per-note and per-beat by alphaTab.
            if (note.isLetRing || beat.isLetRing) out.letRing = true
            if (notation !== undefined) out.notation = notation
            notes.push(out)
          }
        }
      }
    }
  }

  if (notes.length === 0) return null
  notes.sort((a, b) => a.startBeat - b.startBeat)
  applyLetRing(notes)

  const program = info?.program ?? 0
  const instrumentName = gmInstrumentName(program)
  const name = track.name.trim() !== '' ? track.name.trim() : instrumentName
  return {
    id: `gp-t${index}`,
    kind: 'pitched',
    name,
    instrumentName,
    noteCount: notes.length,
    notes,
    ...(sourceSetup === undefined || sourceSetupConflicts
      ? {}
      : {
          sourceTuning: sourceSetup.tuning,
          ...(sourceSetup.tuningName === undefined
            ? {}
            : { sourceTuningName: sourceSetup.tuningName }),
          sourceCapo: sourceSetup.capo,
        }),
  }
}

/**
 * Realise Guitar Pro "let ring": a flagged note keeps sounding until the same
 * string is struck again, so we extend its duration to the onset of the next
 * note on that string. This flows through the existing duration-respecting
 * playback + falling-notes rendering, so no audio-engine change is needed.
 * Notes with no resolved stringIndex, or with no later same-string note, keep
 * their notated duration. `notes` must already be sorted by startBeat.
 */
function applyLetRing(notes: MidiSongNote[]): void {
  // The pending let-ring note awaiting its next strike, keyed by string.
  const pending = new Map<number, MidiSongNote>()
  for (const n of notes) {
    if (n.stringIndex === undefined) continue
    const prev = pending.get(n.stringIndex)
    if (prev !== undefined && n.startBeat > prev.startBeat) {
      prev.duration = n.startBeat - prev.startBeat
      pending.delete(n.stringIndex)
    }
    if (n.letRing === true) pending.set(n.stringIndex, n)
  }
}

/**
 * Every tempo automation in the score, on the beat it takes effect.
 *
 * Without these a Guitar Pro import runs at the opening tempo for the whole
 * song. Dance of Death changes tempo ten times and its score runs 528 seconds;
 * held at the first tempo the last note lands nearly a minute early, which is
 * exactly how far the Lab's tab overlay was drifting from the audio when the
 * reference was the .gp5 rather than the MIDI export.
 */
function scoreTempoChanges(
  score: alphaTab.model.Score,
  budget: GpSongProjectionBudget,
): MidiTempoChange[] {
  const changes: MidiTempoChange[] = []
  for (const masterBar of score.masterBars) {
    for (const automation of masterBar.tempoAutomations) {
      if (!(automation.value > 0)) continue
      budget.emit()
      const tick =
        masterBar.start +
        automation.ratioPosition * masterBar.calculateDuration()
      changes.push({
        beat: tick / TICKS_PER_QUARTER,
        usPerBeat: Math.round(60000000 / automation.value),
      })
    }
  }
  return changes.sort((left, right) => left.beat - right.beat)
}

/**
 * Every time signature in the score, on the beat its bar starts.
 *
 * Guitar Pro states a signature on every master bar whether or not it changed,
 * so this is a list of bar openings rather than a list of changes; the repeats
 * are dropped where bars are built. It is the only source we have that carries
 * real signatures — a MIDI export of the same score keeps them, an audio
 * measurement has none — and without it a 6/8 song is drawn in fours, with
 * every bar line a beat and a half from where the music puts it.
 */
function scoreTimeSignatures(
  score: alphaTab.model.Score,
  budget: GpSongProjectionBudget,
): MidiTimeSignature[] {
  return score.masterBars.map((masterBar) => {
    budget.emit()
    return {
      beat: masterBar.start / TICKS_PER_QUARTER,
      numerator: masterBar.timeSignatureNumerator,
      denominator: masterBar.timeSignatureDenominator,
    }
  })
}

/** Convert an alphaTab Score without crossing percussion into pitch notes. */
export function scoreToMidiSong(
  score: alphaTab.model.Score,
  options: GpSongProjectionOptions = {},
): MidiSong {
  const budget = new GpSongProjectionBudget(
    projectionEventLimit(options.maximumEvents),
  )
  const tracks: MidiSongTrack[] = []
  score.tracks.forEach((track, i) => {
    const mapped = trackToMidiSongTrack(track, i, budget)
    if (mapped !== null) tracks.push(mapped)
  })
  const bpm = score.tempo > 0 ? Math.round(score.tempo) : 120
  return {
    bpm,
    tempoChanges: scoreTempoChanges(score, budget),
    timeSignatures: scoreTimeSignatures(score, budget),
    tracks,
  }
}

/** Human-readable song name from score metadata, falling back to file name. */
export function scoreName(
  score: alphaTab.model.Score,
  fileName: string,
): string {
  const title = score.title.trim()
  const artist = score.artist.trim()
  if (title !== '' && artist !== '') return `${artist} - ${title}`
  if (title !== '') return title
  return fileName.replace(/\.[^.]+$/, '')
}
