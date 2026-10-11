// ============================================================
// The Fork: one screen, one button (owner decisions V2 and V8)
// ============================================================
//
// After the first note the only button leads into the voiceprint. The
// way out is FirstLight's "Not now" in the rail, tested with the flow in
// FirstLight.test.tsx; this file holds the beat itself to one button and
// to the words agreed for it on 11 Oct 2026. A returning singer also gets
// "Make another voiceprint" (V12): V1 and V8 cover the first-run path.

import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import type { Mock } from 'vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { OnboardingTrack } from '../flow'
import { BeatFork, FORK_COPY } from './BeatFork'
import { VOICEPRINT_STEPS, VOICEPRINT_TIME } from './BeatVoiceprint'

afterEach(cleanup)

const onAnother = vi.fn<() => void>()

function renderFork(
  savedCount: number,
): Mock<(track: OnboardingTrack) => void> {
  const onChoose = vi.fn<(track: OnboardingTrack) => void>()
  onAnother.mockClear()
  render(() => (
    <BeatFork
      firstNote="A3"
      savedCount={savedCount}
      savedWhen={savedCount > 0 ? '10 Oct 2026' : null}
      onChoose={onChoose}
      onAnother={onAnother}
    />
  ))
  return onChoose
}

describe('the first-run Fork', () => {
  it('offers exactly one button, and it starts the voiceprint', () => {
    // Arrange
    const onChoose = renderFork(0)
    const buttons = screen.getAllByRole('button')

    // Act
    fireEvent.click(buttons[0])

    // Assert
    expect(buttons.map((b) => b.textContent)).toEqual(['Find my twin'])
    expect(onChoose).toHaveBeenCalledOnce()
    expect(onChoose).toHaveBeenCalledWith('full')
  })

  it('no longer offers the second card or a skip of its own', () => {
    renderFork(0)

    for (const gone of [/Take me in/, /Map my whole voice/, /^Skip$/, /another/i]) {
      expect(screen.queryByRole('button', { name: gone })).toBeNull()
    }
  })

  it('says the agreed words, word for word', () => {
    renderFork(0)

    expect(screen.getByText('Your first note')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Which legend has a range like yours?',
    )
    expect(
      screen.getByText(
        'About 90 seconds: glide up, glide down, hold a note, then match five. You get your voiceprint and your legend twin.',
      ),
    ).toBeInTheDocument()
  })

  it('promises a range match, never a voice that sings like yours', () => {
    // The twin is matched on range alone (legend-catalog.ts holds ranges),
    // so a headline about how someone sings would promise a comparison
    // of tone the app never makes.
    renderFork(0)

    expect(document.body.textContent).toContain('range like yours')
    expect(document.body.textContent).not.toMatch(/sings? like you/i)
  })

  it('promises the time and the four steps the voiceprint actually runs', () => {
    const body = FORK_COPY.body.toLowerCase()

    expect(body).toContain(VOICEPRINT_TIME)
    expect(VOICEPRINT_STEPS).toHaveLength(4)
    for (const step of ['glide up', 'glide down', 'hold', 'match five']) {
      expect(body).toContain(step)
    }
  })
})

describe('the returning Fork', () => {
  it('leads with the voiceprints already on file', () => {
    // Arrange
    const onChoose = renderFork(2)
    const buttons = screen.getAllByRole('button')

    // Act
    fireEvent.click(buttons[0])

    // Assert
    expect(buttons.map((b) => b.textContent)).toEqual([
      'See my voiceprints',
      'Make another voiceprint',
    ])
    expect(onChoose).toHaveBeenCalledOnce()
    expect(onChoose).toHaveBeenCalledWith('gallery')
    expect(onAnother).not.toHaveBeenCalled()
  })

  it('offers a fresh voiceprint second (owner decision V12)', () => {
    // Arrange
    const onChoose = renderFork(1)

    // Act
    fireEvent.click(
      screen.getByRole('button', { name: 'Make another voiceprint' }),
    )

    // Assert
    expect(onAnother).toHaveBeenCalledOnce()
    expect(onChoose).not.toHaveBeenCalled()
  })
})
