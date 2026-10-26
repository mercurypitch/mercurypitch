// Studio Sound tests — native sliders keep one gesture per command and reset from saved sound.
import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { applyStudioCommand } from '@/lib/studio/model/commands'
import { studioFixture } from '@/lib/studio/model/model.test-fixtures'
import type { StudioSoundEdit } from '@/lib/studio/model/sound-commands'
import { StudioSoundPanel } from './StudioSoundPanel'
import type { StudioSoundController } from './useStudioSound'

afterEach(cleanup)

function mount() {
  const fixture = studioFixture()
  const [project, setProject] = createSignal(fixture.project)
  const [writable, setWritable] = createSignal(true)
  const command = vi.fn((edit: StudioSoundEdit) => {
    setProject((current) =>
      applyStudioCommand(current, edit, { assets: [fixture.asset] }),
    )
    return true
  })
  const balance: StudioSoundController = {
    busy: () => false,
    cancelling: () => false,
    progress: () => null,
    error: () => null,
    notice: () => null,
    autoBalance: vi.fn(async () => true),
    cancel: vi.fn(),
    dispose: vi.fn(),
  }
  render(() => (
    <StudioSoundPanel
      project={project()}
      writable={writable()}
      onCommand={command}
      balance={balance}
    />
  ))
  return { project, setProject, command, setWritable, balance }
}

describe('Studio sound controls', () => {
  it('commits a held macro key only on release and resets the selected flavour without accumulated EQ', async () => {
    const ui = mount()
    const slider = screen.getByRole('slider', { name: 'Tone' })
    await fireEvent.keyDown(slider, { key: 'ArrowRight' })
    await fireEvent.input(slider, { target: { value: '1' } })
    await fireEvent.change(slider)
    await fireEvent.keyDown(slider, { key: 'ArrowRight', repeat: true })
    await fireEvent.input(slider, { target: { value: '2' } })
    await fireEvent.change(slider)
    expect(ui.command).not.toHaveBeenCalled()
    await fireEvent.keyUp(slider, { key: 'ArrowRight' })
    expect(ui.command).toHaveBeenCalledTimes(1)
    expect(ui.project().mix.macros.tone).toBe(2)
    await fireEvent.click(screen.getByRole('button', { name: /^Lo-fi$/ }))
    expect(ui.project().master.masterEq.highCutHz).toBe(6500)
    await fireEvent.click(screen.getByRole('button', { name: 'Reset sound' }))
    expect(ui.project().mix.flavourId).toBe('natural')
    expect(ui.project().master.masterEq.highCutHz).toBe(fixtureEqHighCut())
  })

  it('cancels a pointer draft on Escape and does not save its trailing native change event', async () => {
    const ui = mount()
    const slider = screen.getByRole('slider', {
      name: 'Space',
    }) as HTMLInputElement
    const parentEscape = vi.fn()
    slider.parentElement?.addEventListener('keydown', parentEscape)
    await fireEvent.pointerDown(slider)
    await fireEvent.input(slider, { target: { value: '30' } })
    expect(slider.value).toBe('30')
    await fireEvent.keyDown(slider, { key: 'Escape' })
    await fireEvent.input(slider, { target: { value: '65' } })
    await fireEvent.pointerUp(slider)
    await fireEvent.change(slider)
    expect(slider.value).toBe('0')
    expect(ui.command).not.toHaveBeenCalled()
    expect(parentEscape).not.toHaveBeenCalled()
  })

  it('drops a pending draft on ownership loss or an external project revision', async () => {
    const ui = mount()
    const slider = screen.getByRole('slider', {
      name: 'Warmth',
    }) as HTMLInputElement
    await fireEvent.input(slider, { target: { value: '20' } })
    ui.setProject((project) => ({ ...project, revision: 1 }))
    await fireEvent.change(slider)
    expect(ui.command).not.toHaveBeenCalled()
    await fireEvent.input(slider, { target: { value: '40' } })
    ui.setWritable(false)
    await fireEvent.blur(slider)
    expect(ui.command).not.toHaveBeenCalled()
    expect(slider.disabled).toBe(true)
  })

  it('shows supported targets as targets and commits the selected preset without an Off option', async () => {
    const ui = mount()
    await fireEvent.click(
      screen.getByRole('radio', { name: 'Quiet -16 LUFS target' }),
    )
    expect(ui.project().master).toMatchObject({
      presetId: 'gentle',
      targetLufs: -16,
      maxLimitingDb: 3,
    })
    expect(screen.getAllByRole('radio')).toHaveLength(3)
  })
})

function fixtureEqHighCut(): number {
  return studioFixture().project.master.masterEq.highCutHz
}
