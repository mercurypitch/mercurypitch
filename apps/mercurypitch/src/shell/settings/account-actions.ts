// ============================================================
// Account actions — what the Account screens change
// ============================================================
//
// The name, product news and sign-out, each through the service the web's
// account section already uses, so the account ends up exactly as the web
// would leave it. Every change reads the account again afterwards: the card
// shows what the server holds, never what was only asked for.

import { getDb } from '@/db'
import type { UserProfile } from '@/db/entities'
import { logout } from '@/db/services/auth-service'
import { setNewsletterOptIn } from '@/db/services/newsletter-service'
import { getUserId } from '@/db/services/user-service'
import { grantBoardConsent, revokeBoardConsent, } from '@/features/challenges/board-consent'
import { showNotification } from '@/stores/notifications-store'
import { forgetAccountFill } from './account-fill'
import { forgetAccountCard, keepBoardsAnswer, refreshAccount, } from './account-state'

/**
 * The profile's display name: the one leaderboards and shared content show.
 * Written the way the web's account section writes it, to the profile row
 * whose id is the account's. Throws when the write fails.
 */
export async function saveAccountName(name: string): Promise<void> {
  const db = await getDb()
  const profiles = db.getRepository<UserProfile>('userProfiles')
  const userId = getUserId()
  if ((await profiles.findById(userId)) != null) {
    await profiles.update(userId, { displayName: name })
  } else {
    await profiles.create({
      displayName: name,
      joinDate: new Date().toISOString(),
      lastPracticeDate: null,
      currentStreak: 0,
    })
  }
  await refreshAccount()
}

/** Product news by email, on or off. Throws when the account refuses. */
export async function setProductNews(on: boolean): Promise<void> {
  await setNewsletterOptIn(on)
  await refreshAccount()
}

/**
 * The singer's name on public boards, on or off: one consent for every
 * board, Leagues and Legends and the leaderboard alike (board-consent.ts).
 * Throws when it could not be stored.
 */
export async function setPublicBoards(on: boolean): Promise<void> {
  const stored = on ? await grantBoardConsent() : await revokeBoardConsent()
  if (!stored) throw new Error('Could not save that. Try again.')
  keepBoardsAnswer(on)
  await refreshAccount()
}

/**
 * Sign this phone out (REQ-NAM-054). Only this phone's session ends: the
 * token goes, and the card the phone kept for the account with it. Every
 * record on the phone stays.
 */
export function signOutHere(): void {
  logout()
  forgetAccountCard()
  forgetAccountFill()
  showNotification('Signed out', 'info')
}
