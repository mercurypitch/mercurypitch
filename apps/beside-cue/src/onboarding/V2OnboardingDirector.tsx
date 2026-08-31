// ============================================================
// V2OnboardingDirector — caption-first native onboarding shell
// ============================================================
//
// The pure runtime owns journey truth and persistence correlation. This
// surface supplies only native controls, stable art, timing and one scoped
// audio bridge, so unfinished or missing media can never block completion.

import { createEffect, createMemo, createSignal, For, Match, on, onCleanup, Show, Switch, untrack, } from 'solid-js'
import type { AudioSession } from '@/audio'
import { AssetStage } from '@/components/AssetStage'
import { BrandMark } from '@/components/BrandMark'
import type { ContentPack, PullAnchorSuggestion, PullOption } from '@/content'
import { CUSTOM_PULL_ACTIONS, findCharacter, findDialogueAudioAssetForLine, findLine, findPullCharacter, GENERIC_PULL_CHARACTER, } from '@/content'
import { createV2OnboardingAudioDirector } from './v2-onboarding-audio-director'
import type { V2OnboardingMediaPack, V2OnboardingPullMediaMoment, } from './v2-onboarding-media-pack'
import { resolveV2OnboardingMediaRequest } from './v2-onboarding-media-pack'
import type { V2OnboardingCueContextChoice, V2OnboardingPersistenceEffect, V2OnboardingPhase, V2OnboardingPlanDraft, V2OnboardingPullChoice, V2OnboardingRuntimeEvent, V2OnboardingRuntimeState, V2OnboardingSessionKind, V2OnboardingSideBChoice, } from './v2-onboarding-runtime'
import { createV2OnboardingRuntimeState, reduceV2OnboardingRuntime, V2_ONBOARDING_PHASE_METADATA, V2_ONBOARDING_PHASES, } from './v2-onboarding-runtime'
import styles from './V2OnboardingDirector.module.css'
import type { V2OnboardingMediaCorrelation, V2OnboardingMediaSettledEvent, } from './V2OnboardingMediaStage'
import { V2OnboardingMediaStage } from './V2OnboardingMediaStage'

export type V2OnboardingMutationResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly message: string }

export interface V2OnboardingReminderPreset {
  readonly id: string
  readonly label: string
  readonly localTime: string
}

export interface V2OnboardingDirectorProps {
  readonly sessionKind: V2OnboardingSessionKind
  readonly pullOptions: readonly PullOption[]
  readonly contentPack: ContentPack
  readonly mediaPack?: V2OnboardingMediaPack
  readonly audioSession: AudioSession
  readonly foreground: boolean
  readonly muted: boolean
  readonly onMutedChange: (muted: boolean) => void
  readonly reminderPresets: readonly V2OnboardingReminderPreset[]
  readonly onSavePlan: (
    plan: V2OnboardingPlanDraft,
  ) => Promise<V2OnboardingMutationResult>
  readonly onSetReminder: (
    localTime: string,
  ) => Promise<V2OnboardingMutationResult>
  readonly onComplete: () => void
}

const AUTOMATIC_DURATION_MS: Readonly<
  Partial<Record<V2OnboardingPhase, number>>
> = Object.freeze({
  B00_BRAND_REVEAL: 1_300,
  B01_CORKY_GREETING: 1_550,
  B02_TABLE_REVEAL: 750,
  B03_PULL_PRESENTATION: 1_450,
  B05_PULL_RECEDES: 1_150,
  B06_CORKY_STARTS_RECORD: 1_250,
  B07_SAVED_ACK: 950,
  B08_CLOSE_HOME: 1_300,
})

const REDUCED_AUTOMATIC_DURATION_MS = 650
const DIALOGUE_SAFETY_TIMEOUT_MS = 15_000
const MEDIA_SAFETY_TIMEOUT_MS = 15_000

const DECISION_PHASES = new Set<V2OnboardingPhase>([
  'B03_PULL_CHOICE_HOLD',
  'B04_CUE_CONTEXT_HOLD',
  'B05_SIDE_B_CHOICE_HOLD',
  'B06_STOP_SAVE_HOLD',
  'B07_REMINDER_HOLD',
])

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

function monotonicNow(): number {
  return typeof performance === 'undefined' ? Date.now() : performance.now()
}

interface PausableDelay {
  pause(): void
  resume(): void
  cancel(): void
}

function createPausableDelay(
  delayMs: number,
  callback: () => void,
  running: boolean,
): PausableDelay {
  let remainingMs = Math.max(0, delayMs)
  let startedAtMs = 0
  let timeout: number | undefined
  let cancelled = false
  let settled = false

  const pause = (): void => {
    if (timeout === undefined) return
    remainingMs = Math.max(0, remainingMs - (monotonicNow() - startedAtMs))
    window.clearTimeout(timeout)
    timeout = undefined
  }
  const finish = (): void => {
    if (cancelled || settled) return
    settled = true
    remainingMs = 0
    timeout = undefined
    callback()
  }
  const resume = (): void => {
    if (cancelled || settled || timeout !== undefined) return
    if (remainingMs === 0) {
      finish()
      return
    }
    startedAtMs = monotonicNow()
    timeout = window.setTimeout(finish, remainingMs)
  }

  if (running) resume()

  return {
    pause,
    resume,
    cancel() {
      pause()
      cancelled = true
    },
  }
}

function normalizedText(value: string): string {
  return value.trim().replace(/\s+/gu, ' ')
}

function phasePullLineId(state: V2OnboardingRuntimeState): string | undefined {
  const pullId = state.confirmedPull?.pullId
  if (pullId === undefined || pullId === 'custom') return undefined
  if (state.phase === 'B03_PULL_PRESENTATION') {
    return `pull.${pullId}.present`
  }
  if (state.phase === 'B05_PULL_RECEDES') {
    return `pull.${pullId}.recede`
  }
  return undefined
}

function lineIdForState(state: V2OnboardingRuntimeState): string | undefined {
  return (
    phasePullLineId(state) ?? V2_ONBOARDING_PHASE_METADATA[state.phase].lineId
  )
}

function mediaMomentForPhase(
  phase: V2OnboardingPhase,
): V2OnboardingPullMediaMoment | undefined {
  switch (phase) {
    case 'B03_PULL_PRESENTATION':
      return 'present'
    case 'B04_CUE_CONTEXT_HOLD':
    case 'B05_SIDE_B_CHOICE_HOLD':
      return 'hold'
    case 'B05_PULL_RECEDES':
      return 'recede'
    case 'B06_CORKY_STARTS_RECORD':
      return 'end'
    default:
      return undefined
  }
}

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim() !== '') {
    return error.message
  }
  return fallback
}

function phaseHeading(state: V2OnboardingRuntimeState): string {
  const pullLabel = state.confirmedPull?.pullLabel ?? 'this Pull'
  switch (state.phase) {
    case 'B00_BRAND_REVEAL':
      return 'Beside Cue'
    case 'B00_BEGIN_HOLD':
      return 'One Pull. One chosen turn.'
    case 'B01_CORKY_GREETING':
      return 'Meet Corky.'
    case 'B02_TABLE_REVEAL':
      return 'Let’s make one plan.'
    case 'B03_PULL_CHOICE_HOLD':
      return 'Which Pull do you want to notice sooner?'
    case 'B03_PULL_PRESENTATION':
      return pullLabel
    case 'B04_CUE_CONTEXT_HOLD':
      return `When does ${pullLabel} usually show up?`
    case 'B05_SIDE_B_CHOICE_HOLD':
      return 'What small action would you rather begin?'
    case 'B05_PULL_RECEDES':
      return 'A second side comes into view.'
    case 'B06_CORKY_STARTS_RECORD':
      return 'Corky starts the record.'
    case 'B06_RIGID_SPIN':
      return 'Let it spin.'
    case 'B06_STOP_SAVE_HOLD':
      return 'Stop the record to save this plan.'
    case 'B06_SAVE_COMMIT':
      return 'Saving your plan…'
    case 'B07_SAVED_ACK':
      return 'Your plan is saved.'
    case 'B07_REMINDER_HOLD':
      return 'Bring this plan back later?'
    case 'B07_REMINDER_COMMIT':
      return 'Setting your reminder…'
    case 'B08_CLOSE_HOME':
      return 'Your plan is ready.'
    case 'COMPLETE':
      return 'Ready.'
  }
}

interface ChoiceButtonProps {
  readonly name: string
  readonly value: string
  readonly selected: boolean
  readonly label: string
  readonly description?: string
  readonly onChoose: () => void
}

function ChoiceButton(props: ChoiceButtonProps) {
  return (
    <label
      class={styles.choice}
      classList={{ [styles.choiceSelected]: props.selected }}
    >
      <input
        class={styles.choiceRadio}
        type="radio"
        name={props.name}
        value={props.value}
        checked={props.selected}
        onChange={() => props.onChoose()}
      />
      <span class={styles.choiceDisc} aria-hidden="true" />
      <span class={styles.choiceCopy}>
        <strong>{props.label}</strong>
        <Show when={props.description}>
          {(description) => <small>{description()}</small>}
        </Show>
      </span>
      <span class={styles.choiceCheck} aria-hidden="true" />
    </label>
  )
}

interface SideBPresentation {
  readonly key: string
  readonly label: string
  readonly suggestionId?: string
}

export function V2OnboardingDirector(props: V2OnboardingDirectorProps) {
  const motionMode = prefersReducedMotion() ? 'reduced' : 'normal'
  const initialSessionKind = untrack(() => props.sessionKind)
  const [state, setState] = createSignal(
    createV2OnboardingRuntimeState({
      sessionKind: initialSessionKind,
      motionMode,
    }),
  )
  const [selectedPullKey, setSelectedPullKey] = createSignal<string>()
  const [customPullText, setCustomPullText] = createSignal('')
  const [cueContextKey, setCueContextKey] = createSignal<string>()
  const [customCueContext, setCustomCueContext] = createSignal('')
  const [sideBKey, setSideBKey] = createSignal<string>()
  const [customSideB, setCustomSideB] = createSignal('')
  const [completed, setCompleted] = createSignal(false)
  const phaseGeneration = createMemo(() => state().generation)

  let headingElement: HTMLHeadingElement | undefined
  let presentationDwellClock: PausableDelay | undefined
  let presentationSafetyClock: PausableDelay | undefined
  let presentationMediaSafetyClock: PausableDelay | undefined
  let spinReadinessClock: PausableDelay | undefined
  let completeVisiblePresentation: (() => void) | undefined
  let activeMediaGate:
    | {
        readonly targetId: string
        readonly markReady: () => void
        readonly endedTokens: Set<string>
        settledVideoToken?: string
      }
    | undefined
  const audioScope = untrack(() =>
    props.audioSession.createScope('v2-onboarding'),
  )
  const audioDirector = createV2OnboardingAudioDirector(audioScope)

  const selectedPullOption = createMemo(() =>
    props.pullOptions.find((option) => option.id === selectedPullKey()),
  )
  const activePullOption = createMemo(() => selectedPullOption())
  const activePullCharacter = createMemo(() => {
    const pullId = state().confirmedPull?.pullId ?? state().selectedPull?.pullId
    return (
      findPullCharacter(props.contentPack, pullId) ?? GENERIC_PULL_CHARACTER
    )
  })
  const corky = createMemo(() =>
    findCharacter(props.contentPack, props.contentPack.leadCharacterId),
  )
  const captionLine = createMemo(() => {
    const lineId = lineIdForState(state())
    return lineId === undefined
      ? undefined
      : findLine(props.contentPack, lineId)
  })
  const selectedPullPreview = createMemo(() => {
    const lineId = selectedPullOption()?.previewLineId
    return lineId === undefined
      ? undefined
      : findLine(props.contentPack, lineId)
  })
  const cueSuggestions = createMemo<readonly PullAnchorSuggestion[]>(
    () => activePullOption()?.anchorSuggestions ?? [],
  )
  const sideBSuggestions = createMemo<readonly SideBPresentation[]>(() => {
    const option = activePullOption()
    if (option?.bSideSuggestions !== undefined) {
      return option.bSideSuggestions.map((suggestion) => ({
        key: suggestion.id,
        label: suggestion.label,
        suggestionId: suggestion.id,
      }))
    }
    if (option !== undefined) {
      return option.suggestions.map((label, index) => ({
        key: `legacy:${String(index)}:${label}`,
        label,
      }))
    }
    return CUSTOM_PULL_ACTIONS.map((suggestion) => ({
      key: suggestion.id,
      label: suggestion.label,
      suggestionId: suggestion.id,
    }))
  })
  const mediaTargetKey = createMemo(() => {
    const pullId = state().confirmedPull?.pullId
    const moment = mediaMomentForPhase(state().phase)
    if (
      props.mediaPack === undefined ||
      pullId === undefined ||
      pullId === 'custom' ||
      moment === undefined
    ) {
      return undefined
    }
    return `${String(state().generation)}|${pullId}|${moment}`
  })
  const mediaRequest = createMemo(() => {
    const targetKey = mediaTargetKey()
    const mediaPack = props.mediaPack
    if (targetKey === undefined || mediaPack === undefined) return undefined
    const [generation, pullId, moment] = targetKey.split('|')
    if (
      generation === undefined ||
      pullId === undefined ||
      moment === undefined
    ) {
      return undefined
    }
    return resolveV2OnboardingMediaRequest(mediaPack, {
      targetId: `v2-media:${generation}:${pullId}:${moment}`,
      pullId,
      moment: moment as V2OnboardingPullMediaMoment,
    })
  })

  const pullChoiceValid = createMemo(() => {
    const selected = state().selectedPull
    const key = selectedPullKey()
    if (
      selected === undefined ||
      key === undefined ||
      key !== selected.pullId
    ) {
      return false
    }
    return key !== 'custom' || normalizedText(customPullText()) !== ''
  })

  const cueContextValid = createMemo(() => {
    const selected = state().selectedCueContext
    const key = cueContextKey()
    if (selected === undefined || key === undefined) return false
    if (key === 'omitted') return selected.kind === 'omitted'
    if (key === 'custom') {
      const text = normalizedText(customCueContext())
      return selected.kind === 'custom' && text !== '' && selected.text === text
    }
    return selected.kind === 'suggested' && selected.suggestionId === key
  })

  const sideBValid = createMemo(() => {
    const selected = state().selectedSideB
    const key = sideBKey()
    if (selected === undefined || key === undefined) return false
    if (key === 'custom') {
      const text = normalizedText(customSideB())
      return (
        text !== '' &&
        selected.suggestionId === undefined &&
        selected.text === text
      )
    }
    const presentation = sideBSuggestions().find(
      (suggestion) => suggestion.key === key,
    )
    if (presentation === undefined || selected.text !== presentation.label) {
      return false
    }
    return selected.suggestionId === presentation.suggestionId
  })

  function dialogueAssetId(lineId: string | undefined): string | undefined {
    if (lineId === undefined) return undefined
    const line = findLine(props.contentPack, lineId)
    if (line?.captionSha256 === undefined) return undefined
    return findDialogueAudioAssetForLine(props.contentPack.audio, {
      lineId,
      captionSha256: line.captionSha256,
    })?.id
  }

  function runEffect(effect: V2OnboardingPersistenceEffect): void {
    if (effect.type === 'SAVE_PLAN') {
      void props
        .onSavePlan(effect.plan)
        .then((result) => {
          dispatch(
            result.ok
              ? {
                  type: 'PLAN_SAVE_SUCCEEDED',
                  requestId: effect.requestId,
                }
              : {
                  type: 'PLAN_SAVE_FAILED',
                  requestId: effect.requestId,
                  message: result.message,
                },
          )
        })
        .catch((error: unknown) => {
          dispatch({
            type: 'PLAN_SAVE_FAILED',
            requestId: effect.requestId,
            message: errorMessage(error, 'Could not save this plan.'),
          })
        })
      return
    }

    void props
      .onSetReminder(effect.localTime)
      .then((result) => {
        dispatch(
          result.ok
            ? {
                type: 'REMINDER_SUCCEEDED',
                requestId: effect.requestId,
              }
            : {
                type: 'REMINDER_FAILED',
                requestId: effect.requestId,
                message: result.message,
              },
        )
      })
      .catch((error: unknown) => {
        dispatch({
          type: 'REMINDER_FAILED',
          requestId: effect.requestId,
          message: errorMessage(error, 'Could not set this reminder.'),
        })
      })
  }

  function dispatch(event: V2OnboardingRuntimeEvent): void {
    const previousState = state()
    const transition = reduceV2OnboardingRuntime(previousState, event)
    if (transition.state !== previousState) {
      if (event.type === 'CONFIRM_PULL') {
        setCueContextKey(undefined)
        setSideBKey(undefined)
      } else if (event.type === 'CONFIRM_CUE_CONTEXT') {
        setSideBKey(undefined)
      }
    }
    setState(transition.state)
    for (const effect of transition.effects) runEffect(effect)
  }

  function selectPull(option: PullOption): void {
    setSelectedPullKey(option.id)
    const sideAText = normalizedText(option.defaultSideAText ?? option.label)
    const choice: V2OnboardingPullChoice = {
      pullId: option.id,
      pullLabel: normalizedText(option.label),
      sideAText,
    }
    dispatch({ type: 'SELECT_PULL', choice })
    audioScope.stopLane('dialogue', 'lane-stopped')
    const previewLineId = option.previewLineId
    const assetId = dialogueAssetId(previewLineId)
    if (assetId !== undefined) audioScope.play(assetId)
  }

  function updateCustomPull(value: string): void {
    setCustomPullText(value)
    setSelectedPullKey('custom')
    const text = normalizedText(value)
    if (text === '') return
    dispatch({
      type: 'SELECT_PULL',
      choice: { pullId: 'custom', pullLabel: text, sideAText: text },
    })
  }

  function chooseCustomPull(): void {
    setSelectedPullKey('custom')
    audioScope.stopLane('dialogue', 'lane-stopped')
    if (normalizedText(customPullText()) !== '') {
      updateCustomPull(customPullText())
    }
  }

  function selectCueContext(choice: V2OnboardingCueContextChoice): void {
    setCueContextKey(
      choice.kind === 'suggested'
        ? choice.suggestionId
        : choice.kind === 'custom'
          ? 'custom'
          : 'omitted',
    )
    dispatch({ type: 'SELECT_CUE_CONTEXT', choice })
  }

  function updateCustomCueContext(value: string): void {
    setCustomCueContext(value)
    setCueContextKey('custom')
    const text = normalizedText(value)
    if (text === '') return
    selectCueContext({ kind: 'custom', text })
  }

  function chooseCustomCueContext(): void {
    setCueContextKey('custom')
    const text = normalizedText(customCueContext())
    if (text !== '') selectCueContext({ kind: 'custom', text })
  }

  function selectSideB(choice: V2OnboardingSideBChoice, key: string): void {
    setSideBKey(key)
    dispatch({ type: 'SELECT_SIDE_B', choice })
  }

  function updateCustomSideB(value: string): void {
    setCustomSideB(value)
    setSideBKey('custom')
    const text = normalizedText(value)
    if (text === '') return
    selectSideB({ text }, 'custom')
  }

  function chooseCustomSideB(): void {
    setSideBKey('custom')
    const text = normalizedText(customSideB())
    if (text !== '') selectSideB({ text }, 'custom')
  }

  function begin(): void {
    void props.audioSession.unlock().catch(() => false)
    dispatch({ type: 'BEGIN' })
  }

  function toggleMuted(): void {
    props.onMutedChange(!props.muted)
  }

  function replayReview(): void {
    setSelectedPullKey(undefined)
    setCustomPullText('')
    setCueContextKey(undefined)
    setCustomCueContext('')
    setSideBKey(undefined)
    setCustomSideB('')
    dispatch({ type: 'REVIEW_REPLAY' })
  }

  function navigateReview(offset: -1 | 1): void {
    const index = V2_ONBOARDING_PHASES.indexOf(state().phase)
    const next = V2_ONBOARDING_PHASES[index + offset]
    if (next !== undefined) {
      dispatch({ type: 'REVIEW_NAVIGATE', phase: next })
    }
  }

  function settleMediaPresentation(event: V2OnboardingMediaSettledEvent): void {
    const gate = activeMediaGate
    if (gate === undefined || gate.targetId !== event.targetId) return
    if (event.recoveryStage === 'primary' || event.recoveryStage === 'retry') {
      gate.settledVideoToken = event.token
      if (gate.endedTokens.has(event.token)) gate.markReady()
      return
    }
    gate.markReady()
  }

  function finishMediaVideo(event: V2OnboardingMediaCorrelation): void {
    const gate = activeMediaGate
    if (gate === undefined || gate.targetId !== event.targetId) return
    if (gate.settledVideoToken === event.token) {
      gate.markReady()
      return
    }
    gate.endedTokens.add(event.token)
  }

  createEffect(
    on(phaseGeneration, () => {
      const snapshot = state()
      queueMicrotask(() => headingElement?.focus({ preventScroll: true }))
      const lineId = lineIdForState(snapshot)
      const beat = { dialogueAssetId: dialogueAssetId(lineId) }
      if (DECISION_PHASES.has(snapshot.phase)) {
        audioDirector.enterHold({ holdId: snapshot.phase, ...beat })
        return
      }

      const dialogueCue = audioDirector.enterBeat(beat)
      const presentation = snapshot.presentation
      if (presentation === undefined) return

      const requestedMedia = untrack(() => mediaRequest())
      const waitsForMedia =
        snapshot.motionMode === 'normal' &&
        requestedMedia?.targetKind === 'automatic' &&
        requestedMedia.primary.kind === 'video'

      const normalDuration = AUTOMATIC_DURATION_MS[snapshot.phase] ?? 650
      const duration =
        snapshot.motionMode === 'reduced'
          ? Math.min(normalDuration, REDUCED_AUTOMATIC_DURATION_MS)
          : normalDuration
      let cancelled = false
      let completed = false
      let dwellReady = false
      let dialogueReady = dialogueCue === undefined
      let mediaReady = !waitsForMedia
      let safetyClock: PausableDelay | undefined
      let mediaSafetyClock: PausableDelay | undefined

      const completeWhenReady = (): void => {
        if (
          cancelled ||
          completed ||
          !props.foreground ||
          !dwellReady ||
          !dialogueReady ||
          !mediaReady
        ) {
          return
        }
        completed = true
        untrack(() => {
          dispatch({
            type: 'PRESENTATION_COMPLETED',
            token: presentation.token,
            nowMs: monotonicNow(),
          })
        })
      }
      const markDialogueReady = (): void => {
        if (cancelled || dialogueReady) return
        dialogueReady = true
        if (safetyClock !== undefined) {
          safetyClock.cancel()
          if (presentationSafetyClock === safetyClock) {
            presentationSafetyClock = undefined
          }
          safetyClock = undefined
        }
        completeWhenReady()
      }
      const markMediaReady = (): void => {
        if (cancelled || mediaReady) return
        mediaReady = true
        if (mediaSafetyClock !== undefined) {
          mediaSafetyClock.cancel()
          if (presentationMediaSafetyClock === mediaSafetyClock) {
            presentationMediaSafetyClock = undefined
          }
          mediaSafetyClock = undefined
        }
        completeWhenReady()
      }

      const initiallyRunning = untrack(() => props.foreground)
      const dwellClock = createPausableDelay(
        duration,
        () => {
          dwellReady = true
          completeWhenReady()
        },
        initiallyRunning,
      )
      presentationDwellClock = dwellClock
      completeVisiblePresentation = completeWhenReady

      if (dialogueCue !== undefined) {
        safetyClock = createPausableDelay(
          DIALOGUE_SAFETY_TIMEOUT_MS,
          markDialogueReady,
          initiallyRunning,
        )
        presentationSafetyClock = safetyClock
        void dialogueCue.finished.then(markDialogueReady, markDialogueReady)
      }

      if (waitsForMedia && requestedMedia !== undefined) {
        mediaSafetyClock = createPausableDelay(
          MEDIA_SAFETY_TIMEOUT_MS,
          markMediaReady,
          initiallyRunning,
        )
        presentationMediaSafetyClock = mediaSafetyClock
        activeMediaGate = {
          targetId: requestedMedia.targetId,
          markReady: markMediaReady,
          endedTokens: new Set<string>(),
        }
      }

      onCleanup(() => {
        cancelled = true
        dwellClock.cancel()
        safetyClock?.cancel()
        mediaSafetyClock?.cancel()
        if (presentationDwellClock === dwellClock) {
          presentationDwellClock = undefined
        }
        if (presentationSafetyClock === safetyClock) {
          presentationSafetyClock = undefined
        }
        if (presentationMediaSafetyClock === mediaSafetyClock) {
          presentationMediaSafetyClock = undefined
        }
        if (activeMediaGate?.markReady === markMediaReady) {
          activeMediaGate = undefined
        }
        if (completeVisiblePresentation === completeWhenReady) {
          completeVisiblePresentation = undefined
        }
      })
    }),
  )

  createEffect(
    on(
      () => state().spinReadiness?.token,
      (token) => {
        if (token === undefined) return
        const readiness = state().spinReadiness
        if (readiness === undefined) return
        const clock = createPausableDelay(
          Math.max(0, readiness.notBeforeMs - monotonicNow()),
          () => {
            untrack(() => {
              dispatch({
                type: 'SPIN_READY',
                token,
                nowMs: Math.max(monotonicNow(), readiness.notBeforeMs),
              })
            })
          },
          untrack(() => props.foreground),
        )
        spinReadinessClock = clock
        onCleanup(() => {
          clock.cancel()
          if (spinReadinessClock === clock) spinReadinessClock = undefined
        })
      },
    ),
  )

  createEffect(
    on(
      () => props.foreground,
      (foreground) => {
        for (const clock of [
          presentationDwellClock,
          presentationSafetyClock,
          presentationMediaSafetyClock,
          spinReadinessClock,
        ]) {
          if (foreground) clock?.resume()
          else clock?.pause()
        }
        if (foreground) completeVisiblePresentation?.()
      },
    ),
  )

  createEffect(() => {
    if (
      state().phase !== 'COMPLETE' ||
      completed() ||
      props.sessionKind === 'developer-review'
    ) {
      return
    }
    setCompleted(true)
    props.onComplete()
  })

  onCleanup(() => audioDirector.dispose())

  const isRecordPhase = createMemo(() =>
    [
      'B06_RIGID_SPIN',
      'B06_STOP_SAVE_HOLD',
      'B06_SAVE_COMMIT',
      'B07_SAVED_ACK',
    ].includes(state().phase),
  )

  const isBrandPhase = createMemo(() =>
    [
      'B00_BRAND_REVEAL',
      'B00_BEGIN_HOLD',
      'B08_CLOSE_HOME',
      'COMPLETE',
    ].includes(state().phase),
  )

  return (
    <main
      class={styles.director}
      data-phase={state().phase}
      data-session-kind={props.sessionKind}
    >
      <button
        type="button"
        class={styles.soundButton}
        aria-label={props.muted ? 'Unmute audio' : 'Mute audio'}
        aria-pressed={props.muted}
        onClick={toggleMuted}
      >
        <span
          class={styles.speakerIcon}
          classList={{ [styles.speakerIconMuted]: props.muted }}
          aria-hidden="true"
        />
      </button>

      <Show when={props.sessionKind === 'replay'}>
        <button
          type="button"
          class={styles.returnButton}
          disabled={
            state().pendingSave !== undefined ||
            state().pendingReminder !== undefined
          }
          onClick={() => dispatch({ type: 'RETURN_FROM_REPLAY' })}
        >
          Return to settings
        </button>
      </Show>

      <Show when={props.sessionKind === 'developer-review'}>
        <nav class={styles.reviewTools} aria-label="Onboarding review controls">
          <button
            type="button"
            aria-label="Previous scene"
            disabled={V2_ONBOARDING_PHASES.indexOf(state().phase) <= 0}
            onClick={() => navigateReview(-1)}
          >
            ←
          </button>
          <code>{state().phase}</code>
          <button
            type="button"
            aria-label="Next scene"
            disabled={
              V2_ONBOARDING_PHASES.indexOf(state().phase) >=
              V2_ONBOARDING_PHASES.length - 1
            }
            onClick={() => navigateReview(1)}
          >
            →
          </button>
          <button
            type="button"
            class={styles.reviewReplay}
            onClick={replayReview}
          >
            Replay
          </button>
        </nav>
      </Show>

      <section
        class={styles.stage}
        classList={{ [styles.stageBrand]: isBrandPhase() }}
        aria-labelledby="v2-onboarding-title"
      >
        <div class={styles.visual} aria-hidden="true">
          <Switch>
            <Match when={mediaRequest() !== undefined}>
              <V2OnboardingMediaStage
                request={mediaRequest()}
                mode={state().motionMode}
                foreground={props.foreground}
                class={styles.mediaStage}
                onPresentationSettled={settleMediaPresentation}
                onVideoEnded={finishMediaVideo}
              />
            </Match>

            <Match
              when={
                state().phase === 'B00_BRAND_REVEAL' ||
                state().phase === 'B00_BEGIN_HOLD' ||
                state().phase === 'B08_CLOSE_HOME' ||
                state().phase === 'COMPLETE'
              }
            >
              <div
                class={styles.brandReveal}
                classList={{
                  [styles.brandRevealOpening]:
                    state().phase === 'B00_BRAND_REVEAL',
                }}
              >
                <BrandMark />
                <span class={styles.brandGroove} />
              </div>
            </Match>

            <Match when={isRecordPhase()}>
              <div
                class={styles.recordPlayer}
                data-record-spinning={
                  state().phase === 'B06_RIGID_SPIN' ||
                  state().phase === 'B06_STOP_SAVE_HOLD'
                }
                classList={{
                  [styles.recordPlayerSpinning]:
                    state().phase === 'B06_RIGID_SPIN' ||
                    state().phase === 'B06_STOP_SAVE_HOLD',
                }}
              >
                <div class={styles.record}>
                  <span class={styles.recordLabel} />
                  <span class={styles.recordHole} />
                </div>
                <span class={styles.toneArm} />
              </div>
            </Match>

            <Match
              when={
                state().phase === 'B03_PULL_PRESENTATION' ||
                state().phase === 'B04_CUE_CONTEXT_HOLD' ||
                state().phase === 'B05_SIDE_B_CHOICE_HOLD'
              }
            >
              <div class={styles.characterPair}>
                <Show when={corky()}>
                  {(character) => (
                    <AssetStage
                      slot={character().states.notice}
                      ceiling="still"
                      class={styles.corkyAsset}
                      size={512}
                    />
                  )}
                </Show>
                <AssetStage
                  slot={activePullCharacter().token}
                  ceiling="still"
                  class={styles.pullAsset}
                  size={512}
                />
              </div>
            </Match>

            <Match when={true}>
              <Show when={corky()} fallback={<BrandMark compact />}>
                {(character) => (
                  <AssetStage
                    slot={character().states.rest}
                    ceiling="still"
                    class={styles.corkySolo}
                    size={512}
                  />
                )}
              </Show>
            </Match>
          </Switch>
        </div>

        <div class={styles.copy}>
          <h1
            ref={(element) => {
              headingElement = element
            }}
            id="v2-onboarding-title"
            tabIndex={-1}
          >
            {phaseHeading(state())}
          </h1>

          <Show when={captionLine()}>
            {(line) => (
              <p class={styles.caption} aria-live="polite" aria-atomic="true">
                {line().text}
              </p>
            )}
          </Show>

          <Switch>
            <Match when={state().phase === 'B00_BEGIN_HOLD'}>
              <button
                type="button"
                class={styles.primaryAction}
                onClick={begin}
              >
                Tap to begin
              </button>
              <p class={styles.note}>
                Sound starts after your tap. Captions stay on.
              </p>
            </Match>

            <Match when={state().phase === 'B03_PULL_CHOICE_HOLD'}>
              <div
                class={styles.pullGrid}
                role="radiogroup"
                aria-label="Pull choices"
              >
                <For each={props.pullOptions}>
                  {(option) => {
                    const character = () =>
                      findPullCharacter(props.contentPack, option.id) ??
                      GENERIC_PULL_CHARACTER
                    return (
                      <label
                        class={styles.pullChoice}
                        classList={{
                          [styles.pullChoiceSelected]:
                            selectedPullKey() === option.id,
                        }}
                      >
                        <input
                          class={styles.choiceRadio}
                          type="radio"
                          name="v2-pull"
                          value={option.id}
                          aria-label={option.label}
                          checked={selectedPullKey() === option.id}
                          onChange={() => selectPull(option)}
                        />
                        <AssetStage
                          slot={character().token}
                          ceiling="still"
                          class={styles.pullChoiceArt}
                          size={256}
                        />
                        <span>{option.label}</span>
                      </label>
                    )
                  }}
                </For>
                <label
                  class={styles.pullChoice}
                  classList={{
                    [styles.pullChoiceSelected]: selectedPullKey() === 'custom',
                  }}
                >
                  <input
                    class={styles.choiceRadio}
                    type="radio"
                    name="v2-pull"
                    value="custom"
                    aria-label="Something else"
                    checked={selectedPullKey() === 'custom'}
                    onChange={chooseCustomPull}
                  />
                  <AssetStage
                    slot={GENERIC_PULL_CHARACTER.token}
                    ceiling="still"
                    class={styles.pullChoiceArt}
                    size={256}
                  />
                  <span>Something else</span>
                </label>
              </div>
              <Show when={selectedPullKey() === 'custom'}>
                <label class={styles.textField}>
                  <span>Your Pull</span>
                  <input
                    aria-label="Your Pull"
                    value={customPullText()}
                    maxlength={120}
                    autocomplete="off"
                    placeholder="For example, opening the feed again"
                    onInput={(event) =>
                      updateCustomPull(event.currentTarget.value)
                    }
                  />
                  <small>Stored only on this device.</small>
                </label>
              </Show>
              <Show when={selectedPullPreview()}>
                {(line) => <p class={styles.previewCaption}>{line().text}</p>}
              </Show>
              <button
                type="button"
                class={styles.primaryAction}
                disabled={!pullChoiceValid()}
                onClick={() => dispatch({ type: 'CONFIRM_PULL' })}
              >
                Continue
              </button>
            </Match>

            <Match when={state().phase === 'B04_CUE_CONTEXT_HOLD'}>
              <div
                class={styles.choiceList}
                role="radiogroup"
                aria-label="Cue context choices"
              >
                <For each={cueSuggestions()}>
                  {(suggestion) => (
                    <ChoiceButton
                      name="v2-cue-context"
                      value={suggestion.id}
                      selected={cueContextKey() === suggestion.id}
                      label={suggestion.text}
                      onChoose={() =>
                        selectCueContext({
                          kind: 'suggested',
                          suggestionId: suggestion.id,
                          text: suggestion.text,
                        })
                      }
                    />
                  )}
                </For>
                <ChoiceButton
                  name="v2-cue-context"
                  value="custom"
                  selected={cueContextKey() === 'custom'}
                  label="Write my own"
                  onChoose={chooseCustomCueContext}
                />
                <ChoiceButton
                  name="v2-cue-context"
                  value="omitted"
                  selected={cueContextKey() === 'omitted'}
                  label="Not sure yet"
                  description="Your plan works without this."
                  onChoose={() => selectCueContext({ kind: 'omitted' })}
                />
              </div>
              <Show when={cueContextKey() === 'custom'}>
                <label class={styles.textField}>
                  <span>Your cue</span>
                  <input
                    aria-label="Your cue"
                    value={customCueContext()}
                    maxlength={120}
                    autocomplete="off"
                    placeholder="For example, when I get into bed with my phone"
                    onInput={(event) =>
                      updateCustomCueContext(event.currentTarget.value)
                    }
                  />
                  <small>Stored only on this device.</small>
                </label>
              </Show>
              <div class={styles.actions}>
                <button
                  type="button"
                  class={styles.backAction}
                  onClick={() => dispatch({ type: 'BACK' })}
                >
                  Back
                </button>
                <button
                  type="button"
                  class={styles.primaryAction}
                  disabled={!cueContextValid()}
                  onClick={() => dispatch({ type: 'CONFIRM_CUE_CONTEXT' })}
                >
                  Choose Side B
                </button>
              </div>
            </Match>

            <Match when={state().phase === 'B05_SIDE_B_CHOICE_HOLD'}>
              <dl class={styles.planPair}>
                <div>
                  <dt>Side A</dt>
                  <dd>
                    {state().confirmedPull?.sideAText ?? 'The familiar pattern'}
                  </dd>
                </div>
                <div>
                  <dt>Side B</dt>
                  <dd>{state().selectedSideB?.text ?? 'Your chosen turn'}</dd>
                </div>
              </dl>
              <div
                class={styles.choiceList}
                role="radiogroup"
                aria-label="Side B choices"
              >
                <For each={sideBSuggestions()}>
                  {(suggestion) => (
                    <ChoiceButton
                      name="v2-side-b"
                      value={suggestion.key}
                      selected={sideBKey() === suggestion.key}
                      label={suggestion.label}
                      onChoose={() =>
                        selectSideB(
                          {
                            ...(suggestion.suggestionId === undefined
                              ? {}
                              : { suggestionId: suggestion.suggestionId }),
                            text: suggestion.label,
                          },
                          suggestion.key,
                        )
                      }
                    />
                  )}
                </For>
                <ChoiceButton
                  name="v2-side-b"
                  value="custom"
                  selected={sideBKey() === 'custom'}
                  label="Write my own"
                  onChoose={chooseCustomSideB}
                />
              </div>
              <Show when={sideBKey() === 'custom'}>
                <label class={styles.textField}>
                  <span>Your Side B</span>
                  <input
                    aria-label="Your Side B"
                    value={customSideB()}
                    maxlength={120}
                    autocomplete="off"
                    placeholder="For example, play one guitar riff"
                    onInput={(event) =>
                      updateCustomSideB(event.currentTarget.value)
                    }
                  />
                </label>
              </Show>
              <div class={styles.actions}>
                <button
                  type="button"
                  class={styles.backAction}
                  onClick={() => dispatch({ type: 'BACK' })}
                >
                  Back
                </button>
                <button
                  type="button"
                  class={styles.primaryAction}
                  disabled={!sideBValid()}
                  onClick={() => dispatch({ type: 'CONFIRM_SIDE_B' })}
                >
                  Start the record
                </button>
              </div>
            </Match>

            <Match when={state().phase === 'B06_RIGID_SPIN'}>
              <p class={styles.note}>Let it spin for a moment.</p>
            </Match>

            <Match when={state().phase === 'B06_STOP_SAVE_HOLD'}>
              <dl class={styles.planPair}>
                <div>
                  <dt>Side A</dt>
                  <dd>{state().confirmedPull?.sideAText}</dd>
                </div>
                <div>
                  <dt>Side B</dt>
                  <dd>{state().confirmedSideB?.text}</dd>
                </div>
              </dl>
              <Show when={state().saveError}>
                {(message) => (
                  <p class={styles.error} role="alert">
                    {message()}
                  </p>
                )}
              </Show>
              <button
                type="button"
                class={styles.stopAction}
                onClick={() => dispatch({ type: 'STOP_AND_SAVE' })}
              >
                Stop and save
              </button>
            </Match>

            <Match when={state().phase === 'B07_REMINDER_HOLD'}>
              <div
                class={styles.reminderGrid}
                role="radiogroup"
                aria-label="Reminder times"
              >
                <For each={props.reminderPresets}>
                  {(preset) => (
                    <ChoiceButton
                      name="v2-reminder"
                      value={preset.id}
                      selected={state().reminderTime === preset.localTime}
                      label={preset.label}
                      description={preset.localTime}
                      onChoose={() =>
                        dispatch({
                          type: 'SELECT_REMINDER',
                          localTime: preset.localTime,
                        })
                      }
                    />
                  )}
                </For>
              </div>
              <label class={styles.textField}>
                <span>Choose a time</span>
                <input
                  aria-label="Choose a time"
                  type="time"
                  value={state().reminderTime ?? ''}
                  onInput={(event) =>
                    dispatch({
                      type: 'SELECT_REMINDER',
                      localTime: event.currentTarget.value,
                    })
                  }
                />
              </label>
              <Show when={state().reminderError}>
                {(message) => (
                  <p class={styles.error} role="alert">
                    {message()}
                  </p>
                )}
              </Show>
              <div class={styles.actions}>
                <button
                  type="button"
                  class={styles.backAction}
                  onClick={() => dispatch({ type: 'SKIP_REMINDER' })}
                >
                  Not now
                </button>
                <button
                  type="button"
                  class={styles.primaryAction}
                  disabled={normalizedText(state().reminderTime ?? '') === ''}
                  onClick={() => dispatch({ type: 'CONFIRM_REMINDER' })}
                >
                  Set reminder
                </button>
              </div>
            </Match>
          </Switch>
        </div>
      </section>
    </main>
  )
}
