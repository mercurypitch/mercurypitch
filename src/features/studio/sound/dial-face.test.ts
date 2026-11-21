import { describe, expect, it } from 'vitest'
import { DIAL_FACE, studioDialReadout } from './dial-face'

describe('studioDialReadout', () => {
  it('keeps the sign apart from the digits, a true minus below the centre', () => {
    expect(studioDialReadout(-24)).toEqual({ sign: '−', digits: '24' })
    expect(studioDialReadout(-6)).toEqual({ sign: '−', digits: '6' })
    expect(studioDialReadout(0)).toEqual({ sign: '', digits: '0' })
    expect(studioDialReadout(6)).toEqual({ sign: '+', digits: '6' })
    expect(studioDialReadout(100)).toEqual({ sign: '+', digits: '100' })
    expect(studioDialReadout(-100)).toEqual({ sign: '−', digits: '100' })
  })

  it('prints whole numbers, and never a minus for a value that rounds to zero', () => {
    expect(studioDialReadout(-0.4)).toEqual({ sign: '', digits: '0' })
    expect(studioDialReadout(23.6)).toEqual({ sign: '+', digits: '24' })
  })
})

describe('DIAL_FACE', () => {
  const { cap, pointer, ring } = DIAL_FACE

  it('keeps the pointer mark outside the cap the value is printed on', () => {
    // The stroke's round end reaches half its width past the line's end.
    expect(pointer.from - pointer.width / 2).toBeGreaterThanOrEqual(
      cap.radius + cap.outline / 2,
    )
  })

  it('ends the pointer mark on the travel ring, where the value arc ends', () => {
    expect(pointer.to).toBe(ring.radius)
  })
})
