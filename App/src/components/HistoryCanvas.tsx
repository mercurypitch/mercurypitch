// ============================================================
// HistoryCanvas — Real-time pitch visualization
// ============================================================

import { Component, onMount, onCleanup } from 'solid-js';

interface HistoryCanvasProps {
  frequencyData: () => Float32Array | null;
  liveScore: () => number | null;
}

export const HistoryCanvas: Component<HistoryCanvasProps> = (props) => {
  let canvasRef: HTMLCanvasElement | undefined;
  let ctx: CanvasRenderingContext2D | null = null;
  let animFrameId: number | null = null;

  onMount(() => {
    if (!canvasRef) return;
    ctx = canvasRef.getContext('2d');
    resizeCanvas();

    const ro = new ResizeObserver(() => resizeCanvas());
    ro.observe(canvasRef!.parentElement!);

    animFrameId = requestAnimationFrame(function loop() {
      draw();
      animFrameId = requestAnimationFrame(loop);
    });

    onCleanup(() => {
      ro.disconnect();
      if (animFrameId !== null) cancelAnimationFrame(animFrameId);
    });
  });

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

  const draw = () => {
    if (!ctx || !canvasRef) return;
    const w = canvasRef.clientWidth;
    const h = canvasRef.clientHeight;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#161b22';
    ctx.fillRect(0, 0, w, h);

    const freqData = props.frequencyData();
    if (freqData && freqData.length > 0) {
      const barCount = Math.min(freqData.length, 128);
      const barWidth = w / barCount;
      for (let i = 0; i < barCount; i++) {
        const val = (freqData[i] + 140) / 140; // Normalize from dB range (-140 to 0)
        const barH = Math.max(0, val * (h - 10));
        const hue = 120 + val * 40;
        ctx.fillStyle = `hsla(${hue},80%,${50 + val * 20}%,${0.4 + val * 0.5})`;
        ctx.fillRect(i * barWidth + 1, h - barH - 2, barWidth - 2, barH);
      }
    } else {
      ctx.fillStyle = '#484f58';
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Enable microphone to see pitch history', w / 2, h / 2 + 4);
    }

    const score = props.liveScore();
    if (score !== null) {
      const color = score >= 80 ? '#3fb950' : score >= 50 ? '#d29922' : '#f85149';
      ctx.fillStyle = color;
      ctx.font = 'bold 15px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(score + '%', w - 10, 20);
      ctx.fillStyle = '#8b949e';
      ctx.font = '9px sans-serif';
      ctx.fillText('live score', w - 10, 32);
    }
  };

  return <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />;
};
