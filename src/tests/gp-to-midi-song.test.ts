import * as alphaTab from '@coderline/alphatab'
import { scoreToMidiSong } from '@/lib/tab/gp-to-midi-song'

// Build a Score from alphaTab's text format (AlphaTex) so the fixture is
// copyright-free and the real importer exercises the same beat/timing model
// that the binary .gp* importers produce.
function scoreFromTex(tex: string): alphaTab.model.Score {
  const importer = new alphaTab.importer.AlphaTexImporter()
  importer.initFromString(tex, new alphaTab.Settings())
  return importer.readScore()
}

describe('scoreToMidiSong', () => {
  it('maps beats to MidiSong notes with beat-based timing', () => {
    // quarter, then two eighths, then (next bar) a half note, then a rest.
    const score = scoreFromTex(
      '\\title "Test" \\tempo 120 . 3.3.4 5.3.8 7.3.8 | 0.4.2 r.2',
    )
    const song = scoreToMidiSong(score)

    expect(song.bpm).toBe(120)
    expect(song.tracks.length).toBe(1)

    const notes = song.tracks[0].notes
    expect(notes.length).toBe(4) // the rest is skipped
    // Timing + preserved fingering (string 3 / fret 3 on standard tuning).
    expect(notes[0]).toEqual({
      midi: 58,
      startBeat: 0,
      duration: 1,
      stringIndex: 2,
      fret: 3,
    })
    expect(notes[1].startBeat).toBeCloseTo(1)
    expect(notes[1].duration).toBeCloseTo(0.5)
    expect(notes[2].startBeat).toBeCloseTo(1.5)
    expect(notes[3].midi).toBe(50)
    expect(notes[3].duration).toBeCloseTo(2)
    expect(notes[3].stringIndex).toBe(3) // open D string
    expect(notes[3].fret).toBe(0)
  })

  it('preserves the real string index for 7-string tabs', () => {
    // 7-string standard tuning (high to low); play the low B (7th) string open.
    const score = scoreFromTex('\\tuning E4 B3 G3 D3 A2 E2 B1 . 0.7.4')
    const song = scoreToMidiSong(score)
    const note = song.tracks[0].notes[0]
    expect(note.stringIndex).toBe(6) // 7th string -> index 6 (lowest)
    expect(note.fret).toBe(0)
    expect(note.midi).toBe(35) // B1
  })

  it('rounds the tempo and reports a note count', () => {
    const song = scoreToMidiSong(scoreFromTex('\\tempo 95 . 0.6.4 0.6.4'))
    expect(song.bpm).toBe(95)
    expect(song.tracks[0].noteCount).toBe(2)
  })

  it('lets a let-ring note ring until the next note on the same string', () => {
    // Eighth let-ring on string 3, an eighth rest, then a quarter back on
    // string 3 — the let-ring note should sustain from beat 0 to beat 1.
    const song = scoreToMidiSong(
      scoreFromTex('\\tempo 120 . 3.3{lr}.8 r.8 5.3.4'),
    )
    const notes = song.tracks[0].notes
    expect(notes.length).toBe(2)
    expect(notes[0].letRing).toBe(true)
    expect(notes[0].stringIndex).toBe(2)
    expect(notes[0].duration).toBeCloseTo(1) // extended from the 0.5 eighth
    expect(notes[1].startBeat).toBeCloseTo(1)
    expect(notes[1].letRing).toBeUndefined()
  })

  it('keeps a let-ring note at its notated length with no later same-string note', () => {
    // Let-ring on string 3, then a note on string 4 — string 3 is never
    // re-struck, so the duration stays the notated eighth.
    const song = scoreToMidiSong(scoreFromTex('\\tempo 120 . 3.3{lr}.8 5.4.4'))
    const notes = song.tracks[0].notes
    expect(notes[0].letRing).toBe(true)
    expect(notes[0].stringIndex).toBe(2)
    expect(notes[0].duration).toBeCloseTo(0.5)
  })
})
