// ============================================================
// Karaoke Night shell background integration tests
// ============================================================

import { cleanup, render, screen, waitFor } from '@solidjs/testing-library'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { matchVoiceCommand } from '@/features/voice-control/command-grammar'
import { activeVoiceCommands } from '@/features/voice-control/voice-command-registry'
import type * as ViewportModule from '@/lib/use-viewport'
import { karaokeZen, setKaraokeZen } from '@/stores/ui-store'
import { KaraokeNightApp } from './KaraokeNightApp'

const viewport = vi.hoisted(() => ({ narrow: false }))
vi.mock('@/lib/use-viewport', async (importOriginal) => ({
  ...(await importOriginal<typeof ViewportModule>()),
  isNarrow: () => viewport.narrow,
}))

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
  setKaraokeZen(false)
  viewport.narrow = false
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

// ============================================================
// A room you can leave by voice
// ============================================================
//
// Reported from a device retest: on this page voice offered Mercury Sing's
// commands and "what can I say", and nothing else. The tab set that carries
// "go home" belongs to the app shell, which this document is not — so a
// singer with the phone across the room could get here by voice and then
// had no phrase that got them out again.

describe('KaraokeNightApp voice navigation', () => {
  it('registers a spoken way back into the app', () => {
    render(() => <KaraokeNightApp />)

    const ids = new Set(activeVoiceCommands().map((command) => command.id))
    expect(ids).toContain('nav.leave.home')
    expect(ids).toContain('nav.leave.singing')
    expect(ids).toContain('nav.leave.karaoke')
    // The set it used to be registered beside, still there.
    expect(ids).toContain('nav.voiceHelp')
  })

  it('answers the phrases a singer would actually say', () => {
    render(() => <KaraokeNightApp />)

    for (const utterance of ['go home', 'back to the studio', 'go to singing'])
      expect(
        matchVoiceCommand(utterance, activeVoiceCommands()),
        utterance,
      ).not.toBeNull()
  })
})

// ============================================================
// Link parameters: zen=1 and an unknown song (REQ-SKL-012, REQ-SKL-013)
// ============================================================

describe('KaraokeNightApp link parameters', () => {
  it('opens the zen stage on a desktop for zen=1', () => {
    window.history.replaceState({}, '', '/karaoke-night?zen=1')
    render(() => <KaraokeNightApp />)
    expect(karaokeZen()).toBe(true)
  })

  it('changes nothing on a phone, which is always zen', () => {
    viewport.narrow = true
    window.history.replaceState({}, '', '/karaoke-night?zen=1')
    render(() => <KaraokeNightApp />)
    expect(karaokeZen()).toBe(false)
  })

  it('leaves zen off without the parameter', () => {
    window.history.replaceState({}, '', '/karaoke-night')
    render(() => <KaraokeNightApp />)
    expect(karaokeZen()).toBe(false)
  })

  it('takes zen=1 out of the address when the visitor leaves zen', () => {
    window.history.replaceState({}, '', '/karaoke-night?song=josephine&zen=1')
    render(() => <KaraokeNightApp />)
    expect(window.location.search).toContain('zen=1')

    setKaraokeZen(false)

    expect(window.location.search).not.toContain('zen')
  })

  it('drops a song nobody published and opens the page as usual', async () => {
    window.history.replaceState({}, '', '/karaoke-night?song=not-a-song&zen=1')
    render(() => <KaraokeNightApp />)

    await waitFor(() => expect(window.location.search).toBe('?zen=1'))
    expect(
      screen.getByRole('heading', { name: 'Your stage is set' }),
    ).toBeInTheDocument()
  })
})
