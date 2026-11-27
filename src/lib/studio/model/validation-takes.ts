// ============================================================
// Studio take validation — a clip's other takes, each a clip of one take over the clip's span, inside its own audio
// ============================================================
//
// A clip with more than one take keeps the rest in `takes`, the playing one
// in its own fields, and `activeTake` says where that one stands
// (clip-takes.ts). The two fields come together. Each take is checked as
// the clip of one take it plays as, by the clip's own validator, so a take
// that would start before its audio, leave its pass or carry a broken comp
// is refused as such a clip is. The validator comes in as an argument, so
// this module and validation-clips.ts do not import each other.
import { STUDIO_MAX_CLIP_TAKES, studioClipTakeList } from './clip-takes'
import type { StudioClip } from './types'
import { arrayValue, frameValue, idValue, numberValue, record, requireValue, } from './validation-values'

/** The fields of a take that is not playing: its own sound, and its line-up with the playing one. */
function validateWaitingTake(raw: unknown, path: string): void {
  const take = record(
    raw,
    path,
    ['assetId', 'offsetFrames', 'gainDb', 'fades'],
    ['passes', 'comp'],
  )
  idValue(take.assetId, `${path}.assetId`)
  requireValue(
    Number.isSafeInteger(take.offsetFrames),
    `${path}.offsetFrames`,
    'Expected a whole number of frames',
  )
  numberValue(take.gainDb, `${path}.gainDb`, -60, 24)
}

/**
 * A clip's other takes, from its raw fields `value`: present with
 * `activeTake` or not at all; one to 31 of them; the playing one among
 * them; none on a MIDI clip. Each is then checked as the clip of one take it
 * plays as, by `validateClip`.
 */
export function validateClipTakes(
  clip: StudioClip,
  value: Record<string, unknown>,
  path: string,
  validateClip: (raw: unknown, path: string) => StudioClip,
): void {
  const listed = Object.hasOwn(value, 'takes')
  requireValue(
    listed === Object.hasOwn(value, 'activeTake'),
    `${path}.takes`,
    'A clip keeps its takes and the one it plays together',
  )
  if (!listed) return
  requireValue(
    clip.midi === undefined,
    `${path}.takes`,
    'A MIDI clip has one take',
  )
  const takes = arrayValue(value.takes, `${path}.takes`)
  requireValue(
    takes.length >= 1 && takes.length < STUDIO_MAX_CLIP_TAKES,
    `${path}.takes`,
    `A clip keeps 2 to ${STUDIO_MAX_CLIP_TAKES} takes`,
  )
  takes.forEach((take, index) =>
    validateWaitingTake(take, `${path}.takes[${index}]`),
  )
  const active = frameValue(value.activeTake, `${path}.activeTake`)
  requireValue(
    active <= takes.length,
    `${path}.activeTake`,
    "The playing take is not one of the clip's",
  )
  studioClipTakeList(clip).forEach((take, index) => {
    if (index === active) return
    const listedAt = index < active ? index : index - 1
    validateClip(take, `${path}.takes[${listedAt}]`)
  })
}
