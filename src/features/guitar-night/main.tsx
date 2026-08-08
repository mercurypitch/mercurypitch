// Guitar Night standalone entry mounts an app-store-free Solid document.
// ============================================================

import { render } from 'solid-js/web'
import '@/styles/mobile-kit.css'
import { restoreAuth } from '@/db/services/auth-service'
import { GuitarNightApp } from './GuitarNightApp'

// Pick up a session signed in elsewhere so the account chip and its credit
// balance are real. Restore only — never provision: entering a rehearsal room
// must not mint an identity, and the paid paths call requireAuth themselves.
// A no-op when no backend is configured (e2e and tour builds).
void restoreAuth()

const root = document.getElementById('root')
if (root) {
  render(() => <GuitarNightApp />, root)
}
