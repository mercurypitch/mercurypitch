// ============================================================
// Piano Night standalone entry mounts an app-store-free Solid document.
// ============================================================

import { render } from 'solid-js/web'
import '@/styles/mobile-kit.css'
import { PianoNightApp } from './PianoNightApp'

const root = document.getElementById('root')
if (root) {
  render(() => <PianoNightApp />, root)
}
