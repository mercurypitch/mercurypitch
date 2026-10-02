// Song runner HUD semantics — phase, hazard, recovery, and charge copy from authoritative state.

import type { CompiledRunnerTarget, RunnerEpoch, RunnerEvent, RunnerTargetSnapshot, } from '../runner/contracts'
import type { RunnerMovementCue } from '../runner/movement-cues'
import type { RunnerNotationNote } from '../runner/notation'
import { runnerMidiName } from '../runner/notation'
import type { RunnerPauseReason, RunnerSessionState, } from '../runner/session-contracts'

export interface RunnerVoiceCue {
  readonly stage: 'listen' | 'get-ready' | 'sing' | 'checking'
  readonly label: 'Listen' | 'Get ready' | 'Sing' | 'Checking'
  readonly instruction: string
  readonly scoringOpen: boolean
  readonly scoreStatus:
    | 'Scoring opens at Sing'
    | 'Scoring now'
    | 'Scoring closed'
}

export function runnerEventAnnouncement(event: RunnerEvent): string {
  switch (event.type) {
    case 'target-hit':
      return `Phrase complete: ${event.result.grade} ${event.result.grade === 1 ? 'star' : 'stars'}.`
    case 'target-miss':
      return 'Phrase missed. Try the next one.'
    case 'reward-collected':
      return 'Discovery collected.'
    case 'recovery-required':
      if (event.reason === 'fall')
        return 'Gap missed. Returning to the last checkpoint.'
      if (event.reason === 'collision')
        return 'Path blocked. Returning to the last checkpoint.'
      return 'The display fell behind. Returning to the last checkpoint.'
    case 'course-finished':
      return 'Course complete.'
  }
}

export function runnerVoiceCue(snapshot: RunnerTargetSnapshot): RunnerVoiceCue {
  const note = runnerMidiName(snapshot.currentTargetMidi).text
  switch (snapshot.phase) {
    case 'approaching':
      return {
        stage: 'listen',
        label: 'Listen',
        instruction: `Listen for ${note}`,
        scoringOpen: false,
        scoreStatus: 'Scoring opens at Sing',
      }
    case 'emphasized':
      return {
        stage: 'get-ready',
        label: 'Get ready',
        instruction: `${note} is next`,
        scoringOpen: false,
        scoreStatus: 'Scoring opens at Sing',
      }
    case 'judging':
      return {
        stage: 'sing',
        label: 'Sing',
        instruction: `Sing ${note}`,
        scoringOpen: true,
        scoreStatus: 'Scoring now',
      }
    case 'settling':
      return {
        stage: 'checking',
        label: 'Checking',
        instruction: 'Checking that note',
        scoringOpen: false,
        scoreStatus: 'Scoring closed',
      }
  }
}

export function runnerMicrophoneStatus(
  microphone: RunnerSessionState['microphone'],
): string {
  switch (microphone) {
    case 'ready':
      return 'Microphone ready'
    case 'opening':
      return 'Opening microphone'
    case 'interrupted':
      return 'Microphone interrupted'
    case 'closed':
      return 'Microphone off'
  }
}

export function runnerMovementCueCopy(cue: RunnerMovementCue): {
  readonly label: string
  readonly instruction: string
} {
  switch (cue.stage) {
    case 'gap-ahead':
      return { label: 'Gap ahead', instruction: 'Watch the edge' }
    case 'jump':
      return { label: 'Jump', instruction: 'Now' }
    case 'landing':
      return { label: 'Landing', instruction: 'Keep your line' }
    case 'change-lane':
      return { label: 'Change lane', instruction: 'Take the open side' }
  }
}

export function runnerRecoveryCopy(
  reason: Extract<RunnerEvent, { type: 'recovery-required' }>['reason'] | '',
): {
  readonly eyebrow: string
  readonly title: string
  readonly detail: string
} {
  if (reason === 'fall')
    return {
      eyebrow: 'Gap missed',
      title: 'Take the jump again',
      detail:
        'Press Jump when the cue changes from Gap ahead to Jump. Your settled notes and discoveries stay with you.',
    }
  if (reason === 'frame-gap')
    return {
      eyebrow: 'Run interrupted',
      title: 'The display fell behind',
      detail:
        'Restart this stretch from the checkpoint. Your settled notes and discoveries stay with you.',
    }
  if (reason === 'collision')
    return {
      eyebrow: 'Path blocked',
      title: 'Try this stretch again',
      detail:
        'Use the lane controls to take the open side. Your settled notes and discoveries stay with you.',
    }
  return {
    eyebrow: 'Checkpoint ready',
    title: 'Try that stretch again',
    detail: 'Your settled notes and discoveries stay with you.',
  }
}

export function runnerPauseMessage(reason: RunnerPauseReason | null): string {
  switch (reason) {
    case 'background':
      return 'The run paused when the app moved to the background.'
    case 'audio-interrupted':
      return 'Audio was interrupted. Resume when your sound is ready.'
    case 'microphone-interrupted':
      return 'The microphone stopped. Check your input before resuming.'
    case 'renderer-unavailable':
      return 'The scene paused while the display recovers.'
    default:
      return 'Resume from your last checkpoint when you are ready.'
  }
}

export function runnerTargetResultNotice(
  course: {
    readonly voice: { readonly comfortableRootOffsetSemitones: number }
    readonly targets: readonly {
      readonly id: string
      readonly notes: readonly { readonly endOffsetSemitones: number }[]
    }[]
  },
  comfortableMidi: number,
  result: {
    readonly id: string
    readonly epoch: RunnerEpoch
    readonly outcome: 'hit' | 'miss'
    readonly resolvedAtCourseSeconds: number
  } | null,
  currentEpoch: RunnerEpoch | null,
  courseSeconds: number,
): {
  readonly id: string
  readonly outcome: 'hit' | 'miss'
  readonly label: string
  readonly instruction: string
} | null {
  if (
    result === null ||
    result.epoch !== currentEpoch ||
    courseSeconds < result.resolvedAtCourseSeconds ||
    courseSeconds - result.resolvedAtCourseSeconds > 1.1
  )
    return null
  if (result.outcome === 'miss')
    return {
      id: result.id,
      outcome: 'miss',
      label: 'Missed',
      instruction: 'Try the next one',
    }
  const target = course.targets.find((candidate) => candidate.id === result.id)
  const endNote = target?.notes.at(-1)
  if (endNote === undefined) return null
  const midi =
    comfortableMidi +
    course.voice.comfortableRootOffsetSemitones +
    endNote.endOffsetSemitones
  return {
    id: result.id,
    outcome: 'hit',
    label: 'Released',
    instruction: `${runnerMidiName(midi).text} opened the glass`,
  }
}

/** Charge walls teach pitch order; their symbols deliberately make no duration claim. */
export function runnerDisplayNotationNotes(
  target: Pick<CompiledRunnerTarget, 'completionPolicy'>,
  notes: readonly RunnerNotationNote[],
): readonly RunnerNotationNote[] {
  if (target.completionPolicy !== 'charge') return notes
  return notes.map((note, index) => ({
    ...note,
    startBeat: index,
    endBeat: index + 1,
  }))
}
