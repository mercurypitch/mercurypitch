// ── UvrSessionActions ────────────────────────────────────────────────
// Everything a finished song can have done to it, behind one "...".
//
// These were seven buttons in a row on the session card, next to four
// more the card drew itself: up to eight controls before the page showed
// the SECOND card. Every feature since has been added to the same row,
// which is how a row becomes a wall.
//
// The card keeps ONE primary action and hands the rest here. The parent
// passes its own rows in through `extraItems` so there is a single menu
// per card rather than two competing ones.

import type { Component } from 'solid-js'
import { createMemo, createSignal, Show } from 'solid-js'
import type { SessionExportStemType } from '@/db/services/session-export-service'
import { exportSession, listSessionExportStems, } from '@/db/services/session-export-service'
import { getOriginalFileBlob } from '@/db/services/uvr-service'
import { showNotification } from '@/stores/notifications-store'
import type { UvrSession } from '@/stores/uvr-store'
import { DeviceSync, Download, Zap } from './icons'
import type { OverflowMenuItem } from './OverflowMenu'
import { OverflowMenu } from './OverflowMenu'
import type { SessionExportPreset } from './SessionExportDialog'
import { SessionExportDialog } from './SessionExportDialog'

interface UvrSessionActionsProps {
  sessionId: string
  session?: UvrSession
  originalFileName?: string
  disabled?: boolean
  onRerunHq?: (sessionId: string, target: 'same' | 'new') => void
  /** Push this song to another of the user's devices (device sync). */
  onSendToDevice?: (sessionId: string) => void
  /** The card's own rows — group, share, delete — so there is one menu. */
  extraItems?: OverflowMenuItem[]
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

  // The bundle needs the content hash: it is the song's identity on the
  // other device, and without it dedupe cannot answer "already have it".
  const canSendToDevice = () =>
    props.session?.status === 'completed' &&
    props.session.fileHash !== undefined &&
    props.session.fileHash !== '' &&
    props.onSendToDevice !== undefined
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

  const handleArchiveExport = async (): Promise<void> => {
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

  const handleDownloadOriginal = (): void => {
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

  const runHq = (target: 'same' | 'new'): void => {
    props.onRerunHq?.(props.sessionId, target)
  }

  /**
   * The rows this component owns, followed by the card's own.
   *
   * Order is deliberate: what somebody does often first, what leaves the
   * device next, and the two that replace stems last — those carry
   * `destructive`, so the menu fences them off below a divider whatever
   * order they are listed in here.
   */
  const items = createMemo((): OverflowMenuItem[] => {
    const rows: OverflowMenuItem[] = []
    if (canSendToDevice()) {
      rows.push({
        key: 'send',
        label: 'Send to another device',
        icon: () => <DeviceSync />,
        disabled: props.disabled === true,
        onSelect: () => props.onSendToDevice?.(props.sessionId),
      })
    }
    if (canDownloadOriginal()) {
      rows.push({
        key: 'original',
        label: downloadingOriginal()
          ? 'Preparing the original…'
          : 'Download the original file',
        note: 'The full mix you uploaded',
        icon: () => <Download />,
        disabled: props.disabled === true || downloadingOriginal(),
        onSelect: handleDownloadOriginal,
      })
    }
    if (canExportArchive()) {
      rows.push({
        key: 'export-zip',
        label: archiveInspecting()
          ? 'Checking…'
          : archiveExporting() && !archiveDialogOpen()
            ? `Packing ${archiveProgress()}%`
            : 'Export session ZIP',
        note: 'A restorable copy, for a backup or another browser',
        icon: () => <Download />,
        disabled:
          props.disabled === true || archiveInspecting() || archiveExporting(),
        onSelect: () => void handleArchiveExport(),
      })
    }
    rows.push(...(props.extraItems ?? []))
    if (canRerunHq()) {
      rows.push(
        {
          key: 'hq-same',
          label: 'Upgrade to HQ stems',
          note: 'Replaces these stems — runs on the cloud GPU, uses credits',
          icon: () => <Zap />,
          disabled: props.disabled === true,
          destructive: true,
          onSelect: () => runHq('same'),
        },
        {
          key: 'hq-new',
          label: 'New HQ session to compare',
          note: 'Keeps this one — the HQ result arrives separately',
          icon: () => <Zap />,
          disabled: props.disabled === true,
          onSelect: () => runHq('new'),
        },
      )
    }
    return rows
  })

  /**
   * The only row, when there is only one.
   *
   * A menu that opens to reveal a single item is two taps for one thing,
   * and on a server-separated song that is exactly what this was: no
   * original file stored, no local re-run to offer, so "Export session
   * ZIP" sat alone behind a "...". One row becomes one button; two or
   * more keep the menu.
   */
  const soleItem = createMemo(() => {
    const rows = items()
    return rows.length === 1 ? rows[0] : null
  })

  return (
    <>
      {/* One trigger for the whole card. Rendered even when the only rows
          are the parent's, because a card with no menu and a card with a
          menu in a different place is a list that does not scan. */}
      <Show
        when={soleItem()}
        fallback={
          <OverflowMenu
            label="More actions for this song"
            testId="session-more"
            triggerClass="session-result-more"
            items={items()}
            disabled={props.disabled}
          />
        }
      >
        {(row) => (
          <button
            type="button"
            class="session-result-more session-result-sole"
            data-testid="session-more"
            aria-label={row().label}
            title={row().label}
            disabled={props.disabled === true || row().disabled === true}
            onClick={() => row().onSelect()}
          >
            {row().icon?.() ?? <Download />}
          </button>
        )}
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
