import type { Env } from './auth'

interface TurnstileSiteverifyResponse {
  success?: boolean
  'error-codes'?: unknown
  hostname?: unknown
  action?: unknown
}

/** What the gate decided, and what Cloudflare said while deciding it. */
export interface TurnstileOutcome {
  ok: boolean
  /**
   * The hostname siteverify reports the widget was solved on, when it told us
   * one. Only ever surfaced to a native caller — see `captchaFailureBody`.
   */
  hostname?: string | null
}

/**
 * The exact origins a Capacitor shell sends: `capacitor://localhost` on iOS,
 * `https://localhost` on Android. Exported because two places have to agree
 * on them — this file, which tells a native caller which hostname Turnstile
 * saw, and `ALLOWED_ORIGINS` in wrangler.jsonc, which lists them verbatim.
 *
 * They are NOT local-development markers. A shipped app on a stranger's phone
 * sends them, so nothing may be relaxed on the strength of seeing one.
 */
export const CAPACITOR_ORIGINS = ['capacitor://localhost', 'https://localhost']

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

/**
 * Does this allowlist describe a LOCAL development worker?
 *
 * Entry-wise, and that is the whole point. This used to be
 * `ALLOWED_ORIGINS.includes('localhost')` — a substring test against the
 * whole comma-joined string — which was safe only by accident: it sits inside
 * the "no secret configured" branch, and the secret happens to be set on both
 * deployed environments. Adding the Capacitor origins arms it for real,
 * because `'…,capacitor://localhost,https://localhost'.includes('localhost')`
 * is true, and a production worker that ever lost its TURNSTILE_SECRET would
 * then wave every signup through instead of failing closed.
 *
 * Only two kinds of entry count: the bare `localhost` rule, which index.ts
 * reads as "any localhost origin, any scheme and port" and which production
 * must never carry, and a plain-http localhost origin, which is what a laptop
 * serving Vite looks like. `https://localhost` and `capacitor://localhost`
 * deliberately do not count: those are a phone, not a laptop.
 */
export function isLocalDevelopmentAllowlist(
  allowed: string | undefined,
): boolean {
  return (allowed ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .some(isLocalDevelopmentEntry)
}

function isLocalDevelopmentEntry(entry: string): boolean {
  if (entry === '') return false
  if (entry === 'localhost') return true
  let url: URL
  try {
    url = new URL(entry)
  } catch {
    return false
  }
  if (url.protocol !== 'http:') return false
  return url.hostname === 'localhost' || url.hostname === '127.0.0.1'
}

/**
 * The 400 body for a failed CAPTCHA.
 *
 * For a native caller it carries the hostname siteverify reported. That value
 * is the one thing needed to fix the likeliest day-one failure of native
 * sign-in — a hostname missing from the widget's allowlist in the Cloudflare
 * dashboard — and there is no other way to learn what a WebView presents
 * itself as. Withheld from browser callers: they cannot act on it, and it
 * says which hostnames the widget is configured for.
 */
export function captchaFailureBody(
  request: Request,
  outcome: TurnstileOutcome,
): { error: string; turnstileHostname?: string } {
  const error = 'CAPTCHA verification failed. Please try again.'
  const origin = request.headers.get('Origin')
  if (
    outcome.hostname != null &&
    origin !== null &&
    CAPACITOR_ORIGINS.includes(origin)
  ) {
    return { error, turnstileHostname: outcome.hostname }
  }
  return { error }
}

// Cloudflare Turnstile (CAPTCHA) verification for the public auth endpoints, layered on top of the
// rate limiter. When TURNSTILE_SECRET is unset the gate is disabled ONLY in local development
// (ALLOWED_ORIGINS carries a local development entry); in any deployed environment an unset secret
// now FAILS CLOSED (S9) so a misconfigured production can't silently drop the CAPTCHA — set the
// secret (and the frontend VITE_TURNSTILE_SITE_KEY) to enforce it. When configured it also fails
// closed on a missing/invalid token.
export async function verifyTurnstile(
  request: Request,
  env: Env,
  token: string | undefined,
): Promise<TurnstileOutcome> {
  const secret = env.TURNSTILE_SECRET
  if (secret === undefined || secret.length === 0) {
    // Local dev convenience: no secret needed to exercise the auth flow.
    // The check is deliberately on ALLOWED_ORIGINS and nothing else. An
    // earlier version also sniffed `process.env.VITEST`, which does not
    // typecheck in a Worker (no node types) and put test-detection into
    // shipped code. Tests set ALLOWED_ORIGINS like a local dev would.
    if (isLocalDevelopmentAllowlist(env.ALLOWED_ORIGINS)) {
      return { ok: true }
    }
    // Deployed without a secret → fail closed and make it visible in observability.
    console.warn(
      'TURNSTILE_SECRET is not set while ALLOWED_ORIGINS names no local development origin; failing CAPTCHA verification closed.',
    )
    return { ok: false }
  }
  if (token === undefined || token.length === 0) return { ok: false }
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
    if (data.success === true) return { ok: true }

    // Siteverify error codes identify a mismatched secret immediately. Never
    // log the response token, secret, caller IP, or the full upstream body.
    const context = sanitizedSiteverifyContext(data)
    console.warn(
      'Turnstile Siteverify rejected an authentication token.',
      context,
    )
    return { ok: false, hostname: context.hostname }
  } catch {
    console.warn(
      'Turnstile Siteverify was unavailable or returned malformed data; failing CAPTCHA verification closed.',
    )
    return { ok: false } // fail closed when the gate is configured
  }
}
