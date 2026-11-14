// Studio MIDI preview snapshot — the song as the transport plays it while MIDI clips wait for their renders to be kept: each such clip on the preview of its notes.
//
// The song keeps every clip on its own audio until a render is kept
// (midi-render-commands.ts). The transport plays a copy instead, in which a
// clip with a preview ready plays it through its lane's own chain, and the
// assets list holds the previews played. A preview too short for a clip's
// window or passes is passed over, and the clip plays its own audio.
import type { StudioAsset, StudioClip, StudioProject, } from '@/lib/studio/model/types'
import { validateClipAsset } from '@/lib/studio/model/validation-clips'

export interface StudioMidiSnapshot {
  readonly project: StudioProject
  readonly assets: readonly StudioAsset[]
}

function holds(clip: StudioClip, asset: StudioAsset): boolean {
  try {
    validateClipAsset(clip, asset)
    return true
  } catch {
    return false
  }
}

/**
 * `project` with each clip `previewOf` gives a preview for playing it, and
 * `assets` with those previews. The very objects given when no clip has one,
 * so a transport that follows the song sees no change.
 */
export function studioMidiPreviewSnapshot(
  project: StudioProject,
  assets: readonly StudioAsset[],
  previewOf: (clip: StudioClip) => StudioAsset | undefined,
): StudioMidiSnapshot {
  const played = new Map<string, StudioAsset>()
  const clips = project.clips.map((clip) => {
    const preview = clip.midi === undefined ? undefined : previewOf(clip)
    if (preview === undefined || !holds(clip, preview)) return clip
    played.set(preview.id, preview)
    return { ...clip, assetId: preview.id }
  })
  if (played.size === 0) return { project, assets }
  return {
    project: { ...project, clips },
    assets: [...assets, ...played.values()],
  }
}
