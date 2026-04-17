// ============================================================
// PitchCanvas — Pitch trail and melody display canvas
// ============================================================

import { Component, onMount, onCleanup, createEffect } from 'solid-js';
import type { MelodyItem, ScaleDegree } from '@/types';

export interface PitchSample {
  beat: number;
  freq: number;
  confidence: number;
}

interface PitchCanvasProps {
  melody: () => MelodyItem[];
  scale: () => ScaleDegree[];
  totalBeats: () => number;
  currentBeat: () => number;
  pitchHistory: () => PitchSample[];
  currentNoteIndex: () => number;
  isPlaying: () => boolean;
  isPaused: () => boolean;
  isScrolling: () => boolean;
  targetPitch?: () => number | null;
  noteAccuracyMap?: () => Map<number, number>;
  isRecording?: () => boolean;
  getWaveform?: () => Float32Array | null;
}

export const PitchCanvas: Component<PitchCanvasProps> = (props) => {
  let canvasRef: HTMLCanvasElement | undefined;
  let ctx: CanvasRenderingContext2D | null = null;
  let animFrameId: number | null = null;
  let isSeeking = false;

  onMount(() => {
    if (!canvasRef) return;
    ctx = canvasRef.getContext('2d');
    resizeCanvas();

    // Mouse handlers for dragging the playhead
    canvasRef.addEventListener('mousedown', (e) => {
      isSeeking = true;
      handleSeek(e);
    });
    document.addEventListener('mousemove', (e) => {
      if (isSeeking) handleSeek(e);
    });
    document.addEventListener('mouseup', () => {
      isSeeking = false;
    });

    const ro = new ResizeObserver(() => resizeCanvas());
    ro.observe(canvasRef!.parentElement!);

    startLoop();

    onCleanup(() => {
      ro.disconnect();
      if (animFrameId !== null) cancelAnimationFrame(animFrameId);
    });
  });

  const handleSeek = (e: MouseEvent) => {
    if (!canvasRef || !props.isPlaying() && !props.isPaused()) return;
    const rect = canvasRef.getBoundingClientRect();
    const x = e.clientX - rect.left;
    // Map x position to a beat and trigger a seek
    const w = canvasRef.clientWidth;
    const totalBeats = props.totalBeats();
    const seekBeat = (x / w) * totalBeats;
    // Update currentBeat signal - this will trigger playback to seek
    // For now, emit a custom event that App.tsx can handle
    window.dispatchEvent(new CustomEvent('pitchperfect:seekToBeat', { detail: { beat: seekBeat } }));
  };

  const resizeCanvas = () => {
    if (!canvasRef) return;
    const dpr = window.devicePixelRatio || 1;
    const w = canvasRef.parentElement!.clientWidth;
    const h = canvasRef.parentElement!.clientHeight;
    canvasRef.width = w * dpr;
    canvasRef.height = h * dpr;
    canvasRef.style.width = w + 'px';
    canvasRef.style.height = h + 'px';
    ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  const startLoop = () => {
    const loop = () => {
      draw();
      animFrameId = requestAnimationFrame(loop);
    };
    animFrameId = requestAnimationFrame(loop);
  };

  const freqToY = (freq: number, h: number): number => {
    const scale = props.scale();
    const allFreqs = scale.map((n) => n.freq);
    if (allFreqs.length === 0) return h / 2;
    const minFreq = Math.min(...allFreqs) * 0.82;
    const maxFreq = Math.max(...allFreqs) * 1.22;
    const logMin = Math.log2(minFreq);
    const logMax = Math.log2(maxFreq);
    const pct = (Math.log2(freq) - logMin) / (logMax - logMin);
    return h - pct * (h - 40) - 20;
  };

  const beatToX = (beat: number, w: number): number => {
    return (beat / Math.max(1, props.totalBeats())) * w;
  };

  // Accuracy heatmap: color-code pitch rows based on historical accuracy
  const drawAccuracyHeatmap = (h: number) => {
    const accuracyMap = props.noteAccuracyMap?.();
    if (!accuracyMap || accuracyMap.size === 0) return;

    const scale = props.scale();
    for (const note of scale) {
      const acc = accuracyMap.get(note.midi);
      if (acc === undefined) continue;
      const y = freqToY(note.freq, h);

      // Green (perfect) → yellow (good) → orange (okay) → red (off)
      let color: string;
      if (acc >= 90) color = 'rgba(63,185,80,0.12)';
      else if (acc >= 75) color = 'rgba(141,203,65,0.10)';
      else if (acc >= 60) color = 'rgba(219,175,0,0.10)';
      else if (acc >= 40) color = 'rgba(219,120,0,0.10)';
      else color = 'rgba(219,50,50,0.10)';

      ctx!.fillStyle = color;
      ctx!.fillRect(0, y - 16, ctx!.canvas.clientWidth, 32);
    }
  };

  const drawTargetPitch = (h: number) => {
    const target = props.targetPitch?.();
    if (!target || target <= 0) return;
    const ty = freqToY(target, h);

    // Threshold bands (±10 cents = ±0.58% in frequency)
    const centsBand = 0.1;
    const freqLow = target / Math.pow(2, centsBand / 1200);
    const freqHigh = target * Math.pow(2, centsBand / 1200);
    const yLow = freqToY(freqLow, h);
    const yHigh = freqToY(freqHigh, h);

    // Shaded zone
    ctx!.fillStyle = 'rgba(88,166,255,0.08)';
    ctx!.fillRect(0, yHigh, ctx!.canvas.clientWidth, yLow - yHigh);

    // Target line
    ctx!.strokeStyle = 'rgba(88,166,255,0.5)';
    ctx!.lineWidth = 2;
    ctx!.setLineDash([6, 4]);
    ctx!.beginPath();
    ctx!.moveTo(0, ty);
    ctx!.lineTo(ctx!.canvas.clientWidth, ty);
    ctx!.stroke();
    ctx!.setLineDash([]);

    // Label
    ctx!.fillStyle = '#58a6ff';
    ctx!.font = 'bold 10px sans-serif';
    ctx!.textAlign = 'left';
    ctx!.textBaseline = 'middle';
    const label = `♪ ${Math.round(target)} Hz`;
    ctx!.fillText(label, 8, ty);
  };

  const draw = () => {
    if (!ctx || !canvasRef) return;
    const w = canvasRef.clientWidth;
    const h = canvasRef.clientHeight;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#0d1117';
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.translate(-props.isScrolling() ? props.currentBeat() * (w / Math.max(1, props.totalBeats())) * 0.3 : 0, 0);

    // Waveform display during recording
    if (props.isRecording && props.isRecording() && props.getWaveform) {
      const waveform = props.getWaveform();
      if (waveform && waveform.length > 0) {
        ctx.save();
        ctx.strokeStyle = 'rgba(219,112,219,0.6)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        const step = Math.max(1, Math.floor(waveform.length / w));
        for (let i = 0; i < w; i++) {
          const sampleIdx = i * step;
          const sample = waveform[sampleIdx] ?? 0;
          const y = h / 2 + sample * (h / 2) * 0.8;
          if (i === 0) ctx.moveTo(i, y);
          else ctx.lineTo(i, y);
        }
        ctx.stroke();

        // Filled area under the waveform
        ctx.fillStyle = 'rgba(219,112,219,0.08)';
        ctx.beginPath();
        for (let i = 0; i < w; i++) {
          const sampleIdx = i * step;
          const sample = waveform[sampleIdx] ?? 0;
          const y = h / 2 + sample * (h / 2) * 0.8;
          if (i === 0) ctx.moveTo(i, h / 2);
          else ctx.lineTo(i, y);
        }
        for (let i = w - 1; i >= 0; i--) {
          const sampleIdx = i * step;
          const sample = waveform[sampleIdx] ?? 0;
          const y = h / 2 - sample * (h / 2) * 0.8;
          ctx.lineTo(i, y);
        }
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }

    const scale = props.scale();
    const melody = props.melody();

    // Grid lines
    for (const note of scale) {
      const y = freqToY(note.freq, h);
      ctx.strokeStyle = 'rgba(48,54,61,0.7)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();

      ctx.fillStyle = '#484f58';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(note.name + note.octave, w - 6, y - 3);
    }

    // Target pitch overlay
    drawAccuracyHeatmap(h);
    drawTargetPitch(h);

    // Melody blocks
    let accum = 0;
    for (let j = 0; j < melody.length; j++) {
      const item = melody[j];
      const x1 = beatToX(accum, w);
      const x2 = beatToX(accum + item.duration, w);
      const bw = x2 - x1;
      const y = freqToY(item.note.freq, h);
      const isActive = props.isPlaying() && j === props.currentNoteIndex() && !props.isPaused();

      if (bw > 2) {
        const boxH = 20;
        const boxHalf = boxH / 2;
        ctx.beginPath();
        ctx.roundRect(x1, y - boxHalf, bw, boxH, 4);
        ctx.fillStyle = isActive ? 'rgba(88,166,255,0.28)' : 'rgba(88,166,255,0.1)';
        ctx.fill();
        ctx.strokeStyle = isActive ? 'rgba(88,166,255,0.9)' : 'rgba(88,166,255,0.25)';
        ctx.lineWidth = isActive ? 1.5 : 1;
        ctx.stroke();

        if (bw >= 12) {
          ctx.fillStyle = isActive ? '#58a6ff' : 'rgba(88,166,255,0.65)';
          ctx.font = (isActive ? 'bold ' : '') + (isActive ? 12 : 11) + 'px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(item.note.name, x1 + bw / 2, y + 0.5);
          ctx.textBaseline = 'alphabetic';
        }
      }

      ctx.strokeStyle = 'rgba(48,54,61,0.35)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x1, 0);
      ctx.lineTo(x1, h);
      ctx.stroke();

      accum += item.duration;
    }

    // Pitch trail
    const history = props.pitchHistory();
    if (history.length > 1) {
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(63,185,80,0.75)';
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.beginPath();
      let started = false;
      for (const pt of history) {
        if (!pt.freq || pt.confidence < 0.2) { started = false; continue; }
        const px = beatToX(pt.beat, w);
        const py = freqToY(pt.freq, h);
        if (!started) { ctx.moveTo(px, py); started = true; }
        else ctx.lineTo(px, py);
      }
      ctx.stroke();

      // Glowing dot at last position
      const last = history[history.length - 1];
      if (last && last.freq && last.confidence >= 0.2) {
        const lx = beatToX(last.beat, w);
        const ly = freqToY(last.freq, h);
        const grad = ctx.createRadialGradient(lx, ly, 0, lx, ly, 12);
        grad.addColorStop(0, 'rgba(63,185,80,0.55)');
        grad.addColorStop(1, 'rgba(63,185,80,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(lx, ly, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#3fb950';
        ctx.beginPath();
        ctx.arc(lx, ly, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(lx, ly, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Current note dot
    if (props.isPlaying() && !props.isPaused() && props.currentNoteIndex() >= 0) {
      const noteItem = melody[props.currentNoteIndex()];
      if (noteItem) {
        const tx = beatToX(props.currentBeat(), w);
        const ty = freqToY(noteItem.note.freq, h);
        const grad2 = ctx.createRadialGradient(tx, ty, 0, tx, ty, 18);
        grad2.addColorStop(0, 'rgba(88,166,255,0.45)');
        grad2.addColorStop(1, 'rgba(88,166,255,0)');
        ctx.fillStyle = grad2;
        ctx.beginPath();
        ctx.arc(tx, ty, 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#58a6ff';
        ctx.beginPath();
        ctx.arc(tx, ty, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(tx, ty, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
  };

  createEffect(() => {
    // Re-trigger draw when relevant props change
    props.currentBeat();
    props.pitchHistory();
    props.currentNoteIndex();
    props.isPlaying();
    props.melody();
    props.targetPitch?.();
    props.noteAccuracyMap?.();
    props.isRecording?.();
    props.getWaveform?.();
  });

  return <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />;
};
