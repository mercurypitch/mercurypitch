// ============================================================
// The admin form refuses a target list it could not read in full
// ============================================================
//
// `notesToMelodyItems` drops any token it cannot parse, and `save()` only
// checked that *something* survived. Paste six notes with one bad spelling —
// a unicode "B♭4" copied out of a score, say — and five were saved, silently,
// and the Legend shipped a note short with nothing on screen to say so.

import { cleanup, fireEvent, render, screen, waitFor, } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as WeeklyService from '@/features/challenges/weekly-service'

const saved: Array<Record<string, unknown>> = []
const notes: Array<{ message: string; kind: string }> = []
let rows: Array<Record<string, unknown>> = []

vi.mock('@/features/challenges/weekly-service', async (importOriginal) => {
  // The parser is the subject — only the network edges are stubbed.
  const actual = await importOriginal<typeof WeeklyService>()
  return {
    ...actual,
    getAdminKey: () => 'test-key',
    setAdminKey: () => {},
    listAllWeekly: () => Promise.resolve(rows),
    deleteWeekly: () => Promise.resolve(true),
    createWeekly: (payload: Record<string, unknown>) => {
      saved.push(payload)
      return Promise.resolve({ id: 'new' })
    },
    updateWeekly: (_id: string, patch: Record<string, unknown>) => {
      saved.push(patch)
      return Promise.resolve(true)
    },
  }
})

vi.mock('@/stores/notifications-store', () => ({
  showNotification: (message: string, kind: string) => {
    notes.push({ message, kind })
  },
}))

const { AdminWeeklyPage } =
  await import('@/features/challenges/AdminWeeklyPage')

beforeEach(() => {
  saved.length = 0
  notes.length = 0
  rows = [
    {
      id: 'x',
      slug: 'ave-maria',
      title: 'Ave Maria',
      description: '',
      featType: 'sustain',
      difficulty: 'intermediate',
      targetItems: '[]',
      targetScore: 80,
      hearItUrl: null,
      startsAt: '2026-08-17T00:00:00.000Z',
      endsAt: '2026-08-24T00:00:00.000Z',
      rewardBadgeId: null,
      founderScore: null,
      evergreen: 0,
      status: 'draft',
    },
  ]
})

afterEach(() => {
  cleanup()
})

async function openFormWithNotes(value: string): Promise<void> {
  render(() => <AdminWeeklyPage />)
  const edit = await screen.findAllByText('Edit')
  fireEvent.click(edit[0])
  const field = await screen.findByPlaceholderText(
    'Space or comma separated note names',
  )
  fireEvent.input(field, { target: { value } })
}

describe('target-note validation in the admin form', () => {
  it('refuses to save a list with an unreadable note, and names it', async () => {
    await openFormWithNotes('Bb4 H4 D5')

    fireEvent.click(screen.getByText('Save'))

    await waitFor(() => expect(notes.length).toBeGreaterThan(0))
    expect(notes[0].kind).toBe('error')
    expect(notes[0].message).toContain('H4')
    // The whole point: a partial melody must not reach the API.
    expect(saved).toEqual([])
  })

  it('saves a list it reads in full', async () => {
    await openFormWithNotes('Bb4 A4 Bb4 D5 C5 Bb4')

    fireEvent.click(screen.getByText('Save'))

    await waitFor(() => expect(saved.length).toBe(1))
    expect(
      (saved[0].targetItems as Array<{ note: { midi: number } }>).map(
        (i) => i.note.midi,
      ),
    ).toEqual([70, 69, 70, 74, 72, 70])
  })

  it('still asks for notes when the field is empty', async () => {
    await openFormWithNotes('   ')

    fireEvent.click(screen.getByText('Save'))

    await waitFor(() => expect(notes.length).toBeGreaterThan(0))
    expect(notes[0].message).toContain('Enter target notes')
    expect(saved).toEqual([])
  })
})
