// Store-shot bundle — the app's own build, presented the way the store build is.
//
// Three switches, each one the store build's value rather than a dev build's.
// The app's config sets all three from the worker a build targets, and the
// store's values come only with the production worker, which this bundle
// never names; so they are forced here:
//
//   - the release channel;
//   - no song import in the Karaoke room: a store build ships the three
//     bundled example songs and nothing else (api-base.mjs
//     `karaokeImportFor`), so the screenshots must not show an Import row;
//   - no portable console, so no Developer tile in the More sheet and no
//     console panel over the rail (api-base.mjs `portableConsoleFor`; the
//     tracked `.env` turns it on for every other build).
//
// The worker the bundle names stays the dev one (apps/mercurypitch/.env):
// nothing here is ever pointed at production. The harness answers that host
// itself from fictional fixtures (shots/stand-in-api.ts), so no request
// leaves the machine.
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { ConfigEnv, UserConfig } from 'vite'
import { defineConfig, mergeConfig } from 'vite'
import appConfig from '../vite.config'

const outDir =
  process.env.MERCURYPITCH_SHOTS_BUILD_DIR ??
  join(tmpdir(), 'mercurypitch-shots-build')

export default defineConfig(async (environment: ConfigEnv) => {
  const base = (await appConfig(environment)) as UserConfig
  return mergeConfig(base, {
    define: {
      __APP_CHANNEL__: JSON.stringify('release'),
      __KARAOKE_IMPORT__: JSON.stringify(false),
      'import.meta.env.VITE_PORTABLE_CONSOLE': JSON.stringify('false'),
    },
    build: { outDir, emptyOutDir: true },
  })
})
