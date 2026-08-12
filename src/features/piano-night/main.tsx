// ============================================================
// Piano Night standalone entry mounts an app-store-free Solid document.
// ============================================================

import { render } from 'solid-js/web'
import '@/styles/mobile-kit.css'
import '@/styles/performance-mode.css'
import { initDeviceTier } from '@/lib/device-tier'
import { PianoNightApp } from './PianoNightApp'

// Publish the device tier on <html> before the first paint: a television
// must never render a frame of full-quality glass and then downgrade.
initDeviceTier()

const root = document.getElementById('root')
if (root) {
  render(() => <PianoNightApp />, root)
}
