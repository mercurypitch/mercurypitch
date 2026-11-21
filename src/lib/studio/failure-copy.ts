// Studio failure copy — the words a failure may show a person. An error's own message often names internals ("clip.<id>.assetId: Owned source is missing", "Studio chain timing has not been measured."), so only errors written for people are said as they are: a StudioRefusal, Studio's storage, backup and newer-song refusals, and a memory refusal. Anything else is said in the caller's own words, and the caller logs the error to the console.
import { isStudioMemoryRefusal, STUDIO_MEMORY_REFUSAL } from './memory-budget'

/** A refusal whose message is written for people: what happened, and what to do. */
export class StudioRefusal extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'StudioRefusal'
  }
}

/**
 * Studio's own errors that carry words for people, by name: the storage,
 * backup and waveform errors live outside src/lib, which may not import them.
 */
const SPOKEN = new Set([
  'StudioRefusal',
  'StudioStorageError',
  'StudioBackupError',
  'StudioNewerSongError',
  'StudioWaveformBusyError',
])

/** Log a failure's error, unless it is a refusal written for people: that is no fault. */
export function logStudioFailure(what: string, error: unknown): void {
  if (!(error instanceof StudioRefusal))
    console.error(`[studio] ${what}:`, error)
}

/** The words `error` may show a person, or null when its message is not for people. */
export function studioSpokenMessage(error: unknown): string | null {
  if (isStudioMemoryRefusal(error)) return STUDIO_MEMORY_REFUSAL
  return error instanceof Error && SPOKEN.has(error.name) && error.message
    ? error.message
    : null
}

/** Playback stopped on an error. Playing reads the song and never writes it. */
export const STUDIO_PLAYBACK_STOPPED =
  'Playback stopped because Studio could not play part of this song. Your song is unchanged. Press Play to try again.'

/** What playback says when it stops on `error`. */
export function studioPlaybackFailureText(error: unknown): string {
  return studioSpokenMessage(error) ?? STUDIO_PLAYBACK_STOPPED
}
