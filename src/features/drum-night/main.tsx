// ============================================================
// Drum Night standalone entry mounts an app-store-free Solid document.
// ============================================================

import { render } from 'solid-js/web'
import '@/styles/mobile-kit.css'
import '@/styles/performance-mode.css'
import { initDeviceTier } from '@/lib/device-tier'
import { DrumNightApp } from './DrumNightApp'

initDeviceTier()

const root = document.getElementById('root')
if (root) {
  render(() => <DrumNightApp />, root)
}
