// ============================================================
// The stage: a drill opens on its console, runs to its pads, colours
// a reveal in words as well as colour, and lands on a plate.
// ============================================================

import { cleanup, fireEvent, render, screen, waitFor, within, } from '@solidjs/testing-library'
import type { JSX } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EngineContext } from '@/contexts/EngineContext'
import type { AudioEngine } from '@/lib/audio-engine'
import type { PlaybackRuntime } from '@/lib/playback-runtime'
import type { PracticeEngine } from '@/lib/practice-engine'
import { earInfoOpen, resetEarLabStore } from '@/stores/ear-lab-store'
import { HairlineDrill } from './HairlineDrill'
import { HomeDrill } from './HomeDrill'

/** A silent engine: every tone resolves at once, nothing is scheduled. */
function fakeEngine() {
  return {
    playTone: vi.fn(async () => undefined),
    stopTone: vi.fn(),
    init: vi.fn(async () => undefined),
    resume: vi.fn(async () => undefined),
    getAudioContext: () => null,
  }
}

function withEngine(engine: ReturnType<typeof fakeEngine>) {
  return (props: { children: JSX.Element }) => (
    <EngineContext.Provider
      value={{
        audioEngine: engine as unknown as AudioEngine,
        playbackRuntime: {} as PlaybackRuntime,
        practiceEngine: {} as PracticeEngine,
        ready: () => true,
      }}
    >
      {props.children}
    </EngineContext.Provider>
  )
}

const pad = (label: string) =>
  screen.getByText(label).closest('button') as HTMLButtonElement

describe('EarStage with Hairline', () => {
  beforeEach(() => {
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue()
    localStorage.clear()
    resetEarLabStore()
  })

  afterEach(() => cleanup())

  it('opens on the bench console and leaves through Back', () => {
    const onBack = vi.fn()
    const Engine = withEngine(fakeEngine())
    const { container } = render(() => (
      <Engine>
        <HairlineDrill onBack={onBack} />
      </Engine>
    ))
    expect(
      container.querySelector('[data-ear-drill="hairline"]'),
    ).not.toBeNull()
    expect(
      container.querySelector('[data-instrument="vernier"]'),
    ).not.toBeNull()
    expect(screen.getByText('Practice run')).toBeTruthy()
    expect(screen.getByText('Calibration')).toBeTruthy()
    expect(screen.getByTestId('ear-stage-progress').textContent).toBe(
      'Unmeasured',
    )
    fireEvent.click(screen.getByLabelText('Back to the bench'))
    expect(onBack).toHaveBeenCalledTimes(1)
  })

  it('runs a practice trial to its pads, says the verdict, and stops on a plate', async () => {
    const engine = fakeEngine()
    const Engine = withEngine(engine)
    const { container } = render(() => (
      <Engine>
        <HairlineDrill onBack={() => undefined} />
      </Engine>
    ))
    fireEvent.click(pad('Practice run'))
    expect(screen.getByLabelText('Stop')).toBeTruthy()

    await waitFor(() => expect(pad('The first').disabled).toBe(false), {
      timeout: 3000,
    })
    expect(engine.playTone).toHaveBeenCalledTimes(2)
    expect(screen.getByTestId('ear-stage-status').textContent).toContain(
      'Which tone was higher',
    )

    fireEvent.click(pad('The first'))
    const marked = container.querySelectorAll('[data-state]')
    expect(marked.length).toBeGreaterThan(0)
    expect(
      container.querySelector('[data-state="right"]'),
      'the true pad is marked right',
    ).not.toBeNull()
    expect(screen.getByTestId('ear-stage-status').textContent).toMatch(
      /was higher by [\d.]+¢/,
    )

    fireEvent.click(screen.getByLabelText('Stop'))
    expect(engine.stopTone).toHaveBeenCalled()
    expect(screen.getByTestId('ear-stage-plate')).toBeTruthy()
    expect(screen.getByText('Back to the bench')).toBeTruthy()
    expect(container.textContent).not.toMatch(/\d%/)
  })

  it('abandons a calibration without marking the glass', async () => {
    const Engine = withEngine(fakeEngine())
    render(() => (
      <Engine>
        <HairlineDrill onBack={() => undefined} ritual />
      </Engine>
    ))
    // The sealed protocol opens at rest: the pendulums, the protocol
    // line, an amber Begin instead of Practice.
    expect(screen.getByTestId('ear-stage-progress').textContent).toContain(
      'Three short staircases',
    )
    expect(
      document.querySelector('[data-instrument="pendulums"]'),
    ).not.toBeNull()
    expect(screen.queryByText('Practice run')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /Begin/ }))
    expect(screen.getByLabelText('Stop')).toBeTruthy()
    expect(screen.getByTestId('ear-stage-progress').textContent).toContain(
      'Track',
    )
    await waitFor(() => expect(pad('The first').disabled).toBe(false), {
      timeout: 3000,
    })
    fireEvent.click(screen.getByLabelText('Stop'))
    const plate = screen.getByTestId('ear-stage-plate')
    expect(plate.textContent).toContain('nothing was marked')
  })
})

describe('EarStage with Home', () => {
  beforeEach(() => {
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue()
    localStorage.clear()
    resetEarLabStore()
  })

  afterEach(() => cleanup())

  it('offers tap or sing, then raises the seven-rung ladder', () => {
    const Engine = withEngine(fakeEngine())
    const { container } = render(() => (
      <Engine>
        <HomeDrill onBack={() => undefined} />
      </Engine>
    ))
    expect(container.querySelector('[data-instrument="fork"]')).not.toBeNull()
    expect(screen.getByRole('radio', { name: 'Tap' })).toBeTruthy()
    expect(screen.getByRole('radio', { name: 'Sing or play' })).toBeTruthy()

    fireEvent.click(pad('Begin'))
    const rungs = screen
      .getByTestId('ear-stage-pads')
      .querySelectorAll('button')
    expect(rungs).toHaveLength(7)
    expect(screen.getByText('Sol')).toBeTruthy()
  })
})

describe('the instrument card', () => {
  beforeEach(() => {
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue()
    localStorage.clear()
    resetEarLabStore()
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  /** The stage reads its breakpoint as a media query. */
  function stubCompact(matches: boolean) {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({
        matches,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    )
  }

  const mount = () => {
    const Engine = withEngine(fakeEngine())
    return render(() => (
      <Engine>
        <HairlineDrill onBack={() => undefined} />
      </Engine>
    ))
  }

  it('hangs the caption and the paragraph on the stage, not under the pads', () => {
    mount()
    const card = screen.getByTestId('ear-instrument-card')
    expect(card.getAttribute('aria-label')).toBe('About Hairline')
    expect(card.textContent).toContain('Resolution · cents')
    expect(card.textContent).toContain('Two tones; pick the higher one.')
    expect(card.dataset.open).toBe('false')
    expect(screen.getByTestId('ear-stage-console').textContent).not.toContain(
      'Two tones; pick the higher one.',
    )
  })

  it('More unfolds the text, and the drill remembers it', () => {
    const first = mount()
    fireEvent.click(screen.getByRole('button', { name: 'More' }))
    expect(screen.getByTestId('ear-instrument-card').dataset.open).toBe('true')
    expect(screen.getByRole('button', { name: 'Less' })).toBeTruthy()
    expect(earInfoOpen('hairline')).toBe(true)
    expect(earInfoOpen('leap')).toBe(false)
    first.unmount()
    mount()
    expect(screen.getByTestId('ear-instrument-card').dataset.open).toBe('true')
  })

  it('folds to one row on a phone and unfolds over the instrument', () => {
    stubCompact(true)
    mount()
    const head = screen.getByRole('button', { name: 'About Hairline' })
    expect(head.getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByText(/Two tones; pick the higher one/)).toBeNull()
    expect(screen.queryByRole('button', { name: 'More' })).toBeNull()
    fireEvent.click(head)
    expect(head.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByText(/Two tones; pick the higher one/)).toBeTruthy()
    expect(screen.getByText('Resolution · cents')).toBeTruthy()
    expect(earInfoOpen('hairline')).toBe(true)
  })
})

describe('the question as the headline', () => {
  beforeEach(() => {
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue()
    localStorage.clear()
    resetEarLabStore()
  })

  afterEach(() => cleanup())

  it('heads the console with the status and names the answer keys under it', async () => {
    const Engine = withEngine(fakeEngine())
    render(() => (
      <Engine>
        <HairlineDrill onBack={() => undefined} />
      </Engine>
    ))
    const console = screen.getByTestId('ear-stage-console')
    expect(within(console).getByTestId('ear-stage-status')).toBeTruthy()
    expect(document.querySelector('figcaption')).toBeNull()
    // Space alone stays with the pad that shows it.
    expect(screen.queryByTestId('ear-stage-keys')).toBeNull()
    fireEvent.click(pad('Practice run'))
    await waitFor(() => expect(pad('The first').disabled).toBe(false), {
      timeout: 3000,
    })
    expect(screen.getByTestId('ear-stage-keys').textContent).toBe(
      '1 · 2 on the keyboard',
    )
    // The lead pad says the phase word only.
    expect(pad('Your call').textContent).toBe('Your call')
  })
})

describe('keys by code', () => {
  beforeEach(() => {
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue()
    localStorage.clear()
    resetEarLabStore()
  })

  afterEach(() => cleanup())

  it('answers on a numpad digit', async () => {
    const Engine = withEngine(fakeEngine())
    render(() => (
      <Engine>
        <HairlineDrill onBack={() => undefined} />
      </Engine>
    ))
    fireEvent.click(pad('Practice run'))
    await waitFor(() => expect(pad('The first').disabled).toBe(false), {
      timeout: 3000,
    })
    fireEvent.keyDown(document, { key: 'End', code: 'Numpad1' })
    expect(pad('The first').disabled).toBe(true)
    expect(pad('The first').getAttribute('data-state')).not.toBeNull()
  })
})

describe('a key the browser took', () => {
  beforeEach(() => {
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue()
    localStorage.clear()
    resetEarLabStore()
  })

  afterEach(() => cleanup())

  async function armed() {
    const Engine = withEngine(fakeEngine())
    render(() => (
      <Engine>
        <HairlineDrill onBack={() => undefined} />
      </Engine>
    ))
    fireEvent.click(pad('Practice run'))
    await waitFor(() => expect(pad('The first').disabled).toBe(false), {
      timeout: 3000,
    })
  }

  it('says so once when a registered key comes up without going down', async () => {
    await armed()
    // A key pressed before the pads armed is not a swallowed one.
    fireEvent.keyDown(document, { key: 'a', code: 'KeyA' })
    fireEvent.keyUp(document, { key: 'a', code: 'KeyA' })
    expect(screen.queryByTestId('ear-stage-swallowed')).toBeNull()
    fireEvent.keyUp(document, { key: '1', code: 'Digit1' })
    expect(screen.getByTestId('ear-stage-swallowed').textContent).toContain(
      'Vimium',
    )
    // The pads still wait: nothing answered.
    expect(pad('The first').disabled).toBe(false)
    // A digit that arrives whole clears the note and answers.
    fireEvent.keyDown(document, { key: '2', code: 'Digit2' })
    fireEvent.keyUp(document, { key: '2', code: 'Digit2' })
    expect(screen.queryByTestId('ear-stage-swallowed')).toBeNull()
    expect(pad('The second').disabled).toBe(true)
  })
})
