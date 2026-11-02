// ============================================================
// What the room says over a song that stopped by itself, by route
// ============================================================

import { describe, expect, it } from 'vitest'
import { AIRPLAY_WAY_BACK, soundStoppedNotice, STOPPED_HERE, STOPPED_ON_AIRPLAY, } from './sound-stopped'

describe('soundStoppedNotice', () => {
  it('says the sound went to the TV over AirPlay, and what helps, with no Play again', () => {
    const notice = soundStoppedNotice('airplay')

    expect(notice.lines).toEqual([
      'The sound went to the TV over AirPlay and stopped.',
      'Choose iPhone under AirPlay in Control Center, or use Screen Mirroring to put the room on the TV.',
    ])
    expect(notice.lines).toEqual([STOPPED_ON_AIRPLAY, AIRPLAY_WAY_BACK])
    // Playing again would send the sound back to the same TV.
    expect(notice.playAgain).toBe(false)
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
      const notice = soundStoppedNotice(route)

      expect(notice.lines).toEqual(['The sound stopped.'])
      expect(notice.lines).toEqual([STOPPED_HERE])
      expect(notice.playAgain).toBe(true)
    },
  )

  it('offers to play again where nobody can say where the sound goes', () => {
    expect(soundStoppedNotice(null)).toEqual({
      lines: [STOPPED_HERE],
      playAgain: true,
    })
  })
})
