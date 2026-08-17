// ============================================================
// Admin studio: a suspending section must not blank the panel
// ============================================================
//
// Owner report (2026-08-17): opening the Weekly section "always closed the
// whole admin panel and then reopened it" on a slow connection. Weekly is
// the only section that reads a resource during render (AdminWeeklyPage's
// `rows`), and the nearest Suspense used to be App's — wrapping the whole
// lazy studio with NO fallback — so the pending fetch detached the entire
// overlay until `/api/weekly/all` landed. The studio now carries its own
// boundary around the section body; these tests pin that the chrome stays
// put and the wait is shown inside the workspace.

import { fireEvent, render, screen, waitFor } from '@solidjs/testing-library'
import { createSignal, Suspense } from 'solid-js'
import { describe, expect, it, vi } from 'vitest'
import { AdminContentStudio } from '@/features/admin/AdminContentStudio'
import type { AdminSection } from '@/stores/ui-store'

vi.mock('@/features/challenges/weekly-service', () => {
  let calls = 0
  let resolveRows: (rows: unknown[]) => void = () => {}
  return {
    getAdminKey: () => 'studio-key',
    setAdminKey: () => {},
    // First call is the studio's auth probe — resolve at once so the
    // workspace unlocks. Every later call is AdminWeeklyPage's rows
    // resource, held pending until the test releases it.
    listAllWeekly: () => {
      calls += 1
      if (calls === 1) return Promise.resolve([])
      return new Promise<unknown[]>((resolve) => {
        resolveRows = resolve
      })
    },
    __resolveRows: (rows: unknown[]) => resolveRows(rows),
  }
})

// The sibling sections load their own data onMount; stubs keep this test
// about the studio's boundary, not four unrelated fetch paths.
// Each stub reads its adminKey so the studio's prop getters run.
vi.mock('@/features/admin/AdminExercisesPage', () => ({
  AdminExercisesPage: (p: { adminKey: string }) => (
    <div data-testid="stub-exercises">{p.adminKey}</div>
  ),
}))
vi.mock('@/features/admin/AdminAscentPage', () => ({
  AdminAscentPage: (p: { adminKey: string }) => (
    <div data-testid="stub-ascent">{p.adminKey}</div>
  ),
}))
vi.mock('@/features/admin/AdminAchievementsPage', () => ({
  AdminAchievementsPage: (p: { adminKey: string }) => (
    <div data-testid="stub-achievements">{p.adminKey}</div>
  ),
}))
vi.mock('@/features/admin/AdminDemoSongPage', () => ({
  AdminDemoSongPage: (p: { adminKey: string }) => (
    <div data-testid="stub-demo">{p.adminKey}</div>
  ),
}))
vi.mock('@/features/admin/AdminPremiumPerksPage', () => ({
  AdminPremiumPerksPage: (p: { adminKey: string }) => (
    <div data-testid="stub-perks">{p.adminKey}</div>
  ),
}))
vi.mock('@/features/zen/guided-content-store', () => ({
  refreshGuidedContent: vi.fn(),
}))

describe('AdminContentStudio section switching under a slow fetch', () => {
  it('keeps the studio chrome mounted while Weekly resolves', async () => {
    const [section, setSection] = createSignal<AdminSection>('exercises')

    render(() => (
      // Stands in for App's boundary around the lazy studio. Before the
      // studio grew its own, the weekly fetch suspended all the way up to
      // here and this fallback — i.e. a blank screen — replaced the panel.
      <Suspense fallback={<div data-testid="outer-fallback" />}>
        <AdminContentStudio
          section={section()}
          onNavigate={setSection}
          onClose={() => true}
        />
      </Suspense>
    ))

    // Auth probe resolves and the exercises section renders.
    await screen.findByTestId('stub-exercises')

    // Open Weekly — its rows resource is now pending.
    // The nav button's accessible name is its short label + description.
    fireEvent.click(screen.getByRole('button', { name: /^Weekly\b/ }))

    // The panel must NOT collapse to the outer fallback...
    await screen.findByRole('status')
    expect(screen.queryByTestId('outer-fallback')).toBeNull()
    // ...the chrome is still there...
    expect(
      screen.getByRole('heading', { level: 1, name: 'Content Studio' }),
    ).toBeTruthy()
    // ...and the wait is announced inside the workspace.
    expect(screen.getByRole('status').textContent).toContain(
      'Loading Weekly Challenges',
    )

    // Release the fetch: the section body arrives, the spinner leaves, and
    // the panel never unmounted.
    const svc =
      (await import('@/features/challenges/weekly-service')) as unknown as {
        __resolveRows: (rows: unknown[]) => void
      }
    svc.__resolveRows([])
    await waitFor(() => {
      expect(screen.queryByRole('status')).toBeNull()
    })
    expect(
      screen.getByRole('heading', { level: 1, name: 'Content Studio' }),
    ).toBeTruthy()

    // Every other section still opens in place, panel intact throughout.
    const rounds = [
      [/^Ascent\b/, 'stub-ascent'],
      [/^Achievements\b/, 'stub-achievements'],
      [/^Demo\b/, 'stub-demo'],
      [/^Perks\b/, 'stub-perks'],
      [/^Exercises\b/, 'stub-exercises'],
    ] as const
    for (const [name, testid] of rounds) {
      fireEvent.click(screen.getByRole('button', { name }))
      await screen.findByTestId(testid)
      expect(screen.queryByTestId('outer-fallback')).toBeNull()
    }
  })
})
