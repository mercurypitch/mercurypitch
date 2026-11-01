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
// One more lives here since: a room's last note, which fades after the
// room stops it, parked by the clock in the middle of its fade and heard on
// the next room's first tap ("the way out").
//
// Only the browser is faked: the Web Audio graph and getUserMedia
// (fake-web-audio.test-fixtures.ts), both keeping score. The controllers,
// their demos, the capture kit, the mic manager and the audio lease are the
// real ones.
//
// Every case runs on the one harness below (the mocks, the clocks moved by
// hand and the graph readers), which is why the file runs past the 600
// lines docs/agent/TESTING.md allows: split, each part would repeat it.

import { createRoot } from 'solid-js'
import type { MockInstance } from 'vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { FakeGainNode, FakeMedia } from './fake-web-audio.test-fixtures'
import type { FakeNode } from './fake-web-audio.test-fixtures'
import { FakeAnalyserNode, FakeAudioContext, FakeSourceNode, installFakeMedia, } from './fake-web-audio.test-fixtures'

vi.mock('@/lib/haptics', () => ({
  haptics: {
    tapLight: () => undefined,
    success: () => undefined,
    selection: () => undefined,
  },
}))
// Every result a room keeps, counted: a take that ends early keeps none.
const history = vi.hoisted(() => ({ kept: 0 }))
vi.mock('@/stores/exercise-history-store', () => ({
  recordExerciseResult: () => {
    history.kept += 1
  },
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

const {
  acquireSharedAudioContext,
  holdSharedAudioContextInBackground,
  resetSharedAudioContext,
  suspendSharedAudioContext,
} = await import('@irchiinnuss/audio-io')
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
const {
  ROOM_OUTPUT_GAIN,
  resetRoomOutputsForTests,
  roomOutputIfMade,
  roomStagesOn,
} = await import('@/components/room-kit/room-output')
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
/** Sounds with a way to the speakers that does not pass the room output. */
const bypassed = new Set<FakeSourceNode>()

/** Whether `node` reaches the speakers without passing through `avoid`. */
function reachesAvoiding(
  ctx: FakeAudioContext,
  node: FakeNode,
  avoid: unknown,
  seen = new Set<FakeNode>(),
): boolean {
  if (node === avoid) return false
  if (node === ctx.destination) return true
  if (seen.has(node)) return false
  seen.add(node)
  return [...node.outputs].some((next) =>
    reachesAvoiding(ctx, next, avoid, seen),
  )
}

function profile(): void {
  for (const ctx of FakeAudioContext.made) {
    for (const node of ctx.nodes) {
      if (!(node instanceof FakeSourceNode) || peaks.has(node)) continue
      if (node.startAt === null || !ctx.reaches(node)) continue
      peaks.set(node, peakOf(ctx, node))
      const output = roomOutputIfMade(ctx as unknown as BaseAudioContext)
      if (reachesAvoiding(ctx, node, output)) bypassed.add(node)
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
  /** What the singer sees of the room and its demo now. */
  seen: () => Seen
  dispose: () => void
}

/** What the singer sees: the room's phase and words, and its demo's. */
interface Seen {
  readonly phase: string
  readonly line: string
  readonly chip: string | null
  readonly result: boolean
  readonly demo: string
  readonly demoTake: string | null
  readonly said: string
}

/** The parts of a room and its demo that `Seen` reads. */
interface Shown {
  state: () => { phase: string }
  line: () => string
  chip: () => string | null
  summary: () => unknown
}
interface ShownDemo {
  mode: () => string
  take: () => string | null
  said: () => string
}

function seenOf(room: Shown, demo: ShownDemo): () => Seen {
  return () => ({
    phase: room.state().phase,
    line: room.line(),
    chip: room.chip(),
    result: room.summary() !== null,
    demo: demo.mode(),
    demoTake: demo.take(),
    said: demo.said(),
  })
}

/** A room as its screen mounts it: the controller and, with it, its demo. */
function mount(room: RoomName): Mounted {
  return createRoot((dispose) => {
    switch (room) {
      case 'lip-roll': {
        const c = useLipController()
        const demo = useLipDemo(c)
        const seen = seenOf(c, demo)
        return { start: c.start, stop: c.stop, ask: demo.ask, seen, dispose }
      }
      case 'ng-slides': {
        const c = useNgController()
        const demo = useNgDemo(c)
        const seen = seenOf(c, demo)
        return { start: c.start, stop: c.stop, ask: demo.ask, seen, dispose }
      }
      case 'echo': {
        const c = useEchoController()
        const demo = useEchoDemo(c)
        const seen = seenOf(c, demo)
        return { start: c.start, stop: c.stop, ask: demo.ask, seen, dispose }
      }
      case 'long-note': {
        const c = useLongNoteController()
        const demo = useLongNoteDemo(c)
        const seen = seenOf(c, demo)
        return { start: c.start, stop: c.stop, ask: demo.ask, seen, dispose }
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
 * without a sound behind it: a bus left connected is a bus left set. A
 * room's stage stays only while the room is open (`roomOpen`).
 */
function expectSilentGraph(roomOpen = false): void {
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
  // The room output stands between every room and the speakers, and an
  // open room's stage in front of it: they may stay with nothing behind
  // them, but only ever at rest.
  const output = roomOutputIfMade(
    ctx as unknown as BaseAudioContext,
  ) as unknown as FakeGainNode | null
  const stages = stagesOn(ctx)
  if (!roomOpen) expect(stages).toEqual([])
  expect(
    ctx
      .gainsToDestination()
      .filter(
        (gain) => !fed.has(gain) && gain !== output && !stages.includes(gain),
      ),
  ).toEqual([])
  expectOutputAtRest()
}

/** The room stages open on `ctx`: a room's, while it is open. */
function stagesOn(ctx: FakeAudioContext): FakeGainNode[] {
  return roomStagesOn(
    ctx as unknown as BaseAudioContext,
  ) as unknown as FakeGainNode[]
}

/**
 * The room output, if a room made one, and every room stage open in front
 * of it: at 1 now and for every time ahead.
 */
function expectOutputAtRest(): void {
  const ctx = shared()
  const output = roomOutputIfMade(ctx as unknown as BaseAudioContext)
  if (output === null) return
  for (const { gain } of [
    output as unknown as FakeGainNode,
    ...stagesOn(ctx),
  ]) {
    for (const ahead of [0, 1, 10, 100]) {
      expect(gain.valueAt(ctx.currentTime + ahead)).toBe(ROOM_OUTPUT_GAIN)
    }
  }
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
  bypassed.clear()
  resetRoomOutputsForTests()
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
    holdAudioInBackground: (owner) => holdSharedAudioContextInBackground(owner),
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
  rememberLongNote(57, true)
  history.kept = 0
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
      expectSilentGraph(true)
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

describe('the room output', () => {
  it.each(ROOMS)(
    '%s: every sound, its demo too, goes to the speakers through it, at rest',
    async (name) => {
      const room = mount(name)
      await run(100)
      const from = mark()
      room.start()
      await run(2500)
      room.stop()
      await run(500)
      room.ask()
      await run(6000)
      const sounded = sourcesSince(from).filter((source) => peaks.has(source))
      expect(sounded.length).toBeGreaterThan(1)
      expect(sounded.filter((source) => bypassed.has(source))).toEqual([])
      expectOutputAtRest()
      room.dispose()
      await run(LINGER_MS + 500)
      expectSilentGraph()
    },
  )
})

describe('the way out: nothing of a room is heard in the next', () => {
  /** Under this a sound is silent: -60 dB, as expectSilentGraph has it. */
  const SILENT = 1e-3

  /** The room after `name`, for the visit that follows it. */
  const nextRoom = (name: RoomName): RoomName =>
    ROOMS[(ROOMS.indexOf(name) + 1) % ROOMS.length]

  /**
   * The loudest of the sources made since `from` that have sounded for
   * `heldFor` seconds, as the clock stands.
   */
  function loudestNow(from: number, heldFor: number): number {
    const ctx = shared()
    return Math.max(
      0,
      ...sourcesSince(from)
        .filter(
          (source) =>
            source.soundingAt(ctx.currentTime) &&
            ctx.currentTime - (source.startAt ?? Infinity) >= heldFor,
        )
        .map((source) => ctx.gainToDestination(source, ctx.currentTime)),
    )
  }

  /**
   * Runs the clocks until a note made since `from` is sounding, past its
   * attack: the fake's gain reads a cancelled ramp as never begun, so a
   * note stopped inside its first 20 ms would be measured releasing from
   * silence, where a browser releases it from the level it had reached.
   */
  async function runUntilSounding(from: number): Promise<void> {
    for (let ms = 0; ms < 8000; ms += FRAME_MS) {
      if (loudestNow(from, 0.1) > 0.05) return
      await run(FRAME_MS)
    }
    throw new Error('no note sounded')
  }

  /** How far into a take's first sound its live level is read, s. */
  const HELD_SEC = 0.3

  /** What a take sends to the speakers. */
  interface TakeLevel {
    /** Its loudest sound over its first 3 s, as scheduled (loudestSince). */
    readonly peak: number
    /** Its first sound HELD_SEC in, through the graph as it is by then. */
    readonly held: number
  }

  /**
   * `start` starts a take, and the clocks run 3 s. The peak is what the
   * older checks read (`fresh`). The held level is read live, past a
   * room's 250 ms tail: a stage cut under a sounding note reads as
   * silence there, where the peak was taken as the note began.
   */
  async function takeLevel(start: () => void): Promise<TakeLevel> {
    const from = mark()
    start()
    let held = 0
    for (let ms = 0; ms < 3000; ms += FRAME_MS) {
      await run(FRAME_MS)
      if (held === 0) held = loudestNow(from, HELD_SEC)
    }
    return { peak: loudestSince(from), held }
  }

  /** A take in `name` on a visit of its own: how it usually sounds. */
  async function usualLevel(name: RoomName): Promise<TakeLevel> {
    const room = mount(name)
    await run(100)
    const level = await takeLevel(room.start)
    expect(level.peak).toBeGreaterThan(0.05)
    expect(level.held).toBeGreaterThan(0.05)
    room.dispose()
    await run(LINGER_MS + 500)
    return level
  }

  /**
   * What of `left` the clock plays once it starts again: from each
   * source still armed when the clock next starts, the loudest it would
   * reach the speakers from then on, in dB. Returns the listener's
   * readout and the number of starts it saw.
   */
  function listenForTheRest(left: readonly FakeSourceNode[]): {
    heard: string[]
    starts: () => number
  } {
    const ctx = shared()
    const heard: string[] = []
    let starts = 0
    ctx.addEventListener('statechange', () => {
      if (ctx.state !== 'running') return
      starts += 1
      for (const source of left) {
        if (source.ended || source.startAt === null) continue
        const from = Math.max(ctx.currentTime, source.startAt)
        const end = source.stopAt ?? from + 4
        let peak = 0
        for (let t = from; t <= end; t += 0.005) {
          peak = Math.max(peak, ctx.gainToDestination(source, t))
        }
        if (peak > SILENT) {
          heard.push(
            `${source.kind} at ${(20 * Math.log10(peak)).toFixed(1)} dB`,
          )
        }
      }
    })
    return { heard, starts: () => starts }
  }

  /** Leave `name` with a note sounding, park, and start a take next door. */
  async function leaveMidNote(
    name: RoomName,
    play: (room: Mounted) => void,
  ): Promise<{ heard: string[]; starts: number }> {
    const room = mount(name)
    await run(100)
    const from = mark()
    play(room)
    await runUntilSounding(from)
    room.dispose()
    await run(LINGER_MS + 500)
    expect(shared().state).toBe('suspended')
    const left = sourcesSince(from)

    const listened = listenForTheRest(left)
    const next = mount(nextRoom(name))
    await run(100)
    next.start()
    await run(3000)
    next.dispose()
    await run(LINGER_MS + 500)
    expectSilentGraph()
    return { heard: listened.heard, starts: listened.starts() }
  }

  it.each(ROOMS)(
    '%s: a note left while it plays is over before the clock parks',
    async (name) => {
      const { heard, starts } = await leaveMidNote(name, (room) => room.start())
      // The next room's take started the clock again.
      expect(starts).toBeGreaterThan(0)
      expect(heard).toEqual([])
    },
  )

  it.each(ROOMS)(
    "%s: the demo's note left while it plays is over before the clock parks",
    async (name) => {
      const { heard, starts } = await leaveMidNote(name, (room) => room.ask())
      expect(starts).toBeGreaterThan(0)
      expect(heard).toEqual([])
    },
  )

  it.each(ROOMS)(
    '%s: left mid-note and the next room started inside its tail, the next room is heard past the tail',
    async (name) => {
      const usual = await usualLevel(nextRoom(name))
      const room = mount(name)
      await run(100)
      const from = mark()
      room.start()
      await runUntilSounding(from)
      // The clock runs on through the tail, so for its 250 ms two rooms
      // have a stage open: the one left, fading, and the next one's.
      room.dispose()
      const next = mount(nextRoom(name))
      const level = await takeLevel(next.start)
      expect(level.peak).toBeCloseTo(usual.peak, 6)
      expect(level.held).toBeCloseTo(usual.held, 6)
      next.dispose()
      await run(LINGER_MS + 500)
      expectSilentGraph()
    },
  )

  it('starts no note for a room that is gone, while its lease waits out the tail', async () => {
    // Long note's Start plays its note once the clock has unlocked, an
    // await later. The room is left before that answers, and its lease is
    // still held for the tail, so the unlock succeeds.
    const room = mount('long-note')
    await run(100)
    room.start()
    room.dispose()
    await run(LINGER_MS + 500)
    expect(shared().state).toBe('suspended')
    expect(sourcesSince(0).filter((source) => source.startAt !== null)).toEqual(
      [],
    )
  })

  describe('while the room is open', () => {
    let hidden: MockInstance | null = null

    const setPageHidden = (on: boolean): void => {
      hidden ??= vi.spyOn(document, 'visibilityState', 'get')
      hidden.mockReturnValue(on ? 'hidden' : 'visible')
      document.dispatchEvent(new Event('visibilitychange'))
    }

    afterEach(() => {
      hidden?.mockRestore()
      hidden = null
    })

    /**
     * The clock as a phone has it after an earlier visit: made, so its
     * page listener runs before the room's, and nobody holding it.
     */
    function afterAnEarlierVisit(): void {
      const earlier = acquireSharedAudioContext('earlier-visit')
      earlier.ensure()
      earlier.release()
    }

    it.each(ROOMS.flatMap((name) => [`${name} take`, `${name} demo`]))(
      '%s: the page hiding mid-note parks the clock after the release, and nothing comes back with it',
      async (label) => {
        const [name, what] = label.split(' ') as [RoomName, 'take' | 'demo']
        afterAnEarlierVisit()
        const room = mount(name)
        await run(100)
        const from = mark()
        if (what === 'take') room.start()
        else room.ask()
        await runUntilSounding(from)
        setPageHidden(true)
        await run(1000)
        expect(shared().state).toBe('suspended')

        const listened = listenForTheRest(sourcesSince(from))
        setPageHidden(false)
        await run(500)
        // The page brought the clock back: the room still holds it.
        expect(listened.starts()).toBeGreaterThan(0)
        expect(listened.heard).toEqual([])
        room.dispose()
        await run(LINGER_MS + 500)
        expectSilentGraph()
      },
    )

    it.each(ROOMS)(
      '%s: the app leaving mid-note, then the page, leaves nothing for the next room',
      async (name) => {
        afterAnEarlierVisit()
        const room = mount(name)
        await run(100)
        const from = mark()
        room.start()
        await runUntilSounding(from)
        // The OS's word first, the WebView's after it, as a phone has them.
        suspendSharedAudioContext()
        setPageHidden(true)
        await run(1000)
        expect(shared().state).toBe('suspended')
        // Back in the app, and out of the room: the clock stays parked
        // until the next room's tap.
        setPageHidden(false)
        await run(100)
        room.dispose()
        await run(LINGER_MS + 500)

        const listened = listenForTheRest(sourcesSince(from))
        const next = mount(nextRoom(name))
        await run(100)
        next.start()
        await run(3000)
        expect(listened.starts()).toBeGreaterThan(0)
        expect(listened.heard).toEqual([])
        next.dispose()
        await run(LINGER_MS + 500)
        expectSilentGraph()
      },
    )

    /**
     * `start` starts a take, which sets the clock going again: what of the
     * sounds made since `from` the speakers get from then on
     * (listenForTheRest's readout), and how the new take sounds.
     */
    async function heardAfter(
      from: number,
      start: () => void,
    ): Promise<{ heard: string[]; level: TakeLevel }> {
      const listened = listenForTheRest(sourcesSince(from))
      const level = await takeLevel(start)
      expect(listened.starts()).toBeGreaterThan(0)
      return { heard: listened.heard, level }
    }

    describe('the app leaving with the page still showing', () => {
      // Control Center and the notification shade send the app to the
      // background with the OS's word alone. The page never hides: the room
      // hears of it from its clock, which asks before it parks (room-kit
      // app-leave.ts), and whatever still sounds stays where the clock
      // parked it.

      /** `what` in `name` with a note sounding, then the clock parked. */
      async function parkMidNote(
        name: RoomName,
        what: 'take' | 'demo',
      ): Promise<{ room: Mounted; from: number }> {
        afterAnEarlierVisit()
        const room = mount(name)
        await run(100)
        const from = mark()
        if (what === 'take') room.start()
        else room.ask()
        await runUntilSounding(from)
        suspendSharedAudioContext()
        await run(1000)
        expect(shared().state).toBe('suspended')
        return { room, from }
      }

      it.each(ROOMS.flatMap((name) => [`${name} take`, `${name} demo`]))(
        '%s: back in the app and out of the room, the next room hears nothing of it',
        async (label) => {
          const [name, what] = label.split(' ') as [RoomName, 'take' | 'demo']
          const usual = await usualLevel(nextRoom(name))
          const { room, from } = await parkMidNote(name, what)
          // The clock stays parked until the next room's tap. Nothing of
          // the room is left on the way to the speakers, its stage
          // included.
          room.dispose()
          await run(LINGER_MS + 500)
          expectSilentGraph()
          const next = mount(nextRoom(name))
          await run(100)
          const { heard, level } = await heardAfter(from, next.start)
          expect(heard).toEqual([])
          // The next room's take is heard as on a visit of its own.
          expect(level.peak).toBeCloseTo(usual.peak, 6)
          expect(level.held).toBeCloseTo(usual.held, 6)
          next.dispose()
          await run(LINGER_MS + 500)
          expectSilentGraph()
        },
      )

      it.each(ROOMS)(
        '%s: out of the room and the next one started inside the tail, it hears nothing of it',
        async (name) => {
          const usual = await usualLevel(nextRoom(name))
          const { room, from } = await parkMidNote(name, 'take')
          room.dispose()
          const next = mount(nextRoom(name))
          const { heard, level } = await heardAfter(from, next.start)
          expect(heard).toEqual([])
          expect(level.peak).toBeCloseTo(usual.peak, 6)
          expect(level.held).toBeCloseTo(usual.held, 6)
          next.dispose()
          await run(LINGER_MS + 500)
          expectSilentGraph()
        },
      )

      it.each(ROOMS)(
        '%s: Stop and Start in the room start the new take clean',
        async (name) => {
          const usual = await usualLevel(name)
          const { room, from } = await parkMidNote(name, 'take')
          // Still in the room: the park ended the take, so Stop has nothing
          // left to stop, and Start sets the clock going again.
          room.stop()
          await run(500)
          const { heard, level } = await heardAfter(from, room.start)
          expect(heard).toEqual([])
          // The new take is heard as the room's takes always are.
          expect(level.peak).toBeCloseTo(usual.peak, 6)
          expect(level.held).toBeCloseTo(usual.held, 6)
          room.dispose()
          await run(LINGER_MS + 500)
          expectSilentGraph()
        },
      )

      describe('a park ends the take, as the page hiding does', () => {
        // Owner, 16 Oct 2026: a take or a demo ends when Control Center or
        // the notification shade comes down, as it ends when the page
        // hides: the same line, nothing kept, and nothing heard until the
        // singer's next tap, which starts on a fresh stage.

        const TAKES_AND_DEMOS = ROOMS.flatMap((name) => [
          `${name} take`,
          `${name} demo`,
        ])
        const split = (label: string): [RoomName, 'take' | 'demo'] =>
          label.split(' ') as [RoomName, 'take' | 'demo']

        /** Merc's line for a run the singer left (Lip roll, Ng, Echo). */
        const LEFT_LINE =
          'That run stopped when you left. Tap the mic to start again.'
        /** Long note's, for a hold the singer left. */
        const LEFT_HOLD_LINE =
          'The note stopped when you left. Tap the mic to go again.'

        let random: MockInstance | null = null
        /** A microphone prompt still up, answered before the mic is let go. */
        let prompted: { allow: () => void } | null = null
        beforeEach(() => {
          // Merc picks among a moment's lines at random: one pick for every
          // way out, so the lines they leave can be compared.
          random = vi.spyOn(Math, 'random').mockReturnValue(0)
        })
        afterEach(() => {
          random?.mockRestore()
          random = null
          prompted?.allow()
          prompted = null
        })

        /** The clock's starts from now on. */
        function clockStarts(): () => number {
          const ctx = shared()
          let starts = 0
          ctx.addEventListener('statechange', () => {
            if (ctx.state === 'running') starts += 1
          })
          return () => starts
        }

        /** Sounds made since `from` that were started at all. */
        const startedSince = (from: number): FakeSourceNode[] =>
          sourcesSince(from).filter((source) => source.startAt !== null)

        /**
         * What `what` in `name` shows once `leave` has ended it, mid-note
         * or (`inTheTap`) before the tap's clock has answered; `back` then
         * puts the app in front again.
         */
        async function endedBy(
          name: RoomName,
          what: 'take' | 'demo',
          leave: () => void,
          back: () => void,
          inTheTap = false,
        ): Promise<Seen> {
          afterAnEarlierVisit()
          const room = mount(name)
          await run(100)
          const from = mark()
          if (what === 'take') room.start()
          else room.ask()
          if (!inTheTap) await runUntilSounding(from)
          leave()
          await run(1000)
          const seen = room.seen()
          back()
          await run(100)
          room.dispose()
          await run(LINGER_MS + 500)
          return seen
        }

        const pageHide = (
          name: RoomName,
          what: 'take' | 'demo',
          inTheTap = false,
        ) =>
          endedBy(
            name,
            what,
            () => setPageHidden(true),
            () => setPageHidden(false),
            inTheTap,
          )

        it.each(TAKES_AND_DEMOS)(
          '%s: Control Center mid-note ends it as the page hiding does, and nothing sounds until a tap',
          async (label) => {
            const [name, what] = split(label)
            const hidden = await pageHide(name, what)
            // A take is dropped, a demo offers itself again.
            expect(hidden.phase).toBe('intro')
            expect(hidden.result).toBe(false)
            if (what === 'demo') expect(hidden.demo).toBe('card')
            else if (name !== 'long-note') expect(hidden.line).toBe(LEFT_LINE)
            const usual = await usualLevel(name)
            history.kept = 0

            const { room, from } = await parkMidNote(name, what)
            expect(room.seen()).toEqual(hidden)
            expect(history.kept).toBe(0)
            // A minute and more behind Control Center: the clock stays
            // parked, and nothing is started for when it next runs.
            const later = mark()
            const starts = clockStarts()
            await run(65_000)
            expect(starts()).toBe(0)
            expect(startedSince(later)).toEqual([])
            expect(room.seen()).toEqual(hidden)
            // Back in the room, a tap: the new take on a fresh stage, as
            // loud as ever, with nothing of the note the park cut off.
            const { heard, level } = await heardAfter(from, room.start)
            expect(heard).toEqual([])
            expect(level.peak).toBeCloseTo(usual.peak, 6)
            expect(level.held).toBeCloseTo(usual.held, 6)
            room.dispose()
            await run(LINGER_MS + 500)
            expectSilentGraph()
          },
        )

        it.each(TAKES_AND_DEMOS)(
          '%s: Control Center inside the tap ends it as the page hiding does, with the clock left parked',
          async (label) => {
            const [name, what] = split(label)
            const hidden = await pageHide(name, what, true)
            afterAnEarlierVisit()
            const room = mount(name)
            await run(100)
            const from = mark()
            if (what === 'take') room.start()
            else room.ask()
            // Down before the tap's clock has answered.
            suspendSharedAudioContext()
            const starts = clockStarts()
            await run(1000)
            expect(shared().state).toBe('suspended')
            expect(room.seen()).toEqual(hidden)
            await run(65_000)
            expect(starts()).toBe(0)
            expect(startedSince(from)).toEqual([])
            room.dispose()
            await run(LINGER_MS + 500)
            expectSilentGraph()
          },
        )

        it('long-note: Control Center mid-hold drops the hold as the page hiding does, and keeps nothing', async () => {
          // The singer holds A3, the room's note: the mic hears 220 Hz.
          const voice = vi
            .spyOn(FakeAnalyserNode.prototype, 'getFloatTimeDomainData')
            .mockImplementation(function (this: FakeAnalyserNode, buffer) {
              const rate = 48_000
              for (let i = 0; i < buffer.length; i++) {
                buffer[i] = 0.3 * Math.sin((2 * Math.PI * 220 * i) / rate)
              }
            })
          const holdThenLeave = async (
            leave: () => void,
            back: () => void,
          ): Promise<Seen> => {
            afterAnEarlierVisit()
            const room = mount('long-note')
            await run(100)
            room.start()
            for (let ms = 0; ms < 10_000; ms += FRAME_MS) {
              if (room.seen().phase === 'hold') break
              await run(FRAME_MS)
            }
            expect(room.seen().phase).toBe('hold')
            await run(2000)
            leave()
            await run(1000)
            const seen = room.seen()
            back()
            await run(100)
            room.dispose()
            await run(LINGER_MS + 500)
            return seen
          }
          const hidden = await holdThenLeave(
            () => setPageHidden(true),
            () => setPageHidden(false),
          )
          expect(hidden.line).toBe(LEFT_HOLD_LINE)
          expect(hidden.phase).toBe('intro')
          history.kept = 0
          const parked = await holdThenLeave(
            () => suspendSharedAudioContext(),
            () => undefined,
          )
          voice.mockRestore()
          expect(parked).toEqual(hidden)
          expect(history.kept).toBe(0)
        })

        /**
         * The first Start's microphone prompt: getUserMedia waits for the
         * singer's answer.
         */
        function promptForTheMic(): { up: () => boolean; allow: () => void } {
          const devices = navigator.mediaDevices
          const real = devices.getUserMedia.bind(devices)
          let answer: (() => void) | null = null
          devices.getUserMedia = (constraints) =>
            new Promise((resolve) => {
              answer = () => {
                resolve(real(constraints))
              }
            })
          const prompt = {
            up: () => answer !== null,
            allow: () => {
              devices.getUserMedia = real
              answer?.()
              answer = null
              prompted = null
            },
          }
          prompted = prompt
          return prompt
        }

        it.each(ROOMS)(
          "%s: the first Start's microphone prompt is not the app leaving: the take goes on, heard as usual",
          async (name) => {
            const usual = await usualLevel(name)
            const room = mount(name)
            await run(100)
            const prompt = promptForTheMic()
            const from = mark()
            let held = 0
            const listen = async (ms: number): Promise<void> => {
              for (let t = 0; t < ms; t += FRAME_MS) {
                await run(FRAME_MS)
                if (held === 0) held = loudestNow(from, HELD_SEC)
              }
            }
            room.start()
            for (let ms = 0; ms < 5000 && !prompt.up(); ms += FRAME_MS) {
              await listen(FRAME_MS)
            }
            expect(prompt.up()).toBe(true)
            // iOS's alert takes the app out of the foreground, and the
            // shell parks the clock on that word as for Control Center.
            suspendSharedAudioContext()
            await listen(2000)
            expect(shared().state).toBe('running')
            expect(room.seen().phase).toBe('starting')
            prompt.allow()
            await listen(3000)
            expect(room.seen().phase).not.toBe('intro')
            expect(loudestSince(from)).toBeCloseTo(usual.peak, 6)
            expect(held).toBeCloseTo(usual.held, 6)
            // With the prompt answered the hold has gone: Control Center
            // ends this take as any other.
            suspendSharedAudioContext()
            await run(1000)
            expect(shared().state).toBe('suspended')
            expect(room.seen().phase).toBe('intro')
            room.dispose()
            await run(LINGER_MS + 500)
            expectSilentGraph()
          },
        )
      })
    })

    it.each(ROOMS)(
      '%s: left mid-note, its clock parked by the system inside the tail, the next room hears nothing of it',
      async (name) => {
        const usual = await usualLevel(nextRoom(name))
        const room = mount(name)
        await run(100)
        const from = mark()
        room.start()
        await runUntilSounding(from)
        // Out of the room: its note fades over the tail. 40 ms into the
        // fade the system parks the clock (a call, Siri), and the next
        // room's Start comes before the tail would have run out.
        room.dispose()
        await run(40)
        void shared().suspend()
        const next = mount(nextRoom(name))
        const { heard, level } = await heardAfter(from, next.start)
        expect(heard).toEqual([])
        expect(level.peak).toBeCloseTo(usual.peak, 6)
        expect(level.held).toBeCloseTo(usual.held, 6)
        next.dispose()
        await run(LINGER_MS + 500)
        expectSilentGraph()
      },
    )
  })
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
