// ============================================================
// Mercury Sing store — is the listening stage open, and who picks
// ============================================================
//
// Deliberately tiny and dependency-free: the voice trigger commands import
// ONLY this file, so registering "mercury sing" costs nothing until the
// stage actually opens (the stage component and its audio engine are lazy).
// The pick handler is a late-bound seam — the stage's engine registers it
// on mount, and "sing number one" reaches it through the store without the
// command module ever knowing the engine exists.

import { createSignal } from 'solid-js'

const [mercurySingOpen, setMercurySingOpen] = createSignal(false)

export { mercurySingOpen }

export function openMercurySing(): void {
  setMercurySingOpen(true)
}

export function closeMercurySing(): void {
  setMercurySingOpen(false)
}

type PickHandler = (index: number) => boolean

let pickHandler: PickHandler | null = null

/** The mounted stage registers its engine's pick here; null on cleanup. */
export function setMercurySingPickHandler(handler: PickHandler | null): void {
  pickHandler = handler
}

/** Launch candidate at `index` (0-based). False when nothing is there. */
export function requestMercurySingPick(index: number): boolean {
  return pickHandler?.(index) ?? false
}
