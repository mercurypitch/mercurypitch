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
