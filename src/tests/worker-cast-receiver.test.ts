// ============================================================
// The Cast receiver page, served with a policy of its own
// ============================================================
//
// The site's Content-Security-Policy would stop a Cast receiver: it lets no
// script come from gstatic, where Google serves the Web Receiver SDK, and
// its connect-src does not allow the socket the SDK opens to the device,
// ws://localhost:8008/v2/ipc. A Cast device pointed at the page would load
// it and never start a session. So the site Worker serves /cast-receiver
// and puts the receiver's own policy in place of the site's
// (src/lib/cast-receiver/receiver-headers.ts).

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { CAST_RECEIVER_PATH, CAST_RECEIVER_SDK_URL, } from '@/lib/cast-receiver/cast-config'
import { CAST_DEVICE_SOCKET, CAST_RECEIVER_CSP, } from '@/lib/cast-receiver/receiver-headers'
import type { Env } from '@/worker'
import worker from '@/worker'

vi.mock('@cloudflare/containers', () => ({
  Container: class Container {
    readonly mock = true
  },
  ContainerProxy: class ContainerProxy {
    readonly mock = true
  },
}))

const SITE_CSP = "default-src 'self'; script-src 'self'"

function assetsEnv() {
  const fetch = vi.fn(async (request: Request) => {
    return new Response(`page for ${new URL(request.url).pathname}`, {
      status: 200,
      headers: {
        'Content-Type': 'text/html',
        'Content-Security-Policy': SITE_CSP,
        'X-Content-Type-Options': 'nosniff',
      },
    })
  })
  return { env: { ASSETS: { fetch } } as unknown as Env, fetch }
}

function directive(policy: string, name: string): string[] {
  const found = policy
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name} `))
  if (found === undefined) throw new Error(`no ${name}`)
  return found.split(/\s+/).slice(1)
}

describe('the Cast receiver page', () => {
  it('is served with its own policy in place of the site’s, and kept out of search', async () => {
    const { env, fetch } = assetsEnv()
    const response = await worker.fetch(
      new Request(`https://dev.mercurypitch.test${CAST_RECEIVER_PATH}`),
      env,
    )
    // Asked for by its extensionless path, so the asset layer serves the
    // document rather than its drop-`.html` redirect.
    expect(new URL(fetch.mock.calls[0][0].url).pathname).toBe(
      CAST_RECEIVER_PATH,
    )
    expect(response.status).toBe(200)
    await expect(response.text()).resolves.toBe('page for /cast-receiver')
    expect(response.headers.get('Content-Security-Policy')).toBe(
      CAST_RECEIVER_CSP,
    )
    expect(response.headers.get('X-Robots-Tag')).toBe('noindex')
    // The rest of the site's headers stay.
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff')
  })

  it('lets Google’s Web Receiver SDK load, and its socket to the device open', () => {
    const sdk = new URL(CAST_RECEIVER_SDK_URL).origin
    expect(directive(CAST_RECEIVER_CSP, 'script-src')).toContain(sdk)
    expect(directive(CAST_RECEIVER_CSP, 'connect-src')).toContain(
      CAST_DEVICE_SOCKET,
    )
    expect(CAST_DEVICE_SOCKET).toBe('ws://localhost:8008')
  })

  it('allows no eval and no inline script: the SDK needs neither', () => {
    const scripts = directive(CAST_RECEIVER_CSP, 'script-src')
    expect(scripts).not.toContain("'unsafe-eval'")
    expect(scripts).not.toContain("'unsafe-inline'")
  })

  it('would be stopped by the site’s own policy, which is why it has one', () => {
    const headers = readFileSync(
      resolve(process.cwd(), 'public/_headers'),
      'utf8',
    )
    const site = headers
      .split('\n')
      .map((row) => row.trim())
      .find((row) => row.startsWith('Content-Security-Policy:'))
      ?.slice('Content-Security-Policy:'.length)
      .trim()
    expect(site).toBeDefined()
    expect(directive(site ?? '', 'script-src')).not.toContain(
      new URL(CAST_RECEIVER_SDK_URL).origin,
    )
    expect(directive(site ?? '', 'connect-src')).not.toContain(
      CAST_DEVICE_SOCKET,
    )
  })

  it('is routed through the Worker, which a path with a file needs for its own headers', () => {
    const config = readFileSync(
      resolve(process.cwd(), 'wrangler.jsonc'),
      'utf8',
    )
    expect(config).toContain(`"${CAST_RECEIVER_PATH}",`)
  })

  it('loads the SDK from Google and the receiver’s own script, and nothing of the app', () => {
    const page = readFileSync(
      resolve(process.cwd(), 'cast-receiver.html'),
      'utf8',
    ).replace(/<!--[\s\S]*?-->/gu, '')
    const scripts = [...page.matchAll(/<script\b[^>]*>/gu)].map((tag) => tag[0])
    expect(scripts).toEqual([
      `<script src="${CAST_RECEIVER_SDK_URL}">`,
      '<script type="module" src="/src/cast-receiver/main.ts">',
    ])
    expect(page).not.toMatch(/<link\b/u)
    expect(page).toContain('<meta name="robots" content="noindex" />')
  })
})
