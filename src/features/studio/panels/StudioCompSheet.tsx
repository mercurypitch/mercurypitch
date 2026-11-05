// Studio comp sheet — a lane's loop takes in its details, each pass a row of the song's bars: tap one to use that pass there.
//
// A phone has no room for rows under its lanes (StudioCompLanes.tsx), so its
// lane sheet stacks the passes instead, newest on top, every bar a cell big
// enough for a thumb and lit where its pass plays. A tap is one edit and
// one undo. The cells scroll sideways under the pass names; they stay put
// through an edit, so the next bar is where the thumb left it.
import type { Accessor } from 'solid-js'
import { createMemo, For, Index, Show } from 'solid-js'
import styles from '@/features/studio/StudioPage.module.css'
import type { StudioCommand } from '@/lib/studio/model/commands'
import type { StudioAsset, StudioClip } from '@/lib/studio/model/types'
import { studioTakeRunning } from '../record/take-running'
import { STUDIO_COMP_HELD_TITLE } from '../timeline/comp-editor'
import { studioCompBars, studioCompRows } from '../timeline/comp-rows'
import local from './StudioCompPanels.module.css'

interface StudioCompSheetProps {
  trackId: string
  clips: readonly StudioClip[]
  assets: readonly StudioAsset[]
  tempoBpm: number
  writable: boolean
  onCommand(command: StudioCommand): boolean
}

export function StudioCompSheet(props: StudioCompSheetProps) {
  const takes = createMemo(() =>
    props.clips.filter(
      (clip) => clip.trackId === props.trackId && clip.passes !== undefined,
    ),
  )
  return (
    <Show when={takes().length > 0}>
      <div class={styles.fieldDivider} />
      <h3>Comp</h3>
      <p class={styles.help}>
        {studioTakeRunning()
          ? `${STUDIO_COMP_HELD_TITLE}.`
          : 'Tap a bar on a pass to use that pass there. Undo takes a tap back.'}
      </p>
      {/* By place, not by clip: an edit makes a new clip, and the cells keep their scroll. */}
      <Index each={takes()}>
        {(clip) => (
          <CompBars
            clip={clip}
            name={
              props.assets.find((asset) => asset.id === clip().assetId)
                ?.originalName ?? 'Loop take'
            }
            tempoBpm={props.tempoBpm}
            writable={props.writable && !studioTakeRunning()}
            onCommand={props.onCommand}
          />
        )}
      </Index>
    </Show>
  )
}

function CompBars(props: {
  clip: Accessor<StudioClip>
  name: string
  tempoBpm: number
  writable: boolean
  onCommand(command: StudioCommand): boolean
}) {
  const bars = createMemo(() => studioCompBars(props.clip(), props.tempoBpm))
  const rows = createMemo(() => studioCompRows(props.clip()), [], {
    equals: (before, after) => before.length === after.length,
  })
  return (
    <div class={local.sheet} role="group" aria-label={`Comp of ${props.name}`}>
      <p class={local.take}>{props.name}</p>
      <div class={local.bars}>
        <For each={rows()}>
          {(row) => (
            <div
              class={local.barRow}
              role="group"
              aria-label={`Pass ${row.number}`}
              data-studio-comp-sheet-pass={row.pass}
            >
              <span class={local.barName}>
                Pass {row.number}
                <Show when={row.number === rows().length}>
                  <small>newest</small>
                </Show>
              </span>
              <Index each={bars()}>
                {(bar) => (
                  <button
                    type="button"
                    class={local.cell}
                    aria-label={`Bar ${bar().bar}`}
                    aria-pressed={bar().pass === row.pass}
                    disabled={!props.writable}
                    onClick={() =>
                      props.onCommand({
                        type: 'comp-pass',
                        clipId: props.clip().id,
                        fromSourceFrame: bar().from,
                        toSourceFrame: bar().to,
                        pass: row.pass,
                      })
                    }
                  >
                    {bar().bar}
                  </button>
                )}
              </Index>
            </div>
          )}
        </For>
      </div>
    </div>
  )
}
