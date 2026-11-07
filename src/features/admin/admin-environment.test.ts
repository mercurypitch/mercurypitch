// ============================================================
// Admin environment — which environment an API address names
// ============================================================
//
// The Premium Perks and Features consoles both say which environment their
// changes reach, and production is the one a slip must never be mistaken
// for. Each row is an address as a build is configured with it.

import { describe, expect, it } from 'vitest'
import { adminEnvironment } from './admin-environment'

describe('adminEnvironment', () => {
  it.each([
    [
      'https://api.mercurypitch.com',
      'production',
      'Production · api.mercurypitch.com',
    ],
    [
      'https://studio.mercurypitch.com',
      'production',
      'Production · studio.mercurypitch.com',
    ],
    [
      'https://api-dev.mercurypitch.com',
      'development',
      'Development · api-dev.mercurypitch.com',
    ],
    ['http://localhost:8788', 'development', 'Development · localhost'],
    ['http://127.0.0.1:59999', 'development', 'Development · 127.0.0.1'],
    [
      'https://db-pr-12.mercury.workers.dev',
      'preview',
      'Preview · db-pr-12.mercury.workers.dev',
    ],
    ['https://api.example.test', 'unknown', 'api.example.test'],
  ])('reads %s as %s', (base, kind, label) => {
    expect(adminEnvironment(base)).toEqual({ kind, label })
  })

  it('says so for a build with no API, and for an address it cannot parse', () => {
    expect(adminEnvironment('')).toEqual({
      kind: 'unknown',
      label: 'No API configured',
    })
    expect(adminEnvironment('not a url')).toEqual({
      kind: 'unknown',
      label: 'not a url',
    })
  })
})
