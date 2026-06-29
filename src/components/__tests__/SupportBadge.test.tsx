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

  it('links the heart to the Ko-fi support page in a new tab', () => {
    render(() => <SupportBadge />)
    const link = screen.getByRole('link', { name: /support mercurypitch/i })
    expect(link).toHaveAttribute('href', 'https://ko-fi.com/chaosmatters')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link.getAttribute('rel') ?? '').toContain('noopener')
  })
})
