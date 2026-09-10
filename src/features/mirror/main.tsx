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
import { PORTABLE_CONSOLE } from '@/lib/defaults'
import { mirrorEntryIntent } from './entry-intent'
import { MirrorApp } from './MirrorApp'

// Voice control and the on-device console are per DOCUMENT, and several rooms
// here are separate documents — walking into Karaoke Night is a full page
// load. Wiring only the main entry left the one transition worth watching
// unrecorded (2026-09-10).
initVoiceDiagnostics()
if (PORTABLE_CONSOLE) {
  // Dynamic, and behind a compile-time constant: a normal build folds this to
  // `if (false)` and the module never enters the bundle at all.
  void import('@/components/PortableConsole').then((m) => {
    m.setupPortableConsole()
  })
}

// The Mirror is the ad landing page: boot Consent Mode + the cookie banner
// before the tag loads, so EEA/UK/CH clicks are gated from the first paint.
setupConsent()

const root = document.getElementById('root')
if (root) {
  const entryIntent = mirrorEntryIntent(window.location.pathname)
  render(() => <MirrorApp entryIntent={entryIntent} />, root)
}
