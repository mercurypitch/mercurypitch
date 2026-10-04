// ============================================================
// Native calls — the guards every device wrapper shares
// ============================================================
//
// Which phone this is, a call that degrades instead of rejecting, and a
// listener whose unsubscribe works before its handle has arrived. The
// wrappers in platform.ts and picture-in-picture.ts all reach the device
// through these; platform.ts has the rule that shapes them.

import { Capacitor } from '@capacitor/core'

/** Removes whatever the registering call installed. Safe to call twice. */
export type Unsubscribe = () => void

export function isNative(): boolean {
  return Capacitor.isNativePlatform()
}

export function isIos(): boolean {
  return isNative() && Capacitor.getPlatform() === 'ios'
}

export function isAndroid(): boolean {
  return isNative() && Capacitor.getPlatform() === 'android'
}

/**
 * Runs a native call and answers whether it actually happened.
 *
 * A plugin whose native half was never installed rejects with Capacitor's
 * `Unimplemented`, and so does one called on a platform that does not
 * implement it (`minimizeApp` on iOS). Neither is an error a product can act
 * on, and neither is worth an unhandled rejection, so both come back as
 * `false`.
 */
export async function attempt(run: () => Promise<unknown>): Promise<boolean> {
  if (!isNative()) return false
  try {
    await run()
    return true
  } catch {
    return false
  }
}

export const finiteOr = (
  value: number | undefined,
  fallback: number,
): number => (value !== undefined && Number.isFinite(value) ? value : fallback)

// LISTENERS. // Both registrations are asynchronous (the plugin resolves a handle) while
// both callers want an unsubscribe they can hold immediately. So each returns
// a synchronous function that either removes the handle or, if the handle has
// not arrived yet, marks the registration stale so it is removed on arrival.
// Without that second half, a listener installed by a screen that unmounts
// during its own registration outlives the screen.

export function lazyListener(
  register: (dispose: (handle: { remove(): Promise<void> }) => void) => void,
): Unsubscribe {
  let cancelled = false
  let handle: { remove(): Promise<void> } | null = null

  register((registered) => {
    if (cancelled) {
      void registered.remove().catch(() => undefined)
      return
    }
    handle = registered
  })

  return () => {
    cancelled = true
    const current = handle
    handle = null
    if (current !== null) void current.remove().catch(() => undefined)
  }
}
