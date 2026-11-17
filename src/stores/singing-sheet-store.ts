// ============================================================
// Singing sheet store — the Singing tab opened on its sheet view, in a key
// ============================================================
//
// `#/singing/sheet` (lib/hash-router.ts) opens the Singing tab on its sheet
// in place of the roll, the toolbar's own switch (`singingSheetView`,
// ui-store.ts). Nothing stores that switch, here or there: it holds until
// the singer switches back or the page loads again.
//
// A key the address names (lib/sheet-address.ts) is set as the tab's key
// picker sets it there (PlaybackSetupPanel.tsx): the key, the scale type and
// the roll's grid change, and the melody's notes stay where they are.
//
// On a cold load the app's first melody brings its own key, which App
// mirrors into the pickers: after the route is read on a first visit, where
// the melody is seeded later, and on a later one too, where the melody is
// restored first and mirrored in the same pass. A key named by then would
// be written over either way. So until that first mirror the key is set and
// also kept, and App hands it on once the melody's own is in
// (`takeAddressedSheetKey`). After it, in a running app, the key is set and
// nothing is kept: a melody the singer loads next keeps its own.

import type { SheetKey } from '@/lib/sheet-address'
import { sheetKeyOf } from '@/lib/sheet-address'
import { keyName, scaleType, setKeyName, setScaleType } from './app-store'
import { melodyStore } from './melody-store'
import { setSingingSheetView } from './ui-store'

/** The key of an address read before the first melody's own was mirrored. */
let waiting: SheetKey | null = null
/** Whether App has mirrored a melody's key yet: false while the page boots. */
let mirrored = false

/** Reads the Singing tab in a key, as its key picker would: nothing moves the melody. */
function readSingingIn(named: SheetKey): void {
  if (named.key !== null) setKeyName(named.key)
  if (named.scale !== null) setScaleType(named.scale)
  melodyStore.refreshScale(
    keyName(),
    melodyStore.getCurrentOctave(),
    scaleType(),
  )
}

/**
 * Open the Singing tab's sheet view, in the key a sheet address names by
 * its own words (`key` and `scale`, null where it has none). The caller
 * opens the tab.
 */
export function openSingingSheet(
  key: string | null,
  scale: string | null,
): void {
  setSingingSheetView(true)
  const named = sheetKeyOf(key, scale)
  if (named.key === null && named.scale === null) return
  if (!mirrored) waiting = named
  readSingingIn(named)
}

/**
 * App calls this each time it has mirrored a melody's own key into the
 * pickers. The first time, a key an address named while the page booted is
 * set over the melody's; every later time it does nothing.
 */
export function takeAddressedSheetKey(): void {
  const named = waiting
  waiting = null
  mirrored = true
  if (named !== null) readSingingIn(named)
}

/** Test hook: a page that has not mirrored its first melody yet. */
export function resetAddressedSheetKey(): void {
  waiting = null
  mirrored = false
}
