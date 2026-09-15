// Standalone museum preview — the exact shared game used by the BesideCue entry.
import { configurePitchEngineAssets } from '@irchiinnuss/pitch-engine'
import { render } from 'solid-js/web'
import '@fontsource-variable/gabarito'
import { AdventureScreen } from './AdventureScreen'

const root = document.getElementById('root')
if (!root) throw new Error('The museum mount is missing.')
configurePitchEngineAssets({
  wasmBase: new URL('../ort/', window.location.href).toString(),
  modelPath: new URL('../models/swiftf0.onnx', window.location.href).toString(),
})
render(
  () => (
    <AdventureScreen
      assetBase="../games/"
      onExit={() => {
        window.location.href = '../'
      }}
    />
  ),
  root,
)
