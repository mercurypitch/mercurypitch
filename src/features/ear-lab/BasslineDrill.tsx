// ============================================================
// BasslineDrill — root motion, tapped back as degrees.
//
// The tonic chord is held on the guitar while four roots walk
// underneath on the bass voice; the player taps the four degrees
// back in order on a seven-rung ladder marked in numerals. The
// first root is always the tonic, so the line has a floor to be
// heard from. Judged like Echo — the whole line at once — and drawn
// on the bead chain, heights hidden until the reveal.
//
// In the native room Hear it again walks the same line in the same key
// and leaves the chain as the answer drew it, and a miss offers
// Compare: the line, then the one tapped, under the same held tonic.
// ============================================================

import type { JSX } from 'solid-js'
import { createSignal } from 'solid-js'
import { useEngines } from '@/contexts/EngineContext'
import type { EarBankItem } from '@/lib/ear/banks'
import { findIdentificationDrill } from '@/lib/ear/drills'
import { roveRootMidi } from '@/lib/ear/item-bank'
import type { PhraseVerdict } from '@/lib/ear/phrase'
import { judgePhrase } from '@/lib/ear/phrase'
import { BASSLINE_BANK, bassRootMidi, degreeChordMidis, progressionName, romanOf, } from '@/lib/ear/progressions'
import { BASSLINE_TIMING, compareSequence, LADDER_TIMING, } from '@/lib/ear/timing'
import { EAR_LAB_WITH_MERC } from '@/lib/native-build'
import { BeadChain } from './BeadChain'
import { useEarRoom } from './ear-room-context'
import type { Strummer } from './guitar-chords'
import { createStrummer } from './guitar-chords'
import type { IdentificationCompare } from './IdentificationDrillView'
import { IdentificationDrillView } from './IdentificationDrillView'
import { PhraseConsole } from './PhraseConsole'
import type { IdentificationTrial } from './use-identification-controller'
import { useIdentificationController } from './use-identification-controller'

const BASS_DEGREES: readonly number[] = [1, 2, 3, 4, 5, 6, 7]

const nameOf = (choiceId: string): string =>
  BASSLINE_BANK.find((item) => item.itemId === choiceId)?.name ?? choiceId

/** Compare's words, for the native room alone: the line in numerals,
 *  and a slip as the line that was tapped (the pick's id is its name). */
const BASSLINE_COMPARE: IdentificationCompare | undefined = EAR_LAB_WITH_MERC
  ? {
      names: (answerId, pickId) => ({
        answer: nameOf(answerId),
        pick: pickId,
      }),
    }
  : undefined

export function BasslineDrill(props: { onBack: () => void }): JSX.Element {
  const { audioEngine } = useEngines()
  const room = useEarRoom()
  const drill = findIdentificationDrill('bassline')
  if (!drill) throw new Error('bassline drill missing from catalogue')

  const [line, setLine] = createSignal<readonly number[]>([])
  const [answered, setAnswered] = createSignal<number[]>([])
  const [verdict, setVerdict] = createSignal<PhraseVerdict | null>(null)
  const [sounding, setSounding] = createSignal(0)
  let strummer: Strummer | null = null
  let timers: Array<ReturnType<typeof setTimeout>> = []
  /** Bumped by every silencing. A line still waiting on the audio engine
   *  when it comes (the run stopped, the room closed, the sound taken
   *  away; iOS holds resume() through a call) sounds nothing once the
   *  engine is ready. */
  let silenced = 0
  /** The end of the line sounding, which a silencing settles. */
  let ending: ((sounded: boolean) => void) | null = null
  let rootMidi = 48

  function cancelAudio(): void {
    silenced += 1
    for (const timer of timers) clearTimeout(timer)
    timers = []
    strummer?.cancel()
    strummer = null
    setSounding(0)
    // Cut short, it still ends: whatever waits on it hears it did not
    // sound out, and goes no further.
    const cut = ending
    ending = null
    cut?.(false)
  }

  /** True once the line has sounded to its end; false when a silencing
   *  came while it waited on the audio, or cut it short. */
  async function playLine(
    degrees: readonly number[],
    rootMs: number,
  ): Promise<boolean> {
    const asked = silenced
    await audioEngine.init()
    await audioEngine.resume()
    const ctx = audioEngine.getAudioContext()
    if (!ctx || asked !== silenced) return false
    cancelAudio()
    strummer = createStrummer(ctx, room.volume() * audioEngine.getVolume())
    const start = ctx.currentTime + BASSLINE_TIMING.leadInS
    const stepMs = rootMs + BASSLINE_TIMING.rootGapMs
    const heldMs = BASSLINE_TIMING.restMs + degrees.length * stepMs
    // The tonic chord rings under the whole line.
    strummer.strum(degreeChordMidis(rootMidi, 1), start, heldMs / 1000)
    degrees.forEach((degree, i) => {
      const atMs = BASSLINE_TIMING.restMs + i * stepMs
      strummer?.strum(
        [bassRootMidi(rootMidi, degree)],
        start + atMs / 1000,
        rootMs / 1000,
      )
      timers.push(
        setTimeout(
          () => setSounding(i + 1),
          BASSLINE_TIMING.leadInS * 1000 + atMs,
        ),
      )
    })
    return new Promise<boolean>((resolve) => {
      ending = resolve
      timers.push(
        setTimeout(
          () => {
            ending = null
            setSounding(0)
            resolve(true)
          },
          BASSLINE_TIMING.leadInS * 1000 + heldMs + BASSLINE_TIMING.tailMs,
        ),
      )
    })
  }

  function makeTrial(item: EarBankItem): IdentificationTrial {
    return {
      expectedId: item.itemId,
      play: async () => {
        rootMidi = roveRootMidi()
        setLine(item.payload)
        setAnswered([])
        setVerdict(null)
        await playLine(item.payload, BASSLINE_TIMING.rootMs)
      },
      replayOnWrong: async () => {
        await playLine(item.payload, BASSLINE_TIMING.replayRootMs)
      },
      ...(EAR_LAB_WITH_MERC
        ? {
            // The same line in the same key: play() would rove the key
            // and wipe the chain the answer drew.
            replay: async (): Promise<void> => {
              await playLine(item.payload, BASSLINE_TIMING.rootMs)
            },
            // The line, then the one tapped, under the same tonic. Each
            // goes through the guard above; a silencing in the pause
            // between them moves the count from where it stood as the
            // first ended, and ends Compare there.
            compare: async (): Promise<void> => {
              const tapped = [...answered()]
              if (tapped.length === 0) return
              let asked = silenced
              await compareSequence(
                async () => {
                  const sounded = await playLine(
                    item.payload,
                    BASSLINE_TIMING.rootMs,
                  )
                  asked = silenced
                  return sounded
                },
                () => playLine(tapped, BASSLINE_TIMING.rootMs),
                () => asked === silenced,
              )
            },
          }
        : {}),
    }
  }

  const controller = useIdentificationController(
    drill,
    BASSLINE_BANK,
    makeTrial,
    { cancelAudio },
  )
  const phase = () => controller.phase()

  /** A tapped rung sounds its root on the bass, short. */
  const soundRoot = (degree: number) => {
    const ctx = audioEngine.getAudioContext()
    if (!ctx) return
    strummer ??= createStrummer(ctx, room.volume() * audioEngine.getVolume())
    strummer.strum(
      [bassRootMidi(rootMidi, degree)],
      ctx.currentTime,
      LADDER_TIMING.tapMs / 1000,
    )
  }

  const tap = (degree: number) => {
    if (phase() !== 'answer') return
    soundRoot(degree)
    const next = [...answered(), degree]
    setAnswered(next)
    if (next.length < line().length) return
    const result = judgePhrase(line(), next)
    setVerdict(result)
    // A slip is recorded as the line that was tapped.
    controller.answer(
      result.correct ? (controller.expectedId() ?? '') : progressionName(next),
    )
  }

  const undo = () => {
    if (phase() !== 'answer') return
    setAnswered((list) => list.slice(0, -1))
  }

  return (
    <IdentificationDrillView
      title="Bassline"
      drillId="bassline"
      measures="Function · root motion"
      description="The tonic chord rings on the guitar while four bass roots walk under it. Tap the roots back in order on the ladder, in numerals: I first, always, then wherever the line went. Backspace takes one back; the whole line is judged at once. A miss plays it again, slower. This is the bass player's hearing: not the chords, the floor under them."
      prompt="Four bass roots under a held tonic. Tap them back in order."
      listenHint="Listen to the line…"
      answerHint="Tap the roots back on the ladder, in order."
      choices={[]}
      columns={7}
      controller={controller}
      revealName={nameOf}
      answerVerb="tapped"
      compare={BASSLINE_COMPARE}
      slipNote={() => {
        const result = verdict()
        return result !== null && !result.correct && result.firstMiss !== null
          ? `first slip at root ${result.firstMiss + 1}`
          : undefined
      }}
      answerConsole={() => (
        <PhraseConsole
          expectedLength={line().length}
          answered={answered()}
          armed={phase() === 'answer'}
          label={`Tap the ${line().length} roots back`}
          degrees={BASS_DEGREES}
          words={romanOf}
          onTap={tap}
          onUndo={undo}
        />
      )}
      answerKeys={() =>
        phase() !== 'answer'
          ? []
          : [
              ...BASS_DEGREES.map((degree) => ({
                key: String(degree),
                action: () => tap(degree),
              })),
              { key: 'Backspace', action: undo },
            ]
      }
      instrument={() => (
        <BeadChain
          count={line().length || 4}
          sounding={sounding()}
          reveal={
            phase() === 'reveal' && verdict()
              ? {
                  expected: line(),
                  answered: answered(),
                  perNote: verdict()?.perNote ?? [],
                }
              : null
          }
        />
      )}
      onBack={props.onBack}
    />
  )
}
