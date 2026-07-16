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
import { KaraokeNightApp } from './KaraokeNightApp'

// Ad landing page: boot Consent Mode + the cookie banner before any tag
// loads, so EEA/UK/CH clicks are gated from the first paint.
setupConsent()

const root = document.getElementById('root')
if (root) {
  render(() => <KaraokeNightApp />, root)
}
