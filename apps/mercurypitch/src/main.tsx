// Mercury Pitch native — boot.
//
// The web app's entry is `src/index.tsx`. This is deliberately NOT that file
// and deliberately not a copy of it: it renders the same <App />, from the
// same source tree, with the browser-only boot steps left out. Each omission
// below is a decision, so the list is the point of the file.
//
// Left out, and why:
//
//   registerServiceWorker()        The store is the update channel. A service
//                                  worker inside a signed binary is a second
//                                  one, serving code review never saw.
//   installPwaInstallListeners()   `beforeinstallprompt` never fires in a
//                                  WebView. The app is already installed.
//   setupConsent()                 The native build ships no gtag and no
//                                  Google Ads tag (owner decision,
//                                  2026-09-10), so there is no consent to
//                                  gather and no banner to show.
//   consumeGoogleRedirect()        Native Google sign-in returns through a
//                                  plugin, not a `#gauth=` fragment on a
//                                  document that reloaded. Task C6 owns it.
//   consumeEmailVerifyRedirect()   Same shape: an emailed link opens the
//                                  system browser, and the app hears about
//                                  it through a deep link (task C8).
//   normalizeAdminEntryRoute()     The Content Studio is not in this bundle.
//
// Kept, because each one is as true on a phone as in a tab:
//   installChunkLoadRecovery(), initGlobalErrorHandlers(), initDeviceTier().
//
// Added here and nowhere else, because each is a fact about a WebView:
//
//   installStoragePort()           `mp:userId`, `mp:deviceSecret` and
//   + hydrateStoragePort()         `mp:authToken` move to Preferences. A
//                                  mobile OS clears localStorage, and losing
//                                  those three orphans the account for good.
//                                  AWAITED BEFORE RENDER: every synchronous
//                                  reader answers null until it has been, and
//                                  a component that asks first would decide
//                                  the device is a stranger.
//   registerSocialLoginBridge()    Apple and Google run through the platform
//                                  plugin; the root tree cannot import it.
//   installForegroundSessionRefresh()
//                                  A thirty-day token with no renewal path is
//                                  a re-login on a phone with no passkey.
//   armDeveloperConsole()          The web entry calls it; this one has more
//                                  reason to. There are no devtools behind a
//                                  TestFlight build.

import { configurePitchEngineAssets } from '@irchiinnuss/pitch-engine'
import { render } from 'solid-js/web'
// Self-hosted, so the first frame draws with the network off. The web app
// links these from fonts.googleapis.com (index.html:81-84); a native app
// cannot. Variable faces: one file each, every weight the design uses.
import '@fontsource-variable/inter'
import '@fontsource-variable/outfit'
import '@fontsource-variable/plus-jakarta-sans'
// The stylesheets are the web app's own, in the web app's order. `@` is
// aliased to ../../src in vite.config.ts, so these are not copies.
import '@/styles/app.css'
import '@/styles/dark-stage.css'
import '@/styles/mobile-kit.css'
import '@/styles/mixer-shared.css'
import '@/styles/vocal-analysis.css'
import '@/styles/uvr.css'
import '@/styles/exercises.css'
import '@/styles/mobile-polish.css'
import '@/styles/short-viewport.css'
import '@/styles/performance-mode.css'
import { App } from '@/App'
import { registerSocialLoginBridge } from '@/features/account/native-sign-in'
import { NativeSignInPanel } from '@/features/account/NativeSignInPanel'
import { installForegroundSessionRefresh } from '@/features/account/session-refresh'
import { installChunkLoadRecovery } from '@/lib/chunk-load-recovery'
import { armDeveloperConsole } from '@/lib/developer-console'
import { registerDeveloperSection } from '@/lib/developer-sections'
import { initDeviceTier } from '@/lib/device-tier'
import { initGlobalErrorHandlers } from '@/lib/global-error-handler'
import { hydrateStoragePort, installStoragePort } from '@/lib/storage-port'
import { createPreferencesStoragePort } from './infrastructure/preferences-storage'
import { createSocialLoginBridge } from './infrastructure/social-login'

// Point the pitch engine at the copies scripts/sync-ort-assets.mjs vendored
// into this bundle. Unconfigured it fetches the wasm runtime from jsDelivr
// (packages/pitch-engine/src/assets.ts:10-11) — which would make the first
// tap that starts the microphone depend on a CDN, on a plane, inside an app
// whose whole promise is that it works without the network. Relative paths,
// because the WebView serves this bundle from its own origin root.
configurePitchEngineAssets({
  wasmBase: '/ort/',
  modelPath: '/models/swiftf0.onnx',
})

// A chunk that fails to load in a WebView is likelier than in a tab — an
// app resumed after days may hold a document whose assets a reinstall
// replaced — so this runs first, before anything can fail.
// First of all of them, and before anything can read an identity. Module
// evaluation has already happened by here — that is unavoidable — but nothing
// in this entry's graph reads an identity at module scope, and every later
// caller gets the durable store rather than the WebView's.
installStoragePort(createPreferencesStoragePort())

installChunkLoadRecovery()
initGlobalErrorHandlers()
initDeviceTier()

// Lazy: the loader runs on the first sign-in press, so a session that never
// signs in never pays for the plugin's module graph.
registerSocialLoginBridge(() => Promise.resolve(createSocialLoginBridge()))

// Phase 0 has no account UI. This is how the owner proves the plumbing works
// on a TestFlight build before there is one — including the hostname a
// Turnstile failure reports, which is the value that unblocks email sign-up
// in the shell (checklist M-E1).
registerDeveloperSection({
  id: 'native-sign-in',
  title: 'Native sign-in',
  render: () => <NativeSignInPanel />,
})
armDeveloperConsole()

const root = document.getElementById('root')

if (!root) {
  // Not recoverable: index.html in this same package owns the element, so
  // its absence means the bundle is not the one that was built.
  throw new Error('main.tsx: #root not found — the shell document is wrong')
}

// The one await before the first frame. It is a single Preferences read per
// key — microseconds on device — and rendering ahead of it would show a
// signed-in singer a signed-out app, then correct itself.
//
// The catch is not optional: a rejection here with nothing to handle it would
// leave the shell on its splash screen with no error and no app. Whatever
// went wrong, the app renders — signed out, which is recoverable, rather than
// blank, which is not.
void hydrateStoragePort()
  .catch((error: unknown) => {
    console.error('[mercury-pitch] storage port hydration failed', error)
  })
  .then(() => {
    installForegroundSessionRefresh()
    render(() => <App onMounted={() => root.classList.add('loaded')} />, root)
  })
