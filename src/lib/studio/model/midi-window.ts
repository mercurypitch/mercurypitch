// ============================================================
// Studio MIDI windows — how far a MIDI clip's window may run: past its audio, silent there until its render is kept, to its sequence's end, and five minutes into it at the most
// ============================================================
//
// A MIDI clip's notes are its source and its audio a cache of them
// (docs/plans/studio-midi.md, decision 7). So its window is bounded by its
// sequence, not by its audio (docs/plans/studio-midi-clips.md, 1.1): the
// window may run past the audio, and every frame of it there plays as
// silence (arrangement-plan.ts) until the render service keeps a render
// that covers it. Lengthening never waits on a render, and a new clip needs
// no stored silence of its own length.
//
// A render runs a tail past its sequence and is cut at the longest audio
// the Studio keeps (midi-preview-audio.ts), five minutes. A window that
// reached further could never be heard, so a MIDI clip's window ends five
// minutes into its sequence at the most.
//
// A trim of a MIDI clip's end past its sequence's end grows the sequence to
// cover it, as one undo step ('trim-tail', commands.ts): a sequence other
// clips share becomes the clip's own copy first, as a note edit makes one
// (sequence-commands.ts). Shortening leaves the sequence as long as it was,
// its notes past the window kept and not heard (docs/plans/studio-midi.md,
// decision 9). Lengthening changes `lengthTicks`, which is in the render
// key, so the clip's audio is then due a render.
//
// An audio clip's window stays inside its audio (validation-clips.ts), and
// a loop take's inside its pass (clip-passes.ts), MIDI or not.
import { studioTicksCovering } from '../midi/time'
import { withOwnSequence } from './sequence-commands'
import { studioSequence } from './sequences'
import type { StudioProject, StudioSequence } from './types'
import { STUDIO_SAMPLE_RATE } from './types'
import { requireValue } from './validation-values'

/** The furthest a MIDI clip's window reaches into its sequence: the longest audio the Studio keeps (import-limits.ts), so a render can cover all of it. */
export const STUDIO_MIDI_WINDOW_MOST_FRAMES = STUDIO_SAMPLE_RATE * 300

/** Why a MIDI clip cannot run further: said by a refusal. */
export const STUDIO_MIDI_WINDOW_LIMIT = 'A MIDI clip runs at most five minutes'

/** Whether source frame `frame` of a clip playing `sequence` lies inside the sequence: every tick it reaches into is one of the sequence's. */
export function studioSequenceCovers(
  sequence: Pick<StudioSequence, 'tempoBpm' | 'lengthTicks'>,
  frame: number,
): boolean {
  return studioTicksCovering(frame, sequence.tempoBpm) <= sequence.lengthTicks
}

/**
 * The song with clip `clipId`'s sequence long enough for its window to end
 * at source frame `sourceOutFrame`: grown to the fewest ticks that cover it,
 * on the clip's own copy, under `forkSequenceId`, when other clips share it.
 * The song as it was for an audio clip, and for a window its sequence
 * covers already.
 */
export function coverStudioMidiWindow(
  project: StudioProject,
  clipId: string,
  sourceOutFrame: number,
  forkSequenceId: string | undefined,
): StudioProject {
  const clip = project.clips.find((each) => each.id === clipId)
  const midi = clip?.midi
  const sequence = midi && studioSequence(project, midi.sequenceId)
  if (!clip || !midi || !sequence) return project
  if (studioSequenceCovers(sequence, sourceOutFrame)) return project
  requireValue(
    sourceOutFrame <= STUDIO_MIDI_WINDOW_MOST_FRAMES,
    `clip.${clip.id}.sourceOutFrame`,
    STUDIO_MIDI_WINDOW_LIMIT,
  )
  return withOwnSequence(
    project,
    { clip, midi },
    {
      ...sequence,
      lengthTicks: studioTicksCovering(sourceOutFrame, sequence.tempoBpm),
    },
    forkSequenceId,
  )
}
