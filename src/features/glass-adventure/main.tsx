// ============================================================
// Glassworks campaign entry — MercuryPitch's standalone museum front door
// ============================================================

import { GlassCampaign } from '@irchiinnuss/glass-game/campaign'
import { render } from 'solid-js/web'
import '@fontsource-variable/gabarito'
import '@/lib/pitch-engine-assets'
import './glass-adventure.css'
import { createMercuryGlassHost } from './host'

const root = document.getElementById('root')
if (root === null) throw new Error('The Glassworks mount is missing.')

const host = createMercuryGlassHost(() => {
  window.location.href = '/'
})

render(() => <GlassCampaign host={host} />, root)
