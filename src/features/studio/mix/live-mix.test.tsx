// Studio live mix tests — a turning dial is heard and shown on the Sound panel's slider before its one command saves it.
import { cleanup, render, screen } from '@solidjs/testing-library'
import { createSignal, untrack } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { applyStudioCommand } from '@/lib/studio/model/commands'
import { createStudioProject } from '@/lib/studio/model/defaults'
import type { StudioSoundEdit } from '@/lib/studio/model/sound-commands'
import { StudioMacroControl } from '../sound/StudioMacroControl'
import { StudioMacroDial } from '../sound/StudioMacroDial'
import { createStudioLiveMix, StudioLiveMixContext } from './live-mix'

afterEach(cleanup)

// jsdom has no PointerEvent: a MouseEvent under a pointer event's name keeps
// clientY and the button, as in src/tests/helpers/pill-drag.ts.
function pointer(element: HTMLElement, type: string, clientY: number): void {
  element.setPointerCapture ??= () => undefined
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    button: 0,
    clientY,
  })
  Object.defineProperty(event, 'pointerId', { value: 7 })
  element.dispatchEvent(event)
}

describe('Studio live mix', () => {
  it('plays a turning dial at once, shows it on the other Tone control, and saves it once on release', () => {
    const log: string[] = []
    const [project, setProject] = createSignal(
      createStudioProject({ id: 'song', title: 'Dial song' }),
    )
    const command = vi.fn((edit: StudioSoundEdit) => {
      log.push(`command ${edit.type}`)
      setProject((current) => applyStudioCommand(current, edit, { assets: [] }))
      return true
    })
    const live = createStudioLiveMix({
      previewLane: () => undefined,
      previewMacro: (name, value) => log.push(`preview ${name} ${value}`),
    })
    render(() => (
      <StudioLiveMixContext.Provider value={live}>
        <StudioMacroControl
          name="tone"
          project={project()}
          writable
          onCommand={command}
        />
        <StudioMacroDial
          name="tone"
          project={project()}
          writable
          onCommand={command}
        />
      </StudioLiveMixContext.Provider>
    ))
    const [slider, dial] = screen.getAllByRole('slider', { name: 'Tone' })
    const face = screen.getByTitle(
      'Tone: drag up or down. Double-click for the centre.',
    )
    pointer(face, 'pointerdown', 200)
    pointer(face, 'pointermove', 160)
    expect(dial).toHaveAttribute('aria-valuetext', '50 toward Bright')
    expect(slider).toHaveAttribute('aria-valuetext', '50 toward Bright')
    expect(command).not.toHaveBeenCalled()
    pointer(face, 'pointerup', 160)
    expect(untrack(() => project().mix.macros.tone)).toBe(50)
    expect(log).toEqual([
      'preview tone 50',
      'command set-sound-macros',
      'preview tone null',
    ])
  })
})
