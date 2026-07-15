import type { Component } from 'solid-js'
import { createEffect, createSignal, For, onCleanup, onMount, untrack, } from 'solid-js'
import { IconCheck, IconCross, IconGame } from '@/components/exercise-icons'
import { ExercisePitchTracker } from '@/components/ExercisePitchTracker'
import { updateDifficultyFromEma } from '@/features/practice-intelligence/difficulty-store'
import type { AudioEngine } from '@/lib/audio-engine'
import { midiToNoteName } from '@/lib/frequency-to-note'
import type { PracticeEngine } from '@/lib/practice-engine'
import { recordExerciseResult } from '@/stores/exercise-history-store'
import { ExerciseShell } from '../ExerciseShell'
import { EXERCISE_PITCH_PURSUIT } from '../types'
import { useBaseExercise } from '../use-base-exercise'
import { usePitchPursuitController } from './use-pitch-pursuit-controller'

interface PitchPursuitExerciseProps {
  audioEngine: AudioEngine
  practiceEngine: PracticeEngine
  onBack: () => void
  autoStart?: boolean
}

const TARGET_ZONE_FRAC = 0.88

const PitchPursuitExercise: Component<PitchPursuitExerciseProps> = (props) => {
  const [tick, setTick] = createSignal(0)
  const [comboPulse, setComboPulse] = createSignal(false)
  const [scorePops, setScorePops] = createSignal<
    Array<{ id: number; x: number; y: number; text: string; color: string }>
  >([])
  let popId = 0
  const audioEngine = untrack(() => props.audioEngine)

  const practiceEngine = untrack(() => props.practiceEngine)
  const base = useBaseExercise({
    audioEngine,
    practiceEngine,
    config: { type: 'pitch-pursuit' },
  })

  const controller = usePitchPursuitController(base)

  let vizInterval: ReturnType<typeof setInterval> | undefined
  let lastCombo = 0
  let lastPopTotal = 0
  let lastPopHits = 0

  const handleStart = async () => {
    if (!(await base.start())) return
    if (base.state().status !== 'active') return
    lastCombo = 0
    controller.startGame()
    // Clear any prior interval first — a natural game finish leaves it running,
    // so Try Again would otherwise orphan a 30 Hz timer every replay.
    if (vizInterval) clearInterval(vizInterval)
    vizInterval = setInterval(() => setTick((t) => t + 1), 33)
  }

  const handleStop = () => {
    if (vizInterval) clearInterval(vizInterval)
    controller.stopGame()
  }

  onCleanup(() => {
    if (vizInterval) clearInterval(vizInterval)
    base.reset()
  })

  onMount(() => {
    if (props.autoStart === true && base.state().status === 'idle') {
      void handleStart()
    }
  })

  createEffect(() => {
    const r = base.result()
    if (r && r.type === 'pitch-pursuit') {
      // The game can end on its own (all 12 notes played) without going
      // through handleStop, so stop the viz interval here too.
      if (vizInterval) clearInterval(vizInterval)
      untrack(() => {
        recordExerciseResult({
          type: r.type,
          score: r.score,
          metrics: r.metrics,
          completedAt: r.completedAt,
        })
        updateDifficultyFromEma(r.type)
      })
    }
  })

  // Combo pulse effect
  createEffect(() => {
    const combo = base.state().metrics.combo ?? 0
    if (combo > lastCombo && combo >= 3) {
      setComboPulse(true)
      setTimeout(() => setComboPulse(false), 200)
    }
    lastCombo = combo
  })

  const isActive = () => base.state().status === 'active'
  const met = () => base.state().metrics

  const currentNote = () => {
    tick()
    const p = base.currentPitch()
    if (!p || p.freq <= 0) return null
    const midi = 12 * Math.log2(p.freq / 440) + 69
    return { midi, name: midiToNoteName(Math.round(midi)) }
  }

  const notesView = () => {
    tick()
    const now = performance.now()
    return controller.getNotes().map((n) => {
      const elapsed = now - n.spawnedAt
      const progress = elapsed / 5000
      const yPct = Math.min(100, progress * 100)
      const noteClass = n.scored
        ? n.hit
          ? 'pursuit-note-bar-hit'
          : 'pursuit-note-bar-miss'
        : 'pursuit-note-bar-default'
      return {
        id: n.id,
        midi: n.midi,
        yPct,
        noteClass,
        noteName: midiToNoteName(n.midi),
        scored: n.scored,
        hit: n.hit,
      }
    })
  }

  // Detect new hits/misses for score pop
  createEffect(() => {
    const m = met()
    const hits = m.hits ?? 0
    const misses = m.misses ?? 0
    const total = hits + misses
    if (total > 0 && total !== lastPopTotal) {
      const isHit = hits > lastPopHits
      lastPopTotal = total
      lastPopHits = hits
      const id = popId++
      setScorePops((prev) =>
        [
          ...prev,
          {
            id,
            x: 40 + Math.random() * 20,
            y: TARGET_ZONE_FRAC * 100 - 5,
            text: isHit ? '+OK' : 'MISS',
            color: isHit ? '#22c55e' : '#ef4444',
          },
        ].slice(-6),
      )
      setTimeout(() => {
        setScorePops((prev) => prev.filter((p) => p.id !== id))
      }, 700)
    }
  })

  return (
    <ExerciseShell
      type={EXERCISE_PITCH_PURSUIT}
      title="Pitch Pursuit"
      status={() => base.state().status}
      currentScore={() => base.state().currentScore}
      resultScore={() => base.result()?.score ?? null}
      error={() => base.error()}
      onBack={() => props.onBack?.()}
      idlePlaceholder={
        <div class="exercise-idle-placeholder">
          <span class="idle-icon">
            <IconGame size={56} />
          </span>
          <p>Notes fall from above.</p>
          <p>Sing the matching pitch before they reach the target line.</p>
          <span class="idle-hint">12 notes · Hit within ±50 cents</span>
        </div>
      }
      onStart={() => void handleStart()}
      startLabel="Start Game"
      stopLabel="Stop"
      onStop={handleStop}
      activeContent={
        <>
          <ExercisePitchTracker
            pitchHistory={base.pitchHistory}
            isActive={isActive}
          />
          <div class="pursuit-hud">
            <div class="pursuit-hud-stats">
              <span class="pursuit-hud-stat" style="color:#22c55e">
                <IconCheck size={14} /> {met().hits ?? 0}
              </span>
              <span class="pursuit-hud-stat" style="color:#ef4444">
                <IconCross size={14} /> {met().misses ?? 0}
              </span>
            </div>
            <div
              class="pursuit-combo-text"
              classList={{ pulse: comboPulse() }}
              title="Combo — notes hit in a row. A miss resets it to 0; your longest streak adds a bonus to the final score."
            >
              {met().combo ?? 0}x
            </div>
            {/* The note you're currently singing (accent colour = you), so it
                reads as live pitch — the header already owns the mic control,
                so no mic glyph is repeated here. */}
            <div
              class="pursuit-hud-note"
              title="The note you're singing right now"
            >
              {currentNote()?.name ?? '—'}
            </div>
          </div>

          <div class="pursuit-track">
            <div class="pursuit-target-zone" />
            <div
              class="pursuit-target-line"
              style={`top:${TARGET_ZONE_FRAC * 100}%`}
            />

            <For each={notesView()}>
              {(note) => (
                <div
                  class={`pursuit-note-bar ${note.noteClass}`}
                  style={{
                    top: `${note.yPct}%`,
                    opacity: note.scored ? (note.hit ? 0 : 0.3) : 1,
                  }}
                >
                  {note.noteName}
                </div>
              )}
            </For>

            <For each={scorePops()}>
              {(pop) => (
                <div
                  class="pursuit-score-pop"
                  style={{
                    left: `${pop.x}%`,
                    top: `${pop.y}%`,
                    color: pop.color,
                  }}
                >
                  {pop.text}
                </div>
              )}
            </For>
          </div>

          <div style="text-align:center;padding:4px 8px;font-size:0.75rem;color:var(--text-secondary)">
            {met().totalNotes ?? 0} / 12 notes
          </div>
        </>
      }
      resultSummary={
        <>
          Hits: {base.result()?.metrics.hits}/
          {base.result()?.metrics.totalNotes} · Accuracy:{' '}
          {base.result()?.metrics.accuracy}% · Best Combo:{' '}
          {base.result()?.metrics.maxCombo}x
        </>
      }
      onTryAgain={() => {
        base.reset()
        void handleStart()
      }}
      onChangeTarget={() => base.reset()}
      changeTargetLabel="Back"
    />
  )
}

export default PitchPursuitExercise
