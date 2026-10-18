// ============================================================
// Room visit: one volume from the door to the way out
// ============================================================
//
// WebKit's `navigator.audioSession` is stood in for by an object that keeps
// every type written to it; the page's one owner of that type is the real
// one (packages/mobile-runtime page-audio-session.ts).

import type { PageAudioSessionChange } from '@irchiinnuss/mobile-runtime/page-audio-session'
import { claimPageAudioSession, onPageAudioSessionChange, resetPageAudioSessionForTests, } from '@irchiinnuss/mobile-runtime/page-audio-session'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { RoomVisitStep } from './room-visit'
import { beginRoomVisit, onRoomVisit } from './room-visit'

let writes: string[] = []
let type = 'auto'
let heard: string[] = []
const stops: (() => void)[] = []

/** WebKit's session for the page, on a phone that has one (iOS). */
function giveThePageASession(): void {
  Object.defineProperty(navigator, 'audioSession', {
    configurable: true,
    value: {
      get type() {
        return type
      },
      set type(value: string) {
        writes.push(value)
        type = value
      },
      state: 'active',
    },
  })
}

const visitLine = (step: RoomVisitStep): string =>
  `${step.entering ? 'enter' : 'leave'} ${step.room}`
const sessionLine = (change: PageAudioSessionChange): string =>
  `${change.action} ${change.to}`

beforeEach(() => {
  writes = []
  type = 'auto'
  heard = []
  stops.push(onRoomVisit((step) => heard.push(visitLine(step))))
  stops.push(onPageAudioSessionChange((c) => heard.push(sessionLine(c))))
})

afterEach(() => {
  for (const stop of stops.splice(0)) stop()
  resetPageAudioSessionForTests()
  Reflect.deleteProperty(navigator, 'audioSession')
  vi.useRealTimers()
})

// An iPhone's visit (only iOS asks), with the switch on or off.
const on = { oneVolume: () => true, platform: () => 'ios' }
const off = { oneVolume: () => false, platform: () => 'ios' }

describe('a premium room’s visit', () => {
  it('asks WebKit for play-and-record at the door, and gives the page’s type back on the way out', () => {
    giveThePageASession()
    const leave = beginRoomVisit('long-note', on)
    expect(type).toBe('play-and-record')
    leave()
    expect(type).toBe('auto')
    expect(writes).toEqual(['play-and-record', 'auto'])
  })

  it('asks for nothing with the switch off, to compare', () => {
    giveThePageASession()
    beginRoomVisit('echo', off)()
    expect(writes).toEqual([])
  })

  it('asks for nothing where the page has no audio session', () => {
    const steps: RoomVisitStep[] = []
    stops.push(onRoomVisit((step) => steps.push(step)))
    beginRoomVisit('lip-roll', on)()
    expect(steps.map((s) => [s.entering, s.asks])).toEqual([
      [true, false],
      [false, false],
    ])
  })

  it('ends once, however often it is ended', () => {
    giveThePageASession()
    const leave = beginRoomVisit('ng-slides', on)
    leave()
    leave()
    expect(writes).toEqual(['play-and-record', 'auto'])
    expect(heard.filter((line) => line.startsWith('leave'))).toHaveLength(1)
  })

  it('leaves another claim’s type standing on the way out', () => {
    // Now Playing's brief playback, taken while the room is open, is the
    // newer word and stands until it is let go (page-audio-session.ts).
    giveThePageASession()
    const leave = beginRoomVisit('echo', on)
    const nowPlaying = claimPageAudioSession('now playing', 'playback')
    leave()
    expect(type).toBe('playback')
    nowPlaying?.()
    expect(type).toBe('auto')
  })
})

describe('only on iOS', () => {
  it('asks for nothing on Android, even where the page has an audio session', () => {
    giveThePageASession()
    const steps: RoomVisitStep[] = []
    stops.push(onRoomVisit((step) => steps.push(step)))
    beginRoomVisit('long-note', { ...on, platform: () => 'android' })()
    expect(writes).toEqual([])
    expect(steps.map((s) => [s.entering, s.asks])).toEqual([
      [true, false],
      [false, false],
    ])
  })

  it('asks for nothing on the web', () => {
    giveThePageASession()
    beginRoomVisit('echo', { ...on, platform: () => 'web' })()
    expect(writes).toEqual([])
  })
})

describe('what a visit tells its listeners', () => {
  it('names the room and the switch, and how long it lasted', () => {
    vi.useFakeTimers()
    giveThePageASession()
    const steps: RoomVisitStep[] = []
    stops.push(onRoomVisit((step) => steps.push(step)))
    const leave = beginRoomVisit('long-note', on)
    vi.advanceTimersByTime(4200)
    leave()
    expect(steps).toEqual([
      { room: 'long-note', entering: true, oneVolume: true, asks: true },
      {
        room: 'long-note',
        entering: false,
        oneVolume: true,
        asks: true,
        ms: 4200,
      },
    ])
  })

  it('tells of the room before the session it asks for, and of leaving before the type comes back', () => {
    giveThePageASession()
    beginRoomVisit('long-note', on)()
    expect(heard).toEqual([
      'enter long-note',
      'set play-and-record',
      'leave long-note',
      'restore auto',
    ])
  })

  it('says so with the switch off', () => {
    giveThePageASession()
    const steps: RoomVisitStep[] = []
    stops.push(onRoomVisit((step) => steps.push(step)))
    beginRoomVisit('echo', off)
    expect(steps[0]).toMatchObject({ oneVolume: false, asks: false })
  })

  it('keeps going after a listener throws', () => {
    giveThePageASession()
    stops.push(
      onRoomVisit(() => {
        throw new Error('a record that broke')
      }),
    )
    const leave = beginRoomVisit('echo', on)
    expect(type).toBe('play-and-record')
    leave()
    expect(type).toBe('auto')
  })
})
