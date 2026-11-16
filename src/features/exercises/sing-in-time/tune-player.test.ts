import { createRoot } from 'solid-js'
import { describe, expect, it } from 'vitest'
import { LEAD_BEATS } from './beat-sound'
import { FRAME_MS, manualFrames, pageClock, silentSound, } from './in-time-sound.fixture'
import { seeded } from './take-frames.fixture'
import { createTuneClock, playTune, startFrames } from './tune-clock'
import { planTune, TUNE_BEATS } from './tune-plan'
import type { TunePlayer } from './tune-player'
import { createTunePlayer } from './tune-player'

const TUNE = planTune({
  level: 5,
  clef: 'treble',
  voice: 'alto',
  random: seeded(5),
})

/** A player on a page clock, its frames stepped by hand. */
function player() {
  const clock = pageClock()
  const frames = manualFrames()
  let dispose = () => {}
  const p = createRoot((d): TunePlayer => {
    dispose = d
    return createTunePlayer({ sound: silentSound(clock), frame: frames.frame })
  })
  /** Moves the page on by `ms`, a frame at a time. */
  const run = (ms: number): void => {
    for (let t = 0; t < ms; t += FRAME_MS) {
      clock.advance(FRAME_MS)
      frames.step()
    }
  }
  return { p, run, frames, dispose }
}

/** Whether `promise` has settled, once the work queued so far has run. */
async function settled(promise: Promise<unknown>): Promise<boolean> {
  let done = false
  void promise.then(() => {
    done = true
  })
  await new Promise((resolve) => setTimeout(resolve, 0))
  return done
}

describe('a tune on the beat clock', () => {
  it('counts its beats from bar 1, the lead below 0, and times bar 1 on the page', () => {
    const clock = pageClock()
    const sound = silentSound(clock)
    const beatClock = createTuneClock(sound)
    const play = playTune(beatClock, sound, TUNE, {
      lead: true,
      tune: true,
      click: false,
      voiced: false,
    })
    // the first beat is struck a tenth of a second after the call
    clock.advance(100)
    beatClock.pump()
    expect(play.beat()).toBeCloseTo(-LEAD_BEATS, 6)
    clock.advance(LEAD_BEATS * 1000 + 500)
    beatClock.pump()
    expect(play.beat()).toBeCloseTo(0.5, 6)
    expect(play.bar1()).toBeCloseTo(1000 + 100 + LEAD_BEATS * 1000, 6)
    play.stop()
    expect(play.running).toBe(false)
  })

  it('runs a frame loop until it is stopped', () => {
    const frames = manualFrames()
    let ticks = 0
    const stop = startFrames(frames.frame, () => {
      ticks += 1
    })
    frames.step()
    frames.step()
    expect(ticks).toBe(2)
    stop()
    frames.step()
    expect(ticks).toBe(2)
    expect(frames.pending).toBe(0)
  })
})

describe('Hear it first', () => {
  it("plays Merc's do, the count-in and the tune, the cursor's beat moving with it", async () => {
    const { p, run, dispose } = player()
    const done = p.demo(TUNE)
    expect(p.playing()).toEqual({ kind: 'demo' })
    run(200)
    expect(p.beat()).toBeLessThan(-LEAD_BEATS + 0.2)
    run(LEAD_BEATS * 1000 + 1000)
    expect(p.beat()).toBeGreaterThan(0.8)
    expect(p.beat()).toBeLessThan(1.2)
    expect(await settled(done)).toBe(false)
    // to the end of the tune's two bars
    run(TUNE_BEATS * 1000)
    expect(await settled(done)).toBe(true)
    expect(p.playing()).toBeNull()
    expect(p.beat()).toBeNull()
    dispose()
  })
})

describe('Hear do', () => {
  it('plays the do alone, two beats', async () => {
    const { p, run, dispose } = player()
    const done = p.hearDo(TUNE)
    expect(p.playing()).toEqual({ kind: 'do' })
    run(2300)
    expect(await settled(done)).toBe(true)
    expect(p.playing()).toBeNull()
    dispose()
  })
})

describe('one play at a time', () => {
  it('cuts the last play short, and its promise still settles', async () => {
    const { p, run, dispose } = player()
    const first = p.demo(TUNE)
    run(500)
    const second = p.again(TUNE, 2)
    expect(await settled(first)).toBe(true)
    expect(p.playing()).toEqual({ kind: 'again', tune: 2 })
    expect(await settled(second)).toBe(false)
    p.stop()
    expect(await settled(second)).toBe(true)
    expect(p.playing()).toBeNull()
    dispose()
  })

  it('stops with its owner', async () => {
    const { p, frames, dispose } = player()
    const done = p.demo(TUNE)
    dispose()
    expect(await settled(done)).toBe(true)
    expect(frames.pending).toBe(0)
  })
})
