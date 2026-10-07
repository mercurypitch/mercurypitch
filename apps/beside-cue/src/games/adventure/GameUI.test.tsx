// Shared settings interaction — preferences, keyboard tabs and close events preserve the active owner.
import { fireEvent, render, screen } from '@solidjs/testing-library'
import { createSignal, onCleanup } from 'solid-js'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { GlassGameHost } from '../../../../../packages/glass-game/src/host'
import { GAME_APPEARANCE_KEY, GAME_MATERIAL_KEY, } from '../../../../../packages/glass-game/src/ui/game-appearance'
import { GAME_MATERIAL_ART } from '../../../../../packages/glass-game/src/ui/game-material-art'
import { GameMaterialFrame } from '../../../../../packages/glass-game/src/ui/GameMaterialFrame'
import { GameAppearanceControls, GameMaterialControls, GameSettingsDialog, GameSurface, GameUIProvider, } from '../../../../../packages/glass-game/src/ui/GameUI'

beforeEach(() => {
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.open = true
    },
  })
  Object.defineProperty(HTMLDialogElement.prototype, 'close', {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.open = false
      this.dispatchEvent(new Event('close'))
    },
  })
})
afterEach(() => {
  vi.restoreAllMocks()
  document.documentElement.removeAttribute('data-theme')
})

it.each([
  { width: 708, height: 124 },
  { width: 369, height: 147.59375 },
])(
  'joins the $width×$height console patches on whole pixels without stretching its painted corners or losing source coverage',
  ({ width, height }) => {
    const view = render(() => (
      <GameMaterialFrame
        width={width}
        height={height}
        corner={24}
        kind="panel"
        shape="console"
        theme="dark"
      />
    ))
    const patches = [...view.container.querySelectorAll('svg > svg')].map(
      (patch) => ({
        x: Number(patch.getAttribute('x')),
        y: Number(patch.getAttribute('y')),
        width: Number(patch.getAttribute('width')),
        height: Number(patch.getAttribute('height')),
        source: patch.getAttribute('viewBox')!.split(' ').map(Number),
      }),
    )
    expect(patches).toHaveLength(9)
    for (const patch of patches) {
      for (const edge of [patch.x, patch.x + patch.width])
        if (edge > 0 && edge < width) expect(edge).toBe(Math.round(edge))
      for (const edge of [patch.y, patch.y + patch.height])
        if (edge > 0 && edge < height) expect(edge).toBe(Math.round(edge))
    }
    for (const index of [0, 2, 6, 8]) {
      const patch = patches[index]!
      expect(patch.width / patch.source[2]!).toBeCloseTo(
        patch.height / patch.source[3]!,
        8,
      )
    }
    for (let row = 0; row < 3; row++) {
      const line = patches.slice(row * 3, row * 3 + 3)
      expect(line[0]!.source[0]! + line[0]!.source[2]!).toBeCloseTo(
        line[1]!.source[0]!,
        8,
      )
      expect(line[1]!.source[0]! + line[1]!.source[2]!).toBeCloseTo(
        line[2]!.source[0]!,
        8,
      )
      expect(
        line.reduce((sum, patch) => sum + patch.source[2]!, 0),
      ).toBeCloseTo(GAME_MATERIAL_ART['c3-console-master'].bounds.width, 8)
    }
    const column = [patches[0]!, patches[3]!, patches[6]!]
    expect(column[0]!.source[1]! + column[0]!.source[3]!).toBeCloseTo(
      column[1]!.source[1]!,
      8,
    )
    expect(column[1]!.source[1]! + column[1]!.source[3]!).toBeCloseTo(
      column[2]!.source[1]!,
      8,
    )
    expect(
      column.reduce((sum, patch) => sum + patch.source[3]!, 0),
    ).toBeCloseTo(GAME_MATERIAL_ART['c3-console-master'].bounds.height, 8)
  },
)

function mount() {
  const store = new Map<string, string>()
  const writePreference = vi.fn((key: string, value: string) =>
    store.set(key, value),
  )
  const host = {
    readPreference: (key: string) => store.get(key) ?? null,
    writePreference,
  } as Pick<
    GlassGameHost,
    'readPreference' | 'writePreference'
  > as GlassGameHost
  const close = vi.fn()
  const closed = vi.fn()
  const exit = vi.fn()
  const mounted = vi.fn()
  const retired = vi.fn()

  function SceneOwner() {
    mounted()
    onCleanup(retired)
    return <div data-testid="live-scene" />
  }
  const [open, setOpen] = createSignal(true)
  const view = render(() => (
    <GameUIProvider host={host}>
      <SceneOwner />
      <GameSettingsDialog
        open={open()}
        onClose={() => {
          close()
          setOpen(false)
        }}
        onClosed={closed}
        onExit={exit}
        sections={[
          {
            id: 'sound',
            label: 'Sound',
            content: () => <p>Existing sound owner</p>,
          },
          {
            id: 'display',
            label: 'Display',
            content: () => <GameAppearanceControls />,
          },
          {
            id: 'advanced',
            label: 'Advanced',
            content: () => <GameMaterialControls />,
          },
        ]}
      />
    </GameUIProvider>
  ))
  return {
    ...view,
    close,
    closed,
    exit,
    writePreference,
    mounted,
    retired,
    setOpen,
  }
}

it('keeps tabs on one keyboard stop, supports arrows and leaves game ownership intact', () => {
  const view = mount()
  const sound = screen.getByRole('tab', { name: 'Sound' })
  const display = screen.getByRole('tab', { name: 'Display' })
  expect(sound.tabIndex).toBe(0)
  expect(display.tabIndex).toBe(-1)
  fireEvent.keyDown(sound, { key: 'ArrowRight' })
  expect(display).toHaveFocus()
  expect(display).toHaveAttribute('aria-selected', 'true')
  expect(sound.tabIndex).toBe(-1)
  fireEvent.click(screen.getByRole('button', { name: 'Celadon' }))
  fireEvent.click(screen.getByLabelText('Reduced transparency'))
  expect(view.container.querySelector('[data-game-theme]')).toHaveAttribute(
    'data-game-theme',
    'dark',
  )
  expect(
    view.writePreference.mock.calls.every(
      ([key]) => key === GAME_APPEARANCE_KEY,
    ),
  ).toBe(true)
  expect(view.mounted).toHaveBeenCalledOnce()
  expect(view.retired).not.toHaveBeenCalled()
  expect(view.close).not.toHaveBeenCalled()
})

it('bounds developer controls and restores only material defaults', () => {
  const view = mount()
  fireEvent.click(screen.getByRole('tab', { name: 'Advanced' }))
  const opacity = screen.getByRole('slider', { name: 'Glass backing' })
  fireEvent.input(opacity, { target: { value: '.72' } })
  expect(JSON.parse(view.writePreference.mock.calls.at(-1)![1]).opacity).toBe(
    0.72,
  )
  fireEvent.click(screen.getByRole('button', { name: 'Reset materials' }))
  expect(JSON.parse(view.writePreference.mock.calls.at(-1)![1]).opacity).toBe(
    0.88,
  )
  expect(
    view.writePreference.mock.calls.every(([key]) => key === GAME_MATERIAL_KEY),
  ).toBe(true)
})

it.each(['Close settings', 'Resume'])(
  'closes from %s exactly once and calls native-close handoff',
  (label) => {
    const view = mount()
    fireEvent.click(screen.getByRole('button', { name: label }))
    expect(view.close).toHaveBeenCalledOnce()
    expect(view.closed).toHaveBeenCalledOnce()
  },
)

it('does not resume or hand focus away during navigation/unmount', () => {
  const view = mount()
  fireEvent.click(screen.getByRole('button', { name: 'Museum' }))
  expect(view.exit).toHaveBeenCalledOnce()
  view.unmount()
  expect(view.close).not.toHaveBeenCalled()
  expect(view.closed).not.toHaveBeenCalled()
  expect(view.retired).toHaveBeenCalledOnce()
})

it('follows the app preset without rebuilding its scene or touching sound preferences', async () => {
  const view = mount()
  fireEvent.click(screen.getByRole('tab', { name: 'Display' }))
  fireEvent.click(screen.getByRole('button', { name: 'Follow app' }))
  document.documentElement.setAttribute('data-theme', 'forest')
  await Promise.resolve()
  expect(view.container.querySelector('[data-game-theme]')).toHaveAttribute(
    'data-game-theme',
    'dark',
  )
  document.documentElement.setAttribute('data-theme', 'light')
  await Promise.resolve()
  expect(view.container.querySelector('[data-game-theme]')).toHaveAttribute(
    'data-game-theme',
    'light',
  )
  expect(view.mounted).toHaveBeenCalledOnce()
  expect(view.retired).not.toHaveBeenCalled()
})

it('ignores a queued close event after the same dialog reopens for a tutorial return', () => {
  vi.spyOn(HTMLDialogElement.prototype, 'close').mockImplementation(function (
    this: HTMLDialogElement,
  ) {
    this.open = false
  })
  const view = mount()
  const dialog = screen.getByRole('dialog', {
    name: 'Settings',
  }) as HTMLDialogElement
  view.setOpen(false)
  view.setOpen(true)
  dialog.dispatchEvent(new Event('close'))
  expect(dialog.open).toBe(true)
  expect(view.close).not.toHaveBeenCalled()
  expect(view.closed).not.toHaveBeenCalled()
})

it('resizes the decorative frame without remounting its navigation owner and disconnects on cleanup', () => {
  let width = 150
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
    () => ({
      width,
      height: 48,
      x: 0,
      y: 0,
      top: 0,
      right: width,
      bottom: 48,
      left: 0,
      toJSON: () => ({}),
    }),
  )
  let resized = (): void => {}
  const disconnect = vi.fn()
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(callback: () => void) {
        resized = callback
      }
      observe(): void {}
      disconnect = disconnect
    },
  )
  const retired = vi.fn()

  function Navigation() {
    onCleanup(retired)
    return <button type="button">Museum frame owner</button>
  }
  const view = render(() => (
    <GameSurface kind="plaque">
      <Navigation />
    </GameSurface>
  ))
  try {
    const button = screen.getByRole('button', { name: 'Museum frame owner' })
    const frame = view.container.querySelector('[data-game-frame]')!
    expect(frame).toHaveAttribute('viewBox', '0 0 150 48')
    expect(frame).toHaveAttribute('data-game-frame', 'plaque')
    width = 48
    resized()
    expect(frame).toHaveAttribute('viewBox', '0 0 48 48')
    expect(frame).toHaveAttribute('data-game-frame', 'tile')
    expect(screen.getByRole('button', { name: 'Museum frame owner' })).toBe(
      button,
    )
    expect(retired).not.toHaveBeenCalled()
    view.unmount()
    expect(disconnect).toHaveBeenCalledOnce()
    expect(retired).toHaveBeenCalledOnce()
  } finally {
    vi.unstubAllGlobals()
  }
})

it.each(['Crystal', 'Celadon'])(
  'keeps %s material opacity and corner preferences live on its existing frame',
  (theme) => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      width: 365,
      height: 300,
      x: 0,
      y: 0,
      top: 0,
      right: 365,
      bottom: 300,
      left: 0,
      toJSON: () => ({}),
    })
    const view = mount()
    fireEvent.click(screen.getByRole('tab', { name: 'Display' }))
    fireEvent.click(screen.getByRole('button', { name: theme }))
    fireEvent.click(screen.getByLabelText('Reduced transparency'))
    const root = view.container.querySelector<HTMLElement>('[data-game-theme]')!
    expect(root.style.getPropertyValue('--game-opacity')).toBe('1')
    expect(root.style.getPropertyValue('--game-settings-opacity')).toBe('1')
    fireEvent.click(screen.getByLabelText('Reduced transparency'))
    fireEvent.click(screen.getByRole('tab', { name: 'Advanced' }))
    const frame = view.container.querySelector('[data-game-frame]')!
    const outline = frame.querySelector('clipPath path')!
    const sourceOutline = outline.getAttribute('d')
    const cornerPatch = (): SVGSVGElement =>
      frame.querySelector(':scope > svg')!
    const before = {
      width: Number(cornerPatch().getAttribute('width')),
      height: Number(cornerPatch().getAttribute('height')),
      viewBox: cornerPatch().getAttribute('viewBox'),
    }
    fireEvent.input(screen.getByRole('slider', { name: 'Corner size' }), {
      target: { value: '32' },
    })
    expect(outline.getAttribute('d')).toBe(sourceOutline)
    expect(Number(cornerPatch().getAttribute('width'))).toBeGreaterThan(
      before.width,
    )
    expect(Number(cornerPatch().getAttribute('height'))).toBeGreaterThan(
      before.height,
    )
    const source = cornerPatch().getAttribute('viewBox')!.split(' ').map(Number)
    expect(source.slice(0, 2)).toEqual(
      before.viewBox!.split(' ').slice(0, 2).map(Number),
    )
    expect(
      Number(cornerPatch().getAttribute('width')) / source[2]!,
    ).toBeCloseTo(Number(cornerPatch().getAttribute('height')) / source[3]!, 8)
    fireEvent.input(screen.getByRole('slider', { name: 'Glass backing' }), {
      target: { value: '.72' },
    })
    expect(root.style.getPropertyValue('--game-opacity')).toBe('0.72')
    expect(root.style.getPropertyValue('--game-settings-opacity')).toBe('0.72')
    expect(view.container.querySelector('[data-game-frame]')).toBe(frame)
    expect(view.mounted).toHaveBeenCalledOnce()
    expect(view.retired).not.toHaveBeenCalled()
  },
)
