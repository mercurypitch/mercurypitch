// ============================================================
// The singer sheet — which singer it is open on, if any
// ============================================================
//
// The one sheet that reports or blocks a singer
// (src/components/moderation/SingerSheet.tsx) is drawn by a single host,
// App.tsx's on the web and NativeShell.tsx's on the phone, and opened from
// any row that names another singer: a board's "..." hands it the singer
// here. The phone's Back asks this whether there is a sheet to close
// (shell-navigation.ts), as it asks the sign-in sheet.

import { createSignal } from 'solid-js'
import type { ReportKind } from '@/db/services/moderation-service'

/** The singer a sheet is about, and what a report on them would name. */
export interface SingerSheetSubject {
  userId: string
  displayName: string
  /** What a report names: the singer themself unless it is about a share. */
  report?: { kind: ReportKind; id: string }
  /**
   * Report, and no Block: a place a block cannot reach, such as a past
   * podium, which is read without an account.
   */
  reportOnly?: boolean
  /** The board that opened the sheet, once a block lands: read it again. */
  onBlocked?: () => void
}

const [subject, setSubject] = createSignal<SingerSheetSubject | null>(null)

/** The singer the sheet is open on, or null when it is closed. Reactive. */
export function singerSheetSubject(): SingerSheetSubject | null {
  return subject()
}

/** Whether the sheet is open. Reactive. */
export function singerSheetOpen(): boolean {
  return subject() !== null
}

/** Open the sheet on a singer. */
export function openSingerSheet(next: SingerSheetSubject): void {
  setSubject({ ...next })
}

/** Close it, whatever it was showing. */
export function closeSingerSheet(): void {
  setSubject(null)
}
