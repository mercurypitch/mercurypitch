// ============================================================
// Karaoke Night — standalone entry point (karaoke.html).
//
// A separate Vite entry, not a chunk of the main app: the page
// mounts its own Solid tree and imports the karaoke stage and
// leaf stores directly — never the app shell (app-store).
// ============================================================

import { render } from 'solid-js/web'
import '@/styles/dark-stage.css'
import '@/styles/mixer-shared.css'
import '@/styles/mobile-kit.css'
import '@/styles/performance-mode.css'
import './karaoke-night.css'
import { setupConsent } from '@/components/ConsentBanner'
import { consumeEmailVerifyRedirect, consumeGoogleRedirect, restoreAuth, } from '@/db/services/auth-service'
import { initVoiceDiagnostics } from '@/features/voice-control/voice-diagnostics'
import { installAudioUnlock } from '@/lib/audio-unlock'
import { PORTABLE_CONSOLE } from '@/lib/defaults'
import { initDeviceTier } from '@/lib/device-tier'
import { trackKaraoke } from './funnel'
import { KaraokeNightApp } from './KaraokeNightApp'

// Publish the device tier on <html> before the first paint: a television
// must never render a frame of full-quality glass and then downgrade.
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

// Catch a Google sign-in redirect (#gauth=…) before anything reads the token,
// exactly as index.tsx does for the app.
consumeGoogleRedirect()
// Likewise pick up the emailed confirm link's outcome (#everified=…).
consumeEmailVerifyRedirect()

// iOS: the very first tap (usually "Sing this song") primes the playback audio
// session so WebAudio isn't muted by the ring/silent switch — the stage's own
// AudioContext mounts from a lazy chunk long after that gesture.
installAudioUnlock(() => null)

// Ad landing page: boot Consent Mode + the cookie banner before any tag
// loads, so EEA/UK/CH clicks are gated from the first paint.
setupConsent()

// Restore an existing session so credit lookups and server processing work
// for returning/signed-in visitors. Never provisions: this is an ad landing
// page, and a click that bounces must not create an account. Paid paths
// (UVR dispatch, checkout) call requireAuth() themselves. No-op when no
// backend is configured (e2e/tour builds).
void restoreAuth()

// Funnel: one view event per browser session.
trackKaraoke('karaoke_view')

const root = document.getElementById('root')
if (root) {
  render(() => <KaraokeNightApp />, root)
}
