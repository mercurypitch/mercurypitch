// Instrument resolver tests — every General MIDI program, kit, key, stem and role finds a glyph, names read as engineers write them, and a chosen instrument or an explicit role wins over a stale name.
import { describe, expect, it } from 'vitest'
import { TRACK_ROLES } from '@/lib/studio-fx/role-chains'
import { INSTRUMENT_FAMILIES, INSTRUMENT_GLYPHS, isInstrumentGlyph, } from './glyph-catalog'
import { GM_DRUM_KIT_GLYPHS, GM_PERCUSSION_KEY_GLYPHS, GM_PROGRAM_GLYPHS, ROLE_GLYPHS, STEM_GLYPHS, } from './import-sources'
import { INSTRUMENT_NAME_RULES, instrumentFromName } from './name-rules'
import { resolveInstrument, studioLaneInstrument } from './resolve'

describe('the instrument catalogue', () => {
  it('gives every glyph a family and every family a hero glyph it has', () => {
    const families = new Set<string>(INSTRUMENT_FAMILIES.map((f) => f.id))
    const ids = INSTRUMENT_GLYPHS.map((glyph) => glyph.id)

    expect(new Set(ids).size).toBe(58)
    expect(INSTRUMENT_GLYPHS.filter((g) => !families.has(g.family))).toEqual([])
    expect(
      INSTRUMENT_FAMILIES.filter((family) => !isInstrumentGlyph(family.hero)),
    ).toEqual([])
  })

  it('reaches every glyph from some program, key, kit, stem, role or name rule', () => {
    const reached = new Set<string>([
      ...GM_PROGRAM_GLYPHS.map(([glyph]) => glyph),
      ...GM_PERCUSSION_KEY_GLYPHS.values(),
      ...GM_DRUM_KIT_GLYPHS.values(),
      ...Object.values(STEM_GLYPHS),
      ...Object.values(ROLE_GLYPHS),
    ])
    const byNameOnly = INSTRUMENT_GLYPHS.filter((g) => !reached.has(g.id))

    expect(byNameOnly.map((g) => g.id)).toEqual(['metronome'])
    expect(instrumentFromName('Click')).toBe('metronome')
  })
})

describe('import evidence', () => {
  it('draws all 128 General MIDI programs with a catalogued glyph', () => {
    const resolved = Array.from({ length: 128 }, (_, gmProgram) =>
      resolveInstrument({ gmProgram, role: 'other' }),
    )

    expect(GM_PROGRAM_GLYPHS).toHaveLength(128)
    expect(resolved.filter((r) => r.from !== 'import')).toEqual([])
    expect(resolved.filter((r) => !isInstrumentGlyph(r.glyph))).toEqual([])
    expect(resolved.map((r) => r.glyph).slice(0, 8)).toEqual([
      'grand-piano',
      'grand-piano',
      'keyboard',
      'grand-piano',
      'keyboard',
      'keyboard',
      'grand-piano',
      'keyboard',
    ])
  })

  it('files one glyph under two families where the GM table does', () => {
    expect(resolveInstrument({ gmProgram: 32 })).toEqual({
      glyph: 'upright-bass',
      family: 'bass',
      from: 'import',
    })
    expect(resolveInstrument({ gmProgram: 43 })).toEqual({
      glyph: 'upright-bass',
      family: 'bowed',
      from: 'import',
    })
    expect(resolveInstrument({ gmProgram: 50 }).family).toBe('bowed')
    expect(resolveInstrument({ gmProgram: 52 }).glyph).toBe('choir')
    expect(resolveInstrument({ gmProgram: 118 }).glyph).toBe('drum-machine')
    expect(resolveInstrument({ gmProgram: 126 }).glyph).toBe('clap')
  })

  it('draws each kit piece from its percussion key, and the kit for any other', () => {
    const keys = Array.from({ length: 47 }, (_, i) => 35 + i)

    expect(keys.filter((key) => !GM_PERCUSSION_KEY_GLYPHS.has(key))).toEqual([])
    expect(
      [36, 38, 42, 49, 54, 56, 70, 75, 81].map(
        (gmPercussionKey) => resolveInstrument({ gmPercussionKey }).glyph,
      ),
    ).toEqual([
      'kick',
      'snare',
      'hi-hat',
      'cymbal',
      'tambourine',
      'cowbell',
      'shaker',
      'woodblock',
      'triangle',
    ])
    expect(resolveInstrument({ gmPercussionKey: 90 }).glyph).toBe('drums')
  })

  it('draws a percussion track by its kit, the drum kit when the kit is not listed', () => {
    expect(resolveInstrument({ gmDrumKit: 25 }).glyph).toBe('drum-machine')
    expect(resolveInstrument({ gmDrumKit: 48 }).glyph).toBe('timpani')
    expect(resolveInstrument({ gmDrumKit: 3 }).glyph).toBe('drums')
  })

  it('draws every separated stem', () => {
    expect(
      Object.keys(STEM_GLYPHS).map((stem) => resolveInstrument({ stem }).glyph),
    ).toEqual([
      'mic',
      'record',
      'song',
      'drums',
      'electric-bass',
      'acoustic-guitar',
      'grand-piano',
      'audio',
    ])
    expect(resolveInstrument({ stem: 'kazoo' }).from).toBe('unknown')
  })

  it('ignores a program outside General MIDI', () => {
    expect(resolveInstrument({ gmProgram: 128, role: 'piano' })).toEqual({
      glyph: 'grand-piano',
      family: 'keys',
      from: 'role',
    })
    expect(resolveInstrument({ gmProgram: 2.5 }).from).toBe('unknown')
  })
})

// The real-world names the taxonomy was drawn against; null: no rule speaks, the role decides.
const NAMES: readonly (readonly [string, string | null])[] = [
  ['Kick In', 'kick'],
  ['KickIn_01.wav', 'kick'],
  ['Bass Drum', 'kick'],
  ['Snare Top', 'snare'],
  ['SD_bottom.wav', 'snare'],
  ['OH L', 'cymbal'],
  ['OH_L.aif', 'cymbal'],
  ['Hi Hat', 'hi-hat'],
  ['HiHat.wav', 'hi-hat'],
  ['Toms', 'toms'],
  ['Room Mics', 'drums'],
  ['Drum Bus', 'drums'],
  ['808', 'drum-machine'],
  ['Perc', 'hand-drum'],
  ['Congas', 'hand-drum'],
  ['Shaker', 'shaker'],
  ['Tamb', 'tambourine'],
  ['Claps', 'clap'],
  ['Lead Vox', 'mic'],
  ['LeadVox_comp.wav', 'mic'],
  ['Vocal take 4', 'mic'],
  ['BGV 1', 'mics'],
  ['Harmonies', 'mics'],
  ['Choir', 'choir'],
  ['Tenor', null],
  ['Bass DI', 'electric-bass'],
  ['Upright Bass', 'upright-bass'],
  ['Sub Bass', 'synth-bass'],
  ['Moog Bass', 'synth-bass'],
  ['Acoustic Gtr', 'acoustic-guitar'],
  ['Gtr L', 'acoustic-guitar'],
  ['E-Gtr Crunch', 'electric-guitar'],
  ['E-Gtr_Crunch_02.wav', 'electric-guitar'],
  ['Ukulele', 'acoustic-guitar'],
  ['Mandolin', 'lute'],
  ['Harp', 'harp'],
  ['Piano', 'grand-piano'],
  ['Rhodes', 'keyboard'],
  ['Hammond B3', 'organ'],
  ['Organ', 'organ'],
  ['Keys', 'synth-keys'],
  ['Synth Lead', 'synth-lead'],
  ['Pad', 'synth-pad'],
  ['FX Riser', 'synth-fx'],
  ['Strings', 'violin'],
  ['Violins 1', 'violin'],
  ['Cello', 'cello'],
  ['Horns', 'trumpet'],
  ['French Horn', 'french-horn'],
  ['Trombone', 'trombone'],
  ['Alto Sax', 'saxophone'],
  ['Clarinet', 'clarinet'],
  ['Flute', 'flute'],
  ['Blues harp', 'harmonica'],
  ['Glockenspiel', 'mallets'],
  ['Timpani', 'timpani'],
  ['Steel Pan', 'steel-drum'],
  ['Click', 'metronome'],
  ['Full Mix', 'song'],
  ['Instrumental', 'record'],
  ['Track 1', null],
  ['Audio 3', null],
  ['Guitar Night take', 'acoustic-guitar'],
]

describe('track and file names', () => {
  it('reads all 63 real-world names as an engineer means them', () => {
    const read = NAMES.map(([name]) => [name, instrumentFromName(name)])

    expect(INSTRUMENT_NAME_RULES).toHaveLength(59)
    expect(read).toEqual(NAMES.map(([name, glyph]) => [name, glyph]))
  })

  it('keeps an explicit role over a stale name, and lets a name refine its own family', () => {
    const lane = (name: string, role: (typeof TRACK_ROLES)[number]) =>
      studioLaneInstrument({ name, role }).glyph

    expect(lane('Guitar take 3', 'voice')).toBe('mic')
    expect(lane('Kick', 'bass')).toBe('electric-bass')
    expect(lane('E-Gtr Crunch', 'acoustic-guitar')).toBe('electric-guitar')
    expect(lane('Pad', 'keys')).toBe('synth-pad')
    expect(lane('Congas', 'drums')).toBe('hand-drum')
    expect(lane('Kick_In.wav', 'other')).toBe('kick')
  })
})

describe('a Studio lane', () => {
  it('draws the instrument the singer chose over its name and role', () => {
    expect(
      studioLaneInstrument({
        instrument: 'trumpet',
        name: 'Vox',
        role: 'other',
      }),
    ).toEqual({ glyph: 'trumpet', family: 'brass', from: 'chosen' })
  })

  it('passes over a chosen instrument this build does not draw', () => {
    expect(
      studioLaneInstrument({
        instrument: 'theremin',
        name: 'Lead',
        role: 'voice',
      }),
    ).toEqual({ glyph: 'mic', family: 'voice', from: 'role' })
  })

  it('draws each role’s own glyph, and plain audio for a lane nothing describes', () => {
    const drawn = TRACK_ROLES.map((role) =>
      studioLaneInstrument({ name: 'Lane 2', role }),
    )

    expect(drawn.map((lane) => lane.glyph)).toEqual([
      'mic',
      'mics',
      'acoustic-guitar',
      'electric-guitar',
      'electric-bass',
      'grand-piano',
      'synth-keys',
      'drums',
      'record',
      'audio',
    ])
    expect(drawn.at(-1)!.from).toBe('unknown')
  })
})
