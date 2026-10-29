// The room's data from a button drill: a rated run's slip between two of
// the drill's items starts a pair practice on them, which runs as
// practice, asks only those two, leaves the rating where the rated run
// left it, and ends on a plate of its own.

import { render } from '@solidjs/testing-library'
import { createRoot } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as Banks from '@/lib/ear/banks'
import type { EarBankItem } from '@/lib/ear/banks'
import { LEAP_BANK } from '@/lib/ear/banks'
import { findIdentificationDrill } from '@/lib/ear/drills'
import { REVEAL_HOLD } from '@/lib/ear/timing'
import type * as NativeBuild from '@/lib/native-build'
import { earPlayerRating, resetEarLabStore } from '@/stores/ear-lab-store'
import type { EarStageProps } from './EarStage'
import { IdentificationDrillView } from './IdentificationDrillView'
import { PAIR_PRACTICE_ROUNDS } from './pair-practice'
import type { RoomPlate, StageRoom } from './stage-room'
import { useIdentificationController } from './use-identification-controller'

vi.mock('@/lib/native-build', async (importOriginal) => ({
  ...(await importOriginal<typeof NativeBuild>()),
  EAR_LAB_WITH_MERC: true,
}))
vi.mock('@/features/exercises/feedback', () => ({ playTierSfx: vi.fn() }))
// The arming cue sounds through the app's engine; the room's data does not.
vi.mock('./arming-cue', () => ({ useArmingCue: () => undefined }))
// A rated run asks the minor sixth every round.
vi.mock('@/lib/ear/banks', async (importOriginal) => {
  const original = await importOriginal<typeof Banks>()
  return {
    ...original,
    pickBankItem: (bank: readonly EarBankItem[]) =>
      bank.find((item) => item.itemId === 'leap:m6') ?? bank[0],
  }
})

/** The room the view hands its stage, kept to read back. */
const handed: { room: StageRoom | undefined } = { room: undefined }
vi.mock('./stage-switch', () => ({
  EarStage: (props: EarStageProps) => {
    // eslint-disable-next-line solid/reactivity -- kept to read back, not drawn
    handed.room = props.room
    return null
  },
}))

const leap = findIdentificationDrill('leap')
if (!leap) throw new Error('leap missing from catalogue')

const M6 = 'leap:m6'
const P5 = 'leap:P5'

function room(): StageRoom {
  if (!handed.room) throw new Error('the view handed its stage no room')
  return handed.room
}

beforeEach(() => {
  localStorage.clear()
  resetEarLabStore()
  vi.useFakeTimers()
})

afterEach(() => {
  handed.room = undefined
  vi.useRealTimers()
})

describe("a button drill's slip", () => {
  it('starts a pair practice that asks only the two and rates nothing', async () => {
    await createRoot(async (dispose) => {
      const controller = useIdentificationController(
        leap,
        LEAP_BANK,
        (item) => ({ expectedId: item.itemId, play: async () => undefined }),
      )
      render(() => (
        <IdentificationDrillView
          title="Leap"
          drillId="leap"
          measures="Shape · interval"
          description=""
          prompt="Two notes. Name the distance between them."
          listenHint=""
          answerHint=""
          choices={LEAP_BANK.map((item) => ({
            id: item.itemId,
            label: item.label,
            sub: item.name,
          }))}
          columns={6}
          controller={controller}
          revealName={(id) =>
            LEAP_BANK.find((item) => item.itemId === id)?.name ?? id
          }
          instrument={() => null}
          onBack={() => undefined}
        />
      ))

      /** Every round of the run in progress, answered `answer`. */
      const answerEvery = async (answer: () => string): Promise<void> => {
        for (let round = 0; round < controller.totalRounds; round++) {
          await vi.advanceTimersByTimeAsync(0)
          controller.answer(answer())
          await vi.advanceTimersByTimeAsync(REVEAL_HOLD.defaultMs + 10)
        }
        expect(controller.phase()).toBe('done')
      }

      // A rated run: the minor sixth heard as a fifth, every time.
      controller.start()
      await answerEvery(() => P5)
      const rated = room().plate?.() as RoomPlate
      expect(rated.kind).toBe('rating')
      if (rated.kind !== 'rating') return
      expect(rated.slips).toHaveLength(1)
      expect(rated.slips[0]).toMatchObject({
        expected: 'Minor 6th',
        answered: 'Perfect 5th',
        count: 12,
      })
      const after = earPlayerRating('leap')

      // The slip's offer: a practice on just the two.
      rated.slips[0].practise?.()
      expect(room().run()).toBe('practice')
      expect(room().practising?.()).toEqual(['Minor 6th', 'Perfect 5th'])
      const asked: string[] = []
      await answerEvery(() => {
        const expected = controller.expectedId() ?? ''
        asked.push(expected)
        return expected === M6 ? P5 : M6
      })
      expect(asked).toHaveLength(PAIR_PRACTICE_ROUNDS)
      expect(new Set(asked)).toEqual(new Set([M6, P5]))
      expect(earPlayerRating('leap')).toEqual(after)

      const practised = room().plate?.() as RoomPlate
      expect(practised).toMatchObject({
        kind: 'practice',
        against: ['Minor 6th', 'Perfect 5th'],
        rating: Math.round(after.rating),
        source: 'Leap rating',
        rounds: PAIR_PRACTICE_ROUNDS,
        right: 0,
      })
      dispose()
    })
  })
})
