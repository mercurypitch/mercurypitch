// ============================================================
// V2 onboarding runtime — asset-independent journey authority
// ============================================================

export const V2_ONBOARDING_PHASES = [
  'B00_BRAND_REVEAL',
  'B00_BEGIN_HOLD',
  'B01_CORKY_GREETING',
  'B02_TABLE_REVEAL',
  'B03_PULL_CHOICE_HOLD',
  'B03_PULL_PRESENTATION',
  'B04_CUE_CONTEXT_HOLD',
  'B05_SIDE_B_CHOICE_HOLD',
  'B05_PULL_RECEDES',
  'B06_CORKY_STARTS_RECORD',
  'B06_RIGID_SPIN',
  'B06_STOP_SAVE_HOLD',
  'B06_SAVE_COMMIT',
  'B07_SAVED_ACK',
  'B07_REMINDER_HOLD',
  'B07_REMINDER_COMMIT',
  'B08_CLOSE_HOME',
  'COMPLETE',
] as const

export type V2OnboardingPhase = (typeof V2_ONBOARDING_PHASES)[number]
export type V2OnboardingSessionKind =
  | 'first-run'
  | 'replay'
  | 'developer-review'
export type V2OnboardingMotionMode = 'normal' | 'reduced'

export interface V2OnboardingPullChoice {
  readonly pullId: string
  readonly pullLabel: string
  readonly sideAText: string
}

export type V2OnboardingCueContextChoice =
  | {
      readonly kind: 'suggested'
      readonly suggestionId: string
      readonly text: string
    }
  | { readonly kind: 'custom'; readonly text: string }
  | { readonly kind: 'omitted' }

export interface V2OnboardingSideBChoice {
  readonly text: string
  readonly suggestionId?: string
}

export interface V2OnboardingPlanDraft {
  readonly pullId: string
  readonly pullLabel: string
  readonly sideAText: string
  readonly cueContextSuggestionId?: string
  readonly cueContextText?: string
  readonly bSideSuggestionId?: string
  readonly bSideText: string
}

export interface V2OnboardingPresentation {
  readonly token: string
  readonly phase: V2OnboardingPhase
}

export interface V2OnboardingSpinReadiness {
  readonly token: string
  readonly dwellMs: number
  readonly notBeforeMs?: number
}

export interface V2OnboardingStopCommit {
  readonly token: string
  readonly platterStatus: 'stopping' | 'stopped'
  readonly planStatus: 'pending' | 'saved' | 'write-free'
}

export interface V2OnboardingPendingSave {
  readonly requestId: number
  readonly plan: V2OnboardingPlanDraft
}

export interface V2OnboardingPendingReminder {
  readonly requestId: number
  readonly localTime: string
}

export interface V2OnboardingRuntimeState {
  readonly contractVersion: '1.0'
  readonly sessionKind: V2OnboardingSessionKind
  readonly motionMode: V2OnboardingMotionMode
  readonly phase: V2OnboardingPhase
  readonly generation: number
  readonly nextRequestId: number
  readonly presentation?: V2OnboardingPresentation
  readonly spinReadiness?: V2OnboardingSpinReadiness
  readonly stopCommit?: V2OnboardingStopCommit
  readonly selectedPull?: V2OnboardingPullChoice
  readonly selectedCueContext?: V2OnboardingCueContextChoice
  readonly selectedSideB?: V2OnboardingSideBChoice
  readonly confirmedPull?: V2OnboardingPullChoice
  readonly confirmedCueContext?: V2OnboardingCueContextChoice
  readonly confirmedSideB?: V2OnboardingSideBChoice
  readonly frozenPlan?: V2OnboardingPlanDraft
  readonly pendingSave?: V2OnboardingPendingSave
  readonly reminderTime?: string
  readonly pendingReminder?: V2OnboardingPendingReminder
  readonly saveError?: string
  readonly reminderError?: string
}

export type V2OnboardingPersistenceEffect =
  | {
      readonly type: 'SAVE_PLAN'
      readonly requestId: number
      readonly plan: V2OnboardingPlanDraft
    }
  | {
      readonly type: 'SET_REMINDER'
      readonly requestId: number
      readonly localTime: string
    }

export interface V2OnboardingTransition {
  readonly state: V2OnboardingRuntimeState
  readonly effects: readonly V2OnboardingPersistenceEffect[]
}

export type V2OnboardingRuntimeEvent =
  | {
      readonly type: 'PRESENTATION_COMPLETED'
      readonly token: string
      readonly nowMs: number
    }
  | { readonly type: 'BEGIN' }
  | { readonly type: 'SELECT_PULL'; readonly choice: V2OnboardingPullChoice }
  | { readonly type: 'CONFIRM_PULL' }
  | {
      readonly type: 'SELECT_CUE_CONTEXT'
      readonly choice: V2OnboardingCueContextChoice
    }
  | { readonly type: 'CONFIRM_CUE_CONTEXT' }
  | { readonly type: 'SELECT_SIDE_B'; readonly choice: V2OnboardingSideBChoice }
  | { readonly type: 'CONFIRM_SIDE_B' }
  | {
      readonly type: 'SPIN_PRESENTED'
      readonly token: string
      readonly nowMs: number
    }
  | {
      readonly type: 'SPIN_READY'
      readonly token: string
      readonly nowMs: number
    }
  | { readonly type: 'STOP_AND_SAVE' }
  | { readonly type: 'PLATTER_STOPPED'; readonly token: string }
  | { readonly type: 'PLAN_SAVE_SUCCEEDED'; readonly requestId: number }
  | {
      readonly type: 'PLAN_SAVE_FAILED'
      readonly requestId: number
      readonly message: string
    }
  | { readonly type: 'SELECT_REMINDER'; readonly localTime: string }
  | { readonly type: 'CONFIRM_REMINDER' }
  | { readonly type: 'REMINDER_SUCCEEDED'; readonly requestId: number }
  | {
      readonly type: 'REMINDER_FAILED'
      readonly requestId: number
      readonly message: string
    }
  | { readonly type: 'SKIP_REMINDER' }
  | { readonly type: 'BACK' }
  | { readonly type: 'RETURN_FROM_REPLAY' }
  | {
      readonly type: 'REVIEW_NAVIGATE'
      readonly phase: V2OnboardingPhase
      readonly nowMs: number
    }
  | { readonly type: 'REVIEW_REPLAY' }

export interface V2OnboardingPhaseMetadata {
  readonly motion: 'moving' | 'stable'
  readonly lineId?: string
}

export const V2_ONBOARDING_PHASE_METADATA: Readonly<
  Record<V2OnboardingPhase, V2OnboardingPhaseMetadata>
> = Object.freeze({
  B00_BRAND_REVEAL: { motion: 'moving' },
  B00_BEGIN_HOLD: { motion: 'stable' },
  B01_CORKY_GREETING: {
    motion: 'moving',
    lineId: 'corky.onboarding.greeting',
  },
  B02_TABLE_REVEAL: { motion: 'moving' },
  B03_PULL_CHOICE_HOLD: {
    motion: 'stable',
    lineId: 'corky.onboarding.pull-choice',
  },
  B03_PULL_PRESENTATION: { motion: 'moving' },
  B04_CUE_CONTEXT_HOLD: {
    motion: 'stable',
    lineId: 'corky.onboarding.cue-context',
  },
  B05_SIDE_B_CHOICE_HOLD: {
    motion: 'stable',
    lineId: 'corky.onboarding.sides',
  },
  B05_PULL_RECEDES: { motion: 'moving' },
  B06_CORKY_STARTS_RECORD: {
    motion: 'moving',
    lineId: 'corky.onboarding.spin',
  },
  B06_RIGID_SPIN: { motion: 'moving' },
  B06_STOP_SAVE_HOLD: { motion: 'stable' },
  B06_SAVE_COMMIT: { motion: 'stable' },
  B07_SAVED_ACK: {
    motion: 'moving',
    lineId: 'corky.onboarding.saved',
  },
  B07_REMINDER_HOLD: {
    motion: 'stable',
    lineId: 'corky.onboarding.reminder',
  },
  B07_REMINDER_COMMIT: { motion: 'stable' },
  B08_CLOSE_HOME: {
    motion: 'moving',
    lineId: 'corky.onboarding.close',
  },
  COMPLETE: { motion: 'stable' },
})

const PRESENTATION_NEXT: Readonly<
  Partial<Record<V2OnboardingPhase, V2OnboardingPhase>>
> = {
  B00_BRAND_REVEAL: 'B00_BEGIN_HOLD',
  B01_CORKY_GREETING: 'B03_PULL_CHOICE_HOLD',
  B02_TABLE_REVEAL: 'B03_PULL_CHOICE_HOLD',
  B03_PULL_PRESENTATION: 'B04_CUE_CONTEXT_HOLD',
  B05_PULL_RECEDES: 'B06_CORKY_STARTS_RECORD',
  B07_SAVED_ACK: 'B07_REMINDER_HOLD',
  B08_CLOSE_HOME: 'COMPLETE',
}

const AUTOMATIC_PHASES = new Set<V2OnboardingPhase>([
  'B00_BRAND_REVEAL',
  'B01_CORKY_GREETING',
  'B02_TABLE_REVEAL',
  'B03_PULL_PRESENTATION',
  'B05_PULL_RECEDES',
  'B06_CORKY_STARTS_RECORD',
  'B07_SAVED_ACK',
  'B08_CLOSE_HOME',
])

const NORMAL_SPIN_MS = 1_800
const REDUCED_SPIN_DWELL_MS = 1_500

function noEffect(state: V2OnboardingRuntimeState): V2OnboardingTransition {
  return { state, effects: [] }
}

function clonePull(choice: V2OnboardingPullChoice): V2OnboardingPullChoice {
  return {
    pullId: choice.pullId,
    pullLabel: choice.pullLabel,
    sideAText: choice.sideAText,
  }
}

function cloneContext(
  choice: V2OnboardingCueContextChoice,
): V2OnboardingCueContextChoice {
  if (choice.kind === 'suggested') {
    return {
      kind: 'suggested',
      suggestionId: choice.suggestionId,
      text: choice.text,
    }
  }
  return choice.kind === 'custom'
    ? { kind: 'custom', text: choice.text }
    : { kind: 'omitted' }
}

function cloneSideB(choice: V2OnboardingSideBChoice): V2OnboardingSideBChoice {
  return {
    text: choice.text,
    ...(choice.suggestionId === undefined
      ? {}
      : { suggestionId: choice.suggestionId }),
  }
}

function presentationToken(
  generation: number,
  phase: V2OnboardingPhase,
): string {
  return `v2-presentation:${String(generation)}:${phase}`
}

function platterStopToken(generation: number): string {
  return `v2-platter-stop:${String(generation)}`
}

function enterPhase(
  state: V2OnboardingRuntimeState,
  phase: V2OnboardingPhase,
): V2OnboardingRuntimeState {
  const generation = state.generation + 1
  return {
    ...state,
    phase,
    generation,
    presentation: AUTOMATIC_PHASES.has(phase)
      ? { phase, token: presentationToken(generation, phase) }
      : undefined,
    spinReadiness:
      phase === 'B06_STOP_SAVE_HOLD' ? state.spinReadiness : undefined,
    stopCommit:
      phase === 'B06_STOP_SAVE_HOLD' || phase === 'B06_SAVE_COMMIT'
        ? state.stopCommit
        : undefined,
  }
}

function completeStopCommitIfReady(
  state: V2OnboardingRuntimeState,
): V2OnboardingRuntimeState {
  const commit = state.stopCommit
  if (
    state.phase !== 'B06_SAVE_COMMIT' ||
    commit === undefined ||
    commit.platterStatus !== 'stopped' ||
    commit.planStatus === 'pending'
  ) {
    return state
  }
  return enterPhase(state, 'B07_SAVED_ACK')
}

function enterSpin(state: V2OnboardingRuntimeState): V2OnboardingRuntimeState {
  const generation = state.generation + 1
  const dwellMs =
    state.motionMode === 'normal' ? NORMAL_SPIN_MS : REDUCED_SPIN_DWELL_MS
  return {
    ...state,
    phase: 'B06_RIGID_SPIN',
    generation,
    presentation: undefined,
    spinReadiness: {
      token: `v2-spin:${String(generation)}`,
      dwellMs,
    },
  }
}

function armSpinReadiness(
  state: V2OnboardingRuntimeState,
  nowMs: number,
): V2OnboardingRuntimeState {
  const readiness = state.spinReadiness
  if (readiness === undefined || readiness.notBeforeMs !== undefined) {
    return state
  }
  return {
    ...state,
    spinReadiness: {
      ...readiness,
      notBeforeMs: nowMs + readiness.dwellMs,
    },
  }
}

function freezePlan(
  state: V2OnboardingRuntimeState,
): V2OnboardingPlanDraft | undefined {
  const pull = state.confirmedPull
  const sideB = state.confirmedSideB
  if (pull === undefined || sideB === undefined) return undefined
  const cueContext = state.confirmedCueContext
  return Object.freeze({
    pullId: pull.pullId,
    pullLabel: pull.pullLabel,
    sideAText: pull.sideAText,
    ...(cueContext?.kind === 'suggested'
      ? {
          cueContextSuggestionId: cueContext.suggestionId,
          cueContextText: cueContext.text,
        }
      : cueContext?.kind === 'custom'
        ? { cueContextText: cueContext.text }
        : {}),
    ...(sideB.suggestionId === undefined
      ? {}
      : { bSideSuggestionId: sideB.suggestionId }),
    bSideText: sideB.text,
  })
}

export function createV2OnboardingRuntimeState(options: {
  readonly sessionKind: V2OnboardingSessionKind
  readonly motionMode: V2OnboardingMotionMode
}): V2OnboardingRuntimeState {
  const base: V2OnboardingRuntimeState = {
    contractVersion: '1.0',
    sessionKind: options.sessionKind,
    motionMode: options.motionMode,
    phase: 'B00_BRAND_REVEAL',
    generation: 0,
    nextRequestId: 0,
  }
  return enterPhase(base, 'B00_BRAND_REVEAL')
}

export function reduceV2OnboardingRuntime(
  state: V2OnboardingRuntimeState,
  event: V2OnboardingRuntimeEvent,
): V2OnboardingTransition {
  if (event.type === 'REVIEW_REPLAY') {
    if (state.sessionKind !== 'developer-review') return noEffect(state)
    const restarted = createV2OnboardingRuntimeState({
      sessionKind: 'developer-review',
      motionMode: state.motionMode,
    })
    const generation = state.generation + 1
    return noEffect({
      ...restarted,
      generation,
      presentation: {
        phase: 'B00_BRAND_REVEAL',
        token: presentationToken(generation, 'B00_BRAND_REVEAL'),
      },
    })
  }

  if (event.type === 'REVIEW_NAVIGATE') {
    if (state.sessionKind !== 'developer-review') return noEffect(state)
    const cleared = {
      ...state,
      pendingSave: undefined,
      pendingReminder: undefined,
      stopCommit: undefined,
      frozenPlan: undefined,
      saveError: undefined,
      reminderError: undefined,
    }
    if (event.phase === 'B06_RIGID_SPIN') {
      const spin = enterSpin(cleared)
      return noEffect(
        state.phase === 'B06_STOP_SAVE_HOLD' &&
          state.spinReadiness?.notBeforeMs !== undefined
          ? armSpinReadiness(spin, event.nowMs)
          : spin,
      )
    }
    return noEffect(enterPhase(cleared, event.phase))
  }

  if (event.type === 'RETURN_FROM_REPLAY') {
    return state.sessionKind === 'replay'
      ? noEffect(enterPhase(state, 'COMPLETE'))
      : noEffect(state)
  }

  if (event.type === 'PRESENTATION_COMPLETED') {
    if (state.presentation?.token !== event.token) return noEffect(state)
    if (state.phase === 'B06_CORKY_STARTS_RECORD') {
      return noEffect(enterSpin(state))
    }
    const nextPhase = PRESENTATION_NEXT[state.phase]
    return nextPhase === undefined
      ? noEffect(state)
      : noEffect(enterPhase(state, nextPhase))
  }

  if (event.type === 'BEGIN') {
    return state.phase === 'B00_BEGIN_HOLD'
      ? noEffect(enterPhase(state, 'B01_CORKY_GREETING'))
      : noEffect(state)
  }

  if (event.type === 'SELECT_PULL') {
    return state.phase === 'B03_PULL_CHOICE_HOLD'
      ? noEffect({ ...state, selectedPull: clonePull(event.choice) })
      : noEffect(state)
  }

  if (event.type === 'CONFIRM_PULL') {
    if (
      state.phase !== 'B03_PULL_CHOICE_HOLD' ||
      state.selectedPull === undefined
    ) {
      return noEffect(state)
    }
    return noEffect(
      enterPhase(
        {
          ...state,
          confirmedPull: clonePull(state.selectedPull),
          selectedCueContext: undefined,
          selectedSideB: undefined,
          confirmedCueContext: undefined,
          confirmedSideB: undefined,
          frozenPlan: undefined,
        },
        'B03_PULL_PRESENTATION',
      ),
    )
  }

  if (event.type === 'SELECT_CUE_CONTEXT') {
    return state.phase === 'B04_CUE_CONTEXT_HOLD'
      ? noEffect({ ...state, selectedCueContext: cloneContext(event.choice) })
      : noEffect(state)
  }

  if (event.type === 'CONFIRM_CUE_CONTEXT') {
    if (
      state.phase !== 'B04_CUE_CONTEXT_HOLD' ||
      state.selectedCueContext === undefined
    ) {
      return noEffect(state)
    }
    return noEffect(
      enterPhase(
        {
          ...state,
          confirmedCueContext: cloneContext(state.selectedCueContext),
          selectedSideB: undefined,
          confirmedSideB: undefined,
          frozenPlan: undefined,
        },
        'B05_SIDE_B_CHOICE_HOLD',
      ),
    )
  }

  if (event.type === 'SELECT_SIDE_B') {
    return state.phase === 'B05_SIDE_B_CHOICE_HOLD'
      ? noEffect({ ...state, selectedSideB: cloneSideB(event.choice) })
      : noEffect(state)
  }

  if (event.type === 'CONFIRM_SIDE_B') {
    if (
      state.phase !== 'B05_SIDE_B_CHOICE_HOLD' ||
      state.selectedSideB === undefined
    ) {
      return noEffect(state)
    }
    return noEffect(
      enterPhase(
        {
          ...state,
          confirmedSideB: cloneSideB(state.selectedSideB),
          frozenPlan: undefined,
        },
        'B05_PULL_RECEDES',
      ),
    )
  }

  if (event.type === 'SPIN_PRESENTED') {
    const readiness = state.spinReadiness
    if (
      (state.phase !== 'B06_RIGID_SPIN' &&
        state.phase !== 'B06_STOP_SAVE_HOLD') ||
      readiness === undefined ||
      readiness.token !== event.token ||
      readiness.notBeforeMs !== undefined
    ) {
      return noEffect(state)
    }
    return noEffect(armSpinReadiness(state, event.nowMs))
  }

  if (event.type === 'SPIN_READY') {
    const readiness = state.spinReadiness
    if (
      state.phase !== 'B06_RIGID_SPIN' ||
      readiness === undefined ||
      readiness.token !== event.token ||
      readiness.notBeforeMs === undefined ||
      event.nowMs < readiness.notBeforeMs
    ) {
      return noEffect(state)
    }
    return noEffect(enterPhase(state, 'B06_STOP_SAVE_HOLD'))
  }

  if (event.type === 'STOP_AND_SAVE') {
    if (state.phase !== 'B06_STOP_SAVE_HOLD') return noEffect(state)
    const plan = state.frozenPlan ?? freezePlan(state)
    if (plan === undefined) return noEffect(state)
    if (
      state.stopCommit?.planStatus !== undefined &&
      state.stopCommit.planStatus !== 'pending'
    ) {
      return noEffect(state)
    }
    const committing = enterPhase(state, 'B06_SAVE_COMMIT')
    const stopCommit: V2OnboardingStopCommit = {
      token: state.stopCommit?.token ?? platterStopToken(committing.generation),
      platterStatus: state.stopCommit?.platterStatus ?? 'stopping',
      planStatus: state.sessionKind === 'first-run' ? 'pending' : 'write-free',
    }
    if (state.sessionKind !== 'first-run') {
      return noEffect(
        completeStopCommitIfReady({
          ...committing,
          frozenPlan: plan,
          stopCommit,
          saveError: undefined,
        }),
      )
    }
    const requestId = state.nextRequestId + 1
    const pendingSave = { requestId, plan }
    return {
      state: {
        ...committing,
        nextRequestId: requestId,
        frozenPlan: plan,
        pendingSave,
        stopCommit,
        saveError: undefined,
      },
      effects: [{ type: 'SAVE_PLAN', requestId, plan }],
    }
  }

  if (event.type === 'PLATTER_STOPPED') {
    const commit = state.stopCommit
    if (
      (state.phase !== 'B06_SAVE_COMMIT' &&
        state.phase !== 'B06_STOP_SAVE_HOLD') ||
      commit === undefined ||
      commit.token !== event.token ||
      commit.platterStatus === 'stopped'
    ) {
      return noEffect(state)
    }
    return noEffect(
      completeStopCommitIfReady({
        ...state,
        stopCommit: { ...commit, platterStatus: 'stopped' },
      }),
    )
  }

  if (event.type === 'PLAN_SAVE_SUCCEEDED') {
    const commit = state.stopCommit
    if (
      state.phase !== 'B06_SAVE_COMMIT' ||
      state.pendingSave?.requestId !== event.requestId ||
      commit === undefined ||
      commit.planStatus !== 'pending'
    ) {
      return noEffect(state)
    }
    return noEffect(
      completeStopCommitIfReady({
        ...state,
        pendingSave: undefined,
        stopCommit: { ...commit, planStatus: 'saved' },
      }),
    )
  }

  if (event.type === 'PLAN_SAVE_FAILED') {
    const commit = state.stopCommit
    if (
      state.phase !== 'B06_SAVE_COMMIT' ||
      state.pendingSave?.requestId !== event.requestId ||
      commit === undefined ||
      commit.planStatus !== 'pending'
    ) {
      return noEffect(state)
    }
    return noEffect({
      ...enterPhase(
        { ...state, pendingSave: undefined, stopCommit: undefined },
        'B06_STOP_SAVE_HOLD',
      ),
      saveError: event.message,
    })
  }

  if (event.type === 'SELECT_REMINDER') {
    return state.phase === 'B07_REMINDER_HOLD'
      ? noEffect({
          ...state,
          reminderTime: event.localTime,
          reminderError: undefined,
        })
      : noEffect(state)
  }

  if (event.type === 'CONFIRM_REMINDER') {
    if (
      state.phase !== 'B07_REMINDER_HOLD' ||
      state.reminderTime === undefined
    ) {
      return noEffect(state)
    }
    if (state.sessionKind !== 'first-run') {
      return noEffect(enterPhase(state, 'B08_CLOSE_HOME'))
    }
    const requestId = state.nextRequestId + 1
    const pendingReminder = {
      requestId,
      localTime: state.reminderTime,
    }
    return {
      state: {
        ...enterPhase(state, 'B07_REMINDER_COMMIT'),
        nextRequestId: requestId,
        pendingReminder,
        reminderError: undefined,
      },
      effects: [
        {
          type: 'SET_REMINDER',
          requestId,
          localTime: state.reminderTime,
        },
      ],
    }
  }

  if (event.type === 'REMINDER_SUCCEEDED') {
    if (
      state.phase !== 'B07_REMINDER_COMMIT' ||
      state.pendingReminder?.requestId !== event.requestId
    ) {
      return noEffect(state)
    }
    return noEffect(
      enterPhase({ ...state, pendingReminder: undefined }, 'B08_CLOSE_HOME'),
    )
  }

  if (event.type === 'REMINDER_FAILED') {
    if (
      state.phase !== 'B07_REMINDER_COMMIT' ||
      state.pendingReminder?.requestId !== event.requestId
    ) {
      return noEffect(state)
    }
    return noEffect({
      ...enterPhase(
        { ...state, pendingReminder: undefined },
        'B07_REMINDER_HOLD',
      ),
      reminderError: event.message,
    })
  }

  if (event.type === 'SKIP_REMINDER') {
    return state.phase === 'B07_REMINDER_HOLD'
      ? noEffect(enterPhase(state, 'B08_CLOSE_HOME'))
      : noEffect(state)
  }

  if (event.type === 'BACK') {
    if (state.phase === 'B06_STOP_SAVE_HOLD') {
      return noEffect(
        enterPhase(
          {
            ...state,
            frozenPlan: undefined,
            stopCommit: undefined,
            saveError: undefined,
          },
          'B05_SIDE_B_CHOICE_HOLD',
        ),
      )
    }
    if (state.phase === 'B04_CUE_CONTEXT_HOLD') {
      return noEffect(enterPhase(state, 'B03_PULL_CHOICE_HOLD'))
    }
    if (state.phase === 'B05_SIDE_B_CHOICE_HOLD') {
      return noEffect(enterPhase(state, 'B04_CUE_CONTEXT_HOLD'))
    }
  }

  return noEffect(state)
}
