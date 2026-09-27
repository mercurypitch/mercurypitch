// Echo Curator session — sequence existing melody-practice results without owning voice evidence.

import type { EchoCuratorAuditionDefinition } from '../content/echo-curator'
import { echoCuratorRoundNoteCount } from '../content/echo-curator'
import { glassMelody } from '../content/melodies'
import type { MelodyPracticeSnapshot } from './melody-practice'

export type EchoCuratorPhase = 'intro' | 'round' | 'result' | 'complete'

export interface EchoCuratorSnapshot {
  phase: EchoCuratorPhase
  roundIndex: number
  roundToken: string | null
  completedRoundIds: readonly string[]
  message: string
}

export interface EchoCuratorSession {
  snapshot(): EchoCuratorSnapshot
  begin(): void
  acceptCompletion(
    roundToken: string,
    practice: MelodyPracticeSnapshot,
  ): boolean
  advance(): void
  retryRound(): void
  reset(): void
}

function copy(snapshot: EchoCuratorSnapshot): EchoCuratorSnapshot {
  return {
    ...snapshot,
    completedRoundIds: [...snapshot.completedRoundIds],
  }
}

function validateDefinition(definition: EchoCuratorAuditionDefinition): void {
  if (
    !definition.id ||
    !Number.isInteger(definition.revision) ||
    definition.revision < 1
  )
    throw new Error('Echo Curator identity is invalid.')
  const ids = new Set<string>()
  const noteCounts = definition.rounds.map((round) => {
    if (!round.id || ids.has(round.id))
      throw new Error('Echo Curator round IDs must be unique.')
    ids.add(round.id)
    return echoCuratorRoundNoteCount(round)
  })
  if (noteCounts.join(',') !== '3,5,7')
    throw new Error('Echo Curator rounds must teach 3, 5, then 7 notes.')
}

export function createEchoCuratorSession(
  definition: EchoCuratorAuditionDefinition,
  onChange: (snapshot: EchoCuratorSnapshot) => void,
): EchoCuratorSession {
  validateDefinition(definition)
  let generation = 0
  let snapshot: EchoCuratorSnapshot = {
    phase: 'intro',
    roundIndex: 0,
    roundToken: null,
    completedRoundIds: [],
    message: definition.introduction,
  }

  const emit = (patch: Partial<EchoCuratorSnapshot>): void => {
    snapshot = { ...snapshot, ...patch }
    onChange(copy(snapshot))
  }

  const beginRound = (roundIndex: number): void => {
    const round = definition.rounds[roundIndex]
    const roundToken = `${definition.id}:${definition.revision}:${round.id}:${++generation}`
    emit({
      phase: 'round',
      roundIndex,
      roundToken,
      message: round.invitation,
    })
  }

  return {
    snapshot: () => copy(snapshot),
    begin() {
      if (snapshot.phase !== 'intro') return
      beginRound(0)
    },
    acceptCompletion(roundToken, practice) {
      if (
        snapshot.phase !== 'round' ||
        snapshot.roundToken !== roundToken ||
        practice.mode !== 'complete' ||
        practice.judge?.complete !== true
      )
        return false
      const round = definition.rounds[snapshot.roundIndex]
      if (
        practice.contour?.id !== round.melodyId ||
        practice.contour.version !== glassMelody(round.melodyId).version
      )
        return false
      emit({
        phase: 'result',
        roundToken: null,
        completedRoundIds: [...snapshot.completedRoundIds, round.id],
        message: round.success,
      })
      return true
    },
    advance() {
      if (snapshot.phase !== 'result') return
      if (snapshot.roundIndex + 1 >= definition.rounds.length) {
        generation++
        emit({
          phase: 'complete',
          roundToken: null,
          message: definition.completion,
        })
        return
      }
      beginRound(snapshot.roundIndex + 1)
    },
    retryRound() {
      if (snapshot.phase !== 'round') return
      beginRound(snapshot.roundIndex)
    },
    reset() {
      generation++
      emit({
        phase: 'intro',
        roundIndex: 0,
        roundToken: null,
        completedRoundIds: [],
        message: definition.introduction,
      })
    },
  }
}
