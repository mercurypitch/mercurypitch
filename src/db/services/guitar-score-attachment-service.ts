// Recorded melody placement belongs to one backing and immutable score revision.
import type { GuitarPracticeScore } from '@/lib/guitar/recording-types'
import type { ScoreAlignment } from '@/lib/transcription/score-alignment'
import type { DexieAdapter } from '../adapters/dexie-adapter'
import { getLocalDatabase } from '../local-database'

interface GuitarScoreAttachment {
  id: string
  scoreId: string
  backingId: string
  createdAt: string
  updatedAt: string
  /** Null remembers an explicit removal, including a captured clock anchor. */
  alignment: ScoreAlignment | null
}

export function validGuitarRecordingAlignment(
  alignment: ScoreAlignment,
): boolean {
  return (
    alignment?.source === 'manual' &&
    Array.isArray(alignment.anchors) &&
    alignment.anchors.length >= 1 &&
    alignment.anchors.length <= 2 &&
    alignment.anchors.every(
      (anchor, index, anchors) =>
        Number.isFinite(anchor.scoreSeconds) &&
        Number.isFinite(anchor.audioSeconds) &&
        anchor.scoreSeconds >= 0 &&
        anchor.scoreSeconds <= 301 &&
        anchor.audioSeconds >= -301 &&
        anchor.audioSeconds < 86400 &&
        (index === 0 ||
          (anchor.scoreSeconds > anchors[index - 1].scoreSeconds &&
            anchor.audioSeconds > anchors[index - 1].audioSeconds)),
    )
  )
}

export function createGuitarScoreAttachmentStore(
  db: DexieAdapter = getLocalDatabase(),
) {
  const pairId = (scoreId: string, backingId: string): string =>
    JSON.stringify([scoreId, backingId])
  return {
    async read(
      score: GuitarPracticeScore,
      backingId: string,
    ): Promise<ScoreAlignment | null> {
      const saved = await db.readByIdStrict<GuitarScoreAttachment>(
        'guitarScoreAttachments',
        pairId(score.id, backingId),
      )
      if (saved !== undefined) {
        if (
          saved.alignment !== null &&
          !validGuitarRecordingAlignment(saved.alignment)
        )
          throw new Error(
            'The saved song placement is damaged. Align the melody again.',
          )
        return saved.alignment
      }
      const placement = score.attachment
      const first = score.notes[0]
      const last = score.notes.at(-1)
      if (
        placement?.backingId !== backingId ||
        first === undefined ||
        last === undefined
      )
        return null
      const anchors = [
        {
          scoreSeconds: (first.startBeat * 60) / score.bpm,
          audioSeconds: placement.firstSeconds,
        },
      ]
      if (last.startBeat > first.startBeat)
        anchors.push({
          scoreSeconds: (last.startBeat * 60) / score.bpm,
          audioSeconds: placement.lastSeconds,
        })
      const alignment: ScoreAlignment = { source: 'manual', anchors }
      return validGuitarRecordingAlignment(alignment) ? alignment : null
    },
    async save(
      scoreId: string,
      backingId: string,
      alignment: ScoreAlignment | null,
    ): Promise<void> {
      if (alignment !== null && !validGuitarRecordingAlignment(alignment))
        throw new Error(
          'That song placement could not be saved. Check its first and last marks.',
        )
      await db.transaction(async () => {
        if (
          (await db.readByIdStrict('guitarPracticeScores', scoreId)) ===
          undefined
        )
          throw new Error('This practice revision no longer exists.')
        const id = pairId(scoreId, backingId)
        const previous = await db.readByIdStrict<GuitarScoreAttachment>(
          'guitarScoreAttachments',
          id,
        )
        const now = new Date().toISOString()
        await db.putStrict('guitarScoreAttachments', {
          id,
          scoreId,
          backingId,
          createdAt: previous?.createdAt ?? now,
          updatedAt: now,
          alignment,
        })
      })
    },
  }
}
