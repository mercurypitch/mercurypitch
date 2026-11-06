// ============================================================
// Feature switch client — what the studio sends, and how it reads each answer
// ============================================================
//
// The client is the Features page's only way to the switch routes, so these
// hold the wire: the paths, the method, the credential and the body it
// sends, and every kind of answer it can get back, refusals and a dead
// network included. `fetch` is the stand-in, the true edge.

import { describe, expect, it, vi } from 'vitest'
import type { Fetcher } from './feature-switch-client'
import { featureSwitchEnvironment, fetchFeatureSwitches, saveFeatureSwitch, } from './feature-switch-client'

function answering(status: number, body: unknown) {
  return vi.fn<Fetcher>(
    async () =>
      new Response(typeof body === 'string' ? body : JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' },
      }),
  )
}

const STUDIO_ON = {
  name: 'studio',
  enabled: true,
  updatedAt: '2026-10-20T14:02:00.000Z',
}

describe('fetchFeatureSwitches', () => {
  it('reads the list past the HTTP cache with the admin key, a name this build does not know included', async () => {
    const later = { name: 'karaoke-v2', enabled: null, updatedAt: null }
    const fetcher = answering(200, { features: [STUDIO_ON, later] })

    const result = await fetchFeatureSwitches('the-key', fetcher)

    expect(fetcher.mock.calls).toEqual([
      [
        '/api/admin/features',
        { headers: { 'X-Admin-Key': 'the-key' }, cache: 'no-store' },
      ],
    ])
    expect(result).toEqual({ ok: true, value: [STUDIO_ON, later] })
  })

  it('will not read a list with a row it cannot read, rather than hide that switch', async () => {
    const result = await fetchFeatureSwitches(
      'the-key',
      answering(200, {
        features: [
          STUDIO_ON,
          { name: 'ghost', enabled: 'yes', updatedAt: null },
        ],
      }),
    )

    expect(result).toEqual({
      ok: false,
      error: {
        kind: 'unreadable',
        message: 'The API answered something this page cannot read.',
      },
    })
  })

  it('reads a refused key as its own kind, in the API words', async () => {
    const result = await fetchFeatureSwitches(
      'wrong',
      answering(403, { error: 'Admin key required' }),
    )

    expect(result).toEqual({
      ok: false,
      error: { kind: 'forbidden', message: 'Admin key required' },
    })
  })

  it('reads a request that never reached the API as offline, not as a refusal', async () => {
    const fetcher = vi.fn<Fetcher>(async () => {
      throw new TypeError('Failed to fetch')
    })

    const result = await fetchFeatureSwitches('the-key', fetcher)

    expect(result).toEqual({
      ok: false,
      error: { kind: 'offline', message: 'The API could not be reached.' },
    })
  })
})

describe('saveFeatureSwitch', () => {
  it('sends one PUT for the feature, with the admin key and the switch as JSON', async () => {
    const fetcher = answering(200, { row: STUDIO_ON, changed: true })

    const result = await saveFeatureSwitch('the-key', 'studio', true, fetcher)

    expect(fetcher.mock.calls).toEqual([
      [
        '/api/admin/features/studio',
        {
          method: 'PUT',
          headers: {
            'X-Admin-Key': 'the-key',
            'Content-Type': 'application/json',
          },
          body: '{"enabled":true}',
        },
      ],
    ])
    expect(result).toEqual({
      ok: true,
      value: { row: STUDIO_ON, changed: true },
    })
  })

  it('sends null as null, which hands the feature back to the build', async () => {
    const cleared = { name: 'studio', enabled: null, updatedAt: null }
    const fetcher = answering(200, { row: cleared, changed: true })

    const result = await saveFeatureSwitch('the-key', 'studio', null, fetcher)

    expect(fetcher.mock.calls[0]?.[1]?.body).toBe('{"enabled":null}')
    expect(result).toEqual({ ok: true, value: { row: cleared, changed: true } })
  })

  it('puts the name in the path as one escaped segment', async () => {
    const fetcher = answering(200, { row: STUDIO_ON, changed: false })

    await saveFeatureSwitch('the-key', 'a b/c', false, fetcher)

    expect(fetcher.mock.calls[0]?.[0]).toBe('/api/admin/features/a%20b%2Fc')
  })

  it("passes on the API's error text for a switch it refused", async () => {
    const result = await saveFeatureSwitch(
      'the-key',
      'ghost',
      true,
      answering(400, { error: 'Unknown feature: expected one of studio' }),
    )

    expect(result).toEqual({
      ok: false,
      error: {
        kind: 'refused',
        status: 400,
        message: 'Unknown feature: expected one of studio',
      },
    })
  })

  it('names the status when a refusal carries no error text', async () => {
    const result = await saveFeatureSwitch(
      'the-key',
      'studio',
      false,
      answering(502, '<html>Bad gateway</html>'),
    )

    expect(result).toEqual({
      ok: false,
      error: {
        kind: 'refused',
        status: 502,
        message: 'The API answered 502.',
      },
    })
  })

  it('will not take an answer without its row for a saved one', async () => {
    const result = await saveFeatureSwitch(
      'the-key',
      'studio',
      true,
      answering(200, { changed: true }),
    )

    expect(result).toMatchObject({ ok: false, error: { kind: 'unreadable' } })
  })
})

describe('featureSwitchEnvironment', () => {
  it("names the page's own origin where the build has no API, since the calls go there", () => {
    expect(window.location.hostname).toBe('localhost')

    expect(featureSwitchEnvironment()).toEqual({
      kind: 'development',
      label: 'Development · localhost',
    })
  })
})
