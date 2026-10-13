// ============================================================
// SessionMiniTimeline tests — rest labels in saved session previews
// ============================================================

import { render, screen } from '@solidjs/testing-library'
import { describe, expect, it } from 'vitest'
import { SessionMiniTimeline } from './SessionMiniTimeline'

describe('SessionMiniTimeline — rest labels', () => {
  it.each([
    [500, '0.5s'],
    [59600, '1m'],
    [undefined, '2s'],
  ])('displays a %s ms rest as "%s"', (restMs, label) => {
    render(() => (
      <SessionMiniTimeline
        session={{
          id: 'session',
          name: 'Practice',
          deletable: true,
          created: 0,
          items: [
            { id: 'rest', type: 'rest', label: 'Rest', startBeat: 0, restMs },
          ],
        }}
      />
    ))

    expect(screen.getByRole('listitem')).toHaveTextContent(label)
    expect(screen.getByRole('listitem')).toHaveAttribute('title', `1. ${label}`)
    expect(screen.getByText(label)).toBeVisible()
  })
})
