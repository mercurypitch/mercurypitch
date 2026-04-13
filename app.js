/**
 * PitchPerfect - Main Application
 */
(function () {
    'use strict';

    // ========== STATE ==========
    const state = {
        key: 'C',
        octave: 4,
        bpm: 80,
        sensitivity: 5,
        melody: [],
        totalBeats: 0,
        isPlaying: false,
        isPaused: false,
        currentBeat: 0,
        currentNoteIndex: -1,
        playStartTime: 0,
        pauseOffset: 0,
        micActive: false,
        detectedFreq: 0,
        detectedNote: null,
        pitchHistory: [],
        maxHistoryLen: 600,
        noteResults: [],
        currentNoteSamples: [],
        currentTargetMidi: 0,
        currentTargetFreq: 0,
        playMode: 'once',
        practiceCycles: 5,
        currentCycle: 1,
        totalCycles: 1,
        runsCompleted: 0,
        allCycleResults: [],
        practiceComplete: false,
        animFrameId: null,
        scale: [],
        activeTab: 'practice',
        pitchScrollOffset: 0,
        pitchBeatWidth: 40,
        metronomeEnabled: false,
        isPrecount: false,
        precountBeats: 0,
        precountStartTime: 0,
        hopActive: false,
        hopStartTime: 0,
        hopFromY: 0,
        hopToY: 0,
        hopDuration: 280,
        loadedPresetName: '',
        loadedPresetMelody: []
    };

    // ========== ACCURACY BANDS ==========
    const BANDS = [
        { threshold: 0,   band: 100, color: '#3fb950' },
        { threshold: 10,  band: 90,  color: '#58a6ff' },
        { threshold: 25,  band: 75,  color: '#2dd4bf' },
        { threshold: 50,  band: 50,  color: '#d29922' },
        { threshold: 999, band: 0,   color: '#f85149' }
    ];

    // ========== INSTANCES ==========
    const engine = new AudioEngine();
    const detector = null;

    // ========== DOM REFS ==========
    const dom = {};
    let pitchCtx, historyCtx;

    // ========== INIT ==========
    function init() {
        try {
            // Cache DOM refs
            dom.keySelect      = document.getElementById('key-select');
            dom.octaveValue    = document.getElementById('octave-value');
            dom.btnOctaveUp    = document.getElementById('btn-octave-up');
            dom.btnOctaveDown  = document.getElementById('btn-octave-down');
            dom.presetSelect   = document.getElementById('preset-select');
            dom.btnClearPreset    = document.getElementById('btn-clear-preset');
            dom.noteList          = document.getElementById('note-list');
            dom.detectedNote      = document.getElementById('detected-note');
            dom.detectedFreq      = document.getElementById('detected-freq');
            dom.centsMarker       = document.getElementById('cents-marker');
            dom.btnMic            = document.getElementById('btn-mic');
            dom.btnPlay           = document.getElementById('btn-play');
            dom.btnPause          = document.getElementById('btn-pause');
            dom.btnStop           = document.getElementById('btn-stop');
            dom.tempoSlider       = document.getElementById('tempo');
            dom.tempoValue        = document.getElementById('tempo-value');
            dom.pitchCanvas       = document.getElementById('pitch-canvas');
            dom.historyCanvas     = document.getElementById('history-canvas');
            dom.playhead          = document.getElementById('playhead');
            dom.canvasContainer   = document.getElementById('canvas-container');
            dom.scoreOverlay      = document.getElementById('score-overlay');
            dom.scoreTitle        = document.getElementById('score-title');
            dom.scoreGrade        = document.getElementById('score-grade');
            dom.scorePct         = document.getElementById('score-pct');
            dom.scoreDetail       = document.getElementById('score-detail');
            dom.scoreStats        = document.getElementById('score-stats');
            dom.scoreValue        = document.getElementById('score-value');
            dom.btnRetry          = document.getElementById('btn-retry');
            dom.btnNext           = document.getElementById('btn-next');
            dom.runCounter        = document.getElementById('run-counter');
            dom.cycleCounter      = document.getElementById('cycle-counter');
            dom.btnOnce           = document.getElementById('btn-once');
            dom.btnRepeat         = document.getElementById('btn-repeat');
            dom.btnPractice       = document.getElementById('btn-practice');
            dom.practiceOptions   = document.getElementById('practice-options');
            dom.cyclesInput       = document.getElementById('cycles');
            dom.btnStartPractice  = document.getElementById('btn-start-practice');
            dom.btnMetronome      = document.getElementById('btn-metronome');
            dom.sensitivitySlider = document.getElementById('sensitivity');
            dom.sensitivityValue  = document.getElementById('sensitivity-value');
            dom.tabPractice      = document.getElementById('tab-practice');
            dom.tabEditor       = document.getElementById('tab-editor');

            pitchCtx   = dom.pitchCanvas.getContext('2d');
            historyCtx = dom.historyCanvas.getContext('2d');

            resizeCanvases();
            window.addEventListener('resize', resizeCanvases);

            // === Event listeners ===
            dom.keySelect.addEventListener('change', onKeyChange);
            dom.btnOctaveUp.addEventListener('click', function () { onOctaveShift(1); });
            dom.btnOctaveDown.addEventListener('click', function () { onOctaveShift(-1); });
            dom.presetSelect.addEventListener('change', onPresetChange);
            dom.btnClearPreset.addEventListener('click', onClearPreset);
            dom.tempoSlider.addEventListener('input', onTempoChange);
            dom.btnMic.addEventListener('click', toggleMic);
            dom.btnPlay.addEventListener('click', onPlayClick);
            dom.btnPause.addEventListener('click', togglePause);
            dom.btnStop.addEventListener('click', stopPlayback);
            dom.btnMetronome.addEventListener('click', toggleMetronome);
            dom.sensitivitySlider.addEventListener('input', onSensitivityChange);

            // Tab switching
            dom.tabPractice.addEventListener('click', function () { switchTab('practice'); });
            dom.tabEditor.addEventListener('click', function () { switchTab('editor'); });

            // Mode buttons
            dom.btnOnce.addEventListener('click', function () { onModeChange('once'); });
            dom.btnRepeat.addEventListener('click', function () { onModeChange('repeat'); });
            dom.btnPractice.addEventListener('click', function () { onModeChange('practice'); });

            // Practice start button
            dom.btnStartPractice.addEventListener('click', onPracticeStart);

            // Score overlay
            dom.btnRetry.addEventListener('click', onRetry);
            dom.btnNext.addEventListener('click', onNextRun);

            // Preset sync from editor
            window.addEventListener('pitchperfect:presetSaved', function () {
                populatePresetSelect();
            });

            // Build initial UI
            buildScale();
            populatePresetSelect();
            dom.octaveValue.textContent = state.octave;
            renderNoteList();
            updateScoreDisplay(null);
            updateStatsDisplay([]);
            drawPitchCanvas();
            drawHistoryCanvas();
            updateRunIndicator();

            // Start animation loop
            animate();
        } catch (e) {
            console.error('PitchPerfect init error:', e);
        }
    }

    // ========== CANVAS RESIZE ==========
    function resizeCanvases() {
        let dpr = window.devicePixelRatio || 1;
        let pc = dom.canvasContainer;

        // Pitch canvas: extend to full timeline width for auto-scroll
        let totalBeats = state.totalBeats || 16;
        let minTimelineWidth = Math.max(pc.clientWidth, totalBeats * state.pitchBeatWidth);

        dom.pitchCanvas.width  = minTimelineWidth * dpr;
        dom.pitchCanvas.height = pc.clientHeight * dpr;
        dom.pitchCanvas.style.width  = minTimelineWidth + 'px';
        dom.pitchCanvas.style.height = pc.clientHeight + 'px';
        pitchCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

        let hc = document.getElementById('history-container');
        dom.historyCanvas.width  = hc.clientWidth  * dpr;
        dom.historyCanvas.height = hc.clientHeight * dpr;
        dom.historyCanvas.style.width  = hc.clientWidth  + 'px';
        dom.historyCanvas.style.height = hc.clientHeight + 'px';
        historyCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    // ========== SCALE / MELODY ==========
    function buildScale() {
        state.key    = dom.keySelect.value;
        state.octave = parseInt(dom.octaveValue.textContent, 10);
        state.scale  = buildMajorScale(state.key, state.octave);
        state.melody = buildSampleMelody(state.key, state.octave);
        state.totalBeats = melodyTotalBeats(state.melody);
    }

    function onKeyChange() {
        if (state.isPlaying) stopPlayback();
        buildScale();
        // Octave display is already synced — no extra call needed
        resizeCanvases();
        renderNoteList();
        drawPitchCanvas();
    }

    function onOctaveShift(delta) {
        if (state.isPlaying) stopPlayback();
        let newOctave = state.octave + delta;
        if (newOctave < 1 || newOctave > 6) return;

        if (state.loadedPresetName) {
            // Transpose the preset melody by the octave delta
            const MIDI_OCTAVE_SHIFT = ;
            state.melody = state.loadedPresetMelody.map(function (item) {
                let transposedNote = Object.assign({}, item.note, {
                    midi: item.note.midi + delta * MIDI_OCTAVE_SHIFT,
                    octave: item.note.octave + delta,
                    freq: midiToFreq(item.note.midi + delta * MIDI_OCTAVE_SHIFT)
                });
                return { id: item.id, note: transposedNote, duration: item.duration };
            });
            state.octave = newOctave;
            state.scale = buildMajorScale(state.key, state.octave);
            state.totalBeats = melodyTotalBeats(state.melody);
        } else {
            // No preset: rebuild sample melody for new octave
            state.octave = newOctave;
            buildScale();
        }

        dom.octaveValue.textContent = state.octave;
        resizeCanvases();
        renderNoteList();
        drawPitchCanvas();

        // Sync octave to editor if it's open
        if (pianoRollEditor) {
            pianoRollEditor.setOctave(state.octave);
        }
    }

    function onTempoChange() {
        state.bpm = parseInt(dom.tempoSlider.value, 10);
        dom.tempoValue.textContent = state.bpm;
    }

    function onSensitivityChange() {
        state.sensitivity = parseInt(dom.sensitivitySlider.value, 10);
        dom.sensitivityValue.textContent = state.sensitivity;
        // Update detector sensitivity if active
        if (detector) {
            detector.setSensitivity(state.sensitivity);
        }
    }

    // ========== PRESET MANAGEMENT ==========
    function populatePresetSelect() {
        const presets = {};
        if (window.pianoRollPreset) {
            presets = window.pianoRollPreset.loadPresets();
        }
        let sel = dom.presetSelect;
        sel.innerHTML = '<option value="">— Select Preset —</option>';
        let names = Object.keys(presets).sort();
        for (const i = ; i < names.length; i++) {
            let opt = document.createElement('option');
            opt.value = names[i];
            opt.textContent = names[i];
            sel.appendChild(opt);
        }
        // Sync selected preset from shared state
        if (window.pianoRollPreset) {
            let selected = window.pianoRollPreset.getSelectedPresetName();
            if (selected) {
                sel.value = selected;
            } else {
                sel.value = '';
            }
        }
    }

    function onPresetChange() {
        let name = dom.presetSelect.value;
        if (window.pianoRollPreset) {
            window.pianoRollPreset.setSelectedPresetName(name);
        }
        if (!name) {
            state.loadedPresetName = '';
            state.loadedPresetMelody = [];
            return;
        }

        const presets = {};
        if (window.pianoRollPreset) {
            presets = window.pianoRollPreset.loadPresets();
        }
        let preset = presets[name];
        if (!preset) return;

        // Apply preset notes to current melody
        state.melody = preset.notes.map(function (n) {
            // Find the matching note in current scale by MIDI
            let noteInfo = findNoteInScale(n.midi);
            if (noteInfo) {
                let id = window.pianoRollGenerateId ? window.pianoRollGenerateId() : Date.now() + Math.floor(Math.random() * 10000);
                return { id: id, note: noteInfo, duration: n.duration, startBeat: n.startBeat };
            }
            return null;
        }).filter(function (n) { return n !== null; });

        // Remove startBeat from melody items (they're sequential)
        state.melody.forEach(function (item) {
            delete item.startBeat;
        });

        state.totalBeats = melodyTotalBeats(state.melody);
        state.loadedPresetName = name;
        state.loadedPresetMelody = state.melody.map(function (item) {
            return { id: item.id, note: Object.assign({}, item.note), duration: item.duration };
        });
        resizeCanvases();
        renderNoteList();
        drawPitchCanvas();
    }

    function findNoteInScale(midi) {
        for (const i = ; i < state.scale.length; i++) {
            if (state.scale[i].midi === midi) {
                return state.scale[i];
            }
        }
        return null;
    }

    function onClearPreset() {
        // Rebuild sample melody for current key/octave
        state.melody = buildSampleMelody(state.key, state.octave);
        state.totalBeats = melodyTotalBeats(state.melody);
        state.loadedPresetName = '';
        state.loadedPresetMelody = [];
        dom.presetSelect.value = '';
        if (window.pianoRollPreset) {
            window.pianoRollPreset.setSelectedPresetName('');
        }
        resizeCanvases();
        renderNoteList();
        drawPitchCanvas();
    }

    // ========== TAB SWITCHING ==========
    const pianoRollEditor = null;

    function switchTab(tab) {
        if (tab === state.activeTab) return;

        // Stop any playback when switching tabs
        if (state.isPlaying) {
            stopPlayback();
        }

        state.activeTab = tab;

        dom.tabPractice.classList.toggle('active', tab === 'practice');
        dom.tabEditor.classList.toggle('active', tab === 'editor');

        let mainLayout = document.getElementById('main-layout');
        let notesPanel = document.getElementById('notes-panel');
        let pitchArea = document.getElementById('pitch-area');
        let editorPanel = document.getElementById('editor-panel');

        if (tab === 'practice') {
            notesPanel.classList.remove('hidden');
            pitchArea.classList.remove('hidden');
            editorPanel.classList.add('hidden');
            populatePresetSelect();
            mainLayout.style.display = 'flex';

            // Sync melody from editor to practice
            if (pianoRollEditor) {
                let melody = pianoRollEditor.getMelody();
                if (melody.length > 0) {
                    state.melody = melody;
                    state.totalBeats = melodyTotalBeats(state.melody);
                    resizeCanvases();
                    renderNoteList();
                    drawPitchCanvas();
                }
                // Sync octave display from editor to practice
                dom.octaveValue.textContent = pianoRollEditor.octave;
                state.octave = pianoRollEditor.octave;
            }
        } else {
            notesPanel.classList.add('hidden');
            pitchArea.classList.add('hidden');
            editorPanel.classList.remove('hidden');
            mainLayout.style.display = 'flex';

            // Init piano roll lazily
            initPianoRoll();
        }
    }

    function initPianoRoll() {
        let container = document.getElementById('piano-roll-container');
        if (!container || pianoRollEditor) {
            if (pianoRollEditor) {
                pianoRollEditor.setScale(state.scale);
                pianoRollEditor.setBPM(state.bpm);
                pianoRollEditor.setOctave(state.octave);
            }
            return;
        }

        pianoRollEditor = new PianoRollEditor(container, {
            scale: state.scale,
            bpm: state.bpm,
            octave: state.octave
        });

        // Wire up audio engine for playback
        window.pianoRollAudioEngine = engine;

        // Expose app state reference for editor octave sync
        window.pitchPerfectApp = state;

        // If there's a current melody, load it
        if (state.melody.length > 0) {
            pianoRollEditor.setMelody(state.melody);
        }
    }

    // ========== MODE SELECTION ==========
    function onModeChange(mode) {
        state.playMode = mode;
        state.practiceComplete = false;
        state.allCycleResults = [];

        dom.btnOnce.classList.remove('active');
        dom.btnRepeat.classList.remove('active');
        dom.btnPractice.classList.remove('active');

        if (mode === 'once') {
            dom.btnOnce.classList.add('active');
            dom.practiceOptions.classList.add('hidden');
            dom.btnPlay.disabled = false;
        } else if (mode === 'repeat') {
            dom.btnRepeat.classList.add('active');
            dom.practiceOptions.classList.add('hidden');
            dom.btnPlay.disabled = false;
        } else if (mode === 'practice') {
            dom.btnPractice.classList.add('active');
            dom.practiceOptions.classList.remove('hidden');
            dom.btnPlay.disabled = true;
        }

        updateRunIndicator();
    }

    // ========== NOTE LIST ==========
    function renderNoteList() {
        dom.noteList.innerHTML = '';
        state.scale.forEach(function (note) {
            let el = document.createElement('div');
            el.className = 'note-item';
            el.dataset.midi = note.midi;
            el.innerHTML =
                '<div class="note-dot"></div>' +
                '<span class="note-name">' + note.name + (Math.floor(note.midi / 12) - 1) + '</span>' +
                '<span class="note-freq">' + note.freq.toFixed(0) + 'Hz</span>';
            dom.noteList.appendChild(el);
        });
    }

    function updateNoteListHighlight(targetMidi, isHit) {
        let items = dom.noteList.querySelectorAll('.note-item');
        items.forEach(function (el) {
            el.classList.remove('active', 'hit');
            if (parseInt(el.dataset.midi, 10) === targetMidi) {
                el.classList.add('active');
                if (isHit) el.classList.add('hit');
            }
        });
    }

    // ========== MICROPHONE ==========
    async function toggleMic() {
        if (state.micActive) {
            engine.stopMic();
            state.micActive = false;
            detector = null;
            dom.btnMic.classList.remove('recording');
            dom.btnMic.querySelector('span').textContent = 'Mic Off';
            dom.detectedNote.textContent = '--';
            dom.detectedFreq.textContent = '-- Hz';
            dom.centsMarker.style.left = '50%';
            dom.centsMarker.className = '';
            updateNoteListHighlight(-1, false);
        } else {
            await engine.init();
            await engine.resume();
            let ok = await engine.startMic();
            if (ok) {
                state.micActive = true;
                detector = new PitchDetector(engine.getSampleRate(), 2048, 0.15, state.sensitivity);
                dom.btnMic.classList.add('recording');
                dom.btnMic.querySelector('span').textContent = 'Mic On';
            }
        }
    }

    // ========== METRONOME TOGGLE ==========
    function toggleMetronome() {
        state.metronomeEnabled = !state.metronomeEnabled;
        if (state.metronomeEnabled) {
            dom.btnMetronome.classList.add('active');
        } else {
            dom.btnMetronome.classList.remove('active');
        }
    }

    // ========== PLAY BUTTON ==========
    function onPlayClick() {
        // In practice mode, Play button is disabled — only Start should work
        if (state.playMode === 'practice') return;
        startPlayback();
    }

    // ========== PRACTICE START ==========
    function onPracticeStart() {
        let cycles = parseInt(dom.cyclesInput.value, 10);
        state.practiceCycles = Math.max(2, Math.min(20, cycles || 5));
        state.totalCycles   = state.practiceCycles;
        dom.cyclesInput.value = state.practiceCycles;
        startPlayback();
    }

    // ========== PLAYBACK ==========
    function startPlayback() {
        if (state.isPlaying && state.isPaused) {
            togglePause();
            return;
        }
        if (state.isPlaying) return;

        // Disable tempo slider during playback
        dom.tempoSlider.disabled = true;
        dom.tempoSlider.style.opacity = '0.5';
        dom.tempoSlider.style.pointerEvents = 'none';

        engine.init().then(function () {
            // Handle metronome precount
            if (state.metronomeEnabled && !state.isPrecount) {
                state.isPrecount = true;
                state.precountBeats = 0;
                state.precountStartTime = performance.now();
                state.isPlaying = true;
                dom.btnPlay.classList.add('active');
                dom.btnPlay.querySelector('span').textContent = 'Counting';
                dom.btnPause.disabled = false;
                dom.btnStop.disabled = false;
                dom.playhead.style.display = 'block';
                updateRunIndicator();
                playPrecountClick();
                return;
            }

            // Normal playback start
            startActualPlayback();
        });
    }

    function playPrecountClick() {
        // Play a click sound using oscillator
        engine.stopTone();
        let ctx = engine.audioCtx;
        let osc = ctx.createOscillator();
        let gain = ctx.createGain();
        osc.type = 'square';
        osc.frequency.value = 800;
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.08);
    }

    function startActualPlayback() {
        state.isPlaying     = true;
        state.isPaused      = false;
        state.isPrecount    = false;
        state.currentBeat   = 0;
        state.pauseOffset   = 0;
        state.playStartTime = performance.now();
        state.hopActive     = false;
        state.hopStartTime  = 0;
        state.pitchHistory  = [];
        state.noteResults   = [];
        state.currentNoteSamples = [];
        state.currentNoteIndex  = -1;

        if (state.playMode === 'practice') {
            state.currentCycle = 1;
            state.allCycleResults = [];
            state.practiceComplete = false;
            state.totalCycles  = state.practiceCycles;
        } else if (state.playMode === 'repeat') {
            // Update run counter at start of each repeat loop
            updateRunIndicator();
        }

        dom.btnPlay.classList.add('active');
        dom.btnPlay.querySelector('span').textContent = 'Playing';
        dom.btnPause.disabled = false;
        dom.btnStop.disabled  = false;
        dom.playhead.style.display = 'block';

        hideScoreOverlay();
        updateScoreDisplay(null);
        updateStatsDisplay([]);

        let first = state.melody[0];
        state.currentTargetMidi = first.note.midi;
        state.currentTargetFreq = first.note.freq;
        state.currentNoteSamples = [];
        engine.playTone(first.note.freq);

        updateRunIndicator();
    }

    function togglePause() {
        if (!state.isPlaying) return;

        if (state.isPaused) {
            state.isPaused = false;
            state.playStartTime = performance.now() - state.pauseOffset;
            dom.btnPause.querySelector('span').textContent = 'Pause';
            dom.btnPlay.querySelector('span').textContent = 'Playing';
            dom.btnPlay.classList.add('active');
            engine.resume().then(function () {
                let ni = melodyNoteAtBeat(state.melody, state.currentBeat);
                engine.playTone(ni.note.freq);
            });
        } else {
            state.isPaused   = true;
            state.pauseOffset = performance.now() - state.playStartTime;
            dom.btnPause.querySelector('span').textContent = 'Resume';
            dom.btnPlay.querySelector('span').textContent = 'Paused';
            dom.btnPlay.classList.remove('active');
            engine.stopTone();
        }
    }

    function stopPlayback() {
        if (state.currentNoteIndex >= 0 && state.currentNoteSamples.length > 0) {
            finalizeNoteResult();
        }

        state.isPlaying  = false;
        state.isPaused   = false;
        state.isPrecount = false;
        state.currentBeat  = 0;
        state.currentNoteIndex = -1;
        state.noteResults = [];
        state.pitchScrollOffset = 0;
        state.hopActive = false;

        engine.stopTone();

        dom.btnPlay.classList.remove('active');
        dom.btnPlay.querySelector('span').textContent = 'Play';
        dom.btnPause.querySelector('span').textContent = 'Pause';
        dom.btnPause.disabled = true;
        dom.btnStop.disabled  = true;
        dom.playhead.style.display = 'none';
        dom.playhead.style.left = '0px';

        // Re-enable tempo slider
        dom.tempoSlider.disabled = false;
        dom.tempoSlider.style.opacity = '';
        dom.tempoSlider.style.pointerEvents = '';

        // In practice mode, keep Play disabled
        if (state.playMode === 'practice') {
            dom.btnPlay.disabled = true;
        }

        updateNoteListHighlight(-1, false);
        updateScoreDisplay(null);
        updateStatsDisplay([]);
        updateRunIndicator();
        drawPitchCanvas();
    }

    function onPlaybackComplete() {
        if (state.currentNoteIndex >= 0 && state.currentNoteSamples.length > 0) {
            finalizeNoteResult();
        }
        engine.stopTone();

        let results = state.noteResults;
        let isPracticeComplete = false;

        if (results.length > 0) {
            state.runsCompleted++;
            state.allCycleResults.push(results);

            // For practice mode: accumulate and only show overlay at the very end
            if (state.playMode === 'practice') {
                if (state.currentCycle < state.totalCycles) {
                    // More cycles coming — increment and auto-continue silently
                    state.currentCycle++;
                    updateRunIndicator();
                    state.isPlaying  = false;
                    state.isPaused   = false;
                    state.currentBeat = 0;
                    state.currentNoteIndex = -1;
                    state.noteResults = [];
                    state.pitchHistory = [];
                    state.pitchScrollOffset = 0;
                    engine.stopTone();

                    dom.btnPlay.classList.remove('active');
                    dom.btnPlay.querySelector('span').textContent = 'Playing';
                    dom.btnPause.querySelector('span').textContent = 'Pause';
                    dom.btnPause.disabled = false;
                    dom.btnStop.disabled  = false;
                    dom.playhead.style.display = 'block';
                    dom.playhead.style.left = '0px';
                    dom.tempoSlider.disabled = false;
                    dom.tempoSlider.style.opacity = '';
                    dom.tempoSlider.style.pointerEvents = '';

                    updateNoteListHighlight(-1, false);
                    drawPitchCanvas();

                    // Start next cycle after a short pause
                    setTimeout(function () {
                        state.playStartTime = performance.now();
                        state.isPlaying = true;
                        state.isPaused = false;
                        state.isPrecount = false;
                        state.currentBeat = 0;
                        state.pauseOffset = 0;
                        state.pitchHistory = [];
                        state.noteResults = [];
                        state.currentNoteSamples = [];
                        state.currentNoteIndex = -1;
                        state.pitchScrollOffset = 0;
                        dom.playhead.style.display = 'block';

                        // Re-enable playback controls
                        dom.btnPlay.classList.add('active');
                        dom.btnPlay.querySelector('span').textContent = 'Playing';
                        dom.btnPause.disabled = false;
                        dom.btnStop.disabled = false;

                        let first = state.melody[0];
                        state.currentTargetMidi = first.note.midi;
                        state.currentTargetFreq = first.note.freq;
                        engine.playTone(first.note.freq);
                    }, 800);
                    return;
                } else {
                    // Last cycle done — mark complete
                    isPracticeComplete = true;
                    state.practiceComplete = true;
                }
            }

            let score = calculateScore(results);
            if (state.playMode !== 'practice') {
                showScoreOverlay(results, score);
            }
            updateScoreDisplay(score);
            updateStatsDisplay(results);
            updateRunIndicator();
        }

        state.isPlaying  = false;
        state.isPaused   = false;
        state.currentBeat = 0;
        state.currentNoteIndex = -1;
        state.pitchScrollOffset = 0;

        dom.btnPlay.classList.remove('active');
        dom.btnPlay.querySelector('span').textContent = 'Play';
        dom.btnPause.querySelector('span').textContent = 'Pause';
        dom.btnPause.disabled = true;
        dom.btnStop.disabled  = true;
        dom.playhead.style.display = 'none';

        dom.tempoSlider.disabled = false;
        dom.tempoSlider.style.opacity = '';
        dom.tempoSlider.style.pointerEvents = '';

        // Practice mode: show final accumulated stats, allow restart
        if (state.playMode === 'practice') {
            if (isPracticeComplete) {
                // Compute combined score and stats from all cycles
                const allNotes = [];
                for (const ai = ; ai < state.allCycleResults.length; ai++) {
                    for (const aj = ; aj < state.allCycleResults[ai].length; aj++) {
                        allNotes.push(state.allCycleResults[ai][aj]);
                    }
                }
                let totalScore = calculateScore(allNotes);
                showScoreOverlay(allNotes, totalScore, true);
                updateScoreDisplay(totalScore);
                updateStatsDisplay(allNotes);
            }
            dom.btnPlay.disabled = false;
            dom.practiceOptions.classList.remove('hidden');
        }

        // Auto-continue for repeat mode only
        if (state.playMode === 'repeat') {
            setTimeout(function () { startPlayback(); }, 800);
        }

        updateNoteListHighlight(-1, false);
        drawPitchCanvas();
    }

    // ========== NOTE TRACKING ==========
    function finalizeNoteResult() {
        if (state.currentNoteSamples.length === 0) {
            state.noteResults.push({
                noteName:  noteNameFromMidi(state.currentTargetMidi),
                targetMidi: state.currentTargetMidi,
                targetFreq: state.currentTargetFreq,
                band: 'off',
                avgCents: null,
                sampleCount: 0
            });
            return;
        }

        const sumCents = , validCount = 0;
        for (const i = ; i < state.currentNoteSamples.length; i++) {
            let s = state.currentNoteSamples[i];
            if (s.confidence >= 0.2) {
                sumCents += Math.abs(s.cents);
                validCount++;
            }
        }

        let avgCents = validCount > 0 ? sumCents / validCount : null;
        let band = centsToBand(avgCents);

        state.noteResults.push({
            noteName:   noteNameFromMidi(state.currentTargetMidi),
            targetMidi: state.currentTargetMidi,
            targetFreq: state.currentTargetFreq,
            band:       band,
            avgCents:   avgCents,
            sampleCount: state.currentNoteSamples.length
        });
    }

    function noteNameFromMidi(midi) {
        const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        let idx = ((midi % 12) + 12) % 12;
        let oct = Math.floor(midi / 12) - 1;
        return names[idx] + oct;
    }

    function centsToBand(avgCents) {
        if (avgCents === null) return 'off';
        for (const i = ; i < BANDS.length; i++) {
            if (avgCents <= BANDS[i].threshold) return BANDS[i].band;
        }
        return 0;
    }

    function calculateScore(results) {
        if (results.length === 0) return 0;
        const total = ;
        for (const j = ; j < results.length; j++) {
            let r = results[j];
            let s;
            if (r.avgCents === null) {
                s = 0;
            } else if (r.avgCents <= 5) {
                s = 100;
            } else if (r.avgCents <= 10) {
                s = 90;
            } else if (r.avgCents <= 20) {
                s = 80;
            } else if (r.avgCents <= 30) {
                s = 65;
            } else if (r.avgCents <= 50) {
                s = 40;
            } else {
                s = 10;
            }
            total += s;
        }
        return Math.round(total / results.length);
    }

    function scoreGrade(score) {
        if (score >= 90) return { label: 'Pitch Perfect!', cls: 'grade-perfect' };
        if (score >= 80) return { label: 'Excellent!',     cls: 'grade-excellent' };
        if (score >= 65) return { label: 'Good!',          cls: 'grade-good' };
        if (score >= 50) return { label: 'Okay!',          cls: 'grade-okay' };
        return               { label: 'Needs Work',         cls: 'grade-needs-work' };
    }

    // ========== SCORE OVERLAY ==========
    function showScoreOverlay(results, score, isFinal) {
        dom.scoreOverlay.classList.remove('hidden');

        let grade = scoreGrade(score);
        if (isFinal) {
            dom.scoreTitle.textContent = 'Practice Complete!';
        } else {
            dom.scoreTitle.textContent = 'Run ' + state.runsCompleted + ' Complete!';
        }
        dom.scoreGrade.textContent = grade.label;
        dom.scoreGrade.className   = grade.cls;
        dom.scorePct.textContent   = score + '%';

        const countByBand = { 100: 0, 90: 0, 75: 0, 50: 0, 0: 0 };
        for (const k = ; k < results.length; k++) {
            let r2 = results[k];
            if (r2.band === 'off') countByBand[0]++;
            else countByBand[r2.band] = (countByBand[r2.band] || 0) + 1;
        }

        const parts = [];
        if (countByBand[100] > 0) parts.push(countByBand[100] + ' pitch perfect');
        if (countByBand[90]  > 0) parts.push(countByBand[90]  + ' excellent');
        if (countByBand[75]  > 0) parts.push(countByBand[75]  + ' good');
        if (countByBand[50]  > 0) parts.push(countByBand[50]  + ' okay');
        if (countByBand[0]   > 0) parts.push(countByBand[0]   + ' off');
        dom.scoreDetail.textContent = parts.join(', ') || 'No notes recorded';

        // Build stat chips
        dom.scoreStats.innerHTML = '';
        const bands = [
            { b: 100, label: 'Perfect' },
            { b: 90,  label: 'Excellent' },
            { b: 75,  label: 'Good' },
            { b: 50,  label: 'Okay' },
            { b: 0,   label: 'Off' }
        ];
        for (const m = ; m < bands.length; m++) {
            let bnd = bands[m];
            let cnt = countByBand[bnd.b];
            if (cnt === 0 && bnd.b !== 0) continue;
            let div = document.createElement('div');
            div.className = 'score-stat score-stat-' + bnd.label.toLowerCase();
            const color = ';
            for (const n = ; n < BANDS.length; n++) {
                if (BANDS[n].band === bnd.b) { color = BANDS[n].color; break; }
            }
            div.innerHTML =
                '<div class="score-stat-value" style="color:' + color + '">' + cnt + '</div>' +
                '<div class="score-stat-label">' + bnd.label + '</div>';
            dom.scoreStats.appendChild(div);
        }

        // Button text
        if (isFinal) {
            dom.btnRetry.textContent = 'Practice Again';
            dom.btnRetry.classList.add('primary');
            dom.btnNext.textContent = 'Done';
        } else if (state.playMode === 'practice') {
            dom.btnRetry.textContent = 'Skip';
            dom.btnRetry.classList.remove('primary');
            dom.btnNext.textContent = 'Next (' + state.currentCycle + '/' + state.totalCycles + ')';
        } else {
            dom.btnRetry.textContent = 'Try Again';
            dom.btnRetry.classList.add('primary');
            dom.btnNext.textContent = 'Next Run';
        }
    }

    function hideScoreOverlay() {
        dom.scoreOverlay.classList.add('hidden');
    }

    function onRetry() {
        hideScoreOverlay();
        if (state.playMode === 'practice' && state.practiceComplete) {
            // Reset practice session
            state.practiceComplete = false;
            state.allCycleResults = [];
            state.currentCycle = 1;
            state.runsCompleted = 0;
            updateScoreDisplay(null);
            updateStatsDisplay([]);
            updateRunIndicator();
            // Re-enable start button
            dom.practiceOptions.classList.remove('hidden');
            return;
        }
        updateScoreDisplay(null);
        updateStatsDisplay([]);
        setTimeout(function () { startPlayback(); }, 200);
    }

    function onNextRun() {
        hideScoreOverlay();
        if (state.playMode === 'practice' && state.practiceComplete) {
            // Just close the overlay, leave Play button enabled for manual restart
            return;
        }
        if (state.playMode === 'practice' && state.currentCycle < state.totalCycles) {
            state.currentCycle++;
        }
        updateRunIndicator();
        setTimeout(function () { startPlayback(); }, 200);
    }

    // ========== UI HELPERS ==========
    function updateScoreDisplay(score) {
        if (score !== null) {
            dom.scoreValue.textContent = score + '%';
            dom.scoreValue.style.color = score >= 80 ? '#3fb950' : score >= 50 ? '#d29922' : '#f85149';
        } else {
            dom.scoreValue.textContent = '--';
            dom.scoreValue.style.color = '';
        }
    }

    function updateStatsDisplay(results) {
        const counts = { 100: 0, 90: 0, 75: 0, 50: 0, 0: 0 };
        for (const i = ; i < results.length; i++) {
            let r = results[i];
            if (r.band === 'off') counts[0]++;
            else counts[r.band]++;
        }
        let total = Math.max(results.length, 1);
        const bandKeys = [100, 90, 75, 50, 0];
        for (const j = ; j < bandKeys.length; j++) {
            let b = bandKeys[j];
            let pct = Math.round((counts[b] / total) * 100);
            let barEl = document.getElementById('bar-' + b);
            let cntEl = document.getElementById('cnt-' + b);
            if (barEl) barEl.style.width = pct + '%';
            if (cntEl) cntEl.textContent = counts[b];
        }
    }

    function updateRunIndicator() {
        if (state.playMode === 'practice') {
            dom.runCounter.textContent = 'Run ' + (state.runsCompleted + 1);
            dom.cycleCounter.textContent = 'Cycle ' + state.currentCycle + '/' + state.totalCycles;
        } else if (state.playMode === 'repeat') {
            dom.runCounter.textContent = 'Run ' + (state.runsCompleted + 1);
            dom.cycleCounter.textContent = 'Repeat';
        } else {
            dom.runCounter.textContent = 'Run ' + (state.runsCompleted + 1);
            dom.cycleCounter.textContent = '';
        }
    }

    // ========== ANIMATION LOOP ==========
    function animate() {
        state.animFrameId = requestAnimationFrame(animate);

        if (state.isPlaying && !state.isPaused) {
            // Handle metronome precount
            if (state.isPrecount) {
                let precountElapsed = performance.now() - state.precountStartTime;
                const beatMs =  / state.bpm;
                let currentPrecountBeat = Math.floor(precountElapsed / beatMs);

                if (currentPrecountBeat > state.precountBeats) {
                    state.precountBeats = currentPrecountBeat;
                    playPrecountClick();
                }

                if (state.precountBeats >= 4) {
                    // Precount finished, start actual playback
                    state.isPrecount = false;
                    startActualPlayback();
                }
                return;
            }

            let elapsed = performance.now() - state.playStartTime;
            let beatsPerMs = state.bpm / 60000;
            state.currentBeat = elapsed * beatsPerMs;

            // Calculate playhead position in canvas coordinates
            let containerWidth = dom.canvasContainer.clientWidth;
            let totalTimelineWidth = dom.pitchCanvas.clientWidth;
            let playheadX = (state.currentBeat / state.totalBeats) * totalTimelineWidth;

            // Auto-scroll: translate the canvas so the playhead (fixed at left edge)
            // always shows the current beat. Scroll begins once notes approach the right edge.
            let targetScroll = playheadX - containerWidth * 0.7;
            state.pitchScrollOffset = Math.max(0, Math.min(targetScroll, totalTimelineWidth - containerWidth));

            // Playhead moves with the note until canvas starts scrolling.
            // Screen position = playheadX in canvas space minus the scroll offset.
            // Before scroll: pitchScrollOffset=0, so left=playheadX (moves with note).
            // After scroll kicks in: left stays near 0 since canvas is translating.
            dom.playhead.style.left = (playheadX - state.pitchScrollOffset) + 'px';

            if (state.currentBeat >= state.totalBeats) {
                state.currentBeat = state.totalBeats;
                drawPitchCanvas();
                drawHistoryCanvas();
                onPlaybackComplete();
                return;
            }

            let newIndex = melodyIndexAtBeat(state.melody, state.currentBeat);

            if (newIndex !== state.currentNoteIndex) {
                if (state.currentNoteIndex >= 0 && state.currentNoteSamples.length > 0) {
                    finalizeNoteResult();
                }
                // Trigger hop animation from old note to new note
                if (state.currentNoteIndex >= 0 && newIndex >= 0) {
                    let oldNote = state.melody[state.currentNoteIndex];
                    let newNote = state.melody[newIndex];
                    // freqToY is defined locally in drawPitchCanvas, so compute it here
                    let logMin = Math.log2(Math.min.apply(null, state.scale.map(function(n){return n.freq;})) * 0.82);
                    let logMax = Math.log2(Math.max.apply(null, state.scale.map(function(n){return n.freq;})) * 1.22);
                    let h = dom.pitchCanvas.clientHeight;
                    function localFreqToY(freq) {
                        let pct = (Math.log2(freq) - logMin) / (logMax - logMin);
                        return h - pct * (h - 40) - 20;
                    }
                    state.hopFromY = localFreqToY(oldNote.note.freq);
                    state.hopToY   = localFreqToY(newNote.note.freq);
                    state.hopActive = true;
                    state.hopStartTime = performance.now();
                }
                state.currentNoteIndex = newIndex;
                let noteItem = state.melody[newIndex];
                state.currentTargetMidi = noteItem.note.midi;
                state.currentTargetFreq = noteItem.note.freq;
                state.currentNoteSamples = [];
                engine.setToneFreq(noteItem.note.freq);
            }
        }

        // Pitch detection
        const detectedFreq = ;
        const confidence = ;
        if (state.micActive && detector) {
            let timeData = engine.getTimeData();
            let result = detector.detect(timeData);
            detectedFreq = result.freq;
            confidence = result.confidence;
        }

        state.detectedFreq = detectedFreq;

        // Update left-panel pitch display
        if (detectedFreq > 0 && confidence > 0.2) {
            let noteInfo = freqToNote(detectedFreq);
            state.detectedNote = noteInfo;

            dom.detectedNote.textContent = noteInfo.name + noteInfo.octave;
            dom.detectedFreq.textContent = detectedFreq.toFixed(1) + ' Hz';

            const centsPct =  + (noteInfo.cents / 50) * 50;
            dom.centsMarker.style.left = Math.max(5, Math.min(95, centsPct)) + '%';

            if (Math.abs(noteInfo.cents) <= 10)       dom.centsMarker.className = 'in-tune';
            else if (noteInfo.cents > 0)              dom.centsMarker.className = 'sharp';
            else                                       dom.centsMarker.className = 'flat';

            if (!state.isPlaying) {
                updateNoteListHighlight(noteInfo.midi, false);
            }
        } else if (state.micActive) {
            state.detectedNote = null;
            dom.detectedNote.textContent = '--';
            dom.detectedFreq.textContent = '-- Hz';
            dom.centsMarker.style.left = '50%';
            dom.centsMarker.className = '';
            if (!state.isPlaying) updateNoteListHighlight(-1, false);
        }

        // Record sample for current note
        if (state.isPlaying && !state.isPaused && detectedFreq > 0 && confidence >= 0.2) {
            const cents =  * Math.log2(detectedFreq / state.currentTargetFreq);
            state.currentNoteSamples.push({ freq: detectedFreq, cents: cents, confidence: confidence });

            if (state.pitchHistory.length < state.maxHistoryLen) {
                state.pitchHistory.push({
                    beat: state.currentBeat,
                    freq: detectedFreq,
                    targetFreq: state.currentTargetFreq,
                    confidence: confidence
                });
            }
        }

        // Update note highlighting during playback
        if (state.isPlaying && !state.isPaused && state.currentNoteIndex >= 0) {
            let targetNote = state.melody[state.currentNoteIndex].note;
            let isHit = state.detectedNote &&
                        state.detectedNote.midi === targetNote.midi &&
                        Math.abs(state.detectedNote.cents) <= 20;
            updateNoteListHighlight(targetNote.midi, isHit);
        }

        drawPitchCanvas();
        drawHistoryCanvas();
        updatePlayhead();
    }

    // ========== PLAYHEAD ==========
    function updatePlayhead() {
        dom.playhead.style.display = state.isPlaying ? 'block' : 'none';
    }

    // ========== PITCH CANVAS ==========
    function drawPitchCanvas() {
        let canvas = dom.pitchCanvas;
        let ctx = pitchCtx;
        let w = canvas.clientWidth;
        let h = canvas.clientHeight;

        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = '#0d1117';
        ctx.fillRect(0, 0, w, h);

        // Apply scroll offset — canvas content is shifted left so the playhead
        // (which stays at screen-left) always shows the current beat position
        ctx.save();
        ctx.translate(-state.pitchScrollOffset, 0);

        if (state.melody.length === 0) {
            ctx.restore();
            return;
        }

        let allFreqs = state.scale.map(function (n) { return n.freq; });
        let minFreq = Math.min.apply(null, allFreqs) * 0.82;
        let maxFreq = Math.max.apply(null, allFreqs) * 1.22;

        function freqToY(freq) {
            let logMin = Math.log2(minFreq);
            let logMax = Math.log2(maxFreq);
            let pct = (Math.log2(freq) - logMin) / (logMax - logMin);
            return h - pct * (h - 40) - 20;
        }

        function beatToX(beat) {
            return (beat / state.totalBeats) * w;
        }

        // Grid lines
        for (const i = ; i < state.scale.length; i++) {
            let note = state.scale[i];
            let y = freqToY(note.freq);
            ctx.strokeStyle = 'rgba(48,54,61,0.7)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(w, y);
            ctx.stroke();

            ctx.fillStyle = '#484f58';
            ctx.font = '10px sans-serif';
            ctx.textAlign = 'right';
            ctx.fillText(note.name + (Math.floor(note.midi / 12) - 1), w - 6, y - 3);
        }

        // Melody blocks — responsive sizing
        let isMobile = w < 480;
        let boxH = isMobile ? 18 : 20;
        let boxHalf = boxH / 2;
        let cornerRadius = Math.min(5, boxHalf);
        let fontSize = isMobile ? 9 : 11;
        let activeFontSize = isMobile ? 9 : 12;
        let textOffset = isMobile ? 3 : 4;
        let minBoxWidthForText = isMobile ? 14 : 12;

        const accum = ;
        for (const j = ; j < state.melody.length; j++) {
            let item = state.melody[j];
            let x1 = beatToX(accum);
            let x2 = beatToX(accum + item.duration);
            let bw = x2 - x1;
            let y = freqToY(item.note.freq);
            let isActive = state.isPlaying && j === state.currentNoteIndex && !state.isPaused;

            // Use rounded rectangles
            if (bw > 2) {
                let rx = x1, ry = y - boxHalf, rw = bw, rh = boxH;
                if (rw > 0 && rw < 2 * cornerRadius) {
                    rw = 2 * cornerRadius;
                }
                ctx.beginPath();
                ctx.roundRect(rx, ry, rw, rh, cornerRadius);

                ctx.fillStyle = isActive ? 'rgba(88,166,255,0.28)' : 'rgba(88,166,255,0.1)';
                ctx.fill();

                ctx.strokeStyle = isActive ? 'rgba(88,166,255,0.9)' : 'rgba(88,166,255,0.25)';
                ctx.lineWidth = isActive ? 1.5 : 1;
                ctx.stroke();
            }

            // Note label inside box — only if box is wide enough
            if (bw >= minBoxWidthForText) {
                ctx.fillStyle = isActive ? '#58a6ff' : 'rgba(88,166,255,0.65)';
                ctx.font = (isActive ? 'bold ' : '') + (isActive ? activeFontSize : fontSize) + 'px sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(item.note.name, x1 + bw / 2, y + 0.5);
                ctx.textBaseline = 'alphabetic';
            }

            // Beat divider — skip on narrow mobile screens
            if (!isMobile || j === 0) {
                ctx.strokeStyle = 'rgba(48,54,61,0.35)';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(x1, 0);
                ctx.lineTo(x1, h);
                ctx.stroke();
            }

            accum += item.duration;
        }

        // Pitch trail
        if (state.pitchHistory.length > 1) {
            ctx.lineWidth = 2;
            ctx.strokeStyle = 'rgba(63,185,80,0.75)';
            ctx.lineJoin = 'round';
            ctx.lineCap = 'round';
            ctx.beginPath();
            let started = false;
            for (const k = ; k < state.pitchHistory.length; k++) {
                let pt = state.pitchHistory[k];
                if (!pt.freq || pt.confidence < 0.2) { started = false; continue; }
                let px = beatToX(pt.beat);
                let py = freqToY(pt.freq);
                if (!started) { ctx.moveTo(px, py); started = true; }
                else ctx.lineTo(px, py);
            }
            ctx.stroke();

            // Glowing dot
            let last = state.pitchHistory[state.pitchHistory.length - 1];
            if (last && last.freq && last.confidence >= 0.2) {
                let lx = beatToX(last.beat);
                let ly = freqToY(last.freq);

                let grad = ctx.createRadialGradient(lx, ly, 0, lx, ly, 12);
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

        // Moving target dot
        if (state.isPlaying && !state.isPaused && state.currentNoteIndex >= 0) {
            let noteItem2 = state.melody[state.currentNoteIndex];
            let tx = beatToX(state.currentBeat);
            let ty = freqToY(noteItem2.note.freq);

            // Hop / bounce effect: arc away then settle on the new note
            if (state.hopActive) {
                let hopElapsed = performance.now() - state.hopStartTime;
                let hopPct = Math.min(1, hopElapsed / state.hopDuration);
                // Damped bounce: quick arc up/down past target, then settle
                let bounce = Math.sin(hopPct * Math.PI) * Math.exp(-hopPct * 3);
                let diff = state.hopToY - state.hopFromY;
                ty = state.hopToY + bounce * diff * 0.5;
                if (hopPct >= 1) state.hopActive = false;
            }

            let grad2 = ctx.createRadialGradient(tx, ty, 0, tx, ty, 18);
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

        ctx.restore();
    }

    // ========== HISTORY CANVAS ==========
    function drawHistoryCanvas() {
        let canvas = dom.historyCanvas;
        let ctx = historyCtx;
        let w = canvas.clientWidth;
        let h = canvas.clientHeight;

        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = '#161b22';
        ctx.fillRect(0, 0, w, h);

        if (!state.micActive && state.pitchHistory.length === 0) {
            ctx.fillStyle = '#484f58';
            ctx.font = '11px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('Enable microphone to see pitch history', w / 2, h / 2 + 4);
            return;
        }

        if (state.micActive) {
            let freqData = engine.getFreqData();
            if (freqData && freqData.length > 0) {
                let barCount = Math.min(freqData.length, 128);
                let barWidth = w / barCount;
                for (const i = ; i < barCount; i++) {
                    let val = freqData[i] / 255;
                    let barH = val * (h - 10);
                    const hue =  + val * 40;
                    ctx.fillStyle = 'hsla(' + hue + ',80%,' + (50 + val * 20) + '%,' + (0.4 + val * 0.5) + ')';
                    ctx.fillRect(i * barWidth + 1, h - barH - 2, barWidth - 2, barH);
                }
            }
        }

        // Live score
        if (state.isPlaying && state.noteResults.length > 0) {
            let liveScore = calculateScore(state.noteResults);
            let color = liveScore >= 80 ? '#3fb950' : liveScore >= 50 ? '#d29922' : '#f85149';
            ctx.fillStyle = color;
            ctx.font = 'bold 15px sans-serif';
            ctx.textAlign = 'right';
            ctx.fillText(liveScore + '%', w - 10, 20);
            ctx.fillStyle = '#8b949e';
            ctx.font = '9px sans-serif';
            ctx.fillText('live score', w - 10, 32);
        }
    }

    // ========== BOOT ==========
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
