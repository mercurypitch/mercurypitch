// Studio timeline lane — one track's header (its instrument, name, arm, Mute and Solo; in a tall lane its lines and mix) and clips, and its volume or pan line while that is open.
import type { Accessor } from 'solid-js'
import { createMemo, For, Show } from 'solid-js'
import { hasStudioAutomation } from '@/lib/studio/model/automation'
import type { StudioAsset, StudioClip, StudioTrack, } from '@/lib/studio/model/types'
import { studioLaneInputBadge } from '../record/lane-input-badge'
import { StudioLaneTake } from '../record/StudioLaneTake'
import type { StudioLineEditor } from './line-editor'
import { createStudioLineActions } from './line-editor'
import { LaneLine } from './line-icons'
import { studioSourcePresentation } from './source-presentation'
import { StudioArmButton, StudioLaneInstrument } from './StudioLaneHeader'
import { StudioLaneLine } from './StudioLaneLine'
import lineStyles from './StudioLaneLine.module.css'
import styles from './StudioTimeline.module.css'
import { StudioTimelineClip } from './StudioTimelineClip'
import { StudioTrackControls, StudioTrackName } from './StudioTrackControls'
import { studioTrackColor, studioTrackHue } from './track-hues'
import type { StudioTimelineProps } from './types'
import type { StudioPointerEditor } from './useStudioPointer'
import type { StudioWaveformResource } from './waveform-resource'

/** What every lane reads from the timeline around it. */
export interface StudioLaneView {
  readonly assets: Accessor<ReadonlyMap<string, StudioAsset>>
  readonly clips: Accessor<ReadonlyMap<string, StudioClip>>
  readonly scale: Accessor<number>
  readonly scroll: Accessor<number>
  readonly contentWidth: Accessor<number>
  readonly timeWidth: Accessor<number>
  readonly anySolo: Accessor<boolean>
  readonly snap: Accessor<boolean>
  readonly pointer: StudioPointerEditor
  readonly resource: Accessor<StudioWaveformResource>
  readonly lines: StudioLineEditor
  /** Tall lanes: each header shows its lines, fader and knob too. */
  readonly tall: Accessor<boolean>
  /** Said in the timeline's status pill. */
  status(message: string): void
}

interface StudioTimelineLaneProps {
  id: string
  index: number
  track: StudioTrack
  /** The lane's clips, in the song's order. */
  clips: readonly StudioClip[]
  timeline: StudioTimelineProps
  view: StudioLaneView
}

export function StudioTimelineLane(props: StudioTimelineLaneProps) {
  const color = createMemo(() =>
    studioTrackColor(studioTrackHue(props.track, props.index)),
  )
  const source = () =>
    studioSourcePresentation(props.view.assets().get(props.clips[0]?.assetId))
  // Clips keyed by id, so an edit to one redraws only that one.
  const clipIds = createMemo(() => props.clips.map((clip) => clip.id), [], {
    equals: (before, after) =>
      before.length === after.length &&
      before.every((clipId, at) => clipId === after[at]),
  })
  const line = () => {
    const open = props.view.lines.view()
    return open?.trackId === props.id ? open.param : null
  }
  const actions = createStudioLineActions({
    track: () => props.track,
    param: () => line() ?? 'volume',
    editor: () => props.view.lines,
    onCommand: (command) => props.timeline.onCommand(command),
  })

  function toggleLines(): void {
    if (line() !== null) {
      props.view.lines.close()
      return
    }
    props.timeline.onSelectClip(null)
    props.timeline.onSelectTrack?.(props.id)
    props.view.lines.open(props.track)
  }

  const touch = () => props.timeline.phone || props.timeline.tablet === true
  const armed = () =>
    (props.timeline.arming?.laneState(props.id) ?? 'idle') === 'idle'
      ? undefined
      : ''
  const laneInput = () => {
    const inputs = props.timeline.laneInputs
    return inputs === undefined
      ? null
      : studioLaneInputBadge(inputs.of(props.id), inputs.studioInputName())
  }

  const armButton = () => (
    <Show when={props.timeline.arming}>
      {(arming) => (
        <StudioArmButton
          trackId={props.id}
          name={props.track.name}
          arming={arming()}
          touch={touch()}
        />
      )}
    </Show>
  )

  /** The toggle in a tall lane's header that opens its volume and pan lines. */
  const linesToggle = () => (
    <button
      type="button"
      class={lineStyles.toggle}
      classList={{ [lineStyles.touchToggle]: touch() }}
      data-tour="studio.lines"
      data-studio-lines-toggle={props.id}
      data-has-lines={hasStudioAutomation(props.track) ? '' : undefined}
      aria-pressed={line() !== null}
      aria-label={`${props.track.name} volume and pan lines`}
      disabled={props.view.lines.held()}
      title={
        props.view.lines.held()
          ? 'Stop the take to draw lines'
          : line() !== null
            ? 'Close the lines'
            : hasStudioAutomation(props.track)
              ? 'Volume and pan lines. This lane follows a line.'
              : 'Draw volume and pan lines'
      }
      onClick={toggleLines}
    >
      <LaneLine />
    </button>
  )

  const silent = () =>
    props.track.mute || (props.view.anySolo() && !props.track.solo)

  /**
   * A phone header is one button: the instrument's glyph and the name, which
   * open the lane's details, where its arm and its lines are. Its arm is in
   * the Mix sheet too, and Record arms the selected lane.
   */
  const phoneIdentity = () => (
    <StudioTrackName
      id={props.id}
      name={props.track.name}
      lead={
        <StudioLaneInstrument
          track={props.track}
          size="bare"
          silent={silent()}
        />
      }
      tour="studio.lines"
      onDetails={props.timeline.onTrackDetails}
    />
  )

  /** The chip, the name and its source, the lane's own input where it has one, and a mark while the lane follows a line its header does not show. */
  const identity = () => (
    <>
      <StudioLaneInstrument
        track={props.track}
        size={touch() ? 32 : 28}
        silent={silent()}
        tour="studio.role"
      />
      <StudioTrackName
        id={props.id}
        name={props.track.name}
        source={source().label}
        tour={props.view.tall() ? undefined : 'studio.lines'}
        onDetails={props.timeline.onTrackDetails}
      />
      <Show when={laneInput()}>
        {(input) => (
          <button
            type="button"
            class={styles.inputChip}
            classList={{ [styles.touchInputChip]: touch() }}
            data-studio-lane-input-chip={props.id}
            aria-label={`${props.track.name} records from ${input().full}`}
            title={`Records from ${input().full}. Press for this lane's input.`}
            onClick={() => props.timeline.onTrackDetails(props.id, 'input')}
          >
            {input().short}
          </button>
        )}
      </Show>
      <Show when={!props.view.tall() && hasStudioAutomation(props.track)}>
        <span
          class={styles.linesMark}
          role="img"
          aria-label="Follows a volume or pan line"
          title="This lane follows a volume or pan line. Its details open them."
        >
          <LaneLine size={12} />
        </span>
      </Show>
    </>
  )

  return (
    <div
      class={styles.lane}
      data-track-id={props.id}
      data-studio-track={props.id}
      data-selected={
        props.timeline.selectedTrackId === props.id ? '' : undefined
      }
      data-silent={silent() ? '' : undefined}
      data-armed={armed()}
      style={{ '--studio-track': color() }}
    >
      <div class={styles.trackHeader}>
        <Show when={!props.timeline.phone} fallback={phoneIdentity()}>
          <StudioTrackControls
            track={props.track}
            writable={props.timeline.writable}
            tablet={props.timeline.tablet === true}
            tall={props.view.tall()}
            soloedOut={props.view.anySolo() && !props.track.solo}
            onCommand={props.timeline.onCommand}
            identity={identity()}
            arm={armButton()}
            lines={linesToggle()}
          />
        </Show>
      </div>
      <div
        class={styles.laneAudio}
        data-studio-lane-audio=""
        onClick={(event) => {
          if (event.target !== event.currentTarget) return
          props.timeline.onSelectClip(null)
          props.timeline.onSelectTrack?.(props.id)
        }}
      >
        <For each={clipIds()}>
          {(clipId) => {
            const clip = () => props.view.clips().get(clipId)!
            return (
              <StudioTimelineClip
                clip={clip()}
                asset={props.view.assets().get(clip().assetId)}
                keyboardPreview={props.timeline.keyboardPreviewClip}
                trackName={props.track.name}
                selected={props.timeline.selectedClipId === clipId}
                writable={props.timeline.writable}
                phone={props.timeline.phone}
                tablet={props.timeline.tablet === true}
                scale={props.view.scale()}
                scroll={props.view.scroll()}
                contentWidth={props.view.contentWidth()}
                color={color()}
                pointer={props.view.pointer}
                resource={props.view.resource()}
                onSelect={() => props.timeline.onSelectClip(clipId)}
                onDetails={() => props.timeline.onClipDetails(clipId)}
              />
            )
          }}
        </For>
        <Show
          when={props.timeline.records?.find(
            (each) => each.trackId === props.id,
          )}
        >
          {(record) => (
            <StudioLaneTake
              {...record()}
              scale={props.view.scale()}
              scroll={props.view.scroll()}
              contentWidth={props.view.contentWidth()}
            />
          )}
        </Show>
        <Show when={line()}>
          {(param) => (
            <StudioLaneLine
              track={props.track}
              param={param()}
              editor={props.view.lines}
              actions={actions}
              clips={props.clips}
              scale={props.view.scale()}
              width={props.view.timeWidth()}
              scroll={props.view.scroll()}
              playheadFrame={props.timeline.playheadFrame}
              snap={props.view.snap()}
              tempoBpm={
                props.timeline.project.ruler === 'bars'
                  ? props.timeline.project.tempoBpm
                  : undefined
              }
              writable={props.timeline.writable}
              touch={props.timeline.phone || props.timeline.tablet === true}
              onStatus={props.view.status}
              onClose={() => {
                props.view.lines.close()
                focusToggle(props.id)
              }}
            />
          )}
        </Show>
      </div>
    </div>
  )
}

/** Back to a lane's lines toggle, once its line closes. */
function focusToggle(trackId: string): void {
  queueMicrotask(() =>
    [...document.querySelectorAll<HTMLElement>('[data-studio-lines-toggle]')]
      .find((element) => element.dataset.studioLinesToggle === trackId)
      ?.focus({ preventScroll: true }),
  )
}
