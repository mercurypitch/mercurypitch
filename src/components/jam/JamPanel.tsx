// ── JamPanel ────────────────────────────────────────────────────────
// Main jam session UI — tabless layout with collapsible sidebar.

import type { Component } from 'solid-js'
import { createEffect, createMemo, createSignal, For, onCleanup, onMount, Show, } from 'solid-js'
import { MicInsightHint } from '@/components/MicInsightHint'
import { Sheet } from '@/components/mobile/Sheet'
import { PremiumBackgroundPicker } from '@/features/backgrounds/PremiumBackgroundPicker'
import type { WeeklyChallenge } from '@/features/challenges/weekly-service'
import { getActiveWeekly } from '@/features/challenges/weekly-service'
import { DEMO_SESSION_ID, loadDemoSong, } from '@/features/karaoke-night/demo-song'
import { useMicInsights } from '@/features/mic-feedback/useMicInsights'
import { activePathWeek } from '@/features/path/path-progress'
import { useBackgroundSurfaceController } from '@/lib/backgrounds/background-surface'
import type { JamCatalogEntry } from '@/lib/jam/jam-catalog'
import { jamAscentEntries, jamExerciseEntries, jamMelodyEntries, jamSessionRowEntries, jamSongEntries, jamWeeklyEntry, } from '@/lib/jam/jam-catalog'
import { JAM_MODES, jamModeInfo } from '@/lib/jam/jam-modes'
import type { HostedRoom } from '@/lib/jam/jam-rooms'
import { forgetHostedRoom, hostedRooms } from '@/lib/jam/jam-rooms'
import { ownSongRows, sessionSong, sessionSongNotes, } from '@/lib/jam/jam-session-songs'
import type { JamSong } from '@/lib/jam/jam-song'
import { demoSongToJamSong, lrcToSongLines } from '@/lib/jam/jam-song-sources'
import { buildPeerColorMap } from '@/lib/jam/peer-colors'
import { jamSignalingIsMocked } from '@/lib/jam/signaling'
import type { LyricsLineTiming } from '@/lib/jam/types'
import { parseLrcFile } from '@/lib/lyrics-service'
import { isMobile, isNarrow } from '@/lib/use-viewport'
import { createJamRoom, getJamSessionInfo, jamBackgroundChanging, jamBackgroundError, jamConnectedPeers, jamError, jamExerciseBpm, jamExerciseLoop, jamExerciseMelody, jamExercisePlaying, jamGetInputLevel, jamGuideVolume, jamIsHost, jamIsMuted, jamIsSongRoom, jamLocalPitch, jamMyRole, jamOwnRunScore, jamPeerId, jamPeers, jamRoomAlpha, jamRoomId, jamRoomMode, jamRoomToJoin, jamSelectedBackgroundId, jamSong, jamState, jamVideoEnabled, joinJamRoom, leaveJamRoom, selectJamExercise, selectJamRoomBackground, selectJamRoomMode, selectJamSong, setJamExerciseBpm, setJamExerciseLoop, setJamGuideVolume, setJamRoomAlpha, setJamRoomToJoin, startJamPitchDetection, toggleJamMute, toggleJamVideo, } from '@/stores/jam-store'
import { getMelodyLibrarySignal } from '@/stores/melody-store'
import { VOCAL_RANGES, vocalRangePreset } from '@/stores/settings-store'
import { getAllUvrSessionsReactive } from '@/stores/uvr-store'
import jamStyles from './Jam.module.css'
import { JamActivityHeatmap } from './JamActivityHeatmap'
import { JamCameraWidget } from './JamCameraWidget'
import { JamChatWidget } from './JamChatWidget'
import { JamExerciseCanvas } from './JamExerciseCanvas'
import exerciseCanvasStyles from './JamExerciseCanvas.module.css'
import { JamGuideVocal } from './JamGuideVocal'
import { JamInviteModal } from './JamInviteModal'
import panelStyles from './JamPanel.module.css'
import { JamPeerList } from './JamPeerList'
import { JamPitchDisplay } from './JamPitchDisplay'
import { JamSharedPitchCanvas } from './JamSharedPitchCanvas'
import pitchCanvasStyles from './JamSharedPitchCanvas.module.css'
import { JamSongShare } from './JamSongShare'
import { JamSongStage } from './JamSongStage'
import { JamTransferChip } from './JamTransferDialog'
import { JamTransport } from './JamTransport'

export const JamPanel: Component = () => {
  const roomBackgroundPicker = useBackgroundSurfaceController('jam')
  const [displayName, setDisplayName] = createSignal('')
  const [joinRoomId, setJoinRoomId] = createSignal('')
  const [showInvite, setShowInvite] = createSignal(false)
  const [joining, setJoining] = createSignal(false)
  const [showExercisePicker, setShowExercisePicker] = createSignal(false)
  const [pickerError, setPickerError] = createSignal('')
  const [pickingEntryId, setPickingEntryId] = createSignal<string | null>(null)

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
  const [linkCopied, setLinkCopied] = createSignal(false)
  const [sidebarOpen, setSidebarOpen] = createSignal(false)
  const [showLivePitch, setShowLivePitch] = createSignal(true)
  // Read once, not tracked: this is the starting position of a switch the
  // user then owns. Reacting to it would snatch the tray back the moment a
  // window crossed the breakpoint, undoing a choice they had just made.
  const [showCameras, setShowCameras] = createSignal(!isMobile())

  // Mic feedback: "can't hear you" / "too quiet" during a jam exercise.
  const micInsights = useMicInsights({
    micActive: () => jamState() === 'active' && !jamIsMuted(),
    isPlaying: jamExercisePlaying,
    getLevel: jamGetInputLevel,
    isDetecting: () => (jamLocalPitch()?.frequency ?? 0) > 0,
  })

  const roomLink = createMemo(
    () => `${window.location.origin}/#/jam:${jamRoomId() ?? ''}`,
  )

  createEffect(() => {
    if (jamState() === 'active') {
      window.history.replaceState(null, '', `/#/jam:${jamRoomId()}`)
    } else if (jamState() === 'idle') {
      window.history.replaceState(null, '', '/#/jam')
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
      setJoinRoomId(roomId.toUpperCase())
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

  // This week's challenge, fetched once the room is live. Null covers both
  // "no API configured" and "no challenge running" -- the shelf just does
  // not render, which is why the fetch never needs an error branch.
  const [weekly, setWeekly] = createSignal<WeeklyChallenge | null>(null)

  /**
   * The one song a room can sing today: its stems are already public, so
   * every peer resolves the same URLs and nothing has to be transferred.
   * Null until it loads, and null forever if the manifest is missing --
   * the shelf then renders empty rather than offering a dead row.
   */
  const [demoSong, setDemoSong] = createSignal<JamSong | null>(null)
  const [demoSongState, setDemoSongState] = createSignal<
    'loading' | 'ready' | 'unavailable'
  >('loading')

  /**
   * Your own separated sessions. Resolved when the room goes live and
   * again whenever the session list changes, because a separation that
   * finishes while you are sitting in a room should appear without
   * making you leave and come back.
   *
   * The demo the Songs shelf already lists is dropped — see `ownSongRows`.
   */
  const mySongRows = createMemo(() =>
    jamState() === 'active'
      ? ownSongRows(getAllUvrSessionsReactive(), DEMO_SESSION_ID)
      : [],
  )

  createEffect(() => {
    if (jamState() !== 'active') {
      setDemoSong(null)
      setDemoSongState('loading')
      return
    }
    setDemoSong(null)
    setDemoSongState('loading')
    void (async () => {
      try {
        const manifest = await loadDemoSong()
        if (manifest === null) {
          setDemoSongState('unavailable')
          return
        }
        let lines: LyricsLineTiming[] = []
        const lyricsUrl = manifest.lyrics ?? ''
        if (lyricsUrl.toLowerCase().endsWith('.lrc')) {
          // Straight from the URL rather than the local lyrics db: the room
          // wants the timings, not a copy of someone's edits, and every peer
          // must end up with the same lines.
          const text = await fetch(lyricsUrl)
            .then((r) => (r.ok ? r.text() : ''))
            .catch(() => '')
          if (text !== '') lines = lrcToSongLines(parseLrcFile(text))
        }
        // The demo is a normal session as far as analysis is concerned, so
        // if it has been opened in the mixer once there is a vocal line to
        // aim at; if not, the room still works on lyrics alone.
        const notes = await sessionSongNotes(DEMO_SESSION_ID)
        const song = demoSongToJamSong(manifest, lines, notes)
        if (song === null) {
          setDemoSongState('unavailable')
          return
        }
        setDemoSong(song)
        setDemoSongState('ready')
      } catch {
        // The picker still has drills and saved melodies. Keep those usable
        // and say only that the included song is unavailable.
        setDemoSongState('unavailable')
      }
    })()
  })

  createEffect(() => {
    if (jamState() !== 'active') return
    void getActiveWeekly()
      .then(setWeekly)
      .catch(() => setWeekly(null))
  })

  /**
   * What the room can sing, grouped by where it came from. Exercises, the
   * weekly challenge and the Ascent week all resolve to the same thing a
   * saved melody does -- a target contour on a beat grid -- so the picker
   * treats them identically and selectJamExercise broadcasts the result.
   */
  const pickerShelves = createMemo(() => {
    const octave = VOCAL_RANGES[vocalRangePreset()].defaultOctave
    const week = activePathWeek()
    const weeklyEntry = jamWeeklyEntry(weekly())
    return [
      { label: 'Songs', entries: jamSongEntries([demoSong()]) },
      {
        label: 'Your songs',
        entries: jamSessionRowEntries(mySongRows(), (row) =>
          sessionSong(row.session),
        ),
      },
      {
        label: "This week's challenge",
        entries: weeklyEntry === null ? [] : [weeklyEntry],
      },
      {
        label: week === null ? 'Your Ascent' : `Ascent · week ${week.order}`,
        entries: jamAscentEntries(week, octave),
      },
      { label: 'Exercises', entries: jamExerciseEntries(octave) },
      { label: 'Your melodies', entries: jamMelodyEntries(melodyOptions()) },
    ]
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
    const roomId = joinRoomId().trim().toUpperCase()
    if (!roomId) return
    setJoining(true)
    const name = displayName().trim() || getRandomName()
    joinJamRoom(roomId, name).finally(() => setJoining(false))
  }

  const togglePicker = (): void => {
    const opening = !showExercisePicker()
    if (opening) setPickerError('')
    setShowExercisePicker(opening)
  }

  /**
   * A separated song is hydrated only after it is chosen. Keep the drawer
   * open while that IndexedDB work runs, and close only after the room truly
   * accepted the song. The old handler closed first, so a missing stem or a
   * read failure looked exactly like a picker that had ignored the tap.
   */
  const choosePickerEntry = (entry: JamCatalogEntry): void => {
    setPickerError('')
    if (entry.kind !== 'song') {
      selectJamExercise(entry.build())
      setShowExercisePicker(false)
      return
    }

    const entryId = entry.id
    const entryName = entry.name
    setPickingEntryId(entryId)
    void (async () => {
      try {
        const song = await entry.buildSong()
        if (song === null) {
          setPickerError(
            `${entryName} is missing its backing track on this device. Open it in Karaoke and try again.`,
          )
          return
        }
        if (!selectJamSong(song)) {
          const reason = jamError()?.trim() ?? ''
          setPickerError(
            reason !== ''
              ? reason
              : `${entryName} cannot be loaded into this room.`,
          )
          return
        }
        setShowExercisePicker(false)
      } catch {
        setPickerError(
          `${entryName} could not be read from this device. Try opening it in Karaoke first.`,
        )
      } finally {
        setPickingEntryId(null)
      }
    })()
  }

  /** The picker's shelves, rendered into the desktop overlay or the
   *  mobile sheet — one list, two containers. */
  const pickerBody = () => (
    <>
      <Show when={pickerError() !== ''}>
        <div class={panelStyles.pickError} role="alert">
          {pickerError()}
        </div>
      </Show>
      <Show when={demoSongState() !== 'ready'}>
        <div class={panelStyles.pickShelf}>
          <div class={panelStyles.pickShelfLabel}>Songs</div>
          <div class={panelStyles.pickStatus} role="status">
            {demoSongState() === 'loading'
              ? 'Loading the included karaoke song…'
              : 'The included karaoke song is unavailable. Drills and melodies are still ready.'}
          </div>
        </div>
      </Show>
      <For each={pickerShelves()}>
        {(shelf) => (
          <Show when={shelf.entries.length > 0}>
            <div class={panelStyles.pickShelf}>
              <div class={panelStyles.pickShelfLabel}>{shelf.label}</div>
              <For each={shelf.entries}>
                {(entry) => (
                  <button
                    class={panelStyles.pickItem}
                    disabled={pickingEntryId() !== null}
                    aria-busy={pickingEntryId() === entry.id}
                    onClick={() => choosePickerEntry(entry)}
                  >
                    <span class={panelStyles.pickName}>
                      {entry.name}
                      <Show when={pickingEntryId() === entry.id}>
                        <span class={panelStyles.pickSpinner} />
                      </Show>
                    </span>
                    <span class={panelStyles.pickMeta}>{entry.detail}</span>
                  </button>
                )}
              </For>
            </div>
          </Show>
        )}
      </For>
    </>
  )

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
              onInput={(e) => setJoinRoomId(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (
                  e.key === 'Enter' &&
                  joinRoomId().trim() !== '' &&
                  !joining()
                ) {
                  handleJoin()
                }
              }}
              placeholder="e.g. ABCD"
              maxLength={32}
            />
          </div>

          <button
            class={`${jamStyles.btn} ${jamStyles.btnSecondary}`}
            onClick={handleJoin}
            disabled={joining() || joinRoomId().trim() === ''}
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
          {/* Dismisses the drawer on a phone; inert on a desktop, where the
              sidebar takes a column of its own rather than overlaying. */}
          <Show when={sidebarOpen()}>
            <div
              class={panelStyles.sidebarScrim}
              onClick={() => setSidebarOpen(false)}
              aria-hidden="true"
            />
          </Show>
          {/* ── Collapsible sidebar ────────────────────────────── */}
          <div
            class={`${panelStyles.sidebar} ${sidebarOpen() ? panelStyles.sidebarOpen : ''}`}
          >
            <div class={panelStyles.sidebarInner}>
              {/* On a phone the sidebar covers the room and the header
                  toggle goes with it, so it needs its own way out. */}
              <button
                class={panelStyles.sidebarClose}
                onClick={() => setSidebarOpen(false)}
                aria-label="Close peers panel"
              >
                <svg
                  viewBox="0 0 24 24"
                  width="14"
                  height="14"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <polyline points="15 18 9 12 15 6" />
                </svg>
                <span>Peers</span>
              </button>
              <div class={jamStyles.status}>
                <span
                  class={`${jamStyles.statusDot} ${jamStyles.statusDotActive}`}
                />
                <span>
                  {jamConnectedPeers().length} peer
                  {jamConnectedPeers().length !== 1 ? 's' : ''} connected
                </span>
                <Show when={jamIsMuted()}>
                  <span class={jamStyles.mutedIndicator}>(muted)</span>
                </Show>
              </div>
              <JamPeerList peers={jamPeers()} />
              <JamPitchDisplay />
              <MicInsightHint
                message={micInsights.message}
                insight={micInsights.insight}
                style={{ margin: '6px auto 0', width: 'fit-content' }}
              />
            </div>
          </div>
          {/* ── Main content ───────────────────────────────────── */}
          <div class={panelStyles.mainArea}>
            {/* Top bar: room info + controls */}
            <div class={jamStyles.roomHeader}>
              <div class={jamStyles.roomInfo}>
                <h2 class={jamStyles.title}>Jam {fancyRoomName()}</h2>
                {/* One strip for everything that describes the room rather
                    than controls it: its code, who is in it, and what they
                    can and cannot hear. Grouped because on a phone it
                    becomes a single scrollable line under the title --
                    three separate scrollers would be three things to
                    discover. */}
                <div class={panelStyles.roomStrip}>
                  {/* The room code stays visible -- people read it aloud.
                      Copying the link is the one action worth a button
                      here; the invite modal has the rest, which is why the
                      button folds away on a phone and the code does not. */}
                  <span class={jamStyles.roomIdBadge}>{jamRoomId()}</span>
                  <button
                    class={`${jamStyles.btn} ${jamStyles.btnSm} ${panelStyles.copyLinkBtn}`}
                    onClick={() => {
                      navigator.clipboard.writeText(roomLink()).catch(() => {})
                      setLinkCopied(true)
                      setTimeout(() => setLinkCopied(false), 2000)
                    }}
                  >
                    {linkCopied() ? 'Copied!' : 'Copy link'}
                  </button>
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
                  <JamSongShare />
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
                    class={`${jamStyles.iconBtn} ${showLivePitch() ? jamStyles.iconBtnOn : jamStyles.iconBtnNeutral} ${panelStyles.phoneOnlyAction}`}
                    onClick={() => setShowLivePitch((v) => !v)}
                    title={
                      showLivePitch()
                        ? 'Hide live pitch monitor'
                        : 'Show live pitch monitor'
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

                  {/* Sidebar toggle */}
                  <button
                    class={`${jamStyles.iconBtn} ${sidebarOpen() ? jamStyles.iconBtnOn : jamStyles.iconBtnNeutral}`}
                    onClick={() => setSidebarOpen((v) => !v)}
                    title={
                      sidebarOpen() ? 'Hide peers panel' : 'Show peers panel'
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

            {/* ── Exercise controls + live pitch toggle ─────────── */}
            {/* Positioned wrapper so the picker below can overlay the
                canvas rather than push it down the flex column. */}
            <div class={panelStyles.transportRow}>
              {/* The drill's transport hides itself in a song room, because
                  it only renders when a melody is loaded and a song room
                  has none. What stays is the picker button -- the way back
                  out of a song. Two play buttons writing one playing signal
                  is a room that stops for reasons nobody can see. */}
              <div class={panelStyles.exerciseBar}>
                {/* The guide vocal, beside play and stop -- it belongs with
                    the things that decide what you hear, not after the
                    timeline where it read as part of the scrubber.

                    OUTSIDE the host gate that JamTransport puts around its
                    own buttons: the room's transport is the host's, but how
                    loud the original singer is in your ears is yours.

                    Hidden on a phone, where it is docked above the tab bar
                    within reach of a thumb -- this row scrolls sideways
                    there, and a control that can scroll out of sight is not
                    one you can grab mid-song. */}
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
                <JamTransport
                  onSelectExercise={togglePicker}
                  loopEnabled={jamExerciseLoop()}
                  onToggleLoop={() => setJamExerciseLoop((v) => !v)}
                />
                {/* BPM control — host only, shown when melody loaded */}
                <Show when={jamIsHost() && jamExerciseMelody()}>
                  <div class={panelStyles.bpmControl}>
                    <button
                      class={panelStyles.bpmStep}
                      onClick={() =>
                        setJamExerciseBpm((v) => Math.max(40, v - 5))
                      }
                      title="Decrease BPM by 5"
                    >
                      <svg
                        viewBox="0 0 12 12"
                        width="10"
                        height="10"
                        fill="currentColor"
                      >
                        <rect x="2" y="5.5" width="8" height="1.5" rx="0.75" />
                      </svg>
                    </button>
                    <input
                      class={panelStyles.bpmInput}
                      type="number"
                      min="20"
                      max="300"
                      value={jamExerciseBpm()}
                      onInput={(e) => {
                        const v = parseInt(e.currentTarget.value, 10)
                        if (!isNaN(v) && v >= 20 && v <= 300)
                          setJamExerciseBpm(v)
                      }}
                      title="Playback BPM"
                    />
                    <button
                      class={panelStyles.bpmStep}
                      onClick={() =>
                        setJamExerciseBpm((v) => Math.min(300, v + 5))
                      }
                      title="Increase BPM by 5"
                    >
                      <svg
                        viewBox="0 0 12 12"
                        width="10"
                        height="10"
                        fill="currentColor"
                      >
                        <rect x="2" y="5.5" width="8" height="1.5" rx="0.75" />
                        <rect x="5.25" y="2" width="1.5" height="8" rx="0.75" />
                      </svg>
                    </button>
                    <span class={panelStyles.bpmLabel}>bpm</span>
                  </div>
                </Show>

                {/* View toggles. Grouped beside the BPM control rather than
                    stranded at the far left: these shape what the room LOOKS
                    like, which is the same kind of decision as the tempo, and
                    a lone button across the bar reads as unrelated.

                    Hidden on a phone, where the same control lives in the
                    room menu -- the bar wraps there and one button was
                    taking a whole row. */}
                <div class={panelStyles.viewToggles}>
                  <button
                    class={panelStyles.pitchToggleBtn}
                    classList={{
                      [panelStyles.pitchToggleBtnActive]: showLivePitch(),
                    }}
                    onClick={() => setShowLivePitch((v) => !v)}
                    title={
                      showLivePitch()
                        ? 'Hide live pitch monitor'
                        : 'Show live pitch monitor'
                    }
                  >
                    <svg
                      viewBox="0 0 16 16"
                      width="13"
                      height="13"
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
                </div>

                {/* Room mode — host picks, everyone follows. Roles are derived
                  from the sorted peer list, so nothing is sent but this. */}
                <Show when={jamIsHost()}>
                  <div class={panelStyles.modePicker}>
                    <For each={JAM_MODES}>
                      {(m) => (
                        <button
                          class={panelStyles.modeBtn}
                          classList={{
                            [panelStyles.modeBtnActive]: jamRoomMode() === m.id,
                          }}
                          title={m.blurb}
                          aria-pressed={jamRoomMode() === m.id}
                          onClick={() => selectJamRoomMode(m.id)}
                        >
                          {m.label}
                        </button>
                      )}
                    </For>
                  </div>
                </Show>

                {/* Say it plainly. Everything on screen is real UI, but the
                  peers are invented -- letting someone believe a stranger
                  joined their preview would be worse than not previewing. */}
                <Show when={jamSignalingIsMocked()}>
                  <div class={panelStyles.previewChip} role="note">
                    Preview room — these peers are not real
                  </div>
                </Show>

                {/* Which part is mine, once the room is actually split. */}
                <Show when={!jamMyRole().isUnison}>
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
                  {pickerBody()}
                </div>
              </Show>
              <Sheet
                isOpen={showExercisePicker() && isNarrow()}
                close={() => setShowExercisePicker(false)}
                ariaLabel="Choose a song or a drill"
                snap="tall"
              >
                <div class={panelStyles.pickSheet}>{pickerBody()}</div>
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
                    [panelStyles.pitchStripCollapsed]: !showLivePitch(),
                  }}
                >
                  <Show when={showLivePitch()}>
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
