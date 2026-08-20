// ============================================================
// The Content-Security-Policy has to allow what the app actually loads
// ============================================================
//
// It did not, and the failure was silent in the worst way: the Turnstile
// script was blocked, so the widget never rendered, so it never produced a
// token, so the Sign in button stayed disabled forever. No error surfaced
// in the UI — a working form simply refused to submit.
//
// These tests read the deployed header file and check it against the URLs
// the source actually uses, so adding a third-party integration without
// opening the policy for it fails here rather than on the site.

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { TURNSTILE_SCRIPT_SRC } from '@/components/shared/Turnstile'

const headers = readFileSync(resolve(process.cwd(), 'public/_headers'), 'utf8')

const policy = (() => {
  const line = headers
    .split('\n')
    .map((row) => row.trim())
    .find((row) => row.startsWith('Content-Security-Policy:'))
  if (line === undefined)
    throw new Error('no Content-Security-Policy in public/_headers')
  return line.slice('Content-Security-Policy:'.length).trim()
})()

function directive(name: string): string[] {
  const found = policy
    .split(';')
    .map((part) => part.trim())
    .find((part) => part === name || part.startsWith(`${name} `))
  if (found === undefined) throw new Error(`no ${name} directive`)
  return found.split(/\s+/).slice(1)
}

/** Whether `origin` is allowed by a directive, honouring `*` wildcards. */
function allows(sources: readonly string[], origin: string): boolean {
  return sources.some((source) => {
    if (source === origin || source === 'https:' || source === '*') return true
    if (!source.includes('*')) return false
    const pattern = new RegExp(
      `^${source.split('*').map(escapeRegExp).join('[^.]+')}$`,
    )
    return pattern.test(origin)
  })
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

describe('Content-Security-Policy', () => {
  it('lets the Turnstile widget script load', () => {
    // The regression: `script-src` listed Google's hosts and nothing else,
    // so this script 404'd into a CSP violation on every auth form.
    const origin = new URL(TURNSTILE_SCRIPT_SRC).origin
    expect(allows(directive('script-src'), origin)).toBe(true)
  })

  it('lets the Turnstile widget draw its iframe', () => {
    // A CAPTCHA is an iframe. Allowing only the script would load the API
    // and still show an empty box where the challenge should be.
    const origin = new URL(TURNSTILE_SCRIPT_SRC).origin
    expect(allows(directive('frame-src'), origin)).toBe(true)
  })

  it('still refuses to be framed by anybody', () => {
    expect(directive('frame-ancestors')).toEqual(["'none'"])
  })

  it('still refuses plugin content and stray base tags', () => {
    expect(directive('object-src')).toEqual(["'none'"])
    expect(directive('base-uri')).toEqual(["'self'"])
  })

  it('keeps every third-party origin on https', () => {
    for (const name of [
      'default-src',
      'script-src',
      'style-src',
      'frame-src',
    ]) {
      for (const source of directive(name)) {
        if (
          source.startsWith("'") ||
          source === 'blob:' ||
          source === 'data:'
        ) {
          continue
        }
        expect(source.startsWith('https://'), `${name}: ${source}`).toBe(true)
      }
    }
  })
})
