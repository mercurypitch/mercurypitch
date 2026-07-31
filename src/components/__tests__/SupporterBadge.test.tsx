// ============================================================
// SupporterBadge component tests
// ============================================================

import { render, screen } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { describe, expect, it } from 'vitest'
import { SupporterBadge } from '@/components/billing/SupporterBadge'

describe('SupporterBadge', () => {
  it('names the tier from the DB label', () => {
    render(() => (
      <SupporterBadge planId="sup-voice" label="Voice" expiresAt={null} />
    ))
    expect(screen.getByTestId('supporter-badge').textContent).toContain(
      'Voice supporter',
    )
  })

  // The visual treatment is keyed to the tier, so the hook must survive.
  it('tags the tier so each level can look different', () => {
    render(() => (
      <SupporterBadge planId="sup-extras" label="Extras" expiresAt={null} />
    ))
    expect(screen.getByTestId('supporter-badge')).toHaveAttribute(
      'data-tier',
      'sup-extras',
    )
  })

  // A grant we can't name is still a grant — never render a blank badge.
  it('falls back to plain "Supporter" for an unknown tier', () => {
    render(() => <SupporterBadge planId={null} label={null} expiresAt={null} />)
    const badge = screen.getByTestId('supporter-badge')
    expect(badge.textContent).toContain('Supporter')
    expect(badge.textContent).not.toContain('null')
    expect(badge).toHaveAttribute('data-tier', 'unknown')
  })

  it('puts the expiry in the tooltip', () => {
    render(() => (
      <SupporterBadge
        planId="sup-fund"
        label="Fund"
        expiresAt="2027-07-23T00:00:00.000Z"
      />
    ))
    const title = screen.getByTestId('supporter-badge').getAttribute('title')
    expect(title).toContain('Fund supporter until')
    // Cross-year expiry must carry the year — "23 Jul" alone reads as past.
    expect(title).toContain('2027')
  })

  it('renders the expiry inline in verbose form', () => {
    render(() => (
      <SupporterBadge
        planId="sup-voice"
        label="Voice"
        expiresAt="2027-07-23T00:00:00.000Z"
        verbose
      />
    ))
    const text = screen.getByTestId('supporter-badge-verbose').textContent ?? ''
    expect(text).toContain('Voice supporter')
    expect(text).toContain('2027')
    expect(text).toContain('Thank you.')
  })

  // Regression: the icon used to be a child component, so Solid ran it once and
  // it kept the tier it mounted with. Upgrading Chime → Anthem in place then
  // relabelled the badge while leaving the old glyph beside it.
  it('swaps the icon when the tier changes in place', () => {
    const [tier, setTier] = createSignal('sup-fund')
    render(() => (
      <SupporterBadge planId={tier()} label="Chime" expiresAt={null} />
    ))
    const iconPath = (): string =>
      screen
        .getByTestId('supporter-badge')
        .querySelector('path')
        ?.getAttribute('d') ?? ''
    const chime = iconPath()
    expect(chime).not.toBe('')

    setTier('sup-voice')
    expect(screen.getByTestId('supporter-badge')).toHaveAttribute(
      'data-tier',
      'sup-voice',
    )
    expect(iconPath()).not.toBe(chime)
  })

  it('omits the "until" clause when the grant has no expiry', () => {
    render(() => (
      <SupporterBadge planId="sup-fund" label="Fund" expiresAt={null} verbose />
    ))
    const text = screen.getByTestId('supporter-badge-verbose').textContent ?? ''
    expect(text).toContain('Thank you.')
    expect(text).not.toContain('until')
  })
})
