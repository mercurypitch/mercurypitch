// Studio delay tests — no node of an echo adds more than two signals, so every build of a lane plays its echoes to the bit.
import { describe, expect, it } from 'vitest'
import { normalizeChainSpec } from '@/lib/studio-fx/chain-spec'
import type { FakeNode } from '@/lib/studio-fx/fake-audio-graph.test-fixtures'
import { createManualScheduler, FakeAudioContext, FakeParam, } from '@/lib/studio-fx/fake-audio-graph.test-fixtures'
import { createEffectUnit } from './index'

/** The voice role's echo (role-chains.ts) at 120 BPM. */
const VOICE_ECHO = {
  timeMs: 500,
  feedback: 22,
  pingPong: 35,
  lowCutHz: 300,
  highCutHz: 5000,
  mix: 9,
  duck: 70,
}

function echo(pingPong: number): FakeAudioContext {
  const ctx = new FakeAudioContext()
  const [spec] = normalizeChainSpec({
    effects: [
      { kind: 'delay', params: { ...VOICE_ECHO, pingPong }, enabled: true },
    ],
  }).effects
  createEffectUnit(ctx.asContext, spec, {
    isLive: () => false,
    schedule: createManualScheduler().schedule,
  })
  return ctx
}

/** How many signals input `input` of `target` adds up: one per connection to it. */
function signalsInto(
  ctx: FakeAudioContext,
  target: FakeNode,
  input = 0,
): number {
  return ctx.created
    .flatMap((node) => node.connections)
    .filter((connection) => connection.node === target)
    .filter((connection) => connection.input === input).length
}

describe('delay', () => {
  // A sum of three can round differently in another order, and the order a
  // node adds its inputs in can differ between two builds of one chain: two
  // builds of the voice lane, its echo three signals into each line, came
  // out -141.7 to -142.6 dBFS apart in Chromium 148, and the lane without
  // its echo to the bit.
  it.each([0, 35, 100])(
    'adds no more than two signals at any node at ping-pong %i, so no order of adding them changes its echoes',
    (pingPong) => {
      const ctx = echo(pingPong)

      for (const node of ctx.created) {
        // A merger keeps its inputs apart, one per channel.
        const inputs = node.nodeType === 'merger' ? [0, 1] : [0]
        for (const input of inputs)
          expect(signalsInto(ctx, node, input)).toBeLessThanOrEqual(2)
      }
      // A param adds the signals fed to it to its own value.
      const params = new Set(
        ctx.created
          .flatMap((node) => node.targets)
          .filter((node) => node instanceof FakeParam),
      )
      expect(params.size).toBeGreaterThan(0)
      for (const param of params) expect(signalsInto(ctx, param)).toBe(1)
    },
  )
})
