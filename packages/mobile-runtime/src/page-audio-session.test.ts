// ============================================================
// Page audio session: one owner for navigator.audioSession.type
// ============================================================
//
// WebKit's `navigator.audioSession` is stood in for by an object that keeps
// every type written to it, in order, as WebKit's setter would take them.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PageAudioSessionChange } from './page-audio-session'
import { claimPageAudioSession, onPageAudioSessionChange, pageAudioSessionType, resetPageAudioSessionForTests, } from './page-audio-session'

interface FakeSession {
  type: string
  readonly state: string
}

/** WebKit's session for the page, at `first`, keeping every write. */
function webkitSession(first = 'auto'): {
  session: FakeSession
  writes: string[]
} {
  const writes: string[] = []
  let type = first
  const session = {
    get type() {
      return type
    },
    set type(value: string) {
      writes.push(value)
      type = value
    },
    state: 'active',
  }
  return { session, writes }
}

let changes: PageAudioSessionChange[] = []
let stopHearing: () => void = () => undefined

beforeEach(() => {
  changes = []
  stopHearing = onPageAudioSessionChange((change) => changes.push(change))
})

afterEach(() => {
  stopHearing()
  resetPageAudioSessionForTests()
  vi.unstubAllGlobals()
})

describe('where the page has no audio session', () => {
  it('asks for nothing, as on Android’s WebView and in Chrome', () => {
    vi.stubGlobal('navigator', {})
    expect(claimPageAudioSession('room long-note', 'play-and-record')).toBe(
      null,
    )
    expect(pageAudioSessionType()).toBeNull()
    expect(changes).toEqual([])
  })

  it('asks for nothing with no navigator at all', () => {
    vi.stubGlobal('navigator', undefined)
    expect(claimPageAudioSession('now playing', 'playback')).toBeNull()
  })
})

describe('one claim', () => {
  it('sets the type, and letting go puts the page’s own back', () => {
    const { session, writes } = webkitSession()
    vi.stubGlobal('navigator', { audioSession: session })

    const release = claimPageAudioSession('room long-note', 'play-and-record')
    expect(session.type).toBe('play-and-record')
    release?.()

    expect(writes).toEqual(['play-and-record', 'auto'])
    expect(changes.map((c) => [c.action, c.who, c.from, c.to])).toEqual([
      ['set', 'room long-note', 'auto', 'play-and-record'],
      ['restore', 'room long-note', 'play-and-record', 'auto'],
    ])
  })

  it('puts back the type the page had before, not auto', () => {
    const { session } = webkitSession('ambient')
    vi.stubGlobal('navigator', { audioSession: session })
    claimPageAudioSession('room echo', 'play-and-record')?.()
    expect(session.type).toBe('ambient')
  })

  it('does nothing the second time it is let go', () => {
    const { session, writes } = webkitSession()
    vi.stubGlobal('navigator', { audioSession: session })
    const release = claimPageAudioSession('room echo', 'play-and-record')
    release?.()
    release?.()
    expect(writes).toEqual(['play-and-record', 'auto'])
    expect(changes).toHaveLength(2)
  })

  it('writes nothing for a type the page already has', () => {
    const { session, writes } = webkitSession('play-and-record')
    vi.stubGlobal('navigator', { audioSession: session })
    claimPageAudioSession('room lip-roll', 'play-and-record')?.()
    expect(writes).toEqual([])
    expect(changes.map((c) => c.action)).toEqual(['set', 'restore'])
  })

  it('says what WebKit kept, where it took no word from the page', () => {
    // WebKit keeps 'auto' for a page the microphone policy shuts out.
    const session = {
      get type() {
        return 'auto'
      },
      set type(_value: string) {
        // Taken and dropped.
      },
      state: 'inactive',
    }
    vi.stubGlobal('navigator', { audioSession: session })
    claimPageAudioSession('room ng-slides', 'play-and-record')
    expect(changes[0]).toMatchObject({
      action: 'set',
      to: 'play-and-record',
      reads: 'auto',
    })
  })

  it('is no claim when WebKit refuses the write', () => {
    const session = {
      get type() {
        return 'auto'
      },
      set type(_value: string) {
        throw new DOMException('No page', 'InvalidStateError')
      },
      state: 'inactive',
    }
    vi.stubGlobal('navigator', { audioSession: session })
    expect(claimPageAudioSession('now playing', 'playback')).toBeNull()
    expect(changes.map((c) => [c.action, c.to, c.reads])).toEqual([
      ['refused', 'playback', 'auto'],
    ])
  })
})

// The room asks for play-and-record for its whole visit; Now Playing asks
// for playback for the moment a press from behind the app starts its
// carrier. Each puts back what it found, so written directly the two could
// put back each other's word.
describe('two claims', () => {
  it('lets Now Playing’s brief playback go back to the room’s play-and-record', () => {
    const { session, writes } = webkitSession()
    vi.stubGlobal('navigator', { audioSession: session })

    const room = claimPageAudioSession('room long-note', 'play-and-record')
    const nowPlaying = claimPageAudioSession('now playing', 'playback')
    expect(session.type).toBe('playback')
    nowPlaying?.()
    expect(session.type).toBe('play-and-record')
    room?.()

    expect(writes).toEqual([
      'play-and-record',
      'playback',
      'play-and-record',
      'auto',
    ])
  })

  it('keeps the newer claim’s type when the older one is let go first', () => {
    const { session, writes } = webkitSession()
    vi.stubGlobal('navigator', { audioSession: session })

    const room = claimPageAudioSession('room echo', 'play-and-record')
    const nowPlaying = claimPageAudioSession('now playing', 'playback')
    room?.()
    // Now Playing's playback stands: the room's word is not put back.
    expect(session.type).toBe('playback')
    expect(changes.at(-1)).toMatchObject({
      action: 'kept',
      who: 'room echo',
      to: 'playback',
      holders: ['now playing'],
    })
    nowPlaying?.()

    // And the page's own type comes back, never the room's.
    expect(session.type).toBe('auto')
    expect(writes).toEqual(['play-and-record', 'playback', 'auto'])
  })

  it('names who holds the type after each change, newest first', () => {
    const { session } = webkitSession()
    vi.stubGlobal('navigator', { audioSession: session })
    const room = claimPageAudioSession('room echo', 'play-and-record')
    const nowPlaying = claimPageAudioSession('now playing', 'playback')
    nowPlaying?.()
    room?.()
    expect(changes.map((c) => c.holders)).toEqual([
      ['room echo'],
      ['now playing', 'room echo'],
      ['room echo'],
      [],
    ])
  })

  it('reads the page’s own type afresh once every claim has gone', () => {
    const { session } = webkitSession()
    vi.stubGlobal('navigator', { audioSession: session })
    claimPageAudioSession('room echo', 'play-and-record')?.()
    session.type = 'ambient'
    claimPageAudioSession('room echo', 'play-and-record')?.()
    expect(session.type).toBe('ambient')
  })
})

describe('listeners', () => {
  it('keep hearing after one of them throws, and stop when unsubscribed', () => {
    const { session } = webkitSession()
    vi.stubGlobal('navigator', { audioSession: session })
    const stopBad = onPageAudioSessionChange(() => {
      throw new Error('a record that broke')
    })
    claimPageAudioSession('room echo', 'play-and-record')?.()
    expect(changes).toHaveLength(2)
    stopBad()
    stopHearing()
    claimPageAudioSession('room echo', 'play-and-record')?.()
    expect(changes).toHaveLength(2)
  })
})
