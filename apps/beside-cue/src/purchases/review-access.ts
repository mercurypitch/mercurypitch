// ============================================================
// Review access — the app's wiring for the store reviewer's unlock code
// ============================================================
//
// The rules live in @irchiinnuss/purchase-kit so every app of ours answers the
// stores the same way. What belongs here is only what is Beside Cue's: the app
// id that namespaces the digest, the storage key, and the browser's own hashing.
//
// A grant made here is deliberately invisible to RevenueCat. `isPro` in App.tsx
// is the union of a real entitlement and this grant, so the paid tier opens
// while nothing suggests a purchase happened.

import type { ReviewUnlock, ReviewUnlockStorage, } from '@irchiinnuss/purchase-kit'
import { createReviewUnlock, isReviewUnlockDigest, } from '@irchiinnuss/purchase-kit'
import { createSignal } from 'solid-js'

export const REVIEW_UNLOCK_APP_ID = 'beside-cue'
export const REVIEW_UNLOCK_STORAGE_KEY = 'beside-cue:review-unlock'

export interface ReviewUnlockEnvironment {
  readonly VITE_REVIEW_UNLOCK_SHA256?: string
}

/**
 * The digest the build was compiled with, or undefined when it carries none.
 * Anything that is not 64 hex characters is treated as absent rather than as a
 * configuration error, so a typo in CI cannot brick a release build.
 */
export function resolveReviewUnlockDigest(
  env: ReviewUnlockEnvironment,
): string | undefined {
  const value = env.VITE_REVIEW_UNLOCK_SHA256?.trim().toLowerCase()
  return isReviewUnlockDigest(value) ? value : undefined
}

/**
 * Resolves the browser store per call, and only when it is really a store. A
 * WebView with site data switched off exposes a `localStorage` that throws on
 * touch, or an object missing the methods; either way the unlock must degrade
 * to "works for this session" instead of failing the settings screen.
 */
function localStore(): Storage | undefined {
  try {
    const candidate: unknown = globalThis.localStorage
    if (candidate === undefined || candidate === null) return undefined
    const store = candidate as Storage
    const usable =
      typeof store.getItem === 'function' &&
      typeof store.setItem === 'function' &&
      typeof store.removeItem === 'function'
    return usable ? store : undefined
  } catch {
    return undefined
  }
}

/** localStorage, wrapped so a browser that forbids it cannot throw at launch. */
export function createLocalReviewStorage(
  key: string = REVIEW_UNLOCK_STORAGE_KEY,
): ReviewUnlockStorage {
  return {
    read: () => localStore()?.getItem(key) ?? null,
    write: (value) => localStore()?.setItem(key, value),
    remove: () => localStore()?.removeItem(key),
  }
}

/** SHA-256 as lower-case hex. Rejects where the platform has no subtle crypto. */
export async function sha256Hex(input: string): Promise<string> {
  const subtle = globalThis.crypto?.subtle
  if (subtle === undefined) throw new Error('No subtle crypto in this runtime.')
  const bytes = new TextEncoder().encode(input)
  const digest = await subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

export type ReviewAccessState =
  | 'idle'
  | 'checking'
  | 'unlocked'
  | 'rejected'
  | 'unavailable'

export interface ReviewAccess {
  /** False when this build has no digest; the settings row stays hidden. */
  readonly configured: boolean
  readonly active: () => boolean
  readonly grantedAt: () => Date | undefined
  readonly state: () => ReviewAccessState
  readonly redeem: (code: string) => Promise<ReviewAccessState>
  readonly revoke: () => void
}

export interface ReviewAccessOptions {
  readonly unlock?: ReviewUnlock
  readonly env?: ReviewUnlockEnvironment
  readonly storage?: ReviewUnlockStorage
}

export function createReviewAccess(
  options: ReviewAccessOptions = {},
): ReviewAccess {
  const unlock =
    options.unlock ??
    createReviewUnlock({
      appId: REVIEW_UNLOCK_APP_ID,
      expectedDigest: resolveReviewUnlockDigest(
        options.env ?? (import.meta.env as ReviewUnlockEnvironment),
      ),
      storage: options.storage ?? createLocalReviewStorage(),
      digest: sha256Hex,
    })

  const restored = unlock.configured ? unlock.restore() : undefined
  const [grantedAt, setGrantedAt] = createSignal<Date | undefined>(
    restored?.grantedAt,
  )
  const [state, setState] = createSignal<ReviewAccessState>(
    restored === undefined ? 'idle' : 'unlocked',
  )

  async function redeem(code: string): Promise<ReviewAccessState> {
    setState('checking')
    const result = await unlock.redeem(code)
    if (result.outcome === 'unlocked') {
      setGrantedAt(result.grant?.grantedAt)
      setState('unlocked')
      return 'unlocked'
    }
    setState(result.outcome)
    return result.outcome
  }

  function revoke(): void {
    unlock.revoke()
    setGrantedAt(undefined)
    setState('idle')
  }

  return {
    configured: unlock.configured,
    active: () => grantedAt() !== undefined,
    grantedAt,
    state,
    redeem,
    revoke,
  }
}
