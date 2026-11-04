// Studio lane line tests — a lane's line opens from its header, takes points from a press, a drag, keys and its bar, and saves each gesture once.
import { cleanup, fireEvent, render, screen, within, } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { withStudioAutomation } from '@/lib/studio/model/automation'
import type { StudioCommand } from '@/lib/studio/model/commands'
import { applyStudioCommand } from '@/lib/studio/model/commands'
import { studioFixture } from '@/lib/studio/model/model.test-fixtures'
import type { StudioAutomationPoint, StudioProject, } from '@/lib/studio/model/types'
import { studioRecordCardAside } from '../record/record-card-aside'
import { setStudioTakeRunning } from '../record/take-running'
import { StudioTimeline } from './StudioTimeline'
import type { StudioTimelineRecording } from './types'

afterEach(() => {
  cleanup()
  setStudioTakeRunning(false)
})

/** The lane's line box: 60 s across at 20 px a second, 84 px high. */
const BOX = { width: 1200, height: 84 }

function mount(
  options: {
    volume?: readonly StudioAutomationPoint[]
    phone?: boolean
    writable?: boolean
    deskOpen?: boolean
    record?: StudioTimelineRecording
  } = {},
) {
  const { project: song, asset } = studioFixture()
  const lined =
    options.volume === undefined
      ? song.tracks[0]
      : withStudioAutomation(song.tracks[0], 'volume', options.volume)
  const [project, setProject] = createSignal<StudioProject>({
    ...song,
    tracks: [lined],
  })
  const [selectedClipId, setSelectedClipId] = createSignal<string | null>(null)
  const commands: StudioCommand[] = []
  const onCommand = vi.fn((command: StudioCommand) => {
    commands.push(command)
    setProject((current) =>
      applyStudioCommand(current, command, { assets: [asset] }),
    )
    return true
  })
  render(() => (
    <StudioTimeline
      project={project()}
      assets={[asset]}
      selectedClipId={selectedClipId()}
      onSelectClip={setSelectedClipId}
      playheadFrame={240000}
      pixelsPerSecond={20}
      writable={options.writable ?? true}
      phone={options.phone ?? false}
      deskOpen={options.deskOpen}
      record={options.record}
      onSeek={vi.fn()}
      onCommand={onCommand}
      onClipDetails={vi.fn()}
      onTrackDetails={vi.fn()}
      readCanonicalAsset={() => Promise.reject(new Error('Not in this test'))}
    />
  ))
  const toggle = screen.getByRole('button', {
    name: 'Guitar volume and pan lines',
  })
  return { project, setProject, commands, toggle, setSelectedClipId }
}

/** Open the lane's line and give its box a size, as a browser lays it out. */
function openLine(toggle: HTMLElement): HTMLElement {
  fireEvent.click(toggle)
  const area = document.querySelector<HTMLElement>('[data-studio-line]')!
  area.getBoundingClientRect = () => new DOMRect(0, 0, BOX.width, BOX.height)
  area.setPointerCapture = () => undefined
  return area
}

// jsdom has no PointerEvent: a MouseEvent under a pointer event's name keeps
// the coordinates and the button, as in StudioTrackControls.test.tsx.
function pointer(
  element: Element,
  type: string,
  clientX: number,
  clientY: number,
): void {
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    button: 0,
    clientX,
    clientY,
  })
  Object.defineProperty(event, 'pointerId', { value: 3 })
  element.dispatchEvent(event)
}

const volumeLine = (commands: readonly StudioCommand[]) =>
  commands.map((command) =>
    command.type === 'set-lane-automation' ? command.points : command,
  )

describe('Studio lane line', () => {
  it('opens from the lane header and adds a point where the lane is pressed, as one edit', () => {
    // Arrange
    const { toggle, commands, project } = mount()

    // Act
    const area = openLine(toggle)
    pointer(area, 'pointerdown', 200, 42)
    pointer(area, 'pointerup', 200, 42)

    // Assert
    expect(toggle).toHaveAttribute('aria-pressed', 'true')
    expect(area).toHaveAccessibleName('Guitar volume line')
    expect(commands).toEqual([
      {
        type: 'set-lane-automation',
        trackId: 'track-1',
        param: 'volume',
        points: [{ frame: 480000, value: -24 }],
      },
    ])
    expect(project().tracks[0].automation).toEqual({
      volume: [{ frame: 480000, value: -24 }],
    })
    expect(
      screen.getByRole('button', {
        name: 'Volume point at 0:10, \u221224.0 dB',
      }),
    ).toBeInTheDocument()
  })

  it('moves a held point by the hand’s travel, shows it moving, and saves it once on release', () => {
    // Arrange
    const { toggle, commands } = mount({
      volume: [{ frame: 480000, value: -24 }],
    })
    const area = openLine(toggle)
    const point = screen.getByRole('button', { name: /Volume point at 0:10/ })

    // Act
    pointer(point, 'pointerdown', 203, 44)
    pointer(area, 'pointermove', 253, 23)
    const moving = area.textContent
    const before = commands.length
    pointer(area, 'pointerup', 253, 23)

    // Assert
    expect(moving).toContain('\u22126.0 dB at 0:12.5')
    expect(before).toBe(0)
    expect(volumeLine(commands)).toEqual([[{ frame: 600000, value: -6 }]])
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: /Volume point at 0:12.5/ }),
    )
  })

  it('keeps a click on a point from moving it', () => {
    // Arrange
    const { toggle, commands } = mount({
      volume: [{ frame: 480000, value: -24 }],
    })
    const area = openLine(toggle)
    const point = screen.getByRole('button', { name: /Volume point at 0:10/ })

    // Act
    pointer(point, 'pointerdown', 200, 42)
    pointer(area, 'pointermove', 201, 43)
    pointer(area, 'pointerup', 201, 43)

    // Assert
    expect(commands).toEqual([])
    expect(area.textContent).toContain('\u221224.0 dB at 0:10')
  })

  it('nudges a point with the arrow keys and saves the run once the key comes up', () => {
    // Arrange
    const { toggle, commands } = mount({
      volume: [{ frame: 480000, value: -24 }],
    })
    openLine(toggle)
    const point = screen.getByRole('button', { name: /Volume point at 0:10/ })
    point.focus()

    // Act
    fireEvent.keyDown(point, { key: 'ArrowUp' })
    fireEvent.keyDown(point, { key: 'ArrowUp' })
    fireEvent.keyDown(point, { key: 'ArrowUp', shiftKey: true })
    fireEvent.keyDown(point, { key: 'ArrowRight' })
    const before = commands.length
    fireEvent.keyUp(point, { key: 'ArrowRight' })

    // Assert
    expect(before).toBe(0)
    expect(volumeLine(commands)).toEqual([
      [{ frame: 480000 + 96000, value: -21.9 }],
    ])
  })

  it('puts the chosen point’s readout on the side no neighbouring point is under', () => {
    // Arrange: 0 dB at 0:10, and -30 dB a second (20 px) later.
    const { toggle } = mount({
      volume: [
        { frame: 480000, value: 0 },
        { frame: 528000, value: -30 },
      ],
    })
    const area = openLine(toggle)
    const side = () =>
      area.querySelector('[data-side]')?.getAttribute('data-side')

    // Act
    screen.getByRole('button', { name: /Volume point at 0:10/ }).focus()
    const overQuieter = side()
    screen.getByRole('button', { name: /Volume point at 0:11/ }).focus()
    const underLouder = side()

    // Assert
    expect(overQuieter).toBe('above')
    expect(underLouder).toBe('below')
  })

  it('deletes the focused point with Delete and moves to its neighbour', async () => {
    // Arrange
    const { toggle, commands } = mount({
      volume: [
        { frame: 96000, value: 0 },
        { frame: 192000, value: -12 },
      ],
    })
    openLine(toggle)
    const first = screen.getByRole('button', { name: /Volume point at 0:02/ })
    first.focus()

    // Act
    fireEvent.keyDown(first, { key: 'Delete' })
    await Promise.resolve()

    // Assert
    expect(volumeLine(commands)).toEqual([[{ frame: 192000, value: -12 }]])
    expect(document.activeElement).toHaveAccessibleName(
      'Volume point at 0:04, \u221212.0 dB',
    )
  })

  it('adds a point at the playhead, deletes the chosen one and clears the line from its bar', () => {
    // Arrange
    const { toggle, commands } = mount({
      volume: [{ frame: 96000, value: -6 }],
    })
    openLine(toggle)
    const bar = screen.getByRole('toolbar', { name: 'Guitar lines' })

    // Act
    fireEvent.click(within(bar).getByRole('button', { name: 'Add point' }))
    fireEvent.click(within(bar).getByRole('button', { name: 'Delete point' }))
    fireEvent.click(within(bar).getByRole('button', { name: 'Clear line' }))

    // Assert
    expect(volumeLine(commands)).toEqual([
      [
        { frame: 96000, value: -6 },
        { frame: 240000, value: -6 },
      ],
      [{ frame: 96000, value: -6 }],
      [],
    ])
    expect(
      within(bar).getByRole('button', { name: 'Clear line' }),
    ).toBeDisabled()
  })

  it('draws the pan line from the bar, left at the top of the lane', () => {
    // Arrange
    const { toggle, commands } = mount()
    const area = openLine(toggle)
    const bar = screen.getByRole('toolbar', { name: 'Guitar lines' })

    // Act
    fireEvent.click(within(bar).getByRole('button', { name: 'Pan' }))
    pointer(area, 'pointerdown', 200, 0)
    pointer(area, 'pointerup', 200, 0)

    // Assert
    expect(area).toHaveAccessibleName('Guitar pan line')
    expect(commands).toEqual([
      {
        type: 'set-lane-automation',
        trackId: 'track-1',
        param: 'pan',
        points: [{ frame: 480000, value: -1 }],
      },
    ])
  })

  it('closes on Escape back to its toggle, on Done, and when a clip is chosen', async () => {
    // Arrange
    const { toggle, setSelectedClipId } = mount({
      volume: [{ frame: 96000, value: -6 }],
    })
    openLine(toggle)
    const point = screen.getByRole('button', { name: /Volume point/ })
    point.focus()

    // Act
    fireEvent.keyDown(point, { key: 'Escape' })
    await Promise.resolve()
    const afterEscape = toggle.getAttribute('aria-pressed')
    const focused = document.activeElement
    openLine(toggle)
    fireEvent.click(screen.getByRole('button', { name: 'Done' }))
    const afterDone = toggle.getAttribute('aria-pressed')
    openLine(toggle)
    setSelectedClipId('clip-1')

    // Assert
    expect(afterEscape).toBe('false')
    expect(focused).toBe(toggle)
    expect(afterDone).toBe('false')
    expect(toggle).toHaveAttribute('aria-pressed', 'false')
    expect(document.querySelector('[data-studio-line]')).toBeNull()
  })

  it('shows a read-only song’s line without taking points or edits', () => {
    // Arrange
    const { toggle, commands } = mount({
      volume: [{ frame: 96000, value: -6 }],
      writable: false,
    })
    const area = openLine(toggle)
    const bar = screen.getByRole('toolbar', { name: 'Guitar lines' })

    // Act
    pointer(area, 'pointerdown', 200, 42)
    pointer(area, 'pointerup', 200, 42)

    // Assert
    expect(commands).toEqual([])
    for (const name of ['Add point', 'Delete point', 'Clear line'])
      expect(within(bar).getByRole('button', { name })).toBeDisabled()
  })

  it('opens from a phone lane’s header too, with the bar across the lanes’ foot', () => {
    // Arrange
    const { toggle } = mount({ phone: true })

    // Act
    openLine(toggle)

    // Assert
    const bar = screen.getByRole('toolbar', { name: 'Guitar lines' })
    expect(bar.style.left).toBe('12px')
    expect(bar.style.right).toBe('12px')
    expect(within(bar).getByRole('button', { name: 'Done' })).toBeVisible()
  })

  it('stands a phone lane’s lines toggle under its name while the lanes have room, and beside it when they do not', () => {
    // Arrange
    const { toggle, setProject } = mount({ phone: true })
    const roomy = toggle.textContent

    // Act
    setProject((current) => ({
      ...current,
      tracks: [
        ...current.tracks,
        ...[2, 3, 4].map((n) => ({
          ...current.tracks[0],
          id: `track-${n}`,
          name: `Take ${n}`,
        })),
      ],
    }))

    // Assert
    expect(roomy).toBe('Lines')
    expect(toggle.textContent).toBe('')
    expect(toggle).toHaveAccessibleName('Guitar volume and pan lines')
  })

  it('holds an open line while a take runs and shows it again once the take is kept', () => {
    // Arrange
    const { toggle } = mount({ volume: [{ frame: 96000, value: -6 }] })
    openLine(toggle)

    // Act
    setStudioTakeRunning(true)
    const during = {
      line: document.querySelector('[data-studio-line]'),
      bar: screen.queryByRole('toolbar', { name: 'Guitar lines' }),
      disabled: (toggle as HTMLButtonElement).disabled,
      title: toggle.title,
    }
    setStudioTakeRunning(false)

    // Assert
    expect(during).toEqual({
      line: null,
      bar: null,
      disabled: true,
      title: 'Stop the take to draw lines',
    })
    expect(document.querySelector('[data-studio-line]')).not.toBeNull()
    expect(toggle).toHaveAttribute('aria-pressed', 'true')
    expect(toggle).toBeEnabled()
  })

  it('opens a phone lane’s lines while a lane is armed, and the record card steps aside for its bar', () => {
    // Arrange
    const { toggle } = mount({
      phone: true,
      record: { trackId: 'track-1', live: null, level: 0, listening: true },
    })

    // Act
    openLine(toggle)

    // Assert
    expect(toggle).toBeEnabled()
    expect(toggle).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('toolbar', { name: 'Guitar lines' })).toBeTruthy()
    expect(studioRecordCardAside()).toBe(true)
  })

  it('closes a phone’s lines when the armed lane’s take starts, so the record card comes back', () => {
    // Arrange
    const { toggle } = mount({
      phone: true,
      record: { trackId: 'track-1', live: null, level: 0, listening: true },
    })
    openLine(toggle)

    // Act
    setStudioTakeRunning(true)
    const during = {
      disabled: (toggle as HTMLButtonElement).disabled,
      title: toggle.title,
      aside: studioRecordCardAside(),
    }
    setStudioTakeRunning(false)

    // Assert
    expect(during).toEqual({
      disabled: true,
      title: 'Stop the take to draw lines',
      aside: false,
    })
    expect(toggle).toHaveAttribute('aria-pressed', 'false')
    expect(document.querySelector('[data-studio-line]')).toBeNull()
    expect(studioRecordCardAside()).toBe(false)
  })

  it('stands the line bar in the dock beside the lanes while the desk is open', () => {
    // Arrange
    const { toggle } = mount({ deskOpen: true })

    // Act
    openLine(toggle)

    // Assert
    const dock = document.querySelector('[data-studio-dock]')!
    const bar = screen.getByRole('toolbar', { name: 'Guitar lines' })
    expect(dock).toContainElement(bar)
    expect(bar).toHaveAttribute('aria-orientation', 'vertical')
    expect(
      within(bar).queryByRole('button', { name: 'Done' }),
    ).not.toBeInTheDocument()
  })
})
