// ============================================================
// UVR Panel - Unified Vocal Separation Interface
// ============================================================

import type { Component } from 'solid-js'
import { batch, createEffect, createSignal, For, lazy, onCleanup, Show, Suspense, } from 'solid-js'
import { FancyDivider } from '@/components/shared'
import { exportAllSessions, exportGroup, exportSession, importSessionsFromZip, } from '@/db/services/session-export-service'
import { deleteAllUvrSessionsFromDb, deleteUvrSessionFromDb, findSessionByFileHash, getOriginalFileBlob, getStemBlobUrl, hydrateStemUrls, saveStemBlob, saveStemFingerprintData, } from '@/db/services/uvr-service'
import { computeFileHash } from '@/lib/file-hash'
import { fuzzyScore } from '@/lib/fuzzy-match'
import { generateVocalMidi } from '@/lib/midi-generator'
import { addStemFingerprint } from '@/lib/shazam/melody-fingerprints'
import { extractStemFingerprint } from '@/lib/shazam/stem-fingerprinter'
import type { LivePitchContour, MatchCandidate } from '@/lib/shazam/types'
import { createPersistedSignal } from '@/lib/storage'
import { getProcessStatus } from '@/lib/uvr-api'
import { cancelUvrPipeline, destroyPipeline, getActiveProvider, preInitModel, runUvrPipeline, } from '@/lib/uvr-processing-pipeline'
import type { UvrProcessingMode, UvrSession } from '@/stores/app-store'
import { cancelUvrSession, completeUvrSession, createGroup, currentUvrSession, deleteAllUvrSessions, deleteUvrSession, getAllUvrSessions, getAllUvrSessionsReactive, getGroupsReactive, getUvrProcessingMode, getUvrSession, getUvrSessionByHash, isSessionStoreReady, retryUvrSession, saveAllUvrSessions, setCurrentUvrSession, setErrorUvrSession, setUvrForceWebGpu, setUvrProcessingMode, startUvrSession, updateUvrSessionOutputs, uvrForceWebGpu, uvrModelError, uvrModelStatus, uvrProcessingMode, } from '@/stores/app-store'
import { advance, currentIndex, currentSong, isPlaylistActive, phase, } from '@/stores/karaoke-playlist-store'
import { showNotification } from '@/stores/notifications-store'
import { karaokeFocus } from '@/stores/ui-store'
import { KaraokePlaylistGallery, SessionGroupTabs, StemMixer, UvrGuide, UvrProcessControl, UvrResultViewer, UvrSessionResult, UvrSettings, UvrStemUploadControl, UvrUploadControl, } from '.'
import { CheckCircle, ChevronDown, ChevronUp, Cpu, ExportFile, ExportGroup, ImportFile, Music, Search, Settings, SingMic, Trash2, X, Zap, } from './icons'

const ShazamListen = lazy(async () =>
  import('@/components/ShazamListen').then((m) => ({
    default: m.ShazamListen,
  })),
)
const ShazamResults = lazy(async () =>
  import('@/components/ShazamResults').then((m) => ({
    default: m.ShazamResults,
  })),
)

export type UvrView =
  | 'upload'
  | 'processing'
  | 'results'
  | 'mixer'
  | 'shazam-listen'
  | 'shazam-results'

interface UvrPanelProps {
  /** Initial view from hash route — only used on first mount */
  initialView?: UvrView
  /** Initial session ID from hash route — loads session and navigates to results on mount */
  initialSessionId?: string
  /** Called when the active UVR session changes — used to sync URL hash */
  onSessionChange?: (sessionId: string | null) => void
  /** Called when the current view changes — used to sync URL hash */
  onViewChange?: (view: UvrView) => void
  /** Callback when practice is started */
  onPracticeStart?: (mode: 'vocal' | 'instrumental' | 'midi' | 'full') => void
  /** Callback when a session is exported */
  onExport?: (
    type: 'vocal' | 'instrumental' | 'vocal-midi' | 'instrumental-midi',
  ) => void
  /** Callback when session is viewed */
  onSessionView?: (sessionId: string) => void
  /** Callback to close panel */
  onClose?: () => void
  /** Callback when a melody is selected from Shazam results */
  onSelectMelody?: (melodyId: string) => void
  /** Callback when a stem match auto-jumps to Stem Mixer */
  onOpenStemMixer?: (sessionId: string) => void
  /** Auto-jump confidence threshold for stem matches (default 85) */
  autoJumpThreshold?: number
}

export const UvrPanel: Component<UvrPanelProps> = (props) => {
  // Note: 'mixer' is excluded from the initial value because it requires stems
  // to be populated first (async hydration). handleSessionView sets 'mixer'
  // after the stems are ready.
  const [currentView, setCurrentView] = createSignal<UvrView>(
    props.initialView === 'mixer' ? 'upload' : props.initialView || 'upload',
  )
  const [matchCandidates, setMatchCandidates] = createSignal<MatchCandidate[]>(
    [],
  )
  const [lastContour, setLastContour] = createSignal<LivePitchContour | null>(
    null,
  )
  const [hummingNormalized, setHummingNormalized] = createSignal(false)
  const [stemDenoise, setStemDenoise] = createSignal(
    localStorage.getItem('pitchperfect_stem_denoise') !== 'false',
  )
  const [_onError, setOnError] = createSignal('')

  // Error handling
  const showError = (message: string) => {
    console.error(message)
    setOnError(message)
  }

  // Extract and index stem fingerprint from vocal stem audio
  const indexStemFingerprint = async (
    sessionId: string,
    originalFileName: string,
  ) => {
    setFingerprintingSession(sessionId)
    try {
      const vocalUrl = await getStemBlobUrl(sessionId, 'vocal')
      if (vocalUrl === null) {
        setFingerprintingSession('')
        return
      }

      const response = await fetch(vocalUrl)
      const arrayBuffer = await response.arrayBuffer()
      const audioCtx = new AudioContext()
      const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer)
      await audioCtx.close()

      const denoise = stemDenoise()
      const fp = await extractStemFingerprint(
        audioBuffer,
        { sessionId, originalFileName },
        denoise ? undefined : { maxGapSec: 0.3, minDurationSec: 0.04 },
      )

      if ('reason' in fp) {
        console.warn('[shazam] stem fingerprint skipped:', fp.reason)
        setFingerprintingSession('')
        return
      }

      await saveStemFingerprintData(sessionId, fp)
      addStemFingerprint(fp)
    } catch (err) {
      console.warn('[shazam] stem fingerprint extraction failed:', err)
    } finally {
      setFingerprintingSession('')
    }
  }
  const [showGuide, setShowGuide] = createSignal(false)
  const [showSettings, setShowSettings] = createSignal(false)
  const [showClearStorageConfirm, setShowClearStorageConfirm] =
    createSignal(false)

  // Close modals on Escape key
  createEffect(() => {
    if (showSettings() || showGuide() || showClearStorageConfirm()) {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          if (showSettings()) setShowSettings(false)
          if (showGuide()) setShowGuide(false)
          if (showClearStorageConfirm()) setShowClearStorageConfirm(false)
        }
      }
      window.addEventListener('keydown', handleKeyDown)
      onCleanup(() => window.removeEventListener('keydown', handleKeyDown))
    }
  })
  const [deleteAllToast, setDeleteAllToast] = createSignal('')
  const [fingerprintingSession, setFingerprintingSession] = createSignal('')
  const [midiExporting, setMidiExporting] = createSignal(false)
  const [midiExportProgress, setMidiExportProgress] = createSignal(0)
  const [selectedFile, setSelectedFile] = createSignal<File | null>(null)
  const [prevView, setPrevView] = createSignal<UvrView>('upload')
  const [isExporting, setIsExporting] = createSignal(false)
  const [exportProgress, setExportProgress] = createSignal(0)
  const [isImporting, setIsImporting] = createSignal(false)
  const [activeGroupId, setActiveGroupId] = createSignal<string | null>(null)
  const [sessionSearch, setSessionSearch] = createSignal('')
  const [sessionGalleryOpen, setSessionGalleryOpen] = createPersistedSignal(
    'uvr-session-gallery-open',
    true,
  )
  const [importFile, setImportFile] = createSignal<File | null>(null)
  const [showImportGroupSelect, setShowImportGroupSelect] = createSignal(false)
  const [importTargetGroupId, setImportTargetGroupId] = createSignal<
    string | null
  >(null)
  const [newImportGroupName, setNewImportGroupName] = createSignal('')
  const [importGroupCreating, setImportGroupCreating] = createSignal(false)

  const handleExportAll = async () => {
    if (isExporting()) return
    setIsExporting(true)
    setExportProgress(0)
    try {
      await exportAllSessions((pct) => setExportProgress(pct))
      setExportProgress(100)
      await new Promise((r) => setTimeout(r, 1500))
      showNotification('All sessions successfully exported.', 'success')
    } finally {
      setIsExporting(false)
    }
  }

  const handleImportZip = async (e: Event) => {
    const input = e.target as HTMLInputElement
    const file = input.files?.[0]
    if (!file) return

    // Store file and show group selection dialog
    setImportFile(file)
    setImportTargetGroupId(null)
    setShowImportGroupSelect(true)
    input.value = ''
  }

  const handleConfirmImport = async () => {
    const file = importFile()
    if (!file) return

    setShowImportGroupSelect(false)
    setIsImporting(true)
    showNotification('Extracting sessions from ZIP...', 'info')
    try {
      const count = await importSessionsFromZip(
        file,
        importTargetGroupId() ?? undefined,
      )
      showNotification(`Successfully imported ${count} session(s).`, 'success')
    } catch (_err) {
      showNotification('Failed to import sessions.', 'error')
    } finally {
      setIsImporting(false)
      setImportFile(null)
    }
  }

  const handleCreateImportGroup = async () => {
    const name = newImportGroupName().trim()
    if (name === '') return
    setImportGroupCreating(true)
    try {
      const group = await createGroup(name)
      setImportTargetGroupId(group.id)
      setNewImportGroupName('')
      // Trigger the import immediately after creating the group
      await handleConfirmImport()
    } finally {
      setImportGroupCreating(false)
    }
  }

  const [mixerStems, setMixerStems] = createSignal<{
    vocal?: string
    vocalMidi?: string
    instrumental?: string
  }>({})
  const [mixerSessionId, setMixerSessionId] = createSignal('')
  // Bumped once per successful playlist-song load to key the StemMixer remount.
  const [mixerLoadToken, setMixerLoadToken] = createSignal(0)
  const [mixerPracticeMode, setMixerPracticeMode] = createSignal<
    'vocal' | 'instrumental' | 'full' | 'midi'
  >('full')
  const [mixerRequestedStems, setMixerRequestedStems] = createSignal<{
    vocal?: boolean
    instrumental?: boolean
    midi?: boolean
  }>()
  const [mixerInitialSeekSec, setMixerInitialSeekSec] = createSignal<
    number | undefined
  >(undefined)
  const [mixerAutoPlay, setMixerAutoPlay] = createSignal(false)

  // Computed session state
  const session = () => currentUvrSession()
  const allSessions = () => getAllUvrSessionsReactive()
  const filteredSessions = () => {
    const sessions = allSessions()
    const query = sessionSearch().trim()
    if (query !== '') {
      // While searching, look across all groups so a song is findable
      // regardless of which group it's in; rank best matches first.
      return sessions
        .map((s) => ({
          s,
          score: fuzzyScore(query, s.originalFile?.name ?? ''),
        }))
        .filter((x) => x.score > 0)
        .sort((a, b) => b.score - a.score)
        .map((x) => x.s)
    }
    const groupId = activeGroupId()
    if (groupId == null) return sessions
    return sessions.filter((s) => s.groupId === groupId)
  }

  const handleForceWebGpuToggle = (force: boolean) => {
    setUvrForceWebGpu(force)
    // Destroy pipeline and re-init immediately
    destroyPipeline()
    void preInitModel()
      .then(() => {
        const activeProvider = getActiveProvider()
        if (force && activeProvider === 'wasm') {
          // WebGPU failed to initialize, fallback to WASM
          setUvrForceWebGpu(false)
          showNotification(
            'WebGPU initialization failed. Falling back to CPU processing.',
            'warning',
          )
        }
      })
      .catch((err) => {
        console.error('[UvrPanel] failed to re-init model:', err)
      })
  }

  // Pre-initialize ONNX model when switching to browser mode
  // Skip in E2E test mode — model files are unavailable in test environments
  createEffect(() => {
    if (
      (window as unknown as Record<string, unknown>)['E2E_TEST_MODE'] === true
    )
      return
    const mode = uvrProcessingMode()
    if (mode === 'local' && uvrModelStatus() === 'unloaded') {
      void preInitModel()
        .then(() => {
          const activeProvider = getActiveProvider()
          if (uvrForceWebGpu() && activeProvider === 'wasm') {
            setUvrForceWebGpu(false)
            showNotification(
              'WebGPU initialization failed. Falling back to CPU processing.',
              'warning',
            )
          }
        })
        .catch((err) => {
          console.error('[UvrPanel] preInitModel failed:', err)
        })
    }
  })

  // Clean up separator when switching away from local mode
  createEffect(() => {
    const mode = uvrProcessingMode()
    if (mode === 'server' && uvrModelStatus() !== 'unloaded') {
      destroyPipeline()
    }
  })

  // React to initialView prop changes (from hash navigation)
  // Note: 'mixer' is excluded here because the mixer view requires stems
  // to be populated first (async hydration). handleSessionView handles
  // setting both the stems AND the view together.
  let lastInitialView: UvrView | null = null
  createEffect(() => {
    const v = props.initialView
    console.log('[UvrPanel] initialView effect:', v, 'last:', lastInitialView)
    if (v && v !== lastInitialView && v !== 'mixer') {
      lastInitialView = v
      console.log('[UvrPanel] initialView -> setCurrentView:', v)
      setCurrentView(v)
    }
  })

  // Sync active session and view to parent (for URL hash)
  createEffect(() => {
    const view = currentView()
    props.onViewChange?.(view)
    if (view === 'results' || view === 'mixer') {
      const s = currentUvrSession()
      if (s?.sessionId !== undefined) {
        props.onSessionChange?.(s.sessionId)
        return
      }
    }
    props.onSessionChange?.(null)
  })

  // Deep-link: navigate to session from hash route (reactive to URL changes)
  let lastLoadedSessionId: string | null = null
  createEffect(() => {
    const sid = props.initialSessionId
    const ready = isSessionStoreReady()
    console.log(
      '[UvrPanel] session deep-link effect: sid=',
      sid,
      'ready=',
      ready,
      'last=',
      lastLoadedSessionId,
    )
    if (!ready) return
    // While a karaoke playlist drives the mixer it owns the session + view.
    // Each song updates the URL hash (via onSessionChange), which feeds back
    // here as initialSessionId — don't let that re-trigger handleSessionView,
    // which would re-hydrate the session and flip the view to 'results'.
    if (isPlaylistActive()) {
      lastLoadedSessionId = sid ?? lastLoadedSessionId
      return
    }
    if (sid !== undefined && sid !== lastLoadedSessionId) {
      lastLoadedSessionId = sid
      console.log('[UvrPanel] calling handleSessionView for:', sid)
      handleSessionView(sid)
    }
  })

  // Cache to avoid pulling 30MB+ blobs from IndexedDB multiple times per page load
  const locallyHydratedSessions = new Set<string>()

  // Hydrate stale blob URLs from IndexedDB for local-mode completed sessions
  const ensureHydrated = async (session: UvrSession): Promise<UvrSession> => {
    if (session.processingMode === 'local' && session.status === 'completed') {
      if (locallyHydratedSessions.has(session.sessionId)) {
        return session
      }

      if (session.outputs?.vocal?.startsWith('blob:') === true) {
        try {
          const res = await fetch(session.outputs.vocal, { method: 'HEAD' })
          if (res.ok) {
            locallyHydratedSessions.add(session.sessionId)
            return session
          }
        } catch {
          // fetch failed, blob is dead
        }
      }

      const urls = await hydrateStemUrls(session.sessionId)
      if (urls) {
        locallyHydratedSessions.add(session.sessionId)
        return { ...session, outputs: { ...session.outputs, ...urls } }
      }
    }
    return session
  }

  // ── Karaoke playlist runner ──────────────────────────────────
  // When the playlist arms a song ('ready'), hydrate its stems into the mixer
  // and show the mixer view. The StemMixer remounts per song via mixerLoadToken,
  // which is bumped only once the correct stems are in place — so the mixer
  // never reuses a previous (already-ended) instance or loads stale stems.
  let loadingPlaylistSong: string | null = null

  const loadPlaylistSong = async (sessionId: string) => {
    const session = getUvrSession(sessionId)
    if (!session) {
      showNotification('Karaoke: song unavailable, skipping…', 'warning')
      advance()
      return
    }
    const hydrated = await ensureHydrated(session)
    // A newer skip may have superseded this (async) load — bail if this song is
    // no longer the current one, so we don't clobber the mixer out of order.
    if (currentSong()?.sessionId !== sessionId) return
    // Persist freshly-hydrated stem URLs back into the session cache. Otherwise
    // revisiting this song (prev/next) re-reads the cached session, whose blob:
    // URLs are dead after a reload, and the stems fail to load — so the song
    // won't play. (handleSessionView does the same for single-session opens.)
    if (hydrated !== session) {
      const all = getAllUvrSessions()
      const idx = all.findIndex((s) => s.sessionId === sessionId)
      if (idx !== -1) {
        all[idx] = {
          ...all[idx],
          outputs: { ...all[idx].outputs, ...hydrated.outputs },
        }
        saveAllUvrSessions(all)
      }
    }
    batch(() => {
      setCurrentUvrSession(hydrated)
      setPrevView('results')
      setMixerPracticeMode('full')
      setMixerStems({
        vocal: hydrated.outputs?.vocal,
        instrumental: hydrated.outputs?.instrumental,
      })
      setMixerRequestedStems({ vocal: true, instrumental: true })
      setMixerSessionId(hydrated.sessionId)
      setMixerInitialSeekSec(undefined)
      setMixerAutoPlay(false)
      setCurrentView('mixer')
      // Bump last so the remount happens with everything already in place.
      setMixerLoadToken((t) => t + 1)
    })
  }

  createEffect(() => {
    const song = currentSong()
    if (!isPlaylistActive() || !song || phase() !== 'ready') return
    // Re-load whenever the (index, song) changes — revisiting a song replays it.
    const key = `${currentIndex()}:${song.sessionId}`
    if (loadingPlaylistSong === key) return
    loadingPlaylistSong = key
    void loadPlaylistSong(song.sessionId)
  })

  const handleFileSelect = async (file: File) => {
    setSelectedFile(file)

    // Compute file hash for dedup
    const hash = await computeFileHash(file)

    // Check localStorage first for a completed session with this hash
    const existing = getUvrSessionByHash(hash)
    if (existing) {
      const hydrated = await ensureHydrated(existing)
      setCurrentUvrSession(hydrated)
      setCurrentView('results')
      showNotification(
        'This file was already processed — loaded existing stems.',
        'info',
      )
      return
    }

    // Check IndexedDB for persisted sessions with this hash
    const dbMatch = await findSessionByFileHash(hash)
    if (dbMatch) {
      const stored = getUvrSession(dbMatch.sessionId)
      if (stored && stored.status === 'completed') {
        const hydrated = await ensureHydrated(stored)
        setCurrentUvrSession(hydrated)
        setCurrentView('results')
        showNotification(
          'This file was already processed — loaded existing stems.',
          'info',
        )
        return
      }
    }

    const mode = getUvrProcessingMode()
    const sessionId = startUvrSession(
      file.name,
      file.size,
      file.type,
      'separate',
      mode,
      hash,
    )
    setCurrentView('processing')
    handleProcessStart(sessionId, mode)
  }

  const handleProcessStart = async (
    sessionId: string,
    mode?: UvrProcessingMode,
  ) => {
    let file = selectedFile()
    if (!file) {
      // Retry path: original file is no longer in memory, load from IndexedDB
      file = await getOriginalFileBlob(sessionId)
    } else {
      // Initial path: file is in memory, save it to IndexedDB immediately
      // so it's not lost if the session is interrupted or page reloaded
      void saveStemBlob(sessionId, 'original', file, file.name).catch(() => {})
    }
    if (!file) {
      const msg = 'File lost from memory. Please start a new session.'
      console.error(msg)
      setErrorUvrSession(sessionId, msg)
      showNotification(msg, 'warning')
      return
    }

    const processingMode = mode ?? getUvrProcessingMode()

    // Set session to processing status (immutable update via store API)
    const session = getUvrSession(sessionId)
    if (session) {
      const updated = { ...session, status: 'processing' as const }
      saveAllUvrSessions(
        getAllUvrSessions().map((s) =>
          s.sessionId === sessionId ? updated : s,
        ),
      )
      setCurrentUvrSession(updated)
    }

    try {
      await runUvrPipeline(file, sessionId, processingMode, {
        onProgress: (_pct) => {
          // Progress already updated inside the pipeline via updateUvrSessionProgress
        },
        onComplete: (result) => {
          completeUvrSession(sessionId, result.outputs, result.stemMeta)
          // Auto-extract stem fingerprint for Shazam matching
          // Delay slightly to ensure heavy WebGPU/WASM thread yields before doing AudioContext work
          setTimeout(() => {
            void indexStemFingerprint(sessionId, file.name)
          }, 500)
          setCurrentView('results')
        },
        onError: (message) => {
          setErrorUvrSession(sessionId, message)
          showError(message)
        },
      })
    } catch (error) {
      console.error('Processing error:', error)
      const message =
        error instanceof Error ? error.message : 'Processing failed'
      setErrorUvrSession(sessionId, message)
      showNotification(message, 'error')
    }
  }

  const handleExport = async (
    type: 'vocal' | 'instrumental' | 'vocal-midi' | 'instrumental-midi',
  ) => {
    const s = session()
    if (!s?.outputs) return

    const url =
      type === 'vocal'
        ? s.outputs.vocal
        : type === 'instrumental'
          ? s.outputs.instrumental
          : type === 'vocal-midi'
            ? s.outputs.vocalMidi
            : s.outputs.instrumentalMidi

    if (url === undefined) return

    try {
      let blob: Blob
      const ext = type.includes('midi') ? '.mid' : '.wav'

      if (
        type === 'vocal-midi' &&
        (url === '' || url === undefined) &&
        s.outputs.vocal !== undefined
      ) {
        // Generate MIDI on-the-fly from vocal stem
        setMidiExporting(true)
        setMidiExportProgress(0)
        const midiBlob = await generateVocalMidi(s.outputs.vocal, (pct) =>
          setMidiExportProgress(pct),
        )
        setMidiExporting(false)
        if (!midiBlob) {
          console.error('MIDI generation produced no notes')
          return
        }
        blob = midiBlob
      } else {
        const resp = await fetch(url)
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
        blob = await resp.blob()
      }

      const blobUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = blobUrl
      const base = (s.originalFile?.name ?? 'audio')
        .replace(/\.[^.]+$/, '')
        .replace(/\s+/g, '_')
        .replace(/[^a-zA-Z0-9_-]/g, '')
      a.download = `${base}_${type.replace('-', '_')}${ext}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000)
    } catch (err) {
      setMidiExporting(false)
      console.error('Download failed:', err)
    }
    props.onExport?.(type)
  }

  const handleSessionView = async (sessionId: string) => {
    console.log(
      '[UvrPanel] handleSessionView called for:',
      sessionId,
      'initialView:',
      props.initialView,
    )
    if (props.onSessionView) {
      props.onSessionView(sessionId)
    }
    const session = getUvrSession(sessionId)
    console.log(
      '[UvrPanel] getUvrSession result:',
      session ? 'found' : 'NOT FOUND',
      'status:',
      session?.status,
      'outputs:',
      session?.outputs ? Object.keys(session.outputs) : 'none',
    )
    if (!session) {
      console.log('[UvrPanel] session not found, falling back to results')
      setCurrentView('results')
      return
    }
    // Refresh outputs from API if we have an API session ID
    if (session.apiSessionId !== undefined && session.status === 'completed') {
      refreshSessionOutputs(session)
    }
    // Hydrate blob URLs from IndexedDB before showing results
    // (blob: URLs from localStorage are dead after page reload)
    const hydrated = await ensureHydrated(session)
    console.log(
      '[UvrPanel] hydrated outputs:',
      hydrated.outputs ? Object.keys(hydrated.outputs) : 'none',
      'vocal:',
      hydrated.outputs?.vocal?.substring(0, 40),
      'inst:',
      hydrated.outputs?.instrumental?.substring(0, 40),
    )
    setCurrentUvrSession(hydrated)
    // Persist the hydrated URLs to localStorage
    if (hydrated !== session) {
      const all = getAllUvrSessions()
      const idx = all.findIndex((s) => s.sessionId === sessionId)
      if (idx !== -1) {
        all[idx] = {
          ...all[idx],
          outputs: { ...all[idx].outputs, ...hydrated.outputs },
        }
        saveAllUvrSessions(all)
      }
    }

    if (hydrated.status === 'processing') {
      setCurrentView('processing')
    } else {
      // Respect the initial view from the URL hash (e.g. /mixer deep link)
      const targetView = props.initialView === 'mixer' ? 'mixer' : 'results'
      console.log(
        '[UvrPanel] targetView:',
        targetView,
        'outputs != null:',
        hydrated.outputs != null,
      )

      // When deep-linking directly to mixer, populate the mixer state
      // just like handlePracticeStart does for 'full' mode
      if (targetView === 'mixer' && hydrated.outputs != null) {
        console.log('[UvrPanel] populating mixer stems for deep-link')
        setPrevView('results')
        setMixerPracticeMode('full')
        setMixerSessionId(hydrated.sessionId)
        setMixerStems({
          vocal: hydrated.outputs.vocal,
          instrumental: hydrated.outputs.instrumental,
        })
        setMixerRequestedStems({ vocal: true, instrumental: true })
      }

      console.log('[UvrPanel] setCurrentView:', targetView)
      setCurrentView(targetView)
    }
  }

  const handlePracticeStart = async (
    mode: 'vocal' | 'instrumental' | 'midi' | 'full',
  ) => {
    const current = currentUvrSession()
    if (!current?.outputs && !current?.stemMeta) return
    const s = await ensureHydrated(current)

    setCurrentUvrSession(s)
    setPrevView(currentView())
    setMixerPracticeMode(mode)
    setMixerSessionId(s.sessionId)

    // Set stems and requestedStems based on mode
    if (mode === 'vocal') {
      setMixerStems({ vocal: s.outputs?.vocal })
      setMixerRequestedStems({ vocal: true })
    } else if (mode === 'instrumental') {
      setMixerStems({ instrumental: s.outputs?.instrumental })
      setMixerRequestedStems({ instrumental: true })
    } else if (mode === 'midi') {
      // MIDI generation needs vocal audio — always include vocal URL
      setMixerStems({ vocal: s.outputs?.vocal })
      setMixerRequestedStems({ midi: true })
    } else {
      // full: vocal + instrumental
      setMixerStems({
        vocal: s.outputs?.vocal,
        instrumental: s.outputs?.instrumental,
      })
      setMixerRequestedStems({ vocal: true, instrumental: true })
    }
    setCurrentView('mixer')

    if (props.onPracticeStart) {
      props.onPracticeStart(mode)
    }
  }

  const handleMixStart = async (selectedStems: string[]) => {
    const current = currentUvrSession()
    if (!current?.outputs && !current?.stemMeta) return
    const s = await ensureHydrated(current)

    setCurrentUvrSession(s)
    setPrevView(currentView())
    setMixerSessionId(s.sessionId)

    const stemUrls: { vocal?: string; instrumental?: string } = {}
    const requested: {
      vocal?: boolean
      instrumental?: boolean
      midi?: boolean
    } = {}

    for (const key of selectedStems) {
      if (key === 'vocal') {
        stemUrls.vocal = s.outputs?.vocal
        requested.vocal = true
      } else if (key === 'instrumental') {
        stemUrls.instrumental = s.outputs?.instrumental
        requested.instrumental = true
      } else if (key === 'vocalMidi') {
        // MIDI needs the vocal audio to generate from
        stemUrls.vocal = s.outputs?.vocal
        requested.midi = true
      }
    }

    setMixerStems(stemUrls)
    setMixerRequestedStems(requested)
    setMixerPracticeMode('full')
    setCurrentView('mixer')
  }

  const handleOpenMixerFromHistory = async (
    sessionId: string,
    stems?: { vocal?: boolean; instrumental?: boolean; midi?: boolean },
  ) => {
    const raw = getUvrSession(sessionId)
    if (!raw?.outputs && !raw?.stemMeta) return
    const s = await ensureHydrated(raw)
    if (!s.outputs) return
    setCurrentUvrSession(s)

    setPrevView(currentView())
    const filter = stems || {}
    const wantsMidi = filter.midi === true
    const wantsVocal = filter.vocal !== false
    const wantsInst = filter.instrumental !== false

    // Determine practice mode
    if (Object.keys(filter).length === 0) {
      setMixerPracticeMode('full')
    } else if (wantsMidi && !wantsVocal && !wantsInst) {
      setMixerPracticeMode('midi')
    } else if (wantsMidi) {
      setMixerPracticeMode('midi')
    } else if (wantsVocal && !wantsInst) {
      setMixerPracticeMode('vocal')
    } else if (!wantsVocal && wantsInst) {
      setMixerPracticeMode('instrumental')
    } else {
      setMixerPracticeMode('full')
    }

    // MIDI generation requires vocal audio — always include vocal URL when MIDI is wanted
    setMixerStems({
      vocal: wantsVocal || wantsMidi ? s.outputs.vocal : undefined,
      instrumental: wantsInst ? s.outputs.instrumental : undefined,
    })
    setMixerRequestedStems(
      Object.keys(filter).length > 0
        ? { vocal: wantsVocal, instrumental: wantsInst, midi: wantsMidi }
        : undefined,
    )
    setMixerSessionId(s.sessionId)
    // Reset auto-play unless explicitly set by Shazam match flow
    // (caller should set mixerAutoPlay/mixerInitialSeekSec before calling this)
    setCurrentView('mixer')
  }

  const handleClearStorage = () => {
    deleteAllUvrSessions()
    setShowClearStorageConfirm(false)
    setDeleteAllToast('Storage cleared (all sessions and stems deleted)')
    setTimeout(() => setDeleteAllToast(''), 2500)
    void deleteAllUvrSessionsFromDb()
  }

  // Refresh session outputs from API
  const refreshSessionOutputs = async (sessionToRefresh?: UvrSession) => {
    const sessions = sessionToRefresh
      ? [sessionToRefresh]
      : getAllUvrSessions().filter(
          (s) => s.apiSessionId !== undefined && s.status === 'completed',
        )

    for (const s of sessions) {
      if (s.apiSessionId === undefined || s.apiSessionId === '') continue
      try {
        const status = await getProcessStatus(s.apiSessionId)
        if (status.status === 'completed' && status.files.length > 0) {
          updateUvrSessionOutputs(s.sessionId, status.files)
        }
      } catch {
        // API unavailable — keep stored data
      }
    }

    // Hydrate local-mode sessions from IndexedDB (blob URLs stale after reload)
    const localSessions = sessionToRefresh
      ? [sessionToRefresh].filter(
          (s) => s.processingMode === 'local' && s.status === 'completed',
        )
      : getAllUvrSessions().filter(
          (s) => s.processingMode === 'local' && s.status === 'completed',
        )
    for (const s of localSessions) {
      void hydrateStemUrls(s.sessionId).then((urls) => {
        if (urls) {
          const all = getAllUvrSessions()
          const idx = all.findIndex((x) => x.sessionId === s.sessionId)
          if (idx !== -1) {
            all[idx] = {
              ...all[idx],
              outputs: { ...all[idx].outputs, ...urls },
            }
            saveAllUvrSessions(all)
          }
        }
      })
    }
  }

  return (
    <div class="uvr-panel">
      <div
        class={`uvr-panel-inner ${currentView() !== 'mixer' ? 'bounded' : ''}`}
      >
        {/* Header */}
        <Show when={!karaokeFocus()}>
          <div class="panel-header">
            <div class="header-left">
              <div
                class="header-title-group"
                style="display: flex; align-items: center; gap: 0.5rem;"
              >
                <h3>Shazam Sing</h3>
              </div>
              <div class="uvr-view-tabs" style="margin-left: 0.5rem;">
                <button
                  class="view-tab view-tab-sing"
                  classList={{
                    active: currentView() === 'shazam-listen',
                  }}
                  onClick={() => {
                    setCurrentView('shazam-listen')
                    props.onViewChange?.('shazam-listen')
                    props.onSessionChange?.(null)
                  }}
                  data-testid="uvr-tab-sing"
                >
                  <SingMic />
                  <span>Sing</span>
                </button>
                <button
                  class="view-tab"
                  classList={{
                    active: currentView() === 'upload',
                  }}
                  onClick={() => {
                    setCurrentView('upload')
                    props.onViewChange?.('upload')
                    props.onSessionChange?.(null)
                  }}
                  data-testid="uvr-tab-upload"
                >
                  <ImportFile />
                  <span>Upload</span>
                </button>
              </div>
            </div>
            <div class="header-actions">
              <div class="uvr-mode-toggle">
                <button
                  class={`mode-toggle-btn mode-toggle-btn-disabled${uvrProcessingMode() === 'server' ? ' active' : ''}`}
                  title="Processing: Server"
                  onClick={() =>
                    showNotification(
                      'Server-side processing not yet available.',
                      'info',
                    )
                  }
                >
                  Server
                </button>
                <button
                  class={`mode-toggle-btn${uvrProcessingMode() === 'local' ? ' active' : ''}`}
                  title="Processing: Browser"
                  onClick={() => setUvrProcessingMode('local')}
                >
                  Browser
                </button>
                <Show when={uvrProcessingMode() === 'local'}>
                  <div class="uvr-device-toggle">
                    <button
                      class="device-toggle-btn"
                      classList={{ active: !uvrForceWebGpu() }}
                      onClick={() => handleForceWebGpuToggle(false)}
                      title="Use CPU (WASM) for vocal separation"
                      data-testid="uvr-device-cpu"
                    >
                      <Cpu />
                      <span>CPU</span>
                    </button>
                    <button
                      class="device-toggle-btn"
                      classList={{ active: uvrForceWebGpu() }}
                      onClick={() => handleForceWebGpuToggle(true)}
                      title="Use GPU (WebGPU) for vocal separation"
                      data-testid="uvr-device-gpu"
                    >
                      <Zap />
                      <span>GPU</span>
                    </button>
                  </div>
                </Show>
                <Show
                  when={
                    uvrProcessingMode() === 'local' &&
                    uvrModelStatus() !== 'ready'
                  }
                >
                  <span
                    class={`model-status-badge model-status-${uvrModelStatus()}`}
                    title={
                      uvrModelStatus() === 'error'
                        ? uvrModelError()
                        : uvrModelStatus() === 'loading'
                          ? 'Loading ONNX model...'
                          : ''
                    }
                  >
                    <Show when={uvrModelStatus() === 'loading'}>
                      <span class="model-loading-dot" />
                    </Show>
                    <Show when={uvrModelStatus() === 'error'}>
                      <span class="model-error-icon">!</span>
                    </Show>
                  </span>
                </Show>
              </div>
              <div class="uvr-view-tabs">
                <button
                  class="view-tab"
                  classList={{ active: showGuide() }}
                  onClick={() => setShowGuide(!showGuide())}
                >
                  <Music />
                  <span>Guide</span>
                </button>
                <button
                  class="view-tab"
                  classList={{ active: showSettings() }}
                  onClick={() => setShowSettings(!showSettings())}
                >
                  <Settings />
                  <span>Settings</span>
                </button>
              </div>
            </div>
          </div>

          <FancyDivider class="uvr-header-divider" />
        </Show>

        {/* Main Content */}
        <div class="panel-content">
          {showGuide() && (
            <div class="guide-modal">
              <div class="guide-container">
                <div class="guide-header">
                  <h3>Vocal Separation Guide</h3>
                  <button
                    class="guide-close"
                    onClick={() => setShowGuide(false)}
                  >
                    <X />
                  </button>
                </div>
                <UvrGuide onClose={() => setShowGuide(false)} />
              </div>
            </div>
          )}

          {showSettings() && (
            <div class="guide-modal" onClick={() => setShowSettings(false)}>
              <div class="guide-container" onClick={(e) => e.stopPropagation()}>
                <div class="guide-header">
                  <h3>Karaoke Settings</h3>
                  <button
                    class="guide-close"
                    onClick={() => setShowSettings(false)}
                  >
                    <X />
                  </button>
                </div>
                <UvrSettings
                  stemDenoise={stemDenoise()}
                  onStemDenoiseChange={(v) => setStemDenoise(v)}
                />
              </div>
            </div>
          )}

          <Show when={currentView() === 'upload'}>
            <div class="view-section upload-section" data-testid="uvr-upload">
              <div class="section-header">
                <h4>Upload Audio</h4>
              </div>

              <UvrUploadControl
                onFileSelect={(file) => {
                  void handleFileSelect(file)
                }}
                onFileReady={(file) => setSelectedFile(file)}
                onProcessStart={(file) => {
                  void handleProcessStart(file)
                }}
                processing={session()?.status === 'processing'}
                disabled={allSessions().some((s) => s.status === 'processing')}
              />

              <UvrStemUploadControl
                disabled={allSessions().some((s) => s.status === 'processing')}
              />

              <div class="upload-divider">
                <span class="upload-divider-text">
                  <Show
                    when={allSessions().length > 0}
                    fallback="or import existing sessions"
                  >
                    or continue from existing session
                  </Show>
                </span>
              </div>

              {/* Karaoke playlists gallery (above the session list) */}
              <KaraokePlaylistGallery />

              <div class="section-header">
                <button
                  class="uvr-collapse-toggle"
                  onClick={() => setSessionGalleryOpen((v) => !v)}
                  title={sessionGalleryOpen() ? 'Collapse' : 'Expand'}
                >
                  <Show
                    when={allSessions().length > 0}
                    fallback={<h4>Session Library</h4>}
                  >
                    <h4>Recent Sessions</h4>
                  </Show>
                  <Show
                    when={sessionGalleryOpen()}
                    fallback={<ChevronDown size={18} />}
                  >
                    <ChevronUp />
                  </Show>
                </button>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <Show when={allSessions().length > 0}>
                    <Show
                      when={
                        activeGroupId() != null && filteredSessions().length > 0
                      }
                    >
                      <button
                        class="section-action-btn icon-only"
                        onClick={() => {
                          const gid = activeGroupId()
                          if (gid == null) return
                          setIsExporting(true)
                          setExportProgress(0)
                          void exportGroup(gid, (pct: number) =>
                            setExportProgress(pct),
                          ).finally(() => setIsExporting(false))
                        }}
                        disabled={isExporting()}
                        title="Export this group's sessions to a ZIP file"
                      >
                        <ExportGroup />
                      </button>
                    </Show>
                    <button
                      class="section-action-btn icon-only"
                      onClick={() => void handleExportAll()}
                      disabled={isExporting()}
                      title="Export all sessions to a ZIP file"
                    >
                      <ExportFile />
                    </button>
                  </Show>
                  <label
                    class="section-action-btn icon-only"
                    title="Import sessions from a ZIP file"
                    style={{ cursor: isImporting() ? 'default' : 'pointer' }}
                  >
                    <ImportFile />
                    <input
                      type="file"
                      accept=".zip"
                      style={{ display: 'none' }}
                      onChange={(e) => void handleImportZip(e)}
                      disabled={isImporting()}
                    />
                  </label>
                  <Show when={allSessions().length > 0}>
                    <button
                      class="section-action-btn section-action-btn-danger icon-only"
                      onClick={() => setShowClearStorageConfirm(true)}
                      title="Clear All Sessions & Cache"
                    >
                      <Trash2 />
                    </button>
                  </Show>
                </div>
              </div>

              <Show when={sessionGalleryOpen() && allSessions().length > 0}>
                <div class="uvr-session-search">
                  <Search />
                  <input
                    class="uvr-session-search-input"
                    type="text"
                    placeholder="Search songs by name…"
                    value={sessionSearch()}
                    onInput={(e) => setSessionSearch(e.currentTarget.value)}
                  />
                  <Show when={sessionSearch().trim() !== ''}>
                    <span class="uvr-session-search-count">
                      {filteredSessions().length} found
                    </span>
                    <button
                      class="uvr-session-search-clear"
                      title="Clear search"
                      onClick={() => setSessionSearch('')}
                    >
                      <X />
                    </button>
                  </Show>
                </div>
              </Show>

              <Show
                when={
                  sessionGalleryOpen() &&
                  (allSessions().length > 0 || getGroupsReactive().length > 0)
                }
              >
                <SessionGroupTabs
                  activeGroupId={activeGroupId()}
                  onSelectGroup={setActiveGroupId}
                />
                <div class="history-list history-list-inline">
                  <For
                    each={filteredSessions().sort(
                      (a, b) => b.createdAt - a.createdAt,
                    )}
                  >
                    {(s) => (
                      <UvrSessionResult
                        sessionId={s.sessionId}
                        disabled={allSessions().some(
                          (s) => s.status === 'processing',
                        )}
                        onView={() => {
                          void handleSessionView(s.sessionId)
                        }}
                        onExport={(sessionId) => {
                          if (isExporting()) return
                          setIsExporting(true)
                          setExportProgress(0)
                          void exportSession(sessionId, (pct) =>
                            setExportProgress(pct),
                          ).finally(() => setIsExporting(false))
                        }}
                        onOpenMixer={(sessionId, stems) => {
                          void handleOpenMixerFromHistory(sessionId, stems)
                        }}
                        onRetry={(sessionId) => {
                          retryUvrSession(sessionId)
                          void handleProcessStart(
                            sessionId,
                            getUvrSession(sessionId)?.processingMode,
                          )
                        }}
                        onReindexStem={(sessionId) => {
                          const session = getUvrSession(sessionId)
                          const fileName =
                            session?.originalFile?.name ?? 'Unknown'
                          void indexStemFingerprint(sessionId, fileName)
                        }}
                      />
                    )}
                  </For>
                </div>
              </Show>
            </div>
          </Show>

          <Show when={currentView() === 'processing'}>
            <div class="view-section processing-section">
              <div class="section-header">
                <h4>Processing Audio</h4>
              </div>
              {session() && (
                <UvrProcessControl
                  sessionId={session()!.sessionId}
                  apiSessionId={session()!.apiSessionId}
                  status={session()!.status}
                  progress={session()!.progress}
                  indeterminate={session()!.indeterminate}
                  processingTime={session()!.processingTime}
                  error={session()!.error}
                  processingMode={session()!.processingMode}
                  numChunks={session()!.numChunks}
                  provider={session()!.provider}
                  originalFileName={session()!.originalFile?.name}
                  onCancel={() => {
                    cancelUvrPipeline(
                      session()!.processingMode ?? 'server',
                      session()!.apiSessionId,
                    )
                    cancelUvrSession(session()!.sessionId)
                    setCurrentView('upload')
                  }}
                  onRetry={() => {
                    retryUvrSession(session()!.sessionId)
                    void handleProcessStart(
                      session()!.sessionId,
                      session()!.processingMode,
                    )
                  }}
                  onNewSession={() => setCurrentView('upload')}
                  onDeleteAndNew={() => {
                    deleteUvrSession(session()!.sessionId)
                    void deleteUvrSessionFromDb(session()!.sessionId)
                    setCurrentView('upload')
                  }}
                />
              )}
              <Show when={fingerprintingSession() !== ''}>
                <div
                  style={{
                    display: 'flex',
                    'align-items': 'center',
                    gap: '8px',
                    padding: '10px 14px',
                    background: 'rgba(99, 102, 241, 0.08)',
                    'border-radius': '8px',
                    'font-size': '13px',
                    color: 'var(--color-text-muted, #94a3b8)',
                  }}
                >
                  <span
                    style={{
                      width: '14px',
                      height: '14px',
                      border: '2px solid var(--color-accent, #6366f1)',
                      'border-top-color': 'transparent',
                      'border-radius': '50%',
                      animation: 'spin 0.8s linear infinite',
                      display: 'inline-block',
                    }}
                  />
                  Indexing vocal stem for Shazam matching...
                </div>
              </Show>
            </div>
          </Show>

          <Show when={currentView() === 'results'}>
            <div class="view-section results-section">
              <div class="section-header">
                <h4
                  style={{
                    display: 'flex',
                    'align-items': 'center',
                    'flex-wrap': 'wrap',
                  }}
                >
                  <span
                    class="process-filename-pill"
                    title={session()?.originalFile?.name ?? 'audio'}
                  >
                    {session()?.originalFile?.name ?? 'audio'}
                  </span>
                  <span>results</span>
                </h4>
                <button
                  class="back-btn"
                  onClick={() => setCurrentView('upload')}
                >
                  <ImportFile /> Back to Upload
                </button>
              </div>
              {session() && (
                <UvrResultViewer
                  outputs={session()!.outputs}
                  stemMeta={session()!.stemMeta}
                  processingTime={session()!.processingTime}
                  sessionId={session()!.sessionId}
                  originalFileName={session()?.originalFile?.name}
                  onStartPractice={(mode) => {
                    void handlePracticeStart(mode)
                  }}
                  onStartMix={(stems) => {
                    void handleMixStart(stems)
                  }}
                  onExport={(type) => {
                    void handleExport(type)
                  }}
                />
              )}
            </div>
          </Show>

          {/* Stem Mixer Inline */}
          <Show when={currentView() === 'mixer'}>
            <div class="view-section mixer-section">
              {/* Keyed so each song is a fresh mount — the StemMixer loads
                  stems on mount only. In playlist mode key on mixerLoadToken,
                  which flips only after the new song's stems are in place. */}
              <Show
                when={
                  isPlaylistActive()
                    ? `pl-${mixerLoadToken()}`
                    : mixerSessionId()
                }
                keyed
              >
                <StemMixer
                  stems={mixerStems()}
                  sessionId={mixerSessionId()}
                  songTitle={
                    currentUvrSession()?.originalFile?.name ?? 'Unknown'
                  }
                  practiceMode={mixerPracticeMode()}
                  requestedStems={mixerRequestedStems()}
                  initialSeekSec={mixerInitialSeekSec()}
                  autoPlay={mixerAutoPlay()}
                  karaokeReferenceVocal={isPlaylistActive()}
                  onBack={() => {
                    setMixerAutoPlay(false)
                    setMixerInitialSeekSec(undefined)
                    setCurrentView(prevView())
                  }}
                />
              </Show>
            </div>
          </Show>

          {/* Shazam Sing — Listen */}
          <Show when={currentView() === 'shazam-listen'}>
            <Suspense>
              <ShazamListen
                onMatch={({ candidates, contour, hummingNormalized: hn }) => {
                  setLastContour(contour)
                  setHummingNormalized(hn)
                  // Auto-jump: if top stem match exceeds threshold, skip results
                  const threshold = props.autoJumpThreshold ?? 85
                  const topMatch = candidates[0]
                  if (
                    candidates.length > 0 &&
                    topMatch.source === 'stem' &&
                    topMatch.sessionId !== undefined &&
                    topMatch.confidence >= threshold
                  ) {
                    // Set auto-play with match offset for stem mixer
                    setMixerInitialSeekSec(topMatch.matchOffsetSec)
                    setMixerAutoPlay(true)
                    void handleOpenMixerFromHistory(topMatch.sessionId, {
                      vocal: true,
                    })
                    props.onOpenStemMixer?.(topMatch.sessionId)
                    return
                  }
                  setMatchCandidates(candidates)
                  setCurrentView('shazam-results')
                }}
                onAutoJump={(candidate) => {
                  if (
                    candidate.source === 'stem' &&
                    candidate.sessionId !== undefined
                  ) {
                    setMixerInitialSeekSec(candidate.matchOffsetSec)
                    setMixerAutoPlay(true)
                    void handleOpenMixerFromHistory(candidate.sessionId, {
                      vocal: true,
                    })
                    props.onOpenStemMixer?.(candidate.sessionId)
                  } else {
                    props.onSelectMelody?.(candidate.melodyId)
                  }
                }}
                onCancel={() => setCurrentView('upload')}
                onSwitchToUpload={() => setCurrentView('upload')}
              />
            </Suspense>
          </Show>

          {/* Shazam Sing — Results */}
          <Show when={currentView() === 'shazam-results'}>
            <Suspense>
              <ShazamResults
                candidates={matchCandidates()}
                liveContour={lastContour()}
                hummingNormalized={hummingNormalized()}
                onOpenMelody={(melodyId) => {
                  props.onSelectMelody?.(melodyId)
                }}
                onOpenStemMixer={(sessionId, matchOffsetSec) => {
                  setMixerInitialSeekSec(matchOffsetSec)
                  setMixerAutoPlay(matchOffsetSec !== undefined)
                  void handleOpenMixerFromHistory(sessionId, { vocal: true })
                  props.onOpenStemMixer?.(sessionId)
                }}
                onTryAgain={() => {
                  setMatchCandidates([])
                  setCurrentView('shazam-listen')
                }}
              />
            </Suspense>
          </Show>
        </div>

        {/* Import Group Selection Modal */}
        <Show when={showImportGroupSelect()}>
          <div
            class="delete-all-overlay"
            onClick={() => {
              setShowImportGroupSelect(false)
              setImportFile(null)
            }}
          >
            <div class="delete-all-dialog" onClick={(e) => e.stopPropagation()}>
              <h4>Import to Group</h4>
              <p>
                Choose a target group for the imported sessions, or leave
                ungrouped.
              </p>
              <div
                class="session-group-assign-menu"
                style="position: static; box-shadow: none; margin-bottom: 0.75rem;"
              >
                <button
                  class="session-group-assign-item"
                  classList={{
                    'session-group-assign-item--active':
                      importTargetGroupId() === null,
                  }}
                  onClick={() => setImportTargetGroupId(null)}
                >
                  No group
                </button>
                <For each={getGroupsReactive()}>
                  {(group) => (
                    <button
                      class="session-group-assign-item"
                      classList={{
                        'session-group-assign-item--active':
                          importTargetGroupId() === group.id,
                      }}
                      onClick={() => setImportTargetGroupId(group.id)}
                    >
                      {group.name}
                      <span class="session-group-assign-item-count">
                        {group.sessionIds.length}
                      </span>
                    </button>
                  )}
                </For>
              </div>
              <div class="session-group-assign-new">
                <input
                  type="text"
                  class="session-group-assign-new-input"
                  placeholder="Or create a new group..."
                  value={newImportGroupName()}
                  onInput={(e) => setNewImportGroupName(e.currentTarget.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void handleCreateImportGroup()
                  }}
                />
                <button
                  class="session-group-assign-new-btn"
                  onClick={() => void handleCreateImportGroup()}
                  disabled={importGroupCreating()}
                >
                  {importGroupCreating() ? 'Creating...' : 'Create & import'}
                </button>
              </div>
              <div class="delete-all-actions">
                <button
                  class="delete-all-cancel"
                  onClick={() => {
                    setShowImportGroupSelect(false)
                    setImportFile(null)
                  }}
                >
                  Cancel
                </button>
                <button
                  class="delete-all-confirm"
                  onClick={() => void handleConfirmImport()}
                >
                  Import{importTargetGroupId() != null ? ' to group' : ''}
                </button>
              </div>
            </div>
          </div>
        </Show>

        {/* Clear Storage Confirmation Modal */}
        <Show when={showClearStorageConfirm()}>
          <div
            class="delete-all-overlay"
            onClick={() => setShowClearStorageConfirm(false)}
          >
            <div class="delete-all-dialog" onClick={(e) => e.stopPropagation()}>
              <h4>Clear All Data</h4>
              <p>
                This will permanently remove all {allSessions().length} session
                {allSessions().length !== 1 ? 's' : ''}, generated stems, and
                uploaded mp3 files from your local database. This action cannot
                be undone.
              </p>
              <div class="delete-all-actions">
                <button
                  class="delete-all-cancel"
                  onClick={() => setShowClearStorageConfirm(false)}
                >
                  Cancel
                </button>
                <button class="delete-all-confirm" onClick={handleClearStorage}>
                  <Trash2 /> Clear All
                </button>
              </div>
            </div>
          </div>
        </Show>

        {/* Delete All Toast */}
        <Show when={deleteAllToast()}>
          <div class="history-toast history-toast-auto">
            <span class="history-toast-icon">
              <CheckCircle />
            </span>
            {deleteAllToast()}
          </div>
        </Show>

        {/* Export All Progress Toast */}
        <Show when={isExporting()}>
          <div class="history-toast">
            <span class="history-toast-icon">
              <svg width="16" height="16" viewBox="0 0 24 24">
                <circle
                  cx="12"
                  cy="12"
                  r="10"
                  fill="none"
                  stroke="var(--border, #30363d)"
                  stroke-width="2"
                />
                <circle
                  cx="12"
                  cy="12"
                  r="10"
                  fill="none"
                  stroke="var(--accent, #8b5cf6)"
                  stroke-width="2"
                  stroke-dasharray={String(2 * Math.PI * 10)}
                  stroke-dashoffset={String(
                    2 * Math.PI * 10 * (1 - exportProgress() / 100),
                  )}
                  stroke-linecap="round"
                  transform="rotate(-90 12 12)"
                />
              </svg>
            </span>
            Preparing ZIP... {exportProgress()}%
          </div>
        </Show>

        {/* MIDI Export Progress Toast */}
        <Show when={midiExporting()}>
          <div class="history-toast">
            <span class="history-toast-icon">
              <svg width="16" height="16" viewBox="0 0 24 24">
                <circle
                  cx="12"
                  cy="12"
                  r="10"
                  fill="none"
                  stroke="var(--border, #30363d)"
                  stroke-width="2"
                />
                <circle
                  cx="12"
                  cy="12"
                  r="10"
                  fill="none"
                  stroke="var(--accent, #8b5cf6)"
                  stroke-width="2"
                  stroke-dasharray={String(2 * Math.PI * 10)}
                  stroke-dashoffset={String(
                    2 * Math.PI * 10 * (1 - midiExportProgress() / 100),
                  )}
                  stroke-linecap="round"
                  transform="rotate(-90 12 12)"
                />
              </svg>
            </span>
            Generating MIDI... {midiExportProgress()}%
          </div>
        </Show>
      </div>
    </div>
  )
}
