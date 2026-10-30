import { describe, expect, it } from 'vitest'
import { createStudioFxChain } from './chain'
import type { EffectSpec } from './chain-spec'
import { moveEffect, normalizeChainSpec, removeEffect, updateEffect, } from './chain-spec'
import type { EffectUnit } from './effect-shell'
import type { FakeGain } from './fake-audio-graph.test-fixtures'
import { createManualScheduler, FakeAudioContext, FakeNode, FakeOfflineAudioContext, } from './fake-audio-graph.test-fixtures'

interface FakeUnit extends EffectUnit {
  readonly id: string
  readonly calls: string[]
  disposed: boolean
}

function harness(options: { offline?: boolean } = {}) {
  const ctx =
    options.offline === true
      ? new FakeOfflineAudioContext()
      : new FakeAudioContext()
  const scheduler = createManualScheduler()
  const units: FakeUnit[] = []
  const createUnit = (_ctx: BaseAudioContext, spec: EffectSpec): EffectUnit => {
    const input = new FakeNode(`${spec.id}:in`)
    const output = new FakeNode(`${spec.id}:out`)
    const unit: FakeUnit = {
      id: spec.id,
      kind: spec.kind,
      calls: [],
      disposed: false,
      input: input as unknown as AudioNode,
      output: output as unknown as AudioNode,
      setEnabled(enabled) {
        unit.calls.push(`enabled:${enabled}`)
      },
      setParams(params) {
        unit.calls.push(`params:${JSON.stringify(params)}`)
      },
      readReductionDb: () => -2,
      dispose() {
        unit.disposed = true
      },
    }
    if (spec.kind === 'dyneq') {
      Object.assign(unit, {
        follow(source: AudioNode | null) {
          const from = source as unknown as FakeNode | null
          unit.calls.push(`follow:${from === null ? 'lead' : from.nodeType}`)
        },
      })
    }
    units.push(unit)
    return unit
  }
  const build = (spec: unknown) =>
    createStudioFxChain(ctx.asContext, spec, {
      schedule: scheduler.schedule,
      createUnit,
    })
  return { ctx, scheduler, units, build }
}

/** The effect ids audio passes through, in order, from the chain's input. */
function signalOrder(input: AudioNode, units: readonly FakeUnit[]): string[] {
  const byInput = new Map(
    units.map((unit) => [unit.input as unknown as FakeNode, unit]),
  )
  const order: string[] = []
  let node = input as unknown as FakeNode
  for (let guard = 0; guard < 32; guard++) {
    const unit = node.targets
      .map((target) => byInput.get(target))
      .find((u) => u !== undefined)
    if (unit === undefined) break
    order.push(unit.id)
    node = unit.output as unknown as FakeNode
  }
  return order
}

const VOCAL = normalizeChainSpec({
  effects: [{ kind: 'eq' }, { kind: 'compressor' }, { kind: 'reverb' }],
})

describe('createStudioFxChain', () => {
  it('wires the effects in spec order between input and output', () => {
    const { build, units } = harness()
    const chain = build(VOCAL)
    expect(signalOrder(chain.input, units)).toEqual([
      'eq',
      'compressor',
      'reverb',
    ])
  })

  it('runs dynamic EQs next to each other side by side, each after the first fed from the run input', () => {
    const { build, units } = harness({ offline: true })
    const chain = build(
      normalizeChainSpec({
        effects: [
          { id: 'eq', kind: 'eq' },
          { id: 'mud', kind: 'dyneq' },
          { id: 'box', kind: 'dyneq' },
          { id: 'character', kind: 'compressor' },
          { id: 'nasal', kind: 'dyneq' },
          { id: 'harsh', kind: 'dyneq' },
        ],
      }),
    )
    const follows = (id: string) =>
      units
        .find((unit) => unit.id === id)!
        .calls.filter((call) => call.startsWith('follow:'))
    expect(follows('mud')).toEqual(['follow:lead'])
    expect(follows('box')).toEqual(['follow:eq:out'])
    expect(follows('nasal')).toEqual(['follow:lead'])
    expect(follows('harsh')).toEqual(['follow:character:out'])
    // With the compressor moved out from between them, all four are one run.
    chain.setSpec(moveEffect(chain.getSpec(), 'character', 5))
    expect(follows('nasal')).toEqual(['follow:lead', 'follow:eq:out'])
    expect(follows('harsh').at(-1)).toBe('follow:eq:out')
    expect(signalOrder(chain.input, units)).toEqual([
      'eq',
      'mud',
      'box',
      'nasal',
      'harsh',
      'character',
    ])
  })

  it('wires input straight to output when the chain is empty', () => {
    const { build } = harness()
    const chain = build({ effects: [] })
    const input = chain.input as unknown as FakeNode
    const duck = input.targets[0] as FakeGain
    expect(duck.targets).toEqual([chain.output])
  })

  it('reuses running effects by id and sends only what changed', () => {
    const { build, units } = harness()
    const chain = build(VOCAL)
    chain.setSpec(updateEffect(VOCAL, 'reverb', { params: { mix: 30 } }))
    expect(units).toHaveLength(3)
    const reverb = units.find((unit) => unit.id === 'reverb')!
    expect(reverb.calls).toHaveLength(1)
    expect(reverb.calls[0]).toContain('"mix":30')
    expect(units.find((unit) => unit.id === 'eq')!.calls).toEqual([])
  })

  it('ducks, re-patches after the duck, then opens again when the order changes live', () => {
    const { build, units, scheduler, ctx } = harness()
    const chain = build(VOCAL)
    chain.setSpec(moveEffect(VOCAL, 'reverb', 0))
    expect(signalOrder(chain.input, units)).toEqual([
      'eq',
      'compressor',
      'reverb',
    ])
    const duckGain = [...ctx.ofType<FakeGain>('gain')].find((gain) =>
      gain.targets.includes(chain.output as unknown as FakeNode),
    )!
    expect(duckGain.gain.destination).toBe(0)
    scheduler.advance(40)
    expect(signalOrder(chain.input, units)).toEqual([
      'reverb',
      'eq',
      'compressor',
    ])
    expect(duckGain.gain.destination).toBe(1)
  })

  it('folds several structural changes during one duck into a single re-patch', () => {
    const { build, units, scheduler } = harness()
    const chain = build(VOCAL)
    chain.setSpec(removeEffect(VOCAL, 'compressor'))
    chain.setSpec(
      normalizeChainSpec({ effects: [{ kind: 'reverb' }, { kind: 'delay' }] }),
    )
    expect(scheduler.pendingCount).toBe(1)
    scheduler.advance(40)
    expect(signalOrder(chain.input, units)).toEqual(['reverb', 'delay'])
  })

  it('disposes removed effects only once they are patched out', () => {
    const { build, units, scheduler } = harness()
    const chain = build(VOCAL)
    chain.setSpec(removeEffect(VOCAL, 'compressor'))
    const compressor = units.find((unit) => unit.id === 'compressor')!
    expect(compressor.disposed).toBe(false)
    scheduler.advance(40)
    expect(compressor.disposed).toBe(true)
  })

  it('re-patches at once, without a duck, when nothing is playing', () => {
    const { build, units, scheduler } = harness({ offline: true })
    const chain = build(VOCAL)
    chain.setSpec(moveEffect(VOCAL, 'eq', 2))
    expect(scheduler.pendingCount).toBe(0)
    expect(signalOrder(chain.input, units)).toEqual([
      'compressor',
      'reverb',
      'eq',
    ])
  })

  it('replaces an effect whose id now names a different kind', () => {
    const { build, units } = harness({ offline: true })
    const chain = build(VOCAL)
    chain.setSpec({ effects: [{ id: 'eq', kind: 'delay' }] })
    expect(units.map((unit) => `${unit.id}:${unit.kind}`)).toContain('eq:delay')
    expect(units.find((unit) => unit.kind === 'eq')!.disposed).toBe(true)
  })

  it('clamps parameter changes and skips no-op writes', () => {
    const { build, units } = harness()
    const chain = build(VOCAL)
    chain.setEffectParams('reverb', { mix: 500 })
    chain.setEffectParams('reverb', { mix: 100 })
    const reverb = units.find((unit) => unit.id === 'reverb')!
    expect(reverb.calls).toHaveLength(1)
    expect(chain.getSpec().effects[2].params).toMatchObject({ mix: 100 })
  })

  it('toggles an effect and reflects it in the spec', () => {
    const { build, units } = harness()
    const chain = build(VOCAL)
    chain.setEffectEnabled('eq', false)
    chain.setEffectEnabled('eq', false)
    expect(units[0].calls).toEqual(['enabled:false'])
    expect(chain.getSpec().effects[0].enabled).toBe(false)
  })

  it('ignores ids it does not know', () => {
    const { build } = harness()
    const chain = build(VOCAL)
    chain.setEffectEnabled('nope', false)
    chain.setEffectParams('nope', { mix: 1 })
    expect(chain.readReductionDb('nope')).toBe(0)
    expect(chain.getSpec()).toEqual(VOCAL)
  })

  it('settles every unit that has compressors from the time asked', () => {
    const { units, build } = harness()
    const settled: [string, number][] = []
    const chain = build(VOCAL)
    for (const unit of units)
      if (unit.kind === 'compressor')
        Object.assign(unit, {
          settle: (at: number) => settled.push([unit.id, at]),
        })
    chain.settle(1.5)
    expect(settled).toEqual([[units[1].id, 1.5]])
  })

  it('cancels a pending re-patch and disposes every effect on dispose', () => {
    const { build, units, scheduler } = harness()
    const chain = build(VOCAL)
    chain.setSpec(moveEffect(VOCAL, 'reverb', 0))
    chain.dispose()
    expect(scheduler.pendingCount).toBe(0)
    expect(units.every((unit) => unit.disposed)).toBe(true)
    chain.setSpec(VOCAL)
    expect(units).toHaveLength(3)
  })
})
