import type { Env } from './auth'

interface TurnstileSiteverifyResponse {
  success?: boolean
  'error-codes'?: unknown
  hostname?: unknown
  action?: unknown
}

function sanitizedSiteverifyContext(data: TurnstileSiteverifyResponse): {
  errorCodes: string[]
  hostname: string | null
  action: string | null
} {
  return {
    errorCodes: Array.isArray(data['error-codes'])
      ? data['error-codes'].filter(
          (value): value is string => typeof value === 'string',
        )
      : [],
    hostname: typeof data.hostname === 'string' ? data.hostname : null,
    action: typeof data.action === 'string' ? data.action : null,
  }
}

// Cloudflare Turnstile (CAPTCHA) verification for the public auth endpoints, layered on top of the
// rate limiter. When TURNSTILE_SECRET is unset the gate is disabled ONLY in local development
// (ALLOWED_ORIGINS contains localhost); in any deployed environment an unset secret now FAILS CLOSED (S9) so
// a misconfigured production can't silently drop the CAPTCHA — set the secret (and the frontend
// VITE_TURNSTILE_SITE_KEY) to enforce it. When configured it also fails closed on a missing/invalid token.
export async function verifyTurnstile(
  request: Request,
  env: Env,
  token: string | undefined,
): Promise<boolean> {
  const secret = env.TURNSTILE_SECRET
  if (secret === undefined || secret.length === 0) {
    // Local dev convenience: no secret needed to exercise the auth flow.
    // The check is deliberately on ALLOWED_ORIGINS and nothing else. An
    // earlier version also sniffed `process.env.VITEST`, which does not
    // typecheck in a Worker (no node types) and put test-detection into
    // shipped code. Tests set ALLOWED_ORIGINS like a local dev would.
    if (env.ALLOWED_ORIGINS?.includes('localhost') === true) {
      return true
    }
    // Deployed without a secret → fail closed and make it visible in observability.
    console.warn(
      'TURNSTILE_SECRET is not set while ALLOWED_ORIGINS does not include localhost; failing CAPTCHA verification closed.',
    )
    return false
  }
  if (token === undefined || token.length === 0) return false
  try {
    const res = await fetch(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          secret,
          response: token,
          remoteip: request.headers.get('CF-Connecting-IP') ?? '',
        }),
      },
    )
    const data = (await res.json()) as TurnstileSiteverifyResponse
    if (data.success === true) return true

    // Siteverify error codes identify a mismatched secret immediately. Never
    // log the response token, secret, caller IP, or the full upstream body.
    console.warn(
      'Turnstile Siteverify rejected an authentication token.',
      sanitizedSiteverifyContext(data),
    )
    return false
  } catch {
    console.warn(
      'Turnstile Siteverify was unavailable or returned malformed data; failing CAPTCHA verification closed.',
    )
    return false // fail closed when the gate is configured
  }
}
