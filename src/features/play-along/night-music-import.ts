// Night music import defines shared file validation and room-owned action boundaries.
import { audioUploadValidationError, LOCAL_MAX_UPLOAD_BYTES, } from '@/lib/audio-upload-contract'
import type { UnifiedSongImportKind } from './song-import'
import { classifyUnifiedSongImport } from './song-import'

export type NightMusicRoom = 'guitar' | 'drums' | 'piano' | 'karaoke'

export const NIGHT_MUSIC_FORMATS: Record<NightMusicRoom, string> = {
  guitar: 'MP3, WAV, FLAC, MIDI or Guitar Pro (.gp, .gpx, .gp3–.gp5)',
  drums: 'MP3, WAV, FLAC, MIDI or Guitar Pro (.gp, .gpx, .gp3–.gp5)',
  piano: 'MIDI (.mid or .midi)',
  karaoke: 'MP3, WAV or FLAC',
}

export function validateNightMusicFiles(
  room: NightMusicRoom,
  files: readonly File[],
):
  | { ok: true; file: File; kind: UnifiedSongImportKind }
  | { ok: false; message: string } {
  const allowed = `Choose ${NIGHT_MUSIC_FORMATS[room]}.`
  if (files.length !== 1)
    return { ok: false, message: `Drop one file at a time. ${allowed}` }
  const file = files[0]!
  if (file.size === 0)
    return { ok: false, message: `This file is empty. ${allowed}` }
  const kind = classifyUnifiedSongImport(file)
  if (
    kind === null ||
    (room === 'piano' && kind !== 'midi') ||
    (room === 'karaoke' && kind !== 'audio')
  ) {
    return {
      ok: false,
      message: `This file cannot be played in ${room === 'drums' ? 'Drum' : room[0]!.toUpperCase() + room.slice(1)} Night. ${allowed}`,
    }
  }
  if (kind === 'audio') {
    const error = audioUploadValidationError(
      file,
      LOCAL_MAX_UPLOAD_BYTES,
      undefined,
      'on-device preparation',
    )
    if (error !== null) return { ok: false, message: error }
  }
  // Detailed parser bounds remain owned by each room's existing importer.
  return { ok: true, file, kind }
}

export interface NightMusicTask {
  signal: AbortSignal
  report: (message: string, progress?: number) => void
  warn?: (message: string) => void
  /** Check immediately before committing a result to a room. */
  assertCurrent: () => void
}

export interface NightMusicAction {
  id: string
  label: string
  detail: string
  unavailable?: string
  run: (task: NightMusicTask) => Promise<void>
}

/** Recoverable admission errors retain an explicit user action, never an automatic retry. */
export class NightMusicActionError extends Error {
  constructor(
    message: string,
    readonly recovery?: { label: string; run: () => void },
  ) {
    super(message)
    this.name = 'NightMusicActionError'
  }
}

/** A route registers its current capture owner; the overlay never owns input. */
export interface NightMusicSessionGuard {
  blockedReason: () => string | null
}

/** Temporary performance audio must be kept or dismissed before its owner unmounts. */
export function performanceTakeImportBlocker(state: string): string | null {
  if (state === 'capturing') return 'Stop your take before replacing music.'
  if (state === 'processing' || state === 'saving')
    return 'Wait for your take to finish saving or processing.'
  if (state === 'ready')
    return 'Keep or dismiss your take in its review before replacing music.'
  return null
}

export function isExternalFileDrag(event: DragEvent): boolean {
  return (
    Array.from(event.dataTransfer?.types ?? []).includes('Files') ||
    (event.dataTransfer?.files.length ?? 0) > 0
  )
}
