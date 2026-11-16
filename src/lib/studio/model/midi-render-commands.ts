// ============================================================
// Studio MIDI render command — a render kept as the audio of the MIDI clips it was rendered for
// ============================================================
//
// A clip's render is kept as an asset and swapped in by an amendment of
// the present (history.ts), with no undo step of its own: the edit that
// made the audio stale holds the step, so undo takes the notes and the
// audio that matched them back together.
//
// Only a clip whose audio no longer matches its notes, and whose notes on
// its lane's sound have the render's key now (clip-keys.ts), takes the new
// audio. A clip whose notes changed while the render ran keeps its audio,
// and so does one whose audio already matches, such as a take recorded
// from those notes. A MIDI clip's window may run past its audio, silent
// there (midi-window.ts), so the validator then refuses the song only
// when the new audio does not hold a loop take's passes. A render runs a
// tail past its sequence, so it covers every window its sequence allows.
import { studioMidiKeys } from '../midi/clip-keys'
import type { StudioProject } from './types'
import { idValue } from './validation-values'

export interface StudioMidiRenderEdit {
  readonly type: 'set-midi-render'
  /** The render's audio: the asset the stale clips play from now on. */
  readonly assetId: string
  /** What it was rendered from: the notes and the lane's sound (render-key.ts). */
  readonly renderKey: string
}

export function isStudioMidiRenderEdit(edit: {
  type: string
}): edit is StudioMidiRenderEdit {
  return edit.type === 'set-midi-render'
}

/** Every stale clip whose notes have `renderKey` now plays `assetId`; the song as it was when none does. */
export function applyStudioMidiRenderEdit(
  project: StudioProject,
  edit: StudioMidiRenderEdit,
): StudioProject {
  idValue(edit.assetId, 'render.assetId')
  const swapped = new Set(
    studioMidiKeys
      .staleClips(project)
      .filter((stale) => stale.key === edit.renderKey)
      .map((stale) => stale.clip.id),
  )
  if (swapped.size === 0) return project
  return {
    ...project,
    clips: project.clips.map((clip) =>
      swapped.has(clip.id) && clip.midi !== undefined
        ? {
            ...clip,
            assetId: edit.assetId,
            midi: { ...clip.midi, renderKey: edit.renderKey },
          }
        : clip,
    ),
  }
}
