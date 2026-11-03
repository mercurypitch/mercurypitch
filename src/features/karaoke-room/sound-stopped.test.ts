// ============================================================
// What the room says over a song that stopped by itself, by route
// ============================================================

import { afterEach, describe, expect, it, vi } from 'vitest'
import { AIRPLAY_CANNOT, MIRRORING_CAN, soundStoppedNotice, STOPPED_HERE, } from './sound-stopped'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('soundStoppedNotice', () => {
  it('names the receiver, says AirPlay cannot carry the sound to a TV and Screen Mirroring can, with no Play again', () => {
    const notice = soundStoppedNotice(true, 'LG C2')

    expect(notice.lines).toEqual([
      'The sound went to LG C2 over AirPlay and stopped.',
      "AirPlay cannot carry the room's sound to a TV.",
      'Screen Mirroring can: open Control Center, tap Screen Mirroring, then choose your TV.',
      'To hear it here, choose this phone under AirPlay in Control Center.',
    ])
    // Playing again would send the sound back to the same receiver.
    expect(notice.playAgain).toBe(false)
    expect(notice.closable).toBe(true)
  })

  it('says how to reach Screen Mirroring: Control Center, Screen Mirroring, then the TV', () => {
    expect(MIRRORING_CAN).toMatch(/Control Center.*Screen Mirroring.*your TV/u)
    expect(AIRPLAY_CANNOT).toMatch(/^AirPlay cannot/u)
  })

  it('says AirPlay alone where the phone named no receiver, as for one suspected', () => {
    expect(soundStoppedNotice(true, null).lines[0]).toBe(
      'The sound went over AirPlay and stopped.',
    )
    expect(soundStoppedNotice(true, '  ').lines[0]).toBe(
      'The sound went over AirPlay and stopped.',
    )
  })

  it('names the iPad on an iPad, as the app does everywhere', () => {
    vi.stubGlobal('navigator', {
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15',
      maxTouchPoints: 5,
    })

    expect(soundStoppedNotice(true, 'Kitchen').lines.at(-1)).toBe(
      'To hear it here, choose this iPad under AirPlay in Control Center.',
    )
  })

  it('says the sound stopped anywhere else, and offers to play again', () => {
    const notice = soundStoppedNotice(false, 'Speaker')

    expect(notice).toEqual({
      lines: [STOPPED_HERE],
      playAgain: true,
      closable: false,
    })
    expect(notice.lines).toEqual(['The sound stopped.'])
  })
})
