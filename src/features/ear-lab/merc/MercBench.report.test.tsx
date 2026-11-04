// The bench and the Ear Report share the tab's one scroller and unmount
// in turn: the bench keeps its place as it opens the report, and a bench
// mounted after it comes back to that place (tab-scroll.ts).

import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { createSignal, Show } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type * as GpuGateModule from '@/lib/merc/gpu-gate'
import { MercBench } from './MercBench'

// jsdom has no WebGL: Merc is his still.
vi.mock('@/lib/merc/gpu-gate', async (importOriginal) => ({
  ...(await importOriginal<typeof GpuGateModule>()),
  canRunLiveMerc: (): boolean => false,
}))

afterEach(() => cleanup())

describe('the bench, around the Ear Report', () => {
  it('comes back where it stood when it opened the report', () => {
    const onNavigate = vi.fn()
    const [bench, setBench] = createSignal(true)
    let stage: HTMLDivElement | undefined
    render(() => (
      <div ref={stage} style={{ 'overflow-y': 'auto' }}>
        <Show when={bench()}>
          <MercBench onNavigate={onNavigate} />
        </Show>
      </div>
    ))
    if (stage === undefined) throw new Error('no stage')

    stage.scrollTop = 1240
    fireEvent.click(screen.getByTestId('merc-report'))
    expect(onNavigate).toHaveBeenCalledWith('report')

    // The report has the scroller now, at its own top.
    setBench(false)
    stage.scrollTop = 0
    setBench(true)
    expect(stage.scrollTop).toBe(1240)
  })
})
