import { describe, expect, it } from 'vitest'
import { backgroundUrl, OPEN_MS, REDUCED_MS } from './alley-entry'

describe('the open', () => {
  it("reads the room's picture out of a computed background", () => {
    expect(
      backgroundUrl('url("/sing/retro-analog-studio-portrait-2x.webp")'),
    ).toBe('/sing/retro-analog-studio-portrait-2x.webp')
    expect(
      backgroundUrl(
        'linear-gradient(red, blue), url(http://127.0.0.1/ear-lab/a.webp)',
      ),
    ).toBe('http://127.0.0.1/ear-lab/a.webp')
    expect(backgroundUrl('none')).toBeNull()
  })

  it('grows in about 420 ms, and is a 120 ms crossfade under reduced motion', () => {
    expect(OPEN_MS).toBe(420)
    expect(REDUCED_MS).toBe(120)
  })
})
