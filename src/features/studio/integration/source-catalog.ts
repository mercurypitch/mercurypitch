// ============================================================
// Studio sources — list kept take metadata without hydrating history audio
// ============================================================

import type { VoiceTakeRecord, VoiceTakeSource } from '@/db/entities'
import { checkImportCancelled } from '@/lib/studio/audio/import-limits'
import type { TrackRole } from '@/lib/studio-fx/role-chains'

export interface StudioSourceEntry {
  id: string
  source: VoiceTakeSource
  title: string
  sourceLabel: string
  audioDescription: string
  suggestedRole: TrackRole
  durationMs: number
  sizeBytes: number
  capturedAt: string
  mimeType: string
}

export interface StudioSourceReader {
  listVoiceTakes(): Promise<VoiceTakeRecord[]>
  getVoiceTakeBlob(id: string): Promise<Blob | null>
}

export interface StudioSourceOptions {
  signal?: AbortSignal
  reader?: StudioSourceReader
}

const SOURCE_LABELS: Record<VoiceTakeSource, string> = {
  karaoke: 'Karaoke',
  freeform: 'Hear Yourself',
  'guitar-night': 'Guitar',
  'piano-night': 'Piano',
  'drum-night': 'Drums',
  glass: 'Glass',
  exercise: 'Exercise',
  legend: 'Weekly Legend',
  guided: 'Guided check',
}

function describeAudio(take: VoiceTakeRecord): string {
  if (take.source === 'karaoke')
    return 'Dry microphone audio. Backing is not included.'
  if (take.source === 'piano-night')
    return 'Felt-synth replay of your played notes. Score audio is not included.'
  if (take.source === 'drum-night')
    return 'Live-kit audio. Room microphone audio is not included.'
  if (take.source === 'guitar-night') {
    return take.id.startsWith('guitar-take:')
      ? 'Dry input. Amp effects are not included.'
      : 'Kept guitar take. Place it against the song by ear.'
  }
  return 'Kept microphone audio.'
}

function roleForSource(source: VoiceTakeSource): TrackRole {
  if (source === 'guitar-night') return 'acoustic-guitar'
  if (source === 'piano-night') return 'piano'
  if (source === 'drum-night') return 'drums'
  return 'voice'
}

/** Explicit projection excludes scores, contours, context and device evidence. */
export function studioSourceFromTake(take: VoiceTakeRecord): StudioSourceEntry {
  if (
    !Object.prototype.hasOwnProperty.call(SOURCE_LABELS, take.source) ||
    !take.id ||
    !Number.isFinite(take.durationMs) ||
    take.durationMs < 0 ||
    !Number.isSafeInteger(take.sizeBytes) ||
    take.sizeBytes < 0
  ) {
    throw new Error(
      'A kept take has invalid metadata. Open Hear Yourself to review it.',
    )
  }
  return {
    id: take.id,
    source: take.source,
    title: take.title.trim() || 'Untitled take',
    sourceLabel: SOURCE_LABELS[take.source],
    audioDescription: describeAudio(take),
    suggestedRole: roleForSource(take.source),
    durationMs: take.durationMs,
    sizeBytes: take.sizeBytes,
    capturedAt: take.capturedAt,
    mimeType: take.mimeType,
  }
}

async function sourceReader(
  options: StudioSourceOptions,
): Promise<StudioSourceReader> {
  return options.reader ?? (await import('@/db/services/voice-take-service'))
}

export async function listStudioSources(
  options: StudioSourceOptions = {},
): Promise<StudioSourceEntry[]> {
  checkImportCancelled(options.signal)
  const reader = await sourceReader(options)
  checkImportCancelled(options.signal)
  const takes = await reader.listVoiceTakes()
  checkImportCancelled(options.signal)
  return takes.map(studioSourceFromTake)
}

/** Only the explicit Add selection reads bytes. No other catalogue row is read. */
export async function readStudioSourceBlob(
  source: StudioSourceEntry,
  options: StudioSourceOptions = {},
): Promise<Blob> {
  checkImportCancelled(options.signal)
  const reader = await sourceReader(options)
  checkImportCancelled(options.signal)
  const blob = await reader.getVoiceTakeBlob(source.id)
  checkImportCancelled(options.signal)
  if (blob === null)
    throw new Error('This take no longer has audio. Choose another take.')
  if (blob.size !== source.sizeBytes)
    throw new Error('This take changed. Refresh the list and add it again.')
  return blob
}
