// ============================================================
// Which db-worker a native build talks to — decided in one place
// ============================================================
//
// The native bundle compiled `VITE_API_BASE_URL` in as undefined, so every
// sign-in on the phone died in `src/db/services/auth-service.ts` with
// "VITE_API_BASE_URL is not configured". The web app never had the problem:
// its `.env.development` and `.env.production` each name a worker. This app
// reads neither — Vite loads env files from `apps/mercurypitch/`, not from the
// repository root — so it has to say for itself.
//
// THE DEFAULT IS THE DEV WORKER. The tracked `apps/mercurypitch/.env` names
// `https://api-dev.mercurypitch.com`, and that is what every build compiles
// in unless somebody asks otherwise: a laptop build, a pull request, a push to
// main, a TestFlight tag. The owner's rule is that nothing is tested against
// production, and every one of those is a test build.
//
// PRODUCTION IS A SWITCH, NOT A VALUE. The store build gets
// `https://api.mercurypitch.com` only when the process environment carries
// `MERCURYPITCH_API_TARGET=production` — set on purpose by whoever runs the
// release (the `api-target` input of `.github/workflows/mercurypitch-mobile.yml`,
// or the command line). It is read from the PROCESS only, never from an env
// file, so a stray `.env.local` cannot turn every build on a machine into a
// production build. And the production URL typed into `VITE_API_BASE_URL`
// without the switch is refused rather than obeyed: the switch is the only
// door.
//
// Shared by `vite.config.ts`, which compiles the answer in and prints it, and
// by `scripts/assert-bundle.mjs`, which reads the built JS and fails when the
// answer is not what is there. Both read the env files through Vite's own
// `loadEnv`, so an inline comment, an `export ` prefix, quotes or a `${VAR}`
// mean here exactly what they mean to the build. A hand-rolled reader once
// took `URL # the dev worker` for the URL, and `export VITE_API_BASE_URL=`
// for no base at all. Every job that runs assert-bundle has installed the
// workspace first, so `vite` is there.

import { loadEnv } from 'vite'

/** The two workers a native build may name, and nothing else is special. */
export const API_BASES = Object.freeze({
  dev: 'https://api-dev.mercurypitch.com',
  production: 'https://api.mercurypitch.com',
})

/** The switch. Read from the process environment only. */
export const API_TARGET_ENV = 'MERCURYPITCH_API_TARGET'

/**
 * The `VITE_` variables Vite loads for `mode` from `dir`: its own `loadEnv`,
 * so its file order, its parser and its `${VAR}` expansion. As for the build,
 * a `VITE_` variable already in the process environment wins over the files.
 *
 * @param {string} dir
 * @param {string} mode
 * @returns {Record<string, string>}
 */
export function readEnvFiles(dir, mode) {
  return loadEnv(mode, dir, 'VITE_')
}

/**
 * The base a build compiles in, and where that answer came from.
 *
 * @param {Record<string, string | undefined>} files what the env files say
 * @param {Record<string, string | undefined>} processEnv the process environment
 * @returns {{ base: string, target: 'dev' | 'production' | 'configured', source: string }}
 */
export function resolveApiBase(files, processEnv) {
  const target = (processEnv[API_TARGET_ENV] ?? '').trim()

  if (target === 'production') {
    return {
      base: API_BASES.production,
      target: 'production',
      source: `${API_TARGET_ENV}=production`,
    }
  }
  if (target === 'dev') {
    return {
      base: API_BASES.dev,
      target: 'dev',
      source: `${API_TARGET_ENV}=dev`,
    }
  }
  if (target !== '') {
    throw new Error(
      `${API_TARGET_ENV} is "${target}"; it takes "dev" or "production", or nothing at all (which means apps/mercurypitch/.env).`,
    )
  }

  const fromProcess = processEnv.VITE_API_BASE_URL
  // No trailing slash: `${base}/api/...` is how every caller joins it, and a
  // dev worker written with one is still the dev worker.
  const base = (fromProcess ?? files.VITE_API_BASE_URL ?? '')
    .trim()
    .replace(/\/+$/u, '')
  const source =
    fromProcess !== undefined
      ? 'VITE_API_BASE_URL from the process environment'
      : files.VITE_API_BASE_URL !== undefined
        ? 'VITE_API_BASE_URL from apps/mercurypitch/.env*'
        : 'nothing: no VITE_API_BASE_URL anywhere'

  if (base === API_BASES.production) {
    throw new Error(
      `VITE_API_BASE_URL names the production worker (${base}) without ${API_TARGET_ENV}=production. The production worker is compiled in only through that switch — see apps/mercurypitch/.env.example.`,
    )
  }
  return {
    base,
    target: base === API_BASES.dev ? 'dev' : 'configured',
    source,
  }
}

// ============================================================
// Where a native build separates songs, and whether it offers to
// ============================================================
//
// Separation is not the db-worker's: `/api/uvr/*` is served by the web app's
// own worker (src/worker.ts), which checks the singer's token against the
// db-worker named in its `DB_API_URL`. So the host a native build separates
// on is the web host that goes WITH its db-worker: dev.mercurypitch.com
// checks tokens against api-dev, mercurypitch.com against api. Deriving one
// from the other, rather than reading a second variable, is what keeps a
// build from signing in against one and separating against the other.
//
// A build pointed at some other worker ('configured', a local one) has no
// web host to derive, so the process may name one: `MERCURYPITCH_UVR_ORIGIN`.
// Only then. A stray variable cannot move a TestFlight or a store build.

/** The web app's worker for each db-worker a native build may name. */
export const UVR_ORIGINS = Object.freeze({
  dev: 'https://dev.mercurypitch.com',
  production: 'https://mercurypitch.com',
})

/** Names the separation host for a build pointed at another worker. */
export const UVR_ORIGIN_ENV = 'MERCURYPITCH_UVR_ORIGIN'

/**
 * The origin a native build sends `/api/uvr/*` to. Empty for a build with
 * no web host to go with its worker: separation then has nowhere to go, and
 * the bundle asks the page's own origin, as the web does.
 *
 * @param {{ target: string }} api what `resolveApiBase` answered
 * @param {Record<string, string | undefined>} processEnv the process environment
 * @returns {string}
 */
export function resolveUvrOrigin(api, processEnv) {
  if (api.target === 'dev') return UVR_ORIGINS.dev
  if (api.target === 'production') return UVR_ORIGINS.production
  return (processEnv[UVR_ORIGIN_ENV] ?? '').trim().replace(/\/+$/u, '')
}

/**
 * Whether the Karaoke room offers to import a singer's own songs (plan S8,
 * Stage 2). The owner's rule, 27 Sep: on in every build that is not the
 * store build, which is TestFlight, a probe and a laptop; off in the store
 * build until the subscription is real. The switch that picks the worker
 * picks this too, so the two cannot disagree.
 *
 * @param {{ target: string }} api what `resolveApiBase` answered
 * @returns {boolean}
 */
export function karaokeImportFor(api) {
  return api.target !== 'production'
}
