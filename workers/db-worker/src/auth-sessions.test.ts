// ── Device labels ────────────────────────────────────────────────────
//
// The label is what someone reads in "you are signed in on…" before deciding
// which row to end, so getting it wrong costs a wrong sign-out. It is derived
// at render time from a verbatim user agent, so it can be improved whenever
// without a backfill — these tests exist to pin the order of the checks, which
// is the part that is easy to break.
//
// Every browser here claims to be several other browsers. Chrome and Edge both
// say "Safari"; Edge says "Chrome" too; Opera says both. Testing the most
// specific token first is the whole algorithm.

import { describe, expect, it } from 'vitest'
import { deviceLabel } from './auth-sessions'

describe('deviceLabel', () => {
  it('names the browser and the platform', () => {
    expect(
      deviceLabel(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
      ),
    ).toBe('Chrome on Mac')
    expect(
      deviceLabel(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      ),
    ).toBe('Safari on iPhone')
    expect(
      deviceLabel(
        'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36',
      ),
    ).toBe('Chrome on Android')
  })

  it('does not let a browser be mistaken for the one it impersonates', () => {
    // Edge's UA ends "Chrome/140 Safari/537.36 Edg/140". Testing Chrome or
    // Safari first would label every Edge session as one of them.
    expect(
      deviceLabel(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36 Edg/140.0.0.0',
      ),
    ).toBe('Edge on Windows')
    expect(
      deviceLabel(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36 OPR/125.0.0.0',
      ),
    ).toBe('Opera on Windows')
    // Android must beat Linux: every Android UA contains "Linux" as well.
    expect(deviceLabel('Mozilla/5.0 (Linux; Android 14) Firefox/130.0')).toBe(
      'Firefox on Android',
    )
  })

  it('falls back rather than inventing half a label', () => {
    expect(deviceLabel(null)).toBe('Unknown device')
    expect(deviceLabel('')).toBe('Unknown device')
    expect(deviceLabel('   ')).toBe('Unknown device')
    // A television or a script: a platform with no recognisable browser, and
    // a browser with no recognisable platform, each name what they can.
    expect(deviceLabel('Mozilla/5.0 (Windows NT 10.0; Win64; x64)')).toBe(
      'Windows',
    )
    expect(deviceLabel('curl/8.5.0')).toBe('Unknown device')
  })
})
