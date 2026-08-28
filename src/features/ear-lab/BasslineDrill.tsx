// ============================================================
// BasslineDrill — root motion, tapped back as degrees.
//
// The tonic chord is held on the guitar while four roots walk
// underneath on the bass voice; the player taps the four degrees
// back in order on a seven-rung ladder marked in numerals. The
// first root is always the tonic, so the line has a floor to be
// heard from. Judged like Echo — the whole line at once — and drawn
// on the bead chain, heights hidden until the reveal.
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
import { BASSLINE_TIMING, LADDER_TIMING } from '@/lib/ear/timing'
import { BeadChain } from './BeadChain'
import { useEarRoom } from './ear-room-context'
import type { Strummer } from './guitar-chords'
import { createStrummer } from './guitar-chords'
import { IdentificationDrillView } from './IdentificationDrillView'
import { PhraseConsole } from './PhraseConsole'
import type { IdentificationTrial } from './use-identification-controller'
import { useIdentificationController } from './use-identification-controller'

const BASS_DEGREES: readonly number[] = [1, 2, 3, 4, 5, 6, 7]

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
  let rootMidi = 48

  function cancelAudio(): void {
    for (const timer of timers) clearTimeout(timer)
    timers = []
    strummer?.cancel()
    strummer = null
    setSounding(0)
  }

  async function playLine(
    degrees: readonly number[],
    rootMs: number,
  ): Promise<void> {
    await audioEngine.init()
    await audioEngine.resume()
    const ctx = audioEngine.getAudioContext()
    if (!ctx) return
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
    await new Promise<void>((resolve) => {
      timers.push(
        setTimeout(
          () => {
            setSounding(0)
            resolve()
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
      replayOnWrong: () => playLine(item.payload, BASSLINE_TIMING.replayRootMs),
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

  const nameOf = (choiceId: string) =>
    BASSLINE_BANK.find((item) => item.itemId === choiceId)?.name ?? choiceId

  return (
    <IdentificationDrillView
      title="Bassline"
      drillId="bassline"
      measures="Function · root motion"
      description="The tonic chord rings on the guitar while four bass roots walk under it. Tap the roots back in order on the ladder, in numerals — I first, always, then wherever the line went. Backspace takes one back; the whole line is judged at once. A miss plays it again, slower. This is the bass player's hearing: not the chords, the floor under them."
      prompt="Four bass roots under a held tonic — tap them back in order."
      listenHint="Listen to the line…"
      answerHint="Tap the roots back on the ladder, in order."
      choices={[]}
      columns={7}
      controller={controller}
      revealName={nameOf}
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
