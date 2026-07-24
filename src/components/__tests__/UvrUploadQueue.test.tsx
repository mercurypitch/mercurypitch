import { fireEvent, render, screen } from '@solidjs/testing-library'
import { describe, expect, it, vi } from 'vitest'
import type { UvrUploadQueueItem } from '@/lib/uvr-upload-queue'
import { UvrUploadQueue } from '../UvrUploadQueue'

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
