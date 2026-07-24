import type { CapacitorConfig } from '@capacitor/cli'

// Break Glass — the Shipaton 2026 native game. Wraps the offline, WASM-free
// glass experience (glass.html's engine) as a Capacitor app. The web bundle
// is built by vite.config.native.ts into dist-native/ with the platform seam
// (@/lib/platform) aliased to the Capacitor implementations.
const config: CapacitorConfig = {
  appId: 'com.mercurypitch.glass',
  appName: 'Break Glass',
  webDir: 'dist-native',
  ios: {
    // The glass stage draws edge-to-edge; keep the webview under the notch
    // and honor safe-area insets from the web side (viewport-fit=cover).
    contentInset: 'always',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 700,
      backgroundColor: '#090714',
      showSpinner: false,
    },
  },
}

export default config
