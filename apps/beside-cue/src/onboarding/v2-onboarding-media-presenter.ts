// ============================================================
// V2 onboarding media presenter — pure dual-layer transition authority
// ============================================================
//
// A decoded outgoing layer stays mounted until its successor has decoded data,
// started playback, and completed the visual transition. Independently encoded
// hold plates are recovery candidates, never implicit bridges between clips.

export type V2OnboardingMediaMode = 'normal' | 'reduced'

export type V2OnboardingMediaTargetKind = 'automatic' | 'hold'

export type V2OnboardingMediaRecoveryStage =
  | 'primary'
  | 'retry'
  | 'reduced-still'
  | 'poster'
  | 'last-known-good'
  | 'brand'

export interface V2OnboardingVideoResource {
  readonly kind: 'video'
  readonly src: string
  readonly alt: string
}

export interface V2OnboardingStillResource {
  readonly kind: 'still'
  readonly src: string
  readonly alt: string
}

export interface V2OnboardingBrandResource {
  readonly kind: 'brand'
  readonly alt: string
}

export type V2OnboardingMediaResource =
  | V2OnboardingVideoResource
  | V2OnboardingStillResource
  | V2OnboardingBrandResource

export type V2OnboardingLoadableResource =
  | V2OnboardingVideoResource
  | V2OnboardingStillResource

export interface V2OnboardingMediaPresentationRequest {
  readonly targetId: string
  readonly targetKind: V2OnboardingMediaTargetKind
  readonly primary: V2OnboardingLoadableResource
  readonly reducedStill: V2OnboardingStillResource
  readonly poster: V2OnboardingStillResource
  readonly brand: V2OnboardingBrandResource
}

export interface V2OnboardingMediaCandidate {
  readonly stage: V2OnboardingMediaRecoveryStage
  readonly resource: V2OnboardingMediaResource
}

export type V2OnboardingMediaPresentationEvidence =
  | 'decoded-video-frame'
  | 'decoded-still'
  | 'native-brand'

export interface V2OnboardingPresentedLayer {
  readonly targetId: string
  readonly targetKind: V2OnboardingMediaTargetKind
  readonly token: string
  readonly candidate: V2OnboardingMediaCandidate
  readonly evidence: V2OnboardingMediaPresentationEvidence
}

export interface V2OnboardingIncomingLayer {
  readonly targetId: string
  readonly targetKind: V2OnboardingMediaTargetKind
  readonly token: string
  readonly candidates: readonly V2OnboardingMediaCandidate[]
  readonly candidateIndex: number
  readonly candidate: V2OnboardingMediaCandidate
  readonly phase: 'loading' | 'revealed'
  readonly evidence?: V2OnboardingMediaPresentationEvidence
}

export interface V2OnboardingMediaPresenterState {
  readonly mode: V2OnboardingMediaMode
  readonly generation: number
  /** Remains the visual authority until the incoming transition completes. */
  readonly current?: V2OnboardingPresentedLayer
  readonly incoming?: V2OnboardingIncomingLayer
  readonly lastKnownGood?: V2OnboardingLoadableResource
}

export type V2OnboardingMediaPresenterEvent =
  | {
      readonly type: 'INCOMING_METADATA_READY'
      readonly token: string
    }
  | {
      readonly type: 'INCOMING_PLAYING'
      readonly token: string
    }
  | {
      readonly type: 'INCOMING_PRESENTED'
      readonly token: string
      readonly evidence: V2OnboardingMediaPresentationEvidence
    }
  | {
      readonly type: 'INCOMING_FAILED'
      readonly token: string
    }
  | {
      readonly type: 'TRANSITION_COMPLETED'
      readonly token: string
    }

function resourceKey(resource: V2OnboardingMediaResource): string {
  return resource.kind === 'brand'
    ? `brand:${resource.alt}`
    : `${resource.kind}:${resource.src}`
}

function appendLastKnownGood(
  candidates: V2OnboardingMediaCandidate[],
  lastKnownGood: V2OnboardingLoadableResource | undefined,
): void {
  if (
    lastKnownGood === undefined ||
    candidates.some(
      (candidate) =>
        resourceKey(candidate.resource) === resourceKey(lastKnownGood),
    )
  ) {
    return
  }

  candidates.push({
    stage: 'last-known-good',
    resource: lastKnownGood,
  })
}

function buildCandidates(
  state: V2OnboardingMediaPresenterState,
  request: V2OnboardingMediaPresentationRequest,
): readonly V2OnboardingMediaCandidate[] {
  const candidates: V2OnboardingMediaCandidate[] = []

  if (state.mode === 'normal') {
    candidates.push(
      { stage: 'primary', resource: request.primary },
      { stage: 'retry', resource: request.primary },
      { stage: 'reduced-still', resource: request.reducedStill },
    )
  } else {
    // Reduced motion never mounts the moving primary. The authored still gets
    // one retry before the less-specific poster fallback.
    candidates.push(
      { stage: 'reduced-still', resource: request.reducedStill },
      { stage: 'retry', resource: request.reducedStill },
    )
  }

  candidates.push({ stage: 'poster', resource: request.poster })
  appendLastKnownGood(candidates, state.lastKnownGood)
  candidates.push({ stage: 'brand', resource: request.brand })
  return candidates
}

function candidateToken(
  targetId: string,
  generation: number,
  candidateIndex: number,
): string {
  return `${String(generation)}:${String(candidateIndex)}:${targetId}`
}

function incomingLayer(
  request: V2OnboardingMediaPresentationRequest,
  generation: number,
  candidates: readonly V2OnboardingMediaCandidate[],
  candidateIndex: number,
): V2OnboardingIncomingLayer {
  const candidate = candidates[candidateIndex]
  if (candidate === undefined) {
    throw new RangeError('V2 onboarding media candidate index is out of range.')
  }

  return {
    targetId: request.targetId,
    targetKind: request.targetKind,
    token: candidateToken(request.targetId, generation, candidateIndex),
    candidates,
    candidateIndex,
    candidate,
    phase: 'loading',
  }
}

function evidenceMatches(
  resource: V2OnboardingMediaResource,
  evidence: V2OnboardingMediaPresentationEvidence,
): boolean {
  if (resource.kind === 'video') return evidence === 'decoded-video-frame'
  if (resource.kind === 'still') return evidence === 'decoded-still'
  return evidence === 'native-brand'
}

export function createV2OnboardingMediaPresenterState(
  mode: V2OnboardingMediaMode,
): V2OnboardingMediaPresenterState {
  return { mode, generation: 0 }
}

/** Starts an incoming layer without replacing the decoded layer on screen. */
export function requestV2OnboardingMediaPresentation(
  state: V2OnboardingMediaPresenterState,
  request: V2OnboardingMediaPresentationRequest,
): V2OnboardingMediaPresenterState {
  const generation = state.generation + 1
  const candidates = buildCandidates(state, request)
  return {
    ...state,
    generation,
    incoming: incomingLayer(request, generation, candidates, 0),
  }
}

/**
 * Applies only events correlated to the current candidate token. The DOM
 * adapter combines loaded video data with playback start before presenting;
 * metadata or playback notifications alone therefore remain informational.
 */
export function updateV2OnboardingMediaPresenter(
  state: V2OnboardingMediaPresenterState,
  event: V2OnboardingMediaPresenterEvent,
): V2OnboardingMediaPresenterState {
  const incoming = state.incoming
  if (incoming === undefined || incoming.token !== event.token) return state

  if (
    event.type === 'INCOMING_METADATA_READY' ||
    event.type === 'INCOMING_PLAYING'
  ) {
    return state
  }

  if (event.type === 'INCOMING_FAILED') {
    const candidateIndex = incoming.candidateIndex + 1
    if (candidateIndex >= incoming.candidates.length) return state
    const candidate = incoming.candidates[candidateIndex]
    if (candidate === undefined) return state
    return {
      ...state,
      incoming: {
        ...incoming,
        token: candidateToken(
          incoming.targetId,
          state.generation,
          candidateIndex,
        ),
        candidateIndex,
        candidate,
        phase: 'loading',
        evidence: undefined,
      },
    }
  }

  if (event.type === 'INCOMING_PRESENTED') {
    if (
      incoming.phase === 'revealed' ||
      !evidenceMatches(incoming.candidate.resource, event.evidence)
    ) {
      return state
    }
    return {
      ...state,
      incoming: {
        ...incoming,
        phase: 'revealed',
        evidence: event.evidence,
      },
    }
  }

  if (incoming.phase !== 'revealed' || incoming.evidence === undefined) {
    return state
  }

  const current: V2OnboardingPresentedLayer = {
    targetId: incoming.targetId,
    targetKind: incoming.targetKind,
    token: incoming.token,
    candidate: incoming.candidate,
    evidence: incoming.evidence,
  }
  const resource = incoming.candidate.resource
  return {
    ...state,
    current,
    incoming: undefined,
    ...(resource.kind === 'brand' ? {} : { lastKnownGood: resource }),
  }
}
