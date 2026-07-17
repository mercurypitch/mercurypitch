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
import { trackGlass } from './funnel'
import { GlassApp } from './GlassApp'

// Ad landing page: boot Consent Mode + the cookie banner before any tag
// loads, so EEA/UK/CH clicks are gated from the first paint.
setupConsent()

// Funnel: one view event per browser session.
trackGlass('glass_view')

const root = document.getElementById('root')
if (root) {
  render(() => <GlassApp />, root)
}
