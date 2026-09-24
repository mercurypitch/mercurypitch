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
