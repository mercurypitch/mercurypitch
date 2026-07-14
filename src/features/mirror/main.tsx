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
import { MirrorApp } from './MirrorApp'

// The Mirror is the ad landing page: boot Consent Mode + the cookie banner
// before the tag loads, so EEA/UK/CH clicks are gated from the first paint.
setupConsent()

const root = document.getElementById('root')
if (root) {
  render(() => <MirrorApp />, root)
}
