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
