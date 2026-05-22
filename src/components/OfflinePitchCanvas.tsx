import type { Component } from 'solid-js'
import { createEffect, createSignal, For, onCleanup, onMount } from 'solid-js'
import type { MelodyItem } from '@/types'
import type { TimeStampedPitchSample } from '@/types/pitch-algorithms'

export interface OfflinePitchCanvasProps {
  waveform: Float32Array | null
  durationSec: number
  analysisResults: { algorithm: string; pitches: TimeStampedPitchSample[] }[]
  segmentedNotes?: MelodyItem[]
  audioFile?: File | Blob | null
}

const ALGO_COLORS: Record<string, string> = {
  yin: 'rgba(248, 81, 73, 0.8)',      // Red
  fft: 'rgba(88, 166, 255, 0.8)',     // Blue
  autocorr: 'rgba(63, 185, 80, 0.8)', // Green
  swift: 'rgba(163, 113, 247, 0.8)',  // Purple
}

const MIN_FREQ = 55 // A1
const MAX_FREQ = 2093 // C7
const LOG_MIN = Math.log2(MIN_FREQ)
const LOG_RANGE = Math.log2(MAX_FREQ) - LOG_MIN

export const OfflinePitchCanvas: Component<OfflinePitchCanvasProps> = (props) => {
  let canvasRef: HTMLCanvasElement | undefined
  let ctx: CanvasRenderingContext2D | null = null
  let resizeObserver: ResizeObserver | null = null
  let animFrameId: number | null = null
  let bgCanvas: HTMLCanvasElement | null = null
  let bgCtx: CanvasRenderingContext2D | null = null
  let lastDrawState = { w: 0, h: 0, sx: -1, zoom: -1, hidden: new Set<string>() }
  let forceRedraw = true

  createEffect(() => {
    props.waveform;
    props.analysisResults;
    props.segmentedNotes;
    forceRedraw = true;
  });

  const [hiddenAlgos, setHiddenAlgos] = createSignal<Set<string>>(new Set())

  const toggleAlgo = (algo: string) => {
    setHiddenAlgos(prev => {
      const next = new Set(prev)
      if (next.has(algo)) next.delete(algo)
      else next.add(algo)
      return next
    })
    forceRedraw = true
    requestAnimationFrame(draw)
  }

  const [zoom, setZoom] = createSignal(1)
  const [scrollX, setScrollX] = createSignal(0)

  const handleWheel = (e: WheelEvent) => {
    e.preventDefault()
    if (e.ctrlKey) {
      const zoomFactor = Math.exp(-e.deltaY / 200)
      setZoom(prev => {
        const nextZoom = Math.max(1, Math.min(prev * zoomFactor, 100))
        const mouseX = e.offsetX
        const newScrollX = ((scrollX() + mouseX) / prev) * nextZoom - mouseX
        const maxScroll = (canvasRef!.clientWidth * nextZoom) - canvasRef!.clientWidth
        setScrollX(Math.max(0, Math.min(newScrollX, maxScroll)))
        return nextZoom
      })
    } else {
      setScrollX(prev => {
        const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY
        const maxScroll = (canvasRef!.clientWidth * zoom()) - canvasRef!.clientWidth
        return Math.max(0, Math.min(prev + delta, maxScroll))
      })
    }
  }

  let isDragging = false
  let dragMoved = false
  let lastX = 0

  let audio: HTMLAudioElement | null = null
  const [isPlaying, setIsPlaying] = createSignal(false)

  createEffect(() => {
    if (props.audioFile) {
      const url = URL.createObjectURL(props.audioFile)
      if (audio) { audio.pause(); audio.src = '' }
      audio = new Audio(url)
      
      const onEnded = () => setIsPlaying(false)
      const onPlay = () => setIsPlaying(true)
      const onPause = () => setIsPlaying(false)

      audio.addEventListener('ended', onEnded)
      audio.addEventListener('play', onPlay)
      audio.addEventListener('pause', onPause)

      onCleanup(() => {
        if (audio) {
          audio.removeEventListener('ended', onEnded)
          audio.removeEventListener('play', onPlay)
          audio.removeEventListener('pause', onPause)
          audio.pause()
          audio.src = ''
        }
        URL.revokeObjectURL(url)
      })
    }
  })

  const handlePointerDown = (e: PointerEvent) => {
    isDragging = true
    dragMoved = false
    lastX = e.clientX
    canvasRef?.setPointerCapture(e.pointerId)
  }

  const handlePointerMove = (e: PointerEvent) => {
    if (!isDragging || !canvasRef) return
    const currentX = e.clientX
    const deltaX = lastX - currentX
    if (Math.abs(deltaX) > 3) dragMoved = true
    lastX = currentX
    setScrollX(prev => {
      const maxScroll = (canvasRef!.clientWidth * zoom()) - canvasRef!.clientWidth
      return Math.max(0, Math.min(prev + deltaX, maxScroll))
    })
  }

  const handlePointerUp = (e: PointerEvent) => {
    isDragging = false
    canvasRef?.releasePointerCapture(e.pointerId)
    
    // If it was just a click (no drag), scrub to that position
    if (!dragMoved && audio && props.durationSec > 0 && canvasRef) {
      const rect = canvasRef.getBoundingClientRect()
      const x = e.clientX - rect.left
      const vw = canvasRef.clientWidth * zoom()
      const time = ((x + scrollX()) / vw) * props.durationSec
      audio.currentTime = Math.max(0, Math.min(time, props.durationSec))
      // optional: auto play on scrub?
      // if (audio.paused) audio.play()
    }
  }

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.code === 'Space') {
      e.preventDefault()
      if (!audio) return
      if (audio.paused) audio.play()
      else audio.pause()
    }
  }

  onMount(() => {
    if (!canvasRef) return
    ctx = canvasRef.getContext('2d')
    resizeCanvas()
    startDrawLoop()

    canvasRef.addEventListener('wheel', handleWheel, { passive: false })
    canvasRef.addEventListener('pointerdown', handlePointerDown)
    canvasRef.addEventListener('pointermove', handlePointerMove)
    canvasRef.addEventListener('pointerup', handlePointerUp)
    canvasRef.addEventListener('pointercancel', handlePointerUp)

    window.addEventListener('keydown', handleKeyDown)

    resizeObserver = new ResizeObserver(() => resizeCanvas())
    resizeObserver.observe(canvasRef.parentElement!)

    onCleanup(() => {
      canvasRef?.removeEventListener('wheel', handleWheel)
      canvasRef?.removeEventListener('pointerdown', handlePointerDown)
      canvasRef?.removeEventListener('pointermove', handlePointerMove)
      canvasRef?.removeEventListener('pointerup', handlePointerUp)
      canvasRef?.removeEventListener('pointercancel', handlePointerUp)
      window.removeEventListener('keydown', handleKeyDown)
      resizeObserver?.disconnect()
      if (animFrameId !== null) cancelAnimationFrame(animFrameId)
    })
  })

  const resizeCanvas = () => {
    if (!canvasRef || !ctx) return
    forceRedraw = true
    const dpr = window.devicePixelRatio || 1
    const w = canvasRef.parentElement!.clientWidth
    const h = canvasRef.parentElement!.clientHeight
    canvasRef.width = w * dpr
    canvasRef.height = h * dpr
    canvasRef.style.width = `${w}px`
    canvasRef.style.height = `${h}px`
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    draw() // Trigger immediate redraw
  }

  const freqToY = (freq: number, h: number): number => {
    if (!Number.isFinite(freq) || freq <= 0) return h
    const pct = (Math.log2(freq) - LOG_MIN) / LOG_RANGE
    return Math.max(0, Math.min(h, h - pct * h))
  }

  const startDrawLoop = () => {
    const loop = () => {
      draw()
      animFrameId = requestAnimationFrame(loop)
    }
    animFrameId = requestAnimationFrame(loop)
  }

  const draw = () => {
    if (!ctx || !canvasRef) return
    const w = canvasRef.clientWidth
    const h = canvasRef.clientHeight

    const vw = w * zoom()
    let sx = scrollX()
    const maxScroll = vw - w
    if (sx > maxScroll) {
      sx = Math.max(0, maxScroll)
      setScrollX(sx)
    }

    if (isPlaying() && props.durationSec > 0 && audio) {
      const time = audio.currentTime
      const playheadX = (time / props.durationSec) * vw - sx
      if (playheadX > w * 0.95 && maxScroll > 0) {
        setScrollX(Math.min(maxScroll, sx + w * 0.5))
      } else if (playheadX < 0) {
        setScrollX(Math.max(0, (time / props.durationSec) * vw - w * 0.1))
      }
    }

    if (!bgCanvas) {
      bgCanvas = document.createElement('canvas')
      bgCtx = bgCanvas.getContext('2d')
    }

    const currentHidden = hiddenAlgos()
    let hiddenChanged = false
    if (currentHidden.size !== lastDrawState.hidden.size) {
      hiddenChanged = true
    } else {
      for (const h_algo of currentHidden) {
        if (!lastDrawState.hidden.has(h_algo)) hiddenChanged = true
      }
    }

    if (
      forceRedraw ||
      bgCanvas.width !== w ||
      bgCanvas.height !== h ||
      lastDrawState.sx !== sx ||
      lastDrawState.zoom !== zoom() ||
      hiddenChanged
    ) {
      forceRedraw = false
      bgCanvas.width = w
      bgCanvas.height = h
      lastDrawState = { w, h, sx, zoom: zoom(), hidden: new Set(currentHidden) }

      if (bgCtx) {
        bgCtx.clearRect(0, 0, w, h)
        bgCtx.fillStyle = '#0d1117'
        bgCtx.fillRect(0, 0, w, h)

        const samples = props.waveform
        if (samples && samples.length > 0) {
          bgCtx.fillStyle = 'rgba(48, 54, 61, 0.5)'
          const step = samples.length / vw
          const amp = h / 2

          for (let i = 0; i < w; i++) {
            let min = 1.0
            let max = -1.0
            const start = Math.floor((sx + i) * step)
            const end = Math.floor((sx + i + 1) * step)
            const actualEnd = Math.min(Math.max(start + 1, end), samples.length)
            
            if (start < samples.length) {
              const stepSize = Math.max(1, Math.floor((actualEnd - start) / 100))
              for (let j = start; j < actualEnd; j += stepSize) {
                const val = samples[j]
                if (val < min) min = val
                if (val > max) max = val
              }
              const yMin = amp - max * amp
              const yMax = amp - min * amp
              bgCtx.fillRect(i, yMin, 1, Math.max(1, yMax - yMin))
            }
          }
        }

        const duration = props.durationSec > 0 ? props.durationSec : 1
        const results = props.analysisResults
        if (results.length > 0) {
          for (const res of results) {
            if (currentHidden.has(res.algorithm)) continue

            const hasSegmented = (props.segmentedNotes?.length ?? 0) > 0
            const baseColor = ALGO_COLORS[res.algorithm] ?? 'rgba(255, 255, 255, 0.8)'
            const color = hasSegmented ? baseColor.replace(/0\.8\)$/, '0.3)') : baseColor

            bgCtx.strokeStyle = color
            bgCtx.fillStyle = color
            bgCtx.lineWidth = 2
            bgCtx.lineJoin = 'round'

            let isDrawing = false
            bgCtx.beginPath()

            for (let i = 0; i < res.pitches.length; i++) {
              const p = res.pitches[i]
              const x = (p.time / duration) * vw - sx
              
              if (p.freq === null || p.freq <= 0) {
                isDrawing = false
                continue
              }
              
              const y = freqToY(p.freq, h)

              if (!isDrawing) {
                bgCtx.moveTo(x, y)
                isDrawing = true
              } else {
                const prev = res.pitches[i - 1]
                if (prev !== undefined && p.time - prev.time > 0.1) {
                  bgCtx.moveTo(x, y)
                } else {
                  bgCtx.lineTo(x, y)
                }
              }
            }
            bgCtx.stroke()
          }
        }

        if ((props.segmentedNotes?.length ?? 0) > 0 && props.segmentedNotes !== undefined) {
          const beatsToSeconds = (b: number) => b / (120 / 60)
          
          for (const note of props.segmentedNotes) {
            const startSec = beatsToSeconds(note.startBeat)
            const endSec = startSec + beatsToSeconds(note.duration)
            
            const x1 = (startSec / duration) * vw - sx
            const x2 = (endSec / duration) * vw - sx
            const y = freqToY(note.note.freq, h)
            
            const blockHeight = 12
            const blockY = y - blockHeight / 2
            const blockWidth = Math.max(x2 - x1, 4)

            bgCtx.fillStyle = 'rgba(255, 165, 0, 0.7)'
            bgCtx.strokeStyle = 'rgba(255, 165, 0, 1.0)'
            bgCtx.lineWidth = 1
            
            bgCtx.beginPath()
            bgCtx.roundRect(x1, blockY, blockWidth, blockHeight, 4)
            bgCtx.fill()
            bgCtx.stroke()

            if (note.lyricText !== undefined && note.lyricText !== '') {
              bgCtx.fillStyle = 'rgba(255, 255, 255, 0.9)'
              bgCtx.font = '10px Inter, sans-serif'
              bgCtx.textAlign = 'center'
              bgCtx.textBaseline = 'top'
              bgCtx.fillText(note.lyricText, x1 + blockWidth / 2, blockY + blockHeight + 2)
            }
          }
        }
      }
    }

    ctx.clearRect(0, 0, w, h)
    ctx.drawImage(bgCanvas, 0, 0)

    if (audio !== null && props.durationSec > 0) {
      const time = audio.currentTime
      const x = (time / props.durationSec) * vw - sx
      if (x >= 0 && x <= w) {
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, h)
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)'
        ctx.lineWidth = 2
        ctx.stroke()
        
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'
        ctx.beginPath()
        ctx.moveTo(x - 5, 0)
        ctx.lineTo(x + 5, 0)
        ctx.lineTo(x, 6)
        ctx.fill()
      }
    }
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%', 'touch-action': 'none' }} />
      
      {/* HTML Overlay Legend */}
      <div style={{
        position: 'absolute',
        top: '8px',
        right: '8px',
        display: 'flex',
        'flex-direction': 'column',
        gap: '4px',
        padding: '6px',
        background: 'rgba(13, 17, 23, 0.7)',
        'border-radius': '6px',
        'backdrop-filter': 'blur(4px)',
        border: '1px solid rgba(255,255,255,0.1)'
      }}>
        <For each={props.analysisResults}>
          {(res) => {
            const isHidden = () => hiddenAlgos().has(res.algorithm)
            const color = ALGO_COLORS[res.algorithm] || '#fff'
            return (
              <button
                style={{
                  background: 'none',
                  border: 'none',
                  color: isHidden() ? 'rgba(255,255,255,0.3)' : color,
                  'font-size': '12px',
                  'font-weight': 'bold',
                  'text-align': 'right',
                  cursor: 'pointer',
                  padding: '2px 6px',
                  opacity: isHidden() ? 0.6 : 1,
                  transition: 'all 0.2s ease',
                }}
                onClick={() => toggleAlgo(res.algorithm)}
              >
                {res.algorithm.toUpperCase()}
              </button>
            )
          }}
        </For>
      </div>
    </div>
  )
}
