// ============================================================
// Voice Mirror — standalone entry point (mirror.html).
//
// A separate Vite entry, not a chunk of the main app: the mirror
// must hit interactive fast on mobile 4G, so it mounts its own
// tiny Solid tree and imports none of the app shell, no ONNX,
// and no model weights.
// ============================================================

import { render } from 'solid-js/web'
import './mirror.css'
import { setupConsent } from '@/components/ConsentBanner'
import { initVoiceDiagnostics } from '@/features/voice-control/voice-diagnostics'
import { mirrorEntryIntent } from './entry-intent'
import { MirrorApp } from './MirrorApp'

// Voice control and the on-device console are per DOCUMENT, and several rooms
// here are separate documents — walking into Karaoke Night is a full page
// load. Wiring only the main entry left the one transition worth watching
// unrecorded (2026-09-10).
// The flag is read inline rather than imported from `lib/defaults`, because
// that module is pinned into the `pitch-core` chunk and one constant would
// drag the whole thing into this room's first paint. Vite substitutes the
// literal either way, so a normal build still folds this to `if (false)` and
// never bundles the module.
//
// The import resolves a tick late, and nothing logged before it lands is
// captured — so anything that speaks at boot waits for it. Not a detail: the
// first line a device writes says how the document was reached.
if (import.meta.env.VITE_PORTABLE_CONSOLE === 'true') {
  void import('@/components/PortableConsole').then((m) => {
    m.setupPortableConsole()
    initVoiceDiagnostics()
  })
} else {
  initVoiceDiagnostics()
}

// The Mirror is the ad landing page: boot Consent Mode + the cookie banner
// before the tag loads, so EEA/UK/CH clicks are gated from the first paint.
setupConsent()

const root = document.getElementById('root')
if (root) {
  const entryIntent = mirrorEntryIntent(window.location.pathname)
  render(() => <MirrorApp entryIntent={entryIntent} />, root)
}
