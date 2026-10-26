// Studio asset validation — immutable source metadata must remain independent of the practice library.
import type { StudioAsset } from './types'
import { STUDIO_PREPARATION_VERSION, STUDIO_SAMPLE_RATE } from './types'
import { enumValue, frameValue, hashValue, idValue, isoValue, numberValue, record, requireValue, textValue, } from './validation-values'

const SOURCES = [
  'glass',
  'exercise',
  'legend',
  'karaoke',
  'guitar-night',
  'piano-night',
  'drum-night',
  'freeform',
  'guided',
  'file',
] as const

export function validateStudioAsset(raw: unknown): StudioAsset {
  const value = record(
    raw,
    'asset',
    [
      'id',
      'projectId',
      'sha256',
      'mimeType',
      'byteLength',
      'channels',
      'normalizedSampleRate',
      'normalizedFrameCount',
      'importVersion',
      'canonicalPcmId',
      'canonicalPcmSha256',
      'canonicalPcmByteLength',
      'preparation',
      'provenance',
    ],
    ['originalName'],
  )
  idValue(value.id, 'asset.id')
  idValue(value.projectId, 'asset.projectId')
  hashValue(value.sha256, 'asset.sha256')
  textValue(value.mimeType, 'asset.mimeType', 128)
  frameValue(value.byteLength, 'asset.byteLength', 1)
  const channels = enumValue(value.channels, [1, 2], 'asset.channels')
  enumValue(
    value.normalizedSampleRate,
    [STUDIO_SAMPLE_RATE],
    'asset.normalizedSampleRate',
  )
  const frames = frameValue(
    value.normalizedFrameCount,
    'asset.normalizedFrameCount',
    1,
  )
  enumValue(value.importVersion, [1], 'asset.importVersion')
  idValue(value.canonicalPcmId, 'asset.canonicalPcmId')
  hashValue(value.canonicalPcmSha256, 'asset.canonicalPcmSha256')
  const bytes = frameValue(
    value.canonicalPcmByteLength,
    'asset.canonicalPcmByteLength',
    1,
  )
  requireValue(
    bytes > frames * channels * 4,
    'asset.canonicalPcmByteLength',
    'PCM payload and header do not fit',
  )
  if (Object.hasOwn(value, 'originalName'))
    textValue(value.originalName, 'asset.originalName')
  const preparation = record(value.preparation, 'asset.preparation', [
    'algorithmVersion',
    'gainDb',
  ])
  enumValue(
    preparation.algorithmVersion,
    [STUDIO_PREPARATION_VERSION],
    'asset.preparation.algorithmVersion',
  )
  numberValue(preparation.gainDb, 'asset.preparation.gainDb', -24, 36)
  const provenance = record(
    value.provenance,
    'asset.provenance',
    ['kind', 'importedAt'],
    ['sourceId'],
  )
  enumValue(provenance.kind, SOURCES, 'asset.provenance.kind')
  isoValue(provenance.importedAt, 'asset.provenance.importedAt')
  if (Object.hasOwn(provenance, 'sourceId'))
    textValue(provenance.sourceId, 'asset.provenance.sourceId')
  return structuredClone(raw) as StudioAsset
}
