// ============================================================
// The run-out decision, one transport frame at a time
// ============================================================
//
// The reviewer deleted the latch, then deleted the microtask settle, and the
// whole suite stayed green both times (review F8) — the decision lived inside
// a component nothing renders in a test, so its two hard cases were only ever
// checked by a walk that happened to press things in the right order.
//
// Here a sequence is an array. `frames` plays transport readings into the
// watch in order, running whatever settle each frame queued before the next
// one arrives, which is what a microtask does between two effect runs.

import type { Mock } from 'vitest'
import { describe, expect, it, vi } from 'vitest'
import type { SingRoomContext, SingRoomEvent } from './room-machine'
import { initialSingRoomContext, singRoomReducer } from './room-machine'
import type { TransportReading } from './run-out-watch'
import { createRunOutWatch } from './run-out-watch'

const PLAYING: TransportReading = { isPlaying: true, isPaused: false }
/** Both false: a transport that has stopped — and a pause, mid-write. */
const STOPPED: TransportReading = { isPlaying: false, isPaused: false }
const HELD: TransportReading = { isPlaying: false, isPaused: true }

/**
 * A room holding a melody run, built by the machine rather than by hand so
 * the states these frames are read against are ones the room can reach.
 */
function liveRoom(): SingRoomContext {
  let ctx = initialSingRoomContext({ permission: 'granted' })
  for (const event of [
    { type: 'enter', hasSummary: false },
    { type: 'mic-granted' },
    { type: 'melody-play' },
  ] satisfies SingRoomEvent[]) {
    ctx = singRoomReducer(ctx, event)
  }
  return ctx
}

interface Harness {
  /** Feed one transport reading, then let anything it queued settle. */
  frame: (reading: TransportReading) => void
  /** Feed a reading and move the room on in the SAME task, before settling. */
  frameThen: (reading: TransportReading, event: SingRoomEvent) => void
  send: (event: SingRoomEvent) => void
  ranOut: Mock<() => void>
  watch: ReturnType<typeof createRunOutWatch>
  ctx: () => SingRoomContext
}

function harness(start: SingRoomContext = liveRoom()): Harness {
  let ctx = start
  let transport: TransportReading = STOPPED
  const queued: (() => void)[] = []
  const ranOut: Mock<() => void> = vi.fn(() => {
    ctx = singRoomReducer(ctx, { type: 'stop', hasTake: true })
  })
  const watch = createRunOutWatch({
    ctx: () => ctx,
    transport: () => transport,
    settle: (decide) => {
      queued.push(decide)
    },
    onRanOut: ranOut,
  })
  const settle = (): void => {
    for (const run of queued.splice(0)) run()
  }
  return {
    frame: (reading) => {
      transport = reading
      watch.observe()
      settle()
    },
    frameThen: (reading, event) => {
      transport = reading
      watch.observe()
      ctx = singRoomReducer(ctx, event)
      settle()
    },
    send: (event) => {
      ctx = singRoomReducer(ctx, event)
    },
    ranOut,
    watch,
    ctx: () => ctx,
  }
}

describe('the run-out watch', () => {
  it('says nothing over the first frames of a run', () => {
    // THE LATCH, and the whole reason it exists. `melody-play` puts the room
    // in `live` immediately; the app's transport reports nothing for a frame
    // or two after that, so the pair reads (live, stopped) — identical to a
    // melody that has just finished. Delete `sawRunning` and this fires, and
    // every run ends the instant it is asked for.
    const h = harness()
    h.frame(STOPPED)
    h.frame(STOPPED)
    expect(h.ranOut).not.toHaveBeenCalled()
    expect(h.watch.sawRunning).toBe(false)
  })

  it('says nothing when a pause writes its two signals one at a time', () => {
    // THE SETTLE. `isPlaying(false)` lands before `isPaused(true)`, so there
    // is one moment where the transport reads exactly like a dead one. Drop
    // the settle and dispatch straight from `observe` and this fires: every
    // pause of a melody run ends the take and opens the card.
    const h = harness()
    h.frame(PLAYING)
    let transport: TransportReading = STOPPED
    const watch = createRunOutWatch({
      ctx: h.ctx,
      transport: () => transport,
      settle: (decide) => {
        // Between the queueing and the running, the second write lands.
        transport = HELD
        decide()
      },
      onRanOut: h.ranOut,
    })
    watch.observe()
    watch.observe()
    expect(h.ranOut).not.toHaveBeenCalled()
  })

  it('says nothing when a held run starts again', () => {
    const h = harness()
    h.frame(PLAYING)
    h.frame(HELD)
    h.send({ type: 'pause' })
    h.frame(HELD)
    h.send({ type: 'resume' })
    h.frame(PLAYING)
    h.frame(PLAYING)
    expect(h.ranOut).not.toHaveBeenCalled()
  })

  it('says nothing when the shell parks the run on its way out', () => {
    // A park pauses the transport and then leaves the tab. The room is not in
    // `live` by the time anything settles, and `melodyRanOut` is asked again
    // there — so even the frame that queued a settle finds it stale.
    const h = harness()
    h.frame(PLAYING)
    h.frameThen(STOPPED, { type: 'pause' })
    h.send({ type: 'leave' })
    h.frame(STOPPED)
    expect(h.ranOut).not.toHaveBeenCalled()
    expect(h.ctx().state).not.toBe('live')
  })

  it('says nothing when Stop gets there first', () => {
    // The room's own Stop tells the transport before it tells the machine, so
    // for one frame the transport is dead while the room still reads `live`.
    // The settle re-asks, by which time the room is `ended` — and the watch
    // is cancelled with it, so the next run starts from nothing.
    const h = harness()
    h.frame(PLAYING)
    h.frameThen(STOPPED, { type: 'stop', hasTake: true })
    h.watch.cancel()
    expect(h.ranOut).not.toHaveBeenCalled()
    expect(h.watch.sawRunning).toBe(false)
  })

  it('ends the take when the melody plays itself out', () => {
    const h = harness()
    h.frame(PLAYING)
    h.frame(PLAYING)
    h.frame(STOPPED)
    expect(h.ranOut).toHaveBeenCalledTimes(1)
    expect(h.ctx().state).toBe('ended')
  })

  it('ends it once, however many frames follow', () => {
    // The latch is dropped by the run-out itself, so the frames that arrive
    // behind it — the effect re-runs on every one of the three signals it
    // reads — find a watch with nothing to report.
    const h = harness()
    h.frame(PLAYING)
    h.frame(STOPPED)
    h.frame(STOPPED)
    h.frame(STOPPED)
    expect(h.ranOut).toHaveBeenCalledTimes(1)
  })

  it('drops a settle that was queued before the watch was cancelled', () => {
    // The unmount case: the last frame of a run queues a decision, the room
    // goes away, and the microtask lands on a room that is no longer there.
    let transport: TransportReading = PLAYING
    const ctx = liveRoom()
    const queued: (() => void)[] = []
    const ranOut = vi.fn()
    const watch = createRunOutWatch({
      ctx: () => ctx,
      transport: () => transport,
      settle: (decide) => {
        queued.push(decide)
      },
      onRanOut: ranOut,
    })
    watch.observe()
    transport = STOPPED
    watch.observe()
    expect(queued).toHaveLength(1)
    watch.cancel()
    for (const run of queued) run()
    expect(ranOut).not.toHaveBeenCalled()
  })

  it('never fires for a free run, whatever the transport does', () => {
    // No melody, so there is nothing that can reach its own end. A free run
    // has no transport at all; this is the belt on that braces.
    const free = singRoomReducer(
      singRoomReducer(initialSingRoomContext({ permission: 'granted' }), {
        type: 'enter',
        hasSummary: false,
      }),
      { type: 'mic-granted' },
    )
    const h = harness(free)
    h.frame(PLAYING)
    h.frame(STOPPED)
    expect(h.ranOut).not.toHaveBeenCalled()
  })
})
