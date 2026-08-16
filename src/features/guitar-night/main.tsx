// Guitar Night standalone entry mounts an app-store-free Solid document.
// ============================================================

import { render } from 'solid-js/web'
import '@/styles/dark-stage.css'
import '@/styles/mobile-kit.css'
import '@/styles/performance-mode.css'
import { consumeGoogleRedirect, restoreAuth } from '@/db/services/auth-service'
import { initDeviceTier } from '@/lib/device-tier'
import { GuitarNightApp } from './GuitarNightApp'

// Publish the device tier on <html> before the first paint: a television
// must never render a frame of full-quality glass and then downgrade.
initDeviceTier()

// Consume Google first: the worker returns the session in #gauth, and
// restoreAuth cannot restore a token that has not been stored yet.
consumeGoogleRedirect()

// Pick up a session signed in elsewhere so the account chip and its credit
// balance are real. Restore only — never provision: entering a rehearsal room
// must not mint an identity, and the paid paths call requireAuth themselves.
// A no-op when no backend is configured (e2e and tour builds).
void restoreAuth()

const root = document.getElementById('root')
if (root) {
  render(() => <GuitarNightApp />, root)
}
