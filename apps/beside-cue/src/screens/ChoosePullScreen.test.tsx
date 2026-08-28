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
  recordingAvailable = false,
): PullChoicePresentation {
  return {
    pullId,
    art: {
      still: `/art/${pullId}.webp`,
      alt: `${pullId} character`,
    },
    previewCaption: `A caption for ${pullId}.`,
    recordingAvailable,
  }
}

const silentPresentations: readonly PullChoicePresentation[] = [
  ...options.map((option) => presentation(option.id)),
  presentation('custom'),
]

function noop(): void {}

const base = {
  headerLabel: 'Your first plan',
  options,
  presentations: silentPresentations,
  customText: '',
  previewVoiceState: 'unavailable' as const,
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
      expect(preview).not.toHaveAttribute('aria-live')
      expect(preview).not.toHaveAttribute('aria-atomic')
      const liveCopy = within(preview).getByText('Selected Pull').parentElement
      expect(liveCopy).toHaveAttribute('aria-live', 'polite')
      expect(liveCopy).toHaveAttribute('aria-atomic', 'true')
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

  it('offers Hear for an idle delivered recording', () => {
    const onHearPreview = vi.fn()
    const presentations = silentPresentations.map((item) =>
      item.pullId === 'scrolling' ? presentation('scrolling', true) : item,
    )
    render(() => (
      <ChoosePullScreen
        {...base}
        presentations={presentations}
        selectedId="scrolling"
        previewVoiceState="idle"
        onHearPreview={onHearPreview}
      />
    ))

    fireEvent.click(screen.getByRole('button', { name: 'Hear voice' }))
    expect(onHearPreview).toHaveBeenCalledWith('scrolling')
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('shows truthful muted copy without an inert audio button', () => {
    const onHearPreview = vi.fn()
    render(() => (
      <ChoosePullScreen
        {...base}
        presentations={[
          ...silentPresentations.filter((item) => item.pullId !== 'scrolling'),
          presentation('scrolling', true),
        ]}
        selectedId="scrolling"
        previewVoiceState="muted"
        onHearPreview={onHearPreview}
      />
    ))

    expect(screen.getByRole('status')).toHaveTextContent(
      'Voice is muted in Settings. The full caption is shown.',
    )
    expect(
      screen.queryByRole('button', { name: /hear|replay|voice/iu }),
    ).not.toBeInTheDocument()
    expect(onHearPreview).not.toHaveBeenCalled()
  })

  it('does not expose a delivered recording when this runtime cannot play it', () => {
    render(() => (
      <ChoosePullScreen
        {...base}
        presentations={[
          ...silentPresentations.filter((item) => item.pullId !== 'scrolling'),
          presentation('scrolling', true),
        ]}
        selectedId="scrolling"
        previewVoiceState="unavailable"
        onHearPreview={noop}
      />
    ))

    expect(screen.getByText('A caption for scrolling.')).toBeVisible()
    expect(
      screen.queryByRole('button', { name: /hear|replay|voice/iu }),
    ).not.toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it.each([
    {
      state: 'starting' as const,
      button: 'Starting voice…',
      status: 'Voice loading.',
    },
    {
      state: 'playing' as const,
      button: 'Voice playing',
      status: 'Voice playing.',
    },
  ])('disables the voice action while $state', ({ state, button, status }) => {
    const onHearPreview = vi.fn()
    render(() => (
      <ChoosePullScreen
        {...base}
        presentations={[
          ...silentPresentations.filter((item) => item.pullId !== 'scrolling'),
          presentation('scrolling', true),
        ]}
        selectedId="scrolling"
        previewVoiceState={state}
        onHearPreview={onHearPreview}
      />
    ))

    expect(screen.getByRole('button', { name: button })).toBeDisabled()
    expect(screen.getByRole('status')).toHaveTextContent(status)
    fireEvent.click(screen.getByRole('button', { name: button }))
    expect(onHearPreview).not.toHaveBeenCalled()
  })

  it('offers Replay after a delivered recording has stopped', () => {
    const onHearPreview = vi.fn()
    render(() => (
      <ChoosePullScreen
        {...base}
        presentations={[
          ...silentPresentations.filter((item) => item.pullId !== 'scrolling'),
          presentation('scrolling', true),
        ]}
        selectedId="scrolling"
        previewVoiceState="played"
        onHearPreview={onHearPreview}
      />
    ))

    const replay = screen.getByRole('button', { name: 'Replay voice' })
    expect(replay).toBeEnabled()
    expect(screen.getByRole('status')).toHaveTextContent('Voice stopped.')
    fireEvent.click(replay)
    expect(onHearPreview).toHaveBeenCalledWith('scrolling')
  })

  it('keeps the caption and offers a retry when voice playback fails', () => {
    const onHearPreview = vi.fn()
    render(() => (
      <ChoosePullScreen
        {...base}
        presentations={[
          ...silentPresentations.filter((item) => item.pullId !== 'scrolling'),
          presentation('scrolling', true),
        ]}
        selectedId="scrolling"
        previewVoiceState="failed"
        onHearPreview={onHearPreview}
      />
    ))

    expect(screen.getByText('A caption for scrolling.')).toBeVisible()
    expect(screen.getByRole('status')).toHaveTextContent(
      'Voice could not play. The full caption is shown.',
    )
    const retry = screen.getByRole('button', { name: 'Hear voice' })
    expect(retry).toBeEnabled()
    fireEvent.click(retry)
    expect(onHearPreview).toHaveBeenCalledWith('scrolling')
  })

  it('keeps playback status outside the caption live region', () => {
    render(() => (
      <ChoosePullScreen
        {...base}
        presentations={[
          ...silentPresentations.filter((item) => item.pullId !== 'scrolling'),
          presentation('scrolling', true),
        ]}
        selectedId="scrolling"
        previewVoiceState="playing"
        onHearPreview={noop}
      />
    ))

    const preview = screen.getByRole('region', {
      name: /selected Pull preview/iu,
    })
    const liveCopy = within(preview).getByText('Selected Pull').parentElement
    const status = screen.getByRole('status')

    expect(liveCopy).not.toBeNull()
    expect(liveCopy).toHaveAttribute('aria-live', 'polite')
    expect(liveCopy).toHaveAttribute('aria-atomic', 'true')
    expect(
      within(liveCopy as HTMLElement).getByText('Endless scrolling'),
    ).toBeInTheDocument()
    expect(
      within(liveCopy as HTMLElement).getByText('A caption for scrolling.'),
    ).toBeInTheDocument()
    expect(liveCopy).not.toContainElement(status)
    expect(status).toHaveTextContent('Voice playing.')
  })

  it('selects without confirming until the separate action is pressed', () => {
    const [selectedId, setSelectedId] = createSignal<string>()
    const onSelect = vi.fn((id: string) => setSelectedId(id))
    const onContinue = vi.fn()
    render(() => (
      <ChoosePullScreen
        {...base}
        selectedId={selectedId()}
        onSelect={onSelect}
        onContinue={onContinue}
      />
    ))

    expect(
      screen.getByRole('button', { name: /confirm your pull/iu }),
    ).toBeDisabled()
    fireEvent.click(screen.getByRole('radio', { name: /automatic snacking/iu }))
    expect(onSelect).toHaveBeenCalledWith('snacking')
    expect(onContinue).not.toHaveBeenCalled()

    fireEvent.click(
      screen.getByRole('button', {
        name: /confirm automatic snacking/iu,
      }),
    )
    expect(onContinue).toHaveBeenCalledTimes(1)
  })

  it('uses the supplied setup label', () => {
    render(() => <ChoosePullScreen {...base} headerLabel="Change plan" />)

    expect(screen.getByText('Change plan')).toBeInTheDocument()
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
