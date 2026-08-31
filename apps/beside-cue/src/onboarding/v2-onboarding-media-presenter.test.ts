// ============================================================
// V2 onboarding media presenter tests — decoded-layer transition authority
// ============================================================

import { describe, expect, it } from 'vitest'
import type { V2OnboardingBrandResource, V2OnboardingMediaPresentationEvidence, V2OnboardingMediaPresentationRequest, V2OnboardingMediaPresenterState, V2OnboardingStillResource, V2OnboardingVideoResource, } from './v2-onboarding-media-presenter'
import { createV2OnboardingMediaPresenterState, requestV2OnboardingMediaPresentation, updateV2OnboardingMediaPresenter, } from './v2-onboarding-media-presenter'

const BRAND: V2OnboardingBrandResource = {
  kind: 'brand',
  alt: 'Beside Cue continues.',
}

function video(src: string): V2OnboardingVideoResource {
  return { kind: 'video', src, alt: `Moving picture ${src}` }
}

function still(src: string): V2OnboardingStillResource {
  return { kind: 'still', src, alt: `Still picture ${src}` }
}

function automaticRequest(
  targetId: string,
  primary = video(`/${targetId}.mp4`),
): V2OnboardingMediaPresentationRequest {
  return {
    targetId,
    targetKind: 'automatic',
    primary,
    reducedStill: still(`/${targetId}-reduced.webp`),
    poster: still(`/${targetId}-poster.webp`),
    brand: BRAND,
  }
}

function holdRequest(targetId: string): V2OnboardingMediaPresentationRequest {
  return {
    targetId,
    targetKind: 'hold',
    primary: still(`/${targetId}-hold.webp`),
    reducedStill: still(`/${targetId}-reduced.webp`),
    poster: still(`/${targetId}-poster.webp`),
    brand: BRAND,
  }
}

function presentIncoming(
  state: V2OnboardingMediaPresenterState,
  evidence: V2OnboardingMediaPresentationEvidence,
): V2OnboardingMediaPresenterState {
  const token = state.incoming?.token
  if (token === undefined) throw new Error('Expected an incoming layer.')
  return updateV2OnboardingMediaPresenter(state, {
    type: 'INCOMING_PRESENTED',
    token,
    evidence,
  })
}

function completeTransition(
  state: V2OnboardingMediaPresenterState,
): V2OnboardingMediaPresenterState {
  const token = state.incoming?.token
  if (token === undefined) throw new Error('Expected an incoming layer.')
  return updateV2OnboardingMediaPresenter(state, {
    type: 'TRANSITION_COMPLETED',
    token,
  })
}

function commitAutomatic(
  state: V2OnboardingMediaPresenterState,
  targetId: string,
  primary?: V2OnboardingVideoResource,
): V2OnboardingMediaPresenterState {
  const requested = requestV2OnboardingMediaPresentation(
    state,
    automaticRequest(targetId, primary),
  )
  return completeTransition(presentIncoming(requested, 'decoded-video-frame'))
}

describe('V2 onboarding media presenter', () => {
  it('keeps the exact decoded automatic layer until the next frame transition completes', () => {
    const outgoingVideo = video('/outgoing.mp4')
    let state = commitAutomatic(
      createV2OnboardingMediaPresenterState('normal'),
      'outgoing',
      outgoingVideo,
    )
    const outgoingLayer = state.current

    state = requestV2OnboardingMediaPresentation(
      state,
      automaticRequest('incoming'),
    )
    const token = state.incoming?.token ?? ''

    expect(state.current).toBe(outgoingLayer)
    expect(state.current?.candidate.resource).toBe(outgoingVideo)
    expect(state.incoming?.phase).toBe('loading')

    const afterMetadata = updateV2OnboardingMediaPresenter(state, {
      type: 'INCOMING_METADATA_READY',
      token,
    })
    const afterPlay = updateV2OnboardingMediaPresenter(state, {
      type: 'INCOMING_PLAYING',
      token,
    })
    const afterWrongDecode = updateV2OnboardingMediaPresenter(state, {
      type: 'INCOMING_PRESENTED',
      token,
      evidence: 'decoded-still',
    })

    expect(afterMetadata).toBe(state)
    expect(afterPlay).toBe(state)
    expect(afterWrongDecode).toBe(state)

    state = updateV2OnboardingMediaPresenter(state, {
      type: 'INCOMING_PRESENTED',
      token,
      evidence: 'decoded-video-frame',
    })
    expect(state.incoming?.phase).toBe('revealed')
    expect(state.current).toBe(outgoingLayer)
    expect(state.current?.candidate.resource).toBe(outgoingVideo)

    state = updateV2OnboardingMediaPresenter(state, {
      type: 'TRANSITION_COMPLETED',
      token,
    })
    expect(state.incoming).toBeUndefined()
    expect(state.current?.targetId).toBe('incoming')
    expect(state.current?.candidate.resource).toMatchObject({
      kind: 'video',
      src: '/incoming.mp4',
    })
  })

  it('does not replace an outgoing video with a lossy WebP while a hold decodes', () => {
    const outgoingVideo = video('/outgoing-exact-decoded-layer.mp4')
    let state = commitAutomatic(
      createV2OnboardingMediaPresenterState('normal'),
      'outgoing',
      outgoingVideo,
    )
    const outgoingLayer = state.current

    state = requestV2OnboardingMediaPresentation(state, holdRequest('choice'))
    expect(state.current).toBe(outgoingLayer)
    expect(state.current?.candidate.resource).toBe(outgoingVideo)
    expect(state.incoming?.candidate.resource).toMatchObject({
      kind: 'still',
      src: '/choice-hold.webp',
    })

    const beforeDecode = state
    const token = state.incoming?.token ?? ''
    expect(
      updateV2OnboardingMediaPresenter(state, {
        type: 'TRANSITION_COMPLETED',
        token,
      }),
    ).toBe(beforeDecode)

    state = presentIncoming(state, 'decoded-still')
    expect(state.current).toBe(outgoingLayer)
    expect(state.current?.candidate.resource).toBe(outgoingVideo)

    state = completeTransition(state)
    expect(state.current?.targetKind).toBe('hold')
    expect(state.current?.candidate.resource).toMatchObject({
      kind: 'still',
      src: '/choice-hold.webp',
    })
  })

  it('ignores every stale readiness, failure, and transition callback', () => {
    let state = commitAutomatic(
      createV2OnboardingMediaPresenterState('normal'),
      'outgoing',
    )
    const outgoingLayer = state.current
    state = requestV2OnboardingMediaPresentation(
      state,
      automaticRequest('first-incoming'),
    )
    const retiredToken = state.incoming?.token ?? ''

    state = updateV2OnboardingMediaPresenter(state, {
      type: 'INCOMING_FAILED',
      token: retiredToken,
    })
    expect(state.incoming?.candidate.stage).toBe('retry')
    const retryState = state

    for (const event of [
      {
        type: 'INCOMING_PRESENTED' as const,
        token: retiredToken,
        evidence: 'decoded-video-frame' as const,
      },
      { type: 'INCOMING_FAILED' as const, token: retiredToken },
      { type: 'TRANSITION_COMPLETED' as const, token: retiredToken },
    ]) {
      expect(updateV2OnboardingMediaPresenter(state, event)).toBe(retryState)
    }

    const retryToken = state.incoming?.token ?? ''
    state = updateV2OnboardingMediaPresenter(state, {
      type: 'INCOMING_PRESENTED',
      token: retryToken,
      evidence: 'decoded-video-frame',
    })
    state = requestV2OnboardingMediaPresentation(
      state,
      automaticRequest('newer-incoming'),
    )
    const newerState = state

    expect(
      updateV2OnboardingMediaPresenter(state, {
        type: 'TRANSITION_COMPLETED',
        token: retryToken,
      }),
    ).toBe(newerState)
    expect(state.current).toBe(outgoingLayer)
    expect(state.incoming?.targetId).toBe('newer-incoming')
  })

  it('walks the recovery chain without replacing its known-good current layer', () => {
    let state = commitAutomatic(
      createV2OnboardingMediaPresenterState('normal'),
      'known-good',
    )
    const knownGoodLayer = state.current
    const knownGoodResource = state.current?.candidate.resource
    state = requestV2OnboardingMediaPresentation(
      state,
      automaticRequest('failing'),
    )

    const observed = [
      {
        stage: state.incoming?.candidate.stage,
        resource: state.incoming?.candidate.resource,
      },
    ]
    while (state.incoming?.candidate.stage !== 'brand') {
      const token = state.incoming?.token
      if (token === undefined) throw new Error('Expected recovery candidate.')
      state = updateV2OnboardingMediaPresenter(state, {
        type: 'INCOMING_FAILED',
        token,
      })
      expect(state.current).toBe(knownGoodLayer)
      observed.push({
        stage: state.incoming?.candidate.stage,
        resource: state.incoming?.candidate.resource,
      })
    }

    expect(observed.map((entry) => entry.stage)).toEqual([
      'primary',
      'retry',
      'reduced-still',
      'poster',
      'last-known-good',
      'brand',
    ])
    expect(observed[4]?.resource).toBe(knownGoodResource)
    expect(state.current).toBe(knownGoodLayer)

    const brandToken = state.incoming?.token ?? ''
    expect(
      updateV2OnboardingMediaPresenter(state, {
        type: 'INCOMING_FAILED',
        token: brandToken,
      }),
    ).toBe(state)

    state = updateV2OnboardingMediaPresenter(state, {
      type: 'INCOMING_PRESENTED',
      token: brandToken,
      evidence: 'native-brand',
    })
    expect(state.current).toBe(knownGoodLayer)
    state = updateV2OnboardingMediaPresenter(state, {
      type: 'TRANSITION_COMPLETED',
      token: brandToken,
    })
    expect(state.current?.candidate.stage).toBe('brand')
    expect(state.lastKnownGood).toBe(knownGoodResource)
  })

  it('uses still-only recovery in reduced-motion mode', () => {
    let state = requestV2OnboardingMediaPresentation(
      createV2OnboardingMediaPresenterState('reduced'),
      automaticRequest('reduced-opening'),
    )

    expect(state.incoming?.candidate.stage).toBe('reduced-still')
    expect(state.incoming?.candidate.resource).toMatchObject({
      kind: 'still',
      src: '/reduced-opening-reduced.webp',
    })
    expect(
      state.incoming?.candidates.some(
        (candidate) => candidate.resource.kind === 'video',
      ),
    ).toBe(false)

    const firstToken = state.incoming?.token ?? ''
    state = updateV2OnboardingMediaPresenter(state, {
      type: 'INCOMING_FAILED',
      token: firstToken,
    })
    expect(state.incoming?.candidate.stage).toBe('retry')
    expect(state.incoming?.candidate.resource.kind).toBe('still')

    state = presentIncoming(state, 'decoded-still')
    expect(state.incoming?.phase).toBe('revealed')
    state = completeTransition(state)
    expect(state.current?.candidate.resource.kind).toBe('still')
  })
})
