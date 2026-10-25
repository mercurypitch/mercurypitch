// ============================================================
// MicButton — the tour hook a bar hands it
// ============================================================
//
// The mic toggle is shared by every control bar, so a tour that points at
// one bar's mic needs a hook only that bar sets: the Sing tab's Merc tour
// starts at `sing.mic` on a wide screen (R18). A bar that names no hook gets
// none, so the other bars' mics are never mistaken for it.

import { cleanup, render, screen } from '@solidjs/testing-library'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/contexts/EngineContext', () => ({
  useEngines: () => ({
    audioEngine: { getTimeData: () => new Float32Array(0) },
  }),
}))

import { MicButton } from './MicButton'

afterEach(cleanup)

describe('MicButton', () => {
  it('carries the tour hook its bar names', () => {
    render(() => (
      <MicButton active={false} onClick={() => undefined} tour="sing.mic" />
    ))

    expect(
      screen.getByRole('button', { name: 'Enable microphone' }),
    ).toHaveAttribute('data-tour', 'sing.mic')
  })

  it('carries none when its bar names none', () => {
    render(() => <MicButton active={false} onClick={() => undefined} />)

    expect(
      screen.getByRole('button', { name: 'Enable microphone' }),
    ).not.toHaveAttribute('data-tour')
  })
})
