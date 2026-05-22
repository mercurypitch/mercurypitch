const fs = require('fs');
const file = 'src/components/PitchTestingTab.tsx';
let code = fs.readFileSync(file, 'utf8');

// 1. Add createMemo for currentSegmentedNotes right below offlineAnalysisResults
const targetMemo = 'const offlineAnalysisResults = createMemo(() => activeTrack()?.analysisResults || [])';
const replacementMemo = targetMemo + '\n  const currentSegmentedNotes = createMemo(() => showSegmentedNotes() ? activeTrack()?.segmentedNotes : undefined)';
code = code.replace(targetMemo, replacementMemo);

// 2. Replace the inline expression in OfflinePitchCanvas
const targetProp = 'segmentedNotes={showSegmentedNotes() ? activeTrack()?.segmentedNotes : undefined}';
const replacementProp = 'segmentedNotes={currentSegmentedNotes()}';
code = code.replace(targetProp, replacementProp);

fs.writeFileSync(file, code);
