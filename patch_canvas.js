const fs = require('fs');
const file = 'src/components/OfflinePitchCanvas.tsx';
let code = fs.readFileSync(file, 'utf8');

const bgCanvasCode = `
  let bgCanvas: HTMLCanvasElement | null = null;
  let bgCtx: CanvasRenderingContext2D | null = null;
  let lastDrawState = { w: 0, h: 0, sx: -1, zoom: -1, hidden: new Set<string>() };
  let forceRedraw = true;
`;

code = code.replace('let animFrameId: number | null = null', 'let animFrameId: number | null = null\n' + bgCanvasCode);

const toggleAlgoCode = `
  const toggleAlgo = (algo: string) => {
    setHiddenAlgos(prev => {
      const next = new Set(prev)
      if (next.has(algo)) next.delete(algo)
      else next.add(algo)
      return next
    })
    forceRedraw = true;
  }
`;
code = code.replace(/const toggleAlgo = [\s\S]*?requestAnimationFrame\(draw\)\n  \}/m, toggleAlgoCode.trim());

code = code.replace('const onTimeUpdate = () => setCurrentTime(audio!.currentTime)', '');
code = code.replace("audio.addEventListener('timeupdate', onTimeUpdate)", '');
code = code.replace("audio.removeEventListener('timeupdate', onTimeUpdate)", '');

const drawCodeStart = `
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

    // Check if we need to redraw the background
    const currentHidden = hiddenAlgos();
    let hiddenChanged = false;
    if (currentHidden.size !== lastDrawState.hidden.size) {
      hiddenChanged = true;
    } else {
      for (const h of currentHidden) {
        if (!lastDrawState.hidden.has(h)) hiddenChanged = true;
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
      forceRedraw = false;
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
            const color = hasSegmented ? baseColor.replace(/0\\.8\\)$/, '0.3)') : baseColor

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

    // Now render to main canvas
    ctx.clearRect(0, 0, w, h)
    ctx.drawImage(bgCanvas, 0, 0)

    // Draw Playhead
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
`;

code = code.replace(/const draw = \(\) => \{[\s\S]*?ctx\.fill\(\)\n      \}\n    \}\n  \}/, drawCodeStart.trim());

// We also need to add forceRedraw = true in resizeCanvas and createEffect where props change.
code = code.replace(/const resizeCanvas = \(\) => \{/g, 'const resizeCanvas = () => {\n    forceRedraw = true;');

fs.writeFileSync(file, code);
