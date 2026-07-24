// ============================================================
// Break Glass — native (Capacitor) entry point (game.html → dist-native).
//
// Unlike the web entry (main.tsx) this ships no cookie-consent banner and no
// web analytics: it boots RevenueCat (no-op without keys) and mounts the game
// shell. The platform seam (@/lib/platform) is aliased to the Capacitor impls
// by vite.config.native.ts, so haptics/keep-awake/share/status-bar are native.
// ============================================================

import { render } from 'solid-js/web'
import './glass.css'
import { initPurchases } from '@/lib/monetization/revenuecat'
import { GameShell } from './GameShell'

// Fire-and-forget: configures RevenueCat and hydrates entitlement state.
void initPurchases()

const root = document.getElementById('root')
if (root) {
  render(() => <GameShell />, root)
}
