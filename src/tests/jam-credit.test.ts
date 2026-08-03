// ── Jam practice crediting tests ──────────────────────────────────────
// What a room run is allowed to write into practice history.
//
// recordExerciseResult is a funnel, not a log: it auto-advances the daily
// routine, counts a finished run for the survey gate, and credits practice
// minutes. Its own header warns that calling it twice double-counts. These
// tests pin the rules that keep a jam room from doing exactly that.

import { beforeEach, describe, expect, it, vi } from 'vitest'

const recordExerciseResult = vi.fn()
vi.mock('@/stores/exercise-history-store', () => ({
  recordExerciseResult: (entry: unknown) => recordExerciseResult(entry),
}))

const { jamExerciseEntries, jamRunSource, jamWeeklyEntry } =
  await import('@/lib/jam/jam-catalog')
const store = await import('@/stores/jam-store')
import type { MelodyData, NoteName } from '@/types'

/** One C4 at beat 0, four beats long, under the given melody id. */
function melody(id: string): MelodyData {
  return {
    id,
    name: 'Test',
    bpm: 60,
    key: 'C',
    scaleType: 'major',
    createdAt: 0,
    updatedAt: 0,
    items: [
      {
        id: 1,
        note: { midi: 60, name: 'C' as NoteName, octave: 4, freq: 261.63 },
        duration: 4,
        startBeat: 0,
      },
    ],
  }
}

/** Put a peer in a room that has sung the target note dead on. */
function singPerfectly(peerId = 'me') {
  store.setJamPeerId(peerId)
  store.setJamPitchHistory({
    [peerId]: [
      {
        frequency: 261.6256,
        noteName: 'C',
        cents: 0,
        clarity: 1,
        midi: 60,
        timestamp: Date.now(),
        beat: 2,
      },
    ],
  })
}

describe('jamRunSource', () => {
  it('reads back the shelf a built melody came from', () => {
    const scaleRunner = jamExerciseEntries(4)
      .find((e) => e.name === 'Scale Runner')!
      .build()
    expect(jamRunSource(scaleRunner.id)).toEqual({
      kind: 'exercise',
      exerciseType: 'scale-runner',
    })
  })

  it('gives the weekly no exercise type, so it cannot be credited', () => {
    const weekly = jamWeeklyEntry({
      id: 'w1',
      title: 'Legend',
      targetItems: melody('x').items,
      targetScore: 80,
      startsAt: '2026-07-27T00:00:00.000Z',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)!.build()
    const source = jamRunSource(weekly.id)
    expect(source.kind).toBe('weekly')
    expect(source.exerciseType).toBeUndefined()
  })

  it('treats a saved melody as its own thing', () => {
    expect(jamRunSource('user-melody-42')).toEqual({ kind: 'melody' })
    expect(jamRunSource(undefined)).toEqual({ kind: 'melody' })
  })

  it('refuses a drill that no longer exists', () => {
    // An id from a build where the drill has since been retired must not
    // record an unknown exercise type.
    const source = jamRunSource('jam-exercise-teleportation')
    expect(source.kind).toBe('exercise')
    expect(source.exerciseType).toBeUndefined()
  })
})

describe('crediting a room run', () => {
  beforeEach(() => {
    recordExerciseResult.mockClear()
    store.setJamOwnRunScore(null)
    // Choosing the room's mode is a host action, and the store now says
    // so rather than leaving it to the UI to remember. These tests drive
    // the room, so they hold the room's controls.
    store.setJamIsHost(true)
    vi.useRealTimers()
  })

  /** Play, sing, wait past the stray-tap floor, stop. */
  async function playAndStop(m: MelodyData) {
    store.selectJamExercise(m)
    store.jamPlaybackPlay(0)
    singPerfectly()
    await new Promise((r) => setTimeout(r, 3100))
    store.jamPlaybackStop()
  }

  it('credits a drill run once, with the run duration', async () => {
    await playAndStop(melody('jam-exercise-long-note'))
    expect(recordExerciseResult).toHaveBeenCalledTimes(1)
    const entry = recordExerciseResult.mock.calls[0]![0] as {
      type: string
      score: number
      metrics: Record<string, number>
    }
    expect(entry.type).toBe('long-note')
    expect(entry.score).toBe(100)
    expect(entry.metrics.durationMs).toBeGreaterThanOrEqual(3000)
    // Tagged so history can tell a room run from a solo one.
    expect(entry.metrics.jam).toBe(1)
  }, 10_000)

  it('does not credit the weekly -- an attempt is armed on Challenges', async () => {
    // Arming from here would call setActiveTab and throw the singer out of
    // a live room mid-session. Jamming the weekly is practice, not a board
    // attempt.
    await playAndStop(melody('jam-weekly-w1'))
    expect(recordExerciseResult).not.toHaveBeenCalled()
  }, 10_000)

  it('does not credit a melody of your own', async () => {
    await playAndStop(melody('my-tune'))
    expect(recordExerciseResult).not.toHaveBeenCalled()
  }, 10_000)

  it('does not credit a stray start-stop', async () => {
    const m = melody('jam-exercise-long-note')
    store.selectJamExercise(m)
    store.jamPlaybackPlay(0)
    singPerfectly()
    store.jamPlaybackStop() // immediately, under the floor
    expect(recordExerciseResult).not.toHaveBeenCalled()
  })

  it('does not credit a run nobody sang', async () => {
    const m = melody('jam-exercise-long-note')
    store.setJamPeerId('me')
    store.setJamPitchHistory({})
    store.selectJamExercise(m)
    store.jamPlaybackPlay(0)
    await new Promise((r) => setTimeout(r, 3100))
    store.jamPlaybackStop()
    expect(recordExerciseResult).not.toHaveBeenCalled()
  }, 10_000)

  it('stays at one credit no matter how many times a loop wraps', async () => {
    // The whole point of crediting the session rather than the pass: a
    // looping room wraps every few seconds, and each wrap firing the funnel
    // would inflate practice minutes, the survey gate and routine advance.
    const m = melody('jam-exercise-long-note')
    store.selectJamExercise(m)
    store.setJamExerciseLoop(true)
    store.jamPlaybackPlay(0)
    singPerfectly()
    await new Promise((r) => setTimeout(r, 3100))
    // Three wraps through the real path the playback timer drives (the
    // timer itself runs on rAF, which is a no-op under test).
    for (let i = 0; i < 3; i++) {
      store.wrapOwnRun()
      singPerfectly()
    }
    store.jamPlaybackStop()
    store.setJamExerciseLoop(false)
    expect(recordExerciseResult).toHaveBeenCalledTimes(1)
  }, 10_000)

  it('keeps your part fixed when someone joins mid-take', async () => {
    // Roles come from the sorted peer list, so a join re-derives them. Mid
    // take that would rewrite the notes under a singer already singing and
    // then score their samples against a part they never saw -- in Harmony
    // Stack, a near-zero for doing nothing wrong.
    store.setJamPeerId('mmm')
    store.setJamPeers([])
    store.selectJamRoomMode('harmony')
    store.selectJamExercise(melody('jam-exercise-long-note'))
    store.jamPlaybackPlay(0)
    const during = store.jamMyTarget()

    // Two singers arrive: alone I was unison, now I would be a chord tone.
    store.setJamPeers([
      { id: 'aaa', displayName: 'A' },
      { id: 'zzz', displayName: 'Z' },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ] as any)
    expect(store.jamMyTarget()).toBe(during)

    store.jamPlaybackStop()
    store.selectJamRoomMode('unison')
    store.setJamPeers([])
  })

  it('picks up the new assignment on the next take', async () => {
    store.setJamPeerId('mmm')
    store.setJamPeers([])
    store.selectJamRoomMode('harmony')
    store.selectJamExercise(melody('jam-exercise-long-note'))
    store.jamPlaybackPlay(0)
    const firstTake = store.jamMyTarget()
    store.jamPlaybackStop()

    store.setJamPeers([
      { id: 'aaa', displayName: 'A' },
      { id: 'zzz', displayName: 'Z' },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ] as any)
    store.jamPlaybackPlay(0)
    // Now three in the room: my part is a different chord tone.
    expect(store.jamMyTarget()).not.toBe(firstTake)
    store.jamPlaybackStop()
    store.selectJamRoomMode('unison')
    store.setJamPeers([])
  })

  it('credits nothing more when stop is pressed twice', async () => {
    await playAndStop(melody('jam-exercise-long-note'))
    store.jamPlaybackStop()
    store.jamPlaybackStop()
    expect(recordExerciseResult).toHaveBeenCalledTimes(1)
  }, 10_000)
})
