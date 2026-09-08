// Real import/export round trips protect guitar pitch, timing, fingering, tempo and metre.
import { strFromU8, unzipSync } from 'fflate'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { parseMidiSong } from '../midi-song'
import { scoreToMidiSong } from '../tab/gp-to-midi-song'
import { downloadRecordingScore, exportRecordingGuitarPro, exportRecordingMidi, guitarRecordingFilename, } from './recording-export'
import type { GuitarPracticeScore } from './recording-types'

const score: GuitarPracticeScore = {
  id: 'accepted',
  recordingId: 'recording',
  revision: 2,
  title: 'My melody',
  createdAt: '',
  updatedAt: '',
  bpm: 96,
  timeSignature: [3, 4],
  grid: 'chosen',
  tuning: [64, 59, 55, 50, 45, 40],
  capo: 2,
  attachment: null,
  notes: [
    {
      id: 'a',
      evidenceId: 'a',
      midi: 42,
      startBeat: 0.5,
      endBeat: 1,
      string: 6,
      fret: 0,
    },
    {
      id: 'b',
      evidenceId: 'b',
      midi: 42,
      startBeat: 1,
      endBeat: 1.75,
      string: 6,
      fret: 0,
    },
    {
      id: 'c',
      evidenceId: 'c',
      midi: 57,
      startBeat: 2.5,
      endBeat: 4.5,
      string: 3,
      fret: 0,
    },
  ],
}

function readGpif(bytes: Uint8Array): Document {
  const files = unzipSync(bytes)
  expect(strFromU8(files.VERSION)).toBe('7.0')
  const xml = new DOMParser().parseFromString(
    strFromU8(files['Content/score.gpif']),
    'application/xml',
  )
  expect(xml.querySelector('parsererror')).toBeNull()
  return xml
}

// Independent of alphaTab's duration calculation: GP8 rejects malformed bars
// even when an export -> import round trip through the same library succeeds.
function expectBalancedNotation(xml: Document): void {
  expect(xml.querySelector('PrimaryTuplet, SecondaryTuplet')).toBeNull()
  const values: Record<string, number> = {
    Whole: 32,
    Half: 16,
    Quarter: 8,
    Eighth: 4,
    '16th': 2,
    '32nd': 1,
  }
  const rhythms = new Map(
    [...xml.querySelectorAll('Rhythms > Rhythm')].map((rhythm) => {
      const units = values[rhythm.querySelector('NoteValue')!.textContent!]
      const dots = Number(
        rhythm.querySelector('AugmentationDot')?.getAttribute('count') ?? 0,
      )
      expect(units).toBeGreaterThan(0)
      expect(dots).toBeLessThanOrEqual(1)
      return [rhythm.id, units * (dots === 1 ? 1.5 : 1)]
    }),
  )
  const beats = new Map(
    [...xml.querySelectorAll('Beats > Beat')].map((beat) => [
      beat.id,
      rhythms.get(beat.querySelector('Rhythm')!.getAttribute('ref')!)!,
    ]),
  )
  const voices = new Map(
    [...xml.querySelectorAll('Voices > Voice')].map((voice) => [
      voice.id,
      voice
        .querySelector('Beats')!
        .textContent!.split(' ')
        .reduce((sum, id) => sum + beats.get(id)!, 0),
    ]),
  )
  const bars = new Map(
    [...xml.querySelectorAll('Bars > Bar')].map((bar) => [bar.id, bar]),
  )
  const masters = [...xml.querySelectorAll('MasterBars > MasterBar')]
  expect(masters.length).toBeGreaterThan(0)
  for (const master of masters) {
    const [num, den] = master
      .querySelector('Time')!
      .textContent!.split('/')
      .map(Number)
    for (const id of master.querySelector('Bars')!.textContent!.split(' ')) {
      for (const voice of bars
        .get(id)!
        .querySelector('Voices')!
        .textContent!.split(' ')) {
        expect(voices.get(voice), `bar ${id}, voice ${voice}`).toBe(
          (num * 32) / den,
        )
      }
    }
  }
}

describe('guitar recording exports', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })
  it('exports valid MIDI pitches outside the neck without inventing guitar fingering', async () => {
    const mixed = {
      ...score,
      notes: score.notes.map((note, index) =>
        index === 1 ? { ...note, midi: 28, string: null, fret: null } : note,
      ),
    }
    const imported = parseMidiSong(await exportRecordingMidi(mixed))!
    expect(
      imported.tracks.flatMap((track) => track.notes).map((note) => note.midi),
    ).toEqual([42, 28, 57])
    await expect(exportRecordingGuitarPro(mixed)).rejects.toThrow('tuning')
    expect(mixed.notes[1]).toMatchObject({ midi: 28, string: null, fret: null })
  })
  it('round-trips MIDI notes, rests, repeated pitch, tempo and metre', async () => {
    const bytes = await exportRecordingMidi(score)
    const imported = parseMidiSong(bytes)!
    expect(imported.bpm).toBe(96)
    expect(imported.timeSignatures?.[0]).toEqual({
      beat: 0,
      numerator: 3,
      denominator: 4,
    })
    const track = imported.tracks.find(
      (candidate) => candidate.notes.length > 0,
    )!
    expect(track.name).toBe('My melody')
    expect(track.sourceProgram).toBe(27)
    expect(
      track.notes.map((note) => [note.midi, note.startBeat, note.duration]),
    ).toEqual([
      [42, 0.5, 0.5],
      [42, 1, 0.75],
      [57, 2.5, 2],
    ])
  })
  it('writes actual GP7 and round-trips capo, strings and sustain over a bar line', async () => {
    const bytes = await exportRecordingGuitarPro(score)
    expect([...bytes.slice(0, 2)]).toEqual([0x50, 0x4b])
    const { importer } = await import('@coderline/alphatab')
    const model = importer.ScoreLoader.loadScoreFromBytes(bytes)
    const imported = scoreToMidiSong(model)
    expect(imported.bpm).toBe(96)
    expect(imported.timeSignatures?.[0]).toEqual({
      beat: 0,
      numerator: 3,
      denominator: 4,
    })
    const track = imported.tracks.find(
      (candidate) => candidate.notes.length > 0,
    )!
    expect(track.sourceTuning).toEqual(score.tuning)
    expect(track.sourceCapo).toBe(2)
    expect(
      track.notes.map((note) => [
        note.midi,
        note.startBeat,
        note.duration,
        note.stringIndex,
        note.fret,
      ]),
    ).toEqual([
      [42, 0.5, 0.5, 5, 0],
      [42, 1, 0.75, 5, 0],
      [57, 2.5, 2, 2, 0],
    ])
  })
  it('writes readable GP7 notation without changing free-timed practice or MIDI', async () => {
    const free = {
      ...score,
      notes: [{ ...score.notes[0], startBeat: 0.123, endBeat: 0.763 }],
    }
    const original = structuredClone(free)
    const bytes = await exportRecordingGuitarPro(free)
    expectBalancedNotation(readGpif(bytes))
    const { importer } = await import('@coderline/alphatab')
    const imported = scoreToMidiSong(
      importer.ScoreLoader.loadScoreFromBytes(bytes),
    )
    const note = imported.tracks.flatMap((track) => track.notes)[0]
    expect(note.midi).toBe(42)
    expect(note.startBeat).toBe(0.125)
    expect(note.startBeat + note.duration).toBe(0.75)
    const midi = parseMidiSong(await exportRecordingMidi(free))!
    const exact = midi.tracks.flatMap((track) => track.notes)[0]
    expect(Math.abs(exact.startBeat - 0.123)).toBeLessThan(1 / 480)
    expect(Math.abs(exact.startBeat + exact.duration - 0.763)).toBeLessThan(
      1 / 480,
    )
    expect(free).toEqual(original)
  })
  it('retains a short note rounded past the final bar boundary in GP7', async () => {
    const boundary = {
      ...score,
      notes: [{ ...score.notes[0], startBeat: 2.9999, endBeat: 3 }],
    }
    const original = structuredClone(boundary)
    const bytes = await exportRecordingGuitarPro(boundary)
    const { importer } = await import('@coderline/alphatab')
    const imported = scoreToMidiSong(
      importer.ScoreLoader.loadScoreFromBytes(bytes),
    )
    const notes = imported.tracks.flatMap((track) => track.notes)
    expect(notes).toHaveLength(1)
    expect(notes[0].midi).toBe(42)
    expect(notes[0].startBeat).toBe(3)
    expect(notes[0].duration).toBe(0.125)
    expectBalancedNotation(readGpif(bytes))
    expect(boundary).toEqual(original)
  })
  it('rejects GP7 notation collisions without dropping notes or shifting the whole phrase', async () => {
    const colliding = {
      ...score,
      notes: [
        { ...score.notes[0], startBeat: 0, endBeat: 0.0001 },
        {
          ...score.notes[1],
          midi: 43,
          fret: 1,
          startBeat: 0.0001,
          endBeat: 0.0002,
        },
      ],
    }
    const original = structuredClone(colliding)
    await expect(exportRecordingGuitarPro(colliding)).rejects.toThrow(
      'Some note attacks are too close for thirty-second-note notation',
    )
    expect(colliding).toEqual(original)
    const midi = parseMidiSong(await exportRecordingMidi(colliding))!
    expect(
      midi.tracks
        .flatMap((track) => track.notes)
        .map((note) => note.midi)
        .sort((a, b) => a - b),
    ).toEqual([42, 43])
  })
  it.each([
    [3, 4],
    [4, 4],
    [5, 8],
    [7, 16],
    [6, 8],
    [2, 2],
  ] as const)(
    'balances notes, dotted durations, rests and ties in %s/%s without arbitrary tuplets',
    async (numerator, denominator) => {
      const uneven = {
        ...score,
        timeSignature: [numerator, denominator] as [number, number],
        notes: Array.from({ length: 36 }, (_, index) => ({
          ...score.notes[index % 3],
          id: `note-${index}`,
          startBeat: index * 0.731 + 0.017,
          endBeat: index * 0.731 + 0.129 + (index % 7) * 0.091,
        })),
      }
      const bytes = await exportRecordingGuitarPro(uneven)
      expectBalancedNotation(readGpif(bytes))
      const { importer } = await import('@coderline/alphatab')
      const notes = scoreToMidiSong(
        importer.ScoreLoader.loadScoreFromBytes(bytes),
      ).tracks.flatMap((track) => track.notes)
      expect(notes.map((note) => note.midi)).toEqual(
        uneven.notes.map((note) => note.midi),
      )
      for (let index = 0; index < notes.length; index++) {
        expect(
          Math.abs(notes[index].startBeat - uneven.notes[index].startBeat),
        ).toBeLessThanOrEqual(1 / 16)
        expect(notes[index].duration).toBeGreaterThan(0)
      }
    },
  )
  it.each(['guitar', 'bass'] as const)(
    'writes native %s identity, clef and octave display without transposing audio',
    async (instrument) => {
      // Explicit bass can have six strings: do not infer its identity from count.
      const bytes = await exportRecordingGuitarPro({
        ...score,
        instrument,
        title: 'Riff <&> "lead"',
      })
      const xml = readGpif(bytes)
      expect(xml.querySelector('Score > Title')!.textContent).toBe(
        'Riff <&> "lead"',
      )
      expect(
        xml.querySelector('Property[name="Tuning"] > Instrument')!.textContent,
      ).toBe(instrument === 'bass' ? 'Bass' : 'Guitar')
      expect(xml.querySelector('Track > Transpose > Octave')!.textContent).toBe(
        '-1',
      )
      expect(
        [...xml.querySelectorAll('MasterBar > Key > AccidentalCount')].every(
          (key) => key.textContent === '0',
        ),
      ).toBe(true)
      expect(xml.querySelector('Bar > Clef')!.textContent).toBe(
        instrument === 'bass' ? 'F4' : 'G2',
      )
      expect(
        xml.querySelector('Property[name="FretCount"] > Number')!.textContent,
      ).toBe('24')
      const { importer } = await import('@coderline/alphatab')
      const imported = scoreToMidiSong(
        importer.ScoreLoader.loadScoreFromBytes(bytes),
      )
      expect(
        imported.tracks
          .flatMap((track) => track.notes)
          .map((note) => note.midi),
      ).toEqual([42, 42, 57])
    },
  )
  it('makes lowercase filenames with a compact local date and seconds', () => {
    expect(
      guitarRecordingFilename(
        '../My RIFF',
        'gp',
        new Date(2026, 8, 8, 13, 0, 54, 99),
      ),
    ).toBe('melody-my-riff-20260908-130054.gp')
  })
  it.each([
    '',
    '../?!',
    'Guitar melody',
    'Guitar melody · 9/8/2026, 12:59:40 PM',
    'Guitar melody · 8. 9. 2026. 12:59:40',
  ])('does not repeat the generated title date: %s', (title) => {
    expect(
      guitarRecordingFilename(title, 'mid', new Date(2026, 8, 8, 0, 4, 5)),
    ).toBe('melody-20260908-000405.mid')
  })
  it('retains user names, collapses separators and bounds the slug', () => {
    const now = new Date(2026, 8, 8, 13, 0, 54)
    expect(guitarRecordingFilename('Guitar melody · Sunset', 'mid', now)).toBe(
      'melody-guitar-melody-sunset-20260908-130054.mid',
    )
    expect(guitarRecordingFilename('  ÉTÉ__ Riff / 2  ', 'mid', now)).toBe(
      'melody-été-riff-2-20260908-130054.mid',
    )
    expect(guitarRecordingFilename('A'.repeat(100), 'mid', now)).toBe(
      `melody-${'a'.repeat(48)}-20260908-130054.mid`,
    )
  })
  it('adds a short counter to repeated same-second downloads inside the review', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 8, 8, 13, 0, 54))
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:score-export')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const host = document.createElement('div')
    const filenames: string[] = []
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      expect(this.parentElement).toBe(host)
      filenames.push(this.download)
    })
    await downloadRecordingScore(score, 'mid', host)
    await downloadRecordingScore(score, 'mid', host)
    expect(filenames).toEqual([
      'melody-my-melody-20260908-130054.mid',
      'melody-my-melody-20260908-130054-2.mid',
    ])
    expect(host.childElementCount).toBe(0)
    vi.runAllTimers()
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(2)
  })
})
