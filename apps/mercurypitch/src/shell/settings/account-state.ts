// ============================================================
// Account state — the native Settings' one reading of the account
// ============================================================
//
// WHO DECIDES "SIGNED IN". The token the phone holds, through
// `accountHeld()`: decoding it is local work, so the answer is there on the
// first frame and with no network. The web card asked the server instead,
// and read "could not ask" as "signed out" (S6 audit D1). Here `/me` only
// fills the card — the name, the address, the provider — and a failure to
// read it is named as a failure to reach the account (REQ-NAM-049), with
// the phone still signed in.
//
// THE CARD OUTLIVES THE NETWORK. The last card read for the account is kept
// on this phone under a key settings sync does not touch (no
// `pitchperfect_` prefix), so a phone opened with no signal can still say
// who is signed in. It is only ever shown for the account the token names,
// and it goes on the way out (sign-out, deletion).
//
// A session the server refuses is not an outage: the phone is asked to sign
// in again, and nothing on it is deleted (REQ-NAM-053).

import { createSignal } from 'solid-js'
import type { MeResponse } from '@/db/services/auth-service'
import { accountHeld, currentAccountId, handleCloudSessionRejected, heldAccountProvider, readMe, } from '@/db/services/auth-service'

/** Where the last read of the account stands. */
export type AccountReach = 'idle' | 'loading' | 'ok' | 'unreachable'

/** What the Account row and the identity card show. */
export interface AccountCard {
  id: string
  /** The display name, or '' for an account without one. */
  name: string
  email: string
  /** The account's own provider: 'apple', 'google', 'password'. */
  provider: string
}

const STORAGE_KEY = 'mp:account-card'

function isCard(value: unknown): value is AccountCard {
  if (typeof value !== 'object' || value === null) return false
  const card = value as Record<string, unknown>
  return (
    typeof card.id === 'string' &&
    typeof card.name === 'string' &&
    typeof card.email === 'string' &&
    typeof card.provider === 'string'
  )
}

function readStored(): AccountCard | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === null) return null
    const parsed: unknown = JSON.parse(raw)
    return isCard(parsed) ? parsed : null
  } catch {
    return null
  }
}

function writeStored(card: AccountCard | null): void {
  try {
    if (card === null) localStorage.removeItem(STORAGE_KEY)
    else localStorage.setItem(STORAGE_KEY, JSON.stringify(card))
  } catch {
    // Private mode or blocked storage: the card simply is not kept.
  }
}

const [reach, setReach] = createSignal<AccountReach>('idle')
const [kept, setKept] = createSignal<AccountCard | null>(readStored())

/** Bumped per read, so a slow answer cannot overwrite a newer one. */
let generation = 0

/** Signed in, by the token this phone holds. Reactive. */
export function accountSignedIn(): boolean {
  return accountHeld()
}

/** How the last read went; 'idle' whenever nothing is signed in. */
export function accountReach(): AccountReach {
  return accountSignedIn() ? reach() : 'idle'
}

/** The card for the account the token names, or null. Never another's. */
export function accountCard(): AccountCard | null {
  if (!accountHeld()) return null
  const card = kept()
  return card !== null && card.id === currentAccountId() ? card : null
}

/** The name to show, with a plain stand-in for an account without one. */
export function accountDisplayName(): string {
  const name = accountCard()?.name ?? ''
  return name !== '' ? name : 'Your account'
}

const PROVIDER_NAMES: Record<string, string> = {
  apple: 'Apple',
  google: 'Google',
}

/** "Signed in with Apple", from a provider id. */
export function providerLine(provider: string | null): string {
  const name = provider === null ? undefined : PROVIDER_NAMES[provider]
  return name === undefined ? 'Signed in with email' : `Signed in with ${name}`
}

/** The provider line for the account signed in now, network or not. */
export function accountProviderLine(): string {
  return providerLine(accountCard()?.provider ?? heldAccountProvider())
}

function cardFrom(me: MeResponse): AccountCard {
  return {
    id: me.user.id,
    name: String(me.profile?.displayName ?? '').trim(),
    email: me.user.email ?? '',
    provider: me.user.authProvider,
  }
}

/** Read the account again and fill the card. Safe to call at any time. */
export async function refreshAccount(): Promise<void> {
  if (!accountHeld()) {
    setReach('idle')
    return
  }
  const id = currentAccountId()
  generation += 1
  const mine = generation
  setReach('loading')
  const read = await readMe()
  if (mine !== generation || currentAccountId() !== id) return
  if (read.status === 'ok') {
    const card = cardFrom(read.me)
    setKept(card)
    writeStored(card)
    setReach('ok')
    return
  }
  if (read.status === 'unreachable') {
    setReach('unreachable')
    return
  }
  // Refused, not unreachable: ask for sign-in again and keep every record on
  // the phone (REQ-NAM-053). A suspension already cleared the token on its
  // own path, and this is then a no-op.
  handleCloudSessionRejected()
  setReach('idle')
}

/** Drop the kept card: sign-out and deletion call this on the way out. */
export function forgetAccountCard(): void {
  generation += 1
  setKept(null)
  writeStored(null)
  setReach('idle')
}

/**
 * Test seam. `keepStored` stands in for a fresh launch: memory is gone and
 * only what this phone kept comes back.
 */
export function resetAccountState(
  options: { keepStored?: boolean } = {},
): void {
  generation += 1
  setReach('idle')
  if (options.keepStored === true) {
    setKept(readStored())
    return
  }
  writeStored(null)
  setKept(null)
}
