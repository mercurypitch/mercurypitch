// ============================================================
// Local all-access tests — the bypass opens only on a loopback dev build
// ============================================================

import { describe, expect, it } from 'vitest'
import { localAllAccessDecision, localAllAccessGranted, } from './local-all-access'

describe('localAllAccessDecision', () => {
  it('grants only when flag, dev-server mode and loopback host all hold', () => {
    for (const host of ['localhost', '127.0.0.1', '[::1]']) {
      expect(localAllAccessDecision('1', 'development', host)).toBe(true)
    }
  })

  it('stays closed without the env flag', () => {
    expect(localAllAccessDecision(undefined, 'development', 'localhost')).toBe(
      false,
    )
    expect(localAllAccessDecision('', 'development', 'localhost')).toBe(false)
    expect(localAllAccessDecision('true', 'development', 'localhost')).toBe(
      false,
    )
    expect(localAllAccessDecision('0', 'development', 'localhost')).toBe(false)
  })

  it('stays closed outside the dev server, even with the flag', () => {
    expect(localAllAccessDecision('1', 'production', 'localhost')).toBe(false)
    expect(localAllAccessDecision('1', 'test', 'localhost')).toBe(false)
  })

  it('stays closed off loopback — deployed domains, LAN and tunnels', () => {
    for (const host of [
      'mercurypitch.com',
      'dev.mercurypitch.com',
      '192.168.1.20',
      'my-tunnel.trycloudflare.com',
      undefined,
    ]) {
      expect(localAllAccessDecision('1', 'development', host)).toBe(false)
    }
  })
})

describe('localAllAccessGranted', () => {
  it('is off in the test environment so gate tests stay honest', () => {
    expect(localAllAccessGranted()).toBe(false)
  })
})
