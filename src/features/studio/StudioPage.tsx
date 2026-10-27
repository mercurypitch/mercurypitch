// Studio page — local song entry, save recovery and an integrated arrangement workspace.
import { createSignal, Show } from 'solid-js'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { releaseStudioResource } from '@/lib/studio/memory-budget'
import styles from './StudioPage.module.css'
import { StudioProjectList } from './StudioProjectList'
import { StudioWorkspace } from './StudioWorkspace'
import { useStudioController } from './useStudioController'

export function StudioPage() {
  const studio = useStudioController()
  const [downloadError, setDownloadError] = createSignal<string | null>(null)
  const [library, setLibrary] = createSignal(true)
  const [startPanel, setStartPanel] = createSignal<'sources' | 'export' | null>(
    null,
  )
  const [confirmation, setConfirmation] = createSignal<
    'delete' | 'discard' | null
  >(null)
  let backupInput!: HTMLInputElement
  const blocked = () => studio.busy() || studio.hasUnsavedChanges()

  async function create(): Promise<void> {
    if (await studio.create()) {
      setStartPanel('sources')
      setLibrary(false)
    }
  }

  async function open(
    id: string,
    panel: 'export' | null = null,
  ): Promise<void> {
    await studio.open(id)
    if (studio.project()?.id === id) {
      setStartPanel(panel)
      setLibrary(false)
    }
  }

  // A backup from the list loads the song behind the list and saves its file.
  async function backupFromList(id: string): Promise<void> {
    if (studio.project()?.id !== id) await studio.open(id)
    if (studio.project()?.id === id) await downloadBackup()
  }

  async function downloadBackup(): Promise<void> {
    const title = studio.project()?.title ?? 'Studio project'
    const blob = await studio.backup()
    if (!blob) return
    setDownloadError(null)
    let url: string | undefined
    try {
      url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `${title.replace(/[^\p{L}\p{N} ._-]/gu, '').slice(0, 100) || 'Studio project'}.mpstudio`
      anchor.click()
      const savedUrl = url
      setTimeout(() => {
        URL.revokeObjectURL(savedUrl)
        releaseStudioResource(blob)
      }, 10_000)
    } catch {
      if (url !== undefined) URL.revokeObjectURL(url)
      releaseStudioResource(blob)
      setDownloadError(
        'The backup could not download. Try Save project backup again.',
      )
    }
  }

  return (
    <section class={styles.page} aria-label="Studio">
      <Show when={downloadError()}>
        <p role="alert" class={styles.help}>
          {downloadError()}
        </p>
      </Show>
      <input
        ref={backupInput}
        hidden
        type="file"
        aria-label="Open project backup"
        accept=".mpstudio"
        onChange={(event) => {
          const file = event.currentTarget.files?.[0]
          event.currentTarget.value = ''
          if (!file) return
          void studio.restore(file).then((restored) => {
            if (restored) {
              setStartPanel(null)
              setLibrary(false)
            }
          })
        }}
      />
      <Show when={studio.problem()}>
        {(problem) => (
          <div class={styles.notice} role="alert">
            <p>{problem()}</p>
            <div class={styles.actions}>
              <Show when={studio.saveState() === 'error' && studio.writable()}>
                <button
                  type="button"
                  class={styles.button}
                  disabled={studio.busy()}
                  onClick={() => void studio.retrySave()}
                >
                  Retry save
                </button>
              </Show>
              <Show when={studio.project()}>
                <button
                  type="button"
                  class={styles.button}
                  disabled={studio.busy()}
                  onClick={() => void studio.fork()}
                >
                  Make a copy
                </button>
                <button
                  type="button"
                  class={styles.button}
                  disabled={studio.busy()}
                  onClick={() => void downloadBackup()}
                >
                  Save project backup
                </button>
                <button
                  type="button"
                  class={styles.button}
                  disabled={studio.busy()}
                  onClick={() => setConfirmation('discard')}
                >
                  Discard changes and reload
                </button>
              </Show>
            </div>
          </div>
        )}
      </Show>
      <Show
        when={!studio.loading()}
        fallback={
          <p class={styles.loading} role="status">
            Opening project…
          </p>
        }
      >
        <Show
          when={!library() && studio.project()}
          fallback={
            <StudioProjectList
              projects={studio.projects()}
              activeId={studio.project()?.id}
              blocked={blocked()}
              onCreate={() => void create()}
              onOpen={(id) => void open(id)}
              onExport={(id) => void open(id, 'export')}
              onBackup={(id) => void backupFromList(id)}
              onRestore={() => backupInput.click()}
            />
          }
        >
          <Show when={studio.project()?.id} keyed>
            {(_id) => (
              <StudioWorkspace
                studio={studio}
                startPanel={startPanel()}
                onLibrary={() => {
                  setLibrary(true)
                  void studio.refreshProjects()
                }}
                onBackup={() => void downloadBackup()}
                onDelete={() => setConfirmation('delete')}
              />
            )}
          </Show>
        </Show>
      </Show>
      <ConfirmDialog
        open={confirmation() !== null}
        title={
          confirmation() === 'delete'
            ? `Delete “${studio.project()?.title ?? 'this project'}”?`
            : 'Discard changes?'
        }
        message={
          confirmation() === 'delete'
            ? 'This removes the project and its audio copies from this browser. Your original takes stay in the app.'
            : 'Your unsaved changes will be lost. Save a backup or make a copy first if you want to keep them.'
        }
        confirmLabel={
          confirmation() === 'delete' ? 'Delete project' : 'Discard and reload'
        }
        tone="danger"
        onCancel={() => setConfirmation(null)}
        onConfirm={() => {
          const action = confirmation()
          setConfirmation(null)
          if (action === 'delete')
            void studio.deleteProject().then(() => {
              if (!studio.project()) setLibrary(true)
            })
          else void studio.discardAndReload()
        }}
      />
    </section>
  )
}
