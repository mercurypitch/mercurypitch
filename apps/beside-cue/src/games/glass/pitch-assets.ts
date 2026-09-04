/** Point the pitch engine at this app's bundled runtime assets.
 *
 * The ONNX wasm pair is copied from node_modules into public/ort by the
 * sync-ort-assets script (predev/prebuild); the SwiftF0 model ships in
 * public/models. Resolving against the document URL keeps both working
 * under vite dev, `base: './'` web builds, and the Capacitor webview.
 *
 * IMPORTED AT APP BOOT (src/main.tsx), not by whoever happens to need
 * pitch first. It used to be reached only through JourneyPrototype's
 * import, which worked purely because GamesScreen imports that component
 * statically -- so the day anyone code-split it, every 3D room would
 * have quietly fallen back to the CDN for its wasm and an absolute
 * `/models/...` for the model, and produced no pitch at all with no
 * error to show for it. A silent dependency on an unrelated import
 * graph is not a configuration.
 */
import { configurePitchEngineAssets } from '@irchiinnuss/pitch-engine'

configurePitchEngineAssets({
  wasmBase: new URL('ort/', window.location.href).toString(),
  modelPath: new URL('models/swiftf0.onnx', window.location.href).toString(),
})
