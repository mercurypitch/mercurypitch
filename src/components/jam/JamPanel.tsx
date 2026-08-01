// ── JamPanel ────────────────────────────────────────────────────────
// Main jam session UI — tabless layout with collapsible sidebar.

import type { Component } from 'solid-js'
import { createEffect, createMemo, createSignal, For, onMount, Show, } from 'solid-js'
import { MicInsightHint } from '@/components/MicInsightHint'
import type { WeeklyChallenge } from '@/features/challenges/weekly-service'
import { getActiveWeekly } from '@/features/challenges/weekly-service'
import { useMicInsights } from '@/features/mic-feedback/useMicInsights'
import { activePathWeek } from '@/features/path/path-progress'
import { jamAscentEntries, jamExerciseEntries, jamMelodyEntries, jamWeeklyEntry, } from '@/lib/jam/jam-catalog'
import { JAM_MODES, jamModeInfo } from '@/lib/jam/jam-modes'
import { buildPeerColorMap } from '@/lib/jam/peer-colors'
import { createJamRoom, getJamSessionInfo, jamConnectedPeers, jamError, jamExerciseBpm, jamExerciseLoop, jamExerciseMelody, jamExercisePlaying, jamGetInputLevel, jamIsHost, jamIsMuted, jamLocalPitch, jamMyRole, jamOwnRunScore, jamPeerId, jamPeers, jamRoomAlpha, jamRoomId, jamRoomMode, jamRoomToJoin, jamState, jamVideoEnabled, joinJamRoom, leaveJamRoom, selectJamExercise, selectJamRoomMode, setJamExerciseBpm, setJamExerciseLoop, setJamRoomAlpha, setJamRoomToJoin, startJamPitchDetection, toggleJamMute, toggleJamVideo, } from '@/stores/jam-store'
import { getMelodyLibrarySignal } from '@/stores/melody-store'
import { VOCAL_RANGES, vocalRangePreset } from '@/stores/settings-store'
import jamStyles from './Jam.module.css'
import { JamActivityHeatmap } from './JamActivityHeatmap'
import { JamCameraWidget } from './JamCameraWidget'
import { JamChatWidget } from './JamChatWidget'
import { JamExerciseCanvas } from './JamExerciseCanvas'
import exerciseCanvasStyles from './JamExerciseCanvas.module.css'
import { JamExerciseControls } from './JamExerciseControls'
import { JamInviteModal } from './JamInviteModal'
import panelStyles from './JamPanel.module.css'
import { JamPeerList } from './JamPeerList'
import { JamPitchDisplay } from './JamPitchDisplay'
import { JamSharedPitchCanvas } from './JamSharedPitchCanvas'
import pitchCanvasStyles from './JamSharedPitchCanvas.module.css'

export const JamPanel: Component = () => {
  const [displayName, setDisplayName] = createSignal('')
  const [joinRoomId, setJoinRoomId] = createSignal('')
  const [showInvite, setShowInvite] = createSignal(false)
  const [joining, setJoining] = createSignal(false)
  const [showExercisePicker, setShowExercisePicker] = createSignal(false)
  const [showAbout, setShowAbout] = createSignal(false)
  const [linkCopied, setLinkCopied] = createSignal(false)
  const [sidebarOpen, setSidebarOpen] = createSignal(false)
  const [showLivePitch, setShowLivePitch] = createSignal(true)

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
    // 1. SessionStorage auto-rejoin (highest priority -- preserves host)
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

  createEffect(() => {
    if (jamState() === 'active') {
      startJamPitchDetection()
      // Auto-select the first available melody if none is loaded yet, prioritizing the vocal range default scale
      if (jamExerciseMelody() === null) {
        const lib = getMelodyLibrarySignal()()
        const defaultOctave = VOCAL_RANGES[vocalRangePreset()].defaultOctave
        const defaultMelodyId = `scale-major-c${defaultOctave}`
        const defaultMelody =
          lib.melodies[defaultMelodyId] ??
          lib.melodies['scale-major-c3'] ??
          melodyOptions()[0]
        if (defaultMelody !== undefined) selectJamExercise(defaultMelody)
      }
    }
  })

  const melodyOptions = createMemo(() => {
    const lib = getMelodyLibrarySignal()()
    return Object.values(lib.melodies)
  })

  // This week's challenge, fetched once the room is live. Null covers both
  // "no API configured" and "no challenge running" -- the shelf just does
  // not render, which is why the fetch never needs an error branch.
  const [weekly, setWeekly] = createSignal<WeeklyChallenge | null>(null)

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

  const handleJoin = () => {
    const roomId = joinRoomId().trim().toUpperCase()
    if (!roomId) return
    setJoining(true)
    const name = displayName().trim() || getRandomName()
    joinJamRoom(roomId, name).finally(() => setJoining(false))
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
          {/* ── Collapsible sidebar ────────────────────────────── */}
          <div
            class={`${panelStyles.sidebar} ${sidebarOpen() ? panelStyles.sidebarOpen : ''}`}
          >
            <div class={panelStyles.sidebarInner}>
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
                <div class={panelStyles.titleRow}>
                  <h2 class={jamStyles.title}>Jam {fancyRoomName()}</h2>
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
                </div>
                {/* The room code stays visible -- people read it aloud.
                    Copying the link is the one action worth a button here;
                    the invite modal (the icon on the right) has the rest. */}
                <div class={panelStyles.roomIdRow}>
                  <span class={jamStyles.roomIdBadge}>{jamRoomId()}</span>
                  <button
                    class={`${jamStyles.btn} ${jamStyles.btnSm}`}
                    onClick={() => {
                      navigator.clipboard.writeText(roomLink()).catch(() => {})
                      setLinkCopied(true)
                      setTimeout(() => setLinkCopied(false), 2000)
                    }}
                  >
                    {linkCopied() ? 'Copied!' : 'Copy link'}
                  </button>
                </div>
              </div>
              <div class={jamStyles.roomActions}>
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

                {/* Microphone toggle */}
                <button
                  class={`${jamStyles.iconBtn} ${jamIsMuted() ? jamStyles.iconBtnOff : jamStyles.iconBtnOn}`}
                  onClick={toggleJamMute}
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
                      <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
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
            <div class={panelStyles.exerciseBar}>
              {/* Live pitch toggle — always reachable on the left */}
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
              <JamExerciseControls
                onSelectExercise={() =>
                  setShowExercisePicker(!showExercisePicker())
                }
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
                      if (!isNaN(v) && v >= 20 && v <= 300) setJamExerciseBpm(v)
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

            {/* Exercise picker dropdown — shelved by where it came from */}
            <Show when={showExercisePicker()}>
              <div class={panelStyles.exercisePicker}>
                <For each={pickerShelves()}>
                  {(shelf) => (
                    <Show when={shelf.entries.length > 0}>
                      <div class={panelStyles.pickShelf}>
                        <div class={panelStyles.pickShelfLabel}>
                          {shelf.label}
                        </div>
                        <For each={shelf.entries}>
                          {(entry) => (
                            <button
                              class={panelStyles.pickItem}
                              onClick={() => {
                                selectJamExercise(entry.build())
                                setShowExercisePicker(false)
                              }}
                            >
                              <span class={panelStyles.pickName}>
                                {entry.name}
                              </span>
                              <span class={panelStyles.pickMeta}>
                                {entry.detail}
                              </span>
                            </button>
                          )}
                        </For>
                      </div>
                    </Show>
                  )}
                </For>
              </div>
            </Show>

            {/* ── Canvases: exercise (main) + shared pitch (strip) ─ */}
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
        <JamCameraWidget />
        <JamChatWidget />
      </Show>
    </div>
  )
}
