// ============================================================
// Account deletion — erase, restart, and say what happened
// ============================================================
//
// The server erases the account and everything it owns, and revokes the
// Apple grant for an Apple account (REQ-NAM-056). The client side is the
// web's `deleteAccount()`: the token goes, and the device id is rotated so
// the erased identity cannot be provisioned again (REQ-NAM-058). Then the
// app restarts, as the web's does, so nothing of the deleted account stays
// in memory, and comes back on Settings with one line that says what
// happened and what did not (5d, REQ-NAM-059). The line survives the
// restart in session storage, which lasts exactly as long as the WebView.

import { createSignal } from 'solid-js'
import { deleteAccount } from '@/db/services/auth-service'
import { pushSettingsScreen } from '../run-shell-store'
import { ACCOUNT_DELETED } from './account-copy'
import { forgetAccountFill } from './account-fill'
import { forgetAccountCard } from './account-state'
import { restartApp } from './app-restart'

const DELETED_KEY = 'mp:account-deleted'

const [note, setNote] = createSignal<string | null>(null)

/** The line Settings shows after a deletion, or null. Reactive. */
export const accountDeletedNote = note

/** Settings has shown it: it does not come back. */
export function dismissAccountDeletedNote(): void {
  setNote(null)
}

/**
 * Delete the account signed in on this phone. Throws with the server's
 * sentence when the deletion fails, having changed nothing here.
 */
export async function deleteAccountHere(): Promise<void> {
  await deleteAccount()
  forgetAccountCard()
  forgetAccountFill()
  try {
    sessionStorage.setItem(DELETED_KEY, '1')
  } catch {
    // Blocked storage: the app restarts on its first screen, without the
    // line. The account is deleted either way.
  }
  restartApp()
}

/** True once after a deletion restarted the app. */
export function takeAccountDeleted(): boolean {
  try {
    if (sessionStorage.getItem(DELETED_KEY) === null) return false
    sessionStorage.removeItem(DELETED_KEY)
    return true
  } catch {
    return false
  }
}

/** On boot: a deletion just restarted the app, so come back on Settings. */
export function resumeAfterDeletion(): void {
  if (!takeAccountDeleted()) return
  setNote(ACCOUNT_DELETED)
  pushSettingsScreen()
}
