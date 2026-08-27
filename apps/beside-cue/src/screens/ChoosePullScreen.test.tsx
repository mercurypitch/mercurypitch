// Pull selection tests lock image-first choice, caption-first preview and explicit confirmation.
import { fireEvent, render, screen, within } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { pullOptions } from '@/content'
import type { PullChoicePresentation } from './ChoosePullScreen'
import { ChoosePullScreen } from './ChoosePullScreen'

const options = pullOptions

function presentation(
  pullId: string,
  previewAudio?: string,
): PullChoicePresentation {
  return {
    pullId,
    art: {
      still: `/art/${pullId}.webp`,
      alt: `${pullId} character`,
    },
    previewCaption: `A caption for ${pullId}.`,
    ...(previewAudio === undefined ? {} : { previewAudio }),
  }
}

const silentPresentations: readonly PullChoicePresentation[] = [
  ...options.map((option) => presentation(option.id)),
  presentation('custom'),
]

function noop(): void {}

const base = {
  options,
  presentations: silentPresentations,
  customText: '',
  onSelect: noop,
  onCustomInput: noop,
  onBack: noop,
  onContinue: noop,
}

beforeEach(() => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('choose Pull screen', () => {
  it('presents six image-led choices and one custom choice', () => {
    render(() => <ChoosePullScreen {...base} />)

    const choices = screen.getAllByRole('radio')
    expect(choices).toHaveLength(7)

    for (const choice of choices) {
      const surface = choice.nextElementSibling
      expect(surface).not.toBeNull()
      const firstContent = surface?.querySelector('img, strong')
      expect(firstContent?.tagName).toBe('IMG')
    }

    expect(
      screen.getByRole('radio', { name: /something else/iu }),
    ).toBeInTheDocument()
  })

  it('keeps the selected caption visible without showing dead audio UI', () => {
    render(() => <ChoosePullScreen {...base} selectedId="scrolling" />)

    const preview = screen.getByRole('region', {
      name: /selected Pull preview/iu,
    })
    expect(within(preview).getByText('Endless scrolling')).toBeInTheDocument()
    expect(
      within(preview).getByText('A caption for scrolling.'),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /hear|replay/iu }),
    ).not.toBeInTheDocument()
  })

  it('resets route entry to the top and focuses the decision heading', async () => {
    const scrollTo = vi.mocked(window.scrollTo)
    render(() => <ChoosePullScreen {...base} />)

    await Promise.resolve()

    expect(scrollTo).toHaveBeenCalledOnce()
    expect(scrollTo).toHaveBeenCalledWith({
      top: 0,
      left: 0,
      behavior: 'auto',
    })
    expect(
      screen.getByRole('heading', {
        name: /which Pull do you want to notice sooner/iu,
      }),
    ).toHaveFocus()
  })

  it('reveals a changed selection without preview-scrolling the initial render or stealing radio focus', async () => {
    const scrollIntoView = vi.fn()
    const originalScrollIntoView = Object.getOwnPropertyDescriptor(
      Element.prototype,
      'scrollIntoView',
    )
    Object.defineProperty(Element.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoView,
    })

    try {
      const [selectedId, setSelectedId] = createSignal('scrolling')
      render(() => (
        <ChoosePullScreen
          {...base}
          selectedId={selectedId()}
          onSelect={setSelectedId}
        />
      ))

      await Promise.resolve()
      expect(scrollIntoView).not.toHaveBeenCalled()

      const nextChoice = screen.getByRole('radio', {
        name: /automatic snacking/iu,
      })
      nextChoice.focus()
      fireEvent.click(nextChoice)
      await Promise.resolve()

      expect(scrollIntoView).toHaveBeenCalledOnce()
      expect(scrollIntoView).toHaveBeenCalledWith({
        block: 'center',
        behavior: 'smooth',
      })
      expect(nextChoice).toHaveFocus()

      const preview = screen.getByRole('region', {
        name: /selected Pull preview/iu,
      })
      expect(preview).toHaveAttribute('tabindex', '-1')
      expect(preview).toHaveAttribute('aria-live', 'polite')
      expect(preview).toHaveAttribute('aria-atomic', 'true')
      expect(within(preview).getByText('Automatic snacking')).toBeVisible()
    } finally {
      if (originalScrollIntoView === undefined) {
        Reflect.deleteProperty(Element.prototype, 'scrollIntoView')
      } else {
        Object.defineProperty(
          Element.prototype,
          'scrollIntoView',
          originalScrollIntoView,
        )
      }
    }
  })

  it('offers Hear and Replay only for a delivered recording', () => {
    const onHearPreview = vi.fn()
    const presentations = silentPresentations.map((item) =>
      item.pullId === 'scrolling'
        ? presentation('scrolling', '/voice/scrolling.m4a')
        : item,
    )
    const { unmount } = render(() => (
      <ChoosePullScreen
        {...base}
        presentations={presentations}
        selectedId="scrolling"
        onHearPreview={onHearPreview}
      />
    ))

    fireEvent.click(screen.getByRole('button', { name: 'Hear voice' }))
    expect(onHearPreview).toHaveBeenCalledWith('scrolling')

    unmount()
    render(() => (
      <ChoosePullScreen
        {...base}
        presentations={presentations}
        selectedId="scrolling"
        playedPreviewId="scrolling"
        onHearPreview={onHearPreview}
      />
    ))
    expect(
      screen.getByRole('button', { name: 'Replay voice' }),
    ).toBeInTheDocument()
  })

  it('selects without confirming until the separate action is pressed', () => {
    const onSelect = vi.fn()
    const onContinue = vi.fn()
    render(() => (
      <ChoosePullScreen {...base} onSelect={onSelect} onContinue={onContinue} />
    ))

    fireEvent.click(screen.getByRole('radio', { name: /automatic snacking/iu }))
    expect(onSelect).toHaveBeenCalledWith('snacking')
    expect(onContinue).not.toHaveBeenCalled()

    fireEvent.click(
      screen.getByRole('button', {
        name: /choose what I’ll do instead/iu,
      }),
    )
    expect(onContinue).toHaveBeenCalledTimes(1)
  })

  it('keeps a custom Pull editable and private', () => {
    const onCustomInput = vi.fn()
    render(() => (
      <ChoosePullScreen
        {...base}
        selectedId="custom"
        customText="Opening the feed again"
        onCustomInput={onCustomInput}
      />
    ))

    const input = screen.getByRole('textbox', { name: 'Your words' })
    expect(input).toHaveValue('Opening the feed again')
    expect(screen.getByText('Stored only on this device.')).toBeInTheDocument()

    fireEvent.input(input, { target: { value: 'Checking one more update' } })
    expect(onCustomInput).toHaveBeenCalledWith('Checking one more update')
  })
})
