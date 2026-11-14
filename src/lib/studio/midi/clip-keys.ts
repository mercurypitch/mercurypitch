// ============================================================
// Studio MIDI clip keys — the key each MIDI clip's audio should have now, and the clips whose audio no longer matches
// ============================================================
//
// A clip is stale when its render key no longer names its sequence's notes
// on its lane's sound (render-key.ts): its notes were edited, or it moved
// to a lane with the other sound. Stale audio is due a render.
//
// Hashing a 10,000-note sequence sorts and prints every note, which takes
// milliseconds, and the song is read again on every edit. So a key is
// cached per sequence object (a WeakMap). Every command and every undo
// hands back a whole new song, though: validation clones it, sequences
// included. So a new object that holds the same notes as the last one seen
// under its id takes that one's keys, after a plain comparison of fields,
// and an edit elsewhere in the song hashes nothing again. The last object
// per id is held weakly: the history keeps it alive while it matters.
import { sameStudioSequence } from '../model/sequences'
import type { StudioClip, StudioProject, StudioSequence, StudioTrack, } from '../model/types'
import { studioLaneMidiSound } from './lane-sound'
import type { StudioMidiSoundKind } from './render-key'
import { studioMidiRenderKey } from './render-key'

/** A MIDI clip whose audio no longer matches its notes or its lane's sound, with what it should be rendered from. */
export interface StudioStaleMidiClip {
  readonly clip: StudioClip
  readonly sequence: StudioSequence
  readonly sound: StudioMidiSoundKind
  /** The key its audio should have now. */
  readonly key: string
}

export interface StudioMidiKeys {
  /** The key of `sequence` on a lane that sounds as `sound`, hashed once per content. */
  key(sequence: StudioSequence, sound: StudioMidiSoundKind): string
  /** The key `clip`'s audio should have now; null for an audio clip, or one whose lane or sequence is gone. */
  clipKey(project: StudioProject, clip: StudioClip): string | null
  /** The MIDI clips whose audio is due a render, in the song's order. */
  staleClips(project: StudioProject): StudioStaleMidiClip[]
}

/** How many sequence ids the cache remembers the last object of. */
const REMEMBERED_IDS = 256

export function createStudioMidiKeys(
  hash: typeof studioMidiRenderKey = studioMidiRenderKey,
): StudioMidiKeys {
  const byObject = new WeakMap<
    StudioSequence,
    Map<StudioMidiSoundKind, string>
  >()
  const lastById = new Map<string, WeakRef<StudioSequence>>()

  /** The keys of `sequence`: its own, or those of the last object under its id when it holds the same notes. */
  function keysOf(sequence: StudioSequence): Map<StudioMidiSoundKind, string> {
    const own = byObject.get(sequence)
    if (own !== undefined) return own
    const before = lastById.get(sequence.id)?.deref()
    const shared =
      before !== undefined && sameStudioSequence(before, sequence)
        ? byObject.get(before)
        : undefined
    const keys = shared ?? new Map<StudioMidiSoundKind, string>()
    byObject.set(sequence, keys)
    lastById.delete(sequence.id)
    lastById.set(sequence.id, new WeakRef(sequence))
    if (lastById.size > REMEMBERED_IDS)
      lastById.delete(lastById.keys().next().value!)
    return keys
  }

  function key(sequence: StudioSequence, sound: StudioMidiSoundKind): string {
    const keys = keysOf(sequence)
    const known = keys.get(sound)
    if (known !== undefined) return known
    const made = hash(sequence, sound)
    keys.set(sound, made)
    return made
  }

  /** The song's lanes and sequences by id, read once for a pass over its clips. */
  function lookups(project: StudioProject) {
    const tracks = new Map<string, StudioTrack>(
      project.tracks.map((track) => [track.id, track]),
    )
    const sequences = new Map<string, StudioSequence>(
      (project.sequences ?? []).map((sequence) => [sequence.id, sequence]),
    )
    const sounds = new Map<string, StudioMidiSoundKind>()
    const soundOf = (track: StudioTrack): StudioMidiSoundKind => {
      let sound = sounds.get(track.id)
      if (sound === undefined) {
        sound = studioLaneMidiSound(track)
        sounds.set(track.id, sound)
      }
      return sound
    }
    return { tracks, sequences, soundOf }
  }

  function wanted(
    clip: StudioClip,
    found: ReturnType<typeof lookups>,
  ): Omit<StudioStaleMidiClip, 'clip'> | null {
    if (clip.midi === undefined) return null
    const track = found.tracks.get(clip.trackId)
    const sequence = found.sequences.get(clip.midi.sequenceId)
    if (track === undefined || sequence === undefined) return null
    const sound = found.soundOf(track)
    return { sequence, sound, key: key(sequence, sound) }
  }

  return {
    key,
    clipKey(project, clip) {
      return wanted(clip, lookups(project))?.key ?? null
    },
    staleClips(project) {
      if ((project.sequences?.length ?? 0) === 0) return []
      const found = lookups(project)
      const stale: StudioStaleMidiClip[] = []
      for (const clip of project.clips) {
        const now = wanted(clip, found)
        if (now !== null && now.key !== clip.midi?.renderKey)
          stale.push({ clip, ...now })
      }
      return stale
    },
  }
}

/** The keys the song's commands and the Studio's renders share. */
export const studioMidiKeys: StudioMidiKeys = createStudioMidiKeys()
