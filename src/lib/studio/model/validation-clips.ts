// Studio clip validation — source-anchored envelopes and lane occupancy survive non-destructive edits.
import { TRACK_ROLES } from '@/lib/studio-fx/role-chains'
import type { StudioAsset, StudioClip, StudioTrack } from './types'
import { validateStudioChain } from './validation-fx'
import { boolValue, enumValue, frameValue, idValue, numberValue, record, requireValue, textValue, } from './validation-values'

export function validateStudioTrack(raw: unknown, path = 'track'): StudioTrack {
  const value = record(raw, path, [
    'id',
    'name',
    'order',
    'role',
    'gainDb',
    'balanceGainDb',
    'pan',
    'mute',
    'solo',
    'fx',
  ])
  idValue(value.id, `${path}.id`)
  textValue(value.name, `${path}.name`)
  frameValue(value.order, `${path}.order`)
  enumValue(value.role, TRACK_ROLES, `${path}.role`)
  numberValue(value.gainDb, `${path}.gainDb`, -60, 24)
  numberValue(value.balanceGainDb, `${path}.balanceGainDb`, -24, 24)
  numberValue(value.pan, `${path}.pan`, -1, 1)
  boolValue(value.mute, `${path}.mute`)
  boolValue(value.solo, `${path}.solo`)
  const fx = record(value.fx, `${path}.fx`, [
    'version',
    'baseSpec',
    'spaceOffset',
  ])
  enumValue(fx.version, [1], `${path}.fx.version`)
  validateStudioChain(fx.baseSpec, `${path}.fx.baseSpec`)
  numberValue(fx.spaceOffset, `${path}.fx.spaceOffset`, -100, 100)
  return structuredClone(raw) as StudioTrack
}

export function validateStudioClip(raw: unknown, path = 'clip'): StudioClip {
  const value = record(raw, path, [
    'id',
    'trackId',
    'assetId',
    'startFrame',
    'sourceInFrame',
    'sourceOutFrame',
    'gainDb',
    'fades',
  ])
  for (const key of ['id', 'trackId', 'assetId'])
    idValue(value[key], `${path}.${key}`)
  const start = frameValue(value.startFrame, `${path}.startFrame`)
  const sourceIn = frameValue(value.sourceInFrame, `${path}.sourceInFrame`)
  const sourceOut = frameValue(
    value.sourceOutFrame,
    `${path}.sourceOutFrame`,
    1,
  )
  requireValue(sourceOut > sourceIn, path, 'Clip must have positive duration')
  frameValue(start + sourceOut - sourceIn, `${path}.endFrame`)
  numberValue(value.gainDb, `${path}.gainDb`, -60, 24)
  const fades = record(value.fades, `${path}.fades`, ['curve'], ['in', 'out'])
  enumValue(fades.curve, ['linear-amplitude'], `${path}.fades.curve`)
  for (const key of ['in', 'out']) {
    if (!Object.hasOwn(fades, key)) continue
    const ramp = record(fades[key], `${path}.fades.${key}`, [
      'fromSourceFrame',
      'toSourceFrame',
    ])
    const from = frameValue(
      ramp.fromSourceFrame,
      `${path}.fades.${key}.fromSourceFrame`,
    )
    const to = frameValue(
      ramp.toSourceFrame,
      `${path}.fades.${key}.toSourceFrame`,
      1,
    )
    requireValue(
      to > from,
      `${path}.fades.${key}`,
      'Fade must have positive duration',
    )
  }
  const clip = raw as StudioClip
  requireValue(
    !clip.fades.in ||
      !clip.fades.out ||
      clip.fades.in.toSourceFrame <= clip.fades.out.fromSourceFrame,
    `${path}.fades`,
    'Fade ramps overlap',
  )
  return structuredClone(clip)
}

export function validateClipAsset(clip: StudioClip, asset: StudioAsset): void {
  requireValue(
    clip.sourceOutFrame <= asset.normalizedFrameCount,
    `clip.${clip.id}`,
    'Source bounds exceed owned audio',
  )
  for (const ramp of [clip.fades.in, clip.fades.out])
    requireValue(
      !ramp || ramp.toSourceFrame <= asset.normalizedFrameCount,
      `clip.${clip.id}.fades`,
      'Fade exceeds owned audio',
    )
}

export function assertNoLaneOverlaps(clips: readonly StudioClip[]): void {
  const lanes = new Map<string, StudioClip[]>()
  for (const clip of clips) {
    const lane = lanes.get(clip.trackId) ?? []
    lane.push(clip)
    lanes.set(clip.trackId, lane)
  }
  for (const lane of lanes.values()) {
    lane.sort((a, b) => a.startFrame - b.startFrame)
    for (let index = 1; index < lane.length; index++) {
      const previous = lane[index - 1]
      requireValue(
        previous.startFrame +
          previous.sourceOutFrame -
          previous.sourceInFrame <=
          lane[index].startFrame,
        `clip.${lane[index].id}`,
        'Clips cannot overlap on one lane',
      )
    }
  }
}
