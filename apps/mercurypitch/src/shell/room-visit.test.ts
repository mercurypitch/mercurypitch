// ============================================================
// Room visit: one volume from the door to the way out
// ============================================================
//
// WebKit's `navigator.audioSession` is stood in for by an object that keeps
// every type written to it; the page's one owner of that type is the real
// one (packages/mobile-runtime page-audio-session.ts). The page's
// visibility is set by hand, the app's state is told through a stand-in
// for the platform's, and room-kit's app-leave is announced for real.

import type { PageAudioSessionChange } from '@irchiinnuss/mobile-runtime/page-audio-session'
import { claimPageAudioSession, onPageAudioSessionChange, resetPageAudioSessionForTests, } from '@irchiinnuss/mobile-runtime/page-audio-session'
import type { AppLifecycleState } from '@irchiinnuss/mobile-runtime/platform'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { announceAppLeave } from '@/components/room-kit/app-leave'
import type { RoomVisitOptions, RoomVisitStep } from './room-visit'
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

/** A bus a test speaks on, standing in for a platform event. */
function bus<T>() {
  const listeners = new Set<(value: T) => void>()
  return {
    listen: (listener: (value: T) => void): (() => void) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    say: (value: T): void => {
      for (const listener of [...listeners]) listener(value)
    },
    count: (): number => listeners.size,
  }
}

let appState = bus<AppLifecycleState>()

/** The page hidden or shown, as WebKit tells it. */
function hide(hidden: boolean): void {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => (hidden ? 'hidden' : 'visible'),
  })
  document.dispatchEvent(new Event('visibilitychange'))
}

/** The options of a visit on an iPhone, with the switch as given. */
function onIos(oneVolume = true): RoomVisitOptions {
  return {
    oneVolume: () => oneVolume,
    platform: () => 'ios',
    appState: (handler) => appState.listen(handler),
  }
}

/** A visit the test ends, or the cleanup does: none outlives its test. */
function visit(room: string, options: RoomVisitOptions): () => void {
  const leave = beginRoomVisit(room, options)
  stops.push(leave)
  return leave
}

const visitLine = (step: RoomVisitStep): string =>
  `${step.moment} ${step.room}${step.on === undefined ? '' : ` on ${step.on}`}`
const sessionLine = (change: PageAudioSessionChange): string =>
  `${change.action} ${change.to}`

beforeEach(() => {
  writes = []
  type = 'auto'
  heard = []
  appState = bus<AppLifecycleState>()
  stops.push(onRoomVisit((step) => heard.push(visitLine(step))))
  stops.push(onPageAudioSessionChange((c) => heard.push(sessionLine(c))))
})

afterEach(() => {
  for (const stop of stops.splice(0)) stop()
  resetPageAudioSessionForTests()
  Reflect.deleteProperty(navigator, 'audioSession')
  Reflect.deleteProperty(document, 'visibilityState')
  vi.useRealTimers()
})

describe('a premium room’s visit', () => {
  it('asks WebKit for play-and-record at the door, and gives the page’s type back on the way out', () => {
    giveThePageASession()
    const leave = visit('long-note', onIos())
    expect(type).toBe('play-and-record')
    leave()
    expect(type).toBe('auto')
    expect(writes).toEqual(['play-and-record', 'auto'])
  })

  it('asks for nothing with the switch off, to compare', () => {
    giveThePageASession()
    visit('echo', onIos(false))()
    expect(writes).toEqual([])
  })

  it('asks for nothing where the page has no audio session', () => {
    const steps: RoomVisitStep[] = []
    stops.push(onRoomVisit((step) => steps.push(step)))
    visit('lip-roll', onIos())()
    expect(steps.map((s) => [s.moment, s.asks])).toEqual([
      ['enter', false],
      ['leave', false],
    ])
  })

  it('ends once, however often it is ended', () => {
    giveThePageASession()
    const leave = visit('ng-slides', onIos())
    leave()
    leave()
    expect(writes).toEqual(['play-and-record', 'auto'])
    expect(heard.filter((line) => line.startsWith('leave'))).toHaveLength(1)
  })

  it('leaves another claim’s type standing on the way out', () => {
    // Now Playing's brief playback, taken while the room is open, is the
    // newer word and stands until it is let go (page-audio-session.ts).
    giveThePageASession()
    const leave = visit('echo', onIos())
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
    const leave = visit('long-note', {
      ...onIos(),
      platform: () => 'android',
    })
    hide(true)
    hide(false)
    announceAppLeave()
    appState.say('active')
    leave()
    expect(writes).toEqual([])
    expect(steps.map((s) => [s.moment, s.asks])).toEqual([
      ['enter', false],
      ['leave', false],
    ])
  })

  it('asks for nothing on the web', () => {
    giveThePageASession()
    visit('echo', { ...onIos(), platform: () => 'web' })()
    expect(writes).toEqual([])
  })
})

describe('while the page is away', () => {
  it('gives the type back as the page hides, and asks again as it shows', () => {
    giveThePageASession()
    const leave = visit('long-note', onIos())
    hide(true)
    expect(type).toBe('auto')
    hide(false)
    expect(type).toBe('play-and-record')
    leave()
    expect(writes).toEqual([
      'play-and-record',
      'auto',
      'play-and-record',
      'auto',
    ])
    expect(heard).toEqual([
      'enter long-note',
      'set play-and-record',
      'release-hidden long-note on visibilitychange',
      'restore auto',
      'reclaim-visible long-note on visibilitychange',
      'set play-and-record',
      'leave long-note',
      'restore auto',
    ])
  })

  it('follows pagehide and pageshow too', () => {
    giveThePageASession()
    const leave = visit('echo', onIos())
    window.dispatchEvent(new Event('pagehide'))
    expect(type).toBe('auto')
    window.dispatchEvent(new Event('pageshow'))
    expect(type).toBe('play-and-record')
    leave()
    expect(heard.filter((line) => line.includes(' on '))).toEqual([
      'release-hidden echo on pagehide',
      'reclaim-visible echo on pageshow',
    ])
  })

  it('keeps the claim as the app goes with the page still showing, and writes nothing', () => {
    // Control Center and the notification shade: iOS says the app is no
    // longer active, the room's clock parks (room-kit app-leave.ts), and
    // the page never hides. Kept, the slider there moves the room's level.
    giveThePageASession()
    const leave = visit('lip-roll', onIos())
    announceAppLeave()
    appState.say('background')
    expect(type).toBe('play-and-record')
    appState.say('active')
    announceAppLeave()
    expect(type).toBe('play-and-record')
    leave()
    expect(writes).toEqual(['play-and-record', 'auto'])
    expect(heard.filter((line) => line.includes(' on '))).toEqual([])
  })

  it('gives it back once, however many ways the page goes, and asks once as it comes back', () => {
    giveThePageASession()
    const leave = visit('long-note', onIos())
    announceAppLeave()
    hide(true)
    window.dispatchEvent(new Event('pagehide'))
    announceAppLeave()
    hide(false)
    appState.say('active')
    window.dispatchEvent(new Event('pageshow'))
    leave()
    expect(writes).toEqual([
      'play-and-record',
      'auto',
      'play-and-record',
      'auto',
    ])
  })

  it('does not ask while the page is still hidden, even with the app in front', () => {
    giveThePageASession()
    visit('ng-slides', onIos())
    hide(true)
    appState.say('active')
    window.dispatchEvent(new Event('pageshow'))
    expect(type).toBe('auto')
    hide(false)
    expect(type).toBe('play-and-record')
  })

  it('asks for nothing more once the room is left while the page is away', () => {
    giveThePageASession()
    const leave = visit('echo', onIos())
    hide(true)
    leave()
    hide(false)
    appState.say('active')
    window.dispatchEvent(new Event('pageshow'))
    expect(writes).toEqual(['play-and-record', 'auto'])
    expect(heard).toEqual([
      'enter echo',
      'set play-and-record',
      'release-hidden echo on visibilitychange',
      'restore auto',
      'leave echo',
    ])
    expect(appState.count()).toBe(0)
  })

  it('asks once the page shows, for a room opened behind the app', () => {
    giveThePageASession()
    hide(true)
    const leave = visit('long-note', onIos())
    expect(writes).toEqual([])
    hide(false)
    expect(type).toBe('play-and-record')
    leave()
    expect(type).toBe('auto')
  })

  it('writes nothing with the switch off, however the page goes and comes', () => {
    giveThePageASession()
    const leave = visit('lip-roll', onIos(false))
    hide(true)
    hide(false)
    announceAppLeave()
    appState.say('active')
    leave()
    expect(writes).toEqual([])
    expect(heard).toEqual(['enter lip-roll', 'leave lip-roll'])
  })
})

describe('with Now Playing’s brief playback in between', () => {
  it('keeps Now Playing’s word while the room is away, and the room’s once it is back', () => {
    giveThePageASession()
    const leave = visit('echo', onIos())
    const nowPlaying = claimPageAudioSession('now playing', 'playback')
    hide(true)
    // The room's older claim goes without a write under Now Playing's.
    expect(type).toBe('playback')
    nowPlaying?.()
    expect(type).toBe('auto')
    hide(false)
    expect(type).toBe('play-and-record')
    leave()
    expect(writes).toEqual([
      'play-and-record',
      'playback',
      'auto',
      'play-and-record',
      'auto',
    ])
    expect(heard).toContain('kept playback')
  })

  it('asks over a playback taken while the room was away, and leaves the page its own type after both', () => {
    giveThePageASession()
    const leave = visit('long-note', onIos())
    hide(true)
    const nowPlaying = claimPageAudioSession('now playing', 'playback')
    expect(type).toBe('playback')
    hide(false)
    expect(type).toBe('play-and-record')
    nowPlaying?.()
    expect(type).toBe('play-and-record')
    leave()
    expect(type).toBe('auto')
    expect(writes).toEqual([
      'play-and-record',
      'auto',
      'playback',
      'play-and-record',
      'auto',
    ])
  })
})

describe('what a visit tells its listeners', () => {
  it('names the room and the switch, and how long it lasted', () => {
    vi.useFakeTimers()
    giveThePageASession()
    const steps: RoomVisitStep[] = []
    stops.push(onRoomVisit((step) => steps.push(step)))
    const leave = visit('long-note', onIos())
    vi.advanceTimersByTime(4200)
    leave()
    expect(steps).toEqual([
      { room: 'long-note', moment: 'enter', oneVolume: true, asks: true },
      {
        room: 'long-note',
        moment: 'leave',
        oneVolume: true,
        asks: true,
        ms: 4200,
      },
    ])
  })

  it('tells of the room before the session it asks for, and of leaving before the type comes back', () => {
    giveThePageASession()
    visit('long-note', onIos())()
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
    visit('echo', onIos(false))
    expect(steps[0]).toMatchObject({ oneVolume: false, asks: false })
  })

  it('keeps going after a listener throws', () => {
    giveThePageASession()
    stops.push(
      onRoomVisit(() => {
        throw new Error('a record that broke')
      }),
    )
    const leave = visit('echo', onIos())
    expect(type).toBe('play-and-record')
    hide(true)
    expect(type).toBe('auto')
    hide(false)
    expect(type).toBe('play-and-record')
    leave()
    expect(type).toBe('auto')
  })
})
