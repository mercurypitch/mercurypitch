// Runner preview stage — route accepted and crystal study entries through the same native adventure host.

import { Match, Switch } from 'solid-js'
import { AdventureScreen } from '@/games/adventure/AdventureScreen'
import type { PlayPick } from './game-selection'

interface RunnerPreviewStageProps {
  selected: PlayPick
  onExit(): void
}

export function RunnerPreviewStage(props: RunnerPreviewStageProps) {
  return (
    <Switch>
      <Match when={props.selected === 'singing-current'}>
        <AdventureScreen runner onExit={props.onExit} />
      </Match>
      <Match when={props.selected === 'crystal-current'}>
        <AdventureScreen
          runner
          runnerSteering="continuous"
          runnerCamera="angled"
          runnerObstacles="crystal-study"
          onExit={props.onExit}
        />
      </Match>
      <Match when={props.selected === 'slide-current'}>
        <AdventureScreen
          runner
          runnerSteering="continuous"
          runnerCamera="angled"
          runnerObstacles="slide-study"
          onExit={props.onExit}
        />
      </Match>
    </Switch>
  )
}
