import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { GlassTake } from '@/features/glass/take-strip'
import { TakeStrip } from '@/features/glass/take-strip'
import { encodeVoiceAtlasContour } from '@/lib/voice-contour'

function take(saveState: GlassTake['saveState'] = 'idle'): GlassTake {
  return {
    id: 1,
    rep: 2,
    blob: new Blob(),
    durationSec: 4.2,
    peaks: new Float32Array([0.2, 0.7, 0.4]),
    contour: encodeVoiceAtlasContour([], { source: 'f0-stream-yin-v1' }),
    shattered: false,
    metrics: {
      meanAbsCents: 12,
      bestLockSec: 1.4,
      inBandPct: 0.7,
      peakResonance: 0.8,
    },
    saveState,
  }
}

afterEach(cleanup)

describe('Glass TakeStrip local keep control', () => {
  it('keeps a take only after the explicit action', () => {
    const onKeep = vi.fn()
    render(() => (
      <TakeStrip
        takes={[take()]}
        playingId={null}
        progress={0}
        disabled={false}
        onToggle={vi.fn()}
        onKeep={onKeep}
        onRemove={vi.fn()}
      />
    ))

    expect(onKeep).not.toHaveBeenCalled()
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Keep take 2 in voice history',
      }),
    )
    expect(onKeep).toHaveBeenCalledWith(1)
  })

  it('locks the control after a take is kept', () => {
    render(() => (
      <TakeStrip
        takes={[take('saved')]}
        playingId={null}
        progress={0}
        disabled={false}
        onToggle={vi.fn()}
        onKeep={vi.fn()}
        onRemove={vi.fn()}
      />
    ))

    expect(
      screen.getByRole('button', { name: 'Kept take 2 in voice history' }),
    ).toBeDisabled()
  })
})
