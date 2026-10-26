// Studio export panel tests — final measurements and download never masquerade as a target or a saved file.
import { cleanup, fireEvent, render, screen, waitFor, } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { StudioWavExport } from '@/lib/studio/export/render-wav'
import { studioFixture } from '@/lib/studio/model/model.test-fixtures'
import { deferred, wavResult } from './export.test-fixtures'
import { StudioExportPanel } from './StudioExportPanel'
import type { StudioExportController } from './useStudioExport'

afterEach(cleanup)

function mount() {
  const [result, setResult] = createSignal<StudioWavExport | null>(null)
  const [busy, setBusy] = createSignal(false)
  const [cancelling, setCancelling] = createSignal(false)
  const controller: StudioExportController = {
    busy,
    cancelling,
    result,
    stage: () => 'verifying',
    error: () => null,
    notice: () => null,
    exportWav: vi.fn(async () => true),
    cancel: vi.fn(() => setCancelling(true)),
    download: vi.fn(() => true),
    dispose: vi.fn(),
  }
  render(() => (
    <StudioExportPanel
      project={studioFixture().project}
      controller={controller}
      canExport={true}
    />
  ))
  return { controller, setResult, setBusy }
}

describe('Studio WAV panel', () => {
  it('moves keyboard focus to Cancel during rendering and Download after completion', async () => {
    const ui = mount()
    const finished = deferred<undefined>()
    vi.mocked(ui.controller.exportWav).mockImplementationOnce(async () => {
      ui.setBusy(true)
      await finished.promise
      ui.setResult(wavResult())
      ui.setBusy(false)
      return true
    })
    const button = screen.getByRole('button', { name: 'Export WAV' })
    button.focus()
    await fireEvent.click(button)
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole('button', { name: 'Cancel export' }),
      ),
    )
    finished.resolve(undefined)
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole('button', { name: 'Download WAV' }),
      ),
    )
  })
  it('requires explicit export and then explicit download, showing measured loudness separately from the target', async () => {
    const ui = mount()
    expect(screen.getByText('Measured when you export.')).toBeDefined()
    await fireEvent.click(screen.getByRole('button', { name: 'Export WAV' }))
    expect(ui.controller.exportWav).toHaveBeenCalledTimes(1)
    ui.setResult(wavResult())
    expect(screen.getByText('-14 LUFS')).toBeDefined()
    expect(screen.getByText('-16.2')).toBeDefined()
    expect(screen.getByText('True peak (estimate)')).toBeDefined()
    expect(ui.controller.download).not.toHaveBeenCalled()
    await fireEvent.click(screen.getByRole('button', { name: 'Download WAV' }))
    expect(ui.controller.download).toHaveBeenCalledTimes(1)
    ui.setResult(null)
    expect(screen.queryByRole('button', { name: 'Download WAV' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Export WAV' })).toBeDefined()
  })

  it('shows indeterminate native progress and keeps the pending cancellation state honest', async () => {
    const ui = mount()
    ui.setBusy(true)
    const progress = screen.getByRole('progressbar', {
      name: 'Checking output…',
    })
    expect(progress.hasAttribute('value')).toBe(false)
    await fireEvent.click(screen.getByRole('button', { name: 'Cancel export' }))
    expect(screen.getByText('Stopping after the current pass…')).toBeDefined()
    expect(
      (
        screen.getByRole('button', {
          name: 'Cancel export',
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true)
    expect(screen.queryByRole('button', { name: 'Download WAV' })).toBeNull()
  })
})
