// ============================================================
// SupportBadge Component Tests
// ============================================================

import { render, screen } from '@solidjs/testing-library'
import { describe, expect, it } from 'vitest'
import { APP_VERSION } from '@/lib/defaults'
import { SupportBadge } from '../SupportBadge'

describe('SupportBadge', () => {
  it('shows the running app version', () => {
    render(() => <SupportBadge />)
    expect(screen.getByText(`v${APP_VERSION}`)).toBeInTheDocument()
  })

  // The heart used to leave the app for Ko-fi. Every support option (tiers,
  // Ko-fi, Sponsors) now lives in Settings → Credits, so it routes in-app and
  // must NOT open a new tab.
  it('points the heart at the in-app support surface', () => {
    render(() => <SupportBadge />)
    const link = screen.getByRole('link', { name: /support mercurypitch/i })
    expect(link).toHaveAttribute('href', '#/settings/credits')
    expect(link).not.toHaveAttribute('target')
  })
})
