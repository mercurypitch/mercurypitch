// Studio note editor hook tests — opening a MIDI clip's notes selects it and closes Mix and a panel that covers the lanes, before the editor opens, but leaves a panel beside the lanes; an audio clip opens nothing and closes nothing; and the editor covers the lanes when it fills the arrangement or a phone's screen.
import { createRoot, createSignal } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { studioMidiFixture } from '@/lib/studio/model/model.test-fixtures'
import type { StudioPanelName } from '../panels/studio-panels'
import { useStudioNoteEditor } from './useStudioNoteEditor'

const disposers: (() => void)[] = []
afterEach(() => {
  for (const dispose of disposers.splice(0)) dispose()
})

function harness(options: { panel: StudioPanelName | null; covers: boolean }) {
  const { project, clip } = studioMidiFixture()
  return createRoot((dispose) => {
    disposers.push(dispose)
    const [phone, setPhone] = createSignal(false)
    const [panel, setPanel] = createSignal(options.panel)
    const order: string[] = []
    const selectClip = vi.fn()
    const notes = useStudioNoteEditor({
      project: () => project,
      phone,
      panel,
      panelCovers: () => options.covers,
      closePanel: () => {
        order.push(`closed ${panel()} with notes ${notes.state.clipId()}`)
        setPanel(null)
      },
      selectClip,
      selectedClipId: () => null,
      scope: () => null,
    })
    return { notes, clip, panel, selectClip, order, setPhone }
  })
}

describe('useStudioNoteEditor', () => {
  it('closes Mix before it opens a MIDI clip’s notes, and selects the clip', () => {
    // Arrange
    const run = harness({ panel: 'mix', covers: false })

    // Act
    const opened = run.notes.open(run.clip.id)

    // Assert
    expect(opened).toBe(true)
    expect(run.order).toEqual(['closed mix with notes null'])
    expect(run.selectClip).toHaveBeenCalledWith(run.clip.id)
    expect(run.notes.state.clipId()).toBe(run.clip.id)
  })

  it('closes a panel that covers the lanes, and leaves one beside them', () => {
    const covering = harness({ panel: 'clip', covers: true })
    covering.notes.open(covering.clip.id)
    expect(covering.panel()).toBeNull()

    const beside = harness({ panel: 'clip', covers: false })
    beside.notes.open(beside.clip.id)
    expect(beside.panel()).toBe('clip')
  })

  it('opens nothing for an audio clip, and closes nothing', () => {
    const run = harness({ panel: 'mix', covers: true })

    expect(run.notes.open('clip-1')).toBe(false)
    expect(run.panel()).toBe('mix')
    expect(run.selectClip).not.toHaveBeenCalled()
  })

  it('covers the lanes when it fills the arrangement or a phone’s screen, and is a drawer otherwise', () => {
    const run = harness({ panel: null, covers: false })
    run.notes.open(run.clip.id)
    expect([run.notes.drawer(), run.notes.covering()]).toEqual([true, false])

    run.notes.state.setExpanded(true)
    expect(run.notes.covering()).toBe(true)

    run.notes.state.setExpanded(false)
    run.setPhone(true)
    expect([
      run.notes.drawer(),
      run.notes.covering(),
      run.notes.full(),
    ]).toEqual([false, true, true])
  })
})
