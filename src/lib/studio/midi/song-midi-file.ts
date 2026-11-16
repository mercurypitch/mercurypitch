// ============================================================
// Studio song as a MIDI file — the notes a song's MIDI clips play, a track for each lane that holds them, each note where the song plays it
// ============================================================
//
// What a clip plays is what its lane's preview draws (preview.ts): the
// notes of its sequence starting inside its window. A note still sounding
// at the window's end is cut there, where the clip's audio stops.
//
// The file keeps one tempo, the song's (docs/plans/studio-midi-clips.md,
// 1.4), and a sequence keeps the tempo it was laid on, so a note is placed
// through frames: its tick becomes the song frame its clip plays it on
// (time.ts), and that frame becomes the file's tick at the song's tempo,
// to the nearest. A sequence laid on the song's tempo keeps its ticks
// exactly, shifted by where its clip starts; one laid on another tempo
// keeps its times in seconds, and its beats fall where they were played.
//
// A drum lane's notes go on channel 10 (index 9), General MIDI's kit; every
// other lane's on channel 1, after a program change to the acoustic grand,
// since a lane plays the kit or the piano (lane-sound.ts). A note's own
// channel is not written: the lane's sound decides it, as it decides what
// the Studio plays.
//
// One pitch on one channel sounds once at a time in a file: the note-off of
// a pitch ends every note of it then sounding, in most players. So where a
// lane's notes of one pitch overlap, the earlier is ended where the next
// starts, and of two starting on one tick the longer is kept.
//
// Mute, solo, gains, pans and fades are the mix's, not the notes': every
// lane holding a MIDI clip is in the file.
import { studioSequence } from '../model/sequences'
import type { StudioClip, StudioProject, StudioSequence, StudioTrack, } from '../model/types'
import { studioLaneMidiSound } from './lane-sound'
import type { StudioMidiFile, StudioMidiFileNote, StudioMidiFileTrack, } from './midi-file'
import { studioClipTickWindow, studioFramesToTicks, studioTickInWindow, studioTickToSongFrame, } from './time'

/** General MIDI's drum kit: channel 10, index 9. */
export const STUDIO_MIDI_DRUM_CHANNEL = 9
/** General MIDI's first program, the acoustic grand piano. */
export const STUDIO_MIDI_PIANO_PROGRAM = 0
/** A note-off's velocity when a note keeps none: the middle, as a sequence reads an absent one (0.5). */
const RELEASE_VELOCITY = 64

/** A note's velocity, 0 to 1, as a note-on carries it: 1 to 127, as the note editor reads it. */
export function studioMidiVelocity(velocity: number): number {
  return Math.min(127, Math.max(1, Math.round(velocity * 127)))
}

/** A note's release velocity, 0 to 1, as a note-off carries it: 0 to 127, and 64 when it keeps none. */
export function studioMidiReleaseVelocity(
  releaseVelocity: number | undefined,
): number {
  if (releaseVelocity === undefined) return RELEASE_VELOCITY
  return Math.min(127, Math.max(0, Math.round(releaseVelocity * 127)))
}

type MidiClip = StudioClip & { readonly midi: NonNullable<StudioClip['midi']> }

function isMidiClip(clip: StudioClip): clip is MidiClip {
  return clip.midi !== undefined
}

/** The file's tick on song frame `frame`, at the song's tempo. */
function fileTick(frame: number, tempoBpm: number): number {
  return Math.max(0, studioFramesToTicks(frame, tempoBpm))
}

/** The song frame a clip's window ends on: where its audio stops. */
function clipEndFrame(clip: StudioClip): number {
  return clip.startFrame + clip.sourceOutFrame - clip.sourceInFrame
}

/** The notes `clip` plays of `sequence`, in the file's ticks: those starting inside its window, each cut at its end. */
function clipNotes(
  clip: StudioClip,
  sequence: StudioSequence,
  tempoBpm: number,
): StudioMidiFileNote[] {
  const window = studioClipTickWindow(clip, sequence)
  const end = clipEndFrame(clip)
  return sequence.notes
    .filter((note) => studioTickInWindow(note.startTick, window))
    .map((note) => {
      const startTick = fileTick(
        studioTickToSongFrame(clip, sequence, note.startTick),
        tempoBpm,
      )
      const endFrame = Math.min(
        end,
        studioTickToSongFrame(
          clip,
          sequence,
          note.startTick + note.lengthTicks,
        ),
      )
      return {
        pitch: note.pitch,
        startTick,
        // A note shorter than the file's tick still sounds: a tick long.
        endTick: Math.max(startTick + 1, fileTick(endFrame, tempoBpm)),
        velocity: studioMidiVelocity(note.velocity),
        releaseVelocity: studioMidiReleaseVelocity(note.releaseVelocity),
      }
    })
}

/** `notes` with each pitch sounding once at a time: an overlapped note ends where the next of its pitch starts, the shorter of two starting together goes. */
function oneAtATime(notes: StudioMidiFileNote[]): StudioMidiFileNote[] {
  const byPitch = new Map<number, StudioMidiFileNote[]>()
  for (const note of notes) {
    const same = byPitch.get(note.pitch)
    if (same === undefined) byPitch.set(note.pitch, [note])
    else same.push(note)
  }
  const kept: StudioMidiFileNote[] = []
  for (const same of byPitch.values()) {
    same.sort((a, b) => a.startTick - b.startTick || b.endTick - a.endTick)
    let last: StudioMidiFileNote | null = null
    for (const note of same) {
      if (last !== null && note.startTick === last.startTick) continue
      if (last !== null && last.endTick > note.startTick)
        kept[kept.length - 1] = { ...last, endTick: note.startTick }
      kept.push(note)
      last = note
    }
  }
  return kept.sort((a, b) => a.startTick - b.startTick || a.pitch - b.pitch)
}

/** Lane `track` as a file's track: the notes its `clips` play, on its sound's channel, ending where its last clip ends. */
function laneTrack(
  project: StudioProject,
  track: StudioTrack,
  clips: readonly MidiClip[],
): StudioMidiFileTrack {
  const drums = studioLaneMidiSound(track) === 'drums'
  const notes: StudioMidiFileNote[] = []
  let endTick = 0
  for (const clip of clips) {
    const sequence = studioSequence(project, clip.midi.sequenceId)
    if (sequence === undefined) continue
    notes.push(...clipNotes(clip, sequence, project.tempoBpm))
    endTick = Math.max(endTick, fileTick(clipEndFrame(clip), project.tempoBpm))
  }
  return {
    name: track.name,
    channel: drums ? STUDIO_MIDI_DRUM_CHANNEL : 0,
    ...(drums ? {} : { program: STUDIO_MIDI_PIANO_PROGRAM }),
    endTick,
    notes: oneAtATime(notes),
  }
}

/** The lanes holding a MIDI clip, in the lanes' order: the file's tracks after its first. */
export function studioMidiLanes(
  project: Pick<StudioProject, 'tracks' | 'clips'>,
): StudioTrack[] {
  const lanes = new Set(
    project.clips.filter(isMidiClip).map((clip) => clip.trackId),
  )
  return project.tracks
    .filter((track) => lanes.has(track.id))
    .sort((a, b) => a.order - b.order)
}

/** The song's MIDI clips as a file: a track for each lane that holds one, in the lanes' order, under the song's title and tempo. */
export function studioSongMidiFile(project: StudioProject): StudioMidiFile {
  const midiClips = project.clips.filter(isMidiClip)
  const tracks = studioMidiLanes(project).map((track) =>
    laneTrack(
      project,
      track,
      midiClips.filter((clip) => clip.trackId === track.id),
    ),
  )
  return { name: project.title, tempoBpm: project.tempoBpm, tracks }
}

/** MIDI clip `clipId` alone as a file, a track of its lane's, at its place in the song; null when the song has no MIDI clip by that id. */
export function studioClipMidiFile(
  project: StudioProject,
  clipId: string,
): StudioMidiFile | null {
  const clip = project.clips.find((each) => each.id === clipId)
  const track = project.tracks.find((each) => each.id === clip?.trackId)
  if (clip === undefined || !isMidiClip(clip) || track === undefined)
    return null
  return {
    name: project.title,
    tempoBpm: project.tempoBpm,
    tracks: [laneTrack(project, track, [clip])],
  }
}
