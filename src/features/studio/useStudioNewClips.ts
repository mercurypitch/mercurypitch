// ============================================================
// Studio new clips — New lane's three choices, and an empty MIDI clip made in a lane, each new clip selected and opened in the note editor to draw in
// ============================================================
//
// Audio makes an empty lane for takes, selected so the next take lands on
// it. Piano and Drums make a lane with that role and an empty clip four
// bars long from the playhead's bar; a double-click or two taps on an empty
// stretch of a lane that plays MIDI make one there (the timeline works out
// where: new-midi-clips.ts, studioNewClipPlace). Either way the clip comes
// from the builder, its lane with it, as one undo step (controller
// addMidiClips), and opens in the note editor in Draw: on a phone the
// editor fills the screen, and the Add takes sheet it was made from gives
// way (docs/plans/studio-midi-clips.md, 1.3).
import { createStudioTrack } from '@/lib/studio/model/defaults'
import type { StudioNewMidiClip } from '@/lib/studio/model/new-midi-clips'
import { studioNewClipPlace } from '@/lib/studio/model/new-midi-clips'
import type { StudioProject } from '@/lib/studio/model/types'
import type { NoteEditTool } from './notes/edit-types'
import type { StudioNewClipSpan, StudioNewLaneKind } from './timeline/types'
import type { StudioController } from './useStudioController'

export interface StudioNewClipsOptions {
  /** The Studio's controller, read as it acts. */
  studio(): Pick<StudioController, 'project' | 'dispatch' | 'addMidiClips'>
  /** Where the playhead is: a Piano or Drums lane's clip starts at its bar. */
  playheadFrame(): number
  /** Select an empty lane, with no clip. */
  selectLane(trackId: string): void
  /** Open a clip's notes, selecting it. */
  openNotes(clipId: string, tool: NoteEditTool): void
  /** Said to assistive tech. */
  announce(words: string): void
}

/** `base`, or `base 2`, `base 3`... the first a lane of the song is not already called. */
export function studioNewLaneName(
  project: Pick<StudioProject, 'tracks'>,
  base: string,
): string {
  const taken = new Set(project.tracks.map((track) => track.name))
  if (!taken.has(base)) return base
  let number = 2
  while (taken.has(`${base} ${number}`)) number++
  return `${base} ${number}`
}

export function useStudioNewClips(options: StudioNewClipsOptions) {
  /** An empty lane for takes, selected, so the next take lands on it. */
  function audioLane(project: StudioProject): void {
    const tracks = project.tracks
    const track = createStudioTrack({
      id: globalThis.crypto.randomUUID(),
      name: `Lane ${tracks.length + 1}`,
      order: Math.max(-1, ...tracks.map((item) => item.order)) + 1,
    })
    if (options.studio().dispatch({ type: 'add-track', track })) {
      options.selectLane(track.id)
      options.announce(`${track.name} added and selected.`)
    }
  }

  /** The clip made, then opened in Draw; nothing when the song refused it, which its import notice says. */
  async function make(clip: StudioNewMidiClip, words: string): Promise<void> {
    const made = await options.studio().addMidiClips([clip])
    const clipId = made?.[0]
    if (clipId === undefined) return
    options.openNotes(clipId, 'draw')
    options.announce(words)
  }

  return {
    /** New lane's choice: an audio lane, or a Piano or Drums lane with an empty clip from the playhead's bar. */
    newLane(kind: StudioNewLaneKind): void {
      const project = options.studio().project()
      if (project === null) return
      if (kind === 'audio') return audioLane(project)
      const name = studioNewLaneName(
        project,
        kind === 'piano' ? 'Piano' : 'Drums',
      )
      const place = studioNewClipPlace(project, null, options.playheadFrame())
      if ('refusal' in place) return
      void make(
        { lane: { name, role: kind }, ...place },
        `${name} added, its empty clip open to draw in.`,
      )
    },
    /** An empty clip on lane `trackId` where `place` says. */
    newClip(trackId: string, place: StudioNewClipSpan): void {
      const lane = options
        .studio()
        .project()
        ?.tracks.find((track) => track.id === trackId)
      if (lane === undefined) return
      void make(
        { lane: { trackId }, ...place },
        `A new clip on ${lane.name}, open to draw in.`,
      )
    },
  }
}
