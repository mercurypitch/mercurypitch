// ============================================================
// Karaoke Night shell background integration tests
// ============================================================

import { cleanup, render, screen } from '@solidjs/testing-library'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { KaraokeNightApp } from './KaraokeNightApp'

vi.mock('./demo-song', () => ({
  demoIsPlayable: () => false,
  demoSessionId: (slug: string) => `demo:${slug}`,
  isDemoSessionId: () => false,
  loadDemoSongs: async () => [],
  seedDemoLyrics: async () => undefined,
}))

vi.mock('./funnel', () => ({ trackKaraoke: vi.fn() }))
vi.mock('./KaraokeAccount', () => ({ KaraokeAccount: () => null }))
vi.mock('./KaraokeNightRuntime', () => ({ KaraokeNightRuntime: () => null }))
vi.mock('./KaraokeRailPanels', () => ({ KaraokeRailPanels: () => null }))
vi.mock('./KaraokeStageHost', () => ({ KaraokeStageHost: () => null }))

afterEach(() => {
  cleanup()
  localStorage.clear()
  window.history.replaceState({}, '', '/')
})

describe('KaraokeNightApp background integration', () => {
  it('paints the free fallback through shared focal-point variables', () => {
    const { container } = render(() => <KaraokeNightApp />)
    const app = container.querySelector<HTMLElement>('.kn-app')
    expect(app).not.toBeNull()
    expect(app!.style.getPropertyValue('--mp-stage-image')).toContain(
      '/karaoke-night-stage.webp',
    )
    expect(app!.style.getPropertyValue('--mp-stage-position')).toBe('50% 50%')
    expect(
      screen.getByRole('button', { name: 'Choose karaoke stage background' }),
    ).toBeInTheDocument()
  })
})
