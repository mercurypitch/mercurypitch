import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AdminExercisesPage } from '@/features/admin/AdminExercisesPage'

const serviceMocks = vi.hoisted(() => ({
  archiveGuidedExercise: vi.fn(),
  cloneGuidedExerciseDraft: vi.fn(),
  createGuidedExercise: vi.fn(),
  listAdminGuidedExercises: vi.fn(),
  publishGuidedExercise: vi.fn(),
  saveGuidedExerciseDraft: vi.fn(),
  uploadGuidedExerciseMedia: vi.fn(),
  validateGuidedExerciseDraft: vi.fn(),
}))

vi.mock('@/features/zen/guided-exercise-service', () => serviceMocks)

describe('AdminExercisesPage starter publication', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal(
      'confirm',
      vi.fn(() => false),
    )
    serviceMocks.listAdminGuidedExercises.mockResolvedValue({
      ok: true,
      data: [],
    })
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('confirms that the empty-catalogue action publishes immutable versions', async () => {
    render(() => <AdminExercisesPage adminKey="owner-key" />)

    const action = await screen.findByRole('button', {
      name: 'Publish starter set',
    })
    fireEvent.click(action)

    expect(confirm).toHaveBeenCalledWith(
      expect.stringMatching(
        /creates immutable published version 1 for each starter/i,
      ),
    )
    expect(serviceMocks.createGuidedExercise).not.toHaveBeenCalled()
  })
})
