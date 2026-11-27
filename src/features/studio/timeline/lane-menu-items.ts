// ============================================================
// Studio lane menu items — what a right-click offers on a lane's header and on empty lane space
// ============================================================
//
// REAPER opens the track's menu on a track panel and the arrange view's on
// empty space; the Studio does the same with what its lanes already do, and
// nothing new. On a header: Hear yourself, the lane's arm, Mute and Solo,
// its lines, its details and Remove track. On empty space: an empty clip
// where a MIDI lane takes one, Add takes, New lane's three choices and the
// zoom. Each item names the key that does the same where there is one.
//
// Hear yourself is one switch for the whole Studio (record-settings.ts
// `monitor`, "Monitor through headphones" in Sound): every armed lane is
// heard through it. The item says so, so a singer does not take it for this
// lane's alone.
import type { StudioCommand } from '@/lib/studio/model/commands'
import type { StudioTrack } from '@/lib/studio/model/types'
import type { StudioMenuItem } from '../menu/StudioContextMenu'
import type { StudioHearYourself, StudioNewLaneKind, StudioRecordSettingsSource, } from './types'
import { STUDIO_ZOOM_KEYS } from './zoom-keys'

/** The label Hear yourself goes by in the lane menu and the lane's details: one switch for every lane. */
export const STUDIO_HEAR_YOURSELF_LABEL = 'Hear yourself on every lane'

/** The recorder's monitoring switch, as Sound's "Monitor through headphones" holds it, for a lane's menu and details. */
export function studioHearYourself(
  recorder: StudioRecordSettingsSource,
): StudioHearYourself {
  return {
    on: () => recorder.settings().monitor,
    set: (on) => recorder.setSettings({ ...recorder.settings(), monitor: on }),
  }
}

export interface StudioLaneMenuContext {
  readonly track: Pick<StudioTrack, 'id' | 'name' | 'mute' | 'solo'>
  readonly writable: boolean
  readonly hearYourself?: StudioHearYourself
  /** The lane's arm, where the Studio records. */
  readonly arm?: {
    readonly armed: boolean
    /** A press would do something: it disarms an armed lane, or arms one while arming is open. */
    readonly enabled: boolean
    toggle(): void
  }
  readonly lines: {
    readonly open: boolean
    /** A take is running: lines wait for it. */
    readonly held: boolean
    toggle(): void
  }
  onCommand(command: StudioCommand): boolean
  /** Remove the lane, undoably, leaving the focus where Ctrl+Z reaches. */
  onRemove(): void
  onDetails(): void
}

/** A right-click on lane `track`'s header: its menu. */
export function studioLaneMenuItems(
  context: StudioLaneMenuContext,
): StudioMenuItem[] {
  const { track } = context
  const update = (changes: Partial<Pick<StudioTrack, 'mute' | 'solo'>>) => {
    if (context.writable)
      context.onCommand({ type: 'update-track', trackId: track.id, changes })
  }
  const items: StudioMenuItem[] = []
  const hear = context.hearYourself
  if (hear !== undefined)
    items.push({
      key: 'hear-yourself',
      label: STUDIO_HEAR_YOURSELF_LABEL,
      note: 'Wear headphones, or the mic hears the speakers.',
      checked: hear.on(),
      select: () => hear.set(!hear.on()),
    })
  const arm = context.arm
  if (arm !== undefined)
    items.push({
      key: 'arm',
      label: 'Arm for recording',
      checked: arm.armed,
      disabled: !arm.enabled,
      select: () => arm.toggle(),
    })
  items.push(
    {
      key: 'mute',
      label: 'Mute',
      shortcut: 'M',
      checked: track.mute,
      disabled: !context.writable,
      separatorBefore: true,
      select: () => update({ mute: !track.mute }),
    },
    {
      key: 'solo',
      label: 'Solo',
      shortcut: 'S',
      checked: track.solo,
      disabled: !context.writable,
      select: () => update({ solo: !track.solo }),
    },
    {
      key: 'lines',
      label: 'Volume and pan lines',
      checked: context.lines.open,
      disabled: context.lines.held,
      select: () => context.lines.toggle(),
    },
    {
      key: 'details',
      label: 'Track details',
      separatorBefore: true,
      select: () => context.onDetails(),
    },
    {
      key: 'remove',
      label: 'Remove track',
      note: 'You can undo this.',
      danger: true,
      disabled: !context.writable,
      separatorBefore: true,
      select: () => {
        if (context.writable) context.onRemove()
      },
    },
  )
  return items
}

export interface StudioSpaceMenuContext {
  /** An empty clip where the press was, on a lane that plays MIDI; absent elsewhere. */
  readonly newClip?: () => void
  readonly onAddTakes?: () => void
  readonly onNewLane?: (kind: StudioNewLaneKind) => void
  readonly zoom: {
    canStep(direction: 1 | -1): boolean
    step(direction: 1 | -1): void
    fit(): void
    /** The song has nothing to fit. */
    readonly empty: boolean
  }
}

const NEW_LANES: readonly { kind: StudioNewLaneKind; label: string }[] = [
  { kind: 'audio', label: 'New audio lane' },
  { kind: 'piano', label: 'New piano lane' },
  { kind: 'drums', label: 'New drums lane' },
]

/** A right-click on empty lane space: the Studio's menu. */
export function studioSpaceMenuItems(
  context: StudioSpaceMenuContext,
): StudioMenuItem[] {
  const items: StudioMenuItem[] = []
  const { newClip, onAddTakes, onNewLane, zoom } = context
  if (newClip !== undefined)
    items.push({ key: 'new-clip', label: 'New clip here', select: newClip })
  if (onAddTakes !== undefined)
    items.push({ key: 'add-takes', label: 'Add takes', select: onAddTakes })
  if (onNewLane !== undefined)
    for (const [at, lane] of NEW_LANES.entries())
      items.push({
        key: `new-${lane.kind}-lane`,
        label: lane.label,
        separatorBefore: at === 0,
        select: () => onNewLane(lane.kind),
      })
  items.push(
    {
      key: 'zoom-in',
      label: 'Zoom in',
      shortcut: STUDIO_ZOOM_KEYS.in,
      disabled: !zoom.canStep(1),
      separatorBefore: true,
      select: () => zoom.step(1),
    },
    {
      key: 'zoom-out',
      label: 'Zoom out',
      shortcut: STUDIO_ZOOM_KEYS.out,
      disabled: !zoom.canStep(-1),
      select: () => zoom.step(-1),
    },
    {
      key: 'zoom-fit',
      label: 'Fit the whole song',
      shortcut: STUDIO_ZOOM_KEYS.fit,
      disabled: zoom.empty,
      select: () => zoom.fit(),
    },
  )
  return items
}
