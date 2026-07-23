import type { Component } from 'solid-js'
import { createSignal, createUniqueId, onCleanup, Show } from 'solid-js'
import { getOriginalFileBlob } from '@/db/services/uvr-service'
import { showNotification } from '@/stores/notifications-store'
import type { UvrSession } from '@/stores/uvr-store'
import { ChevronDown, Download, Zap } from './icons'

interface UvrSessionActionsProps {
  sessionId: string
  session?: UvrSession
  originalFileName?: string
  disabled?: boolean
  onRerunHq?: (sessionId: string, target: 'same' | 'new') => void
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
  const menuId = `uvr-hq-menu-${createUniqueId()}`
  let menuRoot: HTMLDivElement | undefined
  let menuTrigger: HTMLButtonElement | undefined
  let menu: HTMLDivElement | undefined
  let menuChevron: HTMLSpanElement | undefined
  let menuListenersAttached = false

  const canDownloadOriginal = () =>
    props.session?.status === 'completed' && props.session.originalFile != null

  const canRerunHq = () =>
    props.session?.status === 'completed' &&
    props.session.processingMode === 'local' &&
    props.session.provider !== 'manual' &&
    props.session.originalFile != null &&
    props.onRerunHq !== undefined

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
    </>
  )
}
