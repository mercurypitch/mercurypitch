// ============================================================
// Drum Night standalone entry mounts an app-store-free Solid document.
// ============================================================

import { render } from 'solid-js/web'
import '@/styles/dark-stage.css'
import '@/styles/mobile-kit.css'
import '@/styles/performance-mode.css'
import { announceVoiceDiagnostics, initVoiceDiagnostics, } from '@/features/voice-control/voice-diagnostics'
import { armDeveloperConsole } from '@/lib/developer-console'
import { initDeviceTier } from '@/lib/device-tier'
import { landRoomGoogleReturn } from '@/lib/room-google-return'
import { DrumNightApp } from './DrumNightApp'

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
// Settings' danger zone. Nothing of it loads until somebody turns it on; the
// buffer behind it is filled by initGlobalErrorHandlers either way. Unrelated
// to the portable console above, which is dev-only and must never reach a
// build.
armDeveloperConsole()

// A Google sign-in started from this room's dialog comes back to THIS page
// with the session in the fragment (#gauth=…). Nothing here took it until
// 2026-10-08, so the sign-in was silently lost. The room now stores it before
// rendering, as Guitar Night and Karaoke Night do, and a return that created
// the account adopts this device's takes (REQ-VPR-014). The auth layer loads
// only when there is a fragment to take: an ordinary visit renders at once.
const root = document.getElementById('root')
if (root) {
  void landRoomGoogleReturn().then(() => {
    render(() => <DrumNightApp />, root)
  })
}
