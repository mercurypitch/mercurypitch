/** Point the pitch engine at this app's bundled runtime assets.
 *
 * The ONNX wasm pair is copied from node_modules into public/ort by the
 * sync-ort-assets script (predev/prebuild); the SwiftF0 model ships in
 * public/models. Resolving against the document URL keeps both working
 * under vite dev, `base: './'` web builds, and the Capacitor webview.
 */
import { configurePitchEngineAssets } from '@irchiinnuss/pitch-engine'

configurePitchEngineAssets({
  wasmBase: new URL('ort/', window.location.href).toString(),
  modelPath: new URL('models/swiftf0.onnx', window.location.href).toString(),
})
