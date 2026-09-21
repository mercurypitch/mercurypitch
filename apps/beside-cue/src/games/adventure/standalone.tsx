// Standalone museum preview — the exact shared game used by the BesideCue entry.
import { configurePitchEngineAssets } from '@irchiinnuss/pitch-engine'
import { render } from 'solid-js/web'
import '@fontsource-variable/gabarito'
import { AdventureScreen } from './AdventureScreen'

const root = document.getElementById('root')
if (!root) throw new Error('The museum mount is missing.')
const mountElement = root
configurePitchEngineAssets({
  wasmBase: new URL('../ort/', window.location.href).toString(),
  modelPath: new URL('../models/swiftf0.onnx', window.location.href).toString(),
})

async function selectedDevelopmentLevel() {
  if (!import.meta.env.DEV) return undefined
  const layout = new URLSearchParams(window.location.search).get('layout')
  if (
    layout !== 'straight' &&
    layout !== 'quarter-turn' &&
    layout !== 'chamber' &&
    layout !== 'tutorial' &&
    layout !== 'journey' &&
    layout !== 'twin-galleries' &&
    layout !== 'conservatory' &&
    layout !== 'cloudway'
  )
    return undefined
  const {
    GLASS_ENCLOSED_CHAMBER,
    GLASSWORKS_JOURNEY,
    TWIN_GALLERIES,
    RESONANCE_CONSERVATORY,
    CLOUDWAY_GLASS_RIBBON,
    GLASS_FOUNDATION_QUARTER_TURN,
    GLASS_FOUNDATION_STRAIGHT,
  } = await import('@irchiinnuss/glass-game/development-levels')
  if (layout === 'chamber' || layout === 'tutorial')
    return GLASS_ENCLOSED_CHAMBER
  if (layout === 'journey') return GLASSWORKS_JOURNEY
  if (layout === 'twin-galleries') return TWIN_GALLERIES
  if (layout === 'conservatory') return RESONANCE_CONSERVATORY
  if (layout === 'cloudway') return CLOUDWAY_GLASS_RIBBON
  return layout === 'straight'
    ? GLASS_FOUNDATION_STRAIGHT
    : GLASS_FOUNDATION_QUARTER_TURN
}

async function mount(): Promise<void> {
  const level = await selectedDevelopmentLevel()
  render(
    () => (
      <AdventureScreen
        assetBase="../games/"
        level={level}
        campaign={
          new URLSearchParams(window.location.search).get('campaign') === '1'
        }
        onExit={() => {
          window.location.href = '../'
        }}
      />
    ),
    mountElement,
  )
}

void mount()
