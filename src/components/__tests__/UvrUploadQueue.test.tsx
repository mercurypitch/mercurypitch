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

describe('UvrUploadQueue terminal actions', () => {
  it('offers Close instead of a dead cancel action once every row is terminal', () => {
    const onClear = vi.fn()
    render(() => (
      <UvrUploadQueue
        items={() => [cancelledSong()]}
        running={() => true}
        mode={() => 'local'}
        onStart={vi.fn()}
        onRemove={vi.fn()}
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
        onCancel={vi.fn()}
        onClear={vi.fn()}
      />
    ))

    expect(screen.getByRole('button', { name: /done/i })).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /close/i }),
    ).not.toBeInTheDocument()
  })
})
