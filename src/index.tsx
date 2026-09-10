// ============================================================
// index.tsx — Application mount point
// ============================================================

import { render } from 'solid-js/web'
import '@/styles/app.css'
import '@/styles/dark-stage.css'
import '@/styles/mobile-kit.css'
import '@/styles/mixer-shared.css'
import '@/styles/vocal-analysis.css'
import '@/styles/uvr.css'
import '@/styles/exercises.css'
import '@/styles/mobile-polish.css'
// After mobile-polish: the short-viewport rules are the same fixes keyed on
// height, and where both apply they should win the tie.
import '@/styles/short-viewport.css'
// Last of the global sheets: its rules are deliberate overrides of everything
// above, gated on the device tier written onto <html> by initDeviceTier().
import '@/styles/performance-mode.css'
import { App } from './App'

import { setupConsent } from '@/components/ConsentBanner'
import { consumeEmailVerifyRedirect, consumeGoogleRedirect, } from '@/db/services/auth-service'
import { normalizeAdminEntryRoute } from '@/lib/admin-entry-route'
import { installChunkLoadRecovery } from '@/lib/chunk-load-recovery'
import { initDeviceTier } from '@/lib/device-tier'
import { PORTABLE_CONSOLE } from '@/lib/defaults'
import { initVoiceDiagnostics } from '@/features/voice-control/voice-diagnostics'
import { initGlobalErrorHandlers } from '@/lib/global-error-handler'
import { installPwaInstallListeners } from '@/lib/pwa-install'
import { registerServiceWorker } from '@/lib/pwa-service-worker'
import { showActionNotification } from '@/stores/notifications-store'
import { initTheme } from '@/stores/theme-store'

// The head prepaint script covers the network gap. Reconcile the persisted
// source and install system/time watchers before Solid mounts.
initTheme()
// Publish the device tier on <html> before the first paint, so nothing ever
// renders a frame of full-quality glass on a television and then downgrades.
initDeviceTier()

// Voice control and the on-device console are per DOCUMENT, and several rooms
// here are separate documents — walking into Karaoke Night is a full page
// load. Wiring only the main entry left the one transition worth watching
// unrecorded (2026-09-10).
if (PORTABLE_CONSOLE) {
  // Dynamic, and behind a compile-time constant: a normal build folds this to
  // `if (false)` and the module never enters the bundle at all.
  //
  // The dynamic import resolves a tick late, and nothing logged before it
  // lands is captured — so anything that speaks at boot waits for it. That is
  // not a detail: the first line a device writes says how the document was
  // reached, and losing it loses the seam being investigated.
  void import('@/components/PortableConsole').then((m) => {
    m.setupPortableConsole()
    initVoiceDiagnostics()
  })
} else {
  initVoiceDiagnostics()
}
installChunkLoadRecovery()
initGlobalErrorHandlers()
// `beforeinstallprompt` can fire before the first render and is never
// replayed, so the listener has to exist before anything else runs.
installPwaInstallListeners()
// The service worker is what makes the app installable. Its update is offered,
// never forced: see src/lib/pwa-service-worker.ts for why nothing here reloads
// on its own.
registerServiceWorker({
  onUpdateReady: (applyUpdate) => {
    showActionNotification(
      'A new version of MercuryPitch is ready.',
      'info',
      { label: 'Reload', onClick: applyUpdate },
      // Longer than a normal toast because it asks for a decision, but not
      // sticky: ignoring it is a valid answer. The waiting worker takes over
      // on the next navigation either way.
      //
      // "Update" is this toast's word. It used to be the fallback title on
      // every `info` message in the app, which left the one notification that
      // really is an app update indistinguishable from a saved display name.
      { channel: 'pwa-update', durationMs: 60_000, title: 'Update' },
    )
  },
})
// Boot Consent Mode + the cookie banner before anything ad-related loads.
setupConsent()
// Store the JWT from a Google sign-in redirect (#gauth=…) before the
// app boots and restoreAuth() runs.
consumeGoogleRedirect()
// Likewise pick up the emailed confirm link's outcome (#everified=…).
consumeEmailVerifyRedirect()
// Friendly admin paths are canonicalized before App mounts so they open the
// Content Studio directly instead of briefly booting the consumer surface.
normalizeAdminEntryRoute()

const root = document.getElementById('root')
if (!root) {
  console.error('index.tsx: #root element not found')
} else {
  console.log('index.tsx: root element found, rendering App')

  // Add loaded class once app mounts to prevent FOUC
  render(
    () => (
      <App
        onMounted={() => {
          console.log('index.tsx: App mounted')
          root.classList.add('loaded')
        }}
      />
    ),
    root,
  )
}
