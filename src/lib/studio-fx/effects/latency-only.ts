// ============================================================
// Studio latency-only effect — a dynamics effect at Light playback quality: its lookahead and nothing else
// ============================================================
//
// A dynamic EQ band or a de-esser only acts while its band is too loud; the
// rest of the time it passes the signal through its compressor's lookahead.
// At Light (fx-profile.ts `lite`) a live chain keeps that lookahead, so the
// lane stays in line with the latency measured for its full chain, and
// drops the band, its compressor and their twins. Export never builds one.
//
// A dynamic EQ that follows another in a run (effects/dyneq.ts) adds no
// lookahead of its own, so a following one is a plain wire.
//
// A monitored input (fx-profile.ts `zeroLatency`) keeps not even the
// lookahead: a compressor, a de-esser and a dynamic EQ play there on the
// compressor worklet with no lookahead (zero-latency-compressor.ts), and
// each is a plain wire until that worklet has loaded. At Light a monitored
// lane's de-esser and dynamic EQ are a plain wire for good, with no worklet
// and no band: they pass the input bit for bit, uncut as at Light playback.
import type { EffectSpec } from '@/lib/studio-fx/chain-spec'
import { createCompressorTwin, settleCompressorTwins, } from '@/lib/studio-fx/compressor-twin'
import type { EffectEnv, EffectUnit } from '@/lib/studio-fx/effect-shell'
import { connectSeries, disconnectAll } from '@/lib/studio-fx/effect-shell'

export function createLatencyOnlyUnit(
  ctx: BaseAudioContext,
  spec: EffectSpec,
  _env: EffectEnv,
): EffectUnit {
  const input = ctx.createGain()
  const output = ctx.createGain()
  const twin = createCompressorTwin(ctx)
  connectSeries([input, twin, output])
  let following = false
  let disposed = false
  return {
    kind: spec.kind,
    input,
    output,
    setEnabled() {},
    setParams() {},
    readReductionDb: () => 0,
    settle: (at) => {
      if (!disposed) settleCompressorTwins([twin], at)
    },
    follow:
      spec.kind === 'dyneq'
        ? (source) => {
            const next = source !== null
            if (disposed || next === following) return
            if (next) {
              input.disconnect(twin)
              twin.disconnect()
              input.connect(output)
            } else {
              input.disconnect(output)
              connectSeries([input, twin, output])
            }
            following = next
          }
        : undefined,
    dispose() {
      if (disposed) return
      disposed = true
      disconnectAll([input, twin, output])
    },
  }
}

/** A lookahead dynamics effect while its input is monitored, at Light or until the compressor worklet has loaded: one gain at unity, no delay and no cut. */
export function createStraightThroughUnit(
  ctx: BaseAudioContext,
  spec: EffectSpec,
): EffectUnit {
  const wire = ctx.createGain()
  let disposed = false
  return {
    kind: spec.kind,
    input: wire,
    output: wire,
    setEnabled() {},
    setParams() {},
    readReductionDb: () => 0,
    dispose() {
      if (disposed) return
      disposed = true
      wire.disconnect()
    },
  }
}
