// ============================================================
// SheetMusicView — Standard notation view for melodies
// ============================================================

import type { Component } from 'solid-js'
import { createEffect, onCleanup, onMount } from 'solid-js'
import { renderSheetMusic } from '@/lib/sheet-music-renderer'
import type { MelodyItem } from '@/types'
import styles from './SheetMusicView.module.css'

interface SheetMusicViewProps {
  melody: () => MelodyItem[]
  key: () => string
  scaleType: () => string
  beatsPerBar?: number
}

export const SheetMusicView: Component<SheetMusicViewProps> = (props) => {
  let containerRef: HTMLDivElement | undefined

  const draw = (): void => {
    if (!containerRef) return
    renderSheetMusic({
      container: containerRef,
      melody: props.melody(),
      key: props.key(),
      scaleType: props.scaleType(),
      beatsPerBar: props.beatsPerBar,
    })
  }

  onMount(() => {
    draw()
  })

  createEffect(() => {
    // Track reactive dependencies
    props.melody()
    props.key()
    props.scaleType()
    draw()
  })

  onCleanup(() => {
    if (containerRef) containerRef.innerHTML = ''
  })

  return (
    <div
      ref={containerRef}
      class={styles.sheetMusicContainer}
      data-tour="compose.sheet-music"
    />
  )
}
