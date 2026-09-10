// ============================================================
// Drum Night standalone entry mounts an app-store-free Solid document.
// ============================================================

import { render } from 'solid-js/web'
import '@/styles/mobile-kit.css'
import '@/styles/performance-mode.css'
import { initVoiceDiagnostics } from '@/features/voice-control/voice-diagnostics'
import { PORTABLE_CONSOLE } from '@/lib/defaults'
import { initDeviceTier } from '@/lib/device-tier'
import { DrumNightApp } from './DrumNightApp'

initDeviceTier()

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

const root = document.getElementById('root')
if (root) {
  render(() => <DrumNightApp />, root)
}
