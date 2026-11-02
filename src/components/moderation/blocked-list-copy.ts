// ============================================================
// The Blocked singers list's words
// ============================================================
//
// One wording for the phone's Settings screen (BlockedSingersScreen.tsx in
// the native shell) and the web's account settings (BlockedSingersList.tsx):
// "Settings, Blocked singers" is where the block sheet says a block is
// undone, on either.

import type { ModerationProblem } from '@/db/services/moderation-service'
import { SERVER_WORDS, SUSPENDED_TITLE, suspendedContactUrl, } from './singer-sheet-copy'

export { suspendedContactUrl }

/** What a block does, over the list. */
export const BLOCKED_ABOUT =
  "You and a singer you blocked do not see each other's names or posts. Unblock them to see each other again."

/** The list with nobody on it. */
export const BLOCKED_EMPTY =
  'You have not blocked anyone. A singer you block from a board shows here.'

/** While the list is read. */
export const BLOCKED_LOADING = 'Loading the singers you blocked'

/**
 * What stands in for the list: why it could not be read, or that nobody is
 * signed in to read it for (blocked-list-flow.ts).
 */
export type ListStop = ModerationProblem | 'signed-out'

export interface ListFailedWords {
  title: string
  body: string
  /** The one way on: sign in, try again, or write to us. */
  next: 'sign-in' | 'retry' | 'contact'
}

const COULD_NOT_LOAD = 'Could not load the singers you blocked.'

/** Why the list is not shown, and the way on. */
export function listFailedWords(stop: ListStop): ListFailedWords {
  switch (stop) {
    case 'signed-out':
      return {
        title: 'Sign in to see whom you blocked',
        body: 'Your blocks are kept with your account.',
        next: 'sign-in',
      }
    case 'refused':
      return {
        title: 'Sign in again',
        body: 'This device is no longer signed in to your account. Sign in again to see whom you blocked.',
        next: 'sign-in',
      }
    case 'account':
      return {
        title: 'Blocking is for registered singers',
        body: 'Sign in or create an account to block a singer and see whom you blocked.',
        next: 'sign-in',
      }
    case 'suspended':
      return {
        title: SUSPENDED_TITLE,
        body: 'A suspended account cannot see or change its blocks. If you think this is a mistake, tell us through the contact form.',
        next: 'contact',
      }
    case 'server':
      return { title: COULD_NOT_LOAD, body: SERVER_WORDS, next: 'retry' }
    default:
      return {
        title: COULD_NOT_LOAD,
        body: 'Check the connection and try again.',
        next: 'retry',
      }
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
    case 'server':
      return `Could not unblock ${name}. ${SERVER_WORDS}`
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
