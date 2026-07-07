// ============================================================
// Voice Mirror — "Sing the Universe" (spec v2).
//
// Match short target melodies sonified from real cosmic data —
// Gaia star positions, pulsar spin rates, the Perseus black-hole
// tone — fitted into the singer's detected range and scored with
// the same octave-folded engine as Task C. Entry point: the
// results screen, so the range is already known.
// ============================================================

import type { Component } from 'solid-js'
import { createSignal, For, onCleanup, Show } from 'solid-js'
import { micManager } from '@/lib/mic-manager'
import type { CosmicMelody } from '@/lib/mirror/cosmic-melodies'
import { COSMIC_MELODIES, fitMelodyToRange } from '@/lib/mirror/cosmic-melodies'
import type { AccuracyResult, F0Frame, NoteTakeResult, RangeResult, } from '@/lib/mirror/metrics'
import { computeAccuracy, scoreMatchTake } from '@/lib/mirror/metrics'
import { midiToNoteNameOctave } from '@/lib/note-utils'
import { cardToPngBlob, copyCardToClipboard, copyOutcomeMessage, datedFilename, renderCard, shareCard, supportsImageClipboard, } from './card-renderer'
import type { F0Stream } from './f0-stream'
import { createF0Stream } from './f0-stream'
import { trackFunnel } from './funnel'
import { LiveViz, MicLevelBar } from './LiveViz'
import { playReferenceTone } from './tone-player'

const MIC_CONSUMER_ID = 'voice-mirror-cosmic'
const BEAT_SEC = 0.55
/** Recording window per note: at least this, longer for held notes. */
const MIN_TAKE_SEC = 2.5
const TAKE_SEC_PER_BEAT = 1.1
const FALLBACK_RANGE = { lowMidi: 43, highMidi: 67 } // G2–G4

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms))

type CosmicPhase = 'pick' | 'listen' | 'sing' | 'score'

const BAND_PIP: Record<NoteTakeResult['band'], string> = {
  bullseye: 'bullseye',
  hit: 'hit',
  close: 'close',
  miss: 'miss',
  'no-voice': 'no-voice',
}

interface CosmicModeProps {
  range: RangeResult | null
  onBack: () => void
  /** Label for the pick-screen back button. Defaults to "Back to results"
   *  (entered from the results screen); a deep link with no prior run passes
   *  its own wording since there are no results to return to. */
  backLabel?: string
}

export const CosmicMode: Component<CosmicModeProps> = (props) => {
  const [phase, setPhase] = createSignal<CosmicPhase>('pick')
  const [melody, setMelody] = createSignal<CosmicMelody | null>(null)
  const [noteIndex, setNoteIndex] = createSignal(0)
  const [listening, setListening] = createSignal(false)
  const [targets, setTargets] = createSignal<number[]>([])
  const [result, setResult] = createSignal<AccuracyResult | null>(null)
  const [shareStatus, setShareStatus] = createSignal<string | null>(null)
  const [micError, setMicError] = createSignal<string | null>(null)
  const [takeKey, setTakeKey] = createSignal(0)

  let audioContext: AudioContext | null = null
  let f0: F0Stream | null = null
  let cancelled = false
  let running = false
  let sungFrames: F0Frame[] = []

  onCleanup(() => {
    cancelled = true
    teardownAudio()
  })

  function teardownAudio(): void {
    f0?.dispose()
    f0 = null
    micManager.release(MIC_CONSUMER_ID)
    void audioContext?.close().catch(() => undefined)
    audioContext = null
  }

  /** Runs one melody end-to-end. Called from the pick tap (iOS gesture). */
  async function startMelody(pick: CosmicMelody): Promise<void> {
    // A double-tap during mic acquisition would run two flows over the same
    // closure audio state (leaked contexts, overlapping playback).
    if (running) return
    running = true
    setMelody(pick)
    setResult(null)
    setShareStatus(null)
    setMicError(null)
    sungFrames = []
    try {
      audioContext = new AudioContext()
      if (audioContext.state === 'suspended') await audioContext.resume()
      const stream = await micManager.acquire(MIC_CONSUMER_ID)
      f0 = createF0Stream(audioContext, stream)
      // Same dead-input condition the guided flow guards against (iOS WebKit
      // sample-rate silence when the context pre-dates a fresh capture):
      // quick zero-check, one automatic rebuild with a post-capture context.
      f0.startTask()
      await sleep(500)
      f0.takeFrames()
      if (f0.maxLevel() <= 1e-6) {
        f0.dispose()
        await audioContext.close().catch(() => undefined)
        audioContext = new AudioContext()
        if (audioContext.state === 'suspended') {
          await audioContext.resume().catch(() => undefined)
        }
        f0 = createF0Stream(audioContext, micManager.getStream() ?? stream)
      }
    } catch {
      // Say why instead of silently bouncing back to the results screen.
      running = false
      teardownAudio()
      setPhase('pick')
      setMicError(
        "We couldn't open the microphone — check the browser's mic permission and try again.",
      )
      return
    }

    const low = props.range?.lowMidi ?? FALLBACK_RANGE.lowMidi
    const high = props.range?.highMidi ?? FALLBACK_RANGE.highMidi
    const midis = fitMelodyToRange(pick, low, high)
    setTargets(midis)

    // Hear the whole melody first, so it lands as music, not a drill.
    setPhase('listen')
    for (let i = 0; i < midis.length && !cancelled; i++) {
      if (audioContext !== null) {
        await playReferenceTone(
          audioContext,
          midis[i],
          BEAT_SEC * pick.notes[i].beats,
        )
      }
    }
    if (cancelled) return

    // Then note by note: reference, sing back — never simultaneous.
    setPhase('sing')
    const takes: NoteTakeResult[] = []
    let traceOffset = 0
    for (let i = 0; i < midis.length && !cancelled; i++) {
      setNoteIndex(i)
      setListening(true)
      if (audioContext !== null) {
        await playReferenceTone(audioContext, midis[i], 0.8)
      }
      if (cancelled) return
      setListening(false)
      setTakeKey((k) => k + 1)
      f0?.startTask()
      const takeSec = Math.max(
        MIN_TAKE_SEC,
        TAKE_SEC_PER_BEAT * pick.notes[i].beats,
      )
      await sleep(takeSec * 1000)
      const frames = f0?.takeFrames() ?? []
      takes.push(scoreMatchTake(frames, midis[i]))
      // Concatenate takes on one time axis so the card shows the whole sing.
      sungFrames.push(
        ...frames.map((frame) => ({ ...frame, t: frame.t + traceOffset })),
      )
      traceOffset += takeSec
    }
    if (cancelled) return

    teardownAudio()
    running = false
    setResult(computeAccuracy(takes))
    setPhase('score')
    trackFunnel('cosmic_done')
  }

  function buildCard(): HTMLCanvasElement | null {
    const scored = result()
    const pick = melody()
    if (!scored || !pick) return null
    return renderCard(
      {
        result: { range: null, accuracy: scored, steadiness: null },
        glides: [sungFrames],
        title: `✦ ${pick.name} · ${scored.score}`,
      },
      'story',
    )
  }

  async function onShare(): Promise<void> {
    const card = buildCard()
    if (!card) return
    const outcome = await shareCard(
      await cardToPngBlob(card),
      datedFilename('sing-the-universe'),
    )
    trackFunnel('card_shared')
    setShareStatus(
      outcome === 'shared' ? 'Shared!' : 'Saved — post it anywhere.',
    )
  }

  async function onCopy(): Promise<void> {
    const card = buildCard()
    if (!card) return
    const outcome = await copyCardToClipboard(cardToPngBlob(card))
    if (outcome === 'copied') trackFunnel('card_shared')
    setShareStatus(copyOutcomeMessage(outcome))
  }

  return (
    <section class="mirror-panel">
      <Show when={phase() === 'pick'}>
        <h2>Sing the Universe</h2>
        <p class="mirror-dim">
          Short melodies made from real cosmic data, fitted to your range.
          Listen, then sing them back.
        </p>
        <Show when={micError()}>
          <p class="mirror-error">{micError()}</p>
        </Show>
        <div class="mirror-melody-list">
          <For each={COSMIC_MELODIES}>
            {(item) => (
              <button
                class="mirror-melody-card"
                onClick={() => void startMelody(item)}
              >
                <strong>{item.name}</strong>
                <span>{item.blurb}</span>
                <em>{item.source}</em>
              </button>
            )}
          </For>
        </div>
        <button
          class="mirror-cta mirror-cta-secondary"
          onClick={() => props.onBack()}
        >
          {props.backLabel ?? 'Back to results'}
        </button>
      </Show>

      <Show when={phase() === 'listen'}>
        <h2>{melody()?.name}</h2>
        <p class="mirror-dim">{melody()?.blurb}</p>
        <div class="mirror-stage">
          <div class="mirror-listening">listen…</div>
        </div>
      </Show>

      <Show when={phase() === 'sing'}>
        <h2>{melody()?.name}</h2>
        <p class="mirror-dim">
          Note {noteIndex() + 1} of {targets().length} —{' '}
          {midiToNoteNameOctave(targets()[noteIndex()] ?? 60)} (any octave
          counts)
        </p>
        <div class="mirror-stage">
          <Show when={listening()}>
            <div class="mirror-listening">listen…</div>
          </Show>
          <Show when={!listening()}>
            <LiveViz
              latest={() => f0?.latest() ?? null}
              mode="match"
              targetMidi={targets()[noteIndex()] ?? null}
              resetKey={takeKey()}
            />
            <MicLevelBar level={() => f0?.latestLevel() ?? 0} />
          </Show>
        </div>
      </Show>

      <Show when={phase() === 'score' && result()}>
        <h2>{melody()?.name}</h2>
        <p class="mirror-hero">
          {result()?.score}
          <span class="mirror-hero-sub"> / 100</span>
        </p>
        <div class="mirror-pips">
          <For each={result()?.takes}>
            {(take) => (
              <span
                class={`mirror-pip mirror-pip-${BAND_PIP[take.band]}`}
                title={midiToNoteNameOctave(take.targetMidi)}
              />
            )}
          </For>
        </div>
        <p class="mirror-dim">{melody()?.source}</p>
        <div class="mirror-actions">
          <button class="mirror-cta" onClick={() => void onShare()}>
            Share it
          </button>
          <Show when={supportsImageClipboard()}>
            <button
              class="mirror-cta mirror-cta-secondary"
              onClick={() => void onCopy()}
            >
              Copy image
            </button>
          </Show>
          <button
            class="mirror-cta mirror-cta-secondary"
            onClick={() => setPhase('pick')}
          >
            Sing another
          </button>
          <button
            class="mirror-cta mirror-cta-secondary"
            onClick={() => props.onBack()}
          >
            Done
          </button>
        </div>
        <Show when={shareStatus()}>
          <p class="mirror-dim">{shareStatus()}</p>
        </Show>
      </Show>
    </section>
  )
}
