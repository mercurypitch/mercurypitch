/**
 * Piano Roll Editor for PitchPerfect.
 * Handles note entry, resizing, selection, and preset management.
 */
(function () {
    'use strict';

    // Prevent double-loading
    if (window.PianoRollEditor) return;

    // ========== DEFAULT MELODY ==========
    const DEFAULT_MELODY = [
        { note: { midi: 60, name: 'C', octave: 4, freq: 261.63 }, startBeat: 0, duration: 2 },
        { note: { midi: 64, name: 'E', octave: 4, freq: 329.63 }, startBeat: 2, duration: 2 },
        { note: { midi: 67, name: 'G', octave: 4, freq: 392.00 }, startBeat: 4, duration: 2 },
        { note: { midi: 72, name: 'C', octave: 5, freq: 523.25 }, startBeat: 6, duration: 4 },
        { note: { midi: 67, name: 'G', octave: 4, freq: 392.00 }, startBeat: 10, duration: 2 },
        { note: { midi: 65, name: 'F', octave: 4, freq: 349.23 }, startBeat: 12, duration: 2 },
        { note: { midi: 64, name: 'E', octave: 4, freq: 329.63 }, startBeat: 14, duration: 2 },
        { note: { midi: 60, name: 'C', octave: 4, freq: 261.63 }, startBeat: 16, duration: 4 }
    ];

    // ========== PIANO ROLL CONFIG ==========
    const CONFIG = {
        // Piano range: controlled by numOctaves (1-3) starting from the scale's root octave
        ROW_HEIGHT: 22,
        BEAT_WIDTH: 48,
        PIANO_WIDTH: 62,
        RULER_HEIGHT: 28,
        BEATS_PER_BAR: 4,
        MIN_DURATION: 0.25, // minimum snap unit = sixteenth note
        NOTE_COLORS: {
            normal: 'rgba(88, 166, 255, 0.75)',
            selected: 'rgba(88, 166, 255, 1.0)',
            active: 'rgba(63, 185, 80, 0.85)',
            ghost: 'rgba(88, 166, 255, 0.35)'
        }
    };

    // ========== PRESET STORAGE ==========
    const PRESETS_KEY = 'pitchperfect_presets';
    const LAST_PRESET_KEY = 'pitchperfect_lastpreset';
    const SELECTED_PRESET_KEY = 'pitchperfect_selected_preset';

    function loadPresets() {
        try {
            let raw = localStorage.getItem(PRESETS_KEY);
            return raw ? JSON.parse(raw) : {};
        } catch (e) {
            return {};
        }
    }

    function savePresets(presets) {
        try {
            localStorage.setItem(PRESETS_KEY, JSON.stringify(presets));
        } catch (e) {
            console.warn('Failed to save presets:', e);
        }
    }

    // Expose for practice tab access
    window.pianoRollLoadPresets = loadPresets;
    window.pianoRollSavePresets = savePresets;

    function getSelectedPresetName() {
        return localStorage.getItem(SELECTED_PRESET_KEY) || '';
    }

    function setSelectedPresetName(name) {
        localStorage.setItem(SELECTED_PRESET_KEY, name || '');
    }

    window.pianoRollPreset = {
        loadPresets: loadPresets,
        savePresets: savePresets,
        getSelectedPresetName: getSelectedPresetName,
        setSelectedPresetName: setSelectedPresetName
    };

    // ========== NOTE HELPERS ==========
    function snapToGrid(value, gridSize) {
        return Math.round(value / gridSize) * gridSize;
    }

    function formatBeat(beat) {
        let bar = Math.floor(beat / CONFIG.BEATS_PER_BAR) + 1;
        let beatInBar = (beat % CONFIG.BEATS_PER_BAR) + 1;
        return 'Bar ' + bar + ', Beat ' + beatInBar;
    }

    function getDefaultMelody() {
        return DEFAULT_MELODY.map(function (item) {
            return {
                id: generateId(),
                midi: item.note.midi,
                startBeat: item.startBeat,
                duration: item.duration
            };
        });
    }

    function generateId() {
        return Date.now() + Math.floor(Math.random() * 10000);
    }

    // Expose globally for app.js
    window.pianoRollGenerateId = generateId;

    // ========== PIANO ROLL EDITOR CLASS ==========
    window.PianoRollEditor = function (containerEl, options) {
        options = options || {};
        this.container = containerEl;
        this.scale = options.scale || [];
        this.bpm = options.bpm || 80;
        this.octave = options.octave || 4;
        this.numOctaves = options.numOctaves || 1;
        this.mode = options.mode || 'major'; // Scale mode: major, natural-minor, etc.

        // Note data
        this.notes = []; // { id, midi, startBeat, duration }
        this.totalBeats = 16;
        this.nextNoteId = 1;

        // Interaction state
        this.selectedNoteIds = []; // Support multi-select: array of note IDs
        this.selectedDuration = 1; // in beats
        this.activeTool = 'place'; // 'place' | 'erase' | 'select'
        this.isDragging = false;
        this.isResizing = false;
        this.resizeHandle = null; // 'left' | 'right'
        this.dragStartX = 0;
        this.dragStartY = 0;
        this.dragStartBeat = 0;
        this.dragStartDuration = 0;

        // Box selection state
        this.isBoxSelecting = false;
        this.boxStartX = 0;
        this.boxStartY = 0;
        this.boxEndX = 0;
        this.boxEndY = 0;

        // Seeking state (ruler drag-to-seek)
        this.isSeeking = false;
        this.seekStartX = 0;

        // Playback state
        this._playbackState = 'stopped'; // 'stopped' | 'playing' | 'paused'
        this._playAnimationId = null;
        this._playStartTime = 0;
        this._pauseStartTime = 0;

        // Grid dimensions
        this.rowHeight = CONFIG.ROW_HEIGHT;
        this.beatWidth = CONFIG.BEAT_WIDTH;
        this.pianoWidth = CONFIG.PIANO_WIDTH;
        this.rulerHeight = CONFIG.RULER_HEIGHT;
        this.totalRows = 0;
        this.stretchedWidth = 0; // canvas width stretched to fill viewport

        // Canvas refs
        this.pianoCanvas = null;
        this.gridCanvas = null;
        this.pianoCtx = null;
        this.gridCtx = null;
        this.gridContainer = null;
        this.gridScrollX = 0;

        // Presets
        this.presets = loadPresets();
        this.currentPresetName = null;

        // Create Example1 preset with default melody if no presets exist
        if (Object.keys(this.presets).length === 0) {
            this._createDefaultPreset();
        }

        this._init();
    };

    PianoRollEditor.prototype._createDefaultPreset = function () {
        const defaultNotes = getDefaultMelody();
        this.presets['Example1'] = {
            notes: defaultNotes.map(function (n) {
                return { midi: n.midi, startBeat: n.startBeat, duration: n.duration };
            }),
            totalBeats: 20,
            bpm: 80,
            scale: this.scale.map(function (s) { return { midi: s.midi, name: s.name, octave: s.octave, freq: s.freq }; })
        };
        savePresets(this.presets);
    };

    PianoRollEditor.prototype._init = function () {
        this._buildDOM();
        this._bindEvents();
        this._calculateDimensions();
        this._drawAll();
    };

    // ========== DOM BUILD ==========
    PianoRollEditor.prototype._buildDOM = function () {
        const el = this.container;
        el.innerHTML = '';

        // Tab bar
        const toolbar = document.createElement('div');
        toolbar.className = 'roll-toolbar';

        // Tool buttons
        toolbar.innerHTML =
            '<div class="roll-tools">' +
                '<button class="roll-tool-btn active" data-tool="place" title="Place notes">' +
                    '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M12 3v18M3 12h18" stroke="currentColor" stroke-width="2"/><rect x="8" y="8" width="8" height="8" rx="1" fill="currentColor" opacity="0.6"/></svg>' +
                    '<span>Place</span>' +
                '</button>' +
                '<button class="roll-tool-btn" data-tool="erase" title="Erase notes">' +
                    '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M19 6.4L17.6 5 12 10.6 6.4 5 5 6.4l5.6 5.6L5 17.6 6.4 19l5.6-5.6 5.6 5.6 1.4-1.4-5.6-5.6L19 6.4z"/></svg>' +
                    '<span>Erase</span>' +
                '</button>' +
                '<button class="roll-tool-btn" data-tool="select" title="Select & move">' +
                    '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/></svg>' +
                    '<span>Select</span>' +
                '</button>' +
            '</div>' +
            '<div class="roll-sep"></div>' +
            '<div class="roll-durations">' +
                '<label class="dur-label">Dur:</label>' +
                '<button class="dur-btn" data-dur="0.25">1/16</button>' +
                '<button class="dur-btn" data-dur="0.5">1/8</button>' +
                '<button class="dur-btn active" data-dur="1">1/4</button>' +
                '<button class="dur-btn" data-dur="2">1/2</button>' +
                '<button class="dur-btn" data-dur="3">3/4</button>' +
                '<button class="dur-btn" data-dur="4">1</button>' +
            '</div>' +
            '<div class="roll-sep"></div>' +
            '<div class="roll-octave-group">' +
                '<label class="octave-label" style="font-size:0.72rem;color:var(--text-secondary)">Oct:</label>' +
                '<div class="octave-ctrl" style="padding:2px 3px;">' +
                    '<button id="roll-octave-down" class="octave-btn" title="Lower octave" style="width:18px;height:18px;">' +
                        '<svg viewBox="0 0 24 24" width="12" height="12"><path fill="currentColor" d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z"/></svg>' +
                    '</button>' +
                    '<span id="roll-octave-value" class="octave-value" style="font-size:0.78rem;">4</span>' +
                    '<button id="roll-octave-up" class="octave-btn" title="Higher octave" style="width:18px;height:18px;">' +
                        '<svg viewBox="0 0 24 24" width="12" height="12"><path fill="currentColor" d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z"/></svg>' +
                    '</button>' +
                '</div>' +
            '</div>' +
            '<div class="roll-sep"></div>' +
            '<div class="roll-octaves-group">' +
                '<label class="octaves-label" style="font-size:0.72rem;color:var(--text-secondary)">Rows:</label>' +
                '<button id="roll-octaves-minus" class="octave-btn" title="Fewer octaves" style="width:18px;height:18px;">' +
                    '<svg viewBox="0 0 24 24" width="12" height="12"><path fill="currentColor" d="M19 13H5v-2h14v2z"/></svg>' +
                '</button>' +
                '<span id="roll-octaves-value" class="octave-value" style="font-size:0.78rem;">1</span>' +
                '<button id="roll-octaves-plus" class="octave-btn" title="More octaves" style="width:18px;height:18px;">' +
                    '<svg viewBox="0 0 24 24" width="12" height="12"><path fill="currentColor" d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>' +
                '</button>' +
            '</div>' +
            '<div class="roll-sep"></div>' +
            '<div class="roll-mode-group">' +
                '<label class="mode-label" style="font-size:0.72rem;color:var(--text-secondary)">Scale:</label>' +
                '<select id="roll-mode-select" class="roll-mode-select">' +
                    '<option value="major">Major</option>' +
                    '<option value="natural-minor">Natural Minor</option>' +
                    '<option value="harmonic-minor">Harmonic Minor</option>' +
                    '<option value="melodic-minor">Melodic Minor</option>' +
                    '<option value="dorian">Dorian</option>' +
                    '<option value="mixolydian">Mixolydian</option>' +
                    '<option value="phrygian">Phrygian</option>' +
                    '<option value="lydian">Lydian</option>' +
                    '<option value="pentatonic-major">Pentatonic</option>' +
                    '<option value="pentatonic-minor">Minor Pentatonic</option>' +
                    '<option value="blues">Blues</option>' +
                    '<option value="chromatic">Chromatic</option>' +
                '</select>' +
            '</div>' +
            '<div class="roll-sep"></div>' +
            '<div class="roll-grid-ctrl">' +
                '<button class="roll-ctrl-btn" id="roll-add-beat" title="Add 4 beats">+4b</button>' +
                '<button class="roll-ctrl-btn" id="roll-remove-beat" title="Remove last 4 beats">-4b</button>' +
            '</div>' +
            '<div class="roll-sep"></div>' +
            '<div class="roll-preset-group">' +
                '<select id="roll-preset-select" class="roll-preset-select">' +
                    '<option value="">— Load Preset —</option>' +
                '</select>' +
                '<button id="roll-new-preset" class="roll-new-btn" title="New empty preset">+</button>' +
                '<input type="text" id="roll-preset-name" class="roll-preset-name" placeholder="Preset name">' +
                '<button id="roll-save-preset" class="roll-save-btn" title="Save preset">Save</button>' +
                '<button id="roll-share-preset" class="roll-share-btn" title="Share preset (copy URL)">Share</button>' +
                '<button id="roll-clear-all" class="roll-ctrl-btn danger" title="Clear all notes">Clear</button>' +
            '</div>' +
            '<div class="roll-sep"></div>' +
            '<div class="roll-action-group">' +
                '<button id="roll-action-slide-up" class="roll-action-btn" title="Create ascending slide between selected notes">' +
                    '<svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M4 20l8-16 8 16z"/></svg>' +
                    '<span>↑Slide</span>' +
                '</button>' +
                '<button id="roll-action-slide-down" class="roll-action-btn" title="Create descending slide between selected notes">' +
                    '<svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M4 4l8 16 8-16z"/></svg>' +
                    '<span>↓Slide</span>' +
                '</button>' +
                '<button id="roll-action-ease-in" class="roll-action-btn" title="Create ease-in slide (starts level, slides down)">' +
                    '<svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M4 12h4l4-6 8 10z"/></svg>' +
                    '<span>Ease In</span>' +
                '</button>' +
                '<button id="roll-action-ease-out" class="roll-action-btn" title="Create ease-out slide (slides up, eases to level)">' +
                    '<svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M4 12l4-6 4 6h12z"/></svg>' +
                    '<span>Ease Out</span>' +
                '</button>' +
                '<button id="roll-action-vibrato" class="roll-action-btn" title="Create vibrato on selected note">' +
                    '<svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M3 12c3-4 6 4 9 0s6 4 9 0"/></svg>' +
                    '<span>Vibrato</span>' +
                '</button>' +
            '</div>' +
            '<div class="roll-sep"></div>' +
            '<div class="roll-instrument-group">' +
                '<label class="instrument-label" style="font-size:0.72rem;color:var(--text-secondary)">Instr:</label>' +
                '<select id="roll-instrument-select" class="roll-instrument-select">' +
                    '<option value="sine">Sine</option>' +
                    '<option value="piano">Piano</option>' +
                    '<option value="organ">Organ</option>' +
                    '<option value="strings">Strings</option>' +
                    '<option value="synth">Synth</option>' +
                '</select>' +
            '</div>' +
            '<div class="roll-sep"></div>' +
            '<div class="roll-play-group">' +
                '<button id="roll-play-btn" class="roll-play-btn" title="Start playback">' +
                    '<svg id="roll-play-icon" viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M8 5v14l11-7z"/></svg>' +
                    '<svg id="roll-pause-icon" viewBox="0 0 24 24" width="16" height="16" style="display:none"><path fill="currentColor" d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>' +
                    '<span>Start</span>' +
                '</button>' +
                '<button id="roll-reset-btn" class="roll-reset-btn" title="Reset playback" disabled>' +
                    '<svg viewBox="0 0 24 24" width="16" height="16"><rect x="6" y="6" width="12" height="12" fill="currentColor"/></svg>' +
                    '<span>Reset</span>' +
                '</button>' +
            '</div>';

        el.appendChild(toolbar);

        // Ruler + main area
        const mainArea = document.createElement('div');
        mainArea.className = 'roll-main-area';

        // Grid wrapper (contains piano keys + grid, stacked vertically)
        const gridWrapper = document.createElement('div');
        gridWrapper.className = 'roll-grid-wrapper';

        // Piano (fixed left column, inside wrapper below ruler)
        this.pianoCanvas = document.createElement('canvas');
        this.pianoCanvas.className = 'roll-piano';
        this.pianoCanvas.style.width = CONFIG.PIANO_WIDTH + 'px';

        // Ruler (top, full width above grid)
        const rulerContainer = document.createElement('div');
        rulerContainer.className = 'roll-ruler-container';

        this.rulerCanvas = document.createElement('canvas');
        this.rulerCanvas.className = 'roll-ruler';
        rulerContainer.appendChild(this.rulerCanvas);

        // Grid container (scrollable)
        this.gridContainer = document.createElement('div');
        this.gridContainer.className = 'roll-grid-container';

        this.gridCanvas = document.createElement('canvas');
        this.gridCanvas.className = 'roll-grid';
        this.gridContainer.appendChild(this.gridCanvas);

        // Assemble: grid and piano keys side-by-side via CSS grid in roll-grid-wrapper
        // Ruler spans full width (grid-column: 1 / -1), piano keys col 1, grid col 2
        gridWrapper.appendChild(rulerContainer);
        gridWrapper.appendChild(this.pianoCanvas);
        gridWrapper.appendChild(this.gridContainer);

        mainArea.appendChild(gridWrapper);

        el.appendChild(mainArea);

        // Status bar
        const statusBar = document.createElement('div');
        statusBar.className = 'roll-status';
        statusBar.innerHTML =
            '<span id="roll-note-info">Click on the grid to place notes</span>' +
            '<span id="roll-timeline-info">Bar 1/' + Math.ceil(this.totalBeats / CONFIG.BEATS_PER_BAR) + ' | Beat 1</span>' +
            '<span id="roll-beat-info">' + this.totalBeats + ' beats</span>';
        el.appendChild(statusBar);

        // Context hint
        this.hintEl = statusBar.querySelector('#roll-note-info');
        this.beatInfoEl = statusBar.querySelector('#roll-beat-info');
        this.timelineInfoEl = statusBar.querySelector('#roll-timeline-info');
    };

    // ========== DIMENSIONS ==========
    PianoRollEditor.prototype._calculateDimensions = function () {
        this.totalRows = this.scale.length;
        const totalHeight = this.totalRows * this.rowHeight;

        // Stretch canvas to fill the viewport width (min: totalBeats, max: unlimited for scrolling)
        const minWidth = this.totalBeats * this.beatWidth;
        const containerWidth = this.gridContainer.clientWidth;
        // Fallback to minWidth if container hasn't been laid out yet
        this.stretchedWidth = containerWidth > 0 ? Math.max(minWidth, containerWidth - CONFIG.PIANO_WIDTH) : minWidth;
        const totalWidth = this.stretchedWidth;

        // Set canvas sizes
        const dpr = window.devicePixelRatio || 1;

        // Piano canvas
        this.pianoCanvas.width = CONFIG.PIANO_WIDTH * dpr;
        this.pianoCanvas.height = totalHeight * dpr;
        this.pianoCanvas.style.height = totalHeight + 'px';

        // Ruler canvas spans full width (piano + grid) to match the ruler HTML layout
        const rulerWidth = CONFIG.PIANO_WIDTH + totalWidth;
        this.rulerCanvas.width = rulerWidth * dpr;
        this.rulerCanvas.height = CONFIG.RULER_HEIGHT * dpr;
        this.rulerCanvas.style.width = rulerWidth + 'px';
        this.rulerCanvas.style.height = CONFIG.RULER_HEIGHT + 'px';
        this.rulerCtx = this.rulerCanvas.getContext('2d');
        this.rulerCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

        // Grid canvas
        this.gridCanvas.width = totalWidth * dpr;
        this.gridCanvas.height = totalHeight * dpr;
        this.gridCanvas.style.width = this.stretchedWidth + 'px';
        this.gridCanvas.style.height = totalHeight + 'px';

        // Set context transforms
        this.pianoCtx = this.pianoCanvas.getContext('2d');
        this.pianoCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

        this.gridCtx = this.gridCanvas.getContext('2d');
        this.gridCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

        this._drawPiano();
        this._drawRuler();
    };

    // ========== DRAWING ==========
    PianoRollEditor.prototype._drawPiano = function () {
        const ctx = this.pianoCtx;
        const w = CONFIG.PIANO_WIDTH;
        const h = this.totalRows * this.rowHeight;
        ctx.clearRect(0, 0, w, h);

        for (let i = 0; i < this.totalRows; i++) {
            // Draw from highest note at top to lowest at bottom
            let scaleIdx = this.totalRows - 1 - i;
            let note = this.scale[scaleIdx];
            let y = i * this.rowHeight;
            let isBlack = note.name.indexOf('#') !== -1;

            ctx.fillStyle = isBlack ? '#1a1f27' : '#21262d';
            ctx.fillRect(0, y, w, this.rowHeight);

            ctx.fillStyle = isBlack ? '#8b949e' : '#e6edf3';
            ctx.font = '10px sans-serif';
            ctx.textAlign = 'right';
            ctx.textBaseline = 'middle';
            ctx.fillText(note.name + note.octave, w - 4, y + this.rowHeight / 2);
            ctx.textBaseline = 'alphabetic';

            // Border
            ctx.strokeStyle = '#30363d';
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(w, y);
            ctx.stroke();
        }
        // Bottom border
        ctx.strokeStyle = '#30363d';
        ctx.beginPath();
        ctx.moveTo(0, h);
        ctx.lineTo(w, h);
        ctx.stroke();
    };

    PianoRollEditor.prototype._drawRuler = function () {
        const ctx = this.rulerCtx;
        const rulerWidth = CONFIG.PIANO_WIDTH + this.stretchedWidth;
        const pianoWidth = CONFIG.PIANO_WIDTH;
        ctx.clearRect(0, 0, rulerWidth, CONFIG.RULER_HEIGHT);
        ctx.fillStyle = '#161b22';
        ctx.fillRect(0, 0, rulerWidth, CONFIG.RULER_HEIGHT);

        for (let b = 0; b <= this.totalBeats; b++) {
            let x = pianoWidth + b * this.beatWidth;
            let isBar = b % CONFIG.BEATS_PER_BAR === 0;

            ctx.strokeStyle = isBar ? '#484f58' : '#30363d';
            ctx.lineWidth = isBar ? 1 : 0.5;
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, CONFIG.RULER_HEIGHT);
            ctx.stroke();

            if (isBar) {
                let barNum = Math.floor(b / CONFIG.BEATS_PER_BAR) + 1;
                ctx.fillStyle = '#8b949e';
                ctx.font = '10px sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(barNum + '', x + this.beatWidth * CONFIG.BEATS_PER_BAR / 2, CONFIG.RULER_HEIGHT / 2);
                ctx.textBaseline = 'alphabetic';
            }
        }
        // Bottom border
        ctx.strokeStyle = '#30363d';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, CONFIG.RULER_HEIGHT - 1);
        ctx.lineTo(rulerWidth, CONFIG.RULER_HEIGHT - 1);
        ctx.stroke();
    };

    PianoRollEditor.prototype._drawGrid = function () {
        const ctx = this.gridCtx;
        const totalWidth = this.stretchedWidth;
        const totalHeight = this.totalRows * this.rowHeight;

        ctx.clearRect(0, 0, totalWidth, totalHeight);

        // Background
        ctx.fillStyle = '#0d1117';
        ctx.fillRect(0, 0, totalWidth, totalHeight);

        // Horizontal lines (pitch lanes) - highest note at top
        for (let i = 0; i <= this.totalRows; i++) {
            let y = i * this.rowHeight;
            let scaleIdx = i < this.totalRows ? this.totalRows - 1 - i : -1;
            let note = scaleIdx >= 0 ? this.scale[scaleIdx] : null;
            let isBlack = note && note.name.indexOf('#') !== -1;
            ctx.fillStyle = isBlack ? 'rgba(26,31,39,0.5)' : 'transparent';
            if (isBlack) ctx.fillRect(0, y, totalWidth, this.rowHeight);

            ctx.strokeStyle = '#21262d';
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(totalWidth, y);
            ctx.stroke();
        }

        // Vertical lines (beat grid)
        for (let b = 0; b <= this.totalBeats; b++) {
            let x = b * this.beatWidth;
            let isBar = b % CONFIG.BEATS_PER_BAR === 0;
            ctx.strokeStyle = isBar ? '#30363d' : '#21262d';
            ctx.lineWidth = isBar ? 1 : 0.5;
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, totalHeight);
            ctx.stroke();
        }

        // Draw note blocks
        for (let n = 0; n < this.notes.length; n++) {
            let note = this.notes[n];
            // Draw connection lines for multi-note effects
            this._drawNoteConnections(ctx, note);
        }
        for (let n = 0; n < this.notes.length; n++) {
            let note = this.notes[n];
            this._drawNoteBlock(ctx, note, false);
        }

        // Draw selection box if box selecting
        if (this.isBoxSelecting) {
            this._drawSelectionBox(ctx);
        }

        // Draw ghost note preview
        if (this.ghostNote) {
            this._drawNoteBlock(ctx, this.ghostNote, true);
        }
    };

    PianoRollEditor.prototype._drawNoteConnections = function (ctx, note) {
        if (!note.linkedTo || note.linkedTo.length === 0) return;

        const fromX = note.startBeat * this.beatWidth;
        const fromY = this._midiToRow(note.midi) * this.rowHeight + this.rowHeight / 2;
        const fromW = note.duration * this.beatWidth;

        for (let i = 0; i < note.linkedTo.length; i++) {
            const targetId = note.linkedTo[i];
            const targetNote = this._getNoteById(targetId);
            if (!targetNote) continue;

            const toX = targetNote.startBeat * this.beatWidth;
            const toY = this._midiToRow(targetNote.midi) * this.rowHeight + this.rowHeight / 2;
            const toW = targetNote.duration * this.beatWidth;

            const startX = fromX + fromW;
            const endX = toX;
            const startY = fromY;
            const endY = toY;

            ctx.save();
            ctx.strokeStyle = 'rgba(255, 180, 50, 0.7)';
            ctx.lineWidth = 3;

            if (note.effectType === 'slide-up' || note.effectType === 'slide-down') {
                // Straight diagonal line
                ctx.beginPath();
                ctx.moveTo(startX, startY);
                ctx.lineTo(endX, endY);
                ctx.stroke();
            } else if (note.effectType === 'ease-in') {
                // Bezier curve: level start, diagonal middle, level end
                const ctrlX = (startX + endX) / 2;
                ctx.beginPath();
                ctx.moveTo(startX, startY);
                ctx.quadraticCurveTo(ctrlX, endY, endX, endY);
                ctx.stroke();
            } else if (note.effectType === 'ease-out') {
                // Bezier curve: diagonal start, level end
                const ctrlX = (startX + endX) / 2;
                ctx.beginPath();
                ctx.moveTo(startX, startY);
                ctx.quadraticCurveTo(ctrlX, startY, endX, endY);
                ctx.stroke();
            } else if (note.effectType === 'vibrato') {
                // Wavy line (S-curve)
                const amplitude = Math.abs(endY - startY) * 0.3 || 5;
                ctx.beginPath();
                ctx.moveTo(startX, startY);
                const steps = 8;
                for (let s = 0; s <= steps; s++) {
                    const t = s / steps;
                    const x = startX + (endX - startX) * t;
                    const y = startY + (endY - startY) * t + Math.sin(t * Math.PI * 4) * amplitude;
                    ctx.lineTo(x, y);
                }
                ctx.stroke();
            }
            ctx.restore();
        }
    };

    PianoRollEditor.prototype._drawSelectionBox = function (ctx) {
        const x = Math.min(this.boxStartX, this.boxEndX);
        const y = Math.min(this.boxStartY, this.boxEndY);
        const w = Math.abs(this.boxEndX - this.boxStartX);
        const h = Math.abs(this.boxEndY - this.boxStartY);

        ctx.save();
        ctx.fillStyle = 'rgba(88, 166, 255, 0.15)';
        ctx.fillRect(x, y, w, h);
        ctx.strokeStyle = 'rgba(88, 166, 255, 0.6)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(x, y, w, h);
        ctx.restore();
    };

    PianoRollEditor.prototype._drawNoteBlock = function (ctx, note, isGhost) {
        const rowIdx = this._midiToRow(note.midi);
        if (rowIdx < 0) return;

        let x = note.startBeat * this.beatWidth;
        let y = rowIdx * this.rowHeight;
        const w = note.duration * this.beatWidth;
        const h = this.rowHeight - 2;
        const ry = y + 1;

        if (w < 2) return;

        const isSelected = !isGhost && this._isNoteSelected(note.id);
        const cornerRadius = 4;

        // Shadow
        if (!isGhost) {
            ctx.shadowColor = 'rgba(0,0,0,0.4)';
            ctx.shadowBlur = 4;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 2;
        }

        ctx.beginPath();
        if (w < 2 * cornerRadius) {
            ctx.roundRect(x, ry, 2 * cornerRadius, h, [cornerRadius, cornerRadius, cornerRadius, cornerRadius]);
            ctx.rect(x, ry, 2 * cornerRadius, h);
        } else {
            ctx.roundRect(x, ry, w, h, cornerRadius);
        }

        if (isGhost) {
            ctx.fillStyle = CONFIG.NOTE_COLORS.ghost;
            ctx.strokeStyle = 'rgba(88,166,255,0.4)';
            ctx.lineWidth = 1;
        } else {
            const color = isSelected ? CONFIG.NOTE_COLORS.selected : CONFIG.NOTE_COLORS.normal;
            ctx.fillStyle = color;
            ctx.strokeStyle = isSelected ? '#8fc9ff' : 'rgba(88,166,255,0.5)';
            ctx.lineWidth = isSelected ? 1.5 : 1;
        }
        ctx.fill();
        ctx.stroke();

        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;

        // Note name inside (if wide enough)
        if (w > 18 && !isGhost) {
            let noteInfo = this._midiToNoteInfo(note.midi);
            if (noteInfo) {
                ctx.fillStyle = isSelected ? '#fff' : 'rgba(255,255,255,0.8)';
                ctx.font = 'bold 9px sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(noteInfo.name, x + w / 2, ry + h / 2);
                ctx.textBaseline = 'alphabetic';
            }
        }

        // Resize handles (only on selected notes)
        if (isSelected && !isGhost && w > 12) {
            const handleW = 6;
            ctx.fillStyle = 'rgba(255,255,255,0.5)';
            // Left handle
            ctx.fillRect(x + 1, ry + h / 2 - 4, handleW, 8);
            // Right handle
            ctx.fillRect(x + w - handleW - 1, ry + h / 2 - 4, handleW, 8);
        }
    };

    PianoRollEditor.prototype._drawAll = function () {
        this._drawPiano();
        this._drawRuler();
        this._drawGrid();
    };

    // ========== HIT TESTING ==========
    PianoRollEditor.prototype._getRowAtY = function (y) {
        let row = Math.floor(y / this.rowHeight);
        if (row < 0 || row >= this.totalRows) return -1;
        return row; // visual row (0=top=lowest note)
    };

    PianoRollEditor.prototype._getBeatAtX = function (x) {
        return x / this.beatWidth;
    };

    PianoRollEditor.prototype._midiToRow = function (midi) {
        for (let i = 0; i < this.scale.length; i++) {
            if (this.scale[i].midi === midi) return i;
        }
        return -1;
    };

    PianoRollEditor.prototype._midiToNoteInfo = function (midi) {
        for (let i = 0; i < this.scale.length; i++) {
            if (this.scale[i].midi === midi) return this.scale[i];
        }
        return null;
    };

    PianoRollEditor.prototype._rowToMidi = function (row) {
        if (row < 0 || row >= this.scale.length) return -1;
        return this.scale[row].midi;
    };

    PianoRollEditor.prototype._getNoteAt = function (x, y) {
        let row = this._getRowAtY(y);
        if (row < 0) return null;
        let midi = this._rowToMidi(row);
        if (midi < 0) return null;

        let beat = this._getBeatAtX(x);

        for (let i = 0; i < this.notes.length; i++) {
            let note = this.notes[i];
            if (note.midi !== midi) continue;
            if (beat >= note.startBeat && beat <= note.startBeat + note.duration) {
                return note;
            }
        }
        return null;
    };

    PianoRollEditor.prototype._getResizeHandle = function (x, y, note) {
        const nx = note.startBeat * this.beatWidth;
        const nw = note.duration * this.beatWidth;
        const handleZone = 8;

        if (Math.abs(x - nx) <= handleZone) return 'left';
        if (Math.abs((x - nx) - nw) <= handleZone) return 'right';
        return null;
    };

    // ========== EVENTS ==========
    PianoRollEditor.prototype._bindEvents = function () {
        const self = this;

        // Tool buttons
        this.container.querySelectorAll('.roll-tool-btn').forEach(function (btn) {
            btn.addEventListener('click', function () {
                self.activeTool = btn.dataset.tool;
                self.container.querySelectorAll('.roll-tool-btn').forEach(function (b) { b.classList.remove('active'); });
                btn.classList.add('active');
                self._clearSelection();
                self._drawGrid();
                self._updateHint();
            });
        });

        // Duration buttons
        this.container.querySelectorAll('.dur-btn').forEach(function (btn) {
            btn.addEventListener('click', function () {
                self.selectedDuration = parseFloat(btn.dataset.dur);
                self.container.querySelectorAll('.dur-btn').forEach(function (b) { b.classList.remove('active'); });
                btn.classList.add('active');
                self._updateHint();
            });
        });

        // Octave controls
        var rollOctaveUp = document.getElementById('roll-octave-up');
        var rollOctaveDown = document.getElementById('roll-octave-down');
        const rollOctaveValue = document.getElementById('roll-octave-value');
        if (rollOctaveUp) {
            rollOctaveUp.addEventListener('click', function () {
                self._shiftOctave(1);
            });
        }
        if (rollOctaveDown) {
            rollOctaveDown.addEventListener('click', function () {
                self._shiftOctave(-1);
            });
        }

        // Octave count controls
        var rollOctavesPlus = document.getElementById('roll-octaves-plus');
        var rollOctavesMinus = document.getElementById('roll-octaves-minus');
        const rollOctavesValue = document.getElementById('roll-octaves-value');
        if (rollOctavesPlus) {
            rollOctavesPlus.addEventListener('click', function () {
                self.setNumOctaves(self.numOctaves + 1);
                if (rollOctavesValue) rollOctavesValue.textContent = self.numOctaves;
            });
        }
        if (rollOctavesMinus) {
            rollOctavesMinus.addEventListener('click', function () {
                self.setNumOctaves(self.numOctaves - 1);
                if (rollOctavesValue) rollOctavesValue.textContent = self.numOctaves;
            });
        }

        // Scale mode controls
        const rollModeSelect = document.getElementById('roll-mode-select');
        if (rollModeSelect) {
            rollModeSelect.value = this.mode;
            rollModeSelect.addEventListener('change', function (e) {
                self.setMode(e.target.value);
            });
        }

        // Grid controls
        document.getElementById('roll-add-beat').addEventListener('click', function () {
            self.addBeats(4);
        });
        document.getElementById('roll-remove-beat').addEventListener('click', function () {
            self.removeBeats(4);
        });

        // Preset management
        document.getElementById('roll-save-preset').addEventListener('click', function () {
            self._savePreset();
        });
        document.getElementById('roll-share-preset').addEventListener('click', function () {
            self._sharePreset();
        });
        document.getElementById('roll-clear-all').addEventListener('click', function () {
            self._clearAll();
        });
        document.getElementById('roll-preset-select').addEventListener('change', function (e) {
            if (e.target.value) self._loadPreset(e.target.value);
        });
        document.getElementById('roll-new-preset').addEventListener('click', function () {
            self._newPreset();
        });

        // Play controls
        document.getElementById('roll-play-btn').addEventListener('click', function () {
            self._playMelody();
        });
        document.getElementById('roll-reset-btn').addEventListener('click', function () {
            self._resetMelody();
        });

        // Instrument selection
        const instrumentSelect = document.getElementById('roll-instrument-select');
        if (instrumentSelect) {
            instrumentSelect.addEventListener('change', function (e) {
                self.setInstrument(e.target.value);
            });
        }

        // Grid canvas events
        this.gridCanvas.addEventListener('mousedown', function (e) { self._onGridMouseDown(e); });
        this.gridCanvas.addEventListener('mousemove', function (e) { self._onGridMouseMove(e); });
        this.gridCanvas.addEventListener('mouseleave', function (e) { self._onGridMouseLeave(e); });
        this.gridCanvas.addEventListener('contextmenu', function (e) { e.preventDefault(); self._onRightClick(e); });

        // Document-level mouseup for box selection
        document.addEventListener('mouseup', function (e) { self._onMouseUp(e); });

        // Action buttons for vocal techniques
        document.getElementById('roll-action-slide-up')?.addEventListener('click', function () { self._applyEffect('slide-up'); });
        document.getElementById('roll-action-slide-down')?.addEventListener('click', function () { self._applyEffect('slide-down'); });
        document.getElementById('roll-action-ease-in')?.addEventListener('click', function () { self._applyEffect('ease-in'); });
        document.getElementById('roll-action-ease-out')?.addEventListener('click', function () { self._applyEffect('ease-out'); });
        document.getElementById('roll-action-vibrato')?.addEventListener('click', function () { self._applyEffect('vibrato'); });

        // Touch events
        this.gridCanvas.addEventListener('touchstart', function (e) { e.preventDefault(); self._onTouchStart(e); }, { passive: false });
        this.gridCanvas.addEventListener('touchmove', function (e) { e.preventDefault(); self._onTouchMove(e); }, { passive: false });
        this.gridCanvas.addEventListener('touchend', function (e) { e.preventDefault(); self._onTouchEnd(e); }, { passive: false });

        // Keyboard
        document.addEventListener('keydown', function (e) { self._onKeyDown(e); });

        // Scroll sync between grid and ruler
        this.gridContainer.addEventListener('scroll', function () {
            self.rulerCanvas.style.transform = 'translateX(' + (-self.gridContainer.scrollLeft) + 'px)';
            self.gridScrollX = self.gridContainer.scrollLeft;
        });

        // Ruler drag-to-seek (click and drag on ruler to scrub playback position)
        this.rulerCanvas.addEventListener('mousedown', function (e) {
            self.isSeeking = true;
            self.seekStartX = e.clientX;
            self._seekToRulerPosition(e);
        });

        document.addEventListener('mousemove', function (e) {
            if (self.isSeeking) {
                self._seekToRulerPosition(e);
            }
        });

        document.addEventListener('mouseup', function () {
            self.isSeeking = false;
        });

        // Window resize
        window.addEventListener('resize', function () {
            self._calculateDimensions();
            self._drawAll();
        });

        // Populate preset select
        this._populatePresetSelect();

        // Load preset from URL if present (shareable URL feature)
        this._loadFromUrl();
    };

    // ========== MOUSE EVENTS ==========
    PianoRollEditor.prototype._onGridMouseDown = function (e) {
        const rect = this.gridCanvas.getBoundingClientRect();
        let x = e.clientX - rect.left;
        let y = e.clientY - rect.top;

        if (this.activeTool === 'erase') {
            let note = this._getNoteAt(x, y);
            if (note) {
                this._removeNote(note.id);
            }
            return;
        }

        if (this.activeTool === 'select') {
            let hitNote = this._getNoteAt(x, y);

            if (hitNote) {
                // Check resize handles first
                let handle = this._getResizeHandle(x, y, hitNote);
                if (handle) {
                    this.isResizing = true;
                    this.resizeHandle = handle;
                    // Operate on the first selected note for resize
                    const firstSelected = this._getFirstSelectedNote();
                    this._selectNote(hitNote.id, false);
                    this.dragStartX = x;
                    this.dragStartBeat = hitNote.startBeat;
                    this.dragStartDuration = hitNote.duration;
                } else {
                    // Toggle selection with Shift, otherwise replace
                    if (e.shiftKey) {
                        if (this._isNoteSelected(hitNote.id)) {
                            this._deselectNote(hitNote.id);
                        } else {
                            this._selectNote(hitNote.id, true);
                        }
                    } else {
                        this._selectNote(hitNote.id, false);
                    }
                    this.dragStartX = x;
                    this.dragStartY = y;
                    this.isDragging = true;
                }
            } else {
                // No note hit — start box selection
                if (!e.shiftKey) {
                    this._clearSelection();
                }
                this.isBoxSelecting = true;
                this.boxStartX = x;
                this.boxStartY = y;
                this.boxEndX = x;
                this.boxEndY = y;
            }
        } else if (this.activeTool === 'place') {
            let hitNote = this._getNoteAt(x, y);

            if (hitNote) {
                // Select note and check resize handles
                this._selectNote(hitNote.id, false);
                let handle2 = this._getResizeHandle(x, y, hitNote);
                if (handle2) {
                    this.isResizing = true;
                    this.resizeHandle = handle2;
                    this.dragStartX = x;
                    this.dragStartBeat = hitNote.startBeat;
                    this.dragStartDuration = hitNote.duration;
                }
            } else {
                // Place new note
                let row = this._getRowAtY(y);
                if (row < 0) return;
                let midi = this._rowToMidi(row);
                if (midi < 0) return;

                let startBeat = snapToGrid(this._getBeatAtX(x), CONFIG.MIN_DURATION);
                if (startBeat < 0) startBeat = 0;

                // Check if there's already a note at this position on this pitch
                let conflict = false;
                for (let i = 0; i < this.notes.length; i++) {
                    var n = this.notes[i];
                    if (n.midi === midi && startBeat < n.startBeat + n.duration && startBeat + this.selectedDuration > n.startBeat) {
                        conflict = true;
                        break;
                    }
                }

                if (!conflict) {
                    this._addNote(midi, startBeat, this.selectedDuration);
                    this._selectNote(this.notes[this.notes.length - 1].id, false);
                }
            }
        }

        this._drawGrid();
        this._updateHint();
    };

    PianoRollEditor.prototype._onGridMouseMove = function (e) {
        const rect = this.gridCanvas.getBoundingClientRect();
        let x = e.clientX - rect.left;
        let y = e.clientY - rect.top;

        // Box selection
        if (this.isBoxSelecting) {
            this.boxEndX = x;
            this.boxEndY = y;
            this._drawGrid();
            return;
        }

        // Resizing
        if (this.isResizing) {
            let note = this._getNoteById(this.selectedNoteIds[0]);
            if (!note) return;

            const deltaX = x - this.dragStartX;
            const deltaBeat = deltaX / this.beatWidth;

            if (this.resizeHandle === 'left') {
                let newStart = snapToGrid(this.dragStartBeat + deltaBeat, CONFIG.MIN_DURATION);
                let newDuration = this.dragStartDuration - (newStart - this.dragStartBeat);
                if (newDuration >= CONFIG.MIN_DURATION && newStart >= 0) {
                    note.startBeat = Math.max(0, newStart);
                    note.duration = newDuration;
                }
            } else if (this.resizeHandle === 'right') {
                let newDuration2 = snapToGrid(this.dragStartDuration + deltaBeat, CONFIG.MIN_DURATION);
                if (newDuration2 >= CONFIG.MIN_DURATION) {
                    note.duration = newDuration2;
                }
            }
            this._drawGrid();
            this._updateHint();
            return;
        }

        // Dragging notes
        if (this.isDragging && this.selectedNoteIds.length > 0) {
            const deltaX = x - this.dragStartX;
            const deltaBeat = snapToGrid(deltaX / this.beatWidth, CONFIG.MIN_DURATION);
            const deltaRow = Math.round((y - this.dragStartY) / this.rowHeight);
            const self2 = this;

            this._getSelectedNotes().forEach(function (note) {
                // We need the original values — store them on first drag
                if (!note._origStartBeat) note._origStartBeat = note.startBeat;
                if (!note._origMidi) note._origMidi = note.midi;

                let newStart = note._origStartBeat + deltaBeat;
                let newMidi = note._origMidi + deltaRow;
                // Clamp within scale
                let newRow = self2._midiToRow(newMidi);
                if (newRow >= 0 && newRow < self2.scale.length) {
                    note.startBeat = Math.max(0, newStart);
                    note.midi = self2._rowToMidi(newRow);
                }
            });
            this._drawGrid();
            return;
        }

        // Ghost note preview
        if (this.activeTool === 'place') {
            let hitNote2 = this._getNoteAt(x, y);
            if (!hitNote2) {
                let row2 = this._getRowAtY(y);
                if (row2 >= 0) {
                    let midi2 = this._rowToMidi(row2);
                    let startBeat2 = snapToGrid(this._getBeatAtX(x), CONFIG.MIN_DURATION);
                    if (startBeat2 < 0) startBeat2 = 0;
                    this.ghostNote = { midi: midi2, startBeat: startBeat2, duration: this.selectedDuration };
                } else {
                    this.ghostNote = null;
                }
            } else {
                this.ghostNote = null;
            }
            this._drawGrid();
        }
    };

    PianoRollEditor.prototype._onMouseUp = function (e) {
        if (this.isBoxSelecting) {
            // Select all notes in the box
            this._selectNotesInBox(this.boxStartX, this.boxStartY, this.boxEndX, this.boxEndY);
            this.isBoxSelecting = false;
            this._drawGrid();
            this._updateHint();
        }

        if (this.isResizing) {
            let note = this._getNoteById(this.selectedNoteIds[0]);
            if (note) {
                note.duration = Math.max(CONFIG.MIN_DURATION, snapToGrid(note.duration, CONFIG.MIN_DURATION));
                note.startBeat = Math.max(0, note.startBeat);
            }
        }

        if (this.isDragging) {
            // Clear original position markers
            this._getSelectedNotes().forEach(function (note) {
                delete note._origStartBeat;
                delete note._origMidi;
            });
        }

        this.isResizing = false;
        this.resizeHandle = null;
        this.isDragging = false;
        this.ghostNote = null;
        this._drawGrid();
    };

    PianoRollEditor.prototype._onGridMouseUp = function (e) {
        // Mouse up on canvas — delegate to document handler
        this._onMouseUp(e);
    };

    PianoRollEditor.prototype._onGridMouseLeave = function (e) {
        // Only cancel box selection if mouse truly left the canvas
        if (this.isBoxSelecting) {
            this.isBoxSelecting = false;
            this._drawGrid();
        }
        this.ghostNote = null;
        this._drawGrid();
    };

    PianoRollEditor.prototype._onRightClick = function (e) {
        e.preventDefault();
        const rect = this.gridCanvas.getBoundingClientRect();
        let x = e.clientX - rect.left;
        let y = e.clientY - rect.top;
        let note = this._getNoteAt(x, y);
        if (note) {
            this._removeNote(note.id);
        }
    };

    // ========== TOUCH EVENTS ==========
    PianoRollEditor.prototype._onTouchStart = function (e) {
        e.preventDefault();
        const touch = e.touches[0];
        const rect = this.gridCanvas.getBoundingClientRect();
        let x = touch.clientX - rect.left;
        let y = touch.clientY - rect.top;
        this._onGridMouseDown({ clientX: touch.clientX, clientY: touch.clientY, target: e.target });
    };

    PianoRollEditor.prototype._onTouchMove = function (e) {
        e.preventDefault();
        const touch = e.touches[0];
        this._onGridMouseMove({ clientX: touch.clientX, clientY: touch.clientY, target: e.target });
    };

    PianoRollEditor.prototype._onTouchEnd = function (e) {
        e.preventDefault();
        this._onGridMouseUp({});
    };

    // ========== KEYBOARD ==========
    PianoRollEditor.prototype._onKeyDown = function (e) {
        // Only handle if editor is visible
        if (!this.container.offsetParent) return;

        if (e.key === 'Delete' || e.key === 'Backspace') {
            if (this.selectedNoteIds.length > 0) {
                e.preventDefault();
                // Remove all selected notes
                var idsToRemove = this.selectedNoteIds.slice();
                var self2 = this;
                idsToRemove.forEach(function (id) { self2._removeNote(id); });
                this._clearSelection();
                this._drawGrid();
                this._updateHint();
            }
        }
        if (e.key === 'Escape') {
            this._clearSelection();
            this._drawGrid();
            this._updateHint();
        }
        // Select all with Ctrl+A
        if (e.key === 'a' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            var allIds = this.notes.map(function (n) { return n.id; });
            this.selectedNoteIds = allIds;
            this._drawGrid();
            this._updateHint();
        }
    };

    // ========== NOTE MANAGEMENT ==========
    PianoRollEditor.prototype._getSelectedNotes = function () {
        const self = this;
        return this.notes.filter(function (n) { return self.selectedNoteIds.indexOf(n.id) !== -1; });
    };

    PianoRollEditor.prototype._getFirstSelectedNote = function () {
        for (let i = 0; i < this.notes.length; i++) {
            if (this.selectedNoteIds.indexOf(this.notes[i].id) !== -1) return this.notes[i];
        }
        return null;
    };

    PianoRollEditor.prototype._isNoteSelected = function (id) {
        return this.selectedNoteIds.indexOf(id) !== -1;
    };

    PianoRollEditor.prototype._selectNote = function (id, addToSelection) {
        if (addToSelection) {
            if (this.selectedNoteIds.indexOf(id) === -1) {
                this.selectedNoteIds.push(id);
            }
        } else {
            this.selectedNoteIds = [id];
        }
    };

    PianoRollEditor.prototype._deselectNote = function (id) {
        const idx = this.selectedNoteIds.indexOf(id);
        if (idx !== -1) this.selectedNoteIds.splice(idx, 1);
    };

    PianoRollEditor.prototype._selectNotesInBox = function (x1, y1, x2, y2) {
        const minX = Math.min(x1, x2);
        const maxX = Math.max(x1, x2);
        const minY = Math.min(y1, y2);
        const maxY = Math.max(y1, y2);

        const self = this;
        this.notes.forEach(function (note) {
            const noteX = note.startBeat * self.beatWidth;
            const noteW = note.duration * self.beatWidth;
            const noteY = self._midiToRow(note.midi) * self.rowHeight;
            const noteH = self.rowHeight;

            // Check if note overlaps with box
            if (noteX + noteW > minX && noteX < maxX && noteY + noteH > minY && noteY < maxY) {
                if (self.selectedNoteIds.indexOf(note.id) === -1) {
                    self.selectedNoteIds.push(note.id);
                }
            }
        });
    };

    PianoRollEditor.prototype._clearSelection = function () {
        this.selectedNoteIds = [];
    };

    PianoRollEditor.prototype._addNote = function (midi, startBeat, duration) {
        let note = {
            id: generateId(),
            midi: midi,
            startBeat: startBeat,
            duration: duration
        };
        this.notes.push(note);
        this._drawGrid();
        this._updateBeatInfo();
    };

    PianoRollEditor.prototype._removeNote = function (id) {
        for (let i = 0; i < this.notes.length; i++) {
            if (this.notes[i].id === id) {
                // Remove from any linkedTo references in other notes
                for (let j = 0; j < this.notes.length; j++) {
                    if (this.notes[j].linkedTo) {
                        const idx = this.notes[j].linkedTo.indexOf(id);
                        if (idx !== -1) this.notes[j].linkedTo.splice(idx, 1);
                    }
                }
                this.notes.splice(i, 1);
                this._deselectNote(id);
                break;
            }
        }
        this._drawGrid();
        this._updateBeatInfo();
    };

    PianoRollEditor.prototype._getNoteById = function (id) {
        for (let i = 0; i < this.notes.length; i++) {
            if (this.notes[i].id === id) return this.notes[i];
        }
        return null;
    };

    PianoRollEditor.prototype._clearAll = function () {
        if (this.notes.length === 0) return;
        if (!confirm('Clear all notes?')) return;
        this.notes = [];
        this._clearSelection();
        this._drawGrid();
        this._updateBeatInfo();
    };

    // ========== VOCAL TECHNIQUE EFFECTS ==========
    /**
     * Apply a vocal technique effect to selected notes.
     * Requires exactly 2 notes selected for slides.
     * Requires exactly 1 note selected for vibrato.
     */
    PianoRollEditor.prototype._applyEffect = function (effectType) {
        const selected = this._getSelectedNotes();
        if (selected.length === 0) {
            this._updateHint();
            return;
        }

        if (effectType === 'vibrato') {
            // Apply vibrato to each selected note
            selected.forEach(function (note) {
                note.effectType = 'vibrato';
                note.linkedTo = [];
            });
        } else if (selected.length === 2) {
            // Sort by start beat to determine direction
            const sorted = selected.slice().sort(function (a, b) { return a.startBeat - b.startBeat; });
            const first = sorted[0];
            const second = sorted[1];

            if (effectType === 'slide-up') {
                // Second note must be higher pitch
                if (second.midi <= first.midi) {
                    alert('Ascending slide requires the second note to be higher than the first.');
                    return;
                }
                first.effectType = 'slide-up';
                first.linkedTo = [second.id];
                // Extend first note's duration to meet second note
                first.duration = Math.max(first.duration, second.startBeat - first.startBeat + 0.5);
            } else if (effectType === 'slide-down') {
                // Second note must be lower pitch
                if (second.midi >= first.midi) {
                    alert('Descending slide requires the second note to be lower than the first.');
                    return;
                }
                first.effectType = 'slide-down';
                first.linkedTo = [second.id];
                first.duration = Math.max(first.duration, second.startBeat - first.startBeat + 0.5);
            } else if (effectType === 'ease-in') {
                // Ease in: first note level, slides to second note at middle
                if (second.midi === first.midi) {
                    alert('Ease In requires two notes at different pitches.');
                    return;
                }
                first.effectType = 'ease-in';
                first.linkedTo = [second.id];
                first.duration = Math.max(first.duration, second.startBeat - first.startBeat + 0.5);
            } else if (effectType === 'ease-out') {
                // Ease out: slides from first to second, then levels
                if (second.midi === first.midi) {
                    alert('Ease Out requires two notes at different pitches.');
                    return;
                }
                first.effectType = 'ease-out';
                first.linkedTo = [second.id];
                first.duration = Math.max(first.duration, second.startBeat - first.startBeat + 0.5);
            }
        } else {
            alert('Slides require exactly 2 notes selected (order by time). Vibrato works on 1 or more notes.');
            return;
        }

        this._drawGrid();
        this._updateHint();
    };

    // ========== BEAT MANAGEMENT ==========
    PianoRollEditor.prototype.addBeats = function (count) {
        this.totalBeats += count;
        this._calculateDimensions();
        this._drawAll();
        this._updateBeatInfo();
    };

    PianoRollEditor.prototype.removeBeats = function (count) {
        const newTotal = this.totalBeats - count;
        if (newTotal < 4) return;
        // Check if any notes would be cut off
        let wouldCut = false;
        for (let i = 0; i < this.notes.length; i++) {
            if (this.notes[i].startBeat + this.notes[i].duration > newTotal) {
                wouldCut = true;
                break;
            }
        }
        if (wouldCut && !confirm('This will trim some notes. Continue?')) return;
        // Trim notes that extend beyond
        this.notes = this.notes.filter(function (n) {
            if (n.startBeat >= newTotal) return false;
            if (n.startBeat + n.duration > newTotal) {
                n.duration = newTotal - n.startBeat;
            }
            return true;
        });
        this.totalBeats = newTotal;
        this._calculateDimensions();
        this._drawAll();
        this._updateBeatInfo();
    };

    // ========== HINT / STATUS ==========
    PianoRollEditor.prototype._updateHint = function () {
        if (!this.hintEl) return;
        if (this.selectedNoteIds.length > 0) {
            if (this.selectedNoteIds.length === 1) {
                let note = this._getFirstSelectedNote();
                if (note) {
                    const info = this._midiToNoteInfo(note.midi);
                    let name = info ? info.name + info.octave : '?';
                    this.hintEl.textContent = 'Selected: ' + name + ' | Duration: ' + note.duration + 'b | ' + formatBeat(note.startBeat) + ' — Right-click or Del to delete';
                }
            } else {
                this.hintEl.textContent = this.selectedNoteIds.length + ' notes selected | Shift+click to toggle | Drag to multi-move | Del to delete | Action buttons create slides';
            }
        } else if (this.activeTool === 'place') {
            this.hintEl.textContent = 'Click to place a ' + this.selectedDuration + 'b note | Right-click to delete';
        } else if (this.activeTool === 'erase') {
            this.hintEl.textContent = 'Click on a note to erase it';
        } else {
            this.hintEl.textContent = 'Click and drag note edges to resize | Del to delete selected';
        }
    };

    PianoRollEditor.prototype._updateBeatInfo = function () {
        if (!this.beatInfoEl) return;
        this.beatInfoEl.textContent = this.totalBeats + ' beats | ' + (this.totalBeats / CONFIG.BEATS_PER_BAR) + ' bars | ' + this.notes.length + ' notes';
    };

    /** Update the timeline info display (bar/beat position during playback) */
    PianoRollEditor.prototype._updateTimelineInfo = function (beat) {
        if (!this.timelineInfoEl) return;
        const totalBars = Math.ceil(this.totalBeats / CONFIG.BEATS_PER_BAR);
        const currentBar = Math.floor(beat / CONFIG.BEATS_PER_BAR) + 1;
        const currentBeat = Math.floor(beat % CONFIG.BEATS_PER_BAR) + 1;
        this.timelineInfoEl.textContent = 'Bar ' + currentBar + '/' + totalBars + ' | Beat ' + currentBeat;
    };

    // ========== PRESETS ==========
    PianoRollEditor.prototype._populatePresetSelect = function () {
        const sel = document.getElementById('roll-preset-select');
        if (!sel) return;
        sel.innerHTML = '<option value="">— Load Preset —</option>';
        const names = Object.keys(this.presets).sort();
        for (let i = 0; i < names.length; i++) {
            const opt = document.createElement('option');
            opt.value = names[i];
            opt.textContent = names[i];
            sel.appendChild(opt);
        }
    };

    PianoRollEditor.prototype._savePreset = function () {
        const nameInput = document.getElementById('roll-preset-name');
        let name = nameInput ? nameInput.value.trim() : '';
        if (!name) {
            alert('Please enter a preset name.');
            return;
        }
        this.presets[name] = {
            notes: this.notes.map(function (n) {
                return {
                    midi: n.midi,
                    startBeat: n.startBeat,
                    duration: n.duration,
                    effectType: n.effectType || null,
                    linkedTo: n.linkedTo || []
                };
            }),
            totalBeats: this.totalBeats,
            bpm: this.bpm,
            scale: this.scale.map(function (s) { return { midi: s.midi, name: s.name, octave: s.octave, freq: s.freq }; })
        };
        savePresets(this.presets);
        this._populatePresetSelect();
        document.getElementById('roll-preset-select').value = name;
        this.currentPresetName = name;
        localStorage.setItem(LAST_PRESET_KEY, name);
        setSelectedPresetName(name);

        // Notify practice tab to refresh preset list
        window.dispatchEvent(new CustomEvent('pitchperfect:presetSaved', { detail: { name: name } }));
    };

    PianoRollEditor.prototype._loadPreset = function (name) {
        const preset = this.presets[name];
        if (!preset) return;
        this.notes = preset.notes.map(function (n) {
            return {
                id: generateId(),
                midi: n.midi,
                startBeat: n.startBeat,
                duration: n.duration,
                effectType: n.effectType || null,
                linkedTo: n.linkedTo || []
            };
        });
        this.totalBeats = preset.totalBeats || 16;
        if (preset.bpm) {
            this.bpm = preset.bpm;
        }
        this._clearSelection();
        this._calculateDimensions();
        this._drawAll();
        this._updateBeatInfo();
        this._updateHint();
        this.currentPresetName = name;
        localStorage.setItem(LAST_PRESET_KEY, name);
        setSelectedPresetName(name);
        document.getElementById('roll-preset-name').value = name;

        // Notify practice tab that preset was loaded (with BPM)
        window.dispatchEvent(new CustomEvent('pitchperfect:presetLoaded', { detail: { name: name, bpm: this.bpm } }));
    };

    PianoRollEditor.prototype._loadLastPreset = function () {
        const last = localStorage.getItem(LAST_PRESET_KEY);
        if (last && this.presets[last]) {
            this._loadPreset(last);
        } else if (this.notes.length === 0) {
            this.notes = getDefaultMelody();
            this._drawGrid();
            this._updateBeatInfo();
        }
    };

    PianoRollEditor.prototype._newPreset = function () {
        this.notes = [];
        this.totalBeats = 16;
        this._clearSelection();
        this.currentPresetName = '';
        localStorage.removeItem(LAST_PRESET_KEY);
        setSelectedPresetName('');
        document.getElementById('roll-preset-select').value = '';
        document.getElementById('roll-preset-name').value = '';
        this._calculateDimensions();
        this._drawAll();
        this._updateBeatInfo();
    };

    // ========== SHARE PRESET URL ==========
    PianoRollEditor.prototype._sharePreset = function () {
        const presetData = {
            n: this.notes.map(function (note) {
                return {
                    m: note.midi,
                    s: note.startBeat,
                    d: note.duration,
                    e: note.effectType || null,
                    l: note.linkedTo || []
                };
            }),
            b: this.totalBeats,
            p: this.bpm
        };
        const json = JSON.stringify(presetData);
        const encoded = btoa(unescape(encodeURIComponent(json)));
        const url = window.location.origin + window.location.pathname + '?preset=' + encoded;

        // Copy to clipboard
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(url).then(function () {
                alert('Share URL copied to clipboard!');
            }).catch(function () {
                prompt('Copy this URL:', url);
            });
        } else {
            prompt('Copy this URL:', url);
        }
    };

    /** Load preset from URL parameter on page load */
    PianoRollEditor.prototype._loadFromUrl = function () {
        const params = new URLSearchParams(window.location.search);
        const encoded = params.get('preset');
        if (!encoded) return;

        try {
            const json = decodeURIComponent(escape(atob(encoded)));
            const data = JSON.parse(json);
            if (!data.n || !Array.isArray(data.n)) return;

            this.notes = data.n.map(function (n) {
                return {
                    id: generateId(),
                    midi: n.m,
                    startBeat: n.s,
                    duration: n.d,
                    effectType: n.e || null,
                    linkedTo: Array.isArray(n.l) ? n.l : []
                };
            });
            this.totalBeats = data.b || 16;
            if (data.p) this.bpm = data.p;
            this._clearSelection();
            this._calculateDimensions();
            this._drawAll();
            this._updateBeatInfo();
            this._updateHint();
        } catch (e) {
            console.warn('Failed to load preset from URL:', e);
        }
    };

    // ========== PLAYBACK ==========
    PianoRollEditor.prototype._playMelody = function () {
        if (this.notes.length === 0) return;

        const playBtn = document.getElementById('roll-play-btn');
        const playIcon = document.getElementById('roll-play-icon');
        const pauseIcon = document.getElementById('roll-pause-icon');
        const resetBtn = document.getElementById('roll-reset-btn');
        const self = this;

        if (this._playbackState === 'stopped') {
            // Initialize audio context on first play (browser requirement)
            if (window.pianoRollAudioEngine) {
                window.pianoRollAudioEngine.init();
            }

            // Start fresh playback — use playhead position if user dragged it while stopped
            const sortedNotes = this.notes.slice().sort(function (a, b) { return a.startBeat - b.startBeat; });
            const lastNote = sortedNotes[sortedNotes.length - 1];
            // unused: var totalDuration = (lastNote.startBeat + lastNote.duration) * (60000 / this.bpm);

            this._playbackState = 'playing';
            this._playStartTime = performance.now() - (this._activeBeat / this.bpm) * 60000;
            this._pauseStartTime = 0;
            this._playAnimationId = requestAnimationFrame(function () { self._animatePlayback(); });

            playIcon.style.display = 'none';
            pauseIcon.style.display = 'block';
            playBtn.querySelector('span').textContent = 'Pause';
            resetBtn.disabled = false;
        } else if (this._playbackState === 'playing') {
            // Pause
            this._pauseStartTime = performance.now();
            this._playbackState = 'paused';
            if (this._playAnimationId) {
                cancelAnimationFrame(this._playAnimationId);
                this._playAnimationId = null;
            }
            if (window.pianoRollAudioEngine) {
                window.pianoRollAudioEngine.stopTone();
            }

            playIcon.style.display = 'block';
            pauseIcon.style.display = 'none';
            playBtn.querySelector('span').textContent = 'Continue';
        } else if (this._playbackState === 'paused') {
            // Resume
            const pauseDuration = performance.now() - this._pauseStartTime;
            this._playStartTime += pauseDuration;
            this._playbackState = 'playing';
            this._playAnimationId = requestAnimationFrame(function () { self._animatePlayback(); });

            playIcon.style.display = 'none';
            pauseIcon.style.display = 'block';
            playBtn.querySelector('span').textContent = 'Pause';
        }
    };

    PianoRollEditor.prototype._resetMelody = function () {
        this._playbackState = 'stopped';
        this._activeBeat = 0;
        if (this._playAnimationId) {
            cancelAnimationFrame(this._playAnimationId);
            this._playAnimationId = null;
        }
        if (window.pianoRollAudioEngine) {
            window.pianoRollAudioEngine.stopTone();
        }

        const playBtn = document.getElementById('roll-play-btn');
        const playIcon = document.getElementById('roll-play-icon');
        const pauseIcon = document.getElementById('roll-pause-icon');
        const resetBtn = document.getElementById('roll-reset-btn');
        playIcon.style.display = 'block';
        pauseIcon.style.display = 'none';
        playBtn.querySelector('span').textContent = 'Start';
        resetBtn.disabled = true;

        this.gridContainer.scrollLeft = 0;
        this._drawGrid();
    };

    PianoRollEditor.prototype._seekToRulerPosition = function (e) {
        const rect = this.rulerCanvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const beat = Math.max(0, Math.min(this.totalBeats, x / this.beatWidth));
        const targetScroll = beat * this.beatWidth - rect.width / 2;
        this.gridContainer.scrollLeft = Math.max(0, targetScroll);

        // Update playhead position visually and timeline
        this._activeBeat = beat;
        this._updateTimelineInfo(beat);
        this._drawGridWithPlayhead();

        // If playback is active, also update the playback start time so
        // playback continues from the new position on mouseup
        if (this._playbackState === 'playing') {
            this._playStartTime = performance.now() - (beat / this.bpm) * 60000;
        }
    };

    PianoRollEditor.prototype._animatePlayback = function () {
        if (this._playbackState !== 'playing') return;
        const self = this;

        const elapsed = performance.now() - this._playStartTime;
        const currentBeat = (elapsed / 60000) * this.bpm;
        const sortedNotes = this.notes.slice().sort(function (a, b) { return a.startBeat - b.startBeat; });
        const lastNote = sortedNotes[sortedNotes.length - 1];
        // unused: var totalDuration = (lastNote.startBeat + lastNote.duration) * (60000 / this.bpm);

        // Scroll grid to keep playhead visible
        const playheadX = currentBeat * this.beatWidth;
        const containerWidth = this.gridContainer.clientWidth;
        const targetScroll = playheadX - containerWidth * 0.3;
        if (targetScroll > 0) {
            this.gridContainer.scrollLeft = targetScroll;
        }

        // Play tones for notes that start at current beat
        if (window.pianoRollAudioEngine) {
            for (let i = 0; i < sortedNotes.length; i++) {
                let note = sortedNotes[i];
                if (Math.abs(note.startBeat - currentBeat) < 0.05) {
                    let noteInfo = this._midiToNoteInfo(note.midi);
                    if (noteInfo) {
                        let durationMs = note.duration * (60000 / this.bpm);
                        window.pianoRollAudioEngine.playNote(noteInfo.freq, durationMs, note.effectType);
                    }
                }
            }
        }

        // Highlight active notes
        this._activeBeat = currentBeat;
        this._updateTimelineInfo(currentBeat);
        this._drawGridWithPlayhead();

        if (currentBeat >= lastNote.startBeat + lastNote.duration) {
            this._resetMelody();
            return;
        }

        this._playAnimationId = requestAnimationFrame(function () { self._animatePlayback(); });
    };

    PianoRollEditor.prototype._drawGridWithPlayhead = function () {
        const ctx = this.gridCtx;
        const totalWidth = this.stretchedWidth;
        const totalHeight = this.totalRows * this.rowHeight;

        ctx.clearRect(0, 0, totalWidth, totalHeight);

        // Background
        ctx.fillStyle = '#0d1117';
        ctx.fillRect(0, 0, totalWidth, totalHeight);

        // Horizontal lines - highest note at top
        for (let i = 0; i <= this.totalRows; i++) {
            let y = i * this.rowHeight;
            let scaleIdx = i < this.totalRows ? this.totalRows - 1 - i : -1;
            let note = scaleIdx >= 0 ? this.scale[scaleIdx] : null;
            let isBlack = note && note.name.indexOf('#') !== -1;
            ctx.fillStyle = isBlack ? 'rgba(26,31,39,0.5)' : 'transparent';
            if (isBlack) ctx.fillRect(0, y, totalWidth, this.rowHeight);
            ctx.strokeStyle = '#21262d';
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(totalWidth, y);
            ctx.stroke();
        }

        // Vertical lines
        for (let b = 0; b <= this.totalBeats; b++) {
            let x = b * this.beatWidth;
            let isBar = b % CONFIG.BEATS_PER_BAR === 0;
            ctx.strokeStyle = isBar ? '#30363d' : '#21262d';
            ctx.lineWidth = isBar ? 1 : 0.5;
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, totalHeight);
            ctx.stroke();
        }

        // Draw note connections first (below the note blocks)
        for (let n = 0; n < this.notes.length; n++) {
            this._drawNoteConnections(ctx, this.notes[n]);
        }

        // Note blocks
        const currentBeat = this._activeBeat || 0;
        for (let n = 0; n < this.notes.length; n++) {
            let note = this.notes[n];
            const isActive = currentBeat >= note.startBeat && currentBeat < note.startBeat + note.duration;
            this._drawNoteBlock(ctx, note, false, isActive);
        }

        // Draw playhead line
        const playheadX = currentBeat * this.beatWidth;
        ctx.save();
        ctx.strokeStyle = '#58a6ff';
        ctx.lineWidth = 2;
        ctx.shadowColor = 'rgba(88, 166, 255, 0.5)';
        ctx.shadowBlur = 4;
        ctx.beginPath();
        ctx.moveTo(playheadX, 0);
        ctx.lineTo(playheadX, totalHeight);
        ctx.stroke();
        ctx.restore();

        // Draw playhead triangle on top of the ruler
        if (this.rulerCtx) {
            const rulerCtx = this.rulerCtx;
            const rulerWidth = CONFIG.PIANO_WIDTH + this.stretchedWidth;
            rulerCtx.clearRect(0, 0, rulerWidth, CONFIG.RULER_HEIGHT);
            rulerCtx.fillStyle = '#161b22';
            rulerCtx.fillRect(0, 0, rulerWidth, CONFIG.RULER_HEIGHT);
            // Redraw ruler bars
            for (let b = 0; b <= this.totalBeats; b++) {
                let x = CONFIG.PIANO_WIDTH + b * this.beatWidth;
                let isBar = b % CONFIG.BEATS_PER_BAR === 0;
                rulerCtx.strokeStyle = isBar ? '#484f58' : '#30363d';
                rulerCtx.lineWidth = isBar ? 1 : 0.5;
                rulerCtx.beginPath();
                rulerCtx.moveTo(x, 0);
                rulerCtx.lineTo(x, CONFIG.RULER_HEIGHT);
                rulerCtx.stroke();
                if (isBar) {
                    let barNum = Math.floor(b / CONFIG.BEATS_PER_BAR) + 1;
                    rulerCtx.fillStyle = '#8b949e';
                    rulerCtx.font = '10px sans-serif';
                    rulerCtx.textAlign = 'center';
                    rulerCtx.textBaseline = 'middle';
                    rulerCtx.fillText(barNum + '', x + this.beatWidth * CONFIG.BEATS_PER_BAR / 2, CONFIG.RULER_HEIGHT / 2);
                    rulerCtx.textBaseline = 'alphabetic';
                }
            }
            rulerCtx.strokeStyle = '#30363d';
            rulerCtx.lineWidth = 1;
            rulerCtx.beginPath();
            rulerCtx.moveTo(0, CONFIG.RULER_HEIGHT - 1);
            rulerCtx.lineTo(rulerWidth, CONFIG.RULER_HEIGHT - 1);
            rulerCtx.stroke();
            // Playhead triangle on ruler
            rulerCtx.save();
            rulerCtx.fillStyle = '#58a6ff';
            rulerCtx.shadowColor = 'rgba(88, 166, 255, 0.5)';
            rulerCtx.shadowBlur = 4;
            const triSize = 6;
            const rulerPlayheadX = CONFIG.PIANO_WIDTH + playheadX;
            rulerCtx.beginPath();
            rulerCtx.moveTo(rulerPlayheadX, CONFIG.RULER_HEIGHT);
            rulerCtx.lineTo(rulerPlayheadX - triSize, CONFIG.RULER_HEIGHT - triSize - 1);
            rulerCtx.lineTo(rulerPlayheadX + triSize, CONFIG.RULER_HEIGHT - triSize - 1);
            rulerCtx.closePath();
            rulerCtx.fill();
            rulerCtx.restore();
        }
    };

    PianoRollEditor.prototype._drawNoteBlock = function (ctx, note, isGhost, isActive) {
        const rowIdx = this._midiToRow(note.midi);
        if (rowIdx < 0) return;

        let x = note.startBeat * this.beatWidth;
        let y = rowIdx * this.rowHeight;
        const w = note.duration * this.beatWidth;
        const h = this.rowHeight - 2;
        const ry = y + 1;

        if (w < 2) return;

        const isSelected = !isGhost && this._isNoteSelected(note.id);
        const cornerRadius = 4;

        if (isActive && !isGhost) {
            ctx.shadowColor = 'rgba(63,185,80,0.6)';
            ctx.shadowBlur = 8;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0;
        } else if (!isGhost) {
            ctx.shadowColor = 'rgba(0,0,0,0.3)';
            ctx.shadowBlur = 3;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 1;
        }

        ctx.beginPath();
        if (w < 2 * cornerRadius) {
            ctx.roundRect(x, ry, 2 * cornerRadius, h, [cornerRadius, cornerRadius, cornerRadius, cornerRadius]);
        } else {
            ctx.roundRect(x, ry, w, h, cornerRadius);
        }

        if (isGhost) {
            ctx.fillStyle = CONFIG.NOTE_COLORS.ghost;
            ctx.strokeStyle = 'rgba(88,166,255,0.4)';
            ctx.lineWidth = 1;
        } else if (isActive) {
            ctx.fillStyle = CONFIG.NOTE_COLORS.active;
            ctx.strokeStyle = 'rgba(63,185,80,0.9)';
            ctx.lineWidth = 1.5;
        } else {
            const color = isSelected ? CONFIG.NOTE_COLORS.selected : CONFIG.NOTE_COLORS.normal;
            ctx.fillStyle = color;
            ctx.strokeStyle = isSelected ? '#8fc9ff' : 'rgba(88,166,255,0.5)';
            ctx.lineWidth = isSelected ? 1.5 : 1;
        }
        ctx.fill();
        ctx.stroke();

        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetY = 0;

        // Note name
        if (w > 18 && !isGhost) {
            let noteInfo = this._midiToNoteInfo(note.midi);
            if (noteInfo) {
                ctx.fillStyle = isActive ? '#fff' : 'rgba(255,255,255,0.85)';
                ctx.font = 'bold 9px sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(noteInfo.name, x + w / 2, ry + h / 2);
                ctx.textBaseline = 'alphabetic';
            }
        }

        // Resize handles
        if (isSelected && !isGhost && w > 12) {
            const handleW = 6;
            ctx.fillStyle = 'rgba(255,255,255,0.5)';
            ctx.fillRect(x + 1, ry + h / 2 - 4, handleW, 8);
            ctx.fillRect(x + w - handleW - 1, ry + h / 2 - 4, handleW, 8);
        }
    };

    // ========== PUBLIC API ==========
    PianoRollEditor.prototype.getMelody = function () {
        const self = this;
        return this.notes.slice().sort(function (a, b) { return a.startBeat - b.startBeat; }).map(function (n) {
            let noteInfo = self._midiToNoteInfo(n.midi);
            return {
                note: noteInfo || { midi: n.midi, name: '?', octave: 4, freq: 440 },
                startBeat: n.startBeat,
                duration: n.duration
            };
        });
    };

    PianoRollEditor.prototype.setMelody = function (melodyData) {
        const self = this;
        this.notes = melodyData.map(function (item) {
            const noteData = item.note || {};
            return {
                id: generateId(),
                midi: noteData.midi || (item.midi || 60),
                startBeat: item.startBeat || 0,
                duration: item.duration || 1
            };
        });
        this._calculateDimensions();
        this._drawAll();
        this._updateBeatInfo();
    };

    PianoRollEditor.prototype.setScale = function (scale) {
        this.scale = scale;
        this._calculateDimensions();
        this._drawAll();
    };

    /**
     * Set both scale key and octave count at once.
     * Used when switching the scale key in app.js.
     */
    PianoRollEditor.prototype.setScaleKey = function (keyName, octave, numOctaves) {
        this.octave = octave;
        this.numOctaves = numOctaves;
        this.scale = buildMultiOctaveScale(keyName, octave, numOctaves);
        const rollOctaveValue = document.getElementById('roll-octave-value');
        if (rollOctaveValue) rollOctaveValue.textContent = octave;
        const rollOctavesValue = document.getElementById('roll-octaves-value');
        if (rollOctavesValue) rollOctavesValue.textContent = numOctaves;
        this._calculateDimensions();
        this._drawAll();
    };

    PianoRollEditor.prototype.setBPM = function (bpm) {
        this.bpm = bpm;
    };

    PianoRollEditor.prototype.setOctave = function (octave) {
        this.octave = octave;
        const rollOctaveValue = document.getElementById('roll-octave-value');
        if (rollOctaveValue) rollOctaveValue.textContent = octave;
    };

    PianoRollEditor.prototype._shiftOctave = function (delta) {
        let newOctave = this.octave + delta;
        if (newOctave < 1 || newOctave > 6) return;

        this.octave = newOctave;
        const rollOctaveValue = document.getElementById('roll-octave-value');
        if (rollOctaveValue) rollOctaveValue.textContent = newOctave;

        // Transpose all notes by the octave delta
        var MIDI_OCTAVE_SHIFT = 12;
        for (let i = 0; i < this.notes.length; i++) {
            this.notes[i].midi += delta * MIDI_OCTAVE_SHIFT;
        }

        // Rebuild multi-octave scale
        const app = window.pitchPerfectApp;
        if (app) {
            this.scale = buildMultiOctaveScale(app.key || 'C', this.octave, this.numOctaves);
        }

        this._calculateDimensions();
        this._drawAll();
    };

    /**
     * Set the number of octaves displayed in the piano roll.
     * Rebuilds the scale and redraws.
     */
    PianoRollEditor.prototype.setNumOctaves = function (n) {
        n = Math.max(1, Math.min(3, Math.round(n)));
        if (n === this.numOctaves) return;
        this.numOctaves = n;
        const app = window.pitchPerfectApp;
        if (app) {
            this.scale = buildMultiOctaveScale(app.key || 'C', this.octave, this.numOctaves, this.mode);
        }
        this._calculateDimensions();
        this._drawAll();
    };

    /**
     * Set the scale mode (major, minor, etc.)
     * Rebuilds the scale and redraws.
     */
    PianoRollEditor.prototype.setMode = function (mode) {
        if (mode === this.mode) return;
        this.mode = mode;
        const app = window.pitchPerfectApp;
        if (app) {
            this.scale = buildMultiOctaveScale(app.key || 'C', this.octave, this.numOctaves, this.mode);
        }
        this._calculateDimensions();
        this._drawAll();
    };

    /**
     * Set the instrument for audio playback.
     * Passes through to the audio engine.
     */
    PianoRollEditor.prototype.setInstrument = function (type) {
        if (window.pianoRollAudioEngine) {
            window.pianoRollAudioEngine.setInstrument(type);
        }
    };

    PianoRollEditor.prototype.destroy = function () {
        if (this._playAnimationId) {
            cancelAnimationFrame(this._playAnimationId);
        }
    };

})();
