// ============================================================
// Studio clip focus — Up and Down on a focused clip move the focus to the nearest clip in the lane above or below
// ============================================================
//
// The design spec's key table (docs/plans/studio-v1/design-spec.md, Keyboard
// and focus): Up and Down on a focused clip move the focus to a nearby clip
// in the adjacent lane, as Left and Right nudge the clip along its own.
// Lanes go in the order the timeline draws them. A lane with no clip has
// nothing to take the focus and is passed over, so the keys reach every
// clip in the song; past the first or the last lane with one, they are
// left to the page. Focus only: the selection stays where it was.
import type { StudioClip, StudioProject } from '@/lib/studio/model/types'
import { clipEndFrame } from '../timeline/timeline-geometry'

/** How far `clip` lies from song frame `frame`: none where it plays across it, else to its nearer edge. */
function distanceFrom(clip: StudioClip, frame: number): number {
  if (frame < clip.startFrame) return clip.startFrame - frame
  const end = clipEndFrame(clip)
  return frame < end ? 0 : frame - end + 1
}

/**
 * The clip Up (`-1`) or Down (`1`) moves the focus to from clip `clipId`:
 * in the nearest lane that way with a clip, the clip nearest the focused
 * clip's start, the earlier of two as near. Null at the edge, or for a
 * clip the song no longer has.
 */
export function studioAdjacentLaneClip(
  project: StudioProject,
  clipId: string,
  direction: -1 | 1,
): StudioClip | null {
  const from = project.clips.find((clip) => clip.id === clipId)
  if (from === undefined) return null
  const lanes = [...project.tracks].sort((a, b) => a.order - b.order)
  const at = lanes.findIndex((track) => track.id === from.trackId)
  if (at < 0) return null
  for (
    let lane = at + direction;
    lane >= 0 && lane < lanes.length;
    lane += direction
  ) {
    const clips = project.clips.filter(
      (clip) => clip.trackId === lanes[lane].id,
    )
    if (clips.length === 0) continue
    let nearest = clips[0]
    for (const clip of clips.slice(1)) {
      const distance = distanceFrom(clip, from.startFrame)
      const best = distanceFrom(nearest, from.startFrame)
      if (
        distance < best ||
        (distance === best && clip.startFrame < nearest.startFrame)
      )
        nearest = clip
    }
    return nearest
  }
  return null
}
