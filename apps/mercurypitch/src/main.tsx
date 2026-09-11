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
import { installChunkLoadRecovery } from '@/lib/chunk-load-recovery'
import { initDeviceTier } from '@/lib/device-tier'
import { initGlobalErrorHandlers } from '@/lib/global-error-handler'

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
installChunkLoadRecovery()
initGlobalErrorHandlers()
initDeviceTier()

const root = document.getElementById('root')

if (!root) {
  // Not recoverable: index.html in this same package owns the element, so
  // its absence means the bundle is not the one that was built.
  throw new Error('main.tsx: #root not found — the shell document is wrong')
}

render(() => <App onMounted={() => root.classList.add('loaded')} />, root)
