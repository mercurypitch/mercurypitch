// Portable exports use corrected MIDI notes or accepted guitar revisions, never renamed audio bytes.
import { recordingMidiProblem, recordingScoreProblem, recordingScoreTuning, } from './recording-score'
import type { GuitarPracticeScore } from './recording-types'

export function guitarRecordingFilename(
  title: string,
  extension: 'mid' | 'gp',
  now = new Date(),
): string {
  const normalized = title.normalize('NFKC').trim().toLowerCase()
  // Older unnamed takes include a locale-formatted date in their title. Keep
  // that display title intact, but do not put a second date in the filename.
  const unnamed =
    /^guitar melody(?:\s*·\s*\p{N}[\p{N}\p{Z}\p{Cf}\s/.,:apm-]*)?$/u.test(
      normalized,
    )
  const name = unnamed
    ? ''
    : Array.from(normalized.replace(/[^\p{L}\p{N}]+/gu, '-'))
        .slice(0, 48)
        .join('')
        .replace(/^-+|-+$/g, '')
  const pad = (value: number): string => String(value).padStart(2, '0')
  const date = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`
  const time = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
  return `melody-${name === '' ? '' : `${name}-`}${date}-${time}.${extension}`
}

// Downloads in the same second get a small suffix without adding milliseconds
// to every filename. Existing files on disk remain the browser's responsibility.
const downloadCounts = new Map<string, number>()

export async function exportRecordingMidi(
  score: GuitarPracticeScore,
): Promise<Uint8Array> {
  const problem = recordingMidiProblem(score)
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

/** GP7 is a notation copy; original free timing stays in practice and MIDI. */
export async function exportRecordingGuitarPro(
  score: GuitarPracticeScore,
): Promise<Uint8Array> {
  const problem = recordingScoreProblem(score)
  if (problem !== null) throw new Error(problem)
  const { writeRecordingGuitarPro } = await import('./recording-gp7')
  return writeRecordingGuitarPro(score)
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
  const filename = guitarRecordingFilename(score.title, format)
  const count = (downloadCounts.get(filename) ?? 0) + 1
  downloadCounts.set(filename, count)
  link.download =
    count === 1
      ? filename
      : filename.replace(`.${format}`, `-${count}.${format}`)
  // Focus-managed sheets block background clicks, including synthetic anchor
  // clicks. Keep the download inside the initiating review, not behind it.
  container.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
