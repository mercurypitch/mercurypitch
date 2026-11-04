// ============================================================
// Studio role pictures — each lane's instrument as a picture in its header, or as a line icon, chosen on this device
// ============================================================
//
// Device-local, like the record settings (record-settings.ts): how the lane
// headers look is a habit of the person at this screen, not part of a song.
// One signal for the whole Studio, so every lane and the phone's Mix sheet
// switch together. Storage that throws or is missing keeps pictures on for
// the session.
import { createSignal } from 'solid-js'
import type { TrackRole } from '@/lib/studio-fx/role-chains'

const KEY = 'mercurypitch.studio.role-pictures'

function stored(): boolean {
  try {
    return localStorage.getItem(KEY) !== 'off'
  } catch {
    return true
  }
}

const [pictures, setPictures] = createSignal(stored())

/** Whether lane headers show role pictures (true) or line icons. */
export const studioRolePictures = pictures

export function setStudioRolePictures(on: boolean): void {
  setPictures(on)
  try {
    if (on) localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, 'off')
  } catch {
    // Storage may be off (a private window): the choice lasts for this visit.
  }
}

/** Read the stored choice again, as a new visit would. For tests. */
export function reloadStudioRolePictures(): void {
  setPictures(stored())
}

/**
 * The role's picture (public/studio/roles): one 128 px square, drawn 56 px
 * in a lane header and 36 px in the phone's Mix sheet. One tier on
 * purpose: a srcset's 1x or 2x is chosen once, at load, and a page zoomed
 * after that would stretch the small one. 128 px stays sharp to about 230%
 * zoom and is never more than 3.6 times too big.
 */
export function studioRolePicture(role: TrackRole): string {
  return `/studio/roles/${role}.webp`
}
