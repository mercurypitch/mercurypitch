// ============================================================
// The sign-in plugin, and the only file that imports it
// ============================================================
//
// `@capgo/capacitor-social-login` is a dependency of this package and of
// nothing else. `src/features/account/native-sign-in.ts` holds the actual
// sign-in logic — nonce, mapping, error kinds — and it lives in the root
// source tree that the WEB build also compiles, so it cannot name this
// plugin. It takes a loader instead, and this is the loader.
//
// That is a stronger guarantee than a guarded dynamic import would be. A
// `import('@capgo/…')` inside a `if (IS_NATIVE_BUILD)` branch in the root
// tree would still have to RESOLVE during the web build (Rollup builds the
// module graph before it tree-shakes), and the package is not installed at
// the repository root, so the web build would fail outright. Registering from
// here means the web bundle cannot contain the plugin, which is what
// `pnpm build && grep -r '@capgo' dist/assets` proves.
//
// ── The two client ids ──
//
// Google needs an id per platform and the plugin needs both at initialize:
// `iOSClientId` for the iOS Google SDK, `webClientId` for Android's
// Credential Manager (which wants the WEB client, not the Android one — the
// Android OAuth client only registers a package name and a SHA-1 in the
// console and is never passed to any API). Both come from build-time Vite
// variables, and both are set in the committed `.env` — they are public build
// constants, not secrets, and they have to be true of the binary rather than
// of whoever built it. Empty is still handled: the key is simply omitted, and
// the provider reports itself unavailable rather than failing halfway through
// a sheet.
//
// ── The apple block is iOS-only, and that is not a preference ──
//
// Apple needs no id beyond the bundle identifier on iOS. `clientId` is passed
// anyway because the plugin uses it to decide the provider was configured at
// all, and `redirectUrl: ''` is what its docs prescribe for iOS to keep it
// from attempting a redirect.
//
// On Android that same block kills the whole call. `SocialLoginPlugin.java`
// reads `apple` FIRST (its `initialize` handler, before it ever looks at
// `google`) and runs `shouldRejectMissingAppleRedirectUrl` on it: an empty
// `redirectUrl` with no broadcast channel is `call.reject("apple.android.
// redirectUrl is null or empty")`, and a rejected `initialize` returns before
// the Google provider is constructed. So sending the iOS-shaped apple block
// to Android does not merely fail to offer Apple — it means GOOGLE NEVER
// INITIALISES, on the one platform where Google is the only way in, and the
// first press reports the provider unavailable with nothing in the logs
// pointing at a config block the phone was handed at boot.
//
// Android is not offered Apple at all (`appleSignInOffered()` is false there,
// and the App Store guideline that wants Sign in with Apple is Apple's), so
// there is nothing to configure and the block is simply left out.

import { Capacitor } from '@capacitor/core'
import { SocialLogin } from '@capgo/capacitor-social-login'
import type { SocialLoginBridge } from '@/features/account/native-sign-in'

const IOS_CLIENT_ID = import.meta.env.VITE_GOOGLE_IOS_CLIENT_ID ?? ''
const WEB_CLIENT_ID = import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID ?? ''

/** The bundle id, which is also the Apple service identifier on iOS. */
const APPLE_CLIENT_ID = 'com.irchiinnuss.mercurypitch'

export function createSocialLoginBridge(): SocialLoginBridge {
  return {
    async initialize() {
      await SocialLogin.initialize({
        google: {
          ...(IOS_CLIENT_ID === '' ? {} : { iOSClientId: IOS_CLIENT_ID }),
          ...(WEB_CLIENT_ID === ''
            ? {}
            : {
                webClientId: WEB_CLIENT_ID,
                // iOS asks for the web client here too, under its own name:
                // it is the audience the worker verifies against, and the
                // plugin will not request server authorisation without it.
                iOSServerClientId: WEB_CLIENT_ID,
              }),
          mode: 'online',
        },
        // iOS only — see the header. On Android this block is what a
        // rejected `initialize` is made of, and Google is what it costs.
        ...(Capacitor.getPlatform() === 'ios'
          ? {
              apple: {
                clientId: APPLE_CLIENT_ID,
                // Empty string, per the plugin's own note: anything else
                // makes iOS attempt a redirect it has nowhere to land.
                redirectUrl: '',
              },
            }
          : {}),
      })
    },

    async login(provider, options) {
      // The plugin's `login` is a discriminated union over eight providers;
      // the two branches are spelled out rather than cast so each keeps its
      // own option type.
      if (provider === 'apple') {
        return SocialLogin.login({
          provider: 'apple',
          options: options as { scopes?: string[]; nonce?: string },
        })
      }
      return SocialLogin.login({
        provider: 'google',
        options: options as { scopes?: string[]; nonce?: string },
      })
    },
  }
}
