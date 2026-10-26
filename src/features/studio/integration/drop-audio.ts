// Studio audio drops — resolve local source identities and place new lanes at the visible timeline position.
import type { StudioSourceEntry } from './source-catalog'

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
