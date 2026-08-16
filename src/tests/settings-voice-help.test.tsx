// ============================================================
// Settings — the voice-command list is reachable from the app
// (CLAUDE-JOURNEY-021)
// ============================================================
//
// The Voice Control section used to close with "The full phrase list
// lives in docs/VOICE-COMMANDS.md" — a repository path a user cannot
// open. The app has a live command center (VoiceCommandsOverlay,
// generated from the registry); Settings must point at that, and offer
// a button that opens it through the same registered command the spoken
// phrase uses, so the wiring can never drift from what actually works.

import { fireEvent, render, screen } from '@solidjs/testing-library'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SettingsPanel } from '@/components/SettingsPanel'
import { registerVoiceCommands } from '@/features/voice-control/voice-command-registry'
import { notifications, setNotifications } from '@/stores/notifications-store'

function openSingingTab(): HTMLElement {
  const { container } = render(() => <SettingsPanel />)
  fireEvent.click(screen.getByTestId('settings-tab-singing'))
  return container
}

describe('Settings voice-control help', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('no longer points users at a repository path', () => {
    const container = openSingingTab()
    expect(container.textContent).not.toContain('docs/VOICE-COMMANDS.md')
  })

  it('opens the live command list through the registered command', () => {
    const run = vi.fn(() => 'Voice commands')
    const unregister = registerVoiceCommands(() => [
      {
        id: 'nav.voiceHelp',
        label: 'Voice commands',
        phrases: ['what can i say'],
        run,
      },
    ])
    try {
      const container = openSingingTab()
      const button = container.querySelector<HTMLButtonElement>(
        '[data-testid="settings-voice-commands"]',
      )
      expect(button).not.toBeNull()
      fireEvent.click(button!)
      expect(run).toHaveBeenCalledTimes(1)
    } finally {
      unregister()
    }
  })

  it('falls back to naming the routes when no command is registered', () => {
    // SettingsPanel can render outside App (tests, storybook-style probes);
    // the button then explains the spoken and keyboard routes instead of
    // silently doing nothing.
    setNotifications([])
    const container = openSingingTab()
    fireEvent.click(
      container.querySelector('[data-testid="settings-voice-commands"]')!,
    )
    expect(
      notifications().some((n) => n.message.includes('what can I say')),
    ).toBe(true)
  })

  it('tells the singer the spoken and keyboard routes as well', () => {
    const container = openSingingTab()
    const text = container.textContent ?? ''
    expect(text).toContain('what can I say')
    expect(text).toContain('Shift+V')
  })
})
