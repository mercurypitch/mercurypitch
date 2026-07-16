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
import { consumeGoogleRedirect, ensureAuth } from '@/db/services/auth-service'
import { KaraokeNightApp } from './KaraokeNightApp'

// Catch a Google sign-in redirect (#gauth=…) before anything reads the token,
// exactly as index.tsx does for the app.
consumeGoogleRedirect()

// Ad landing page: boot Consent Mode + the cookie banner before any tag
// loads, so EEA/UK/CH clicks are gated from the first paint.
setupConsent()

// Anonymous-first: exchange the persisted device id for a JWT so credit
// lookups and server processing work for signed-in visitors. No-op when no
// backend is configured (e2e/tour builds).
void ensureAuth()

const root = document.getElementById('root')
if (root) {
  render(() => <KaraokeNightApp />, root)
}
