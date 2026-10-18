// ============================================================
// The audio record of a scenario: rooms, the session, the notice, demos
// ============================================================
//
// What the census does not count, recorded for a tester who walks through
// a scenario and sends the report: a room entered and left, every change
// to the page's session type, the volume notice shown or gone with the
// reading behind it, a demo's start and stop, and the app going behind and
// coming back. WebKit's `navigator.audioSession` is stood in for.

import { resetPageAudioSessionForTests } from '@irchiinnuss/mobile-runtime/page-audio-session'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { RoomOutputReading } from '@/components/room-kit/room-output'
import { audioDiagnosticEntries, formatAudioDiagnostic, resetAudioDiagnosticsForTests, } from '@/lib/audio-diagnostics'
import type { NativeAudioOutputReading } from '@/stores/native-shell-store'
import { LEVEL_POLL_MS, resetAudioCensusForTests, SOUND_GAP_MS, } from './audio-census'
import { installAudioRecord } from './audio-record'
import { beginRoomVisit } from './room-visit'
import type { RoomVolumeNotice } from './RoomVolumeHint'

let type = 'auto'
let sessionTarget: EventTarget = new EventTarget()
const stops: (() => void)[] = []
let tellNotice: (notice: RoomVolumeNotice) => void = () => undefined

/** WebKit's session for the page, as an iPhone has it. */
function giveThePageASession(): EventTarget {
  sessionTarget = new EventTarget()
  Object.defineProperties(sessionTarget, {
    state: { configurable: true, writable: true, value: 'active' },
    type: {
      configurable: true,
      get: () => type,
      set: (value: string) => {
        type = value
      },
    },
  })
  Object.defineProperty(navigator, 'audioSession', {
    configurable: true,
    value: sessionTarget,
  })
  return sessionTarget
}

function install(roomLevels?: () => readonly RoomOutputReading[]): void {
  stops.push(
    installAudioRecord({
      roomLevels,
      notices: (listener) => {
        tellNotice = listener
        return () => {
          tellNotice = () => undefined
        }
      },
    }),
  )
}

/** The record as a tester reads it, without the clock. */
const lines = (): string[] =>
  audioDiagnosticEntries().map((entry) =>
    formatAudioDiagnostic(entry).replace(/^\S+ /u, ''),
  )

function hide(hidden: boolean): void {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => (hidden ? 'hidden' : 'visible'),
  })
  document.dispatchEvent(new Event('visibilitychange'))
}

const on = { oneVolume: () => true }

beforeEach(() => {
  vi.spyOn(console, 'info').mockImplementation(() => {})
  resetAudioDiagnosticsForTests()
  resetAudioCensusForTests()
  type = 'auto'
})

afterEach(() => {
  for (const stop of stops.splice(0)) stop()
  resetPageAudioSessionForTests()
  Reflect.deleteProperty(navigator, 'audioSession')
  Reflect.deleteProperty(document, 'visibilityState')
  document.body.innerHTML = ''
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('a room’s visit', () => {
  it('records the room, the session it asked for, and the type given back', () => {
    vi.useFakeTimers()
    giveThePageASession()
    install()
    const leave = beginRoomVisit('long-note', on)
    vi.advanceTimersByTime(28_900)
    leave()
    expect(lines().slice(1)).toEqual([
      'room enter room=long-note oneVolume=on asks=play-and-record',
      'session set who=room long-note from=auto to=play-and-record holders=room long-note',
      'room leave room=long-note oneVolume=on asks=play-and-record after=28.9 s',
      'session restore who=room long-note from=play-and-record to=auto holders=none',
    ])
  })

  it('says when the switch is off, and when the page has no session', () => {
    install()
    beginRoomVisit('echo', { oneVolume: () => false })()
    beginRoomVisit('echo', on)()
    expect(lines().filter((line) => line.startsWith('room enter'))).toEqual([
      'room enter room=echo oneVolume=off asks=nothing',
      'room enter room=echo oneVolume=on asks=nothing',
    ])
  })

  it('says what WebKit kept, where it is not what was asked', () => {
    // WebKit keeps 'auto' for a page the microphone policy shuts out.
    Object.defineProperty(giveThePageASession(), 'type', {
      configurable: true,
      get: () => 'auto',
      set: () => undefined,
    })
    install()
    beginRoomVisit('lip-roll', on)
    expect(lines()).toContain(
      'session set who=room lip-roll from=auto to=play-and-record reads=auto holders=room lip-roll',
    )
  })

  it('records WebKit’s word on the session’s state', () => {
    giveThePageASession()
    install()
    Object.assign(sessionTarget, { state: 'interrupted' })
    sessionTarget.dispatchEvent(new Event('statechange'))
    expect(lines()).toContain('session state state=interrupted type=auto')
  })
})

describe('a demo', () => {
  /** A room's root, as each premium room draws it: `data-demo` on top. */
  function drawRoom(): HTMLElement {
    const root = document.createElement('div')
    root.setAttribute('data-demo', 'idle')
    document.body.append(root)
    return root
  }

  const settle = async (): Promise<void> => {
    await Promise.resolve()
    await Promise.resolve()
  }

  it('records each turn of a demo while its room is open, and nothing after', async () => {
    install()
    const leave = beginRoomVisit('echo', on)
    const root = drawRoom()
    root.setAttribute('data-demo', 'card')
    root.setAttribute('data-demo', 'playing')
    await settle()
    root.setAttribute('data-demo', 'end')
    root.setAttribute('data-demo', 'end')
    await settle()
    leave()
    root.setAttribute('data-demo', 'playing')
    await settle()
    expect(lines().filter((line) => line.startsWith('demo'))).toEqual([
      'demo card room=echo from=idle',
      'demo playing room=echo from=card',
      'demo end room=echo from=playing',
    ])
  })
})

describe('the volume notice', () => {
  const reading: NativeAudioOutputReading = {
    volume: 0,
    volumeKnown: 'session',
    step: null,
    steps: null,
    route: 'speaker',
    outputs: [{ type: 'Speaker', name: 'Speaker' }],
    detail: {
      systemVolume: 0,
      systemVolumeLive: false,
      systemVolumeSettled: false,
      sessionVolume: 0,
    },
    reason: null,
  }

  it('records it shown and gone, with the reading that decided it', () => {
    install()
    tellNotice({
      text: 'Turn the volume up to hear the notes.',
      reading,
      cause: 'mic closed, settled',
    })
    tellNotice({
      text: null,
      reading: { ...reading, volume: 0.5, volumeKnown: 'live' },
      cause: 'change: volume',
    })
    expect(lines().filter((line) => line.startsWith('notice'))).toEqual([
      'notice shown text="Turn the volume up to hear the notes." cause="mic closed, settled" volume=0 known=session route=speaker system=0 live=false settled=false session=0',
      'notice hidden cause="change: volume" volume=0.5 known=live route=speaker system=0 live=false settled=false session=0',
    ])
  })
})

describe('the app', () => {
  it('records its launch, and each time it goes behind and comes back', () => {
    install()
    hide(true)
    hide(false)
    expect(lines().filter((line) => line.startsWith('app'))).toEqual([
      'app launch page=visible',
      'app background [hidden]',
      'app foreground',
    ])
  })
})

describe('what the rooms sent', () => {
  it('reads the rooms’ output only while a room is open', () => {
    vi.useFakeTimers()
    let peak = -100
    const levels = (): RoomOutputReading[] => [
      { gain: 1, peakDb: peak, rmsDb: peak - 6 } as RoomOutputReading,
    ]
    install(levels)
    expect(vi.getTimerCount()).toBe(0)

    const leave = beginRoomVisit('long-note', on)
    expect(vi.getTimerCount()).toBe(1)
    peak = -12
    vi.advanceTimersByTime(LEVEL_POLL_MS * 5)
    peak = -100
    vi.advanceTimersByTime(SOUND_GAP_MS + LEVEL_POLL_MS * 2)
    leave()

    expect(vi.getTimerCount()).toBe(0)
    expect(lines().some((line) => line.startsWith('census room-sound'))).toBe(
      true,
    )
  })

  it('records a sound still sounding as the room closes', () => {
    vi.useFakeTimers()
    const levels = (): RoomOutputReading[] => [
      { gain: 1, peakDb: -9, rmsDb: -15 } as RoomOutputReading,
    ]
    install(levels)
    const leave = beginRoomVisit('echo', on)
    vi.advanceTimersByTime(LEVEL_POLL_MS * 3)
    leave()
    expect(lines()).toContainEqual(
      expect.stringMatching(
        /^census room-sound peak=-9 rms=-15 ms=\d+ gain=1 cut=true$/u,
      ),
    )
  })
})

describe('uninstalling', () => {
  it('records nothing more', () => {
    giveThePageASession()
    install()
    for (const stop of stops.splice(0)) stop()
    const before = audioDiagnosticEntries().length
    beginRoomVisit('echo', on)()
    hide(true)
    sessionTarget.dispatchEvent(new Event('statechange'))
    expect(audioDiagnosticEntries()).toHaveLength(before)
  })
})
