// ============================================================
// An earned milestone must never look like a locked one
// ============================================================
//
// Reported from the Progress tab: "I have achievement 10 Notes, earned that
// and that date, and the image is empty orb."
//
// It is not a locked state — the shelf lists only earned milestones
// (`model.ts` skips anything with `unlocked !== true`). It is a missing
// fallback. `badgeArtSrc` knows exactly the sixteen BADGE icons, each with a
// `public/badges/<icon>.webp`; the 59 seeded achievements draw from a much
// larger vocabulary, so most of them resolve to no art at all and were
// rendering as a nameless dark disc.
//
// `badge-art.ts` already promises the way out in its own header — "Any icon
// without art falls back to the SVG glyph, so seeding a new badge is never
// blocked on generating a picture for it" — and `ProfileView` and
// `VocalChallenges` both honour it. The Progress shelf did not.

import { render, screen } from '@solidjs/testing-library'
import { cleanup } from '@solidjs/testing-library'
import { afterEach, describe, expect, it } from 'vitest'
import { iconByName } from '@/components/hidden-features-icons'
import seed from '@/db/seed-data.json'
import { badgeArtSrc } from '@/features/challenges/badge-art'
import { snapshot } from './progress-snapshot.fixture'
import type { ProgressMilestoneView, ProgressPageSnapshot, } from './ProgressPage'
import { ProgressPage } from './ProgressPage'

interface SeedDefinition {
  name: string
  icon: string
}

const achievements = (seed as { achievementDefinitions: SeedDefinition[] })
  .achievementDefinitions

describe('the seeded achievements against the badge art set', () => {
  it('mostly have no medallion, which is why the fallback matters', () => {
    const withoutArt = achievements.filter(
      (row) => badgeArtSrc(row.icon) === undefined,
    )
    // Not a threshold to chase — a statement of the situation this fixes.
    // If art is drawn for these later the number drops and the test says so.
    expect(withoutArt.length).toBeGreaterThan(achievements.length / 2)
  })

  it('names "10 Notes" as one of them, which is the reported case', () => {
    const tenNotes = achievements.find((row) => row.name === '10 Notes')
    expect(tenNotes).toBeDefined()
    expect(badgeArtSrc(tenNotes?.icon)).toBeUndefined()
  })

  it('every one of them still resolves to a real glyph', () => {
    // This is why no image generation is needed to stop the empty orb.
    for (const row of achievements) {
      expect(typeof iconByName(row.icon)).toBe('function')
    }
  })
})

function snapshotWith(
  milestones: readonly ProgressMilestoneView[],
): ProgressPageSnapshot {
  return { ...snapshot(), milestones }
}

function mount(milestone: ProgressMilestoneView): void {
  render(() => (
    <ProgressPage status="ready" snapshot={snapshotWith([milestone])} />
  ))
}

function shelfObject(): Element {
  const shelf = screen.getByRole('list', { name: /Earned milestones/ })
  const object = shelf.querySelector('li > div')
  if (object === null) throw new Error('no milestone object rendered')
  return object
}

describe('a milestone with no drawn medallion', () => {
  afterEach(cleanup)

  it('shows its glyph instead of a nameless empty disc', () => {
    mount({
      id: 'achievement:ten-notes',
      title: '10 Notes',
      kindLabel: 'Achievement',
      earnedAtLabel: 'Earned August 12',
      detail: 'Sang ten notes.',
      icon: 'paper',
    })

    expect(shelfObject().querySelector('svg')).not.toBeNull()
    expect(shelfObject().querySelector('img')).toBeNull()
  })

  it('falls to the generic badge when the icon name is unknown', () => {
    // `iconByName` returns IconBadge rather than the name itself: three
    // seeded achievements once printed the words "layers", "calendar" and
    // "check" across the page in 3rem grey.
    mount({
      id: 'achievement:mystery',
      title: 'Mystery',
      kindLabel: 'Achievement',
      earnedAtLabel: 'Earned August 12',
      detail: 'Something happened.',
      icon: 'not-a-real-icon',
    })

    const object = shelfObject()
    expect(object.querySelector('svg')).not.toBeNull()
    expect(object.textContent).toBe('')
  })

  it('survives a milestone carrying no icon at all', () => {
    mount({
      id: 'badge:old',
      title: 'From before icons',
      kindLabel: 'Badge',
      earnedAtLabel: 'Earned August 1',
      detail: 'A row with no icon field.',
    })

    expect(shelfObject().querySelector('svg')).not.toBeNull()
  })
})

describe('a milestone that does have a medallion', () => {
  afterEach(cleanup)

  it('still shows the picture, not the glyph', () => {
    mount({
      id: 'badge:steady',
      title: 'Steady Return',
      kindLabel: 'Badge',
      earnedAtLabel: 'Earned August 7',
      detail: 'Practised in four consecutive weeks.',
      icon: 'leaf',
      artUrl: '/badges/leaf.webp',
    })

    const object = shelfObject()
    expect(object.querySelector('img')?.getAttribute('src')).toBe(
      '/badges/leaf.webp',
    )
    expect(object.querySelector('svg')).toBeNull()
  })
})
