async function measure({ seek, shot, sid }) {
  // full frames (hosts hidden: their passes are not seeked here) at the times the fix round looks at
  const TIMES = { 's11-sing': [5.9, 6.3, 6.8, 38.45], 's12-your-turn': [0.3, 0.6, 4.3, 5.8, 8.7, 17.84, 24.65, 30.59, 36.75, 46.0, 58.3, 59.1, 64.72, 75.16] }[sid]
  for (const t of TIMES) { await seek(t); await shot(`frame-${sid}-${t.toFixed(2)}.png`) }
  return TIMES
}
