// Studio clip passes — a loop take's passes in Clip details: one played whole, or the best stretch of each picked under the lane.
import { Index, Show } from 'solid-js'
import styles from '@/features/studio/StudioPage.module.css'
import { studioClipPass } from '@/lib/studio/model/clip-passes'
import type { StudioCommand } from '@/lib/studio/model/commands'
import type { StudioClip } from '@/lib/studio/model/types'
import { CompPasses } from '../studio-icons'
import { STUDIO_COMP_HELD_TITLE, studioCompClipId, studioCompHeld, toggleStudioComp, } from '../timeline/comp-editor'
import { studioCompRows } from '../timeline/comp-rows'
import local from './StudioCompPanels.module.css'

interface StudioClipPassesProps {
  clip: StudioClip
  writable: boolean
  onCommand(command: StudioCommand): boolean
}

export function StudioClipPasses(props: StudioClipPassesProps) {
  // The pass the clip plays whole; none while a comp plays several.
  const whole = () =>
    props.clip.comp ? null : (studioClipPass(props.clip)?.number ?? null)
  const open = () => studioCompClipId() === props.clip.id
  const count = () => props.clip.passes?.count ?? 0
  return (
    <Show when={props.clip.passes}>
      <div class={styles.fieldDivider} />
      <h3>Passes</h3>
      <ul class={styles.assetList}>
        <Index each={studioCompRows(props.clip)}>
          {(row) => (
            <li class={local.pass}>
              <strong>
                Pass {row().number}
                <Show when={row().number === count()}>
                  <span> newest</span>
                </Show>
              </strong>
              <Show
                when={whole() !== row().number}
                fallback={<span>Plays whole</span>}
              >
                <button
                  type="button"
                  class={styles.textButton}
                  disabled={!props.writable}
                  onClick={() =>
                    props.onCommand({
                      type: 'choose-pass',
                      clipId: props.clip.id,
                      pass: row().pass,
                    })
                  }
                >
                  Use whole pass
                </button>
              </Show>
            </li>
          )}
        </Index>
      </ul>
      <button
        type="button"
        class={styles.button}
        data-studio-comp-toggle=""
        aria-pressed={open()}
        disabled={!props.writable || studioCompHeld()}
        title={studioCompHeld() ? STUDIO_COMP_HELD_TITLE : undefined}
        onClick={() => toggleStudioComp(props.clip.id)}
      >
        <CompPasses size={16} />
        {open() ? 'Close the passes' : 'Comp the passes'}
      </button>
      <p class={styles.help}>
        {props.clip.comp
          ? 'This clip plays a comp: a stretch of one pass, then another. Use whole pass plays one from start to end instead.'
          : 'Comp stands the passes under the lane, so you can keep the best stretch of each.'}
      </p>
    </Show>
  )
}
