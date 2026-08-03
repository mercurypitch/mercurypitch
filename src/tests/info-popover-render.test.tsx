// The trigger used to be the literal character "i", set in italic. A text
// glyph is centred by its line box rather than its ink, so it sat off-centre
// in a round 20px button, and the slant pushed it further right. It is now
// the shared <Info /> SVG, drawn symmetrically about the viewBox centre.
//
// These tests pin the two halves of that: the glyph is drawn, not typed, and
// the panel still opens and closes.

import { cleanup, render, screen } from '@solidjs/testing-library'
import { afterEach, describe, expect, it } from 'vitest'
import { InfoPopover } from '@/components/InfoPopover'

describe('InfoPopover', () => {
  afterEach(cleanup)

  it('draws the glyph rather than typing it', () => {
    const { getByRole } = render(() => (
      <InfoPopover label="How the streak works">
        Sing for 5 minutes.
      </InfoPopover>
    ))
    const trigger = getByRole('button', { name: 'How the streak works' })
    expect(trigger.querySelector('svg')).not.toBeNull()
    // No text node: a typed "i" is what slanted and sat off-centre.
    expect(trigger.textContent).toBe('')
  })

  it('keeps the label on the button, since the glyph says nothing', () => {
    const { getByRole } = render(() => (
      <InfoPopover label="How today's session is chosen">
        Four segments.
      </InfoPopover>
    ))
    const trigger = getByRole('button', {
      name: "How today's session is chosen",
    })
    expect(trigger.querySelector('svg')?.getAttribute('aria-hidden')).toBe(
      'true',
    )
  })

  it('opens on click and closes on Escape', () => {
    // screen, not the render container: the panel portals to <body> so no
    // card's overflow can clip it, which puts it outside the container.
    const { getByRole } = render(() => (
      <InfoPopover label="How the streak works">
        Sing for 5 minutes.
      </InfoPopover>
    ))
    const trigger = getByRole('button', { name: 'How the streak works' })
    expect(screen.queryByRole('tooltip')).toBeNull()

    trigger.click()
    expect(screen.getByRole('tooltip').textContent).toContain(
      'Sing for 5 minutes',
    )
    expect(trigger.getAttribute('aria-expanded')).toBe('true')

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(screen.queryByRole('tooltip')).toBeNull()
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
  })
})
