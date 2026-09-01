import { describe, expect, it } from 'vitest'
import { isDiagnosticHost } from './defaults'

// The memory trace this gates is written for a phone, and a phone can only be
// read from Safari's Web Inspector against a *deployed* build — so the gate
// cannot be `import.meta.env.DEV`, which is false in every build that ships
// anywhere. It has to name the deployment instead, and name it narrowly.

describe('isDiagnosticHost', () => {
  const dev = 'dev.mercurypitch.com'

  it('speaks on the surfaces a developer is actually watching', () => {
    // The local dev server, whatever host it is served from.
    expect(
      isDiagnosticHost({
        isDev: true,
        isPreview: false,
        hostname: 'localhost',
        devDomain: dev,
      }),
    ).toBe(true)
    // A pull-request preview, which has its own generated hostname.
    expect(
      isDiagnosticHost({
        isDev: false,
        isPreview: true,
        hostname: 'pr-680.mercurypitch.pages.dev',
        devDomain: dev,
      }),
    ).toBe(true)
    // And the dev site — a production build, which is the whole point.
    expect(
      isDiagnosticHost({
        isDev: false,
        isPreview: false,
        hostname: dev,
        devDomain: dev,
      }),
    ).toBe(true)
  })

  it('stays quiet on the production site and on anything it does not know', () => {
    for (const hostname of [
      'mercurypitch.com',
      'www.mercurypitch.com',
      // A lookalike must not pass: matching a suffix would have let one.
      'dev.mercurypitch.com.example.net',
      'notdev.mercurypitch.com',
    ]) {
      expect(
        isDiagnosticHost({
          isDev: false,
          isPreview: false,
          hostname,
          devDomain: dev,
        }),
        `${hostname} should not print diagnostics`,
      ).toBe(false)
    }
  })

  it('speaks wherever the dev-log relay is listening', () => {
    // `vite preview --host` serves the real bundle to a phone at a LAN IP,
    // which matches no known host — so the build actually worth debugging was
    // the one build that said nothing. The relay only exists behind a dev
    // server's env flag, so its presence is proof someone is watching.
    expect(
      isDiagnosticHost({
        isDev: false,
        isPreview: false,
        hostname: '192.168.178.33',
        devDomain: dev,
        hasDevLogRelay: true,
      }),
    ).toBe(true)
    // And its absence changes nothing about the hosts above.
    expect(
      isDiagnosticHost({
        isDev: false,
        isPreview: false,
        hostname: '192.168.178.33',
        devDomain: dev,
        hasDevLogRelay: false,
      }),
    ).toBe(false)
  })

  it('stays quiet where there is no location at all', () => {
    expect(
      isDiagnosticHost({
        isDev: false,
        isPreview: false,
        hostname: null,
        devDomain: dev,
      }),
    ).toBe(false)
  })
})
