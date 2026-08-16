import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  cancelUvrPipeline: vi.fn(),
  cancelUvrSession: vi.fn(),
  getUvrSession: vi.fn(),
}))

vi.mock('@/lib/uvr-processing-pipeline', () => ({
  cancelUvrPipeline: mocks.cancelUvrPipeline,
}))

vi.mock('@/stores/uvr-store', () => ({
  cancelUvrSession: mocks.cancelUvrSession,
  getUvrSession: mocks.getUvrSession,
}))

import { cancelPitchTestingUvrSession, preservePitchTestingUvrCancellation, settlePitchTestingUvrError, } from './pitch-testing-uvr-cancellation'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('cancelPitchTestingUvrSession', () => {
  it('routes server cancellation through the persisted provider job id', () => {
    mocks.getUvrSession.mockReturnValue({
      sessionId: 'uvr-session-local',
      apiSessionId: 'runpod-provider-job',
      processingMode: 'server',
    })

    const controller = new AbortController()
    cancelPitchTestingUvrSession('uvr-session-local', 'server', controller)

    expect(mocks.cancelUvrPipeline).toHaveBeenCalledWith(
      'server',
      'runpod-provider-job',
    )
    expect(mocks.cancelUvrSession).toHaveBeenCalledWith('uvr-session-local')
    expect(controller.signal.aborted).toBe(true)
  })

  it('cancels local processing without inventing a provider id', () => {
    mocks.getUvrSession.mockReturnValue({
      sessionId: 'uvr-session-local',
      processingMode: 'local',
    })

    const controller = new AbortController()
    cancelPitchTestingUvrSession('uvr-session-local', 'local', controller)

    expect(mocks.cancelUvrPipeline).toHaveBeenCalledWith('local', undefined)
    expect(mocks.cancelUvrSession).toHaveBeenCalledWith('uvr-session-local')
    expect(controller.signal.aborted).toBe(true)
  })

  it('still aborts an early server run before its provider id is stored', () => {
    mocks.getUvrSession.mockReturnValue({
      sessionId: 'uvr-session-early',
      processingMode: 'server',
    })
    const controller = new AbortController()

    cancelPitchTestingUvrSession('uvr-session-early', 'server', controller)

    expect(controller.signal.aborted).toBe(true)
    expect(mocks.cancelUvrPipeline).toHaveBeenCalledWith('server', undefined)
    expect(mocks.cancelUvrSession).toHaveBeenCalledWith('uvr-session-early')
  })

  it('restores cancelled state when a local worker completes late', () => {
    const controller = new AbortController()
    mocks.getUvrSession.mockReturnValue({
      sessionId: 'uvr-session-late-local',
      processingMode: 'local',
    })
    cancelPitchTestingUvrSession('uvr-session-late-local', 'local', controller)
    mocks.cancelUvrSession.mockClear()

    expect(
      preservePitchTestingUvrCancellation(
        'uvr-session-late-local',
        controller.signal,
      ),
    ).toBe(true)
    expect(mocks.cancelUvrSession).toHaveBeenCalledWith(
      'uvr-session-late-local',
    )
  })

  it('restores cancelled state when teardown receives a late local error', () => {
    const controller = new AbortController()
    const onReportError = vi.fn()
    const onSettleUi = vi.fn()
    mocks.getUvrSession.mockReturnValue({
      sessionId: 'uvr-session-unmounted',
      processingMode: 'local',
    })
    cancelPitchTestingUvrSession('uvr-session-unmounted', 'local', controller)
    mocks.cancelUvrSession.mockClear()

    settlePitchTestingUvrError({
      sessionId: 'uvr-session-unmounted',
      signal: controller.signal,
      error: 'Late worker write failed',
      disposed: true,
      onReportError,
      onSettleUi,
    })

    expect(mocks.cancelUvrSession).toHaveBeenCalledWith('uvr-session-unmounted')
    expect(onReportError).not.toHaveBeenCalled()
    expect(onSettleUi).not.toHaveBeenCalled()
  })

  it('reports active provider failures before settling the Lab controls', () => {
    const onReportError = vi.fn()
    const onSettleUi = vi.fn()

    settlePitchTestingUvrError({
      sessionId: 'uvr-session-failed',
      signal: new AbortController().signal,
      error: 'Provider failed',
      disposed: false,
      onReportError,
      onSettleUi,
    })

    expect(onReportError).toHaveBeenCalledWith('Provider failed')
    expect(onSettleUi).toHaveBeenCalledOnce()
    expect(mocks.cancelUvrSession).not.toHaveBeenCalled()
  })

  it('does not alter a session whose run is still active', () => {
    const controller = new AbortController()

    expect(
      preservePitchTestingUvrCancellation(
        'uvr-session-active',
        controller.signal,
      ),
    ).toBe(false)
    expect(mocks.cancelUvrSession).not.toHaveBeenCalled()
  })
})
