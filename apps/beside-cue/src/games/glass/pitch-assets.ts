/** Point the pitch engine at this app's bundled runtime assets.
 *
 * The ONNX wasm pair is copied from node_modules into public/ort by the
 * Vite game-assets plugin (also for direct builds); the SwiftF0 model ships in
 * public/models. Resolving against the document URL keeps both working
 * under vite dev, `base: './'` web builds, and the Capacitor webview.
 *
 * IMPORTED BY THE GAMES LOADER (src/games/entry.ts), before the games
 * screen module, not by whoever happens to need pitch first. It used to
 * be reached only through JourneyPrototype's import, which worked purely
 * because GamesScreen imports that component statically -- so the day
 * anyone code-split it, every 3D room would have quietly fallen back to
 * the CDN for its wasm and an absolute `/models/...` for the model, and
 * produced no pitch at all with no error to show for it. A silent
 * dependency on an unrelated import graph is not a configuration.
 *
 * It was imported at app boot (src/main.tsx) until the games left v1
 * (2026-09-14): boot is outside the games switch, so the pitch engine and
 * its wasm stayed in a bundle that has no games. The loader awaits this
 * module before it loads the screen, so no game can run unconfigured.
 */
import { configurePitchEngineAssets } from '@irchiinnuss/pitch-engine'

configurePitchEngineAssets({
  wasmBase: new URL('ort/', window.location.href).toString(),
  modelPath: new URL('models/swiftf0.onnx', window.location.href).toString(),
})
