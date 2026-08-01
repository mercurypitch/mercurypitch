import { fireEvent, render, screen } from '@solidjs/testing-library'
import { describe, expect, it, vi } from 'vitest'
import type { UvrUploadQueueItem } from '@/lib/uvr-upload-queue'
import { UvrUploadQueue } from '../UvrUploadQueue'

// The queue card derives its "full band" second step from the module-level
// split registry; stub it so tests can place a split on a session without
// running one.
const splitRegistry = vi.hoisted(() => ({
  value: {} as Record<
    string,
    { phase: 'uploading' | 'processing' | 'saving'; pct: number }
  >,
}))
vi.mock('@/lib/uvr-stem-split', () => ({
  activeStemSplits: () => splitRegistry.value,
}))

function cancelledSong(): UvrUploadQueueItem {
  return {
    id: 'cancelled-song',
    file: new File(['song'], 'cancelled.mp3', { type: 'audio/mpeg' }),
    status: 'cancelled',
    progress: 0,
    message: 'Cancelled',
  }
}

function song(
  id: string,
  name: string,
  status: UvrUploadQueueItem['status'],
): UvrUploadQueueItem {
  return {
    id,
    file: new File([name], name, { type: 'audio/mpeg' }),
    status,
    progress: status === 'processing' ? 42 : 0,
  }
}

describe('UvrUploadQueue controls and terminal states', () => {
  it('offers Close instead of a dead cancel action once every row is terminal', () => {
    const onClear = vi.fn()
    render(() => (
      <UvrUploadQueue
        items={() => [cancelledSong()]}
        running={() => true}
        mode={() => 'local'}
        onStart={vi.fn()}
        onRemove={vi.fn()}
        onSkip={vi.fn()}
        onSkipRemaining={vi.fn()}
        onCancel={vi.fn()}
        onRetryFailed={vi.fn()}
        onClear={onClear}
      />
    ))

    expect(
      screen.queryByRole('button', { name: /cancel current/i }),
    ).not.toBeInTheDocument()
    expect(screen.getByText('Processing cancelled')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /close/i }))
    expect(onClear).toHaveBeenCalledOnce()
  })

  it('keeps Done for a successfully completed batch', () => {
    render(() => (
      <UvrUploadQueue
        items={() => [
          {
            ...cancelledSong(),
            status: 'completed',
            progress: 100,
            message: 'Stems saved',
          },
        ]}
        running={() => false}
        mode={() => 'local'}
        onStart={vi.fn()}
        onRemove={vi.fn()}
        onSkip={vi.fn()}
        onSkipRemaining={vi.fn()}
        onCancel={vi.fn()}
        onRetryFailed={vi.fn()}
        onClear={vi.fn()}
      />
    ))

    expect(screen.getByRole('button', { name: /done/i })).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /close/i }),
    ).not.toBeInTheDocument()
  })

  it('lets a running batch skip one waiting song without cancelling the active song', () => {
    const onSkip = vi.fn()
    const onCancel = vi.fn()
    render(() => (
      <UvrUploadQueue
        items={() => [
          song('active', 'singing.mp3', 'processing'),
          song('waiting', 'encore.wav', 'queued'),
        ]}
        running={() => true}
        mode={() => 'server'}
        onStart={vi.fn()}
        onRemove={vi.fn()}
        onSkip={onSkip}
        onSkipRemaining={vi.fn()}
        onCancel={onCancel}
        onRetryFailed={vi.fn()}
        onClear={vi.fn()}
      />
    ))

    fireEvent.click(screen.getByRole('button', { name: 'Skip encore.wav' }))

    expect(onSkip).toHaveBeenCalledWith('waiting')
    expect(onCancel).not.toHaveBeenCalled()
  })

  it('offers to stop after the current song while other songs are waiting', () => {
    const onSkipRemaining = vi.fn()
    render(() => (
      <UvrUploadQueue
        items={() => [
          song('active', 'singing.mp3', 'processing'),
          song('waiting-1', 'encore.wav', 'queued'),
          song('waiting-2', 'finale.flac', 'queued'),
        ]}
        running={() => true}
        mode={() => 'local'}
        onStart={vi.fn()}
        onRemove={vi.fn()}
        onSkip={vi.fn()}
        onSkipRemaining={onSkipRemaining}
        onCancel={vi.fn()}
        onRetryFailed={vi.fn()}
        onClear={vi.fn()}
      />
    ))

    fireEvent.click(screen.getByRole('button', { name: /stop after current/i }))

    expect(onSkipRemaining).toHaveBeenCalledOnce()
    expect(
      screen.getByRole('button', { name: /cancel current/i }),
    ).toBeInTheDocument()
  })

  it('summarizes songs deliberately skipped by the user', () => {
    render(() => (
      <UvrUploadQueue
        items={() => [
          {
            ...song('completed', 'singing.mp3', 'completed'),
            progress: 100,
          },
          {
            ...song('omitted', 'encore.wav', 'omitted'),
            message: 'Skipped by you',
          },
        ]}
        running={() => false}
        mode={() => 'local'}
        onStart={vi.fn()}
        onRemove={vi.fn()}
        onSkip={vi.fn()}
        onSkipRemaining={vi.fn()}
        onCancel={vi.fn()}
        onRetryFailed={vi.fn()}
        onClear={vi.fn()}
      />
    ))

    expect(screen.getByText('1 added · 1 skipped')).toBeInTheDocument()
    expect(screen.getByText('Skipped by you')).toBeInTheDocument()
    expect(
      screen.getByText(
        'Stopped after the current song. Skipped songs were not processed.',
      ),
    ).toBeInTheDocument()
  })
})

describe('UvrUploadQueue background full-band split step', () => {
  const completedWithSession = (): UvrUploadQueueItem => ({
    ...song('done', 'singing.mp3', 'completed'),
    progress: 100,
    sessionId: 'session-9',
    message: 'Stems saved',
  })

  const renderQueue = (items: UvrUploadQueueItem[]) =>
    render(() => (
      <UvrUploadQueue
        items={() => items}
        running={() => false}
        mode={() => 'server'}
        onStart={vi.fn()}
        onRemove={vi.fn()}
        onSkip={vi.fn()}
        onSkipRemaining={vi.fn()}
        onCancel={vi.fn()}
        onRetryFailed={vi.fn()}
        onClear={vi.fn()}
      />
    ))

  it('surfaces the running part-split as a second step on the same card', () => {
    splitRegistry.value = { 'session-9': { phase: 'processing', pct: 41 } }
    renderQueue([completedWithSession()])

    // The card keeps its terminal state AND shows the split still working.
    expect(screen.getByText('In your library')).toBeInTheDocument()
    expect(screen.getByText('Separating full band 41%')).toBeInTheDocument()
  })

  it('labels the save phase of the split distinctly', () => {
    splitRegistry.value = { 'session-9': { phase: 'saving', pct: 60 } }
    renderQueue([completedWithSession()])

    expect(screen.getByText('Saving band stems 60%')).toBeInTheDocument()
  })

  it('shows no split step when none is running for the session', () => {
    splitRegistry.value = {}
    renderQueue([completedWithSession()])

    expect(screen.queryByText(/full band/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/band stems/i)).not.toBeInTheDocument()
  })
})
