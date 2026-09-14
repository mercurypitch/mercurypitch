// Store-shot bundle — production app code with the release presentation.
// Native purchases remain unavailable; the harness captures shared core screens.
import { defineConfig, mergeConfig } from 'vite'
import appConfig from '../vite.config'

export default defineConfig((environment) =>
  mergeConfig(appConfig(environment), {
    // Match the release UI without deleting its version/device-info controls.
    define: { __APP_CHANNEL__: JSON.stringify('release') },
    build: { outDir: 'build/store-shots' },
  }),
)
