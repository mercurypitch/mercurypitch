// Creator gallery navigation — art auditions never mount the campaign or share its progress identity.
import { decodeProceduralCourseCode, encodeProceduralCourseCode, getProceduralCourseIdentity, } from '@irchiinnuss/glass-game/creator-levels'
import { fireEvent, render, screen } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./AdventureScreen', () => ({
  AdventureScreen: (props: {
    level: { id: string }
    assetBase?: string
    onExit(): void
  }) => (
    <button
      data-testid="study"
      data-level={props.level.id}
      data-assets={props.assetBase}
      onClick={() => props.onExit()}
    >
      Leave study
    </button>
  ),
}))

import { CLOUDWAY_RECIPE_STORAGE_KEY, CreatorGallery } from './CreatorGallery'

const originalClipboard = Object.getOwnPropertyDescriptor(
  navigator,
  'clipboard',
)
beforeEach(() => {
  const values = new Map<string, string>()
  // Node 25 exposes its own storage global; use an isolated browser-shaped store.
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
    removeItem: (key: string) => void values.delete(key),
    clear: () => values.clear(),
    key: (index: number) => [...values.keys()][index] ?? null,
    get length() {
      return values.size
    },
  } satisfies Storage)
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  if (originalClipboard)
    Object.defineProperty(navigator, 'clipboard', originalClipboard)
  else Reflect.deleteProperty(navigator, 'clipboard')
})

describe('creator art studies', () => {
  it.each([
    ['The archive after dark', 'glassworks-unbroken-archive/archive-hush'],
    ['The unbroken archive', 'glassworks-unbroken-archive/archive-awakening'],
    ['The pearl alcove', 'cloudway-thawing-song-alcove'],
    ['The living pearl', 'living-crystal-pearl-roots-art-study-v2'],
    ['The living amber', 'living-crystal-living-amber-art-study-v2'],
    ['Resonance veins', 'cloudway-crystal-interior-resonance-veins'],
    ['Frost roots', 'cloudway-crystal-interior-frost-roots'],
    ['Aurora heart', 'cloudway-crystal-interior-aurora-heart'],
  ])('opens and leaves %s independently', (title, id) => {
    const exit = vi.fn()
    render(() => <CreatorGallery onExit={exit} assetBase="../games/" />)
    fireEvent.click(screen.getByRole('button', { name: new RegExp(title) }))
    expect(screen.getByTestId('study')).toHaveAttribute('data-level', id)
    expect(screen.getByTestId('study')).toHaveAttribute(
      'data-assets',
      '../games/',
    )
    fireEvent.click(screen.getByTestId('study'))
    expect(
      screen.getByRole('heading', { name: 'Little discoveries' }),
    ).toBeVisible()
    expect(exit).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Back to games' }))
    expect(exit).toHaveBeenCalledOnce()
  })
})

describe('portable course sharing', () => {
  it.each([
    ['unsupported', ' \ncloudway:v27:future-recipe\t'],
    ['corrupt', '{broken'],
    ['empty', ''],
  ])(
    'preserves %s saved code through passive studio actions',
    async (_kind, saved) => {
      window.localStorage.setItem(CLOUDWAY_RECIPE_STORAGE_KEY, saved)
      const write = vi.spyOn(window.localStorage, 'setItem')
      const view = render(() => <CreatorGallery onExit={() => undefined} />)
      expect(window.localStorage.getItem(CLOUDWAY_RECIPE_STORAGE_KEY)).toBe(
        saved,
      )
      expect(screen.getByRole('status')).toHaveTextContent(
        'Your saved course code cannot be read here',
      )
      expect(screen.getByLabelText('Course seed')).toHaveValue(
        'celestial-prime',
      )

      fireEvent.click(
        screen.getByRole('button', { name: /The archive after dark/ }),
      )
      expect(screen.getByTestId('study')).toBeVisible()
      fireEvent.click(screen.getByTestId('study'))
      fireEvent.click(screen.getByRole('button', { name: 'Copy course code' }))
      await vi.waitFor(() =>
        expect(screen.getByLabelText('Your course code')).toBeVisible(),
      )
      expect(screen.getByRole('status')).toHaveTextContent(
        'Your saved course code cannot be read here',
      )
      fireEvent.click(screen.getByRole('button', { name: 'Launch expedition' }))
      expect(screen.getByTestId('study')).toBeVisible()
      fireEvent.click(screen.getByTestId('study'))

      fireEvent.input(screen.getByLabelText('Course code to import'), {
        target: { value: 'cloudway:v99:unsupported' },
      })
      fireEvent.click(screen.getByRole('button', { name: 'Load course code' }))
      expect(screen.getByRole('alert')).toBeVisible()
      // Selecting the already active option is not a change to the recipe.
      fireEvent.click(screen.getByRole('button', { name: 'Balanced' }))
      expect(window.localStorage.getItem(CLOUDWAY_RECIPE_STORAGE_KEY)).toBe(
        saved,
      )
      expect(write).not.toHaveBeenCalled()
      view.unmount()
      render(() => <CreatorGallery onExit={() => undefined} />)
      expect(window.localStorage.getItem(CLOUDWAY_RECIPE_STORAGE_KEY)).toBe(
        saved,
      )
      expect(screen.getByRole('status')).toHaveTextContent(
        'Your saved course code cannot be read here',
      )
    },
  )

  it('keeps an unreadable saved code through partial invalid edits and replaces it after a valid edit', () => {
    const saved = 'cloudway:v27:future-recipe'
    window.localStorage.setItem(CLOUDWAY_RECIPE_STORAGE_KEY, saved)
    render(() => <CreatorGallery onExit={() => undefined} />)
    fireEvent.input(screen.getByLabelText('Course seed'), {
      target: { value: '' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Gentle' }))
    expect(window.localStorage.getItem(CLOUDWAY_RECIPE_STORAGE_KEY)).toBe(saved)
    expect(screen.getByRole('status')).toHaveTextContent(
      'Your saved course code cannot be read here',
    )
    fireEvent.click(screen.getByRole('button', { name: 'Launch expedition' }))
    expect(screen.getByRole('alert')).toBeVisible()
    expect(window.localStorage.getItem(CLOUDWAY_RECIPE_STORAGE_KEY)).toBe(saved)
    fireEvent.input(screen.getByLabelText('Course seed'), {
      target: { value: 'my-replacement' },
    })
    expect(
      decodeProceduralCourseCode(
        window.localStorage.getItem(CLOUDWAY_RECIPE_STORAGE_KEY)!,
      ),
    ).toMatchObject({ seed: 'my-replacement', difficulty: 'gentle' })
    expect(
      screen.queryByText(/Your saved course code cannot be read here/),
    ).not.toBeInTheDocument()
  })

  it('deliberately replaces an unreadable code when a valid imported recipe matches the displayed defaults', () => {
    window.localStorage.setItem(CLOUDWAY_RECIPE_STORAGE_KEY, '{broken')
    const code = encodeProceduralCourseCode({
      seed: 'celestial-prime',
      melodyLessonId: 'sunlit-steps-v1',
    })
    render(() => <CreatorGallery onExit={() => undefined} />)
    fireEvent.input(screen.getByLabelText('Course code to import'), {
      target: { value: code },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Load course code' }))
    expect(window.localStorage.getItem(CLOUDWAY_RECIPE_STORAGE_KEY)).toBe(code)
    expect(screen.getByRole('status')).toHaveTextContent(
      'Course settings loaded',
    )
    expect(
      screen.queryByText(/Your saved course code cannot be read here/),
    ).not.toBeInTheDocument()
  })

  it('does not write when reading stored settings is blocked and leaves studies usable', () => {
    window.localStorage.setItem(
      CLOUDWAY_RECIPE_STORAGE_KEY,
      'cloudway:v27:kept',
    )
    const read = vi
      .spyOn(window.localStorage, 'getItem')
      .mockImplementation(() => {
        throw new Error('Storage denied')
      })
    const write = vi.spyOn(window.localStorage, 'setItem')
    render(() => <CreatorGallery onExit={() => undefined} />)
    expect(write).not.toHaveBeenCalled()
    expect(screen.getByText(/Saved settings are unavailable/)).toBeVisible()
    fireEvent.click(
      screen.getByRole('button', { name: /The archive after dark/ }),
    )
    expect(screen.getByTestId('study')).toBeVisible()
    fireEvent.click(screen.getByTestId('study'))
    expect(write).not.toHaveBeenCalled()
    read.mockRestore()
    expect(window.localStorage.getItem(CLOUDWAY_RECIPE_STORAGE_KEY)).toBe(
      'cloudway:v27:kept',
    )
  })

  it('imports a typed recipe, persists it and launches the same isolated course', () => {
    const options = {
      seed: 42,
      difficulty: 'gentle' as const,
      melodyLessonId: 'first-arc-v1' as const,
      fogTheme: 'dawn' as const,
      includeLivingCrystals: false,
      includeOptionalAlcoves: false,
    }
    const code = encodeProceduralCourseCode(options)
    const view = render(() => <CreatorGallery onExit={() => undefined} />)
    fireEvent.input(screen.getByLabelText('Course code to import'), {
      target: { value: code },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Load course code' }))
    expect(screen.getByLabelText('Course seed')).toHaveValue('42')
    expect(screen.getByRole('button', { name: 'Gentle' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByLabelText('Living crystal')).not.toBeChecked()
    expect(screen.getByLabelText('Side treasures')).not.toBeChecked()
    expect(window.localStorage.getItem(CLOUDWAY_RECIPE_STORAGE_KEY)).toBe(code)
    view.unmount()
    render(() => <CreatorGallery onExit={() => undefined} />)
    expect(screen.getByLabelText('Course seed')).toHaveValue('42')
    fireEvent.click(screen.getByRole('button', { name: 'Launch expedition' }))
    expect(screen.getByTestId('study')).toHaveAttribute(
      'data-level',
      getProceduralCourseIdentity(options),
    )
  })

  it('copies a host-independent code and keeps the full typed recipe', async () => {
    window.localStorage.setItem(
      CLOUDWAY_RECIPE_STORAGE_KEY,
      encodeProceduralCourseCode({ seed: 21 }),
    )
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })
    render(() => <CreatorGallery onExit={() => undefined} />)
    fireEvent.click(screen.getByRole('button', { name: 'Copy course code' }))
    await vi.waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(
        'Course code copied',
      ),
    )
    const code = writeText.mock.calls[0]![0] as string
    expect(decodeProceduralCourseCode(code).seed).toBe(21)
    expect(screen.getByLabelText('Your course code')).toHaveValue(code)
  })

  it.each([
    undefined,
    { writeText: () => Promise.reject(new Error('Denied')) },
  ])(
    'provides selectable code when clipboard is unavailable %#',
    async (clipboard) => {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: clipboard,
      })
      render(() => <CreatorGallery onExit={() => undefined} />)
      fireEvent.click(screen.getByRole('button', { name: 'Copy course code' }))
      await vi.waitFor(() =>
        expect(screen.getByRole('status')).toHaveTextContent('Select and copy'),
      )
      const field = screen.getByLabelText(
        'Your course code',
      ) as HTMLTextAreaElement
      fireEvent.focus(field)
      expect(field.selectionStart).toBe(0)
      expect(field.selectionEnd).toBe(field.value.length)
    },
  )

  it('rejects a URL instead of a course code without changing the current settings', () => {
    render(() => <CreatorGallery onExit={() => undefined} />)
    fireEvent.input(screen.getByLabelText('Course seed'), {
      target: { value: 'my-kept-course' },
    })
    const storedRecipe = window.localStorage.getItem(
      CLOUDWAY_RECIPE_STORAGE_KEY,
    )
    expect(decodeProceduralCourseCode(storedRecipe!).seed).toBe(
      'my-kept-course',
    )
    fireEvent.input(screen.getByLabelText('Course code to import'), {
      target: { value: 'https://example.test/?layout=procedural' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Load course code' }))
    expect(screen.getByRole('alert')).toBeVisible()
    expect(screen.getByLabelText('Course seed')).toHaveValue('my-kept-course')
    expect(window.localStorage.getItem(CLOUDWAY_RECIPE_STORAGE_KEY)).toBe(
      storedRecipe,
    )
    expect(screen.queryByTestId('study')).not.toBeInTheDocument()
  })

  it('keeps the unreadable code when a deliberate replacement cannot be saved', () => {
    window.localStorage.setItem(CLOUDWAY_RECIPE_STORAGE_KEY, '{broken')
    const write = vi
      .spyOn(window.localStorage, 'setItem')
      .mockImplementation(() => {
        throw new Error('Storage denied')
      })
    render(() => <CreatorGallery onExit={() => undefined} />)
    expect(screen.getByLabelText('Course seed')).toHaveValue('celestial-prime')
    expect(write).not.toHaveBeenCalled()
    fireEvent.input(screen.getByLabelText('Course seed'), {
      target: { value: 'replacement' },
    })
    expect(screen.getByText(/Saved settings are unavailable/)).toBeVisible()
    expect(window.localStorage.getItem(CLOUDWAY_RECIPE_STORAGE_KEY)).toBe(
      '{broken',
    )
    expect(screen.getByRole('status')).toHaveTextContent(
      'Your saved course code cannot be read here',
    )
    fireEvent.click(
      screen.getByRole('button', { name: /The archive after dark/ }),
    )
    expect(screen.getByTestId('study')).toHaveAttribute(
      'data-level',
      'glassworks-unbroken-archive/archive-hush',
    )
  })

  it('contains an invalid seed and leaves the studio usable', () => {
    render(() => <CreatorGallery onExit={() => undefined} />)
    fireEvent.input(screen.getByLabelText('Course seed'), {
      target: { value: '' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Launch expedition' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Check the seed')
    expect(screen.queryByTestId('study')).not.toBeInTheDocument()
  })
})
