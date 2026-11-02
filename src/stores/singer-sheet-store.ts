// ============================================================
// The singer sheet — which singer it is open on, if any
// ============================================================
//
// The one sheet that reports or blocks a singer
// (src/components/moderation/SingerSheet.tsx) is drawn by a single host,
// App.tsx's on the web and NativeShell.tsx's on the phone, and opened from
// any row that names another singer: a board's "..." hands it the singer
// here, and where it was pressed, so the focus can go back there when the
// sheet closes (src/components/moderation/sheet-focus.ts). The phone's Back
// asks this whether there is a sheet to close (shell-navigation.ts), as it
// asks the sign-in sheet.

import { createSignal } from 'solid-js'
import type { ReportKind } from '@/db/services/moderation-service'

/** The singer a sheet is about, and what a report on them would name. */
export interface SingerSheetSubject {
  userId: string
  displayName: string
  /** What a report names: the singer themself unless it is about a share. */
  report?: { kind: ReportKind; id: string }
  /** The board that opened the sheet, once a block lands: read it again. */
  onBlocked?: () => void
}

/** Where a sheet was opened: the focus goes back there when it closes. */
export interface SingerSheetOpener {
  /** The "..." that was pressed. */
  button: HTMLElement
  /** The board it is on (`data-singer-board`), and that board's name. */
  board: HTMLElement | null
  boardName: string | null
  /** Its place among that board's "..." buttons, from 0. */
  index: number
}

const [subject, setSubject] = createSignal<SingerSheetSubject | null>(null)

/** The open sheet's opener, until the close takes it. Not reactive. */
let opener: SingerSheetOpener | null = null

/** The singer the sheet is open on, or null when it is closed. Reactive. */
export function singerSheetSubject(): SingerSheetSubject | null {
  return subject()
}

/** Whether the sheet is open. Reactive. */
export function singerSheetOpen(): boolean {
  return subject() !== null
}

/** Open the sheet on a singer, from the "..." at `from` if one was pressed. */
export function openSingerSheet(
  next: SingerSheetSubject,
  from?: SingerSheetOpener,
): void {
  opener = from ?? null
  setSubject({ ...next })
}

/** Where the sheet was opened, once: whoever gives the focus back takes it. */
export function takeSingerSheetOpener(): SingerSheetOpener | null {
  const taken = opener
  opener = null
  return taken
}

/** Close it, whatever it was showing. */
export function closeSingerSheet(): void {
  setSubject(null)
}
