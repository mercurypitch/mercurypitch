// ============================================================
// The Blocked singers list's words
// ============================================================
//
// One wording for the phone's Settings screen (BlockedSingersScreen.tsx in
// the native shell) and the web's account settings (BlockedSingersList.tsx):
// "Settings, Blocked singers" is where the block sheet says a block is
// undone, on either.

import type { ModerationProblem } from '@/db/services/moderation-service'

/** What a block does, over the list. */
export const BLOCKED_ABOUT =
  "You and a singer you blocked do not see each other's names or posts. Unblock them to see each other again."

/** The list with nobody on it. */
export const BLOCKED_EMPTY =
  'You have not blocked anyone. A singer you block from a board shows here.'

/** While the list is read. */
export const BLOCKED_LOADING = 'Loading the singers you blocked'

export interface ListFailedWords {
  title: string
  body: string
  /** Signing in again is the way on, not trying again. */
  signIn: boolean
}

/** Why the list could not be shown. */
export function listFailedWords(problem: ModerationProblem): ListFailedWords {
  if (problem === 'refused') {
    return {
      title: 'Sign in again',
      body: 'This device is no longer signed in to your account. Sign in again to see whom you blocked.',
      signIn: true,
    }
  }
  if (problem === 'account') {
    return {
      title: 'Blocking is for registered singers',
      body: 'Sign in to your account to see whom you blocked.',
      signIn: true,
    }
  }
  return {
    title: 'Could not load the singers you blocked.',
    body: 'Check the connection and try again.',
    signIn: false,
  }
}

/** Why a block could not be lifted. */
export function unblockFailedWords(
  problem: ModerationProblem,
  name: string,
): string {
  switch (problem) {
    case 'refused':
    case 'account':
      return `Sign in again to unblock ${name}.`
    case 'busy':
      return 'You have blocked or unblocked a lot of singers in the last hour. Try again later.'
    default:
      return `Could not unblock ${name}. Check the connection and try again.`
  }
}

/** "Blocked today", "Blocked 3 days ago": when, without a clock. */
export function blockedWhen(createdAt: string, now = Date.now()): string {
  const at = Date.parse(createdAt)
  if (Number.isNaN(at)) return 'Blocked'
  const days = Math.floor((now - at) / 86_400_000)
  if (days <= 0) return 'Blocked today'
  if (days === 1) return 'Blocked yesterday'
  if (days < 30) return `Blocked ${days} days ago`
  const months = Math.round(days / 30)
  return months === 1 ? 'Blocked a month ago' : `Blocked ${months} months ago`
}
