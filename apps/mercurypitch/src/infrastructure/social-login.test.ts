// ============================================================
// What this shell hands the plugin at initialize
// ============================================================
//
// One property, and it is the difference between Android signing anybody in
// and Android signing nobody in. `SocialLoginPlugin.java` processes the
// `apple` block before the `google` one and rejects the entire call when
// `apple.redirectUrl` is empty — which is exactly what iOS requires it to be.
// So an apple block sent to Android does not merely fail to offer Apple, it
// stops Google from ever being constructed, on the platform where Google is
// the only way in.
//
// The assertion is therefore about the SHAPE of the options object, not about
// a call succeeding: a test that only checked `initialize()` resolved would
// pass against the bug, because the fake plugin here resolves whatever it is
// given and the real rejection only happens inside the Java.

import { readFileSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  platform: 'web' as string,
  initialize: vi.fn<(options: unknown) => Promise<void>>(() =>
    Promise.resolve(),
  ),
  login: vi.fn<(options: unknown) => Promise<unknown>>(() =>
    Promise.resolve({ provider: 'google', result: {} }),
  ),
}))

vi.mock('@capacitor/core', () => ({
  Capacitor: { getPlatform: () => mocks.platform },
}))

vi.mock('@capgo/capacitor-social-login', () => ({
  SocialLogin: {
    initialize: (options: unknown) => mocks.initialize(options),
    login: (options: unknown) => mocks.login(options),
  },
}))

import { createSocialLoginBridge } from './social-login'

/** The options object the bridge handed the plugin. */
async function initializedWith(platform: string): Promise<{
  google?: Record<string, unknown>
  apple?: Record<string, unknown>
}> {
  mocks.platform = platform
  await createSocialLoginBridge().initialize()
  return mocks.initialize.mock.calls[0][0] as {
    google?: Record<string, unknown>
    apple?: Record<string, unknown>
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('initialize', () => {
  it('sends the apple block on iOS, with the empty redirect iOS wants', async () => {
    const options = await initializedWith('ios')

    expect(options.apple).toEqual({
      clientId: 'com.irchiinnuss.mercurypitch',
      redirectUrl: '',
    })
  })

  it('sends no apple block at all on Android', async () => {
    const options = await initializedWith('android')

    // Not `redirectUrl: undefined`, not an empty object: absent. The plugin
    // branches on `call.getObject("apple") != null`, so anything present is
    // enough to reach the redirectUrl check that rejects the whole call.
    expect('apple' in options).toBe(false)
  })

  it('configures Google on Android, which the apple block used to prevent', async () => {
    const options = await initializedWith('android')

    expect(options.google).toMatchObject({ mode: 'online' })
  })

  it('configures Google on iOS too', async () => {
    const options = await initializedWith('ios')

    expect(options.google).toMatchObject({ mode: 'online' })
  })

  it('passes the two client ids the build was given, under their own names', async () => {
    const options = await initializedWith('ios')

    // Empty is a supported state (the key is omitted), so this asserts the
    // mapping rather than a literal: whatever the build has, the iOS id goes
    // to `iOSClientId` and the WEB id to both `webClientId` and
    // `iOSServerClientId` — never the other way round.
    const google = options.google ?? {}
    const iosId = import.meta.env.VITE_GOOGLE_IOS_CLIENT_ID ?? ''
    const webId = import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID ?? ''
    expect(google['iOSClientId']).toBe(iosId === '' ? undefined : iosId)
    expect(google['webClientId']).toBe(webId === '' ? undefined : webId)
    expect(google['iOSServerClientId']).toBe(webId === '' ? undefined : webId)
  })
})

describe('the iOS URL scheme', () => {
  it('is the reversed form of the iOS client id this build carries', () => {
    // Two files, one value, and nothing at build time compares them. Get it
    // wrong and the Google sheet opens on iOS, the singer signs in, and the
    // callback has no scheme to come back through — a hang on device with
    // nothing in any log. Skipped only if the build has no iOS id at all,
    // which is the documented empty state.
    const iosId = import.meta.env.VITE_GOOGLE_IOS_CLIENT_ID ?? ''
    if (iosId === '') return

    const plist = readFileSync(
      fileURLToPath(new URL('../../ios/App/App/Info.plist', import.meta.url)),
      'utf8',
    )
    const reversed = `com.googleusercontent.apps.${iosId.replace(
      '.apps.googleusercontent.com',
      '',
    )}`
    expect(plist).toContain(`<string>${reversed}</string>`)
  })
})

describe('login', () => {
  it.each(['apple', 'google'] as const)(
    'forwards %s to the plugin with its own options',
    async (provider) => {
      mocks.platform = 'ios'
      const bridge = createSocialLoginBridge()

      await bridge.login(provider, { nonce: 'n-1', scopes: ['email'] })

      expect(mocks.login).toHaveBeenCalledWith({
        provider,
        options: { nonce: 'n-1', scopes: ['email'] },
      })
    },
  )
})
