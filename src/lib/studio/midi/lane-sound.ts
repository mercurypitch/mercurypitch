// Studio MIDI lane sound — what a lane plays MIDI as, from the instrument it draws: the drum kit for drums and percussion, the piano for every other.
//
// A clip's render key names its lane's sound (render-key.ts), so the sound
// is read here for an arm, a render and a key alike. A lane given a drum
// instrument, or a name that reads as one, plays, records and renders the
// kit; its MIDI clips are then due a render as the kit.
import type { ResolvedInstrument } from '../instruments/resolve'
import { studioLaneInstrument } from '../instruments/resolve'
import type { StudioTrack } from '../model/types'
import type { StudioMidiSoundKind } from './render-key'

/** A drum or percussion instrument plays the drum kit; every other the piano. */
export function studioMidiSoundOf(
  instrument: Pick<ResolvedInstrument, 'family'>,
): StudioMidiSoundKind {
  return instrument.family === 'drums' || instrument.family === 'percussion'
    ? 'drums'
    : 'piano'
}

/** The sound `track` plays MIDI as. */
export function studioLaneMidiSound(
  track: Pick<StudioTrack, 'instrument' | 'name' | 'role'>,
): StudioMidiSoundKind {
  return studioMidiSoundOf(studioLaneInstrument(track))
}
