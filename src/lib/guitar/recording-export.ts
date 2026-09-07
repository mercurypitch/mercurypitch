// Portable guitar exports are derived from an accepted revision, never renamed audio or MIDI bytes.
import { recordingScoreProblem, recordingScoreTuning } from './recording-score'
import type { GuitarPracticeNote, GuitarPracticeScore } from './recording-types'

export function guitarRecordingFilename(
  title: string,
  extension: 'mid' | 'gp',
  now = new Date(),
): string {
  const name =
    title
      .normalize('NFKC')
      .replace(/[^\p{L}\p{N} _-]/gu, '')
      .trim()
      .replace(/\s+/g, '-')
      .slice(0, 80) || 'guitar-melody'
  return `${name}-${now.toISOString().replace(/[:.]/g, '-')}.${extension}`
}

export async function exportRecordingMidi(
  score: GuitarPracticeScore,
): Promise<Uint8Array> {
  const problem = recordingScoreProblem(score)
  if (problem !== null) throw new Error(problem)
  const { buildMidiFile, TICKS_PER_BEAT } = await import('../midi-generator')
  const result = buildMidiFile(
    score.notes.map((note) => ({
      midi: note.midi,
      tickOn: Math.round(note.startBeat * TICKS_PER_BEAT),
      tickOff: Math.max(
        Math.round(note.startBeat * TICKS_PER_BEAT) + 1,
        Math.round(note.endBeat * TICKS_PER_BEAT),
      ),
    })),
    score.bpm,
    {
      trackName: score.title,
      timeSignature: score.timeSignature,
      program: recordingScoreTuning(score).instrument === 'bass' ? 33 : 27,
    },
  )
  if (result === null)
    throw new Error('This score could not be exported as MIDI.')
  return result
}

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b))

/** Ordinary durations when possible; exact rational tuplets retain free timing to 1/480 beat. */
export async function exportRecordingGuitarPro(
  score: GuitarPracticeScore,
): Promise<Uint8Array> {
  const problem = recordingScoreProblem(score)
  if (problem !== null) throw new Error(problem)
  const alphaTab = await import('@coderline/alphatab')
  const { model } = alphaTab
  const result = new model.Score()
  result.title = score.title
  result.subTitle = `Recorded melody · revision ${score.revision}`
  result.notices =
    'Single-note transcription accepted by the player. Fingering is suggested. Free timing is rounded to 1/480 beat; use the note editor grid for simpler notation.'
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
  staff.showTablature = true
  staff.showStandardNotation = true
  track.addStaff(staff)
  const ticksPerBar =
    ((score.timeSignature[0] * 4) / score.timeSignature[1]) * 480
  const lastTick = Math.ceil(
    Math.max(...score.notes.map((note) => note.endBeat)) * 480,
  )
  const bars = Math.max(1, Math.ceil(lastTick / ticksPerBar))
  if (bars > 2048) throw new Error('This score is too long to export safely.')
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
    staff.addBar(bar)
    const voice = new model.Voice()
    bar.addVoice(voice)
    voices.push(voice)
  }
  let cursor = 0
  const emit = (end: number, source: GuitarPracticeNote | null): void => {
    let previous: InstanceType<typeof model.Note> | null = null
    while (cursor < end) {
      const barIndex = Math.floor(cursor / ticksPerBar)
      const count = Math.min(
        end - cursor,
        (barIndex + 1) * ticksPerBar - cursor,
      )
      const beat = new model.Beat()
      beat.isEmpty = false
      const regular = [1, 2, 4, 8, 16, 32, 64, 128, 256].find(
        (duration) => 1920 / duration === count,
      )
      if (regular !== undefined) beat.duration = regular
      else {
        beat.duration = model.Duration.Quarter
        const divisor = gcd(480, count)
        beat.tupletNumerator = 480 / divisor
        beat.tupletDenominator = count / divisor
      }
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
      cursor += count
    }
  }
  for (const note of [...score.notes].sort(
    (a, b) => a.startBeat - b.startBeat,
  )) {
    const start = Math.round(note.startBeat * 480)
    const end = Math.max(start + 1, Math.round(note.endBeat * 480))
    emit(start, null)
    emit(end, note)
  }
  emit(bars * ticksPerBar, null)
  const settings = new alphaTab.Settings()
  result.finish(settings)
  return new alphaTab.exporter.Gp7Exporter().export(result, settings)
}

export async function downloadRecordingScore(
  score: GuitarPracticeScore,
  format: 'mid' | 'gp',
  container: HTMLElement = document.body,
): Promise<void> {
  const bytes =
    format === 'mid'
      ? await exportRecordingMidi(score)
      : await exportRecordingGuitarPro(score)
  const url = URL.createObjectURL(
    new Blob([new Uint8Array(bytes)], {
      type: format === 'mid' ? 'audio/midi' : 'application/octet-stream',
    }),
  )
  const link = document.createElement('a')
  link.href = url
  link.download = guitarRecordingFilename(score.title, format)
  // Focus-managed sheets block background clicks, including synthetic anchor
  // clicks. Keep the download inside the initiating review, not behind it.
  container.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
