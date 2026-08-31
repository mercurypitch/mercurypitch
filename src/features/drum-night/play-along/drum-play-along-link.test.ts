// ============================================================
// Drum play-along link tests — preserve every unrelated room parameter
// ============================================================

import { describe, expect, it } from 'vitest'
import { readDrumPlayAlongSession, withDrumPlayAlongSession, } from './drum-play-along-link'

describe('drum play-along link', () => {
  it('reads and normalizes one saved-session identity', () => {
    expect(
      readDrumPlayAlongSession(
        'https://example.test/drum-night?view=score&song=session-42',
      ),
    ).toBe('session-42')
    expect(
      readDrumPlayAlongSession(
        'https://example.test/drum-night?view=score&song=%20%20',
      ),
    ).toBeNull()
  })

  it('adds, replaces, and clears the song without losing view or drawer state', () => {
    const href =
      'https://example.test/drum-night?view=seat&drawer=songs#practice'
    expect(withDrumPlayAlongSession(href, 'session-a')).toBe(
      '/drum-night?view=seat&drawer=songs&song=session-a#practice',
    )
    expect(
      withDrumPlayAlongSession(
        'https://example.test/drum-night?view=seat&drawer=songs&song=session-a#practice',
        'session-b',
      ),
    ).toBe('/drum-night?view=seat&drawer=songs&song=session-b#practice')
    expect(
      withDrumPlayAlongSession(
        'https://example.test/drum-night?view=seat&drawer=songs&song=session-b#practice',
        null,
      ),
    ).toBe('/drum-night?view=seat&drawer=songs#practice')
  })
})
