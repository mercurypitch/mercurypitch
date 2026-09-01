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
    score.tracks[0].staves[0].bars[0].voices[0].beats[0].notes[0].dynamics =
      alphaTab.model.DynamicValue.FF
    const song = scoreToMidiSong(score)

    expect(song.bpm).toBe(120)
    expect(song.tracks.length).toBe(1)

    const notes = song.tracks[0].notes
    expect(notes.length).toBe(4) // the rest is skipped
    // Timing + preserved fingering (string 3 / fret 3 on standard tuning).
    expect(notes[0]).toMatchObject({
      midi: 58,
      startBeat: 0,
      duration: 1,
      velocity: 111,
      stringIndex: 2,
      fret: 3,
    })
    expect(notes[0].id).toMatch(/^gp-t0-s0-n\d+$/)
    expect(notes[0].notation).toBeUndefined()
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

  it('preserves the authored string when a harmonic changes sounding pitch', () => {
    // The fifth-fret natural harmonic on the low E sounds E4. Inferring its
    // row from pitch would incorrectly move it to the high-string side.
    const song = scoreToMidiSong(scoreFromTex('. 5.6{nh}.4'))
    const note = song.tracks[0].notes[0]

    expect(note).toMatchObject({
      midi: 64,
      stringIndex: 5,
      fret: 5,
      authoredFingering: true,
    })
  })

  it('rounds the tempo and reports a note count', () => {
    const song = scoreToMidiSong(scoreFromTex('\\tempo 95 . 0.6.4 0.6.4'))
    expect(song.bpm).toBe(95)
    expect(song.tracks[0].noteCount).toBe(2)
  })

  it('retains the authored GM program and classifies only guitar and bass programs', () => {
    const cases = [
      { program: 25, name: 'Steel part', family: 'acoustic-guitar' },
      { program: 30, name: 'Distorted part', family: 'electric-guitar' },
      { program: 33, name: 'Bass part', family: 'bass' },
      { program: 48, name: 'Lead guitar', family: 'neutral' },
      { program: 52, name: 'Vocals', family: 'neutral' },
      { program: 80, name: 'Synth lead', family: 'neutral' },
    ] as const

    const tracks = cases.map(({ program, name }) => {
      const score = scoreFromTex('. 3.3.4')
      score.tracks[0].name = name
      score.tracks[0].playbackInfo.program = program
      return scoreToMidiSong(score).tracks[0]
    })

    expect(
      tracks.map((track) => ({
        sourceProgram: track.sourceProgram,
        instrumentFamily: track.instrumentFamily,
      })),
    ).toEqual(
      cases.map(({ program, family }) => ({
        sourceProgram: program,
        instrumentFamily: family,
      })),
    )
  })

  it('does not invent piano program zero when playback info is absent', () => {
    const score = scoreFromTex('. 3.3.4')
    ;(
      score.tracks[0] as unknown as {
        playbackInfo: undefined
      }
    ).playbackInfo = undefined

    const track = scoreToMidiSong(score).tracks[0]

    expect(track.sourceProgram).toBeUndefined()
    expect(track).toMatchObject({
      instrumentName: 'Unknown Instrument',
      instrumentFamily: 'neutral',
    })
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
    expect(notes[0].notation).toEqual({ techniques: [{ kind: 'let-ring' }] })
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

  it('folds tied destinations into the authored sustain', () => {
    const song = scoreToMidiSong(
      scoreFromTex('\\tempo 120 . 3.3.4 3.3{t}.4 3.3{t}.4'),
    )
    const notes = song.tracks[0].notes

    expect(notes).toHaveLength(1)
    expect(notes[0]).toMatchObject({
      stringIndex: 2,
      fret: 3,
      duration: 3,
    })
  })

  it('keeps source tuning and resolves authored fingering through a capo', () => {
    const song = scoreToMidiSong(
      scoreFromTex('\\tuning E4 B3 G3 D3 A2 E2 \\capo 2 . 0.6.4 3.6.4'),
    )
    const track = song.tracks[0]

    expect(track.sourceTuning).toEqual([64, 59, 55, 50, 45, 40])
    expect(track.sourceTuningName).toBe('Guitar Standard Tuning')
    expect(track.sourceCapo).toBe(2)
    expect(track.notes[0]).toMatchObject({
      midi: 42,
      stringIndex: 5,
      fret: 0,
    })
  })

  it('preserves source-authored chords and technique relationships', () => {
    const score = scoreFromTex('. 3.3.4 5.3.4 3.3.4')
    const staff = score.tracks[0].staves[0]
    const beats = staff.bars[0].voices[0].beats
    const first = beats[0].notes[0]
    const second = beats[1].notes[0]
    const third = beats[2].notes[0]

    const chord = new alphaTab.model.Chord()
    chord.name = 'G7'
    staff.addChord('authored-g7', chord)
    beats[0].chordId = 'authored-g7'

    first.bendType = alphaTab.model.BendType.Bend
    first.addBendPoint(new alphaTab.model.BendPoint(0, 0))
    first.addBendPoint(new alphaTab.model.BendPoint(60, 4))
    first.slideInType = alphaTab.model.SlideInType.IntoFromBelow
    first.slideOutType = alphaTab.model.SlideOutType.Legato
    first.slideTarget = second
    first.isHammerPullOrigin = true
    first.hammerPullDestination = second
    first.vibrato = alphaTab.model.VibratoType.Wide
    first.isPalmMute = true
    first.isLetRing = true

    second.isHammerPullOrigin = true
    second.hammerPullDestination = third

    const notes = scoreToMidiSong(score).tracks[0].notes
    expect(notes[0].notation).toEqual({
      chordLabel: 'G7',
      techniques: [
        {
          kind: 'bend',
          bendType: 'bend',
          semitones: 2,
          points: [
            { at: 0, semitones: 0 },
            { at: 1, semitones: 2 },
          ],
        },
        { kind: 'slide', slideType: 'into-from-below', toFret: 3 },
        {
          kind: 'slide',
          slideType: 'legato',
          toFret: 5,
          toNoteId: notes[1].id,
        },
        { kind: 'hammer-on', toFret: 5, toNoteId: notes[1].id },
        { kind: 'vibrato', width: 'wide' },
        { kind: 'palm-mute' },
        { kind: 'let-ring' },
      ],
    })
    expect(notes[1].notation?.techniques).toContainEqual({
      kind: 'pull-off',
      toFret: 3,
      toNoteId: notes[2].id,
    })
  })

  it('keeps a modern indexed percussion articulation separate from pitch', () => {
    const score = scoreFromTex('. 3.3.4')
    const track = score.tracks[0]
    const staff = track.staves[0]
    const note = staff.bars[0].voices[0].beats[0].notes[0]
    staff.isPercussion = true
    track.name = 'Room Drums'
    track.percussionArticulations = [
      new alphaTab.model.InstrumentArticulation('Snare', 3, 38),
    ]
    note.percussionArticulation = 0
    note.dynamics = alphaTab.model.DynamicValue.F

    const mapped = scoreToMidiSong(score).tracks[0]

    expect(mapped).toMatchObject({
      kind: 'percussion',
      name: 'Room Drums',
      noteCount: 1,
      notes: [],
      droppedHitCount: 0,
    })
    if (mapped.kind !== 'percussion') throw new Error('Expected drums')
    expect(mapped.percussionHits[0]).toMatchObject({
      gmKey: 38,
      startBeat: 0,
      velocity: 95,
      source: {
        format: 'guitar-pro',
        articulationIndex: 0,
        label: 'Snare',
        staffLine: 3,
      },
    })
  })

  it('retains authored percussion accents independently from an audible modern choke strike', () => {
    const score = scoreFromTex('. 3.3.4 5.3.4 7.3.4 9.3.4')
    const track = score.tracks[0]
    const staff = track.staves[0]
    const notes = staff.bars[0].voices[0].beats.map((beat) => beat.notes[0])
    staff.isPercussion = true
    const rideChoke = new alphaTab.model.InstrumentArticulation(
      'Ride choke',
      1,
      51,
    )
    rideChoke.id = 94
    track.percussionArticulations = [rideChoke]
    const accents = [
      alphaTab.model.AccentuationType.None,
      alphaTab.model.AccentuationType.Normal,
      alphaTab.model.AccentuationType.Heavy,
      alphaTab.model.AccentuationType.Tenuto,
    ]
    notes.forEach((note, index) => {
      note.percussionArticulation = 0
      note.dynamics = alphaTab.model.DynamicValue.F
      note.accentuated = accents[index]
    })

    const mapped = scoreToMidiSong(score).tracks[0]
    if (mapped.kind !== 'percussion') throw new Error('Expected drums')

    expect(
      mapped.percussionHits.map((hit) => ({
        gmKey: hit.gmKey,
        velocity: hit.velocity,
        accent: hit.accent,
        articulation: hit.articulation,
      })),
    ).toEqual([
      {
        gmKey: 51,
        velocity: 95,
        accent: undefined,
        articulation: 'choke',
      },
      {
        gmKey: 51,
        velocity: 111,
        accent: 'normal',
        articulation: 'choke',
      },
      {
        gmKey: 51,
        velocity: 127,
        accent: 'heavy',
        articulation: 'choke',
      },
      {
        gmKey: 51,
        velocity: 95,
        accent: 'tenuto',
        articulation: 'choke',
      },
    ])
    expect(mapped.percussionHits[0]).not.toHaveProperty('accent')
  })

  it('resolves legacy direct percussion ids and reports unknown ones', () => {
    const score = scoreFromTex('. 3.3.4 5.3.4 7.3.4')
    const track = score.tracks[0]
    const staff = track.staves[0]
    const beats = staff.bars[0].voices[0].beats
    staff.isPercussion = true
    track.percussionArticulations = []
    beats[0].notes[0].percussionArticulation = 91
    beats[1].notes[0].percussionArticulation = 94
    beats[2].notes[0].percussionArticulation = 32

    const mapped = scoreToMidiSong(score).tracks[0]
    if (mapped.kind !== 'percussion') throw new Error('Expected drums')

    expect(mapped.percussionHits).toHaveLength(2)
    expect(mapped.percussionHits[0]).toMatchObject({
      gmKey: 38,
      source: { articulationId: 91, label: 'Snare rim shot' },
    })
    expect(mapped.percussionHits[1]).toMatchObject({
      gmKey: 51,
      articulation: 'choke',
      source: { articulationId: 94, label: 'Ride choke' },
    })
    expect(mapped.droppedHitCount).toBe(1)
  })
})

describe('time signatures', () => {
  it('states the signature every bar opens in', () => {
    const song = scoreToMidiSong(
      scoreFromTex('\\ts 3 4 . 3.3.4 3.3.4 3.3.4 | 3.3.4 3.3.4 3.3.4'),
    )
    expect(song.timeSignatures).toEqual([
      { beat: 0, numerator: 3, denominator: 4 },
      { beat: 3, numerator: 3, denominator: 4 },
    ])
  })

  it('follows a signature change onto the beat the bar starts', () => {
    const song = scoreToMidiSong(
      scoreFromTex(
        '. 3.3.4 3.3.4 3.3.4 3.3.4 | \\ts 6 8 3.3.8 3.3.8 3.3.8 3.3.8 3.3.8 3.3.8',
      ),
    )
    expect(song.timeSignatures).toEqual([
      { beat: 0, numerator: 4, denominator: 4 },
      { beat: 4, numerator: 6, denominator: 8 },
    ])
  })

  it('states common time for a score that never says otherwise', () => {
    const song = scoreToMidiSong(scoreFromTex('. 3.3.4 3.3.4 3.3.4 3.3.4'))
    expect(song.timeSignatures).toEqual([
      { beat: 0, numerator: 4, denominator: 4 },
    ])
  })
})
