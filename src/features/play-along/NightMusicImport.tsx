// Night music import presents one focus-managed, room-skinned action sheet and drop veil.
import { createUniqueId, For, Show } from 'solid-js'
import { Portal } from 'solid-js/web'
import { FileUpload, X } from '@/components/icons'
import { AUDIO_UPLOAD_ACCEPT, formatFileSize, } from '@/lib/audio-upload-contract'
import { FILE_PICKER_UNAVAILABLE_MESSAGE, openFilePicker, } from '@/lib/file-picker'
import { useFocusTrap } from '@/lib/use-focus-trap'
import { NIGHT_MUSIC_FORMATS } from './night-music-import'
import styles from './NightMusicImport.module.css'
import { songImportAcceptForDevice } from './song-import'
import type { NightMusicImportController } from './useNightMusicImport'

export function NightMusicImport(props: {
  controller: NightMusicImportController
}) {
  const titleId = createUniqueId()
  const descriptionId = createUniqueId()
  let panel: HTMLDivElement | undefined
  let input: HTMLInputElement | undefined
  useFocusTrap(() => panel, {
    isOpen: () => props.controller.isOpen(),
    onClose: () => props.controller.close(),
    isolateKeyboard: true,
  })
  const choose = () => {
    if (input)
      openFilePicker(input, {
        onUnavailable: () =>
          props.controller.reportError(FILE_PICKER_UNAVAILABLE_MESSAGE),
      })
  }
  return (
    <>
      <input
        ref={input}
        type="file"
        hidden
        accept={
          props.controller.room === 'piano'
            ? '.mid,.midi'
            : props.controller.room === 'karaoke'
              ? AUDIO_UPLOAD_ACCEPT
              : songImportAcceptForDevice()
        }
        data-testid="night-music-file"
        onChange={(event) => {
          const files = Array.from(event.currentTarget.files ?? [])
          event.currentTarget.value = ''
          if (files.length) props.controller.receive(files)
        }}
      />
      <Show when={props.controller.dragging()}>
        <Portal>
          <div
            class={styles.veil}
            data-room={props.controller.room}
            data-testid="night-music-drop-veil"
          >
            <FileUpload />
            <strong>Bring your music in</strong>
            <span>Drop one file, then choose what happens next.</span>
          </div>
        </Portal>
      </Show>
      <Show when={props.controller.isOpen()}>
        <Portal>
          <div
            class={styles.scrim}
            data-room={props.controller.room}
            onClick={(event) => {
              if (event.target === event.currentTarget) props.controller.close()
            }}
          >
            <div
              ref={panel}
              class={styles.panel}
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              aria-describedby={descriptionId}
              tabindex="-1"
              data-testid="night-music-import"
            >
              <div class={styles.heading}>
                <div>
                  <span class={styles.room}>
                    {props.controller.room === 'drums'
                      ? 'Drum'
                      : props.controller.room}{' '}
                    Night
                  </span>
                  <h2 id={titleId}>Add music</h2>
                </div>
                <button
                  class={styles.close}
                  type="button"
                  aria-label={
                    props.controller.running()
                      ? 'Cancel import and close'
                      : 'Close Add music'
                  }
                  onClick={() => props.controller.close()}
                >
                  <X />
                </button>
              </div>
              <p id={descriptionId} class={styles.intro}>
                Stay in the room. Choose a file and how you want to play it.
              </p>
              <Show when={props.controller.currentTitle()}>
                {(title) => (
                  <p class={styles.current}>
                    On stage <strong>{title()}</strong>
                    <span>
                      Replacement changes this session, not your saved music.
                    </span>
                  </p>
                )}
              </Show>
              <button
                class={styles.file}
                type="button"
                disabled={props.controller.running()}
                onClick={choose}
              >
                <FileUpload />
                <span>
                  <strong>
                    {props.controller.file()?.name ?? 'Choose a file'}
                  </strong>
                  <small>
                    {props.controller.file()
                      ? `${formatFileSize(props.controller.file()!.size)} · Choose a different file`
                      : NIGHT_MUSIC_FORMATS[props.controller.room]}
                  </small>
                </span>
              </button>
              <Show when={props.controller.blockedReason()}>
                {(reason) => (
                  <p class={styles.notice} role="status">
                    {reason()} Your selected file will stay here while you
                    return to the session.
                  </p>
                )}
              </Show>
              <Show when={props.controller.error()}>
                {(message) => (
                  <p class={styles.error} role="alert">
                    {message()}
                  </p>
                )}
              </Show>
              <Show when={props.controller.recovery()}>
                {(recovery) => (
                  <button
                    type="button"
                    onClick={() => props.controller.recover()}
                  >
                    {recovery().label}
                  </button>
                )}
              </Show>
              <For each={props.controller.warnings()}>
                {(message) => (
                  <p class={styles.notice} role="status">
                    {message}
                  </p>
                )}
              </For>
              <Show
                when={props.controller.running()}
                fallback={
                  <div class={styles.actions}>
                    <For each={props.controller.actions()}>
                      {(action) => (
                        <button
                          type="button"
                          disabled={Boolean(
                            action.unavailable !== undefined ||
                            props.controller.blockedReason() !== null,
                          )}
                          onClick={() => void props.controller.run(action)}
                        >
                          <strong>{action.label}</strong>
                          <span>{action.unavailable ?? action.detail}</span>
                        </button>
                      )}
                    </For>
                  </div>
                }
              >
                <div class={styles.progress} role="status">
                  <strong>{props.controller.status()}</strong>
                  <Show
                    when={props.controller.progress() !== undefined}
                    fallback={
                      <progress max="1" aria-label="Music preparation" />
                    }
                  >
                    <progress
                      max="1"
                      value={props.controller.progress() ?? 0}
                      aria-label="Music preparation"
                    />
                  </Show>
                  <button
                    type="button"
                    onClick={() => props.controller.cancel()}
                  >
                    Cancel preparation
                  </button>
                  <small>
                    Cancellation does not delete a source already saved to your
                    library.
                  </small>
                </div>
              </Show>
              <Show
                when={!props.controller.running() && props.controller.status()}
              >
                <p role="status" class={styles.notice}>
                  {props.controller.status()}
                </p>
              </Show>
              <div class={styles.footer}>
                <span>Nothing starts playing automatically.</span>
                <button type="button" onClick={() => props.controller.close()}>
                  {props.controller.running()
                    ? 'Cancel and return'
                    : 'Back to session'}
                </button>
              </div>
            </div>
          </div>
        </Portal>
      </Show>
    </>
  )
}
