// ============================================================
// Merc sim pins — every approved state moves exactly as it did
// ============================================================
//
// Each approved state runs for fixed inputs (a glide that also moves the
// sung pitch, silences, holds) and its poses are hashed. The digests were
// taken from the sim before `hum` and `ride` existed, so a new state, or a
// new reading of the voice, cannot move a pixel of the old ones. Change a
// digest only when you mean to change how that state moves.

import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import type { MercState } from './constants'
import type { MercPose, MercVoice } from './sim'
import { Sim, STEP } from './sim'

// The states the owner approved before the glide rooms.
const APPROVED: readonly MercState[] = [
  'drop',
  'idle',
  'listen',
  'sing',
  'lock',
  'climb',
  'celebrate',
  'point',
  'sleep',
  'hop',
]

// Sings for 1.5 s, rests for 0.5 s; the distance to the note sweeps a fifth
// and the sung pitch slides with it, with a little tracker jitter.
const glide = (t: number): MercVoice => ({
  voiced: t % 2 < 1.5,
  cents: -300 + 800 * Math.sin(t * 1.3) ** 2,
  level: 0.3 + 0.5 * Math.abs(Math.sin(t * 2.1)),
  steady: 0.5 + 0.5 * Math.cos(t * 0.7),
  midi: 57 + 7 * Math.sin(t * 1.1) ** 2 + 0.15 * Math.sin(t * 37),
})

// Every pose number in billionths. Node 22 and Node 25 disagree in the last
// bit of a few of celebrate's values (2.8e-17 at most); a change to how a
// state moves is many orders of magnitude larger than this rounding.
const digest = (poses: readonly MercPose[]): string => {
  const nanos = poses.map((p) =>
    (Object.values(p).flat(2) as number[]).map((x) => Math.round(x * 1e9)),
  )
  return createHash('sha256')
    .update(JSON.stringify(nanos), 'utf8')
    .digest('hex')
}

// 3 s of one state from a fresh sim, a pose every 0.05 s.
function run(state: MercState): string {
  const sim = new Sim(state)
  sim.voiceAt = glide
  const poses: MercPose[] = []
  for (let i = 1; i <= 3 * 240; i++) {
    sim.step(STEP)
    if (i % 12 === 0) poses.push(sim.pose())
  }
  return digest(poses)
}

// A room's evening: each approved state in turn, 0.6 s apiece, soft
// transitions carrying springs, particles and the lock across.
function chain(): string {
  const sim = new Sim('drop')
  sim.voiceAt = glide
  const poses: MercPose[] = []
  for (const state of APPROVED) {
    sim.setState(state)
    for (let i = 1; i <= 144; i++) {
      sim.step(STEP)
      if (i % 12 === 0) poses.push(sim.pose())
    }
  }
  return digest(poses)
}

const PINNED: Readonly<Record<string, string>> = {
  drop: '05cfd4f61853e7da9cf4c415bb5aa3d4af1a53472898f48c5a3ae5013df2fe40',
  idle: '83ef8182ee440c7f1a2316f067f64e7a9a54b42097389dc073cab09a7297238e',
  listen: '4804b929fa470a70286e1f1287957ccba9ec4f13f63dfa5bcb4cbef72a202230',
  sing: 'a4b799360535dcd455389299f98c92e79ffd0d09ae734320b321d605ac2c13af',
  lock: 'a22aaa9340e6fe7df3c1d5dadd7800596fd220e3154d4027c1d68520b4f5e262',
  climb: 'e18036061f09208ccf97da9927f23402c9e631e74606a1b605e67e6e55ef2564',
  celebrate: '7245634ede59b5de05e7fa0e27c26071568f4741ee164c6a246ca26ab8659097',
  point: 'bcdeadb4f472510eff8790ca0b9cf446be1a2348b55e891de96eb2a8653e85be',
  sleep: '9893777a41cf8e4294e785beffb264e6af21a882632ec3eb2e3c98c22f4efdae',
  hop: 'eb9ae94ece28ff9629e03f1a0ee4588f47e2663e699758e038b3729b1659775b',
  chain: '08166d7078cd2257e28c8b24756f0e8f37b4fc682899f0a087df062a2b997217',
}

describe('Sim, the approved states', () => {
  it('moves every approved state exactly as before, pose for pose', () => {
    // Arrange
    const got: Record<string, string> = {}

    // Act
    for (const state of APPROVED) got[state] = run(state)
    got.chain = chain()

    // Assert
    expect(got).toEqual(PINNED)
  })
})
