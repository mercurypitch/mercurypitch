// Studio keyboard scope — explicit clip or lane focus never steals native editing keys.
import type { StudioEditorFocus } from './types'

export function studioEditorFocus(
  target: EventTarget | null,
): StudioEditorFocus | null {
  if (!(target instanceof Element)) return null
  if (
    target.closest(
      'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="slider"], [role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"], audio, video',
    )
  )
    return null
  const clip = target.closest<HTMLElement>('[data-studio-clip]')
  const header = target.closest<HTMLElement>('[data-studio-track-header]')
  const owner = clip ?? header
  if (!owner) return null
  const button = target.closest('button, a[href], [role="button"]')
  if (button && button !== owner) return null
  const track = owner.closest<HTMLElement>('[data-studio-track]')
  const trackId =
    header?.dataset.studioTrackHeader ?? track?.dataset.studioTrack
  if (trackId === undefined || trackId === '') return null
  return {
    clipId: clip?.dataset.studioClip ?? null,
    trackId,
    header: header !== null,
  }
}
