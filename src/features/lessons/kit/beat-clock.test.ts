// The beat clock on a fake clock: it books ahead on the audio clock, skips
// what has passed, follows a tempo change from the next beat, and a stop
// silences what it booked.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import './browser-doubles.test-fixtures'
import type { Bar, ClockEnv, OutputStamp, Spot } from './beat-clock'
import { bars, createBeatClock, LOOKAHEAD } from './beat-clock'
import type { Bus } from './sound-ahead'

/** A page clock in ms, an audio clock 5 s behind it, and buses that record their closing. */
function fakeEnv(o: { stamp?: OutputStamp | null; sound?: boolean } = {}) {
  let page = 1000
  const closes: (number | undefined)[] = []
  let onClose: (() => void) | null = null
  const env: ClockEnv = {
    now: () => page,
    audioTime: () => (o.sound === false ? null : page / 1000 - 5),
    outputStamp: () => o.stamp ?? null,
    bus(close) {
      if (o.sound === false) return null
      onClose = close
      let open = true
      return {
        context: {} as AudioContext,
        node: {} as GainNode,
        get open() {
          return open
        },
        close(seconds?: number) {
          if (!open) return
          open = false
          closes.push(seconds)
          close()
        },
      } satisfies Bus
    },
  }
  return {
    env,
    closes,
    /** The page closes the bus, as the Sound switch or a hidden page does. */
    pageCloses: () => onClose?.(),
    advance(ms: number) {
      page += ms
    },
    get page() {
      return page
    },
  }
}

const bar4 = (hits: number[]): Bar<string> => ({
  beats: 4,
  hits: hits.map((beat) => ({ beat, data: `b${beat}` })),
})

describe('beat clock', () => {
  let timeouts: ReturnType<typeof vi.spyOn>
  beforeEach(() => {
    timeouts = vi.spyOn(globalThis, 'setTimeout')
  })
  afterEach(() => {
    timeouts.mockRestore()
  })

  it('books each hit at its exact audio time, only once it falls within the lookahead', () => {
    const f = fakeEnv()
    const clock = createBeatClock(f.env)
    const booked: [string, number][] = []
    clock.start<string>({
      bar: bars([bar4([0, 1, 2, 3])]),
      bpm: () => 60,
      audible: true,
      book: (d, when) => booked.push([d, when]),
    })
    // the first beat sits 0.1 s ahead, inside the window: booked at once
    expect(booked).toEqual([['b0', -4 + 0.1]])
    f.advance(1010)
    clock.pump()
    expect(booked.map((b) => b[0])).toEqual(['b0', 'b1'])
    expect(booked[1][1]).toBeCloseTo(-4 + 1.1, 9)
    // nothing more until beat 2 comes within 0.1 s
    f.advance(40)
    clock.pump()
    expect(booked).toHaveLength(2)
    expect(LOOKAHEAD).toBe(0.1)
  })

  it('skips a hit whose time passed before it came up, and never shows it', () => {
    const f = fakeEnv()
    const clock = createBeatClock(f.env)
    const booked: string[] = []
    const shown: string[] = []
    clock.start<string>({
      bar: bars([bar4([0, 1, 2, 3])]),
      bpm: () => 60,
      audible: true,
      book: (d) => booked.push(d),
      onHit: (d) => shown.push(d),
    })
    // a stalled page: two beats pass with no frame
    f.advance(2500)
    clock.pump()
    expect(booked).toEqual(['b0'])
    expect(shown).toEqual(['b0'])
    f.advance(600)
    clock.pump()
    expect(booked).toEqual(['b0', 'b3'])
  })

  it('applies a change of tempo from the next beat', () => {
    const f = fakeEnv()
    const clock = createBeatClock(f.env)
    let bpm = 60
    const booked: number[] = []
    clock.start({
      bar: () => bar4([0, 1, 2, 3]),
      bpm: () => bpm,
      audible: true,
      book: (_d, when) => booked.push(when),
    })
    f.advance(1000)
    clock.pump()
    bpm = 120
    for (let i = 0; i < 40; i++) {
      f.advance(50)
      clock.pump()
    }
    const gaps = booked.slice(1).map((t, i) => +(t - booked[i]).toFixed(6))
    // beat 1 was timed at 60 before the change; every beat after at 120
    expect(gaps.slice(0, 3)).toEqual([1, 1, 0.5])
    expect(new Set(gaps.slice(2))).toEqual(new Set([0.5]))
  })

  it('times eighths and hits before the bar from the beat they belong to', () => {
    const f = fakeEnv()
    const clock = createBeatClock(f.env)
    const booked: [string, number][] = []
    clock.start<string>({
      bar: bars([bar4([-0.5, 0, 0.5])]),
      bpm: () => 60,
      audible: true,
      lead: 0.6,
      // a Merc's hop, 0.53 s before its clap
      early: 0.53,
      book: (d, when) => booked.push([d, when]),
    })
    for (let i = 0; i < 30; i++) {
      f.advance(50)
      clock.pump()
    }
    expect(booked.map(([d]) => d)).toEqual(['b-0.5', 'b0', 'b0.5'])
    expect(booked[0][1]).toBeCloseTo(-4 + 0.1, 9)
    expect(booked[2][1]).toBeCloseTo(-4 + 1.1, 9)
  })

  it('ends after its last bar and tail, resolving true; a stop resolves false and closes the bus fast', async () => {
    const f = fakeEnv()
    const clock = createBeatClock(f.env)
    const run = clock.start({
      bar: bars([bar4([0])]),
      bpm: () => 120,
      audible: true,
      tail: 0.35,
    })
    for (let i = 0; i < 50 && run.running; i++) {
      f.advance(50)
      clock.pump()
    }
    await expect(run.done).resolves.toBe(true)
    // 0.1 s lead, four beats of 0.5 s, then the 0.35 s tail
    expect(f.page).toBeGreaterThanOrEqual(1000 + 2450)
    expect(f.closes).toEqual([0.5])

    const g = fakeEnv()
    const other = createBeatClock(g.env)
    const stopped = other.start({
      bar: () => bar4([0]),
      bpm: () => 90,
      audible: true,
    })
    stopped.stop()
    await expect(stopped.done).resolves.toBe(false)
    expect(g.closes).toEqual([undefined])
    expect(other.busy).toBe(false)
  })

  it('ends a run, unheard, when the page closes its bus', async () => {
    const f = fakeEnv()
    const clock = createBeatClock(f.env)
    const run = clock.start({
      bar: () => bar4([0]),
      bpm: () => 90,
      audible: true,
    })
    f.pageCloses()
    await expect(run.done).resolves.toBe(false)
    expect(run.running).toBe(false)
  })

  it('books nothing after a stop, though the beats were timed ahead', () => {
    const f = fakeEnv()
    const clock = createBeatClock(f.env)
    const booked: string[] = []
    const run = clock.start({
      bar: () => bar4([0, 1, 2, 3]),
      bpm: () => 90,
      audible: true,
      book: (d) => booked.push(d),
    })
    run.stop()
    f.advance(2000)
    clock.pump()
    expect(booked).toEqual(['b0'])
  })

  it('shows beats and hits as heard, by the output timestamp where there is one', () => {
    // the device plays audio time -4.0 at page 1090 ms: 90 ms of output delay
    const f = fakeEnv({ stamp: { contextTime: -4, performanceTime: 1090 } })
    const clock = createBeatClock(f.env)
    const beats: Spot[] = []
    const run = clock.start({
      bar: bars([bar4([0, 1])]),
      bpm: () => 60,
      audible: true,
      onBeat: (s) => beats.push(s),
    })
    // beat 0 is at audio -3.9, heard at page 1190
    f.advance(150)
    clock.pump()
    expect(beats).toEqual([])
    f.advance(50)
    clock.pump()
    expect(beats).toEqual([{ bar: 0, beat: 0, beats: 0 }])
    expect(run.pageTimeOfBeat(0)).toBeCloseTo(1190, 6)
  })

  it('pairs the two clocks at the start when no timestamp is usable', () => {
    const f = fakeEnv({ stamp: { contextTime: 3, performanceTime: 0 } })
    const clock = createBeatClock(f.env)
    const run = clock.start({
      bar: bars([bar4([0])]),
      bpm: () => 60,
      audible: true,
    })
    expect(run.pageTimeOfBeat(0)).toBeCloseTo(1100, 6)
    expect(run.pageTimeOfBeat(1)).toBeNull()
  })

  it('keeps time on the page clock with no sound, and still shows every hit', () => {
    const f = fakeEnv({ sound: false })
    const clock = createBeatClock(f.env)
    const booked: string[] = []
    const shown: string[] = []
    const frames: number[] = []
    clock.start<string>({
      bar: bars([bar4([0, 1])]),
      bpm: () => 60,
      audible: true,
      book: (d) => booked.push(d),
      onHit: (d) => shown.push(d),
      onFrame: (s) => frames.push(s.beats),
    })
    for (let i = 0; i < 30; i++) {
      f.advance(50)
      clock.pump()
    }
    expect(booked).toEqual([])
    expect(shown).toEqual(['b0', 'b1'])
    expect(frames.at(-1)).toBeGreaterThan(1)
  })

  it('reads the next bar as it comes up, so a change lands at the bar line', () => {
    const f = fakeEnv()
    const clock = createBeatClock(f.env)
    let pattern = bar4([0])
    const asked: number[] = []
    const booked: string[] = []
    clock.start({
      bar: (i) => {
        asked.push(i)
        return pattern
      },
      bpm: () => 120,
      audible: true,
      book: (d) => booked.push(d),
    })
    f.advance(1000)
    clock.pump()
    pattern = bar4([0, 2])
    for (let i = 0; i < 45; i++) {
      f.advance(50)
      clock.pump()
    }
    expect(asked.slice(0, 2)).toEqual([0, 1])
    // bar 0 kept its one hit; bar 1, read after the change, has two
    expect(booked.slice(0, 3)).toEqual(['b0', 'b0', 'b2'])
  })

  it('starts and stops no sound by a timer', () => {
    const f = fakeEnv()
    const clock = createBeatClock(f.env)
    const run = clock.start({
      bar: () => bar4([0, 1, 2, 3]),
      bpm: () => 90,
      audible: true,
      book: () => undefined,
    })
    for (let i = 0; i < 40; i++) {
      f.advance(50)
      clock.pump()
    }
    run.stop()
    expect(timeouts).not.toHaveBeenCalled()
  })
})
