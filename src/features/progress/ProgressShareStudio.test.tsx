import { cleanup, fireEvent, render, screen, waitFor, } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ProgressShareStudio } from './ProgressShareStudio'
import type { ProgressShareExportStatus, ProgressShareMoment, } from './share-card'

const shareMocks = vi.hoisted(() => ({
  render: vi.fn(),
  export: vi.fn(),
}))

vi.mock('./share-card', () => ({
  DEFAULT_PROGRESS_SHARE_APPEARANCE: {
    backgroundExposure: 1.12,
    dataScrimOpacity: 0.62,
  },
  PROGRESS_SHARE_SIZES: {
    square: { width: 1080, height: 1080 },
    feed: { width: 1080, height: 1350 },
    story: { width: 1080, height: 1920 },
  },
  renderProgressShareCard: shareMocks.render,
  exportProgressShareCard: shareMocks.export,
}))

const moment: ProgressShareMoment = {
  claim: 'I came back four weeks in a row.',
  context: '13-week view, all recorded voice practice.',
  period: 'May–August 2026',
  handle: '@private-by-default',
  facts: [
    { value: '4 weeks', label: 'active in a row' },
    { value: '18', label: 'recorded attempts' },
    { value: '3 kinds', label: 'of voice practice' },
    { value: 'hidden', label: 'fourth fact' },
  ],
  trace: {
    description: 'Recorded pitch from the weekly challenge',
    points: [
      { time: 0, pitch: 60 },
      { time: 1, pitch: 62 },
    ],
  },
}

const sharedStatus: ProgressShareExportStatus = {
  outcome: 'shared',
  delivered: true,
  isError: false,
  role: 'status',
  live: 'polite',
  message: 'Progress card shared.',
}

const failedStatus: ProgressShareExportStatus = {
  outcome: 'failed',
  delivered: false,
  isError: true,
  role: 'alert',
  live: 'assertive',
  message: 'The progress card could not be exported. Please try again.',
}

function freshCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = 1080
  canvas.height = 1350
  canvas.setAttribute('role', 'img')
  canvas.setAttribute('aria-label', 'Rendered progress card')
  return canvas
}

function renderStudio(
  overrides: Partial<Parameters<typeof ProgressShareStudio>[0]> = {},
) {
  const props = {
    open: true,
    moment,
    onClose: vi.fn(),
    ...overrides,
  }
  return { props, ...render(() => <ProgressShareStudio {...props} />) }
}

afterEach(() => {
  cleanup()
  shareMocks.render.mockReset()
  shareMocks.export.mockReset()
})

describe('ProgressShareStudio', () => {
  it('renders nothing while closed', () => {
    renderStudio({ open: false })
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('opens as a labelled modal and mounts the exact default feed canvas', async () => {
    const canvas = freshCanvas()
    shareMocks.render.mockResolvedValue(canvas)

    renderStudio()

    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toHaveAttribute('aria-labelledby')
    expect(screen.getByRole('radio', { name: /feed/i })).toBeChecked()

    await waitFor(() => {
      expect(shareMocks.render).toHaveBeenCalledWith(
        expect.objectContaining({
          claim: moment.claim,
          handle: null,
        }),
        'feed',
        expect.objectContaining({
          backgroundExposure: 1.12,
          dataScrimOpacity: 0.62,
        }),
      )
    })
    expect(screen.getByTestId('progress-share-preview')).toContainElement(
      canvas,
    )
    expect(screen.getByText(/1080 × 1350/)).toBeInTheDocument()
  })

  it('keeps identity off even when supplied, then previews only explicit opt-in', async () => {
    shareMocks.render.mockImplementation(async () => freshCanvas())
    renderStudio({ initialHandle: '@aria' })

    await waitFor(() => expect(shareMocks.render).toHaveBeenCalled())
    const identitySwitch = screen.getByRole('switch', {
      name: /add my handle/i,
    })
    expect(identitySwitch).not.toBeChecked()
    expect(screen.queryByLabelText('Handle shown on card')).toBeNull()
    expect(shareMocks.render.mock.calls.at(-1)?.[0]).toMatchObject({
      handle: null,
    })

    fireEvent.click(identitySwitch)
    const handleInput = screen.getByLabelText('Handle shown on card')
    expect(handleInput).toHaveValue('@aria')

    await waitFor(() => {
      expect(shareMocks.render.mock.calls.at(-1)?.[0]).toMatchObject({
        handle: '@aria',
      })
    })

    fireEvent.input(handleInput, { target: { value: '@new-voice' } })
    await waitFor(() => {
      expect(shareMocks.render.mock.calls.at(-1)?.[0]).toMatchObject({
        handle: '@new-voice',
      })
    })
  })

  it('switches among story and square native previews', async () => {
    shareMocks.render.mockImplementation(async () => freshCanvas())
    renderStudio()
    await waitFor(() => expect(shareMocks.render).toHaveBeenCalled())

    fireEvent.click(screen.getByRole('radio', { name: /story/i }))
    await waitFor(() => {
      expect(shareMocks.render.mock.calls.at(-1)?.[1]).toBe('story')
    })
    expect(screen.getByText(/1080 × 1920/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('radio', { name: /square/i }))
    await waitFor(() => {
      expect(shareMocks.render.mock.calls.at(-1)?.[1]).toBe('square')
    })
    expect(screen.getByText(/1080 × 1080/)).toBeInTheDocument()
  })

  it('reviews only facts that the renderer can include and never edits evidence', async () => {
    shareMocks.render.mockResolvedValue(freshCanvas())
    renderStudio()
    await waitFor(() => expect(shareMocks.render).toHaveBeenCalled())

    expect(screen.getByText(moment.claim)).toBeInTheDocument()
    expect(
      screen.getByText('Recorded pitch from the weekly challenge'),
    ).toBeInTheDocument()
    expect(screen.getByText('4 weeks')).toBeInTheDocument()
    expect(screen.getByText('18')).toBeInTheDocument()
    expect(screen.getByText('3 kinds')).toBeInTheDocument()
    expect(screen.queryByText('hidden')).toBeNull()
    expect(screen.queryByDisplayValue(moment.claim)).toBeNull()
  })

  it('announces generation and reports the completed outcome', async () => {
    shareMocks.render.mockResolvedValue(freshCanvas())
    let resolveExport: ((status: ProgressShareExportStatus) => void) | undefined
    shareMocks.export.mockImplementation(
      () =>
        new Promise<ProgressShareExportStatus>((resolve) => {
          resolveExport = resolve
        }),
    )
    const onOutcome = vi.fn()
    renderStudio({ onOutcome })

    const exportButton = await screen.findByTestId('progress-share-export')
    await waitFor(() => expect(exportButton).not.toBeDisabled())
    fireEvent.click(exportButton)

    expect(screen.getByRole('dialog')).toHaveAttribute('aria-busy', 'true')
    expect(
      screen.getByText('Generating the full-resolution card…'),
    ).toHaveAttribute('aria-live', 'polite')
    expect(exportButton).toBeDisabled()

    resolveExport?.(sharedStatus)
    await waitFor(() => {
      expect(screen.getByText('Progress card shared.')).toBeInTheDocument()
    })
    expect(onOutcome).toHaveBeenCalledWith(sharedStatus)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(exportButton).toHaveTextContent('Share again')
  })

  it('invalidates in-flight delivery after unmount and ignores its late outcome', async () => {
    shareMocks.render.mockResolvedValue(freshCanvas())
    let resolveExport: ((status: ProgressShareExportStatus) => void) | undefined
    shareMocks.export.mockImplementation(
      () =>
        new Promise<ProgressShareExportStatus>((resolve) => {
          resolveExport = resolve
        }),
    )
    const onOutcome = vi.fn()
    const { unmount } = renderStudio({ onOutcome })

    const exportButton = await screen.findByTestId('progress-share-export')
    await waitFor(() => expect(exportButton).not.toBeDisabled())
    fireEvent.click(exportButton)
    await waitFor(() => expect(shareMocks.export).toHaveBeenCalledTimes(1))

    const shouldDeliver = shareMocks.export.mock.calls[0]?.[1]
      ?.shouldDeliver as (() => boolean) | undefined
    expect(shouldDeliver?.()).toBe(true)

    unmount()
    expect(shouldDeliver?.()).toBe(false)

    resolveExport?.(sharedStatus)
    await Promise.resolve()
    await Promise.resolve()
    expect(onOutcome).not.toHaveBeenCalled()
  })

  it('keeps a newer anonymous preview when a handle-bearing render resolves late', async () => {
    const initialCanvas = freshCanvas()
    const handleCanvas = freshCanvas()
    const anonymousCanvas = freshCanvas()
    let resolveHandlePreview: ((canvas: HTMLCanvasElement) => void) | undefined
    let resolveAnonymousPreview:
      | ((canvas: HTMLCanvasElement) => void)
      | undefined
    let renderCall = 0
    shareMocks.render.mockImplementation(() => {
      renderCall += 1
      if (renderCall === 1) return Promise.resolve(initialCanvas)
      if (renderCall === 2) {
        return new Promise<HTMLCanvasElement>((resolve) => {
          resolveHandlePreview = resolve
        })
      }
      return new Promise<HTMLCanvasElement>((resolve) => {
        resolveAnonymousPreview = resolve
      })
    })
    shareMocks.export.mockResolvedValue(sharedStatus)
    renderStudio({ initialHandle: '@aria' })

    const preview = screen.getByTestId('progress-share-preview')
    await waitFor(() => expect(preview).toContainElement(initialCanvas))

    const identitySwitch = screen.getByRole('switch', {
      name: /add my handle/i,
    })
    fireEvent.click(identitySwitch)
    await waitFor(() => {
      expect(shareMocks.render).toHaveBeenCalledTimes(2)
      expect(shareMocks.render.mock.calls[1]?.[0]).toMatchObject({
        handle: '@aria',
      })
    })

    fireEvent.click(identitySwitch)
    await waitFor(() => {
      expect(shareMocks.render).toHaveBeenCalledTimes(3)
      expect(shareMocks.render.mock.calls[2]?.[0]).toMatchObject({
        handle: null,
      })
    })

    resolveAnonymousPreview?.(anonymousCanvas)
    await waitFor(() => expect(preview).toContainElement(anonymousCanvas))

    resolveHandlePreview?.(handleCanvas)
    await Promise.resolve()
    await Promise.resolve()
    expect(preview).toContainElement(anonymousCanvas)
    expect(preview).not.toContainElement(handleCanvas)

    const exportButton = screen.getByTestId('progress-share-export')
    await waitFor(() => expect(exportButton).not.toBeDisabled())
    fireEvent.click(exportButton)
    await waitFor(() => {
      expect(shareMocks.export).toHaveBeenCalledWith(
        anonymousCanvas,
        expect.any(Object),
      )
    })
  })

  it('keeps the studio open after failure and supports an in-place retry', async () => {
    shareMocks.render.mockResolvedValue(freshCanvas())
    shareMocks.export
      .mockResolvedValueOnce(failedStatus)
      .mockResolvedValueOnce({
        ...sharedStatus,
        outcome: 'downloaded',
        message: 'Progress card downloaded.',
      })
    renderStudio()

    const exportButton = await screen.findByTestId('progress-share-export')
    await waitFor(() => expect(exportButton).not.toBeDisabled())
    fireEvent.click(exportButton)
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'could not be exported',
    )
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(exportButton).toHaveTextContent('Try again')

    fireEvent.click(exportButton)
    expect(
      await screen.findByText('Progress card downloaded.'),
    ).toBeInTheDocument()
    expect(shareMocks.export).toHaveBeenCalledTimes(2)
  })

  it('closes on Escape, traps Tab, and restores prior focus', async () => {
    shareMocks.render.mockResolvedValue(freshCanvas())
    const outside = document.createElement('button')
    outside.textContent = 'Outside'
    document.body.append(outside)
    outside.focus()

    const [open, setOpen] = createSignal(true)
    const onClose = vi.fn(() => setOpen(false))
    render(() => (
      <ProgressShareStudio open={open()} moment={moment} onClose={onClose} />
    ))

    const dialog = screen.getByRole('dialog')
    await waitFor(() => expect(dialog).toHaveFocus())
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true })
    expect(dialog.contains(document.activeElement)).toBe(true)

    fireEvent.keyDown(dialog, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('dialog')).toBeNull()
    await waitFor(() => expect(outside).toHaveFocus())
    outside.remove()
  })
})
