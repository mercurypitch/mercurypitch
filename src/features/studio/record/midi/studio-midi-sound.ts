// Studio MIDI sound — which sound a MIDI lane plays, from its instrument, and what the lane says it plays as.
import type { ResolvedInstrument } from '@/lib/studio/instruments/resolve'
import { studioMidiSoundOf } from '@/lib/studio/midi/lane-sound'
import type { StudioMidiSoundKind } from '@/lib/studio/midi/render-key'

/** The sounds a MIDI lane can play today, as its render key names them; other instruments wait for sound banks. */
export type StudioMidiSound = StudioMidiSoundKind

/** The glyphs that are a piano, which the piano plays as itself. */
const PIANO_GLYPHS = new Set(['grand-piano', 'keyboard'])

/** A drum or percussion lane plays the drum kit; every other lane the piano (lane-sound.ts, which a render key reads too). */
export function studioMidiSound(
  instrument: Pick<ResolvedInstrument, 'family'>,
): StudioMidiSound {
  return studioMidiSoundOf(instrument)
}

/** What a MIDI lane says it plays as. */
export function studioMidiSoundWords(
  instrument: Pick<ResolvedInstrument, 'family' | 'glyph'>,
): string {
  if (studioMidiSound(instrument) === 'drums')
    return 'Plays the drum kit. A key with no drum plays nothing, and its note is still kept.'
  return PIANO_GLYPHS.has(instrument.glyph)
    ? 'Plays the piano.'
    : 'Plays as piano until this instrument has its own sound.'
}
