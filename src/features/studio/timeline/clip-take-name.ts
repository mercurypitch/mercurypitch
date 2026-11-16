// Studio clip take name — a clip's take as its title band names it: its file's name without the extension, or else its lane's.
//
// Kept apart from the clip's component so a module can name a clip without
// importing the component and its stylesheets. The band's `display: flex`
// (StudioMidiClip.module.css) and `.clipTitle`'s `display: block`
// (StudioTimeline.module.css) tie on specificity, so their order decides: an
// import of StudioTimelineClip from a module the workspace reads before the
// timeline put the MIDI clip's sheet first, and a MIDI clip's tags fell to a
// second line of its band, where nothing shows.
import type { StudioAsset } from '@/lib/studio/model/types'

/** An audio file's extension, which adds nothing to a take's name. */
export const STUDIO_AUDIO_EXTENSION =
  /\.(wav|mp3|m4a|aac|ogg|oga|opus|flac|webm|aiff?)$/i

/** A clip's take as its band names it: its file's name without the extension, or else the lane's. */
export function studioClipTakeName(
  asset: Pick<StudioAsset, 'originalName'> | undefined,
  trackName: string,
): string {
  return (asset?.originalName ?? trackName).replace(STUDIO_AUDIO_EXTENSION, '')
}
