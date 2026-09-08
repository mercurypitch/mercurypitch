// GP7 notation is a readable export copy, separate from the take's free-timed performance.
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate'
import { recordingScoreTuning } from './recording-score'
import type { GuitarPracticeNote, GuitarPracticeScore } from './recording-types'

const UNITS_PER_BEAT = 8 // Thirty-second notes; never arbitrary rational tuplets.
const DURATIONS = [1, 2, 4, 8, 16, 32]
  .flatMap((duration) => {
    const units = 32 / duration
    return [
      { duration, dots: 0, units, alignment: units },
      ...(units > 1
        ? [{ duration, dots: 1, units: units * 1.5, alignment: units }]
        : []),
    ]
  })
  .sort((a, b) => b.units - a.units)

function notationNotes(score: GuitarPracticeScore) {
  const notes = [...score.notes]
    .sort((a, b) => a.startBeat - b.startBeat)
    .map((note) => ({
      note,
      start: Math.round(note.startBeat * UNITS_PER_BEAT),
      end: Math.round(note.endBeat * UNITS_PER_BEAT),
    }))
  if (
    notes.some(
      (note, index) => index > 0 && note.start <= notes[index - 1].start,
    )
  )
    throw new Error(
      'Some note attacks are too close for thirty-second-note notation. Separate or merge those notes, or export MIDI to keep their original timing.',
    )
  return notes.map((note, index) => ({
    ...note,
    // Retain short attacks, but do not overlap the next one or shift the phrase.
    end: Math.min(
      notes[index + 1]?.start ?? Infinity,
      Math.max(note.start + 1, note.end),
    ),
  }))
}

/** Repair two GPIF metadata fields alphaTab 1.8.3 writes incorrectly.
 * This only handles our generated single-track score, never imported user ZIPs.
 * Compare with native GP8: tuning Instrument is Guitar/Bass, FretCount uses Number.
 */
function nativeInstrumentMetadata(
  bytes: Uint8Array,
  instrument: 'guitar' | 'bass',
): Uint8Array {
  const files = unzipSync(bytes)
  const path = 'Content/score.gpif'
  const xml = new DOMParser().parseFromString(
    strFromU8(files[path]),
    'application/xml',
  )
  const properties = xml.querySelectorAll('Track > Staves > Staff > Properties')
  if (xml.querySelector('parsererror') || properties.length !== 1)
    throw new Error(
      'Could not prepare Guitar Pro notation. Your saved take is unchanged.',
    )
  const tuning = properties[0].querySelector(
    'Property[name="Tuning"] > Instrument',
  )
  const frets = properties[0].querySelector('Property[name="FretCount"]')
  if (!tuning || !frets)
    throw new Error(
      'Could not prepare Guitar Pro instrument settings. Export MIDI instead.',
    )
  tuning.textContent = instrument === 'bass' ? 'Bass' : 'Guitar'
  const count = xml.createElement('Number')
  count.textContent = '24'
  frets.replaceChildren(count)
  files[path] = strToU8(new XMLSerializer().serializeToString(xml))
  return zipSync(files)
}

export async function writeRecordingGuitarPro(
  score: GuitarPracticeScore,
): Promise<Uint8Array> {
  const timedNotes = notationNotes(score)
  const unitsPerBar = (score.timeSignature[0] * 32) / score.timeSignature[1]
  const bars = Math.max(
    1,
    Math.ceil(timedNotes[timedNotes.length - 1].end / unitsPerBar),
  )
  if (bars > 2048) throw new Error('This score is too long to export safely.')
  const alphaTab = await import('@coderline/alphatab')
  const { model } = alphaTab
  const result = new model.Score()
  result.title = score.title
  result.subTitle = `Recorded melody · revision ${score.revision}`
  result.notices =
    'Single-note transcription with suggested fingering. This notation copy rounds timing to thirty-second notes at the chosen display tempo. Saved audio, practice timing and MIDI export retain the original timing.'
  const instrument = recordingScoreTuning(score).instrument
  const track = new model.Track()
  track.name = `Recorded ${instrument}`
  result.addTrack(track)
  track.playbackInfo.program = instrument === 'bass' ? 33 : 27
  const staff = new model.Staff()
  staff.stringTuning = new model.Tuning(
    'Recorded tuning',
    [...score.tuning],
    false,
  )
  staff.capo = score.capo
  // Guitar and bass sound an octave below their written pitch. This changes
  // notation, not tuning, MIDI pitch, or the player's accepted fingering.
  staff.displayTranspositionPitch = -12
  staff.showTablature = true
  staff.showStandardNotation = true
  track.addStaff(staff)
  const voices: InstanceType<typeof model.Voice>[] = []
  for (let index = 0; index < bars; index++) {
    const master = new model.MasterBar()
    master.timeSignatureNumerator = score.timeSignature[0]
    master.timeSignatureDenominator = score.timeSignature[1]
    if (index === 0)
      master.tempoAutomations.push(
        model.Automation.buildTempoAutomation(false, 0, score.bpm, 2),
      )
    result.addMasterBar(master)
    const bar = new model.Bar()
    bar.clef = instrument === 'bass' ? model.Clef.F4 : model.Clef.G2
    staff.addBar(bar)
    const voice = new model.Voice()
    bar.addVoice(voice)
    voices.push(voice)
  }
  let cursor = 0
  const emit = (end: number, source: GuitarPracticeNote | null): void => {
    let previous: InstanceType<typeof model.Note> | null = null
    while (cursor < end) {
      const barIndex = Math.floor(cursor / unitsPerBar)
      const remaining = Math.min(
        end - cursor,
        (barIndex + 1) * unitsPerBar - cursor,
      )
      const offset = cursor - barIndex * unitsPerBar
      // Split at readable boundaries. Adjacent parts of one note are tied;
      // separate attacks of the same pitch must never become a sustain.
      const rhythm = DURATIONS.find(
        (candidate) =>
          candidate.units <= remaining && offset % candidate.alignment === 0,
      )!
      const beat = new model.Beat()
      beat.isEmpty = false
      beat.duration = rhythm.duration
      beat.dots = rhythm.dots
      voices[barIndex].addBeat(beat)
      if (source !== null) {
        const note = new model.Note()
        note.string = score.tuning.length + 1 - source.string!
        note.fret = source.fret!
        if (previous !== null) {
          note.isTieDestination = true
          note.tieOrigin = previous
          previous.tieDestination = note
        }
        beat.addNote(note)
        previous = note
      }
      cursor += rhythm.units
    }
  }
  for (const { note, start, end } of timedNotes) {
    emit(start, null)
    emit(end, note)
  }
  emit(bars * unitsPerBar, null)
  const settings = new alphaTab.Settings()
  result.finish(settings)
  return nativeInstrumentMetadata(
    new alphaTab.exporter.Gp7Exporter().export(result, settings),
    instrument,
  )
}
