// Studio page — browser-local projects and explicit imports from kept takes or files.
import { createSignal, For, Show } from 'solid-js'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { FileUpload, Plus, WaveformBars } from '@/components/icons'
import styles from './StudioPage.module.css'
import { StudioSourcePicker } from './StudioSourcePicker'
import { useStudioController } from './useStudioController'

export function StudioPage() {
  const studio = useStudioController()
  const [showSources, setShowSources] = createSignal(false)
  const [confirmation, setConfirmation] = createSignal<
    'delete' | 'discard' | null
  >(null)
  let audioInput!: HTMLInputElement
  let backupInput!: HTMLInputElement
  const blocked = () => studio.busy() || studio.hasUnsavedChanges()
  const status = () =>
    !studio.writable()
      ? 'Read only'
      : {
          saved: 'Saved in this browser',
          unsaved: 'Changes not saved',
          saving: 'Saving…',
          error: 'Changes not saved',
        }[studio.saveState()]

  async function downloadBackup(): Promise<void> {
    const title = studio.project()?.title ?? 'Studio project'
    const blob = await studio.backup()
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${title.replace(/[^\p{L}\p{N} ._-]/gu, '').slice(0, 100) || 'Studio project'}.mpstudio`
    anchor.click()
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
  }

  return (
    <section class={styles.page} aria-label="Studio">
      <div class={styles.heading}>
        <div>
          <span class={styles.eyebrow}>STUDIO</span>
          <h1>Your takes, together.</h1>
        </div>
        <div class={styles.actions}>
          <button
            type="button"
            disabled={blocked()}
            onClick={() => backupInput.click()}
          >
            Open backup
          </button>
          <button
            type="button"
            class={styles.primary}
            disabled={blocked()}
            onClick={() => void studio.create()}
          >
            <Plus size={16} /> New project
          </button>
        </div>
      </div>
      <p class={styles.localNote}>
        Projects stay in this browser. Save a project backup to keep a copy
        elsewhere.
      </p>
      <input
        ref={audioInput}
        hidden
        type="file"
        accept="audio/*,.wav,.mp3,.m4a,.ogg,.flac"
        onChange={(event) => {
          const file = event.currentTarget.files?.[0]
          event.currentTarget.value = ''
          if (file) void studio.addFile(file)
        }}
      />
      <input
        ref={backupInput}
        hidden
        type="file"
        accept=".mpstudio"
        onChange={(event) => {
          const file = event.currentTarget.files?.[0]
          event.currentTarget.value = ''
          if (file) void studio.restore(file)
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
                  disabled={studio.busy()}
                  onClick={() => void studio.retrySave()}
                >
                  Retry save
                </button>
              </Show>
              <Show when={studio.project()}>
                <button
                  type="button"
                  disabled={studio.busy()}
                  onClick={() => void studio.fork()}
                >
                  Make a copy
                </button>
                <button
                  type="button"
                  disabled={studio.busy()}
                  onClick={() => void downloadBackup()}
                >
                  Save project backup
                </button>
                <button
                  type="button"
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
      <div class={styles.workspace}>
        <nav class={styles.projects} aria-label="Studio projects">
          <h2>On this device</h2>
          <Show
            when={studio.projects().length}
            fallback={<p>No projects yet.</p>}
          >
            <For each={studio.projects()}>
              {(project) => (
                <button
                  type="button"
                  class={styles.projectRow}
                  aria-current={
                    studio.project()?.id === project.id ? 'true' : undefined
                  }
                  disabled={blocked()}
                  onClick={() => {
                    setShowSources(false)
                    void studio.open(project.id)
                  }}
                >
                  <WaveformBars size={18} />
                  <span>
                    <strong>{project.title}</strong>
                    <small>
                      {project.trackCount}{' '}
                      {project.trackCount === 1 ? 'track' : 'tracks'}
                    </small>
                  </span>
                </button>
              )}
            </For>
          </Show>
        </nav>
        <div class={styles.project} aria-busy={studio.loading()}>
          <Show
            when={!studio.loading()}
            fallback={<p role="status">Opening project…</p>}
          >
            <Show
              when={studio.project()}
              fallback={
                <div class={styles.empty}>
                  <WaveformBars size={40} />
                  <h2>Start with something you played.</h2>
                  <p>
                    Create a project, then add a kept take or an audio file.
                  </p>
                  <button
                    type="button"
                    class={styles.primary}
                    disabled={blocked()}
                    onClick={() => void studio.create()}
                  >
                    Create project
                  </button>
                </div>
              }
            >
              {(project) => (
                <>
                  <div class={styles.projectHeading}>
                    <label class={styles.titleLabel}>
                      <span class={styles.srOnly}>Project name</span>
                      <input
                        aria-label="Project name"
                        value={project().title}
                        maxLength={160}
                        disabled={!studio.writable() || studio.busy()}
                        onChange={(event) =>
                          studio.rename(event.currentTarget.value)
                        }
                      />
                    </label>
                    <span class={styles.status} role="status">
                      {status()}
                    </span>
                  </div>
                  <Show when={!studio.writable()}>
                    <div class={styles.notice}>
                      <p>
                        This project is open in another tab, or editing has
                        expired here.
                      </p>
                      <button
                        type="button"
                        disabled={studio.busy()}
                        onClick={() => void studio.takeOver()}
                      >
                        Edit in this tab
                      </button>
                    </div>
                  </Show>
                  <div class={styles.actions}>
                    <button
                      type="button"
                      class={styles.primary}
                      disabled={!studio.writable() || studio.busy()}
                      onClick={() => {
                        setShowSources(!showSources())
                        if (showSources()) void studio.refreshSources()
                      }}
                    >
                      <Plus size={16} /> Add take
                    </button>
                    <button
                      type="button"
                      disabled={!studio.writable() || studio.busy()}
                      onClick={() => audioInput.click()}
                    >
                      <FileUpload /> Upload audio
                    </button>
                    <button
                      type="button"
                      disabled={studio.busy()}
                      onClick={() => void downloadBackup()}
                    >
                      Save project backup
                    </button>
                  </div>
                  <Show when={studio.importing()}>
                    <div class={styles.notice} role="status">
                      Preparing audio…{' '}
                      <button type="button" onClick={studio.cancelImport}>
                        Cancel import
                      </button>
                    </div>
                  </Show>
                  <Show when={showSources()}>
                    <StudioSourcePicker studio={studio} />
                  </Show>
                  <Show
                    when={project().tracks.length}
                    fallback={
                      <div class={styles.empty}>
                        <WaveformBars size={40} />
                        <h2>Add your first take.</h2>
                        <p>
                          Keep a recording in Hear Yourself, Karaoke, Guitar,
                          Piano or Drums, then bring it here.
                        </p>
                      </div>
                    }
                  >
                    <ol class={styles.tracks} aria-label="Project tracks">
                      <For each={project().tracks}>
                        {(track) => (
                          <li>
                            <WaveformBars size={20} />
                            <strong>{track.name}</strong>
                            <span>
                              {
                                project().clips.filter(
                                  (clip) => clip.trackId === track.id,
                                ).length
                              }{' '}
                              audio clips
                            </span>
                          </li>
                        )}
                      </For>
                    </ol>
                  </Show>
                  <div class={styles.projectFoot}>
                    <button
                      type="button"
                      disabled={!studio.writable() || blocked()}
                      onClick={() => setConfirmation('delete')}
                    >
                      Delete project
                    </button>
                  </div>
                </>
              )}
            </Show>
          </Show>
        </div>
      </div>
      <ConfirmDialog
        open={confirmation() !== null}
        title={
          confirmation() === 'delete'
            ? 'Delete this project?'
            : 'Discard changes?'
        }
        message={
          confirmation() === 'delete'
            ? 'This removes the project and its audio copies from this browser. Your original takes stay in Hear Yourself.'
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
          if (action === 'delete') void studio.deleteProject()
          else void studio.discardAndReload()
        }}
      />
    </section>
  )
}
