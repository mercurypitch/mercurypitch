// ============================================================
// index.tsx — Application mount point
// ============================================================

import { render } from 'solid-js/web'
import '@/styles/app.css'
import '@/styles/mobile-kit.css'
import '@/styles/mixer-shared.css'
import '@/styles/vocal-analysis.css'
import '@/styles/uvr.css'
import '@/styles/exercises.css'
import '@/styles/mobile-polish.css'
// After mobile-polish: the short-viewport rules are the same fixes keyed on
// height, and where both apply they should win the tie.
import '@/styles/short-viewport.css'
import { App } from './App'

import { setupConsent } from '@/components/ConsentBanner'
import { consumeEmailVerifyRedirect, consumeGoogleRedirect, } from '@/db/services/auth-service'
import { normalizeAdminEntryRoute } from '@/lib/admin-entry-route'
import { installChunkLoadRecovery } from '@/lib/chunk-load-recovery'
import { initGlobalErrorHandlers } from '@/lib/global-error-handler'
import { installPwaInstallListeners } from '@/lib/pwa-install'
import { registerServiceWorker } from '@/lib/pwa-service-worker'
import { showActionNotification } from '@/stores/notifications-store'

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
      { channel: 'pwa-update', durationMs: 60_000 },
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
