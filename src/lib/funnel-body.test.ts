// ============================================================
// One wire body for every funnel transport
// ============================================================
//
// The regression this exists to prevent happened during this very
// change's review: acquisition was added to lib/funnel.ts's transport
// only, and the karaoke, glass and app funnels — which carry their own
// beacons — kept sending bodies without it. /karaoke-night is the page
// Campaign E pays for, so the surface that most needed attribution was
// the one that silently lacked it. Every transport now builds its body
// here; these tests pin what "here" produces.

import { beforeEach, describe, expect, it } from 'vitest'
import { funnelEventBody } from './funnel'

function visit(url: string): void {
  window.history.replaceState({}, '', url)
}

beforeEach(() => {
  localStorage.clear()
  visit('/')
})

describe('funnelEventBody', () => {
  it('carries the acquisition when the device has one', () => {
    visit('/?gclid=CjwKCA&utm_campaign=E%20Karaoke')

    const body = JSON.parse(funnelEventBody('karaoke_song_staged'))

    expect(body.event).toBe('karaoke_song_staged')
    expect(typeof body.clientId).toBe('string')
    expect(body.clientId.length).toBeGreaterThanOrEqual(8)
    expect(body.acq).toEqual({ gclid: 'CjwKCA', utmCampaign: 'E Karaoke' })
  })

  it('omits the acq key entirely for a device with nothing recorded', () => {
    const body = JSON.parse(funnelEventBody('mirror_view'))

    expect('acq' in body).toBe(false)
    expect('metrics' in body).toBe(false)
  })

  it('passes metrics through beside the acquisition', () => {
    visit('/?utm_source=newsletter')

    const body = JSON.parse(
      funnelEventBody('results_view', { semitones: 24, accuracy: null }),
    )

    expect(body.metrics).toEqual({ semitones: 24, accuracy: null })
    expect(body.acq).toEqual({ utmSource: 'newsletter' })
  })

  it('keeps one clientId across calls — the join key must not drift', () => {
    const first = JSON.parse(funnelEventBody('mirror_view'))
    const second = JSON.parse(funnelEventBody('results_view'))

    expect(second.clientId).toBe(first.clientId)
  })

  it('stays far inside the worker ingest cap with maximal fields', () => {
    // The worker rejects bodies over 4096 bytes. Every acquisition field
    // at its clamp plus metrics must never come close.
    visit(
      `/?gclid=${'g'.repeat(200)}&utm_source=${'s'.repeat(200)}&utm_medium=${'m'.repeat(200)}&utm_campaign=${'c'.repeat(200)}&utm_content=${'n'.repeat(200)}&utm_term=${'t'.repeat(200)}`,
    )

    const body = funnelEventBody('results_view', {
      lowMidi: 40,
      highMidi: 70,
      semitones: 30,
      accuracy: 99,
      steadiness: 88,
    })

    expect(body.length).toBeLessThan(2048)
  })
})
