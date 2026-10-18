// ============================================================
// Voice Mirror entry: a Google return lands before the Mirror renders
// ============================================================
//
// A Google sign-in started from the account ask comes back to the Mirror's
// own page with the session in the fragment. The entry stores it before
// MirrorApp renders, so the results' #take-N is back in the address when
// MirrorApp reads it; a return that created the account adopts this
// browser's voiceprints; and the ask's dialog chunk is wanted, to say how it
// went. An ordinary visit renders at once and wants nothing.

import type * as SolidWeb from 'solid-js/web'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

const entry = vi.hoisted(() => ({
  renders: [] as { hash: string }[],
  adopt: vi.fn(async () => 1),
}))

vi.mock('solid-js/web', async (importOriginal) => ({
  ...(await importOriginal<typeof SolidWeb>()),
  render: () => {
    entry.renders.push({ hash: window.location.hash })
    return () => undefined
  },
}))
vi.mock('./MirrorApp', () => ({ MirrorApp: () => null }))
vi.mock('@/components/ConsentBanner', () => ({ setupConsent: vi.fn() }))
vi.mock('@/components/developer-console-arming', () => ({
  armDeveloperConsole: vi.fn(),
}))
vi.mock('@/features/voice-control/voice-diagnostics', () => ({
  initVoiceDiagnostics: vi.fn(),
  announceVoiceDiagnostics: vi.fn(),
}))

/** A worker-shaped session token, good for an hour. */
function sessionToken(): string {
  const exp = Math.floor(Date.now() / 1000) + 3600
  const body = btoa(JSON.stringify({ sub: 'user-1', provider: 'google', exp }))
  return `h.${body}.s`
}

/** Leave the browser as tapping the ask's Google button leaves it: the
 *  results' take stashed, and the nonce the worker will echo. */
async function startedHere(): Promise<string> {
  localStorage.setItem('mp:gauthReturnHash', '#take-3')
  const { beginGoogleReturn } = await import('@/lib/google-return-nonce')
  return `&gauth_nonce=${beginGoogleReturn()}`
}

beforeEach(() => {
  vi.resetModules()
  entry.renders.length = 0
  // The real adoptAfterGoogleSignup, minus the upload: it reads the same
  // one-shot flag the return sets, and adopts only when that is true.
  vi.doMock('@/db/services/voiceprint-service', async () => {
    const auth = await import('@/db/services/auth-service')
    return {
      adoptAfterGoogleSignup: async () =>
        auth.takeGoogleAccountCreated() ? entry.adopt() : 0,
    }
  })
  entry.adopt.mockClear()
  localStorage.clear()
  document.body.innerHTML = '<div id="root"></div>'
})

afterEach(() => {
  window.history.replaceState(null, '', '/')
  document.body.innerHTML = ''
})

it("stores the session and puts the results' take back before rendering", async () => {
  const nonce = await startedHere()
  window.history.replaceState(
    null,
    '',
    `/vocal-range-test#gauth=${encodeURIComponent(sessionToken())}${nonce}`,
  )

  await import('./main')

  await vi.waitFor(() => expect(entry.renders).toHaveLength(1))
  expect(entry.renders[0].hash).toBe('#take-3')
  const auth = await import('@/db/services/auth-service')
  expect(auth.accountHeld()).toBe(true)
  // The dialog's chunk is wanted, to say the sign-in landed.
  const ask = await import('./account-ask')
  expect(ask.hostWanted()).toBe(true)
  expect(ask.takeLanding()).toEqual({ kind: 'result', result: { ok: true } })
})

it("adopts this browser's voiceprints when that return created the account", async () => {
  const nonce = await startedHere()
  window.history.replaceState(
    null,
    '',
    `/vocal-range-test#gauth=${encodeURIComponent(sessionToken())}&gauth_new=1${nonce}`,
  )

  await import('./main')

  await vi.waitFor(() => expect(entry.adopt).toHaveBeenCalledTimes(1))
})

it('signs nobody in from a return this page never started', async () => {
  window.history.replaceState(
    null,
    '',
    `/mirror#gauth=${encodeURIComponent(sessionToken())}&gauth_new=1`,
  )

  await import('./main')
  await vi.waitFor(() => expect(entry.renders).toHaveLength(1))

  const auth = await import('@/db/services/auth-service')
  expect(auth.hasValidToken()).toBe(false)
  expect(entry.adopt).not.toHaveBeenCalled()
  // ...and the page says it refused, rather than nothing at all.
  const ask = await import('./account-ask')
  expect(ask.takeLanding()).toMatchObject({
    kind: 'result',
    result: { ok: false },
  })
})

it('renders an ordinary visit at once, wanting no dialog', async () => {
  window.history.replaceState(null, '', '/vocal-range-test#take-1')

  await import('./main')

  await vi.waitFor(() => expect(entry.renders).toHaveLength(1))
  expect(entry.renders[0].hash).toBe('#take-1')
  const ask = await import('./account-ask')
  expect(ask.hostWanted()).toBe(false)
})

it('boots nothing on the mirror subdomain, which leaves for the apex first', async () => {
  // jsdom cannot be on mirror.*, so the seam is the leave: the entry hands
  // it this page's location and, told it is leaving, starts nothing that
  // could count a visit twice (the consent tag, the render).
  const leave = vi.fn((_location: Pick<Location, 'href' | 'replace'>) => true)
  vi.doMock('@/lib/mirror-subdomain', () => ({ leaveMirrorSubdomain: leave }))
  window.history.replaceState(null, '', '/vocal-range-test?utm_source=x')
  const { setupConsent } = await import('@/components/ConsentBanner')
  vi.mocked(setupConsent).mockClear()
  try {
    await import('./main')

    expect(leave).toHaveBeenCalledWith(window.location)
    expect(setupConsent).not.toHaveBeenCalled()
    expect(entry.renders).toHaveLength(0)
  } finally {
    vi.doUnmock('@/lib/mirror-subdomain')
  }
})
