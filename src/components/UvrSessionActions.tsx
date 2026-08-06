import type { Component } from 'solid-js'
import { createSignal, createUniqueId, onCleanup, Show } from 'solid-js'
import type { SessionExportStemType } from '@/db/services/session-export-service'
import { exportSession, listSessionExportStems, } from '@/db/services/session-export-service'
import { getOriginalFileBlob } from '@/db/services/uvr-service'
import { showNotification } from '@/stores/notifications-store'
import type { UvrSession } from '@/stores/uvr-store'
import { ChevronDown, Download, Zap } from './icons'
import type { SessionExportPreset } from './SessionExportDialog'
import { SessionExportDialog } from './SessionExportDialog'

interface UvrSessionActionsProps {
  sessionId: string
  session?: UvrSession
  originalFileName?: string
  disabled?: boolean
  onRerunHq?: (sessionId: string, target: 'same' | 'new') => void
}

interface SessionExportTarget {
  sessionId: string
  sessionName: string
}

const CORE_EXPORT_STEMS: readonly SessionExportStemType[] = [
  'vocal',
  'instrumental',
]

function coreExportStems(
  available: readonly SessionExportStemType[],
): SessionExportStemType[] {
  return CORE_EXPORT_STEMS.filter((stem) => available.includes(stem))
}

function hasAdditionalStems(
  available: readonly SessionExportStemType[],
): boolean {
  return available.some((stem) => !CORE_EXPORT_STEMS.includes(stem))
}

function downloadBlob(file: File, filename: string): void {
  const url = URL.createObjectURL(file)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export const UvrSessionActions: Component<UvrSessionActionsProps> = (props) => {
  const [downloadingOriginal, setDownloadingOriginal] = createSignal(false)
  const [archiveInspecting, setArchiveInspecting] = createSignal(false)
  const [archiveExporting, setArchiveExporting] = createSignal(false)
  const [archiveProgress, setArchiveProgress] = createSignal(0)
  const [archiveDialogOpen, setArchiveDialogOpen] = createSignal(false)
  const [archiveTarget, setArchiveTarget] =
    createSignal<SessionExportTarget | null>(null)
  const [archiveAvailable, setArchiveAvailable] = createSignal<
    SessionExportStemType[]
  >([])
  const [archiveSelected, setArchiveSelected] = createSignal<
    SessionExportStemType[]
  >([])
  const [archivePreset, setArchivePreset] =
    createSignal<SessionExportPreset>('all')
  const [archiveError, setArchiveError] = createSignal('')
  const menuId = `uvr-hq-menu-${createUniqueId()}`
  let menuRoot: HTMLDivElement | undefined
  let menuTrigger: HTMLButtonElement | undefined
  let menu: HTMLDivElement | undefined
  let menuChevron: HTMLSpanElement | undefined
  let menuListenersAttached = false

  const canDownloadOriginal = () =>
    props.session?.status === 'completed' &&
    props.session.originalFile != null &&
    props.session.originalFile.size > 0

  const canRerunHq = () =>
    props.session?.status === 'completed' &&
    props.session.processingMode === 'local' &&
    props.session.provider !== 'manual' &&
    props.session.originalFile != null &&
    props.session.originalFile.size > 0 &&
    props.onRerunHq !== undefined

  const canExportArchive = () => props.session?.status === 'completed'
  const archiveHasCoreStem = () =>
    archiveSelected().some((stem) => CORE_EXPORT_STEMS.includes(stem))

  const closeArchiveDialog = (): void => {
    if (archiveExporting()) return
    setArchiveDialogOpen(false)
    setArchiveError('')
  }

  const setExportPreset = (preset: SessionExportPreset): void => {
    const available = archiveAvailable()
    setArchivePreset(preset)
    if (preset === 'all') setArchiveSelected([...available])
    if (preset === 'core') setArchiveSelected(coreExportStems(available))
  }

  const toggleExportStem = (stem: SessionExportStemType): void => {
    setArchivePreset('custom')
    setArchiveSelected((current) =>
      current.includes(stem)
        ? current.filter((candidate) => candidate !== stem)
        : archiveAvailable().filter(
            (candidate) => current.includes(candidate) || candidate === stem,
          ),
    )
  }

  const runArchiveExport = async (
    target: SessionExportTarget,
    selectedStems: readonly SessionExportStemType[],
  ): Promise<void> => {
    if (archiveExporting() || selectedStems.length === 0) return
    setArchiveExporting(true)
    setArchiveProgress(0)
    setArchiveError('')
    try {
      await exportSession(
        target.sessionId,
        (progress) => setArchiveProgress(Math.round(progress)),
        selectedStems,
      )
      setArchiveDialogOpen(false)
      showNotification(
        `“${target.sessionName}” session ZIP is ready.`,
        'success',
      )
    } catch (error) {
      console.error('[UvrSessionActions] session export failed:', error)
      const message =
        error instanceof Error && error.name === 'ArchiveExportBusyError'
          ? 'Another archive is already being prepared. Try again when it finishes.'
          : 'The session ZIP could not be created. Please try again.'
      setArchiveError(message)
      showNotification(message, 'error')
    } finally {
      setArchiveExporting(false)
    }
  }

  const handleArchiveExport = async (event: MouseEvent): Promise<void> => {
    event.stopPropagation()
    if (archiveInspecting() || archiveExporting()) return

    // Capture every reactive prop before the async stem lookup. The action
    // must keep exporting the session the user clicked if navigation changes.
    const target: SessionExportTarget = {
      sessionId: props.sessionId,
      sessionName:
        props.originalFileName ??
        props.session?.originalFile?.name ??
        'Untitled session',
    }

    setArchiveInspecting(true)
    try {
      const available = await listSessionExportStems(target.sessionId)
      if (available.length === 0) {
        showNotification(
          'No stored audio stems are available for this session.',
          'warning',
        )
        return
      }
      if (coreExportStems(available).length === 0) {
        showNotification(
          'A Vocal or Instrumental stem is required for a restorable session archive.',
          'warning',
        )
        return
      }
      if (!hasAdditionalStems(available)) {
        void runArchiveExport(target, available)
        return
      }

      setArchiveTarget(target)
      setArchiveAvailable(available)
      setArchiveSelected([...available])
      setArchivePreset('all')
      setArchiveError('')
      setArchiveProgress(0)
      setArchiveDialogOpen(true)
    } catch (error) {
      console.error('[UvrSessionActions] stem lookup failed:', error)
      showNotification('Stored stems could not be read.', 'error')
    } finally {
      setArchiveInspecting(false)
    }
  }

  const submitArchiveExport = (): void => {
    const target = archiveTarget()
    const selected = archiveSelected()
    if (target === null || selected.length === 0 || !archiveHasCoreStem())
      return
    void runArchiveExport(target, selected)
  }

  const handleDownloadOriginal = (event: MouseEvent): void => {
    event.stopPropagation()
    if (downloadingOriginal()) return

    // Capture reactive props before entering the async continuation.
    const sessionId = props.sessionId
    const filename =
      props.originalFileName ?? props.session?.originalFile?.name ?? ''

    setDownloadingOriginal(true)
    void getOriginalFileBlob(sessionId)
      .then((file) => {
        if (!file) {
          showNotification(
            "The original file isn't stored for this session.",
            'warning',
          )
          return
        }
        downloadBlob(file, filename || file.name)
      })
      .catch((error: unknown) => {
        console.error('[UvrSessionActions] original download failed:', error)
        showNotification('Could not read the original file.', 'error')
      })
      .finally(() => setDownloadingOriginal(false))
  }

  const removeMenuListeners = (): void => {
    if (!menuListenersAttached) return
    menuListenersAttached = false
    document.removeEventListener('pointerdown', closeOnOutsidePointer)
    document.removeEventListener('keydown', closeOnEscape)
  }

  const setMenuOpen = (open: boolean): void => {
    if (!menu || !menuTrigger || !menuChevron) return

    menu.hidden = !open
    menuTrigger.setAttribute('aria-expanded', String(open))
    menuChevron.classList.toggle('open', open)

    if (open && !menuListenersAttached) {
      menuListenersAttached = true
      document.addEventListener('pointerdown', closeOnOutsidePointer)
      document.addEventListener('keydown', closeOnEscape)
    } else if (!open) {
      removeMenuListeners()
    }
  }

  function closeOnOutsidePointer(event: PointerEvent): void {
    if (menuRoot?.contains(event.target as Node) !== true) {
      setMenuOpen(false)
    }
  }

  function closeOnEscape(event: KeyboardEvent): void {
    if (event.key !== 'Escape' || menu?.hidden !== false) return
    event.preventDefault()
    setMenuOpen(false)
    menuTrigger?.focus()
  }

  const runHq = (target: 'same' | 'new'): void => {
    const sessionId = props.sessionId
    const onRerunHq = props.onRerunHq
    setMenuOpen(false)
    onRerunHq?.(sessionId, target)
  }

  onCleanup(removeMenuListeners)

  return (
    <>
      <Show when={canDownloadOriginal()}>
        <button
          type="button"
          class="session-result-btn"
          disabled={props.disabled === true || downloadingOriginal()}
          onClick={handleDownloadOriginal}
          title="Download the original uploaded file (full mix)"
        >
          <Download /> {downloadingOriginal() ? 'Preparing…' : 'Original'}
        </button>
      </Show>
      <Show when={canExportArchive()}>
        <button
          type="button"
          class="session-result-btn session-result-btn-export"
          disabled={props.disabled === true || archiveExporting()}
          aria-disabled={archiveInspecting() ? true : undefined}
          aria-busy={
            archiveInspecting() || archiveExporting() ? true : undefined
          }
          onClick={(event) => void handleArchiveExport(event)}
          title="Export a restorable session ZIP"
        >
          <Download />
          <span aria-live="polite">
            {archiveInspecting()
              ? 'Checking…'
              : archiveExporting() && !archiveDialogOpen()
                ? `Packing ${archiveProgress()}%`
                : 'Export ZIP'}
          </span>
        </button>
      </Show>
      <Show when={canRerunHq()}>
        <div class="session-hq-rerun" ref={menuRoot}>
          <button
            ref={menuTrigger}
            type="button"
            class="session-result-btn session-result-btn-hq"
            disabled={props.disabled === true}
            aria-controls={menuId}
            aria-expanded="false"
            aria-haspopup="menu"
            onClick={(event) => {
              event.stopPropagation()
              setMenuOpen(menu?.hidden !== false)
            }}
            title="Re-run this song on the cloud GPU for higher-quality stems"
          >
            <Zap /> HQ
            <span
              ref={menuChevron}
              class="session-hq-rerun-chevron"
              aria-hidden="true"
            >
              <ChevronDown size={12} />
            </span>
          </button>
          <div
            ref={menu}
            id={menuId}
            class="session-hq-rerun-menu"
            role="menu"
            aria-label="HQ processing options"
            hidden
          >
            <button
              type="button"
              class="session-hq-rerun-item"
              role="menuitem"
              onClick={() => runHq('same')}
            >
              Upgrade this session
              <span class="session-hq-rerun-item-note">
                Replaces these stems with cloud HQ stems
              </span>
            </button>
            <button
              type="button"
              class="session-hq-rerun-item"
              role="menuitem"
              onClick={() => runHq('new')}
            >
              New session to compare
              <span class="session-hq-rerun-item-note">
                Keeps this one — the HQ result arrives separately
              </span>
            </button>
            <div class="session-hq-rerun-hint">
              Runs on the cloud GPU — uses credits
            </div>
          </div>
        </div>
      </Show>
      <SessionExportDialog
        open={archiveDialogOpen()}
        available={archiveAvailable()}
        selected={archiveSelected()}
        preset={archivePreset()}
        progress={archiveProgress()}
        busy={archiveExporting()}
        error={archiveError()}
        onPresetChange={setExportPreset}
        onStemToggle={toggleExportStem}
        onSubmit={submitArchiveExport}
        onClose={closeArchiveDialog}
      />
    </>
  )
}
