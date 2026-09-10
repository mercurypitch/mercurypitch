// ============================================================
// Glass — standalone entry point (glass.html).
//
// A separate Vite entry, not a chunk of the main app: the glass
// page is an ad landing and must hit interactive fast on mobile
// 4G, so it mounts its own tiny Solid tree and imports none of
// the app shell, no ONNX, and no model weights. The TypeGPU
// renderer arrives later as a lazy chunk behind the Start tap.
// ============================================================

import { render } from 'solid-js/web'
import './glass.css'
import { setupConsent } from '@/components/ConsentBanner'
import { initVoiceDiagnostics } from '@/features/voice-control/voice-diagnostics'
import { PORTABLE_CONSOLE } from '@/lib/defaults'
import { trackGlass } from './funnel'
import { GlassApp } from './GlassApp'

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

// Ad landing page: boot Consent Mode + the cookie banner before any tag
// loads, so EEA/UK/CH clicks are gated from the first paint.
setupConsent()

// Funnel: one view event per browser session.
trackGlass('glass_view')

const root = document.getElementById('root')
if (root) {
  render(() => <GlassApp />, root)
}
