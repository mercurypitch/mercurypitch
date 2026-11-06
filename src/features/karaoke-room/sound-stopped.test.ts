// ============================================================
// What the room says over a song that stopped by itself, by route
// ============================================================

import { afterEach, describe, expect, it, vi } from 'vitest'
import { soundStoppedNotice, STOPPED_HERE } from './sound-stopped'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('soundStoppedNotice', () => {
  it('names the receiver the sound went to over AirPlay, and how to hear it here instead', () => {
    const notice = soundStoppedNotice(true, 'LG C2')

    expect(notice.lines).toEqual([
      'The sound went to LG C2 over AirPlay and stopped.',
      'To hear it here, choose this phone under AirPlay in Control Center.',
    ])
  })

  // Web Audio alone reaches an AirPlay TV (the sound check, 6 Nov 2026):
  // the old words said AirPlay could not carry it.
  it('never says AirPlay cannot carry the sound, or sends the singer to Screen Mirroring for it', () => {
    const words = soundStoppedNotice(true, 'LG C2').lines.join(' ')

    expect(words).not.toMatch(/cannot|can't/u)
    expect(words).not.toContain('Screen Mirroring')
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

  it('says the sound stopped anywhere else', () => {
    const notice = soundStoppedNotice(false, 'Speaker')

    expect(notice).toEqual({ lines: [STOPPED_HERE] })
    expect(notice.lines).toEqual(['The sound stopped.'])
  })
})
