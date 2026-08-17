// ============================================================
// SettingsPanel — tabbed grouping tests
// ============================================================

import { fireEvent, render, screen } from '@solidjs/testing-library'
import { describe, expect, it } from 'vitest'
import { SettingsPanel } from '@/components/SettingsPanel'

describe('SettingsPanel tabs', () => {
  it('defaults to the Account tab and switches between tabs', () => {
    render(() => <SettingsPanel />)

    // Account & App (default): account section shown, others hidden.
    expect(screen.getByText('Account')).toBeInTheDocument()
    expect(screen.getByText('About MercuryPitch')).toBeInTheDocument()
    expect(screen.queryByText('Sensitivity Presets')).not.toBeInTheDocument()
    expect(screen.queryByText('Appearance')).not.toBeInTheDocument()

    // Singing tab: pitch/audio sections shown, account hidden.
    fireEvent.click(screen.getByTestId('settings-tab-singing'))
    expect(screen.getByText('Sensitivity Presets')).toBeInTheDocument()
    expect(screen.getByText('Playback Speed')).toBeInTheDocument()
    expect(screen.queryByText('Account')).not.toBeInTheDocument()
    expect(screen.queryByText('Appearance')).not.toBeInTheDocument()

    // Display & Controls tab: appearance/visibility/keyboard shown.
    fireEvent.click(screen.getByTestId('settings-tab-display'))
    expect(screen.getByText('Appearance')).toBeInTheDocument()
    expect(screen.getByText('Keyboard Shortcuts')).toBeInTheDocument()
    expect(screen.queryByText('Sensitivity Presets')).not.toBeInTheDocument()
  })
})

describe('the sub-tab strip on a narrow screen', () => {
  it('scrolls the selected tab into view when one is chosen for you', async () => {
    // The strip scrolls horizontally on a phone. Tapping the header heart
    // deep-links to Credits — the last tab — and the strip used to stay
    // wherever it was, so the tab that had just been selected was off screen
    // and the jump looked like it had failed.
    const scrolls: Element[] = []
    const original = Element.prototype.scrollIntoView
    Element.prototype.scrollIntoView = function scrollIntoView(this: Element) {
      scrolls.push(this)
    }

    const frames: FrameRequestCallback[] = []
    const originalRaf = globalThis.requestAnimationFrame
    globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => {
      frames.push(cb)
      return 0
    }) as typeof globalThis.requestAnimationFrame

    try {
      render(() => <SettingsPanel />)
      fireEvent.click(screen.getByTestId('settings-tab-credits'))
      for (const frame of frames.splice(0)) frame(0)

      const scrolled = scrolls.at(-1)
      expect(scrolled).toBeDefined()
      expect(scrolled?.getAttribute('data-testid')).toBe('settings-tab-credits')
    } finally {
      Element.prototype.scrollIntoView = original
      globalThis.requestAnimationFrame = originalRaf
    }
  })
})
