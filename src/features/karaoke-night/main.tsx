// ============================================================
// Karaoke Night — standalone entry point (karaoke.html).
//
// A separate Vite entry, not a chunk of the main app: the page
// mounts its own Solid tree and imports the karaoke stage and
// leaf stores directly — never the app shell (app-store).
// ============================================================

import { render } from 'solid-js/web'
import '@/styles/mixer-shared.css'
import './karaoke-night.css'
import { setupConsent } from '@/components/ConsentBanner'
import { consumeEmailVerifyRedirect, consumeGoogleRedirect, ensureAuth, } from '@/db/services/auth-service'
import { installAudioUnlock } from '@/lib/audio-unlock'
import { trackKaraoke } from './funnel'
import { KaraokeNightApp } from './KaraokeNightApp'

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

// Anonymous-first: exchange the persisted device id for a JWT so credit
// lookups and server processing work for signed-in visitors. No-op when no
// backend is configured (e2e/tour builds).
void ensureAuth()

// Funnel: one view event per browser session.
trackKaraoke('karaoke_view')

const root = document.getElementById('root')
if (root) {
  render(() => <KaraokeNightApp />, root)
}
