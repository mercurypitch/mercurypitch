// ── JamPanel ────────────────────────────────────────────────────────
// Main jam session UI — tabless layout with collapsible sidebar.

import type { Component } from 'solid-js'
import { createEffect, createMemo, createSignal, For, on, onCleanup, onMount, Show, } from 'solid-js'
import { MicInsightHint } from '@/components/MicInsightHint'
import { Sheet } from '@/components/mobile/Sheet'
import { PremiumBackgroundPicker } from '@/features/backgrounds/PremiumBackgroundPicker'
import { useMicInsights } from '@/features/mic-feedback/useMicInsights'
import { useBackgroundSurfaceController } from '@/lib/backgrounds/background-surface'
import { jamModeInfo } from '@/lib/jam/jam-modes'
import type { HostedRoom } from '@/lib/jam/jam-rooms'
import { forgetHostedRoom, hostedRooms } from '@/lib/jam/jam-rooms'
import { buildPeerColorMap } from '@/lib/jam/peer-colors'
import { jamSignalingIsMocked } from '@/lib/jam/signaling'
import { isCompleteRoomCode, normalizeRoomCode, ROOM_CODE_LENGTH, } from '@/lib/room-code'
import { isMobile, isNarrow } from '@/lib/use-viewport'
import { clearJamPickerError, jamPickerAcceptedPicks, } from '@/stores/jam-picker-store'
import { createJamRoom, getJamSessionInfo, jamBackgroundChanging, jamBackgroundError, jamConnectedPeers, jamError, jamExerciseMelody, jamExercisePlaying, jamGetInputLevel, jamGuideVolume, jamIsHost, jamIsMuted, jamIsSongRoom, jamLocalPitch, jamMyRole, jamOwnRunScore, jamPeerId, jamPeers, jamRoomAlpha, jamRoomId, jamRoomToJoin, jamSelectedBackgroundId, jamShowPitch, jamSong, jamState, jamVideoEnabled, joinJamRoom, leaveJamRoom, selectJamExercise, selectJamRoomBackground, setJamGuideVolume, setJamRoomAlpha, setJamRoomToJoin, setJamShowPitch, startJamPitchDetection, toggleJamMute, toggleJamVideo, } from '@/stores/jam-store'
import { getMelodyLibrarySignal } from '@/stores/melody-store'
import { VOCAL_RANGES, vocalRangePreset } from '@/stores/settings-store'
import { setSidebarCollapsed as setAppSidebarCollapsed, setSidebarOpen as setAppSidebarOpen, sidebarCollapsed as appSidebarCollapsed, sidebarOpen as appSidebarOpen, } from '@/stores/ui-store'
import jamStyles from './Jam.module.css'
import { JamActivityHeatmap } from './JamActivityHeatmap'
import { JamCameraWidget } from './JamCameraWidget'
import { JamChatWidget } from './JamChatWidget'
import { JamControlBar } from './JamControlBar'
import { JamExerciseCanvas } from './JamExerciseCanvas'
import exerciseCanvasStyles from './JamExerciseCanvas.module.css'
import { JamGuideVocal } from './JamGuideVocal'
import { JamInviteModal } from './JamInviteModal'
import { JamNowSinging } from './JamNowSinging'
import panelStyles from './JamPanel.module.css'
import { JamPickerList } from './JamPickerList'
import { JamRoomCode } from './JamRoomCode'
import { JamSharedPitchCanvas } from './JamSharedPitchCanvas'
import pitchCanvasStyles from './JamSharedPitchCanvas.module.css'
import { JamSongShare } from './JamSongShare'
import { JamSongStage } from './JamSongStage'
import { JamSongTimeline } from './JamSongTimeline'
import { JamTransferChip } from './JamTransferDialog'

/**
 * Is this a screen whose room menu carries the "show the cameras" switch?
 *
 * Kept word for word with the phone block of JamPanel.module.css, which is
 * what shows that switch. The two disagreeing is how a tablet lost its
 * camera tray: hidden by one rule, with the way back hidden by the other.
 */
const CAMERA_SWITCH_QUERY = '(max-width: 640px)'
const cameraSwitchIsShown = (): boolean =>
  typeof window.matchMedia === 'function' &&
  window.matchMedia(CAMERA_SWITCH_QUERY).matches

export const JamPanel: Component = () => {
  const roomBackgroundPicker = useBackgroundSurfaceController('jam')
  const [displayName, setDisplayName] = createSignal('')
  const [joinRoomId, setJoinRoomId] = createSignal('')
  const [showInvite, setShowInvite] = createSignal(false)
  const [joining, setJoining] = createSignal(false)
  const [showExercisePicker, setShowExercisePicker] = createSignal(false)

  /**
   * Close the picker when the click lands anywhere else.
   *
   * Having to go back and hit the same button again is the kind of thing
   * that is only obvious once you are holding a phone: the picker covers
   * the room, and the instinct is to tap the room to dismiss it.
   *
   * Listens on pointerdown rather than click so a press that starts
   * outside dismisses immediately, and in the CAPTURE phase so a click on
   * some other control both closes this and does its own job. The toggle
   * button is excluded, or it would close here and reopen on its own
   * handler in the same gesture.
   */
  let pickerRef: HTMLDivElement | undefined

  onMount(() => {
    const onDown = (e: PointerEvent) => {
      if (!showExercisePicker()) return
      // On a phone the picker is a Sheet, which owns its own backdrop tap
      // and drag-to-dismiss. Left running, this would see a tap INSIDE the
      // sheet as outside the (unrendered) popover and close it instantly.
      if (isNarrow()) return
      const t = e.target as Node | null
      if (t === null) return
      if (pickerRef?.contains(t) === true) return
      // The toggle marks itself (JamTransport); letting this run on
      // it would close the picker here and reopen it on the button's own
      // click, so one tap would appear to do nothing.
      if (
        t instanceof Element &&
        t.closest('[data-jam-picker-toggle]') !== null
      ) {
        return
      }
      setShowExercisePicker(false)
    }
    document.addEventListener('pointerdown', onDown, true)
    onCleanup(() => document.removeEventListener('pointerdown', onDown, true))
  })
  const [showAbout, setShowAbout] = createSignal(false)
  const [roomMenuOpen, setRoomMenuOpen] = createSignal(false)
  let roomActionsRef: HTMLDivElement | undefined
  let aboutRef: HTMLDivElement | undefined

  // Tap-outside and Escape close the "?" panel. A tap has no hover to fall
  // back on, so without this the only way to dismiss it on a tablet is to
  // find the small button again -- and the synthetic hover a tap leaves
  // behind made it look like the panel was closing on a timer.
  onMount(() => {
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node
      if (showAbout() && aboutRef?.contains(target) !== true) {
        setShowAbout(false)
      }
      if (roomMenuOpen() && roomActionsRef?.contains(target) !== true) {
        setRoomMenuOpen(false)
      }
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setShowAbout(false)
      setRoomMenuOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    onCleanup(() => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    })
  })
  // Whether the roster rail is showing right now — the mobile drawer and
  // the desktop collapse are different mechanisms, so "showing" is
  // whichever one this viewport actually uses.
  const rosterShowing = (): boolean =>
    isMobile() ? appSidebarOpen() : !appSidebarCollapsed()
  // Read once, not tracked: this is the starting position of a switch the
  // user then owns. Reacting to it would snatch the tray back the moment a
  // window crossed the breakpoint, undoing a choice they had just made.
  //
  // The SAME width the stylesheet shows that switch at (`.phoneOnlyAction`),
  // and not `isMobile()`: that one is also true of every touch screen, so a
  // tablet started with the tray hidden and had no switch to bring it back
  // -- a camera turned on, and nowhere to see yourself.
  const [showCameras, setShowCameras] = createSignal(!cameraSwitchIsShown())
  /** The header, for the share chip: what squeezes the strip it sits in. */
  const [roomHeader, setRoomHeader] = createSignal<HTMLElement>()

  // Mic feedback: "can't hear you" / "too quiet" during a jam exercise.
  const micInsights = useMicInsights({
    micActive: () => jamState() === 'active' && !jamIsMuted(),
    isPlaying: jamExercisePlaying,
    getLevel: jamGetInputLevel,
    isDetecting: () => (jamLocalPitch()?.frequency ?? 0) > 0,
  })

  createEffect(() => {
    if (jamState() === 'active') {
      window.history.replaceState(
        window.history.state,
        '',
        `/#/jam:${jamRoomId()}`,
      )
    } else if (jamState() === 'idle') {
      window.history.replaceState(window.history.state, '', '/#/jam')
    }
  })

  onMount(() => {
    // 1. SessionStorage auto-rejoin (highest priority -- preserves host,
    //    now that the owner token is stored per room rather than held in
    //    memory for the lifetime of one connection)
    const prev = getJamSessionInfo()
    if (prev && jamState() === 'idle') {
      setDisplayName(prev.displayName)
      setJoinRoomId(prev.roomId)
      setJoining(true)
      joinJamRoom(prev.roomId, prev.displayName).finally(() =>
        setJoining(false),
      )
      setJamRoomToJoin(null) // consume URL so it doesn't fire later
      return
    }

    // 2. URL-based room join (fallback for shared invite links)
    const roomId = jamRoomToJoin()
    if (roomId !== null) {
      setJoinRoomId(normalizeRoomCode(roomId))
      setJamRoomToJoin(null)
      handleJoin()
    }
  })

  /**
   * Seeded a starting drill for THIS visit to the room?
   *
   * Once, on arrival -- not "whenever no melody is loaded". The effect
   * below writes the very signal it read, so as a standing rule it fought
   * everything that legitimately clears the drill: loading a song put one
   * straight back (a second transport wired to the same playing signal,
   * and a beat timer whose ending stopped the song), and the trash button
   * looked broken because the drill reappeared before the click finished.
   */
  let seededDrill = false

  createEffect(() => {
    if (jamState() !== 'active') {
      seededDrill = false
      return
    }
    startJamPitchDetection()
    if (seededDrill) return
    // A song room does not want a drill at all, and adopting the host's
    // melody counts as seeded -- there is nothing to pick.
    if (jamIsSongRoom() || jamExerciseMelody() !== null) {
      seededDrill = true
      return
    }
    // Pick the default scale for this voice, so an empty room has
    // something to sing rather than an empty canvas.
    const lib = getMelodyLibrarySignal()()
    const defaultOctave = VOCAL_RANGES[vocalRangePreset()].defaultOctave
    const defaultMelodyId = `scale-major-c${defaultOctave}`
    const defaultMelody =
      lib.melodies[defaultMelodyId] ??
      lib.melodies['scale-major-c3'] ??
      melodyOptions()[0]
    if (defaultMelody === undefined) return
    seededDrill = true
    selectJamExercise(defaultMelody)
  })

  const melodyOptions = createMemo(() => {
    const lib = getMelodyLibrarySignal()()
    return Object.values(lib.melodies)
  })

  const FUNNY_NAMES = [
    'Warty',
    'Hoary',
    'Breezy',
    'Dapper',
    'Edgy',
    'Feisty',
    'Gutsy',
    'Hardy',
    'Intrepid',
    'Jaunty',
    'Karmic',
    'Lucid',
    'Maverick',
    'Natty',
    'Oneiric',
    'Precise',
    'Quantal',
    'Raring',
    'Saucy',
    'Trusty',
    'Utopic',
    'Vivid',
    'Wily',
    'Xenial',
    'Yakkety',
    'Zesty',
    'Artful',
    'Bionic',
    'Cosmic',
    'Disco',
    'Eoan',
    'Focal',
    'Groovy',
    'Hirsute',
    'Impish',
    'Jammy',
    'Kinetic',
    'Lunar',
    'Mantic',
    'Noble',
    'Oracular',
  ]

  const getRandomName = () =>
    FUNNY_NAMES[Math.floor(Math.random() * FUNNY_NAMES.length)]

  const fancyRoomName = createMemo(() => {
    const id = jamRoomId()
    if (id === null || id === '') return ''
    let hash = 0
    for (let i = 0; i < id.length; i++) {
      hash = id.charCodeAt(i) + ((hash << 5) - hash)
    }
    const index = Math.abs(hash) % FUNNY_NAMES.length
    return FUNNY_NAMES[index]
  })

  const colorMap = createMemo(() => {
    const ids = jamPeers().map((p) => p.id)
    const myId = jamPeerId()
    if (myId !== null && myId !== '') ids.push(myId)
    return buildPeerColorMap(ids)
  })

  const myColor = createMemo(() => {
    const id = jamPeerId()
    if (id === null || id === '') return '#10b981' // fallback green
    return colorMap()[id] ?? '#10b981'
  })

  const handleCreate = () => {
    const name = displayName().trim() || getRandomName()
    createJamRoom(name).catch(() => {})
  }

  /**
   * Walk back into a room this device hosts. Same join path as a room code
   * -- the difference is the stored owner token, which signaling attaches
   * and the DO checks. If the room was cleaned up while nobody was in it,
   * the DO adopts this joiner as owner instead, so the controls come back
   * either way.
   */
  const rejoinHostedRoom = (room: HostedRoom) => {
    setJoining(true)
    setJoinRoomId(room.roomId)
    if (room.displayName !== '') setDisplayName(room.displayName)
    joinJamRoom(room.roomId, room.displayName || getRandomName())
      .then((ok) => {
        if (!ok) forgetHostedRoom(room.roomId)
      })
      .finally(() => setJoining(false))
  }

  const handleJoin = () => {
    const roomId = normalizeRoomCode(joinRoomId())
    if (!roomId) return
    setJoining(true)
    const name = displayName().trim() || getRandomName()
    joinJamRoom(roomId, name).finally(() => setJoining(false))
  }

  // Any accepted pick closes the popup -- including one made in the sidebar
  // while the popup happened to be open. See jamPickerAcceptedPicks.
  createEffect(
    on(jamPickerAcceptedPicks, () => setShowExercisePicker(false), {
      defer: true,
    }),
  )

  const togglePicker = (): void => {
    const opening = !showExercisePicker()
    // A list opened afresh should not greet the host with an old complaint.
    if (opening) clearJamPickerError()
    setShowExercisePicker(opening)
  }

  return (
    <div class={jamStyles.panel}>
      {/* ── Idle: connect screen ─────────────────────────────────── */}
      <Show when={jamState() === 'idle'}>
        <div class={jamStyles.connect}>
          <div class={panelStyles.lobbyTitleRow}>
            <h2 class={jamStyles.title}>Jam Session</h2>
            {/* What the room is, kept out of the way. The line below is the
                reason to press the button; this is only for the visitor who
                wants to know what happens after they do. */}
            <div
              ref={aboutRef}
              class={panelStyles.about}
              classList={{ [panelStyles.aboutOpen]: showAbout() }}
            >
              <button
                class={panelStyles.aboutBtn}
                onClick={() => setShowAbout((v) => !v)}
                aria-expanded={showAbout()}
                aria-label="What is a jam session?"
              >
                ?
              </button>
              <div class={panelStyles.aboutPanel} role="note">
                <p>
                  A practice room for up to 12. Everyone sings together and
                  every voice draws its own trail on one shared piano roll,
                  scored live.
                </p>
                <p>
                  Run this week's challenge, your Ascent week, any drill or one
                  of your own melodies -- or split the room into harmony parts
                  and take a phrase each.
                </p>
              </div>
            </div>
          </div>
          <p class={jamStyles.desc} style={{ 'font-style': 'italic' }}>
            "Where words fail, music speaks."
          </p>

          <div class={jamStyles.field}>
            <label
              class={jamStyles.label}
              for="jam-display-name"
              style={{ 'text-transform': 'none', 'letter-spacing': 'normal' }}
            >
              Display Name
            </label>
            <input
              id="jam-display-name"
              class={jamStyles.input}
              type="text"
              value={displayName()}
              onInput={(e) => setDisplayName(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  document.getElementById('jam-room-id')?.focus()
                }
              }}
              placeholder="Anonymous"
              maxLength={24}
            />
          </div>

          <div class={jamStyles.actions} data-tour="jam.actions">
            <button
              class={`${jamStyles.btn} ${jamStyles.btnPrimary}`}
              onClick={handleCreate}
            >
              Create Room
            </button>
          </div>

          {/* Rooms this device hosts. Device-local: nothing is registered
              anywhere and nobody else can see or enumerate them. Rejoining
              presents the stored owner token, which is what hands the
              transport and mode controls back. */}
          <Show when={hostedRooms().length > 0}>
            <div class={jamStyles.divider}>
              <span>your rooms</span>
            </div>
            <div class={panelStyles.myRooms}>
              <For each={hostedRooms()}>
                {(room) => (
                  <div class={panelStyles.myRoom}>
                    <button
                      class={panelStyles.myRoomBtn}
                      disabled={joining()}
                      onClick={() => rejoinHostedRoom(room)}
                    >
                      <span class={panelStyles.myRoomCode}>{room.roomId}</span>
                      <span class={panelStyles.myRoomMeta}>
                        as {room.displayName || 'Anonymous'} · rejoin as host
                      </span>
                    </button>
                    <button
                      class={panelStyles.myRoomForget}
                      title="Forget this room"
                      aria-label={`Forget room ${room.roomId}`}
                      onClick={() => forgetHostedRoom(room.roomId)}
                    >
                      <svg
                        viewBox="0 0 24 24"
                        width="13"
                        height="13"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                      >
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>
                )}
              </For>
            </div>
          </Show>

          <div class={jamStyles.divider}>
            <span>or join existing</span>
          </div>

          <div class={jamStyles.field}>
            <label class={jamStyles.label} for="jam-room-id">
              Room code
            </label>
            <input
              id="jam-room-id"
              class={`${jamStyles.input} ${jamStyles.inputMono}`}
              type="text"
              value={joinRoomId()}
              onInput={(e) => {
                // Rewritten in place so the field always shows the code
                // that will be sent, rather than accepting a spelling
                // that gets silently changed on the way out.
                const code = normalizeRoomCode(e.currentTarget.value)
                e.currentTarget.value = code
                setJoinRoomId(code)
              }}
              onKeyDown={(e) => {
                if (
                  e.key === 'Enter' &&
                  isCompleteRoomCode(joinRoomId()) &&
                  !joining()
                ) {
                  handleJoin()
                }
              }}
              autocapitalize="characters"
              autocomplete="off"
              spellcheck={false}
              placeholder="8-character code"
              maxLength={ROOM_CODE_LENGTH}
            />
          </div>

          <button
            class={`${jamStyles.btn} ${jamStyles.btnSecondary}`}
            onClick={handleJoin}
            disabled={joining() || !isCompleteRoomCode(joinRoomId())}
          >
            {joining() ? 'Joining...' : 'Join Room'}
          </button>

          <Show when={jamError()}>
            <p class={jamStyles.error}>{jamError()}</p>
          </Show>
        </div>
      </Show>

      {/* ── Connecting ───────────────────────────────────────────── */}
      <Show when={jamState() === 'connecting'}>
        <div class={jamStyles.connecting}>
          <p>Connecting to jam room...</p>
        </div>
      </Show>

      {/* ── Active session ───────────────────────────────────────── */}
      <Show when={jamState() === 'active'}>
        <div class={panelStyles.sessionLayout}>
          {/* The peers roster, pitch display and room card live in the
              APP sidebar now (JamRoomPanel) — the rail is THE roster, not
              a mirror, and the room keeps the whole width for the stage. */}
          {/* ── Main content ───────────────────────────────────── */}
          <div class={panelStyles.mainArea}>
            {/* Top bar: room info + controls */}
            <div
              class={jamStyles.roomHeader}
              data-testid="jam-room-header"
              ref={setRoomHeader}
            >
              <div class={jamStyles.roomInfo}>
                <h2 class={jamStyles.title}>Jam {fancyRoomName()}</h2>
                {/* One strip for everything that describes the room rather
                    than controls it: its code, who is in it, and what they
                    can and cannot hear. Grouped because on a phone it
                    becomes a single scrollable line under the title --
                    three separate scrollers would be three things to
                    discover. */}
                <div class={panelStyles.roomStrip}>
                  {/* What the room is singing leads the strip: room, song,
                      then who. It was the first thing in a row of its own
                      under the playback controls, and that row is gone. */}
                  <JamNowSinging />
                  {/* The code and the way in are one control: the code is the
                      label people read aloud, and pressing it copies the link.
                      It was a pill and a copy button side by side, which
                      said one thing twice in the row with the least width
                      to spare. The invite dialog keeps them apart. */}
                  <JamRoomCode roomId={jamRoomId() ?? ''} />
                  <div class={panelStyles.peerBadges}>
                    <span
                      class={panelStyles.peerBadge}
                      style={{
                        background: `linear-gradient(135deg, ${myColor()}66, ${myColor()}cc)`,
                        color: '#fff',
                        border: `1px solid ${myColor()}`,
                        'box-shadow': `0 0 12px ${myColor()}66, inset 0 0 8px ${myColor()}88`,
                      }}
                    >
                      {(getJamSessionInfo()?.displayName ?? '') !== ''
                        ? getJamSessionInfo()?.displayName
                        : 'You'}
                    </span>
                    <For each={jamConnectedPeers()}>
                      {(peer) => {
                        const color = colorMap()[peer.id] ?? '#f0883e'
                        return (
                          <span
                            class={panelStyles.peerBadge}
                            style={{
                              background: `linear-gradient(135deg, ${color}66, ${color}cc)`,
                              color: '#fff',
                              border: `1px solid ${color}`,
                              'box-shadow': `0 0 12px ${color}66, inset 0 0 8px ${color}88`,
                            }}
                          >
                            {peer.displayName}
                          </span>
                        )
                      }}
                    </For>
                  </div>
                  {/* A transfer pushed to the background keeps a live
                      readout here, beside the people it concerns -- so
                      dismissing the dialog never means losing the thread.
                      The share offer sits in the same place for the same
                      reason: "two can't hear this" is about the names it
                      is standing next to. */}
                  <JamTransferChip />
                  <JamSongShare within={roomHeader} />
                </div>
              </div>
              <div
                class={jamStyles.roomActions}
                classList={{ [panelStyles.actionsOpen]: roomMenuOpen() }}
                ref={roomActionsRef}
              >
                {/* Phone: everything but mic and leave folds in here. Mic
                    stays out because it is the control you reach for mid
                    take, and leave because it is the way out. */}
                <button
                  class={`${jamStyles.iconBtn} ${jamStyles.iconBtnNeutral} ${panelStyles.roomMenuBtn}`}
                  onClick={() => setRoomMenuOpen((v) => !v)}
                  aria-expanded={roomMenuOpen()}
                  aria-label="Room controls"
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                  >
                    <line x1="4" y1="7" x2="20" y2="7" />
                    <line x1="4" y1="12" x2="20" y2="12" />
                    <line x1="4" y1="17" x2="20" y2="17" />
                  </svg>
                </button>
                {/* Room glass — how much of the rehearsal room shows through */}
                <label
                  class={panelStyles.glassControl}
                  title="Room transparency — how much of the backdrop shows through"
                >
                  <svg
                    viewBox="0 0 24 24"
                    width="14"
                    height="14"
                    aria-hidden="true"
                  >
                    <path
                      fill="currentColor"
                      d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 2v16a8 8 0 0 1 0-16z"
                    />
                  </svg>
                  <input
                    type="range"
                    class={panelStyles.glassSlider}
                    min="0.05"
                    max="1"
                    step="0.05"
                    value={jamRoomAlpha()}
                    aria-label="Room transparency"
                    onInput={(e) =>
                      setJamRoomAlpha(Number(e.currentTarget.value))
                    }
                  />
                </label>

                {/* Microphone toggle. First in the row on a phone (see
                    .micBtn) -- it is the control with a consequence, and
                    the one people look for when someone says they can hear
                    the room. */}
                <button
                  class={`${jamStyles.iconBtn} ${panelStyles.micBtn} ${jamIsMuted() ? jamStyles.iconBtnOff : jamStyles.iconBtnOn}`}
                  onClick={() => void toggleJamMute()}
                  aria-pressed={!jamIsMuted()}
                  title={jamIsMuted() ? 'Unmute microphone' : 'Mute microphone'}
                >
                  <Show
                    when={!jamIsMuted()}
                    fallback={
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      >
                        <line x1="1" y1="1" x2="23" y2="23" />
                        <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
                        <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
                        <line x1="12" y1="19" x2="12" y2="23" />
                        <line x1="8" y1="23" x2="16" y2="23" />
                      </svg>
                    }
                  >
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                      <line x1="12" y1="19" x2="12" y2="23" />
                      <line x1="8" y1="23" x2="16" y2="23" />
                    </svg>
                  </Show>
                </button>

                <div class={panelStyles.roomMenuItems}>
                  <Show when={jamIsHost()}>
                    <PremiumBackgroundPicker
                      controller={roomBackgroundPicker}
                      label="Room stage"
                      iconOnly
                      selectedId={jamSelectedBackgroundId}
                      onSelect={(option) => selectJamRoomBackground(option.id)}
                      busy={jamBackgroundChanging}
                      error={jamBackgroundError}
                    />
                  </Show>
                  {/* Live pitch monitor — phone only.
                      On a desktop it sits with the other view controls in
                      the transport row, but on a phone that row wraps and
                      this one button claimed a whole line of a 390px
                      screen. It belongs with the other things that fold
                      into the menu. */}
                  <button
                    class={`${jamStyles.iconBtn} ${jamShowPitch() ? jamStyles.iconBtnOn : jamStyles.iconBtnNeutral} ${panelStyles.phoneOnlyAction}`}
                    onClick={() => setJamShowPitch((v) => !v)}
                    aria-pressed={jamShowPitch()}
                    title={
                      jamShowPitch()
                        ? 'Hide the live pitch'
                        : 'Show the live pitch'
                    }
                  >
                    <svg
                      viewBox="0 0 16 16"
                      width="18"
                      height="18"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="1.8"
                    >
                      <path
                        d="M2 8h2l2-4 2 8 2-5 2 3h2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      />
                    </svg>
                  </button>

                  {/* Show or hide the camera tray -- phone only, where it
                      has nowhere to float and starts out of the way. */}
                  <button
                    class={`${jamStyles.iconBtn} ${showCameras() ? jamStyles.iconBtnOn : jamStyles.iconBtnNeutral} ${panelStyles.phoneOnlyAction}`}
                    onClick={() => setShowCameras((v) => !v)}
                    aria-pressed={showCameras()}
                    title={
                      showCameras() ? 'Hide the cameras' : 'Show the cameras'
                    }
                  >
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <rect x="2" y="6" width="12" height="12" rx="2" />
                      <path d="M14 11l7-4v10l-7-4" />
                    </svg>
                  </button>

                  {/* Peers and the song list live in the APP sidebar
                      (JamRoomPanel); this shows or hides it. A second press must undo the
                      first — a button that can only open reads as ignored
                      the moment it is pressed while already open. */}
                  <button
                    class={`${jamStyles.iconBtn} ${
                      rosterShowing()
                        ? jamStyles.iconBtnOn
                        : jamStyles.iconBtnNeutral
                    }`}
                    onClick={() => {
                      if (rosterShowing()) {
                        if (isMobile()) setAppSidebarOpen(false)
                        else setAppSidebarCollapsed(true)
                      } else {
                        setAppSidebarCollapsed(false)
                        setAppSidebarOpen(true)
                      }
                    }}
                    aria-pressed={rosterShowing()}
                    title={
                      rosterShowing()
                        ? 'Hide the roster and the song list'
                        : 'Show the roster and the song list'
                    }
                  >
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                    </svg>
                  </button>

                  {/* Camera toggle */}
                  <button
                    class={`${jamStyles.iconBtn} ${jamVideoEnabled() ? jamStyles.iconBtnOn : jamStyles.iconBtnOff}`}
                    onClick={() => void toggleJamVideo()}
                    aria-pressed={jamVideoEnabled()}
                    title={
                      jamVideoEnabled() ? 'Turn camera off' : 'Turn camera on'
                    }
                  >
                    <Show
                      when={jamVideoEnabled()}
                      fallback={
                        <svg
                          width="18"
                          height="18"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="2"
                          stroke-linecap="round"
                          stroke-linejoin="round"
                        >
                          <line x1="1" y1="1" x2="23" y2="23" />
                          <path d="M21 21H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3m3-3h6l2 3h4a2 2 0 0 1 2 2v9.34m-7.72-2.06A4 4 0 1 1 7.72 7.72" />
                        </svg>
                      }
                    >
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      >
                        <polygon points="23 7 16 12 23 17 23 7" />
                        <rect
                          x="1"
                          y="5"
                          width="15"
                          height="14"
                          rx="2"
                          ry="2"
                        />
                      </svg>
                    </Show>
                  </button>

                  {/* Invite */}
                  <button
                    class={`${jamStyles.iconBtn} ${jamStyles.iconBtnNeutral}`}
                    onClick={() => setShowInvite(true)}
                    title="Invite people"
                  >
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                      <line x1="19" y1="8" x2="19" y2="14" />
                      <line x1="22" y1="11" x2="16" y2="11" />
                    </svg>
                  </button>
                </div>

                {/* Leave */}
                <button
                  class={`${jamStyles.iconBtn} ${jamStyles.iconBtnDanger}`}
                  onClick={leaveJamRoom}
                  title="Leave room"
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Mic guidance used to live in the removed peers sidebar;
                the hint is about YOUR input, so it sits with the stage. */}
            <MicInsightHint
              message={micInsights.message}
              insight={micInsights.insight}
              style={{ margin: '0 auto', width: 'fit-content' }}
            />

            {/* ── Exercise controls + live pitch toggle ─────────── */}
            {/* Positioned wrapper so the picker below can overlay the
                canvas rather than push it down the flex column. */}
            <div
              class={panelStyles.transportRow}
              data-testid="jam-transport-row"
            >
              {/* The drill's transport hides itself in a song room, because
                  it only renders when a melody is loaded and a song room
                  has none. What stays is the picker button -- the way back
                  out of a song. Two play buttons writing one playing signal
                  is a room that stops for reasons nobody can see. */}
              <div
                class={panelStyles.exerciseBar}
                data-testid="jam-transport-bar"
              >
                {/* The guide vocal used to lead this row on every screen. It
                    is about what YOU hear, and it sat in front of the buttons
                    that are about what the ROOM does -- so it floats in a
                    corner of the words now (JamSongStage), and on a phone it
                    is docked above the tab bar, below.

                    This copy is what is left: a short screen (a phone on its
                    side) has no corner tall enough for a capsule that opens
                    upward, and the stylesheet shows this one there instead.

                    OUTSIDE the host gate that JamTransport puts around its
                    own buttons: the room's transport is the host's, but how
                    loud the original singer is in your ears is yours. */}
                <Show
                  when={jamIsSongRoom() && jamSong()?.stems.vocal !== undefined}
                >
                  <div class={panelStyles.guideInline}>
                    <JamGuideVocal
                      volume={jamGuideVolume}
                      onVolume={setJamGuideVolume}
                    />
                  </div>
                </Show>
                {/* The playback controls: one capsule for the transport and
                    the live-pitch toggle, and a More button for the tempo
                    and the room's mode -- which only a drill has. */}
                <JamControlBar
                  onSelectExercise={togglePicker}
                  pickerOpen={showExercisePicker()}
                />

                {/* Say it plainly. Everything on screen is real UI, but the
                  peers are invented -- letting someone believe a stranger
                  joined their preview would be worse than not previewing. */}
                <Show when={jamSignalingIsMocked()}>
                  <div class={panelStyles.previewChip} role="note">
                    Preview room — these peers are not real
                  </div>
                </Show>

                {/* Which part is mine, once the room is actually split. A
                    DRILL's part: the mode deals out the shared melody, and
                    a song has none -- its parts are dealt line by line
                    above the words, so on a song this badge named a part
                    nobody was singing. */}
                <Show when={!jamIsSongRoom() && !jamMyRole().isUnison}>
                  <div
                    class={panelStyles.roleBadge}
                    style={{ 'border-color': myColor(), color: myColor() }}
                    title={jamModeInfo(jamMyRole().mode).blurb}
                  >
                    You sing: {jamMyRole().name}
                  </div>
                </Show>

                {/* Your last take, scored over the whole run the way the solo
                  exercises score theirs -- the canvas scoreboard beside it
                  is a live rolling hit rate, which is a different number on
                  purpose. Yours only: peer streams are untrusted. */}
                <Show when={jamOwnRunScore()}>
                  {(run) => (
                    <div
                      class={panelStyles.takeChip}
                      title={`Your last take, scored across all ${run().notes.length} notes. Coverage ${Math.round(run().coverage * 100)}% — notes you did not sing count as zero.`}
                    >
                      <span class={panelStyles.takeLabel}>Your take</span>
                      <span class={panelStyles.takeScore}>{run().score}</span>
                      <Show when={run().coverage < 1}>
                        <span class={panelStyles.takeCoverage}>
                          {Math.round(run().coverage * 100)}% sung
                        </span>
                      </Show>
                    </div>
                  )}
                </Show>
              </div>

              {/* Where the song is, on the same row as the buttons that
                  move it -- wherever there is the width. A sibling of the
                  bar rather than an item in it, because on a phone the bar
                  scrolls sideways, and a timeline must never scroll out
                  from under a thumb that is dragging it. */}
              <Show when={jamIsSongRoom()}>
                <div class={panelStyles.songTimeline}>
                  <JamSongTimeline />
                </div>
              </Show>

              {/* Exercise picker.
                  On a desk it is an overlay, so opening it does not shove
                  the canvas and the pitch strip down the page. On a phone
                  that same overlay was unreachable: absolutely positioned
                  against the transport row, inside a flex column whose
                  canvas area is `overflow: hidden` — the host tapped the
                  picker and nothing appeared. Same shelves, in the mobile
                  kit's sheet, which is also where Karaoke Night keeps its
                  song list, so it is a gesture already learned. */}
              <Show when={showExercisePicker() && !isNarrow()}>
                <div class={panelStyles.exercisePicker} ref={pickerRef}>
                  <JamPickerList variant="popup" />
                </div>
              </Show>
              <Sheet
                isOpen={showExercisePicker() && isNarrow()}
                close={() => setShowExercisePicker(false)}
                ariaLabel="Choose a song or a drill"
                snap="tall"
              >
                <JamPickerList variant="sheet" />
              </Sheet>
            </div>

            {/* ── The room's stage: a song, or the drill canvases ── */}
            <Show when={jamIsSongRoom()}>
              <JamSongStage />
            </Show>

            <Show when={!jamIsSongRoom()}>
              <div class={panelStyles.canvasArea}>
                {/* Exercise — takes most space */}
                <div
                  class={`${exerciseCanvasStyles.container} ${panelStyles.exerciseCanvas}`}
                >
                  <JamExerciseCanvas myPeerId={jamPeerId} />
                  <JamActivityHeatmap />
                </div>

                {/* Shared pitch — compact strip below, toggleable */}
                <div
                  class={panelStyles.pitchStrip}
                  classList={{
                    [panelStyles.pitchStripCollapsed]: !jamShowPitch(),
                  }}
                >
                  <Show when={jamShowPitch()}>
                    <div class={panelStyles.pitchStripLabel}>
                      Live Pitch Monitor
                    </div>
                    <div class={pitchCanvasStyles.container}>
                      <JamSharedPitchCanvas myPeerId={jamPeerId} />
                    </div>
                  </Show>
                </div>
              </div>
            </Show>

            <Show when={jamError()}>
              <p class={jamStyles.error}>{jamError()}</p>
            </Show>
          </div>
        </div>
      </Show>

      <Show when={showInvite()}>
        <JamInviteModal
          roomId={jamRoomId() ?? ''}
          onClose={() => setShowInvite(false)}
        />
      </Show>

      <Show when={jamState() === 'active'}>
        {/* Phone only: the guide-vocal level, docked above the tab bar
            next to the chat bubble. It is the one control you reach for
            mid-song, and in the song's own transport row it was competing
            with the timeline for width on a 390px screen -- with a slider
            that expands straight over it.

            Mounted here rather than inside the song stage because it is
            position-fixed, and a fixed element under a backdrop-filtered
            ancestor is positioned against that ancestor rather than the
            viewport. This is the same level the chat bubble sits at, for
            the same reason. Both copies read one store signal. */}
        <Show when={jamIsSongRoom() && jamSong()?.stems.vocal !== undefined}>
          <div class={panelStyles.guideDock}>
            <JamGuideVocal
              volume={jamGuideVolume}
              onVolume={setJamGuideVolume}
            />
          </div>
        </Show>
        {/* The camera tray is a floating, draggable thing, and a phone
            has nowhere to float it: the bottom-right corner is already
            the chat bubble and the guide-vocal dock, and dragging a tray
            around 390px of screen is not a gesture worth having. So on a
            phone it starts hidden and there is a switch for it in the room
            menu -- the feature is a tap away rather than in the way. */}
        <Show when={showCameras()}>
          <JamCameraWidget />
        </Show>
        <JamChatWidget />
      </Show>
    </div>
  )
}
