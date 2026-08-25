// Verifies that the deployed DEV auth Worker rejects Cloudflare's public Turnstile test token.

import { fileURLToPath } from 'node:url'

import { getPlatformProxy } from 'wrangler'

const CONFIG_PATH = fileURLToPath(
  new URL(
    '../workers/db-worker/wrangler.dev-turnstile-canary.jsonc',
    import.meta.url,
  ),
)
const DEV_AUTH_URL = 'https://api-dev.mercurypitch.com/api/auth/login'
const EXPECTED_ERROR = 'CAPTCHA verification failed. Please try again.'

if (process.env.DEPLOY_ENV !== 'dev') {
  throw new Error('The Turnstile isolation canary may run only against DEV.')
}

let platform
try {
  platform = await getPlatformProxy({
    configPath: CONFIG_PATH,
    remoteBindings: true,
    persist: false,
  })

  const devWorker = platform.env.DEV_DB
  if (
    typeof devWorker !== 'object' ||
    devWorker === null ||
    !('fetch' in devWorker) ||
    typeof devWorker.fetch !== 'function'
  ) {
    throw new Error('The remote DEV_DB Service Binding is unavailable.')
  }

  const runId = process.env.GITHUB_RUN_ID ?? 'local'
  const response = await devWorker.fetch(DEV_AUTH_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      email: `turnstile-isolation-${runId}@example.invalid`,
      password: 'DeliberatelyWrong-7f2c',
      cfTurnstileToken: 'XXXX.DUMMY.TOKEN.XXXX',
    }),
  })
  const responseText = await response.text()

  if (response.status === 401) {
    throw new Error(
      "DEV accepted Cloudflare's public Turnstile test token; the DEV secret is contaminated.",
    )
  }
  if (response.status !== 400) {
    throw new Error(
      `DEV Turnstile isolation canary returned HTTP ${response.status}; expected 400.`,
    )
  }

  let responseBody
  try {
    responseBody = JSON.parse(responseText)
  } catch {
    throw new Error('DEV Turnstile isolation canary returned non-JSON.')
  }
  if (
    typeof responseBody !== 'object' ||
    responseBody === null ||
    responseBody.error !== EXPECTED_ERROR
  ) {
    throw new Error(
      'DEV Turnstile isolation canary returned an unexpected body.',
    )
  }

  console.log('DEV Turnstile credential isolation verified.')
} finally {
  await platform?.dispose()
}
