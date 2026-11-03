// ============================================================
// What the room says over a song that stopped by itself, by route
// ============================================================

import { afterEach, describe, expect, it, vi } from 'vitest'
import { soundStoppedNotice, STOPPED_HERE } from './sound-stopped'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('soundStoppedNotice', () => {
  it('names the receiver the sound went to over AirPlay, and the way back, with no Play again', () => {
    const notice = soundStoppedNotice('airplay', 'LG C2')

    expect(notice.lines).toEqual([
      'The sound went to LG C2 over AirPlay and stopped.',
      'To hear it here, choose this phone under AirPlay in Control Center.',
    ])
    // Playing again would send the sound back to the same receiver.
    expect(notice.playAgain).toBe(false)
    expect(notice.closable).toBe(true)
  })

  it('offers no Screen Mirroring, which sends the sound over AirPlay as well', () => {
    const words = soundStoppedNotice('airplay', 'LG C2').lines.join(' ')

    expect(words).not.toMatch(/Mirroring/)
    expect(words).not.toMatch(/the TV/)
  })

  it('says AirPlay alone where the phone named no receiver', () => {
    expect(soundStoppedNotice('airplay', null).lines[0]).toBe(
      'The sound went over AirPlay and stopped.',
    )
  })

  it('names the iPad on an iPad, as the app does everywhere', () => {
    vi.stubGlobal('navigator', {
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15',
      maxTouchPoints: 5,
    })

    expect(soundStoppedNotice('airplay', 'Kitchen').lines[1]).toBe(
      'To hear it here, choose this iPad under AirPlay in Control Center.',
    )
  })

  it.each([
    'speaker',
    'receiver',
    'headphones',
    'bluetooth',
    'hdmi',
    'other',
    'none',
  ] as const)(
    'says the sound stopped on %s, and offers to play again',
    (route) => {
      const notice = soundStoppedNotice(route, 'Speaker')

      expect(notice.lines).toEqual(['The sound stopped.'])
      expect(notice.lines).toEqual([STOPPED_HERE])
      expect(notice.playAgain).toBe(true)
      expect(notice.closable).toBe(false)
    },
  )

  it('offers to play again where nobody can say where the sound goes', () => {
    expect(soundStoppedNotice(null)).toEqual({
      lines: [STOPPED_HERE],
      playAgain: true,
      closable: false,
    })
  })
})
