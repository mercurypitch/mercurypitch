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
//   installChunkLoadRecovery(), initGlobalErrorHandlers(), initDeviceTier(),
//   initTheme() -- which was missing until the shell's bundle probe caught
//   it: the web entry calls it (src/index.tsx:43) and this one did not, so a
//   chosen theme applied for the session it was chosen in and the next launch
//   came up with the :root defaults and no data-theme attribute at all.
//
// Added, because none of these has a browser equivalent:
//   installNativeShell()           The OS taking the whole app away, and the
//                                  Android hardware back button. Both in
//                                  infrastructure/native-shell.ts.
//   installNativeHaptics()         The rooms' haptics (src/lib/haptics) on
//                                  the device: navigator.vibrate is not in
//                                  iOS WebKit. infrastructure/native-haptics.ts.
//   openTabFromReminders()         A tapped Ear Lab reminder opens the app on
//                                  the Ear Lab. Only in a build with the Ear
//                                  Lab with Merc, the one that sets them.
//                                  infrastructure/native-reminders.ts.
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
//   armDeveloperConsole()          The web entry calls it; a test build has
//                                  more reason to, with no devtools behind
//                                  TestFlight. Behind the console flag and
//                                  imported inside it, like the Developer
//                                  sections: a store build carries no
//                                  floating console at all. The crash card's
//                                  own log is not that, and stays.
//   <NativeShell />                The chrome this app wears instead of the
//                                  web header, sidebar and bottom bar: the
//                                  rail, the transport that replaces it
//                                  during a run, the More sheet and Settings
//                                  as a pushed screen. A SIBLING of <App />,
//                                  not a wrapper — everything it draws is
//                                  fixed to the viewport through one portal
//                                  to <body>, so wrapping would buy nothing
//                                  and cost a stacking context.

import { configurePitchEngineAssets } from '@irchiinnuss/pitch-engine'
import { render } from 'solid-js/web'
// Self-hosted, so the first frame draws with the network off. The web app
// self-hosts the same packages (src/lib/self-hosted-fonts.ts). Variable
// faces: one file each, every weight the design uses.
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
import { installForegroundSessionRefresh } from '@/features/account/session-refresh'
import { installChunkLoadRecovery } from '@/lib/chunk-load-recovery'
import { registerDeveloperSection } from '@/lib/developer-sections'
import { initDeviceTier } from '@/lib/device-tier'
import { initGlobalErrorHandlers } from '@/lib/global-error-handler'
import { EAR_LAB_WITH_MERC, KARAOKE_IMPORT } from '@/lib/native-build'
import { abandonStoragePort, hydrateStoragePort, installStoragePort, } from '@/lib/storage-port'
import { followAudioRoute } from '@/stores/audio-route-store'
import { nativeDeviceApi, registerNativeDevice, } from '@/stores/native-shell-store'
import { initTheme } from '@/stores/theme-store'
import { createNativeDevice, standUnlockClipAsideForNowPlaying, } from './infrastructure/native-device'
import { installNativeHaptics } from './infrastructure/native-haptics'
import { openTabFromReminders } from './infrastructure/native-reminders'
import { installNativeShell } from './infrastructure/native-shell'
import { createPreferencesStoragePort } from './infrastructure/preferences-storage'
import { createSocialLoginBridge } from './infrastructure/social-login'
import { NativeShell } from './shell/NativeShell'
import { goToTab } from './shell/shell-navigation'

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
initTheme()

// Before the first render, so a back press during boot is answered by this
// app rather than by Capacitor's default, which is to exit.
installNativeShell()
// The rooms' haptics are the device's, not navigator.vibrate (none on iOS).
installNativeHaptics()
// A tapped Ear Lab reminder opens the app on the Ear Lab. Before the first
// render, and a cold start included: the plugin keeps the tap until this
// listens. Folded out of a build without the Ear Lab with Merc.
if (EAR_LAB_WITH_MERC) openTabFromReminders(goToTab)
// The one AudioContext and the screen's keep-awake, for a room under `src/`
// that cannot import either (the Karaoke room). Before the first render, so
// a room never mounts without them.
registerNativeDevice(createNativeDevice())
// Where the sound goes, for the latency offset: a TV on AirPlay or HDMI
// plays the song well behind the phone's speaker, so its offset is its own
// (audio-route-store.ts, mic-latency-store.ts).
followAudioRoute(nativeDeviceApi()?.audioOutput)
// The lock screen's song on iOS brings a silent element of its own; the
// unlock clip stands aside while that element holds the playback session.
standUnlockClipAsideForNowPlaying()
// Lazy: the loader runs on the first sign-in press, so a session that never
// signs in never pays for the plugin's module graph.
registerSocialLoginBridge(() => Promise.resolve(createSocialLoginBridge()))

// Phase 0 has no account UI. This is how the owner proves the plumbing works
// on a TestFlight build before there is one — including the hostname a
// Turnstile failure reports, which is the value that unblocks email sign-up
// in the shell (checklist M-E1).
//
// Behind the same constant as the console it is reached from, because this is
// a developer screen and not a product surface: a store build must not carry
// the provider buttons or the masked token readout at all, and the tile that
// opens it is gone there too.
//
// The IMPORT is inside the branch, not at the top of the file. A static import
// keeps the module in the graph whatever the branch does, and the panel's
// strings were still in `dist` with the flag off — which is the whole of what
// this gate is for.
if (import.meta.env.VITE_PORTABLE_CONSOLE === 'true') {
  void import('@/features/account/NativeSignInPanel').then((module) => {
    const Panel = module.NativeSignInPanel
    registerDeveloperSection({
      id: 'native-sign-in',
      title: 'Native sign-in',
      render: () => <Panel />,
    })
  })
  // What the app's sound did, step by step: a TestFlight build has no other
  // way to say why a room was silent. Same gate, same reason.
  void import('./shell/AudioDiagnosticsPanel').then((module) => {
    const Panel = module.AudioDiagnosticsPanel
    registerDeveloperSection({
      id: 'audio',
      title: 'Audio',
      render: () => <Panel />,
    })
  })
  // The Karaoke room's no-streaming path, taken on purpose on a phone that
  // could stream, and which way the last song was held: every iPhone before
  // iOS 26 has no AudioDecoder (owner, 28 Sep). Same gate, same reason.
  void import('./shell/KaraokeAudioPanel').then((module) => {
    const Panel = module.KaraokeAudioPanel
    registerDeveloperSection({
      id: 'karaoke-audio',
      title: 'Karaoke audio',
      render: () => <Panel />,
    })
  })
  // The Karaoke room's lyrics on a TV connected by AirPlay screen mirroring
  // or a cable, in place of a mirror of the phone: a proof of concept for
  // karaoke on a TV (ios/App/App/LyricsWindow/TVLyrics.swift). Off unless
  // switched on here, so a store build's TV always mirrors. Same gate, same
  // reason.
  void import('./shell/TvLyricsPanel').then((module) => {
    const Panel = module.TvLyricsPanel
    registerDeveloperSection({
      id: 'tv-lyrics',
      title: 'TV',
      render: () => <Panel />,
    })
  })
  // How long each step of a Subscribe, a Restore purchase and a sign-in's
  // carry took, and the wait for the songs after the store's yes: Subscribe
  // took close to a minute on TestFlight build 919, and nothing said where.
  // Only in a build with the subscription (KARAOKE_IMPORT). Same gate, same
  // reason.
  if (KARAOKE_IMPORT) {
    void import('./shell/SubscriptionTimingPanel').then((module) => {
      const Panel = module.SubscriptionTimingPanel
      registerDeveloperSection({
        id: 'cloud-timings',
        title: 'Cloud subscription',
        render: () => <Panel />,
      })
    })
  }
  // The console's own off switch: minimised it still leaves its dot on every
  // screen, which is in the shot when a test build is recorded for a store
  // (owner, 3 Oct). Same gate, same reason.
  void import('./shell/DebugConsolePanel').then((module) => {
    const Panel = module.DebugConsolePanel
    registerDeveloperSection({
      id: 'debug-console',
      title: 'Debug console',
      render: () => <Panel />,
    })
  })
  // Every context and mic track the page makes, every change to where the
  // phone sends its sound, and each sound the rooms send: the record a room
  // that went quiet is read from (audio-census.ts). With it, the steps of a
  // scenario the census does not count, a room entered and left, the
  // page's session type, the volume notice, a demo, the app behind and
  // back (audio-record.ts), and the newest entries kept across a restart
  // (audio-log-store.ts), put back first. Same gate, same reason.
  void Promise.all([
    import('./shell/audio-census'),
    import('./shell/audio-record'),
    import('./shell/audio-log-store'),
    import('@/components/room-kit/room-output'),
  ]).then(([census, record, kept, rooms]) => {
    kept.keepAudioLogAcrossLaunches()
    census.installAudioCensus({ output: nativeDeviceApi()?.audioOutput })
    record.installAudioRecord({ roomLevels: rooms.roomOutputReadings })
  })
  // And whether the web view was ever turned: a line in the same record at
  // launch and for every change after it, so the copied report says so even
  // when the Developer screen was opened long after the turn.
  void import('./shell/viewport-diagnostics').then((module) => {
    module.installViewportDiagnostics()
  })
  // The floating developer console, armed from its persisted switch as on
  // the web. Same gate, same reason: called unconditionally, it put the
  // panel, its host and its switch into the store binary, which
  // `assert-no-portable-console.mjs --store-binary` now fails.
  void import('@/components/developer-console-arming').then((module) => {
    module.armDeveloperConsole()
  })
}

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
//
// And a deadline, because a rejection is not the only way to never render: a
// promise that never settles shows exactly the same black screen with no
// error anywhere (TestFlight build 29, 11 Sep 2026 — a plugin proxy handed
// to a promise). Past the deadline, or on any failure, the port is abandoned
// for this launch and identity comes from localStorage, as on the web.
// Echo's art fixtures (ART-FIDELITY.md 3.6): `?echoFixture=<name>` shows a
// pinned frame of the room for the art measure in place of the app. The
// dev server only: every build folds this to null and drops the import.
const echoFixture = import.meta.env.DEV
  ? new URLSearchParams(window.location.search).get('echoFixture')
  : null
// Ng slides' fixtures, the same way: `?ngFixture=<name>` (storyboard
// 02-ng-slides, screens 1 to 4).
const ngFixture = import.meta.env.DEV
  ? new URLSearchParams(window.location.search).get('ngFixture')
  : null
// Lip roll's fixtures, the same way: `?lipFixture=<name>` (storyboard
// 03-lip-roll, screens 1 to 4).
const lipFixture = import.meta.env.DEV
  ? new URLSearchParams(window.location.search).get('lipFixture')
  : null
// Long note's fixtures, the same way: `?longNoteFixture=<name>` (the
// room's states: intro, rest, mid-take, demo-off, result).
const longNoteFixture = import.meta.env.DEV
  ? new URLSearchParams(window.location.search).get('longNoteFixture')
  : null
// The Warm-up path's fixtures, the same way: `?warmFixture=<name>` (start,
// between, resume, end, done, locked: Codex's frames F1 to F4).
const warmFixture = import.meta.env.DEV
  ? new URLSearchParams(window.location.search).get('warmFixture')
  : null

const HYDRATION_DEADLINE_MS = 5000
const hydrationDeadline = new Promise<never>((_, reject) => {
  setTimeout(() => {
    reject(
      new Error(
        `storage port hydration did not settle within ${HYDRATION_DEADLINE_MS} ms`,
      ),
    )
  }, HYDRATION_DEADLINE_MS)
})
void Promise.race([hydrateStoragePort(), hydrationDeadline])
  .catch((error: unknown) => {
    console.error(
      '[mercury-pitch] storage port hydration failed; identity falls back to localStorage for this launch',
      error,
    )
    abandonStoragePort(error)
  })
  .then(() => {
    if (import.meta.env.DEV && echoFixture !== null) {
      void import('@/features/echo/fixture/mount-echo-fixture').then((m) =>
        m.mountEchoFixture(root, echoFixture),
      )
      return
    }
    if (import.meta.env.DEV && ngFixture !== null) {
      void import('@/features/ng-slides/fixture/mount-ng-fixture').then((m) =>
        m.mountNgFixture(root, ngFixture),
      )
      return
    }
    if (import.meta.env.DEV && lipFixture !== null) {
      void import('@/features/lip-roll/fixture/mount-lip-fixture').then((m) =>
        m.mountLipFixture(root, lipFixture),
      )
      return
    }
    if (import.meta.env.DEV && longNoteFixture !== null) {
      void import('@/features/long-note/fixture/mount-long-note-fixture').then(
        (m) => m.mountLongNoteFixture(root, longNoteFixture),
      )
      return
    }
    if (import.meta.env.DEV && warmFixture !== null) {
      void import('@/features/warm-up/fixture/mount-warm-fixture').then((m) =>
        m.mountWarmFixture(root, warmFixture),
      )
      return
    }
    installForegroundSessionRefresh()
    render(
      () => (
        <>
          <App onMounted={() => root.classList.add('loaded')} />
          <NativeShell />
        </>
      ),
      root,
    )
  })

// The in-app console, on every page of a test build. Captured from the first
// line, so a boot that goes wrong on a phone can be read on the phone. The
// flag is a committed build constant in this package's .env; a store build
// (MERCURYPITCH_API_TARGET=production) compiles it out whatever .env says
// (vite.config.ts, api-base.mjs portableConsoleFor).
if (import.meta.env.VITE_PORTABLE_CONSOLE === 'true') {
  void import('@/components/PortableConsole').then((m) => {
    m.setupPortableConsole()
  })
}
