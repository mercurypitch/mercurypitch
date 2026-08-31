// Guitar Night take-keep prompt tests — discovery, direct Keep, and opt-out.
// ============================================================

import { cleanup, render } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PerformanceTakeKeepState } from '@/lib/use-performance-take-keep'
import { GUITAR_TAKE_KEEP_PROMPT_STORAGE_KEY, useGuitarNightTakeKeepPrompt, } from './useGuitarNightTakeKeepPrompt'

const notifications = vi.hoisted(() => ({
  decision: vi.fn(),
  plain: vi.fn(),
  removeChannel: vi.fn(),
}))

vi.mock('@/stores/notifications-store', () => ({
  showDecisionNotification: notifications.decision,
  showNotification: notifications.plain,
  removeNotificationsByChannel: notifications.removeChannel,
}))

interface HarnessControls {
  setState: (state: PerformanceTakeKeepState) => void
  setBoundaryId: (boundaryId: string | null) => void
  setScoreOpen: (open: boolean) => void
}

function renderPrompt(
  options: {
    onKeep?: () => Promise<boolean>
    onOpenScore?: () => void
  } = {},
): HarnessControls {
  let controls!: HarnessControls

  function Harness() {
    const [state, setState] = createSignal<PerformanceTakeKeepState>('idle')
    const [boundaryId, setBoundaryId] = createSignal<string | null>(null)
    const [scoreOpen, setScoreOpen] = createSignal(false)
    controls = { setState, setBoundaryId, setScoreOpen }
    useGuitarNightTakeKeepPrompt({
      state,
      boundaryId,
      scoreOpen,
      onKeep: options.onKeep ?? vi.fn(async () => true),
      onOpenScore: options.onOpenScore ?? vi.fn(),
    })
    return null
  }

  render(() => <Harness />)
  return controls
}

describe('useGuitarNightTakeKeepPrompt', () => {
  beforeEach(() => {
    globalThis.localStorage.clear()
    vi.clearAllMocks()
  })

  afterEach(cleanup)

  it('offers one non-modal Keep choice for a ready replay outside Score', () => {
    const controls = renderPrompt()

    controls.setBoundaryId('score-run-1')
    controls.setState('ready')

    expect(notifications.decision).toHaveBeenCalledOnce()
    expect(notifications.decision).toHaveBeenCalledWith(
      'Your guitar replay is ready. Keep it in Hear Yourself?',
      'info',
      expect.objectContaining({ label: 'Keep take' }),
      expect.objectContaining({ label: 'Don’t ask again' }),
      expect.objectContaining({ durationMs: 20_000 }),
    )

    controls.setState('processing')
    controls.setState('ready')
    expect(notifications.decision).toHaveBeenCalledOnce()
  })

  it('may offer a later take again when the earlier toast was only dismissed', () => {
    const controls = renderPrompt()
    controls.setBoundaryId('score-run-1')
    controls.setState('ready')

    controls.setBoundaryId('score-run-2')

    expect(notifications.decision).toHaveBeenCalledTimes(2)
  })

  it('keeps directly, confirms success, and stops future prompts', async () => {
    const keep = vi.fn(async () => true)
    const controls = renderPrompt({ onKeep: keep })
    controls.setBoundaryId('score-run-1')
    controls.setState('ready')

    const primary = notifications.decision.mock.calls[0]?.[2] as {
      onClick: () => void
    }
    primary.onClick()
    await Promise.resolve()

    expect(keep).toHaveBeenCalledOnce()
    expect(notifications.plain).toHaveBeenCalledWith(
      'Guitar take kept in Hear Yourself.',
      'success',
      expect.any(Object),
    )
    expect(localStorage.getItem(GUITAR_TAKE_KEEP_PROMPT_STORAGE_KEY)).toBe(
      'true',
    )

    controls.setBoundaryId('score-run-2')
    expect(notifications.decision).toHaveBeenCalledOnce()
  })

  it('opens Score for a retry when direct Keep fails', async () => {
    const openScore = vi.fn()
    const controls = renderPrompt({
      onKeep: vi.fn(async () => false),
      onOpenScore: openScore,
    })
    controls.setBoundaryId('score-run-1')
    controls.setState('ready')

    const primary = notifications.decision.mock.calls[0]?.[2] as {
      onClick: () => void
    }
    primary.onClick()
    await Promise.resolve()

    expect(openScore).toHaveBeenCalledOnce()
  })

  it('honours Don’t ask again without discarding or keeping the replay', () => {
    const keep = vi.fn(async () => true)
    const controls = renderPrompt({ onKeep: keep })
    controls.setBoundaryId('score-run-1')
    controls.setState('ready')

    const secondary = notifications.decision.mock.calls[0]?.[3] as {
      onClick: () => void
    }
    secondary.onClick()

    expect(keep).not.toHaveBeenCalled()
    expect(localStorage.getItem(GUITAR_TAKE_KEEP_PROMPT_STORAGE_KEY)).toBe(
      'true',
    )
    controls.setBoundaryId('score-run-2')
    expect(notifications.decision).toHaveBeenCalledOnce()
  })

  it('does not duplicate the Keep action while Score already exposes it', () => {
    const controls = renderPrompt()
    controls.setScoreOpen(true)
    controls.setBoundaryId('score-run-1')
    controls.setState('ready')

    expect(notifications.decision).not.toHaveBeenCalled()
    expect(notifications.removeChannel).toHaveBeenCalled()
  })
})
