// ============================================================
// UVR Panel - Unified Vocal Separation Interface
// ============================================================

import type { Component } from 'solid-js'
import { batch, createEffect, createResource, createSignal, For, lazy, on, onCleanup, Show, Suspense, untrack, } from 'solid-js'
import { FancyDivider } from '@/components/shared'
import { hasRoomFor } from '@/db/durable-write'
import { fetchBillingMe, fetchPricing } from '@/db/services/billing-service'
import type { SessionZipInspection } from '@/db/services/session-export-service'
import { exportAllSessions, exportGroup, exportSession, importSessionsFromZip, inspectSessionZip, isZipFile, } from '@/db/services/session-export-service'
import { deletePitchAnalysisFromDb } from '@/db/services/session-pitch-analysis-service'
import { getAuthToken } from '@/db/services/user-service'
import { deleteAllUvrSessionsFromDb, deleteUvrSessionFromDb, findSessionByFileHash, getOriginalFileBlob, getStemBlobUrl, hydrateStemUrls, saveStemBlobDurable, saveStemFingerprintData, } from '@/db/services/uvr-service'
import { ensureSessionHydrated, useKaraokePlaylistRunner, } from '@/features/stem-mixer/karaoke-playlist-runner'
import { offerTourOnce } from '@/features/tours/offerTourOnce'
import { formatFileSize } from '@/lib/audio-accept'
import { computeFileHash } from '@/lib/file-hash'
import { fuzzyScore } from '@/lib/fuzzy-match'
import { KARAOKE_NIGHT_PATH, karaokeNightSessionUrl, } from '@/lib/karaoke-night-link'
import { generateVocalMidi } from '@/lib/midi-generator'
import { addStemFingerprint } from '@/lib/shazam/melody-fingerprints'
import { extractStemFingerprint } from '@/lib/shazam/stem-fingerprinter'
import type { LivePitchContour, MatchCandidate } from '@/lib/shazam/types'
import { createPersistedSignal } from '@/lib/storage'
import { getProcessStatus, LOCAL_MAX_UPLOAD_BYTES, SERVER_MAX_UPLOAD_BYTES, } from '@/lib/uvr-api'
import type { ProcessingCallbacks } from '@/lib/uvr-processing-pipeline'
import { cancelUvrPipeline, destroyPipeline, getActiveProvider, isServerPollActive, preInitModel, resumeServerSession, runUvrPipeline, } from '@/lib/uvr-processing-pipeline'
import type { UvrUploadQueueWorkerContext } from '@/lib/uvr-upload-queue'
import { isTerminalUploadQueueStatus, MAX_UVR_UPLOAD_QUEUE_ITEMS, } from '@/lib/uvr-upload-queue'
import type { UvrProcessingMode, UvrSession } from '@/stores/app-store'
import { addSessionToGroup, cancelUvrSession, completeUvrSession, createGroup, currentUvrSession, deleteAllUvrSessions, deleteUvrSession, getAllUvrSessions, getAllUvrSessionsReactive, getGroupsReactive, getUvrProcessingMode, getUvrSession, getUvrSessionByHash, isSessionStoreReady, resumableServerSessions, retryUvrSession, saveAllUvrSessions, setCurrentUvrSession, setErrorUvrSession, setUvrForceWebGpu, setUvrProcessingMode, setUvrSessionResuming, startTour, startUvrSession, STEM_MIXER_TOUR_STEPS, updateUvrSessionOutputs, uvrForceWebGpu, uvrModelError, uvrModelStatus, uvrProcessingMode, } from '@/stores/app-store'
import { balanceVersion, refreshBalance } from '@/stores/billing-store'
import { isPlaylistActive } from '@/stores/karaoke-playlist-store'
import { showActionNotification, showNotification, } from '@/stores/notifications-store'
import { openSettingsSection } from '@/stores/ui-store'
import { karaokeFocus } from '@/stores/ui-store'
import { activeUvrUploadQueueMode, setActiveUvrUploadQueueMode, uvrUploadQueue, } from '@/stores/uvr-upload-queue-store'
import { KaraokePlaylistGallery, SessionGroupTabs, StemMixer, UvrGuide, UvrProcessControl, UvrResultViewer, UvrSessionResult, UvrSettings, UvrStemUploadControl, UvrUploadControl, UvrUploadQueue, } from '.'
import { CheckCircle, ChevronDown, ChevronUp, Cpu, ExportFile, ExportGroup, FilePlus, ImportFile, Loader2, Music, Plus, Search, Settings, SingMic, StageCurtains, Trash2, X, XCircle, Zap, } from './icons'

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
  const uploadQueue = uvrUploadQueue

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
  const [importFiles, setImportFiles] = createSignal<File[]>([])
  const [importInspections, setImportInspections] = createSignal<
    { file: File; inspection: SessionZipInspection }[]
  >([])
  const [importInspecting, setImportInspecting] = createSignal(false)
  const [showImportGroupSelect, setShowImportGroupSelect] = createSignal(false)
  const [importTargetGroupId, setImportTargetGroupId] = createSignal<
    string | null
  >(null)
  const [newImportGroupName, setNewImportGroupName] = createSignal('')
  const [importGroupCreating, setImportGroupCreating] = createSignal(false)
  let importInspectionGeneration = 0

  const importSessionCount = () =>
    importInspections().reduce(
      (sum, item) => sum + item.inspection.sessionCount,
      0,
    )
  const importPlaylistCount = () =>
    importInspections().reduce(
      (sum, item) => sum + item.inspection.playlistCount,
      0,
    )
  const importGroupCount = () =>
    importInspections().reduce(
      (sum, item) => sum + item.inspection.groupCount,
      0,
    )
  const importInvalidCount = () =>
    importInspections().filter((item) => !item.inspection.valid).length
  const importHasKaraokeManifest = () =>
    importInspections().some((item) => item.inspection.hasKaraokeManifest)

  const closeImportModal = () => {
    importInspectionGeneration++
    setShowImportGroupSelect(false)
    setImportFiles([])
    setImportInspections([])
    setImportInspecting(false)
    setNewImportGroupName('')
  }

  createEffect(() => {
    if (!showImportGroupSelect()) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isImporting()) closeImportModal()
    }
    window.addEventListener('keydown', onKeyDown)
    onCleanup(() => window.removeEventListener('keydown', onKeyDown))
  })

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

  /** Store the ZIP(s) and show the group selection dialog. Entry point for
   *  the import button, the upload drop zone, and whole-view drops. */
  const startZipImport = (files: File[]) => {
    if (isImporting()) return
    const zips = files.filter(isZipFile)
    if (zips.length === 0) return
    const generation = ++importInspectionGeneration
    setImportFiles(zips)
    setImportInspections([])
    setImportInspecting(true)
    setImportTargetGroupId(null)
    setNewImportGroupName('')
    setShowImportGroupSelect(true)
    void (async () => {
      const previews: { file: File; inspection: SessionZipInspection }[] = []
      for (const file of zips) {
        const inspection = await inspectSessionZip(file)
        if (generation !== importInspectionGeneration) return
        previews.push({ file, inspection })
        setImportInspections([...previews])
      }
      if (generation === importInspectionGeneration) setImportInspecting(false)
    })()
  }

  const handleImportZip = (e: Event) => {
    const input = e.target as HTMLInputElement
    const files = input.files ? [...input.files] : []
    input.value = ''
    startZipImport(files)
  }

  const handleConfirmImport = async () => {
    const files = importInspections()
      .filter((item) => item.inspection.valid)
      .map((item) => item.file)
    if (files.length === 0 || importInspecting() || importSessionCount() === 0)
      return

    setShowImportGroupSelect(false)
    setIsImporting(true)
    showNotification(
      files.length === 1
        ? 'Extracting sessions from ZIP...'
        : `Extracting sessions from ${files.length} ZIP files...`,
      'info',
    )
    try {
      let imported = 0
      let failed = importInvalidCount()
      for (const file of files) {
        try {
          imported += await importSessionsFromZip(
            file,
            importTargetGroupId() ?? undefined,
          )
        } catch (_err) {
          failed++
        }
      }
      if (imported === 0) {
        showNotification('Failed to import sessions.', 'error')
      } else if (failed > 0) {
        showNotification(
          `Imported ${imported} session(s); ${failed} ZIP file(s) failed.`,
          'warning',
        )
      } else {
        showNotification(
          `Successfully imported ${imported} session(s).`,
          'success',
        )
      }
    } finally {
      setIsImporting(false)
      setImportFiles([])
      setImportInspections([])
    }
  }

  // Whole-view ZIP drop: exported sessions can be dropped on the session list
  // too, not just the upload zone. Depth-counted like the upload zone since
  // dragenter/dragleave fire for every child crossed.
  let zipDragDepth = 0
  const [zipDragActive, setZipDragActive] = createSignal(false)

  const dragMayContainZip = (e: DragEvent): boolean => {
    const items = e.dataTransfer?.items
    if (!items) return false
    // MIME is empty on some platforms mid-drag — treat unknown as a candidate.
    return Array.from(items).some(
      (it) => it.kind === 'file' && (it.type === '' || it.type.includes('zip')),
    )
  }

  const handleZipDragEnter = (e: DragEvent) => {
    if (isImporting() || !dragMayContainZip(e)) return
    zipDragDepth++
    setZipDragActive(true)
  }

  const handleZipDragOver = (e: DragEvent) => {
    // Allow dropping any files so a stray audio drop on the list doesn't
    // navigate the whole app away to the file.
    if (e.dataTransfer?.types.includes('Files') === true) e.preventDefault()
  }

  const handleZipDragLeave = () => {
    zipDragDepth = Math.max(0, zipDragDepth - 1)
    if (zipDragDepth === 0) setZipDragActive(false)
  }

  const handleZipDrop = (e: DragEvent) => {
    zipDragDepth = 0
    setZipDragActive(false)
    if (e.defaultPrevented) return // upload zone already handled this drop
    e.preventDefault()
    const files = e.dataTransfer?.files
    if (!files || files.length === 0) return
    startZipImport([...files])
  }

  const handleCreateImportGroup = async () => {
    const name = newImportGroupName().trim()
    if (name === '' || importInspecting() || importSessionCount() === 0) return
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

  // Clean up separator when switching away from local mode. Track ONLY the mode
  // (via on()) and read the status untracked: otherwise a status write from an
  // in-flight local separation — e.g. getSeparator() setting 'loading' while
  // retrying a local/WebGPU session with the global mode on 'server' — re-runs
  // this effect mid-init and destroys the separator out from under the pipeline
  // (the "can't access property initialize, X is null" crash).
  createEffect(
    on(uvrProcessingMode, (mode) => {
      if (mode === 'server' && untrack(uvrModelStatus) !== 'unloaded') {
        destroyPipeline()
      }
    }),
  )

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

  // Re-hydrate stem URLs from IndexedDB for any completed session. Both local
  // and server separations persist their stems as durable blobs; the in-memory
  // object URLs die on reload and server URLs expire, so on every load we point
  // outputs back at fresh object URLs built from the local blobs. (Previously
  // this was gated to local-mode, so reopened server sessions kept dead server
  // URLs and failed to load — the "processed but can't open / retry" bug.)
  const ensureHydrated = ensureSessionHydrated

  // ── Karaoke playlist runner (shared with Karaoke Night) ──────────
  // The runner hydrates each armed song and hands it over; the StemMixer
  // remounts per song via mixerLoadToken, which is bumped only once the
  // correct stems are in place — so the mixer never reuses a previous
  // (already-ended) instance or loads stale stems.
  useKaraokePlaylistRunner((hydrated) => {
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
  })

  // Live credit balance for the karaoke header pill; re-fetches whenever
  // billing-store's balanceVersion bumps (checkout returns, finished jobs).
  const [billingMe] = createResource(
    () => balanceVersion() + 1,
    () => fetchBillingMe(),
  )
  // Per-song cost of the model server jobs run (the single server quality,
  // BS-RoFormer) — served by the pricing endpoint, never hardcoded.
  const [pricing] = createResource(() => fetchPricing().catch(() => null))
  const songCost = (): number | undefined => {
    const cost = pricing()?.uvrModelCredits?.roformer
    return cost !== undefined && cost > 0 ? cost : undefined
  }
  const creditBalanceLabel = (): string => {
    const balance = billingMe()?.creditBalance
    const cost = songCost()
    const suffix = cost !== undefined ? ` · ${cost} per song` : ''
    return balance !== undefined
      ? `${balance} credit${balance === 1 ? '' : 's'}${suffix}`
      : cost !== undefined
        ? `${cost} credit${cost === 1 ? '' : 's'} / song`
        : 'Credits'
  }

  /** Server processing needs a signed-in account (the worker's JWT gate
   *  rejects anonymous requests with a bare 401). Gate it client-side with
   *  a friendly action toast instead of letting the upload fail. */
  const requireServerAuth = (): boolean => {
    const token = getAuthToken()
    if (token !== null && token !== '') return true
    showActionNotification('Sign in to use cloud GPU processing.', 'info', {
      label: 'Open Account',
      onClick: () => openSettingsSection('account'),
    })
    return false
  }

  /** Turn billing/auth failures from the server path into action toasts
   *  that link to Settings -> Account; other errors keep the plain toast. */
  const notifyServerBillingError = (message: string): boolean => {
    if (message.includes('Not enough credits')) {
      showActionNotification(message, 'error', {
        label: 'Get credits',
        onClick: () => openSettingsSection('credits'),
      })
      return true
    }
    if (message.includes('Sign in to use cloud')) {
      showActionNotification(message, 'info', {
        label: 'Open Account',
        onClick: () => openSettingsSection('account'),
      })
      return true
    }
    return false
  }

  /** A session card should never show a raw JS crash (a TypeError, a null
   *  dereference). Already-legible messages (the server 503, billing, storage)
   *  pass through untouched; an internal-looking one is replaced with guidance
   *  the user can act on. */
  const humanizeProcessingError = (
    message: string,
    mode: UvrProcessingMode,
  ): string => {
    const internal =
      /is null|is undefined|is not a function|can(?:no|')t (?:read|access)|reading '|undefined is not|TypeError/i.test(
        message,
      )
    if (!internal) return message
    return mode === 'server'
      ? 'Cloud processing hit an unexpected error. Please try again in a moment.'
      : 'Browser processing hit an unexpected error. Reload the page and try again, or switch to Cloud Server mode.'
  }

  interface PipelineUiOptions {
    focus?: boolean
    onProgress?: (progress: number) => void
    onComplete?: () => void
    onError?: (message: string) => void
    cancelled?: () => boolean
    signal?: AbortSignal
  }

  /** Shared completion/error glue for a UVR pipeline run — used by both a fresh
   *  separation (handleProcessStart) and a reload/foreground re-attach
   *  (handleResumeServer). The view only jumps to results / raises a toast when
   *  THIS session is the one on screen, so a background auto-resume updates its
   *  card silently. */
  const buildPipelineCallbacks = (
    sessionId: string,
    fileName: string,
    processingMode: UvrProcessingMode,
    options: PipelineUiOptions = {},
  ): ProcessingCallbacks => ({
    onProgress: (progress) => {
      // Progress is written inside the pipeline via updateUvrSessionProgress.
      options.onProgress?.(progress)
    },
    onComplete: async (result) => {
      const persisted = await completeUvrSession(
        sessionId,
        result.outputs,
        result.stemMeta,
      )
      if (!persisted) {
        showNotification(
          'Finalizing hit a storage issue — your stems are saved. Reload if the session looks off.',
          'warning',
        )
      }
      if (processingMode === 'server') refreshBalance()
      // Auto-extract stem fingerprint for Shazam matching; delay so the heavy
      // WebGPU/WASM thread yields before the AudioContext work.
      setTimeout(() => {
        void indexStemFingerprint(sessionId, fileName)
      }, 500)
      options.onComplete?.()
      if (
        (options.focus ?? true) &&
        currentUvrSession()?.sessionId === sessionId
      )
        setCurrentView('results')
    },
    onError: (rawMessage) => {
      if (options.cancelled?.() === true) {
        cancelUvrSession(sessionId, options.focus ?? true)
        if (processingMode === 'server') refreshBalance()
        return
      }
      const message = humanizeProcessingError(rawMessage, processingMode)
      setErrorUvrSession(sessionId, message)
      options.onError?.(message)
      if (
        (options.focus ?? true) &&
        currentUvrSession()?.sessionId === sessionId
      ) {
        if (!notifyServerBillingError(message)) showError(message)
      }
      if (processingMode === 'server') refreshBalance()
    },
  })

  /** Re-attach to an in-flight / just-finished RunPod job by its persisted
   *  apiSessionId — no new job, no new debit. `focus` brings the processing
   *  view forward (a user-initiated fetch / re-run); omitted for the silent
   *  background auto-resume on load. */
  const handleResumeServer = async (
    sessionId: string,
    opts?: { focus?: boolean },
  ): Promise<void> => {
    const session = getUvrSession(sessionId)
    if (!session || session.processingMode !== 'server') return
    const apiId = session.apiSessionId
    if (apiId === undefined || apiId === '') return
    if (isServerPollActive(apiId)) return
    if (opts?.focus ?? false) {
      setCurrentUvrSession(session)
      setCurrentView('processing')
    }
    setUvrSessionResuming(sessionId)
    try {
      await resumeServerSession(
        sessionId,
        apiId,
        buildPipelineCallbacks(
          sessionId,
          session.originalFile?.name ?? 'audio',
          'server',
        ),
      )
    } catch (err) {
      // pollForCompletion already routed a terminal failure through onError
      // (the card reflects it); just don't leave the rejection unhandled.
      console.warn('[UvrPanel] resume server session failed:', err)
    }
  }

  /** On load / foreground / reconnect, re-attach to every server job we can
   *  still recover (see resumableServerSessions), in the background. Guarded so
   *  a job already being polled is never double-polled. */
  const autoResumeServerSessions = async (): Promise<void> => {
    const list = await resumableServerSessions()
    for (const s of list) {
      const apiId = s.apiSessionId
      if (apiId !== undefined && apiId !== '' && !isServerPollActive(apiId)) {
        void handleResumeServer(s.sessionId)
      }
    }
  }

  // Recover server separations whose client polling was lost to an iOS
  // app-switch or a page reload: once the store is ready, and again whenever the
  // tab returns to the foreground or the network reconnects, re-attach to any
  // still-recoverable RunPod job and re-fetch its stems — for free — instead of
  // leaving it orphaned and paying for a fresh separation.
  let autoResumeStarted = false
  createEffect(() => {
    if (!isSessionStoreReady() || autoResumeStarted) return
    autoResumeStarted = true
    void autoResumeServerSessions()
  })

  createEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        void autoResumeServerSessions()
      }
    }
    const onOnline = () => void autoResumeServerSessions()
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', onOnline)
    onCleanup(() => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', onOnline)
    })
  })

  const handleProcessStart = async (
    sessionId: string,
    mode?: UvrProcessingMode,
    fileOverride?: File,
    options: PipelineUiOptions = {},
  ): Promise<{
    status: 'completed' | 'error' | 'cancelled'
    message?: string
  }> => {
    let file: File | null = fileOverride ?? null
    if (!file) {
      // Retry path: original file is no longer in memory, load from IndexedDB
      file = await getOriginalFileBlob(sessionId)
    } else {
      // Initial path: file is in memory — persist it durably before processing
      // so a retry (which reads it back from IndexedDB) can't fail silently.
      const origSave = await saveStemBlobDurable(
        sessionId,
        'original',
        file,
        file.name,
      )
      if (!origSave.ok) {
        console.warn('[UvrPanel] original-file save failed:', origSave.error)
      }
    }
    if (!file) {
      const msg = 'File lost from memory. Please start a new session.'
      console.error(msg)
      setErrorUvrSession(sessionId, msg)
      if (options.focus ?? true) showNotification(msg, 'warning')
      options.onError?.(msg)
      return { status: 'error', message: msg }
    }

    const processingMode = mode ?? getUvrProcessingMode()

    // Storage pre-flight: WARN (don't block) if the disk is likely too full to
    // hold the separated stems, so a paid job doesn't run only to fail to save
    // at the end. Stems decode to WAV (~10-12x an MP3), plus the stored original.
    if (!(await hasRoomFor(file.size * 12))) {
      if (options.focus ?? true) {
        showNotification(
          'Low on storage — the separated stems may not save. Free up space to be safe.',
          'warning',
        )
      }
    }

    // Set session to processing status (immutable update via store API)
    const session = getUvrSession(sessionId)
    if (session) {
      const updated = { ...session, status: 'processing' as const }
      saveAllUvrSessions(
        getAllUvrSessions().map((s) =>
          s.sessionId === sessionId ? updated : s,
        ),
      )
      if (options.focus ?? true) setCurrentUvrSession(updated)
    }

    let outcome: {
      status: 'completed' | 'error' | 'cancelled'
      message?: string
    } | null = null
    try {
      await runUvrPipeline(
        file,
        sessionId,
        processingMode,
        buildPipelineCallbacks(sessionId, file.name, processingMode, {
          ...options,
          onComplete: () => {
            outcome = { status: 'completed' }
            options.onComplete?.()
          },
          onError: (message) => {
            outcome = { status: 'error', message }
            options.onError?.(message)
          },
        }),
        // Server jobs always run the single server quality (the pipeline's
        // default model, BS-RoFormer).
        { signal: options.signal },
      )
    } catch (error) {
      if (outcome !== null) return outcome
      if (options.cancelled?.() === true) {
        cancelUvrSession(sessionId, options.focus ?? true)
        return { status: 'cancelled' }
      }
      console.error('Processing error:', error)
      const message = humanizeProcessingError(
        error instanceof Error ? error.message : 'Processing failed',
        processingMode,
      )
      setErrorUvrSession(sessionId, message)
      options.onError?.(message)
      if ((options.focus ?? true) && !notifyServerBillingError(message)) {
        showNotification(message, 'error')
      }
      return { status: 'error', message }
    }
    return outcome ?? { status: 'completed' }
  }

  const enqueueAudioFiles = (files: File[]) => {
    if (
      uploadQueue.items().length > 0 &&
      uploadQueue
        .items()
        .every((item) => isTerminalUploadQueueStatus(item.status))
    ) {
      uploadQueue.clear()
    }
    const { added, overflow } = uploadQueue.enqueue(files)
    if (overflow > 0) {
      showNotification(
        `The setlist holds ${MAX_UVR_UPLOAD_QUEUE_ITEMS} songs. ${overflow} ${overflow === 1 ? 'file was' : 'files were'} left out.`,
        'warning',
      )
    } else if (added > 1) {
      showNotification(
        `${added} songs added. Review the setlist, then start the batch.`,
        'success',
      )
    }
  }

  const processQueuedFile = async (
    item: ReturnType<typeof uploadQueue.items>[number],
    context: UvrUploadQueueWorkerContext,
    processingMode: UvrProcessingMode,
  ) => {
    context.update({ message: 'Checking your library…' })
    const hash = await computeFileHash(item.file)
    if (context.cancelled()) return { status: 'cancelled' as const }

    const existing = getUvrSessionByHash(hash)
    if (existing !== undefined) {
      return {
        status: 'skipped' as const,
        sessionId: existing.sessionId,
        message: 'Existing stems kept',
      }
    }

    const dbMatch = await findSessionByFileHash(hash)
    if (dbMatch !== null) {
      const stored = getUvrSession(dbMatch.sessionId)
      if (stored?.status === 'completed') {
        return {
          status: 'skipped' as const,
          sessionId: stored.sessionId,
          message: 'Existing stems kept',
        }
      }
    }

    // A recoverable server job for the same file may be running in another
    // tab or may have been re-attached after a reload. Never submit a duplicate
    // paid job; leave the existing session to its own poll loop.
    const inFlight = getAllUvrSessions().find(
      (session) =>
        session.fileHash === hash &&
        session.processingMode === 'server' &&
        session.apiSessionId !== undefined &&
        session.apiSessionId !== '' &&
        (session.status === 'processing' || session.status === 'finalizing'),
    )
    if (inFlight !== undefined) {
      return {
        status: 'skipped' as const,
        sessionId: inFlight.sessionId,
        message: 'Already separating',
      }
    }

    if (context.cancelled()) return { status: 'cancelled' as const }
    const sessionId = startUvrSession(
      item.file.name,
      item.file.size,
      item.file.type,
      'separate',
      processingMode,
      hash,
      false,
    )
    const groupId = activeGroupId()
    if (groupId !== null && groupId !== '') {
      void addSessionToGroup(sessionId, groupId)
    }
    context.update({
      status: 'processing',
      sessionId,
      message:
        processingMode === 'server'
          ? 'Studio separation starting…'
          : 'Preparing on-device model…',
    })

    let serverCancelIssued = false
    const cancelController = new AbortController()
    const cancelSubmittedServerJob = () => {
      if (processingMode !== 'server' || serverCancelIssued) return
      const apiSessionId = getUvrSession(sessionId)?.apiSessionId
      if (apiSessionId === undefined || apiSessionId === '') return
      serverCancelIssued = true
      cancelUvrPipeline('server', apiSessionId)
    }
    context.onCancel(() => {
      cancelController.abort()
      if (processingMode === 'local') cancelUvrPipeline('local')
      else cancelSubmittedServerJob()
      cancelUvrSession(sessionId, false)
    })

    const result = await handleProcessStart(
      sessionId,
      processingMode,
      item.file,
      {
        focus: false,
        onProgress: (progress) => {
          if (context.cancelled()) cancelSubmittedServerJob()
          else {
            context.update({
              progress,
              message:
                progress > 0
                  ? `${Math.round(progress)}% separated`
                  : processingMode === 'server'
                    ? 'Waiting for a studio worker…'
                    : 'Loading the separator…',
            })
          }
        },
        cancelled: context.cancelled,
        signal: cancelController.signal,
      },
    )

    if (context.cancelled()) {
      cancelSubmittedServerJob()
      return { status: 'cancelled' as const, sessionId }
    }
    if (result.status === 'error') {
      return {
        status: 'error' as const,
        sessionId,
        message: result.message ?? 'Separation failed',
      }
    }
    return {
      status: 'completed' as const,
      sessionId,
      message: 'Stems saved',
    }
  }

  const startUploadQueue = async () => {
    const processingMode = uvrProcessingMode()
    if (processingMode === 'server' && !requireServerAuth()) return

    const activeSession = allSessions().some(
      (item) =>
        item.status === 'uploading' ||
        item.status === 'processing' ||
        item.status === 'finalizing',
    )
    if (activeSession) {
      showNotification(
        'Another separation is still active. Let it finish before starting this setlist.',
        'info',
      )
      return
    }

    if (processingMode === 'server') {
      const balance = billingMe()?.creditBalance
      const cost = songCost()
      const songs = uploadQueue
        .items()
        .filter((item) => item.status === 'queued').length
      if (
        balance !== undefined &&
        cost !== undefined &&
        songs * cost > balance
      ) {
        showActionNotification(
          `This setlist may use ${songs * cost} credits, but your balance is ${balance}. Remove songs or add credits before starting.`,
          'warning',
          {
            label: 'Get credits',
            onClick: () => openSettingsSection('credits'),
          },
        )
        return
      }
    }

    setActiveUvrUploadQueueMode(processingMode)
    await uploadQueue.run((item, context) =>
      untrack(() => processQueuedFile(item, context, processingMode)),
    )
  }

  /** Re-run a completed browser separation on the cloud GPU, feeding it the
   *  original upload we keep in IndexedDB. 'same' upgrades the session in
   *  place (stems are replaced when the job lands); 'new' spawns a sibling
   *  session so the browser and HQ results can be compared side by side. */
  const handleRerunHq = async (
    sessionId: string,
    target: 'same' | 'new',
    isAnotherSessionProcessing: boolean,
  ): Promise<void> => {
    const s = getUvrSession(sessionId)
    if (!s) return
    if (isAnotherSessionProcessing) {
      showNotification(
        'A separation is already running — wait for it to finish first.',
        'info',
      )
      return
    }
    if (!requireServerAuth()) return
    const orig = await getOriginalFileBlob(sessionId)
    if (!orig) {
      showNotification(
        "The original file isn't stored for this session, so it can't be re-processed.",
        'warning',
      )
      return
    }
    if (orig.size > SERVER_MAX_UPLOAD_BYTES) {
      showNotification(
        'This file is over the cloud GPU upload limit, so an HQ re-run is not available for it.',
        'warning',
      )
      return
    }

    if (target === 'same') {
      // Stamp server mode BEFORE starting: a mid-run reload re-attaches only
      // to sessions with processingMode 'server' (see handleResumeServer).
      saveAllUvrSessions(
        getAllUvrSessions().map((x) =>
          x.sessionId === sessionId
            ? { ...x, processingMode: 'server' as const }
            : x,
        ),
      )
      // Reset progress/error/apiSessionId from the previous run.
      retryUvrSession(sessionId)
      // The HQ stems will differ from the browser stems — a cached pitch
      // analysis would silently mismatch, so drop it now (cheap to re-run).
      void deletePitchAnalysisFromDb(sessionId)
      setCurrentView('processing')
      await handleProcessStart(sessionId, 'server')
    } else {
      const newId = startUvrSession(
        orig.name,
        orig.size,
        orig.type,
        'separate',
        'server',
        s.fileHash,
      )
      setCurrentView('processing')
      await handleProcessStart(newId, 'server', orig)
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
      // A deep-link to a session that isn't here (deleted, another device, or
      // the Karaoke Night demo, which is never a real session). Land on the
      // upload home — an empty 'results' view just looks broken.
      console.log('[UvrPanel] session not found, falling back to upload')
      setCurrentView('upload')
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
              <div class="uvr-mode-stack">
                <div class="uvr-mode-toggle">
                  <button
                    class={`mode-toggle-btn${uvrProcessingMode() === 'server' ? ' active' : ''}`}
                    title={`Processing: Server GPU — studio quality (BS-RoFormer)${songCost() !== undefined ? `, ${songCost()} credit${songCost() === 1 ? '' : 's'} per song` : ''}`}
                    onClick={() => {
                      if (requireServerAuth()) setUvrProcessingMode('server')
                    }}
                    disabled={uploadQueue.isRunning()}
                    data-testid="uvr-mode-server"
                  >
                    Server
                    <span class="mode-hq-pill">HQ</span>
                  </button>
                  <button
                    class={`mode-toggle-btn${uvrProcessingMode() === 'local' ? ' active' : ''}`}
                    title="Processing: Browser"
                    onClick={() => setUvrProcessingMode('local')}
                    disabled={uploadQueue.isRunning()}
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
                        disabled={uploadQueue.isRunning()}
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
                        disabled={uploadQueue.isRunning()}
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
                <Show when={uvrProcessingMode() === 'server'}>
                  <button
                    class="server-cost-hint"
                    title="Studio-quality separation runs on a cloud GPU and uses credits from your account. Click to manage credits."
                    data-testid="uvr-server-cost-hint"
                    onClick={() => openSettingsSection('credits')}
                  >
                    {creditBalanceLabel()}
                  </button>
                </Show>
              </div>
              <div class="uvr-view-tabs">
                <a
                  class="view-tab"
                  href={
                    mixerSessionId() !== ''
                      ? karaokeNightSessionUrl(mixerSessionId())
                      : currentUvrSession()?.sessionId !== undefined
                        ? karaokeNightSessionUrl(currentUvrSession()!.sessionId)
                        : KARAOKE_NIGHT_PATH
                  }
                  title="Open Karaoke Night — the theatre stage for singing your songs and playlists"
                >
                  <StageCurtains />
                  <span>Karaoke Night</span>
                </a>
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
            <div
              class="view-section upload-section"
              classList={{ 'zip-drop-target': zipDragActive() }}
              data-testid="uvr-upload"
              onDragEnter={handleZipDragEnter}
              onDragOver={handleZipDragOver}
              onDragLeave={handleZipDragLeave}
              onDrop={handleZipDrop}
            >
              <div class="section-header">
                <h4>Upload Audio</h4>
              </div>

              <UvrUploadControl
                onFilesSelect={enqueueAudioFiles}
                onImportZips={startZipImport}
                disabled={
                  uploadQueue.isRunning() ||
                  allSessions().some(
                    (item) =>
                      item.status === 'uploading' ||
                      item.status === 'processing' ||
                      item.status === 'finalizing',
                  )
                }
                maxSize={
                  uvrProcessingMode() === 'server'
                    ? SERVER_MAX_UPLOAD_BYTES
                    : LOCAL_MAX_UPLOAD_BYTES
                }
                maxSizeNote={
                  uvrProcessingMode() === 'server'
                    ? 'Cloud GPU upload limit — for larger files use Browser mode'
                    : undefined
                }
              />

              <Show when={uploadQueue.items().length > 0}>
                <UvrUploadQueue
                  items={uploadQueue.items}
                  running={uploadQueue.isRunning}
                  mode={() =>
                    uploadQueue.isRunning()
                      ? activeUvrUploadQueueMode()
                      : uvrProcessingMode()
                  }
                  costPerSong={songCost}
                  onStart={() => void startUploadQueue()}
                  onRemove={uploadQueue.remove}
                  onCancel={uploadQueue.cancelActive}
                  onClear={uploadQueue.clear}
                />
              </Show>

              <UvrStemUploadControl
                disabled={
                  uploadQueue.isRunning() ||
                  allSessions().some(
                    (item) =>
                      item.status === 'uploading' ||
                      item.status === 'processing' ||
                      item.status === 'finalizing',
                  )
                }
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
                    title="Import sessions from ZIP files (multi-select supported)"
                    style={{ cursor: isImporting() ? 'default' : 'pointer' }}
                  >
                    <ImportFile />
                    <input
                      type="file"
                      accept=".zip"
                      multiple
                      style={{ display: 'none' }}
                      onChange={handleImportZip}
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

              <Show when={sessionGalleryOpen() && allSessions().length === 0}>
                <div class="empty-state empty-state-compact">
                  <span class="empty-icon">
                    <Music />
                  </span>
                  <h3>No songs yet</h3>
                  <p>Upload a song to split it into stems you can sing over.</p>
                  <label class="primary-btn" for="uvr-file-input">
                    <FilePlus /> Start uploading
                  </label>
                </div>
              </Show>

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
                          const s = getUvrSession(sessionId)
                          // Still in flight (e.g. mid auto-resume) → re-attach for
                          // free rather than spawning a duplicate paid job. A
                          // failed/interrupted job means "start over" → fresh run.
                          if (
                            s?.processingMode === 'server' &&
                            s.apiSessionId !== undefined &&
                            s.apiSessionId !== '' &&
                            (s.status === 'processing' ||
                              s.status === 'finalizing')
                          ) {
                            void handleResumeServer(sessionId, { focus: true })
                            return
                          }
                          retryUvrSession(sessionId)
                          void handleProcessStart(sessionId, s?.processingMode)
                        }}
                        onReindexStem={(sessionId) => {
                          const session = getUvrSession(sessionId)
                          const fileName =
                            session?.originalFile?.name ?? 'Unknown'
                          void indexStemFingerprint(sessionId, fileName)
                        }}
                        onRerunHq={(sessionId, target) => {
                          const isAnotherSessionProcessing = allSessions().some(
                            (candidate) => candidate.status === 'processing',
                          )
                          void handleRerunHq(
                            sessionId,
                            target,
                            isAnotherSessionProcessing,
                          )
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
              {/* Show's callback accessor stays truthy-narrowed while the
                  branch is torn down. The bare `session() && (...)` guard was
                  NOT enough: deleting the session nulls the signal, and the
                  child's reactive prop reads (session()!.status) re-ran on
                  null before the unmount landed — crashing the app. */}
              <Show when={session()}>
                {(sess) => (
                  <UvrProcessControl
                    sessionId={sess().sessionId}
                    apiSessionId={sess().apiSessionId}
                    status={sess().status}
                    progress={sess().progress}
                    indeterminate={sess().indeterminate}
                    processingTime={sess().processingTime}
                    phase={sess().phase}
                    error={sess().error}
                    processingMode={sess().processingMode}
                    numChunks={sess().numChunks}
                    provider={sess().provider}
                    originalFileName={sess().originalFile?.name}
                    onCancel={() => {
                      // One upfront read: the calls below mutate the session
                      // signal mid-handler.
                      const s = sess()
                      cancelUvrPipeline(
                        s.processingMode ?? 'server',
                        s.apiSessionId,
                      )
                      cancelUvrSession(s.sessionId)
                      setCurrentView('upload')
                    }}
                    onRetry={() => {
                      const s = sess()
                      retryUvrSession(s.sessionId)
                      void handleProcessStart(s.sessionId, s.processingMode)
                    }}
                    onNewSession={() => setCurrentView('upload')}
                    onViewResults={() => {
                      setCurrentView('results')
                      props.onViewChange?.('results')
                    }}
                    onDeleteAndNew={() => {
                      const s = sess()
                      deleteUvrSession(s.sessionId)
                      void deleteUvrSessionFromDb(s.sessionId)
                      setCurrentView('upload')
                    }}
                    onFetchStems={
                      sess().processingMode === 'server' &&
                      sess().apiSessionId !== undefined &&
                      sess().apiSessionId !== ''
                        ? () => {
                            void handleResumeServer(sess().sessionId, {
                              focus: true,
                            })
                          }
                        : undefined
                    }
                  />
                )}
              </Show>
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
              <Show when={session()}>
                {(sess) => (
                  <UvrResultViewer
                    outputs={sess().outputs}
                    stemMeta={sess().stemMeta}
                    processingTime={sess().processingTime}
                    sessionId={sess().sessionId}
                    originalFileName={sess().originalFile?.name}
                    onStartPractice={(mode) => {
                      void handlePracticeStart(mode)
                    }}
                    onStartMix={(stems) => {
                      void handleMixStart(stems)
                    }}
                    onExport={(type) => {
                      void handleExport(type)
                    }}
                    onRerunHq={(sessionId, target) => {
                      void handleRerunHq(sessionId, target)
                    }}
                  />
                )}
              </Show>
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
                  onOfferTour={(trigger) => {
                    if (trigger === 'mount') {
                      offerTourOnce(
                        'pitchperfect_mixer_tour_offered',
                        'New to the mixer? Take a quick tour.',
                        STEM_MIXER_TOUR_STEPS,
                      )
                    } else {
                      startTour(STEM_MIXER_TOUR_STEPS)
                    }
                  }}
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
          <div class="uvr-import-overlay" onClick={closeImportModal}>
            <div
              class="uvr-import-dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby="uvr-import-title"
              onClick={(event) => event.stopPropagation()}
            >
              <header class="uvr-import-head">
                <span class="uvr-import-head-icon" aria-hidden="true">
                  <ImportFile />
                </span>
                <div>
                  <p class="uvr-import-kicker">Session archive</p>
                  <h4 id="uvr-import-title">Review your import</h4>
                  <p>
                    Check what is inside, then choose where the new sessions
                    should live.
                  </p>
                </div>
                <button
                  class="uvr-import-close"
                  onClick={closeImportModal}
                  aria-label="Close session import"
                >
                  <X />
                </button>
              </header>

              <div class="uvr-import-metrics" aria-live="polite">
                <div class="uvr-import-metric uvr-import-metric--primary">
                  <strong>
                    {importInspecting() ? '—' : importSessionCount()}
                  </strong>
                  <span>
                    {importInspecting()
                      ? 'Scanning sessions'
                      : `session${importSessionCount() === 1 ? '' : 's'} found`}
                  </span>
                </div>
                <div class="uvr-import-metric">
                  <strong>{importFiles().length}</strong>
                  <span>
                    ZIP {importFiles().length === 1 ? 'archive' : 'archives'}
                  </span>
                </div>
                <Show when={importPlaylistCount() > 0}>
                  <div class="uvr-import-metric">
                    <strong>{importPlaylistCount()}</strong>
                    <span>
                      karaoke playlist
                      {importPlaylistCount() === 1 ? '' : 's'}
                    </span>
                  </div>
                </Show>
                <Show when={importGroupCount() > 0}>
                  <div class="uvr-import-metric">
                    <strong>{importGroupCount()}</strong>
                    <span>
                      saved group{importGroupCount() === 1 ? '' : 's'}
                    </span>
                  </div>
                </Show>
              </div>

              <div class="uvr-import-body">
                <section class="uvr-import-pane">
                  <div class="uvr-import-pane-head">
                    <div>
                      <p class="uvr-import-step">Archive contents</p>
                      <h5>Files to unpack</h5>
                    </div>
                    <Show when={importInspecting()}>
                      <span class="uvr-import-scanning">
                        <Loader2 /> Reading manifests
                      </span>
                    </Show>
                  </div>
                  <ul class="uvr-import-file-list">
                    <For each={importFiles()}>
                      {(file) => {
                        const inspection = () =>
                          importInspections().find((item) => item.file === file)
                            ?.inspection
                        return (
                          <li
                            classList={{
                              'uvr-import-file--invalid':
                                inspection()?.valid === false,
                            }}
                          >
                            <span class="uvr-import-file-status">
                              <Show
                                when={inspection() !== undefined}
                                fallback={<Loader2 />}
                              >
                                <Show
                                  when={inspection()?.valid === true}
                                  fallback={<XCircle />}
                                >
                                  <CheckCircle />
                                </Show>
                              </Show>
                            </span>
                            <div class="uvr-import-file-copy">
                              <strong title={file.name}>{file.name}</strong>
                              <span>
                                {formatFileSize(file.size)}
                                <Show when={inspection() !== undefined}>
                                  {' · '}
                                  <Show
                                    when={inspection()?.valid === true}
                                    fallback={
                                      inspection()?.error ??
                                      'Archive is not importable'
                                    }
                                  >
                                    {inspection()?.sessionCount} session
                                    {inspection()?.sessionCount === 1
                                      ? ''
                                      : 's'}
                                    <Show
                                      when={
                                        inspection()?.error !== undefined &&
                                        inspection()?.error !== ''
                                      }
                                    >
                                      {` · ${inspection()?.error}`}
                                    </Show>
                                  </Show>
                                </Show>
                              </span>
                            </div>
                          </li>
                        )
                      }}
                    </For>
                  </ul>
                </section>

                <section class="uvr-import-pane">
                  <div class="uvr-import-pane-head">
                    <div>
                      <p class="uvr-import-step">Destination</p>
                      <h5>Choose a library group</h5>
                    </div>
                  </div>
                  <div class="uvr-import-destinations">
                    <button
                      class="uvr-import-destination"
                      classList={{
                        'uvr-import-destination--active':
                          importTargetGroupId() === null,
                      }}
                      onClick={() => setImportTargetGroupId(null)}
                    >
                      <span class="uvr-import-destination-icon">
                        <Music />
                      </span>
                      <span>
                        <strong>Leave ungrouped</strong>
                        <small>Add directly to Recent Sessions</small>
                      </span>
                      <CheckCircle />
                    </button>
                    <For each={getGroupsReactive()}>
                      {(group) => (
                        <button
                          class="uvr-import-destination"
                          classList={{
                            'uvr-import-destination--active':
                              importTargetGroupId() === group.id,
                          }}
                          onClick={() => setImportTargetGroupId(group.id)}
                        >
                          <span class="uvr-import-destination-icon">
                            <ExportGroup />
                          </span>
                          <span>
                            <strong>{group.name}</strong>
                            <small>
                              {group.sessionIds.length} existing session
                              {group.sessionIds.length === 1 ? '' : 's'}
                            </small>
                          </span>
                          <CheckCircle />
                        </button>
                      )}
                    </For>
                  </div>

                  <div class="uvr-import-new-group">
                    <label for="uvr-import-group-name">
                      Create a new group
                    </label>
                    <div>
                      <input
                        id="uvr-import-group-name"
                        type="text"
                        placeholder="e.g. Friday rehearsal"
                        value={newImportGroupName()}
                        onInput={(event) =>
                          setNewImportGroupName(event.currentTarget.value)
                        }
                        onKeyDown={(event) => {
                          if (event.key === 'Enter')
                            void handleCreateImportGroup()
                        }}
                      />
                      <button
                        onClick={() => void handleCreateImportGroup()}
                        disabled={
                          importGroupCreating() ||
                          importInspecting() ||
                          newImportGroupName().trim() === '' ||
                          importSessionCount() === 0
                        }
                      >
                        <Plus />
                        {importGroupCreating()
                          ? 'Creating…'
                          : 'Create & import'}
                      </button>
                    </div>
                  </div>

                  <Show when={importHasKaraokeManifest()}>
                    <p class="uvr-import-manifest-note">
                      Karaoke archives restore their saved playlists and groups
                      automatically. Your destination applies to regular session
                      archives in this import.
                    </p>
                  </Show>
                </section>
              </div>

              <Show when={importInvalidCount() > 0}>
                <p class="uvr-import-warning">
                  {importInvalidCount()} unreadable{' '}
                  {importInvalidCount() === 1
                    ? 'archive will'
                    : 'archives will'}{' '}
                  be skipped.
                </p>
              </Show>

              <footer class="uvr-import-actions">
                <button
                  class="uvr-import-button uvr-import-button--secondary"
                  onClick={closeImportModal}
                >
                  Cancel
                </button>
                <button
                  class="uvr-import-button uvr-import-button--primary"
                  onClick={() => void handleConfirmImport()}
                  disabled={importInspecting() || importSessionCount() === 0}
                >
                  <ImportFile />
                  <Show when={!importInspecting()} fallback="Reading archives…">
                    Import {importSessionCount()} session
                    {importSessionCount() === 1 ? '' : 's'}
                    {importTargetGroupId() !== null ? ' to group' : ''}
                  </Show>
                </button>
              </footer>
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
