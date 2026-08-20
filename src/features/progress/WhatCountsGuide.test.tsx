// The guide's job is to answer four questions people actually asked.
// ============================================================

import { cleanup, render, screen } from '@solidjs/testing-library'
import { afterEach, describe, expect, it } from 'vitest'
import { RUN_KINDS } from './run-kinds'
import { WhatCountsGuide } from './WhatCountsGuide'

afterEach(cleanup)

describe('WhatCountsGuide', () => {
  it('names every run kind the app can record', () => {
    render(() => <WhatCountsGuide />)
    for (const meta of RUN_KINDS) {
      expect(screen.getByText(meta.label)).toBeInTheDocument()
      expect(screen.getByText(meta.blurb)).toBeInTheDocument()
    }
  })

  it('says which kinds are ranked and which are not', () => {
    // The pills show a count and nothing else, so this is the only place
    // that explains why a practice run never reaches a leaderboard.
    render(() => <WhatCountsGuide />)
    expect(screen.getAllByText('Ranked')).toHaveLength(
      RUN_KINDS.filter((meta) => meta.ranked).length,
    )
    expect(screen.getAllByText('Not ranked')).toHaveLength(
      RUN_KINDS.filter((meta) => !meta.ranked).length,
    )
  })

  it('explains that signed-out counts are per device and per site', () => {
    render(() => <WhatCountsGuide />)
    expect(
      screen.getByText(/runs done on the dev site are not the same pile/i),
    ).toBeInTheDocument()
  })

  it('separates setlists and melodies from runs', () => {
    render(() => <WhatCountsGuide />)
    expect(
      screen.getByText(/never appear in your run totals/i),
    ).toBeInTheDocument()
  })

  it('explains an empty trend without implying the runs were lost', () => {
    render(() => <WhatCountsGuide />)
    expect(
      screen.getByText(/if a run happened, it is in the number/i),
    ).toBeInTheDocument()
  })

  it('lends its heading to a dialog that needs to be labelled by it', () => {
    render(() => <WhatCountsGuide headingId="guide-title" />)
    expect(screen.getByRole('heading', { level: 2 })).toHaveAttribute(
      'id',
      'guide-title',
    )
  })

  it('leaves the heading unlabelled where nothing needs to point at it', () => {
    render(() => <WhatCountsGuide />)
    expect(screen.getByRole('heading', { level: 2 })).not.toHaveAttribute('id')
  })
})
