// Studio project validation — strict versioned snapshots and owned-source references for local saves and backups.
import { LOUDNESS_PRESETS } from '@/lib/studio-fx/master'
import { MIX_FLAVOURS } from '@/lib/studio-fx/mix-macros'
import type { StudioAsset, StudioProject } from './types'
import { STUDIO_ENGINE_VERSION, STUDIO_SAMPLE_RATE, STUDIO_SCHEMA_VERSION, } from './types'
import { validateStudioAsset } from './validation-assets'
import { assertNoLaneOverlaps, validateClipAsset, validateStudioClip, validateStudioTrack, } from './validation-clips'
import { validateStudioMacros, validateStudioMasterEq } from './validation-fx'
import { arrayValue, enumValue, frameValue, idValue, isoValue, numberValue, record, requireValue, textValue, uniqueValue, } from './validation-values'

export { validateStudioAsset } from './validation-assets'
export { validateStudioClip, validateStudioTrack } from './validation-clips'
export { validateStudioChain } from './validation-fx'
export { StudioValidationError } from './validation-values'

/** Omitting assets validates structure only; persistence must supply its full owned metadata catalogue. */
export function validateStudioProject(
  raw: unknown,
  assets?: readonly StudioAsset[],
): StudioProject {
  const value = record(raw, 'project', [
    'id',
    'schemaVersion',
    'revision',
    'title',
    'createdAt',
    'updatedAt',
    'sampleRate',
    'tempoBpm',
    'ruler',
    'tracks',
    'clips',
    'mix',
    'master',
    'export',
  ])
  idValue(value.id, 'project.id')
  enumValue(
    value.schemaVersion,
    [STUDIO_SCHEMA_VERSION],
    'project.schemaVersion',
  )
  const revision = frameValue(value.revision, 'project.revision')
  textValue(value.title, 'project.title')
  const createdAt = isoValue(value.createdAt, 'project.createdAt')
  const updatedAt = isoValue(value.updatedAt, 'project.updatedAt')
  requireValue(
    updatedAt >= createdAt,
    'project.updatedAt',
    'Updated time precedes creation',
  )
  enumValue(value.sampleRate, [STUDIO_SAMPLE_RATE], 'project.sampleRate')
  numberValue(value.tempoBpm, 'project.tempoBpm', 20, 300)
  enumValue(value.ruler, ['time', 'bars'], 'project.ruler')
  const tracks = arrayValue(value.tracks, 'project.tracks').map((track, i) =>
    validateStudioTrack(track, `project.tracks[${i}]`),
  )
  const clips = arrayValue(value.clips, 'project.clips').map((clip, i) =>
    validateStudioClip(clip, `project.clips[${i}]`),
  )
  const trackIds = new Set<string | number>()
  const orders = new Set<string | number>()
  for (const track of tracks) {
    uniqueValue(track.id, trackIds, `track.${track.id}`)
    uniqueValue(track.order, orders, `track.${track.id}.order`)
  }
  const clipIds = new Set<string | number>()
  for (const clip of clips) {
    uniqueValue(clip.id, clipIds, `clip.${clip.id}`)
    requireValue(
      trackIds.has(clip.trackId),
      `clip.${clip.id}.trackId`,
      'Lane does not exist',
    )
  }
  assertNoLaneOverlaps(clips)
  const mix = record(
    value.mix,
    'project.mix',
    ['flavourId', 'macros'],
    ['autoBalanceRevision'],
  )
  enumValue(
    mix.flavourId,
    MIX_FLAVOURS.map((f) => f.id),
    'project.mix.flavourId',
  )
  validateStudioMacros(mix.macros, 'project.mix.macros')
  if (Object.hasOwn(mix, 'autoBalanceRevision'))
    requireValue(
      frameValue(mix.autoBalanceRevision, 'project.mix.autoBalanceRevision') <=
        revision,
      'project.mix.autoBalanceRevision',
      'Future balance revision',
    )
  const master = record(value.master, 'project.master', [
    'presetId',
    'engineVersion',
    'targetLufs',
    'ceilingDbtp',
    'maxLimitingDb',
    'masterEq',
  ])
  enumValue(
    master.presetId,
    LOUDNESS_PRESETS.map((p) => p.id),
    'project.master.presetId',
  )
  enumValue(
    master.engineVersion,
    [STUDIO_ENGINE_VERSION],
    'project.master.engineVersion',
  )
  numberValue(master.targetLufs, 'project.master.targetLufs', -30, -6)
  numberValue(master.ceilingDbtp, 'project.master.ceilingDbtp', -12, 0)
  numberValue(master.maxLimitingDb, 'project.master.maxLimitingDb', 0, 12)
  validateStudioMasterEq(master.masterEq, 'project.master.masterEq')
  const output = record(value.export, 'project.export', [
    'format',
    'bitDepth',
    'range',
  ])
  enumValue(output.format, ['wav'], 'project.export.format')
  enumValue(output.bitDepth, [16], 'project.export.bitDepth')
  enumValue(output.range, ['song', 'selection'], 'project.export.range')
  if (assets !== undefined) {
    const owned = new Map<string, StudioAsset>()
    for (const rawAsset of assets) {
      const asset = validateStudioAsset(rawAsset)
      requireValue(
        asset.projectId === value.id,
        `asset.${asset.id}.projectId`,
        'Asset belongs to another project',
      )
      requireValue(!owned.has(asset.id), `asset.${asset.id}`, 'Duplicate asset')
      owned.set(asset.id, asset)
    }
    for (const clip of clips) {
      const asset = owned.get(clip.assetId)
      requireValue(
        asset !== undefined,
        `clip.${clip.id}.assetId`,
        'Owned source is missing',
      )
      validateClipAsset(clip, asset)
    }
  }
  return structuredClone(raw) as StudioProject
}
