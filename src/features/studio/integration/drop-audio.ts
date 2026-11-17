// Studio audio drops — resolve local source identities and place new lanes at the visible timeline position; tell a MIDI file from audio.
import type { StudioSourceEntry } from './source-catalog'

/** What the Studio's file picker takes: audio, and MIDI files beside it. */
export const STUDIO_FILE_ACCEPT =
  'audio/*,.wav,.mp3,.m4a,.ogg,.flac,.mid,.midi,audio/midi,audio/x-midi'

/** Whether a picked or dropped file is a MIDI file: by its name, or its type where the name says nothing. */
export function isStudioMidiFile(file: Pick<File, 'name' | 'type'>): boolean {
  return (
    /\.midi?$/i.test(file.name) ||
    file.type === 'audio/midi' ||
    file.type === 'audio/x-midi'
  )
}

export const STUDIO_TAKE_DRAG_TYPE = 'application/x-mercurypitch-studio-take'
export function isStudioAudioDrop(transfer: DataTransfer | null): boolean {
  return (
    !!transfer &&
    (transfer.types.includes('Files') ||
      transfer.types.includes(STUDIO_TAKE_DRAG_TYPE))
  )
}
export function studioDropFrame(
  target: EventTarget | null,
  clientX: number,
  fallback: number,
): number {
  if (!(target instanceof Element)) return fallback
  const arrangement = target.closest<HTMLElement>('[data-studio-scale]')
  const audio =
    target
      .closest('[data-studio-track]')
      ?.querySelector('[data-studio-lane-audio]') ??
    arrangement?.querySelector('[data-studio-lane-audio]')
  const scale = Number(arrangement?.dataset.studioScale)
  if (!audio || !Number.isFinite(scale) || scale <= 0) return fallback
  return Math.max(
    0,
    Math.round(
      ((clientX - audio.getBoundingClientRect().left) / scale) * 48000,
    ),
  )
}
export function studioDroppedTake(
  transfer: DataTransfer,
  sources: readonly StudioSourceEntry[],
): StudioSourceEntry | null {
  const id = transfer.getData(STUDIO_TAKE_DRAG_TYPE)
  return sources.find((source) => source.id === id) ?? null
}
