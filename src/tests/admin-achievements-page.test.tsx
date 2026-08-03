// ============================================================
// The Content Studio's achievements page has one job beyond CRUD
// ============================================================
//
// Progress is granted by matching an achievement's NAME against a measure
// table in badge-grant-engine.ts. A row whose name is not in that table
// renders perfectly and never unlocks for anybody — no error, no log, no
// failing test. Since the point of this page is letting the owner add rows
// by hand, the warning is the feature; these tests hold it in place.

import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Achievement } from '@/db/entities'
import { AdminAchievementsPage } from '@/features/admin/AdminAchievementsPage'

const serviceMocks = vi.hoisted(() => ({
  listAchievements: vi.fn(),
  createAchievement: vi.fn(),
  updateAchievement: vi.fn(),
  deleteAchievement: vi.fn(),
}))

vi.mock('@/features/admin/achievements-admin-service', () => serviceMocks)

const row = (over: Partial<Achievement>): Achievement => ({
  id: 'a1',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  name: 'First Note',
  description: 'Finish your first session',
  icon: 'medal',
  points: 10,
  condition: 'sessions >= 1',
  required: 1,
  sortOrder: 0,
  category: 'beginnings',
  ...over,
})

describe('AdminAchievementsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    serviceMocks.listAchievements.mockResolvedValue([])
  })

  afterEach(() => {
    cleanup()
  })

  it('flags rows the grant engine cannot measure', async () => {
    serviceMocks.listAchievements.mockResolvedValue([
      row({ id: 'a1', name: 'First Note' }),
      row({ id: 'a2', name: 'Totally Invented Name' }),
    ])
    render(() => <AdminAchievementsPage adminKey="owner-key" />)

    // One of the two, named specifically — a count of "2" would mean the
    // measurable one was flagged too.
    const warning = await screen.findByText(/1 achievement has/i)
    expect(warning.textContent).toMatch(/no measure/i)
  })

  it('says nothing when every row is measurable', async () => {
    serviceMocks.listAchievements.mockResolvedValue([
      row({ id: 'a1', name: 'First Note' }),
    ])
    render(() => <AdminAchievementsPage adminKey="owner-key" />)

    await screen.findByText('First Note')
    expect(screen.queryByText(/no measure/i)).toBeNull()
  })

  it('refuses a zero target rather than writing a divide-by-zero row', async () => {
    render(() => <AdminAchievementsPage adminKey="owner-key" />)

    fireEvent.click(
      await screen.findByRole('button', { name: /new achievement/i }),
    )
    fireEvent.input(screen.getByPlaceholderText('First Note'), {
      target: { value: 'First Note' },
    })
    fireEvent.input(screen.getByLabelText(/target/i), {
      target: { value: '0' },
    })
    fireEvent.click(screen.getByRole('button', { name: /create achievement/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/at least 1/i)
    expect(serviceMocks.createAchievement).not.toHaveBeenCalled()
  })

  it('refuses a name another achievement already uses', async () => {
    serviceMocks.listAchievements.mockResolvedValue([
      row({ id: 'a1', name: 'First Note' }),
    ])
    render(() => <AdminAchievementsPage adminKey="owner-key" />)

    fireEvent.click(
      await screen.findByRole('button', { name: /new achievement/i }),
    )
    fireEvent.input(screen.getByPlaceholderText('First Note'), {
      target: { value: 'First Note' },
    })
    fireEvent.click(screen.getByRole('button', { name: /create achievement/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/already uses/i)
    expect(serviceMocks.createAchievement).not.toHaveBeenCalled()
  })

  it('sends the whole draft on create, trimmed', async () => {
    serviceMocks.createAchievement.mockResolvedValue(row({}))
    render(() => <AdminAchievementsPage adminKey="owner-key" />)

    fireEvent.click(
      await screen.findByRole('button', { name: /new achievement/i }),
    )
    fireEvent.input(screen.getByPlaceholderText('First Note'), {
      target: { value: '  First Note  ' },
    })
    fireEvent.click(screen.getByRole('button', { name: /create achievement/i }))

    await vi.waitFor(() => {
      expect(serviceMocks.createAchievement).toHaveBeenCalledWith(
        'owner-key',
        expect.objectContaining({
          name: 'First Note',
          category: 'beginnings',
          required: 1,
        }),
      )
    })
  })
})
