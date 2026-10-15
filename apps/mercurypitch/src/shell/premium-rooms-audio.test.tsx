// ============================================================
// The premium rooms' sound and microphone across room switches
// ============================================================
//
// TestFlight build 842: after switching between exercises and turning the
// mic on and off a few times, Lip roll was barely audible at full volume,
// until the app was killed. Three of the suspects live in the web layer,
// and this suite puts each to the test with the rooms' own controllers on
// the phone's own audio lease (packages/audio-io, as main.tsx registers it):
//
//   a microphone track left live after a room is gone, which keeps the
//   phone's capture running and its playback lowered;
//   a gain left turned down, so the next note reaches the speaker quieter;
//   a microphone opened with the phone's voice processing on.
//
// Only the browser is faked: the Web Audio graph and getUserMedia
// (fake-web-audio.test-fixtures.ts), both keeping score. The controllers,
// their demos, the capture kit, the mic manager and the audio lease are the
// real ones.

import { createRoot } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { FakeMedia } from './fake-web-audio.test-fixtures'
import type { FakeNode } from './fake-web-audio.test-fixtures'
import { FakeAudioContext, FakeSourceNode, installFakeMedia, } from './fake-web-audio.test-fixtures'

vi.mock('@/lib/haptics', () => ({
  haptics: {
    tapLight: () => undefined,
    success: () => undefined,
    selection: () => undefined,
  },
}))
vi.mock('@/stores/exercise-history-store', () => ({
  recordExerciseResult: () => undefined,
}))
vi.mock('@/db/services/voiceprint-service', () => ({
  loadLocalVoiceprints: () => [],
}))
// Pictures: nothing to decode in a test.
vi.mock('@/features/lip-roll/bay-art', async (importActual) => ({
  ...(await importActual<object>()),
  preloadLipResult: () => undefined,
}))
vi.mock('@/features/ng-slides/bridge-art', async (importActual) => ({
  ...(await importActual<object>()),
  preloadNgResult: () => undefined,
}))
vi.mock('@/features/echo/echo-art', async (importActual) => ({
  ...(await importActual<object>()),
  preloadEchoResult: () => undefined,
}))
// Merc's recorded voice does not load here: Echo's calls are the synth's.
vi.mock('@irchiinnuss/mobile-runtime/asset-fetch', () => ({
  fetchAssetRead: () => Promise.reject(new Error('no assets in a test')),
}))

const { acquireSharedAudioContext, resetSharedAudioContext } =
  await import('@irchiinnuss/audio-io')
const { registerNativeDevice } = await import('@/stores/native-shell-store')
const { micManager } = await import('@/lib/mic-manager')
const { releaseMicLock } = await import('@/lib/mic-lock')
const { useLipController } =
  await import('@/features/lip-roll/useLipController')
const { useLipDemo } = await import('@/features/lip-roll/demo/useLipDemo')
const { useNgController } = await import('@/features/ng-slides/useNgController')
const { useNgDemo } = await import('@/features/ng-slides/demo/useNgDemo')
const { useEchoController } = await import('@/features/echo/useEchoController')
const { useEchoDemo } = await import('@/features/echo/demo/useEchoDemo')
const { useLongNoteController } =
  await import('@/features/long-note/useLongNoteController')
const { useLongNoteDemo } =
  await import('@/features/long-note/demo/useLongNoteDemo')
const lipStore = await import('@/stores/lip-roll-store')
const ngStore = await import('@/stores/ng-slides-store')
const echoStore = await import('@/stores/echo-store')
const { rememberLongNote } =
  await import('@/features/long-note/remembered-note')

// ── Screen frames and the clocks, moved by hand ─────────────────

let frames: FrameRequestCallback[] = []
const FRAME_MS = 20
/** The mic manager keeps the device this long after the last hold. */
const LINGER_MS = 2000

async function settle(): Promise<void> {
  for (let i = 0; i < 20; i++) await Promise.resolve()
}

/** The one context the lease made, once a room has asked for it. */
function shared(): FakeAudioContext {
  const made = FakeAudioContext.made
  if (made.length === 0) throw new Error('no AudioContext yet')
  return made[made.length - 1]
}

/**
 * How loud each sound reaches the speakers at its loudest, read off its
 * envelope as scheduled, on the graph as it was when it first played: a
 * note's nodes are let go once it ends.
 */
const peaks = new Map<FakeSourceNode, number>()

function profile(): void {
  for (const ctx of FakeAudioContext.made) {
    for (const node of ctx.nodes) {
      if (!(node instanceof FakeSourceNode) || peaks.has(node)) continue
      if (node.startAt === null || !ctx.reaches(node)) continue
      peaks.set(node, peakOf(ctx, node))
    }
  }
}

/** `ms` of wall clock: timers, frames and the audio clock together. */
async function run(ms: number): Promise<void> {
  for (let left = ms; left > 0; left -= FRAME_MS) {
    profile()
    vi.advanceTimersByTime(FRAME_MS)
    for (const ctx of FakeAudioContext.made) ctx.advance(FRAME_MS / 1000)
    const due = frames
    frames = []
    for (const callback of due) callback(performance.now())
    await settle()
  }
  profile()
}

const ROOMS = ['lip-roll', 'ng-slides', 'echo', 'long-note'] as const
type RoomName = (typeof ROOMS)[number]

interface Mounted {
  start: () => void
  stop: () => void
  /** The room's "?": its demo from the start. */
  ask: () => void
  dispose: () => void
}

/** A room as its screen mounts it: the controller and, with it, its demo. */
function mount(room: RoomName): Mounted {
  return createRoot((dispose) => {
    switch (room) {
      case 'lip-roll': {
        const c = useLipController()
        const demo = useLipDemo(c)
        return { start: c.start, stop: c.stop, ask: demo.ask, dispose }
      }
      case 'ng-slides': {
        const c = useNgController()
        const demo = useNgDemo(c)
        return { start: c.start, stop: c.stop, ask: demo.ask, dispose }
      }
      case 'echo': {
        const c = useEchoController()
        const demo = useEchoDemo(c)
        return { start: c.start, stop: c.stop, ask: demo.ask, dispose }
      }
      case 'long-note': {
        const c = useLongNoteController()
        const demo = useLongNoteDemo(c)
        return { start: c.start, stop: c.stop, ask: demo.ask, dispose }
      }
    }
  })
}

/** The sources made on the shared clock since `mark` nodes. */
function sourcesSince(mark: number): FakeSourceNode[] {
  return shared()
    .nodes.slice(mark)
    .filter((node): node is FakeSourceNode => node instanceof FakeSourceNode)
}

/** The loudest `source` reaches the speakers over its life, sampled. */
function peakOf(ctx: FakeAudioContext, source: FakeSourceNode): number {
  if (source.startAt === null) return 0
  const end = source.stopAt ?? source.startAt + 4
  let peak = 0
  for (let t = source.startAt; t <= end; t += 0.005) {
    peak = Math.max(peak, ctx.gainToDestination(source, t))
  }
  return peak
}

/** The loudest of the sounds made since `mark`. */
function loudestSince(mark: number): number {
  return Math.max(
    0,
    ...sourcesSince(mark).map((source) => peaks.get(source) ?? 0),
  )
}

/** The node count now: sounds made after it are the next take's. */
function mark(): number {
  return FakeAudioContext.made.length === 0 ? 0 : shared().nodes.length
}

/**
 * Nothing of the rooms left to be heard. A sound still on the speakers'
 * path is one the clock parked in its fade: it has a stop time, and it is
 * silent by then (under -60 dB). No gain stays on the path to the speakers
 * without a sound behind it: a bus left connected is a bus left set.
 */
function expectSilentGraph(): void {
  const ctx = shared()
  const armed = ctx.nodes.filter(
    (node): node is FakeSourceNode =>
      node instanceof FakeSourceNode &&
      !node.ended &&
      node.startAt !== null &&
      ctx.reaches(node),
  )
  for (const source of armed) {
    expect(source.stopAt).not.toBeNull()
    expect(ctx.gainToDestination(source, source.stopAt ?? 0)).toBeLessThan(1e-3)
  }
  const fed = new Set<FakeNode>()
  const walk = (node: FakeNode): void => {
    if (fed.has(node)) return
    fed.add(node)
    for (const next of node.outputs) walk(next)
  }
  for (const source of armed) walk(source)
  expect(ctx.gainsToDestination().filter((gain) => !fed.has(gain))).toEqual([])
}

let media: FakeMedia

beforeEach(async () => {
  vi.useFakeTimers({
    toFake: [
      'setTimeout',
      'clearTimeout',
      'setInterval',
      'clearInterval',
      'performance',
      'Date',
    ],
  })
  frames = []
  peaks.clear()
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    frames.push(callback)
    return frames.length
  })
  vi.stubGlobal('cancelAnimationFrame', () => undefined)
  vi.stubGlobal('AudioContext', FakeAudioContext)
  FakeAudioContext.made = []
  media = installFakeMedia()
  resetSharedAudioContext({
    createContext: () => new FakeAudioContext() as unknown as AudioContext,
  })
  registerNativeDevice({
    micStopsOtherApps: true,
    acquireAudio: (owner, options) => acquireSharedAudioContext(owner, options),
    keepAwake: () => undefined,
    holdAudioInBackground: () => () => undefined,
    nowPlaying: () => undefined,
    onMediaAction: () => () => undefined,
    pictureInPictureAutoEnter: () => undefined,
    onPictureInPicture: () => () => undefined,
    pictureInPictureLyrics: null,
  })
  // Each room knows the singer's note, so a tap starts its run at once,
  // and each has shown its demo, so a visit opens on the room.
  lipStore.rememberLipNote(52)
  ngStore.rememberNgNote(52)
  echoStore.rememberEchoRoot(52)
  rememberLongNote(57)
  lipStore.markLipDemoSeen()
  ngStore.markNgDemoSeen()
  echoStore.markEchoDemoSeen()
  await micManager.forceReleaseAll()
})

afterEach(async () => {
  await micManager.forceReleaseAll()
  releaseMicLock()
  resetSharedAudioContext()
  vi.unstubAllGlobals()
  vi.useRealTimers()
  localStorage.clear()
})

describe('H2: no microphone track outlives a room', () => {
  it.each(ROOMS)('%s: leaving mid-take hands the mic back', async (name) => {
    const room = mount(name)
    room.start()
    await run(1500)
    expect(media.live()).toBe(1)
    room.dispose()
    // The mic manager keeps the device a moment for the next page.
    await run(LINGER_MS + 200)
    expect(media.live()).toBe(0)
  })

  it.each(ROOMS)(
    '%s: the mic on and off four times opens one track at a time',
    async (name) => {
      const room = mount(name)
      for (let round = 0; round < 4; round++) {
        room.start()
        await run(1800)
        expect(media.live()).toBe(1)
        room.stop()
        await run(LINGER_MS + 200)
        expect(media.live()).toBe(0)
      }
      room.dispose()
      await run(LINGER_MS + 200)
      expect(media.live()).toBe(0)
    },
  )

  it('opens nothing behind a room left while its mic was opening', async () => {
    // The permission prompt is up: getUserMedia has not answered.
    const real = navigator.mediaDevices.getUserMedia
    let grant: () => void = () => undefined
    navigator.mediaDevices.getUserMedia = (constraints) =>
      new Promise((resolve) => {
        grant = () => resolve(real(constraints))
      })
    const room = mount('lip-roll')
    room.start()
    await run(100)
    room.dispose()
    grant()
    await run(LINGER_MS + 200)
    expect(media.live()).toBe(0)
  })
})

describe('H3: no gain is left turned down', () => {
  it('Lip roll: A take, B mid-take, back to A, the mic on and off: the same note level each time', async () => {
    // Room A, Lip roll: a take starts, its count-in note sounds.
    let lip = mount('lip-roll')
    let from = mark()
    lip.start()
    await run(1500)
    const fresh = loudestSince(from)
    expect(fresh).toBeGreaterThan(0.1)

    // Mid-take, the singer goes to room B and starts a take there.
    lip.dispose()
    const ng = mount('ng-slides')
    ng.start()
    await run(1500)
    expect(media.live()).toBe(1)

    // Back to A, leaving B mid-take.
    ng.dispose()
    await run(LINGER_MS + 500)
    expect(media.live()).toBe(0)
    expectSilentGraph()

    // The mic on and off a few times in A: every count-in note as loud.
    lip = mount('lip-roll')
    for (let round = 0; round < 4; round++) {
      from = mark()
      lip.start()
      await run(1500)
      expect(media.live()).toBe(1)
      expect(loudestSince(from)).toBeCloseTo(fresh, 6)
      lip.stop()
      await run(LINGER_MS + 500)
      expect(media.live()).toBe(0)
      expectSilentGraph()
    }
    lip.dispose()
    await run(LINGER_MS + 500)
    expect(media.live()).toBe(0)
    expectSilentGraph()
  })

  it.each(ROOMS)(
    '%s: the first sound after a return is as loud as on a fresh entry',
    async (name) => {
      const first = mount(name)
      let from = mark()
      first.start()
      await run(2500)
      const fresh = loudestSince(from)
      expect(fresh).toBeGreaterThan(0.05)
      first.dispose()
      // Away in another room, mid-take.
      const other = mount(name === 'lip-roll' ? 'ng-slides' : 'lip-roll')
      other.start()
      await run(800)
      other.dispose()
      await run(LINGER_MS + 500)
      expectSilentGraph()

      const again = mount(name)
      from = mark()
      again.start()
      await run(2500)
      expect(loudestSince(from)).toBeCloseTo(fresh, 6)
      again.dispose()
      await run(LINGER_MS + 500)
      expectSilentGraph()
    },
  )

  it.each(ROOMS)(
    '%s: leaving as its first sound plays leaves nothing on the speakers',
    async (name) => {
      const room = mount(name)
      room.start()
      // Inside the first note (Long note's Hear tone, a count-in, a call).
      await run(300)
      room.dispose()
      await run(LINGER_MS + 500)
      // The clock parks with the last lease, and what it held is let go
      // as the next room's clock runs.
      const next = mount(name)
      await run(100)
      const made = shared().nodes.length
      next.start()
      await run(3000)
      // The next room sounded, so the silence below is its stop, not a
      // room that never played.
      expect(
        shared()
          .nodes.slice(made)
          .some(
            (node) => node instanceof FakeSourceNode && node.startAt !== null,
          ),
      ).toBe(true)
      next.dispose()
      await run(LINGER_MS + 500)
      expectSilentGraph()
    },
  )

  it.each(ROOMS)(
    "%s: the demo's sound stops with the room, and the next demo is as loud",
    async (name) => {
      const first = mount(name)
      await run(100)
      let from = mark()
      first.ask()
      await run(6000)
      const fresh = loudestSince(from)
      expect(fresh).toBeGreaterThan(0.05)
      // Back, in the middle of the demo.
      first.dispose()
      await run(1000)
      expectSilentGraph()

      const again = mount(name)
      await run(100)
      from = mark()
      again.ask()
      await run(6000)
      expect(loudestSince(from)).toBeCloseTo(fresh, 6)
      again.dispose()
      await run(1000)
      expectSilentGraph()
    },
  )
})

describe('H4: voice processing stays off', () => {
  it('every microphone the rooms open asks for the raw signal', async () => {
    for (const name of ROOMS) {
      const room = mount(name)
      room.start()
      await run(1800)
      room.stop()
      await run(LINGER_MS + 200)
      room.dispose()
    }
    expect(media.asked.length).toBe(ROOMS.length)
    for (const constraints of media.asked) {
      expect(constraints.audio).toMatchObject({
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      })
    }
  })
})

describe('the audio clock', () => {
  it('is one context for every room, running in a room and parked between', async () => {
    for (const name of ROOMS) {
      const room = mount(name)
      room.start()
      await run(600)
      expect(shared().state).toBe('running')
      room.dispose()
      await run(500)
      expect(shared().state).toBe('suspended')
    }
    expect(FakeAudioContext.made).toHaveLength(1)
  })
})
