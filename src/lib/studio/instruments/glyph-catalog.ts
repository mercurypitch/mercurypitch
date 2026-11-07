// ============================================================
// Instrument glyph catalogue — the families, their hues and the glyphs that draw instruments
// ============================================================
//
// Generated from the instrument taxonomy (docs/studio-instrument-glyphs.md),
// then kept by hand. A glyph's id is what a lane saves as its instrument, so an
// id is never renamed or reused; a new instrument gets a new id. Colour follows
// the part a track plays, not how its sound is made: synth strings sit with the
// bowed strings.

export const INSTRUMENT_FAMILIES = [
  { id: 'voice', name: 'Voice', hue: 'rose', hero: 'mic' },
  { id: 'keys', name: 'Keys', hue: 'teal', hero: 'keyboard' },
  {
    id: 'plucked',
    name: 'Plucked strings',
    hue: 'amber',
    hero: 'acoustic-guitar',
  },
  { id: 'bass', name: 'Bass', hue: 'orange', hero: 'electric-bass' },
  { id: 'bowed', name: 'Bowed strings', hue: 'sky', hero: 'violin' },
  { id: 'brass', name: 'Brass', hue: 'lime', hero: 'trumpet' },
  { id: 'woodwinds', name: 'Woodwinds', hue: 'lime', hero: 'saxophone' },
  {
    id: 'pitched-percussion',
    name: 'Pitched percussion',
    hue: 'violet',
    hero: 'mallets',
  },
  { id: 'drums', name: 'Drum kit', hue: 'violet', hero: 'drums' },
  {
    id: 'percussion',
    name: 'Hand and auxiliary percussion',
    hue: 'violet',
    hero: 'hand-drum',
  },
  {
    id: 'synth',
    name: 'Synths and electronic',
    hue: 'fuchsia',
    hero: 'synth-keys',
  },
  { id: 'backing', name: 'Backing and mix', hue: 'green', hero: 'record' },
  { id: 'fx', name: 'FX and other', hue: 'slate', hero: 'audio' },
] as const

export type InstrumentFamilyId = (typeof INSTRUMENT_FAMILIES)[number]['id']

/** The family hues: the Studio's six lane hues and four more (StudioPage.module.css). */
export type InstrumentHue =
  | 'amber'
  | 'fuchsia'
  | 'green'
  | 'lime'
  | 'orange'
  | 'rose'
  | 'sky'
  | 'slate'
  | 'teal'
  | 'violet'

export const INSTRUMENT_GLYPHS = [
  {
    id: 'mic',
    family: 'voice',
    label: 'Vocal',
    also: 'voice vox lead singer vocals',
  },
  {
    id: 'mics',
    family: 'voice',
    label: 'Backing vocals',
    also: 'harmony harmonies doubles bgv choir group',
  },
  {
    id: 'choir',
    family: 'voice',
    label: 'Choir',
    also: 'chorus ensemble satb voices',
  },
  {
    id: 'grand-piano',
    family: 'keys',
    label: 'Piano',
    also: 'piano grand upright honky-tonk harpsichord',
  },
  {
    id: 'keyboard',
    family: 'keys',
    label: 'Electric piano',
    also: 'rhodes wurlitzer wurli ep stage piano clavinet clav',
  },
  {
    id: 'synth-keys',
    family: 'keys',
    label: 'Synthesizer',
    also: 'synth keys keyboard moog prophet juno polysynth',
  },
  {
    id: 'organ',
    family: 'keys',
    label: 'Organ',
    also: 'hammond b3 leslie drawbar',
  },
  {
    id: 'pipe-organ',
    family: 'keys',
    label: 'Pipe organ',
    also: 'church organ',
  },
  {
    id: 'accordion',
    family: 'keys',
    label: 'Accordion',
    also: 'bandoneon concertina squeezebox',
  },
  {
    id: 'acoustic-guitar',
    family: 'plucked',
    label: 'Acoustic guitar',
    also: 'guitar nylon steel classical ukulele uke',
  },
  {
    id: 'electric-guitar',
    family: 'plucked',
    label: 'Electric guitar',
    also: 'guitar electric distortion overdrive lead rhythm',
  },
  { id: 'banjo', family: 'plucked', label: 'Banjo' },
  {
    id: 'lute',
    family: 'plucked',
    label: 'Lute',
    also: 'sitar oud mandolin bouzouki shamisen pipa balalaika',
  },
  { id: 'harp', family: 'plucked', label: 'Harp' },
  {
    id: 'zither',
    family: 'plucked',
    label: 'Zither',
    also: 'koto dulcimer guzheng autoharp',
  },
  {
    id: 'electric-bass',
    family: 'bass',
    label: 'Bass guitar',
    also: 'bass guitar fingered picked fretless slap',
  },
  {
    id: 'upright-bass',
    family: 'bass',
    label: 'Double bass',
    also: 'double bass contrabass acoustic',
  },
  {
    id: 'synth-bass',
    family: 'bass',
    label: 'Synth bass',
    also: 'sub bass 808 moog',
  },
  {
    id: 'violin',
    family: 'bowed',
    label: 'Violin',
    also: 'viola fiddle strings',
  },
  { id: 'cello', family: 'bowed', label: 'Cello', also: 'strings' },
  {
    id: 'trumpet',
    family: 'brass',
    label: 'Trumpet',
    also: 'cornet flugelhorn horns brass',
  },
  { id: 'trombone', family: 'brass', label: 'Trombone', also: 'bones' },
  { id: 'tuba', family: 'brass', label: 'Tuba', also: 'sousaphone euphonium' },
  { id: 'french-horn', family: 'brass', label: 'French horn', also: 'horn' },
  {
    id: 'saxophone',
    family: 'woodwinds',
    label: 'Saxophone',
    also: 'sax alto tenor baritone soprano',
  },
  {
    id: 'clarinet',
    family: 'woodwinds',
    label: 'Clarinet',
    also: 'oboe bassoon english horn cor anglais',
  },
  {
    id: 'flute',
    family: 'woodwinds',
    label: 'Flute',
    also: 'piccolo recorder whistle shakuhachi',
  },
  {
    id: 'pan-flute',
    family: 'woodwinds',
    label: 'Pan flute',
    also: 'pan pipes',
  },
  {
    id: 'ocarina',
    family: 'woodwinds',
    label: 'Ocarina',
    also: 'blown bottle',
  },
  { id: 'bagpipe', family: 'woodwinds', label: 'Bagpipes', also: 'pipes' },
  {
    id: 'harmonica',
    family: 'woodwinds',
    label: 'Harmonica',
    also: 'blues harp mouth organ',
  },
  {
    id: 'mallets',
    family: 'pitched-percussion',
    label: 'Mallets',
    also: 'xylophone marimba vibraphone vibes glockenspiel glock',
  },
  {
    id: 'bells',
    family: 'pitched-percussion',
    label: 'Bells',
    also: 'chimes celesta tubular bells music box',
  },
  {
    id: 'kalimba',
    family: 'pitched-percussion',
    label: 'Kalimba',
    also: 'mbira thumb piano',
  },
  {
    id: 'steel-drum',
    family: 'pitched-percussion',
    label: 'Steel drum',
    also: 'steel pan',
  },
  {
    id: 'timpani',
    family: 'pitched-percussion',
    label: 'Timpani',
    also: 'kettle drum timps',
  },
  { id: 'drums', family: 'drums', label: 'Drum kit', also: 'drum kit bus' },
  { id: 'kick', family: 'drums', label: 'Kick drum', also: 'bass drum bd' },
  { id: 'snare', family: 'drums', label: 'Snare drum', also: 'sd side stick' },
  { id: 'toms', family: 'drums', label: 'Toms', also: 'tom floor rack' },
  { id: 'hi-hat', family: 'drums', label: 'Hi-hat', also: 'hihat hats hh' },
  {
    id: 'cymbal',
    family: 'drums',
    label: 'Cymbal',
    also: 'cymbals ride crash china splash overheads',
  },
  {
    id: 'hand-drum',
    family: 'percussion',
    label: 'Hand drum',
    also: 'conga bongo djembe cajon timbale taiko percussion',
  },
  {
    id: 'shaker',
    family: 'percussion',
    label: 'Shaker',
    also: 'maracas cabasa guiro egg',
  },
  { id: 'tambourine', family: 'percussion', label: 'Tambourine', also: 'tamb' },
  { id: 'cowbell', family: 'percussion', label: 'Cowbell', also: 'agogo' },
  {
    id: 'woodblock',
    family: 'percussion',
    label: 'Wood block',
    also: 'wood block claves',
  },
  { id: 'triangle', family: 'percussion', label: 'Triangle' },
  {
    id: 'clap',
    family: 'percussion',
    label: 'Claps',
    also: 'claps handclap snaps applause',
  },
  {
    id: 'synth-lead',
    family: 'synth',
    label: 'Synth lead',
    also: 'lead synth saw arp',
  },
  {
    id: 'synth-pad',
    family: 'synth',
    label: 'Synth pad',
    also: 'pad atmosphere drone texture',
  },
  {
    id: 'synth-fx',
    family: 'synth',
    label: 'Risers and sweeps',
    also: 'riser sweep impact whoosh uplifter downlifter fx',
  },
  {
    id: 'drum-machine',
    family: 'drums',
    label: 'Drum machine',
    also: '808 909 beat machine',
  },
  {
    id: 'record',
    family: 'backing',
    label: 'Backing track',
    also: 'backing track instrumental karaoke playback',
  },
  {
    id: 'song',
    family: 'backing',
    label: 'Full mix',
    also: 'full mix master bounce stereo original reference',
  },
  { id: 'audio', family: 'fx', label: 'Audio', also: 'other unknown' },
  {
    id: 'sound-fx',
    family: 'fx',
    label: 'Sound effects',
    also: 'sfx foley noise effects',
  },
  { id: 'metronome', family: 'fx', label: 'Click', also: 'click count-in' },
] as const

export type InstrumentGlyphId = (typeof INSTRUMENT_GLYPHS)[number]['id']

export interface InstrumentGlyphInfo {
  readonly id: InstrumentGlyphId
  readonly family: InstrumentFamilyId
  /** What the picker and a screen reader call it. */
  readonly label: string
  /** More names a search finds it by. */
  readonly also?: string
}

export interface InstrumentFamilyInfo {
  readonly id: InstrumentFamilyId
  readonly name: string
  readonly hue: InstrumentHue
  /** The family's own glyph, drawn when only the family is known. */
  readonly hero: InstrumentGlyphId
}

const GLYPHS: ReadonlyMap<string, InstrumentGlyphInfo> = new Map(
  INSTRUMENT_GLYPHS.map((glyph) => [glyph.id, glyph]),
)
const FAMILIES: ReadonlyMap<string, InstrumentFamilyInfo> = new Map(
  INSTRUMENT_FAMILIES.map((family) => [family.id, family]),
)

export function isInstrumentGlyph(value: unknown): value is InstrumentGlyphId {
  return typeof value === 'string' && GLYPHS.has(value)
}

export function instrumentGlyph(id: InstrumentGlyphId): InstrumentGlyphInfo {
  return GLYPHS.get(id)!
}

export function instrumentFamily(id: InstrumentFamilyId): InstrumentFamilyInfo {
  return FAMILIES.get(id)!
}
