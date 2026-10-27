// ============================================================
// Studio mixing desk — a drawer under the arrangement: a strip per lane, then the song's master
// ============================================================
//
// The desk owns no mix state. Each strip is the lane header's own
// StudioTrackControls in its strip layout, so a fader, knob, Mute or Solo
// sends the same `update-track` command and glides into a playing song the
// same way. The master side is the Sound panel's: the same flavour buttons,
// the same macro drafts drawn as dials, and the transport's output meter.
// The engine meters only the master, so the strips carry no level meters.
import { createEffect, createMemo, createSignal, createUniqueId, For, on, onCleanup, onMount, Show, } from 'solid-js'
import { X } from '@/components/icons'
import type { StudioMeterSnapshot } from '@/lib/studio/metering/stream-meter'
import type { StudioCommand } from '@/lib/studio/model/commands'
import type { StudioProject } from '@/lib/studio/model/types'
import { MACRO_KEYS } from '@/lib/studio-fx/mix-macros'
import { StudioOutputMeter } from '../audio/StudioOutputMeter'
import { StudioFlavourChoices, studioSoundAdjusted, } from '../sound/StudioFlavourChoices'
import { StudioMacroDial } from '../sound/StudioMacroDial'
import common from '../StudioPage.module.css'
import { StudioTrackControls } from '../timeline/StudioTrackControls'
import { studioTrackColor, studioTrackHue } from '../timeline/track-hues'
import styles from './StudioMixDesk.module.css'

/** What the desk reads from the transport: the master output meter. */
export interface StudioMixMeterSource {
  meter(): StudioMeterSnapshot | null
  meterReady(): boolean
  peakL(): number
  peakR(): number
  resetPeakHold(): void
}

interface StudioMixDeskProps {
  project: StudioProject
  writable: boolean
  /** Finger-sized strips and dials. */
  tablet?: boolean
  meter: StudioMixMeterSource
  onCommand(command: StudioCommand): boolean
  onClose(): void
}

export function StudioMixDesk(props: StudioMixDeskProps) {
  let desk: HTMLElement | undefined
  let strips: HTMLDivElement | undefined
  const flavourLabel = createUniqueId()
  const adjustLabel = createUniqueId()
  // Rows follow lane ids, so a commit mid-gesture never rebuilds a strip.
  const trackIds = createMemo(() =>
    [...props.project.tracks]
      .sort((a, b) => a.order - b.order)
      .map((track) => track.id),
  )
  const anySolo = () => props.project.tracks.some((track) => track.solo)
  // Which edges of the strip row hide more strips, so a fade can say so.
  const [more, setMore] = createSignal({ before: false, after: false })

  function measure(): void {
    if (!strips) return
    const { scrollLeft, scrollWidth, clientWidth } = strips
    const before = scrollLeft > 1
    const after = scrollLeft + clientWidth < scrollWidth - 1
    const last = more()
    if (last.before !== before || last.after !== after)
      setMore({ before, after })
  }
  createEffect(on(trackIds, () => queueMicrotask(measure)))

  onMount(() => {
    const resize =
      typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure)
    if (strips) resize?.observe(strips)
    onCleanup(() => resize?.disconnect())
    const opener = document.activeElement
    queueMicrotask(() => {
      if (desk?.isConnected === true) desk.focus({ preventScroll: true })
    })
    onCleanup(() => {
      if (
        opener instanceof HTMLElement &&
        opener.isConnected &&
        desk?.contains(document.activeElement) === true
      )
        opener.focus({ preventScroll: true })
    })
  })

  // Delegated, not native: a strip control cancelling its own edit on Escape
  // is lower in the tree, so it answers first and keeps the desk open.
  function keyDown(event: KeyboardEvent): void {
    if (event.key !== 'Escape' || event.defaultPrevented) return
    event.preventDefault()
    event.stopPropagation()
    props.onClose()
  }

  return (
    <section
      ref={desk}
      class={styles.desk}
      classList={{ [styles.touch]: props.tablet === true }}
      aria-label="Mix"
      tabindex="-1"
      data-studio-panel
      data-studio-mix-desk
      onKeyDown={keyDown}
    >
      <div class={styles.heading}>
        <h2>Mix</h2>
        <button
          type="button"
          class={common.iconButton}
          aria-label="Close Mix"
          title="Close Mix (Esc)"
          onClick={() => props.onClose()}
        >
          <X />
        </button>
      </div>
      <div class={styles.body}>
        <div
          ref={strips}
          class={styles.strips}
          role="group"
          aria-label="Lanes"
          data-more-before={more().before ? '' : undefined}
          data-more-after={more().after ? '' : undefined}
          onScroll={measure}
        >
          <For
            each={trackIds()}
            fallback={
              <p class={styles.empty}>Add a take to give it a channel here.</p>
            }
          >
            {(id, index) => {
              const track = () =>
                props.project.tracks.find((item) => item.id === id)!
              return (
                <div
                  class={styles.strip}
                  data-studio-mix-strip={id}
                  data-silent={
                    track().mute || (anySolo() && !track().solo)
                      ? ''
                      : undefined
                  }
                  style={{
                    '--studio-track': studioTrackColor(
                      studioTrackHue(track(), index()),
                    ),
                  }}
                >
                  <StudioTrackControls
                    strip
                    track={track()}
                    writable={props.writable}
                    tablet={props.tablet === true}
                    onCommand={props.onCommand}
                    identity={
                      <span class={styles.stripName} title={track().name}>
                        {track().name}
                      </span>
                    }
                  />
                </div>
              )
            }}
          </For>
        </div>
        <div
          class={styles.master}
          role="group"
          aria-label="Master"
          data-studio-mix-master
        >
          <div class={styles.masterControls}>
            <div class={styles.masterHeading}>
              <h3>Master</h3>
              <Show when={studioSoundAdjusted(props.project)}>
                <span class={styles.adjusted}>Adjusted</span>
              </Show>
              <button
                type="button"
                class={common.textButton}
                disabled={!props.writable}
                onClick={() =>
                  props.onCommand({
                    type: 'set-sound-flavour',
                    flavourId: 'natural',
                  })
                }
              >
                Reset sound
              </button>
            </div>
            <div class={styles.group}>
              <span class={styles.groupLabel} id={flavourLabel}>
                Flavour
              </span>
              <div
                class={styles.flavours}
                role="group"
                aria-labelledby={flavourLabel}
              >
                <StudioFlavourChoices
                  project={props.project}
                  enabled={props.writable}
                  onCommand={props.onCommand}
                />
              </div>
            </div>
            <div class={styles.group}>
              <span class={styles.groupLabel} id={adjustLabel}>
                Adjust
              </span>
              <div
                class={styles.dials}
                role="group"
                aria-labelledby={adjustLabel}
              >
                <For each={MACRO_KEYS}>
                  {(name) => (
                    <StudioMacroDial
                      name={name}
                      project={props.project}
                      writable={props.writable}
                      onCommand={props.onCommand}
                    />
                  )}
                </For>
              </div>
            </div>
          </div>
          <div class={styles.meter}>
            <StudioOutputMeter
              vertical
              snapshot={props.meter.meter()}
              ready={props.meter.meterReady()}
              peakL={props.meter.peakL()}
              peakR={props.meter.peakR()}
              onReset={() => props.meter.resetPeakHold()}
            />
          </div>
        </div>
      </div>
    </section>
  )
}
