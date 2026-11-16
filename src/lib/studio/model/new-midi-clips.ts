// ============================================================
// Studio new MIDI clips — the edit that adds MIDI clips to a song, each with its sequence, on a lane of the song or a new one, as one undo step; and where a clip made at a moment of a lane goes
// ============================================================
//
// The builder (docs/plans/studio-midi-clips.md, 1.3):
//
//   studioNewMidiClips(project, clips, assetId, createId)
//     -> { command, clipIds }
//
// Each of `clips` says where a clip goes and what it plays: a lane of the
// song, `{ trackId }`, or a new lane below the others, `{ name, role }`;
// where it starts and how long it plays, in frames; and its notes, in ticks
// from its start at `tempoBpm` (the song's by default), none for a clip to
// draw in. The notes take ids 1, 2, 3... in the order given, and keep only
// the fields away from their defaults. Every clip plays `assetId`: a quarter
// second of mono silence (STUDIO_NEW_CLIP_SILENCE_FRAMES) that the caller
// keeps as a take is (controller/imports.ts, addMidiClips). The command is
// one batch, so one undo takes the clips, their sequences and their lanes
// away together, and applying it validates them.
//
// Every window runs past that silence, which a MIDI clip may do
// (midi-window.ts): it is silent there until its render is kept. A clip's
// render key is the key of what its audio is, an empty sequence of its
// length on its lane's sound. A clip made without notes is therefore not
// stale and renders nothing until a note is drawn; one made with notes is
// stale, so the render service renders it, and keeping that render is the
// caller's to ask for.
//
// studioNewClipPlace says where a clip made at a moment of a lane goes:
// four bars of the song's tempo from the bar under that moment, ending
// sooner where the lane's next clip starts, a bar long at the least.
import type { TrackRole } from '@/lib/studio-fx/role-chains'
import { studioLaneMidiSound } from '../midi/lane-sound'
import { studioMidiRenderKey } from '../midi/render-key'
import { studioTicksCovering } from '../midi/time'
import type { StudioCommand, StudioEdit } from './commands'
import { createStudioTrack } from './defaults'
import type { StudioClip, StudioNote, StudioProject, StudioSequence, StudioTrack, } from './types'
import { STUDIO_PPQ, STUDIO_SAMPLE_RATE } from './types'
import { requireValue } from './validation-values'

/** A quarter second of mono silence at 48 kHz: the audio every new MIDI clip plays until its render is kept. */
export const STUDIO_NEW_CLIP_SILENCE_FRAMES = STUDIO_SAMPLE_RATE / 4

/** How many bars a clip made in a lane runs, four beats each, as the note editor's bars are. */
export const STUDIO_NEW_CLIP_BARS = 4

/** Where a new clip goes: a lane of the song, or a new lane below the others. */
export type StudioNewMidiLane =
  | { readonly trackId: string }
  | { readonly name: string; readonly role: TrackRole }

/** A note of a new clip: its id is given by its place in the list. */
export type StudioNewMidiNote = Omit<StudioNote, 'id'>

/** One new MIDI clip: where it goes, when, how long, and what it plays. */
export interface StudioNewMidiClip {
  readonly lane: StudioNewMidiLane
  /** Where it starts in the song, in frames. */
  readonly startFrame: number
  /** How long it plays, in frames: its window, from its sequence's tick 0. */
  readonly frames: number
  /** Its notes, in ticks from its start at `tempoBpm`; none for a clip to draw in. */
  readonly notes?: readonly StudioNewMidiNote[]
  /** The tempo its ticks are laid on; the song's when absent. */
  readonly tempoBpm?: number
}

/** The edit that adds new MIDI clips, and their ids in the order asked. */
export interface StudioNewMidiClips {
  readonly command: StudioCommand
  readonly clipIds: readonly string[]
}

/** A note as the song keeps it: its id, and only the fields away from their defaults. */
function keptNote(note: StudioNewMidiNote, id: number): StudioNote {
  return {
    id,
    pitch: note.pitch,
    startTick: note.startTick,
    lengthTicks: note.lengthTicks,
    velocity: note.velocity,
    ...(note.releaseVelocity !== undefined &&
      note.releaseVelocity !== 0.5 && {
        releaseVelocity: note.releaseVelocity,
      }),
    ...(note.channel !== undefined &&
      note.channel !== 0 && { channel: note.channel }),
  }
}

function newSequence(
  clip: StudioNewMidiClip,
  songTempoBpm: number,
  id: string,
): StudioSequence {
  const tempoBpm = clip.tempoBpm ?? songTempoBpm
  const notes = (clip.notes ?? []).map((note, index) =>
    keptNote(note, index + 1),
  )
  return {
    id,
    ppq: STUDIO_PPQ,
    tempoBpm,
    lengthTicks: studioTicksCovering(clip.frames, tempoBpm),
    nextNoteId: notes.length + 1,
    notes,
  }
}

/**
 * The edit that adds `clips` to `project`, each with its sequence and, for
 * a new lane, the lane, all playing `assetId`, as one batch: one undo step.
 * `createId` makes every new id. Refused, as any command is, when a clip's
 * lane is not the song's or the song would not be valid with it.
 */
export function studioNewMidiClips(
  project: StudioProject,
  clips: readonly StudioNewMidiClip[],
  assetId: string,
  createId: () => string,
): StudioNewMidiClips {
  let order = Math.max(-1, ...project.tracks.map((track) => track.order)) + 1
  const edits: StudioEdit[] = []
  const clipIds: string[] = []
  for (const wanted of clips) {
    const { lane } = wanted
    let track: StudioTrack | undefined
    if ('trackId' in lane) {
      track = project.tracks.find((each) => each.id === lane.trackId)
      requireValue(
        track !== undefined,
        `track.${lane.trackId}`,
        'Lane does not exist',
      )
    } else {
      track = createStudioTrack({
        id: createId(),
        name: lane.name,
        order: order++,
        role: lane.role,
      })
      edits.push({ type: 'add-track', track })
    }
    const sequence = newSequence(wanted, project.tempoBpm, createId())
    const silence = { ...sequence, notes: [] }
    const clip: StudioClip = {
      id: createId(),
      trackId: track.id,
      assetId,
      startFrame: wanted.startFrame,
      sourceInFrame: 0,
      sourceOutFrame: wanted.frames,
      gainDb: 0,
      fades: { curve: 'linear-amplitude' },
      midi: {
        sequenceId: sequence.id,
        renderKey: studioMidiRenderKey(silence, studioLaneMidiSound(track)),
      },
    }
    edits.push({ type: 'add-sequence', sequence }, { type: 'add-clip', clip })
    clipIds.push(clip.id)
  }
  return { command: { type: 'batch', commands: edits }, clipIds }
}

/** Where a new clip goes in a lane, or why none can go there. */
export type StudioNewClipPlace =
  | { readonly startFrame: number; readonly frames: number }
  | { readonly refusal: string }

/** Said when a lane has no room for a bar where a clip was asked for. */
export const STUDIO_NEW_CLIP_NO_ROOM =
  'No room for a new clip here: it needs a bar before the next clip.'

/**
 * Where a clip made at song frame `frame` of lane `trackId` goes (null for
 * a new lane): from the start of the bar under `frame`, or the end of the
 * clip that runs into that bar, for four bars of the song's tempo, ending
 * sooner where the lane's next clip starts. A bar long at the least.
 */
export function studioNewClipPlace(
  project: Pick<StudioProject, 'tempoBpm' | 'clips'>,
  trackId: string | null,
  frame: number,
): StudioNewClipPlace {
  const bar = ((4 * 60) / project.tempoBpm) * STUDIO_SAMPLE_RATE
  const index = Math.max(0, Math.floor(frame / bar + 1e-9))
  const lane = project.clips.filter((clip) => clip.trackId === trackId)
  const end = (clip: StudioClip) =>
    clip.startFrame + clip.sourceOutFrame - clip.sourceInFrame
  const barStart = Math.round(index * bar)
  // A clip running into the bar: the new one starts where that one ends.
  const startFrame = Math.max(
    barStart,
    ...lane
      .filter((clip) => clip.startFrame < barStart && end(clip) > barStart)
      .map(end),
  )
  const next = Math.min(
    Math.round((index + STUDIO_NEW_CLIP_BARS) * bar),
    ...lane
      .filter((clip) => clip.startFrame >= startFrame)
      .map((clip) => clip.startFrame),
  )
  return next - startFrame >= Math.round(bar)
    ? { startFrame, frames: next - startFrame }
    : { refusal: STUDIO_NEW_CLIP_NO_ROOM }
}
