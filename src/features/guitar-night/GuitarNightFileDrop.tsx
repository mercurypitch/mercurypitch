// ============================================================
// GuitarNightFileDrop turns any song well into a focused, accessible import surface.
// ============================================================

import type { JSX } from 'solid-js'
import type { UnifiedSongFileDropClasses, UnifiedSongFileDropCopy, } from '@/features/play-along/UnifiedSongFileDrop'
import { UnifiedSongFileDrop } from '@/features/play-along/UnifiedSongFileDrop'
import { GUITAR_NIGHT_IMPORT_ACCEPT, GUITAR_NIGHT_IMPORT_DROP_COPY, GUITAR_NIGHT_IMPORT_FORMATS, } from './guitar-night-import'
import styles from './GuitarNightApp.module.css'

export interface GuitarNightFileDropProps {
  children: JSX.Element
  onChoose: () => void
  onFile: (file: File) => void
  onRejected: (files: readonly File[]) => void
  disabled?: boolean
  busy?: boolean
  openingFileName?: string | null
  message?: string | null
  class?: string
}

const GUITAR_NIGHT_FILE_DROP_COPY: UnifiedSongFileDropCopy = {
  chooseFile: 'Choose a file',
  dropAlternative: 'or drop it here',
  formats: GUITAR_NIGHT_IMPORT_FORMATS,
  activeDrop: GUITAR_NIGHT_IMPORT_DROP_COPY,
  oneFile: 'One file at a time',
  opening: (fileName) => `Opening ${fileName}…`,
}

const GUITAR_NIGHT_FILE_DROP_CLASSES: UnifiedSongFileDropClasses = {
  root: styles.guitarNightFileDrop,
  status: styles.guitarNightFileDropStatus,
  prompt: styles.guitarNightFileDropPrompt,
  choose: styles.guitarNightFileDropChoose,
  dropAlternative: styles.guitarNightFileDropOr,
  formats: styles.guitarNightFileDropFormats,
  overlay: styles.guitarNightFileDropOverlay,
}

export function GuitarNightFileDrop(props: GuitarNightFileDropProps) {
  return (
    <UnifiedSongFileDrop
      accept={GUITAR_NIGHT_IMPORT_ACCEPT}
      copy={GUITAR_NIGHT_FILE_DROP_COPY}
      classes={GUITAR_NIGHT_FILE_DROP_CLASSES}
      testId="guitar-night-file-drop"
      class={props.class}
      disabled={props.disabled}
      busy={props.busy}
      openingFileName={props.openingFileName}
      message={props.message}
      onChoose={props.onChoose}
      onFile={props.onFile}
      onRejected={props.onRejected}
    >
      {props.children}
    </UnifiedSongFileDrop>
  )
}
