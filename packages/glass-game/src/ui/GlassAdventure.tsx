// Glass adventure — choose a saved, fresh or completed visit before loading its 3D gallery.
import { createMemo, createSignal, Show } from 'solid-js'
import { GLASSWORKS } from '../content/glassworks'
import type { LevelDefinition } from '../contracts'
import { readProgress } from '../core/progress'
import type { GlassGameHost } from '../host'
import { AdventureVisit } from './AdventureVisit'
import { CompletedVisitDecision } from './CompletedVisitDecision'
import { createFreshVisitHost } from './fresh-visit-host'

export interface GlassAdventureProps {
  host: GlassGameHost
  level?: LevelDefinition
  onContinue?(): void
  continueLabel?: string
  freshStart?: boolean
  onRestart?(): void
  replayGoal?: { title: string; tier: 1 | 2 | 3 }
}

type VisitSelection = {
  levelId: string
  mode: 'completed' | 'fresh' | 'saved'
  visit: number
}

export function GlassAdventure(props: GlassAdventureProps) {
  const [selectedVisit, setSelectedVisit] = createSignal<VisitSelection>()
  let nextVisit = 1
  const selection = createMemo<VisitSelection>(() => {
    const level = props.level ?? GLASSWORKS
    const selected = selectedVisit()
    if (selected?.levelId === level.id) return selected
    if (props.freshStart === true)
      return { levelId: level.id, mode: 'fresh', visit: 0 }
    const progress = readProgress(level, props.host.loadProgress(level.id))
    return {
      levelId: level.id,
      mode: progress.finished === true ? 'completed' : 'saved',
      visit: 0,
    }
  })
  const session = createMemo(() => {
    const level = props.level ?? GLASSWORKS
    const selected = selection()
    if (selected.mode === 'completed') return undefined
    return {
      visit: selected.visit,
      level,
      host:
        selected.mode === 'fresh'
          ? createFreshVisitHost(props.host, level)
          : props.host,
    }
  })
  const restart = (): void => {
    if (props.onRestart !== undefined) {
      props.onRestart()
      return
    }
    const level = props.level ?? GLASSWORKS
    setSelectedVisit({
      levelId: level.id,
      mode: 'fresh',
      visit: nextVisit++,
    })
  }
  const review = (): void => {
    const level = props.level ?? GLASSWORKS
    setSelectedVisit({
      levelId: level.id,
      mode: 'saved',
      visit: nextVisit++,
    })
  }
  return (
    <Show
      when={session()}
      keyed
      fallback={
        <CompletedVisitDecision
          levelId={(props.level ?? GLASSWORKS).id}
          levelTitle={(props.level ?? GLASSWORKS).title}
          onRestart={restart}
          onReview={review}
          onExit={() => props.host.onExit()}
          onContinue={props.onContinue}
          continueLabel={props.continueLabel}
        />
      }
    >
      {(current) => (
        <AdventureVisit
          host={current.host}
          level={current.level}
          onRestart={restart}
          onContinue={props.onContinue}
          continueLabel={props.continueLabel}
          replayGoal={props.replayGoal}
        />
      )}
    </Show>
  )
}
