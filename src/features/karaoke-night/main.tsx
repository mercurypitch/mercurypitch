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
import { announceVoiceDiagnostics, initVoiceDiagnostics, } from '@/features/voice-control/voice-diagnostics'
import { installAudioUnlock } from '@/lib/audio-unlock'
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
// Synchronously, before anything can start listening. Voice control resumes
// from a saved preference during boot, so a recorder that waited even one
// tick missed the session it was built to watch — which is what happened on
// the 2026-09-10 retest: Karaoke Night logged a page turn with `live=true`
// and not one line about the session that made it live.
initVoiceDiagnostics()

// The flag is read inline rather than imported from `lib/defaults`, because
// that module is pinned into the `pitch-core` chunk and one constant would
// drag the whole thing into this room's first paint. Vite substitutes the
// literal either way, so a normal build still folds this to `if (false)` and
// never bundles the module.
if (import.meta.env.VITE_PORTABLE_CONSOLE === 'true') {
  void import('@/components/PortableConsole').then((m) => {
    m.setupPortableConsole()
    // The capture missed the opening lines by a tick; say them again.
    announceVoiceDiagnostics()
  })
}

// The shipping in-app console, on whichever page the bug is on, toggled from
// Settings' danger zone. Lazy so its panel and stylesheet cost nothing until
// somebody turns it on; the buffer behind it is filled by
// initGlobalErrorHandlers either way. Unrelated to the portable console
// above, which is dev-only and must never reach a build.
void import('@/components/ConsoleLog').then((m) => {
  m.setupDeveloperConsole()
})

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
