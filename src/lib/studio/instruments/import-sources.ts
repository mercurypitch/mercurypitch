// ============================================================
// Instrument import evidence — General MIDI programs, drum kits, percussion keys, stems and track roles, each to a glyph
// ============================================================
//
// What an imported track already says about itself. Programs are zero-based,
// as src/lib/midi-song.ts numbers them. A row names its family only where it
// differs from the glyph's own: GM 32, Acoustic Bass, draws the upright bass in
// the bass family, and GM 43, Contrabass, the same glyph with the bowed strings.
import type { TrackRole } from '@/lib/studio-fx/role-chains'
import type { InstrumentFamilyId, InstrumentGlyphId } from './glyph-catalog'

type Row = readonly [InstrumentGlyphId, InstrumentFamilyId?]

/** All 128 General MIDI melodic programs, by program number. */
export const GM_PROGRAM_GLYPHS: readonly Row[] = [
  ['grand-piano'], // 0 Acoustic Grand Piano
  ['grand-piano'], // 1 Bright Piano
  ['keyboard'], // 2 Electric Grand Piano
  ['grand-piano'], // 3 Honky-tonk Piano
  ['keyboard'], // 4 Electric Piano 1
  ['keyboard'], // 5 Electric Piano 2
  ['grand-piano'], // 6 Harpsichord
  ['keyboard'], // 7 Clavinet
  ['bells'], // 8 Celesta
  ['mallets'], // 9 Glockenspiel
  ['bells'], // 10 Music Box
  ['mallets'], // 11 Vibraphone
  ['mallets'], // 12 Marimba
  ['mallets'], // 13 Xylophone
  ['bells'], // 14 Tubular Bells
  ['zither'], // 15 Dulcimer
  ['organ'], // 16 Drawbar Organ
  ['organ'], // 17 Percussive Organ
  ['organ'], // 18 Rock Organ
  ['pipe-organ'], // 19 Church Organ
  ['organ'], // 20 Reed Organ
  ['accordion'], // 21 Accordion
  ['harmonica'], // 22 Harmonica
  ['accordion'], // 23 Tango Accordion
  ['acoustic-guitar'], // 24 Nylon Guitar
  ['acoustic-guitar'], // 25 Steel Guitar
  ['electric-guitar'], // 26 Jazz Guitar
  ['electric-guitar'], // 27 Clean Guitar
  ['electric-guitar'], // 28 Muted Guitar
  ['electric-guitar'], // 29 Overdriven Guitar
  ['electric-guitar'], // 30 Distortion Guitar
  ['electric-guitar'], // 31 Guitar Harmonics
  ['upright-bass'], // 32 Acoustic Bass
  ['electric-bass'], // 33 Fingered Bass
  ['electric-bass'], // 34 Picked Bass
  ['electric-bass'], // 35 Fretless Bass
  ['electric-bass'], // 36 Slap Bass 1
  ['electric-bass'], // 37 Slap Bass 2
  ['synth-bass'], // 38 Synth Bass 1
  ['synth-bass'], // 39 Synth Bass 2
  ['violin'], // 40 Violin
  ['violin'], // 41 Viola
  ['cello'], // 42 Cello
  ['upright-bass', 'bowed'], // 43 Contrabass
  ['violin'], // 44 Tremolo Strings
  ['violin'], // 45 Pizzicato Strings
  ['harp'], // 46 Orchestral Harp
  ['timpani'], // 47 Timpani
  ['violin'], // 48 String Ensemble 1
  ['violin'], // 49 String Ensemble 2
  ['violin'], // 50 Synth Strings 1
  ['violin'], // 51 Synth Strings 2
  ['choir'], // 52 Choir Aahs
  ['choir'], // 53 Voice Oohs
  ['choir'], // 54 Synth Voice
  ['synth-fx'], // 55 Orchestra Hit
  ['trumpet'], // 56 Trumpet
  ['trombone'], // 57 Trombone
  ['tuba'], // 58 Tuba
  ['trumpet'], // 59 Muted Trumpet
  ['french-horn'], // 60 French Horn
  ['trumpet'], // 61 Brass Section
  ['trumpet'], // 62 Synth Brass 1
  ['trumpet'], // 63 Synth Brass 2
  ['saxophone'], // 64 Soprano Sax
  ['saxophone'], // 65 Alto Sax
  ['saxophone'], // 66 Tenor Sax
  ['saxophone'], // 67 Baritone Sax
  ['clarinet'], // 68 Oboe
  ['clarinet'], // 69 English Horn
  ['clarinet'], // 70 Bassoon
  ['clarinet'], // 71 Clarinet
  ['flute'], // 72 Piccolo
  ['flute'], // 73 Flute
  ['flute'], // 74 Recorder
  ['pan-flute'], // 75 Pan Flute
  ['ocarina'], // 76 Blown Bottle
  ['flute'], // 77 Shakuhachi
  ['flute'], // 78 Whistle
  ['ocarina'], // 79 Ocarina
  ['synth-lead'], // 80 Square Lead
  ['synth-lead'], // 81 Sawtooth Lead
  ['synth-lead'], // 82 Calliope Lead
  ['synth-lead'], // 83 Chiff Lead
  ['synth-lead'], // 84 Charang Lead
  ['synth-lead'], // 85 Voice Lead
  ['synth-lead'], // 86 Fifths Lead
  ['synth-lead'], // 87 Bass + Lead
  ['synth-pad'], // 88 New Age Pad
  ['synth-pad'], // 89 Warm Pad
  ['synth-pad'], // 90 Polysynth Pad
  ['synth-pad'], // 91 Choir Pad
  ['synth-pad'], // 92 Bowed Pad
  ['synth-pad'], // 93 Metallic Pad
  ['synth-pad'], // 94 Halo Pad
  ['synth-pad'], // 95 Sweep Pad
  ['synth-fx'], // 96 Rain FX
  ['synth-fx'], // 97 Soundtrack FX
  ['synth-fx'], // 98 Crystal FX
  ['synth-fx'], // 99 Atmosphere FX
  ['synth-fx'], // 100 Brightness FX
  ['synth-fx'], // 101 Goblins FX
  ['synth-fx'], // 102 Echoes FX
  ['synth-fx'], // 103 Sci-Fi FX
  ['lute'], // 104 Sitar
  ['banjo'], // 105 Banjo
  ['lute'], // 106 Shamisen
  ['zither'], // 107 Koto
  ['kalimba'], // 108 Kalimba
  ['bagpipe'], // 109 Bag Pipe
  ['violin'], // 110 Fiddle
  ['clarinet'], // 111 Shanai
  ['bells'], // 112 Tinkle Bell
  ['cowbell'], // 113 Agogo
  ['steel-drum'], // 114 Steel Drums
  ['woodblock'], // 115 Woodblock
  ['hand-drum'], // 116 Taiko Drum
  ['toms'], // 117 Melodic Tom
  ['drum-machine'], // 118 Synth Drum
  ['cymbal'], // 119 Reverse Cymbal
  ['sound-fx'], // 120 Guitar Fret Noise
  ['sound-fx'], // 121 Breath Noise
  ['sound-fx'], // 122 Seashore
  ['sound-fx'], // 123 Bird Tweet
  ['sound-fx'], // 124 Telephone Ring
  ['sound-fx'], // 125 Helicopter
  ['clap', 'fx'], // 126 Applause
  ['sound-fx'], // 127 Gunshot
]

/** Drum kits on channel 10, by their GS and GM2 program numbers. Any other kit draws the drum kit. */
export const GM_DRUM_KIT_GLYPHS: ReadonlyMap<number, InstrumentGlyphId> =
  new Map([
    [0, 'drums'], // Standard
    [8, 'drums'], // Room
    [16, 'drums'], // Power
    [24, 'drum-machine'], // Electronic
    [25, 'drum-machine'], // TR-808
    [32, 'drums'], // Jazz
    [40, 'drums'], // Brush
    [48, 'timpani'], // Orchestra
    [56, 'sound-fx'], // SFX
    [127, 'drums'], // CM-64/32
  ])

/** The 47 General MIDI percussion keys, 35 to 81, for a kit split into its pieces. */
export const GM_PERCUSSION_KEY_GLYPHS: ReadonlyMap<number, InstrumentGlyphId> =
  new Map([
    [35, 'kick'], // Acoustic Bass Drum
    [36, 'kick'], // Bass Drum 1
    [37, 'snare'], // Side Stick
    [38, 'snare'], // Acoustic Snare
    [39, 'clap'], // Hand Clap
    [40, 'snare'], // Electric Snare
    [41, 'toms'], // Low Floor Tom
    [42, 'hi-hat'], // Closed Hi-Hat
    [43, 'toms'], // High Floor Tom
    [44, 'hi-hat'], // Pedal Hi-Hat
    [45, 'toms'], // Low Tom
    [46, 'hi-hat'], // Open Hi-Hat
    [47, 'toms'], // Low-Mid Tom
    [48, 'toms'], // Hi-Mid Tom
    [49, 'cymbal'], // Crash Cymbal 1
    [50, 'toms'], // High Tom
    [51, 'cymbal'], // Ride Cymbal 1
    [52, 'cymbal'], // Chinese Cymbal
    [53, 'cymbal'], // Ride Bell
    [54, 'tambourine'], // Tambourine
    [55, 'cymbal'], // Splash Cymbal
    [56, 'cowbell'], // Cowbell
    [57, 'cymbal'], // Crash Cymbal 2
    [58, 'shaker'], // Vibraslap
    [59, 'cymbal'], // Ride Cymbal 2
    [60, 'hand-drum'], // Hi Bongo
    [61, 'hand-drum'], // Low Bongo
    [62, 'hand-drum'], // Mute Hi Conga
    [63, 'hand-drum'], // Open Hi Conga
    [64, 'hand-drum'], // Low Conga
    [65, 'hand-drum'], // High Timbale
    [66, 'hand-drum'], // Low Timbale
    [67, 'cowbell'], // High Agogo
    [68, 'cowbell'], // Low Agogo
    [69, 'shaker'], // Cabasa
    [70, 'shaker'], // Maracas
    [71, 'flute'], // Short Whistle
    [72, 'flute'], // Long Whistle
    [73, 'shaker'], // Short Guiro
    [74, 'shaker'], // Long Guiro
    [75, 'woodblock'], // Claves
    [76, 'woodblock'], // Hi Wood Block
    [77, 'woodblock'], // Low Wood Block
    [78, 'hand-drum'], // Mute Cuica
    [79, 'hand-drum'], // Open Cuica
    [80, 'triangle'], // Mute Triangle
    [81, 'triangle'], // Open Triangle
  ])

/** Separated stems (UvrStemType in src/db/entities.ts). */
export const STEM_GLYPHS = {
  vocal: 'mic',
  instrumental: 'record',
  original: 'song',
  drums: 'drums',
  bass: 'electric-bass',
  guitar: 'acoustic-guitar',
  piano: 'grand-piano',
  other: 'audio',
} as const satisfies Record<string, InstrumentGlyphId>

export type InstrumentStem = keyof typeof STEM_GLYPHS

/** Each mix role's own glyph: what a lane draws when nothing else says more. */
export const ROLE_GLYPHS: Readonly<Record<TrackRole, InstrumentGlyphId>> = {
  voice: 'mic',
  'backing-vocals': 'mics',
  'acoustic-guitar': 'acoustic-guitar',
  'electric-guitar': 'electric-guitar',
  bass: 'electric-bass',
  piano: 'grand-piano',
  keys: 'synth-keys',
  drums: 'drums',
  backing: 'record',
  other: 'audio',
}
