// ============================================================
// SettingsScreen tests — the help and privacy rows open the public pages
// ============================================================
import { render, screen } from '@solidjs/testing-library'
import { describe, expect, it } from 'vitest'
import { LocaleProvider } from '@/i18n/context'
import { SettingsScreen } from './SettingsScreen'

function noop(): void {}

const SUPPORT_URL = 'https://about.besidecue.com/support/'
const PRIVACY_NOTICE_URL = 'https://about.besidecue.com/privacy/'

const base = {
  paused: false,
  voiceEnabled: true,
  resetArmed: false,
  schedulePending: false,
  onBack: noop,
  onPauseToggle: noop,
  onVoiceToggle: noop,
  onReplayIntroduction: noop,
  onReplace: noop,
  onSetSchedule: noop,
  onDisableSchedule: noop,
  onReset: noop,
}

describe('settings screen', () => {
  it('links Support and the Privacy notice to the public pages in a new tab', () => {
    render(() => <SettingsScreen {...base} />)

    const support = screen.getByRole('link', { name: /^Support/ })
    const privacy = screen.getByRole('link', { name: /^Privacy notice/ })
    expect(support).toHaveAttribute('href', SUPPORT_URL)
    expect(privacy).toHaveAttribute('href', PRIVACY_NOTICE_URL)
    for (const link of [support, privacy]) {
      // A new browsing context, and never a window.opener back into the app.
      expect(link).toHaveAttribute('target', '_blank')
      expect(link.getAttribute('rel')).toMatch(/\bnoopener\b/)
      expect(link).toHaveClass('settings-row')
    }
    expect(
      screen.getByRole('heading', { name: 'Help and privacy' }),
    ).toBeInTheDocument()
  })

  it('translates the rows with the interface language and keeps the addresses', () => {
    render(() => (
      <LocaleProvider locale="de" onLocaleChange={noop}>
        <SettingsScreen {...base} />
      </LocaleProvider>
    ))

    expect(screen.getByRole('link', { name: /^Hilfe/ })).toHaveAttribute(
      'href',
      SUPPORT_URL,
    )
    expect(
      screen.getByRole('link', { name: /^Datenschutzhinweis/ }),
    ).toHaveAttribute('href', PRIVACY_NOTICE_URL)
    expect(
      screen.getByRole('heading', { name: 'Hilfe und Datenschutz' }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /^Support/ })).toBeNull()
  })
})
