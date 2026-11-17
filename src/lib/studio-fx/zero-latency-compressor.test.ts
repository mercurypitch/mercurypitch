// Zero-latency compressor tests — its module loads once per context, no compressor is made until it has, and the node made has two channels out, a DynamicsCompressorNode's parameters, and a dispose that tells its processor it is done.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { COMPRESSOR_PARAMETERS, STUDIO_COMPRESSOR_DISPOSE, STUDIO_COMPRESSOR_PROCESSOR, } from './compressor-kernel'
import type { FakeWorkletNode } from './fake-audio-graph.test-fixtures'
import { FakeAudioContext, fakeAudioWorklet, } from './fake-audio-graph.test-fixtures'
import { createZeroLatencyCompressor, prepareZeroLatencyCompressor, } from './zero-latency-compressor'

const PROCESSORS = { [STUDIO_COMPRESSOR_PROCESSOR]: COMPRESSOR_PARAMETERS }

afterEach(() => vi.unstubAllGlobals())

describe('zero-latency compressor', () => {
  it('makes no compressor on a context until its module has loaded there', async () => {
    const ctx = new FakeAudioContext()
    fakeAudioWorklet(ctx, PROCESSORS)

    expect(createZeroLatencyCompressor(ctx.asContext)).toBeNull()
    const loading = prepareZeroLatencyCompressor(ctx.asContext)
    expect(createZeroLatencyCompressor(ctx.asContext)).toBeNull()

    await expect(loading).resolves.toBe(true)
    expect(createZeroLatencyCompressor(ctx.asContext)).not.toBeNull()
  })

  it('loads its module once a context, and again on another', async () => {
    const ctx = new FakeAudioContext()
    const { modules } = fakeAudioWorklet(ctx, PROCESSORS)
    const other = new FakeAudioContext()
    const second = fakeAudioWorklet(other, PROCESSORS)

    await prepareZeroLatencyCompressor(ctx.asContext)
    await prepareZeroLatencyCompressor(ctx.asContext)
    await prepareZeroLatencyCompressor(other.asContext)

    expect(modules).toHaveLength(1)
    expect(second.modules).toHaveLength(1)
  })

  it('says no, and makes none, where the context has no audio worklet', async () => {
    const ctx = new FakeAudioContext()

    await expect(prepareZeroLatencyCompressor(ctx.asContext)).resolves.toBe(
      false,
    )
    expect(createZeroLatencyCompressor(ctx.asContext)).toBeNull()
  })

  it('says no when its module fails to load, and tries again on the next ask', async () => {
    const ctx = new FakeAudioContext()
    fakeAudioWorklet(ctx, PROCESSORS)
    const addModule = vi
      .fn<(url: string) => Promise<void>>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(undefined)
    Object.assign(ctx, { audioWorklet: { addModule } })

    await expect(prepareZeroLatencyCompressor(ctx.asContext)).resolves.toBe(
      false,
    )
    expect(createZeroLatencyCompressor(ctx.asContext)).toBeNull()
    await expect(prepareZeroLatencyCompressor(ctx.asContext)).resolves.toBe(
      true,
    )
    expect(addModule).toHaveBeenCalledTimes(2)
  })

  it("makes a node that takes up to two channels and gives two, as a DynamicsCompressorNode does, with that node's parameters", async () => {
    const ctx = new FakeAudioContext()
    fakeAudioWorklet(ctx, PROCESSORS)
    await prepareZeroLatencyCompressor(ctx.asContext)

    const compressor = createZeroLatencyCompressor(ctx.asContext)!

    const [node] = ctx.ofType<FakeWorkletNode>('worklet')
    expect(compressor.node).toBe(node)
    expect(node.processor).toBe(STUDIO_COMPRESSOR_PROCESSOR)
    expect(node.options).toMatchObject({
      numberOfInputs: 1,
      numberOfOutputs: 1,
      outputChannelCount: [2],
      channelCount: 2,
      channelCountMode: 'clamped-max',
    })
    expect(
      [
        compressor.threshold,
        compressor.knee,
        compressor.ratio,
        compressor.attack,
        compressor.release,
      ].map((param) => param.value),
    ).toEqual([-24, 30, 12, 0.003, 0.25])
  })

  it('tells its processor it is done when disposed, once', async () => {
    const ctx = new FakeAudioContext()
    fakeAudioWorklet(ctx, PROCESSORS)
    await prepareZeroLatencyCompressor(ctx.asContext)
    const compressor = createZeroLatencyCompressor(ctx.asContext)!

    compressor.dispose()
    compressor.dispose()

    const [node] = ctx.ofType<FakeWorkletNode>('worklet')
    expect(node.posted).toEqual([STUDIO_COMPRESSOR_DISPOSE])
  })
})
