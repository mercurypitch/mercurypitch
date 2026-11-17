// ============================================================
// EarLabPage — the Ear Lab tab: the Regulator Room around the bench
// and every drill stage. The room (session bar, rack, bridge) lives
// here so opening a drill never leaves it: the bench's bridge steps
// aside for the drill's console and comes back with the bench. The
// 'calibration' view is the Hairline stage opened in its sealed
// protocol (the bench's amber control). The Ear Report is a stage
// of its own inside the same room.
//
// On a phone build with the premium exercises, Merc's Ear rooms open from
// a "With Merc" row over the bench (features/premium-exercises/
// EarMercRow.tsx), loaded lazily behind PREMIUM_EXERCISES so the store
// build carries none of it.
//
// On the web and on a phone test build, the Ear Lab with Merc
// (EAR_LAB_WITH_MERC): the bench is Merc's instead (features/ear-lab/merc/
// MercBench.tsx), with the Ear rooms as its own row, every drill opens in
// Merc's room (stage-switch.tsx), and the Ear Report is drawn in the room's
// light (merc/MercReport.tsx). All are one lazy chunk behind the switch.
// The phone opens the Ear rooms through its shell; the web opens the ones
// it has in the frame its Exercises tab opens them in (features/exercises/
// rooms/WebRoomHost.tsx), over the Ear Lab, and Back comes back to it.
// The room is drawn over the page; on the web the tab bar and the voice
// pill stay on the page, so the page lifts the room over them.
//
// A drill asked for from elsewhere can come with a lesson's set of its
// items (`/exercises/<slug>`, lib/ear/subsets.ts). The page hands the set
// to the drill as it opens it, whichever bench is showing, and opening a
// drill from the bench opens it whole.
// ============================================================

import type { Component, JSX } from 'solid-js'
import { createEffect, createSignal, lazy, onCleanup, Show, Suspense, untrack, } from 'solid-js'
import { Dynamic } from 'solid-js/web'
import { BasslineDrill } from '@/features/ear-lab/BasslineDrill'
import { BeatHuntDrill } from '@/features/ear-lab/BeatHuntDrill'
import { CadenceDrill } from '@/features/ear-lab/CadenceDrill'
import { ChartDrill } from '@/features/ear-lab/ChartDrill'
import { ContourDrill } from '@/features/ear-lab/ContourDrill'
import { resetDeskStore } from '@/features/ear-lab/desk-store'
import { DeskView } from '@/features/ear-lab/DeskView'
import { DriftDrill } from '@/features/ear-lab/DriftDrill'
import { VIEW_FOR_DRILL } from '@/features/ear-lab/drill-views'
import type { EarLabView } from '@/features/ear-lab/EarLabDashboard'
import { EarLabDashboard } from '@/features/ear-lab/EarLabDashboard'
import { EarReport } from '@/features/ear-lab/EarReport'
import { EarRoomShell } from '@/features/ear-lab/EarRoomShell'
import { EchoDrill } from '@/features/ear-lab/EchoDrill'
import { FieldBookView } from '@/features/ear-lab/FieldBookView'
import { GravityDrill } from '@/features/ear-lab/GravityDrill'
import { GridDrill } from '@/features/ear-lab/GridDrill'
import { HairlineDrill } from '@/features/ear-lab/HairlineDrill'
import { HomeDrill } from '@/features/ear-lab/HomeDrill'
import { LeapDrill } from '@/features/ear-lab/LeapDrill'
import { PullDrill } from '@/features/ear-lab/PullDrill'
import { PulseDrill } from '@/features/ear-lab/PulseDrill'
import { SpanDrill } from '@/features/ear-lab/SpanDrill'
import { StackDrill } from '@/features/ear-lab/StackDrill'
import { SubdivideDrill } from '@/features/ear-lab/SubdivideDrill'
import { releaseWildStems } from '@/features/ear-lab/wild-store'
import type { WebRoomId } from '@/features/exercises/rooms/web-room-ids'
import { isWebRoom } from '@/features/exercises/rooms/web-room-ids'
import { TAB_EAR_LAB } from '@/features/tabs/constants'
import type { PremiumExerciseId } from '@/lib/domain/exercise-contracts'
import type { EarSubset } from '@/lib/ear/subsets'
import { resolveEarSubset } from '@/lib/ear/subsets'
import { EAR_LAB_WITH_MERC, IS_NATIVE_BUILD, PREMIUM_EXERCISES, WEB_ROOMS, } from '@/lib/native-build'
import { provideTourDetour } from '@/lib/tour-screen'
import { disarmSprintSegment } from '@/stores/ear-lab-store'
import { nativeShellApi } from '@/stores/native-shell-store'
import { pendingEarDrill, pendingEarItems, setPendingEarDrill, setPendingEarItems, } from '@/stores/ui-store'

interface EarMercRowProps {
  onOpen: (id: PremiumExerciseId) => void
}

interface EarRoomsRowProps extends EarMercRowProps {
  opens?: ((id: PremiumExerciseId) => boolean) | undefined
  free?: boolean | undefined
}

const EarMercRow: Component<EarMercRowProps> = PREMIUM_EXERCISES
  ? lazy(async () =>
      import('@/features/premium-exercises/ear-entry').then((module) => ({
        default: module.EarMercRow,
      })),
    )
  : () => null

/** The Ear rooms as Merc's bench draws them: the same lazy island as the
 *  row above, on a phone build with the premium exercises and on the web,
 *  which opens its own rooms. */
const EarRoomsRow: Component<EarRoomsRowProps> =
  PREMIUM_EXERCISES || WEB_ROOMS
    ? lazy(async () =>
        import('@/features/premium-exercises/ear-entry').then((module) => ({
          default: module.EarRoomsRow,
        })),
      )
    : () => null

/** The web's frame for a room, as its Exercises tab opens one: in the web
 *  build alone, lazy, so a native build carries none of it. */
const WebRoomHost = WEB_ROOMS
  ? lazy(() => import('@/features/exercises/rooms/WebRoomHost'))
  : null

/** Where the room stands on the web: over the tab bar and the voice pill
 *  (`--z-tabbar`), under the sheets the room and the app raise
 *  (`--z-sheet`), as a stage does (src/styles/mobile-kit.css). The native
 *  shell takes its bars away while the room is up, and leaves the room its
 *  own layer (merc/room.module.css). */
const ROOM_LAYER: JSX.CSSProperties | undefined = IS_NATIVE_BUILD
  ? undefined
  : { '--room-layer': 'var(--z-stage, 450)' }

interface MercBenchProps {
  onNavigate: (view: EarLabView) => void
  rooms?: JSX.Element
}

/** The native tab, on a build with the Ear Lab with Merc only. */
const MercBench: Component<MercBenchProps> = EAR_LAB_WITH_MERC
  ? lazy(async () =>
      import('@/features/ear-lab/merc/entry').then((module) => ({
        default: module.MercBench,
      })),
    )
  : () => null

interface MercReportProps {
  onBack: () => void
  onNavigate: (view: EarLabView) => void
}

/** The Ear Report in the room's light, on the same build and chunk. */
const MercReport: Component<MercReportProps> = EAR_LAB_WITH_MERC
  ? lazy(async () =>
      import('@/features/ear-lab/merc/entry').then((module) => ({
        default: module.MercReport,
      })),
    )
  : () => null

/** How the drill on the stage was opened: on a lesson's set of its items,
 *  or whole. A new one at every opening, so a request for the drill already
 *  open mounts it afresh on what was asked. */
interface DrillOpening {
  subset: EarSubset | null
}

/** A view as the tour's question names it: 'the-pull' is "The Pull". */
const viewName = (view: EarLabView): string =>
  view
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')

export function EarLabPage(): JSX.Element {
  const [view, setView] = createSignal<EarLabView>('dashboard')
  const [opening, setOpening] = createSignal<DrillOpening>({ subset: null })
  /** Open a view from the bench, the room or a report: a drill whole. */
  const openView = (next: EarLabView) => {
    setOpening({ subset: null })
    setView(next)
  }
  /** The web's room open over the Ear Lab, if one is. */
  const [webRoom, setWebRoom] = createSignal<WebRoomId | null>(null)
  /** The card that opened it. The bench stays under the room, so the focus
   *  goes back to the card as the room closes, as the Exercises tab hands
   *  it back to its own (rooms/RoomsStrip.tsx). */
  let roomCard: HTMLElement | null = null
  // The web opens its own rooms. A phone build without the premium
  // exercises registers no opener, and the bench draws no way in.
  const mercRooms = (): boolean =>
    WEB_ROOMS ||
    (PREMIUM_EXERCISES && nativeShellApi()?.openExercise !== undefined)
  const openRoom = (id: PremiumExerciseId): void => {
    if (!WEB_ROOMS) {
      nativeShellApi()?.openExercise?.(id)
    } else if (isWebRoom(id)) {
      roomCard =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null
      setWebRoom(id)
    }
  }
  const closeRoom = (): void => {
    setWebRoom(null)
    const card = roomCard
    roomCard = null
    if (card?.isConnected === true) card.focus({ preventScroll: true })
  }
  // Leaving the lab lets the decoded stems go (tens of megabytes a
  // song) along with the desk's rendered source. The books they were
  // read into stay, so coming back does not read the songs again.
  onCleanup(() => {
    disarmSprintSegment()
    releaseWildStems()
    resetDeskStore()
  })
  // Backing out of a drill without starting it forgets what the sprint
  // card armed for it; the arming is only meant for the run that tap opened.
  const back = () => {
    disarmSprintSegment()
    openView('dashboard')
  }
  // A drill or the calibration hides the bench the Ear Lab tour walks, so a
  // tour asks before it goes back there (src/lib/tour-screen.ts).
  onCleanup(
    // eslint-disable-next-line solid/reactivity -- tracked where the tour offer reads it
    provideTourDetour((tab) => {
      const open = view()
      return tab !== TAB_EAR_LAB || open === 'dashboard'
        ? null
        : { name: viewName(open), close: back }
    }),
  )

  // A drill asked for from elsewhere (The Ascent's ear week, a lesson's
  // link). Cleared as it is consumed, so coming back to the tab later
  // lands on the dashboard rather than replaying the same request.
  createEffect(() => {
    const requested = pendingEarDrill()
    if (requested === null) return
    const target = VIEW_FOR_DRILL[requested]
    if (target) {
      setOpening({
        subset: resolveEarSubset(requested, untrack(pendingEarItems)),
      })
      setView(target)
    }
    setPendingEarItems(null)
    setPendingEarDrill(null)
  })

  /** The opening a drill that takes a set mounts with, while it is the
   *  view: a new one remounts it. */
  const openedAs = (drill: EarLabView): DrillOpening | false =>
    view() === drill && opening()

  return (
    <div id="ear-lab-page" style={ROOM_LAYER}>
      <EarRoomShell onNavigate={openView} bridge={view() === 'dashboard'}>
        <Show when={view() === 'dashboard'}>
          {EAR_LAB_WITH_MERC ? (
            <MercBench
              onNavigate={openView}
              rooms={
                mercRooms() ? (
                  <EarRoomsRow
                    onOpen={openRoom}
                    opens={WEB_ROOMS ? isWebRoom : undefined}
                    free={WEB_ROOMS}
                  />
                ) : undefined
              }
            />
          ) : (
            <EarLabDashboard
              onNavigate={openView}
              withMerc={
                mercRooms() ? (
                  <EarMercRow
                    onOpen={(id) => nativeShellApi()?.openExercise?.(id)}
                  />
                ) : undefined
              }
            />
          )}
        </Show>
        <Show when={view() === 'hairline'}>
          <HairlineDrill onBack={back} />
        </Show>
        <Show when={view() === 'calibration'}>
          <HairlineDrill onBack={back} ritual />
        </Show>
        <Show when={view() === 'home'}>
          <HomeDrill onBack={back} />
        </Show>
        <Show when={view() === 'grid'}>
          <GridDrill onBack={back} />
        </Show>
        <Show when={openedAs('leap')} keyed>
          {(opened) => <LeapDrill onBack={back} subset={opened.subset} />}
        </Show>
        <Show when={openedAs('stack')} keyed>
          {(opened) => <StackDrill onBack={back} subset={opened.subset} />}
        </Show>
        <Show when={view() === 'contour'}>
          <ContourDrill onBack={back} />
        </Show>
        <Show when={view() === 'pulse'}>
          <PulseDrill onBack={back} />
        </Show>
        <Show when={openedAs('chart')} keyed>
          {(opened) => <ChartDrill onBack={back} subset={opened.subset} />}
        </Show>
        <Show when={view() === 'echo'}>
          <EchoDrill onBack={back} />
        </Show>
        <Show when={view() === 'span'}>
          <SpanDrill onBack={back} />
        </Show>
        <Show when={view() === 'beat-hunt'}>
          <BeatHuntDrill onBack={back} />
        </Show>
        <Show when={view() === 'drift'}>
          <DriftDrill onBack={back} />
        </Show>
        <Show when={openedAs('gravity')} keyed>
          {(opened) => <GravityDrill onBack={back} subset={opened.subset} />}
        </Show>
        <Show when={view() === 'the-pull'}>
          <PullDrill onBack={back} />
        </Show>
        <Show when={view() === 'cadence'}>
          <CadenceDrill onBack={back} />
        </Show>
        <Show when={view() === 'bassline'}>
          <BasslineDrill onBack={back} />
        </Show>
        <Show when={openedAs('subdivide')} keyed>
          {(opened) => <SubdivideDrill onBack={back} subset={opened.subset} />}
        </Show>
        <Show when={view() === 'desk'}>
          <DeskView onBack={back} />
        </Show>
        <Show when={view() === 'field-book'}>
          <FieldBookView onBack={back} />
        </Show>
        <Show when={view() === 'report'}>
          {EAR_LAB_WITH_MERC ? (
            <MercReport onBack={back} onNavigate={openView} />
          ) : (
            <EarReport onBack={back} />
          )}
        </Show>
      </EarRoomShell>
      <Show when={WebRoomHost}>
        {(Host) => (
          <Show when={webRoom()}>
            {(id) => (
              <Suspense>
                <Dynamic component={Host()} id={id()} onBack={closeRoom} />
              </Suspense>
            )}
          </Show>
        )}
      </Show>
    </div>
  )
}
