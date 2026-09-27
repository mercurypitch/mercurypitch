// ============================================================
// Settings' one question at a time
// ============================================================
//
// Sign out, delete the account, clear what the phone keeps, start fresh:
// each asks once, in an alert with Cancel on the left and the answer on the
// right (the kit's alert, as the Keep alert draws it). One question can be
// up at a time, and it belongs to the shell rather than to the screen that
// asked, so Back can answer it (`shell-navigation.ts`): Back is Cancel.

import { createSignal } from 'solid-js'

export interface SettingsQuestion {
  title: string
  text: string
  /** The answer that does the thing, on the right. */
  confirmLabel: string
  /** Red: the answer loses something that cannot come back. */
  destructive?: boolean
  onConfirm: () => void
}

const [question, setQuestion] = createSignal<SettingsQuestion | null>(null)

/** The question up now, or null. Reactive. */
export const settingsAlert = question

export function settingsAlertOpen(): boolean {
  return question() !== null
}

/** Ask. A question already up is replaced: the newer press is the one meant. */
export function askSettings(next: SettingsQuestion): void {
  setQuestion(next)
}

/** Cancel: the alert goes and nothing happens. */
export function dismissSettingsAlert(): void {
  setQuestion(null)
}

/** The answer on the right. The alert is gone before the work starts. */
export function confirmSettingsAlert(): void {
  const asked = question()
  setQuestion(null)
  asked?.onConfirm()
}

/** Test seam. */
export function resetSettingsAlert(): void {
  setQuestion(null)
}
