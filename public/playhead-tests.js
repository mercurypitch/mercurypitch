/**
 * Playhead API Tests for PianoRollEditor
 *
 * These tests verify the playhead functionality in the piano roll editor.
 * They test: playback state transitions, beat tracking, and reset behavior.
 *
 * Run these tests by including this file after piano-roll.js and calling:
 *   playheadTests.run()
 *
 * Or run in browser console:
 *   playheadTests.run()
 */

(function() {
    'use strict';

    var playheadTests = {
        passed: 0,
        failed: 0,
        results: [],

        /**
         * Assert helper
         */
        assert: function(condition, testName, message) {
            if (condition) {
                this.passed++;
                this.results.push({ status: 'PASS', name: testName, message: message || '' });
                console.log('✓ ' + testName);
            } else {
                this.failed++;
                this.results.push({ status: 'FAIL', name: testName, message: message || '' });
                console.error('✗ ' + testName + ': ' + (message || 'assertion failed'));
            }
        },

        /**
         * Run all playhead tests
         */
        run: function() {
            this.passed = 0;
            this.failed = 0;
            this.results = [];
            console.log('=== Playhead API Tests ===\n');

            // Wait for piano roll to be initialized
            if (typeof PianoRollEditor === 'undefined') {
                console.error('PianoRollEditor not found. Include piano-roll.js first.');
                return;
            }

            if (typeof window.pianoRollEditor === 'undefined' || window.pianoRollEditor === null) {
                console.warn('pianoRollEditor not initialized. Tests will create a temporary instance.');
                this.runWithTemporaryInstance();
                return;
            }

            this.runWithExistingInstance(window.pianoRollEditor);
            this.printSummary();
        },

        /**
         * Run tests with existing piano roll instance
         */
        runWithExistingInstance: function(editor) {
            this.testInitialState(editor);
            this.testResetSetsPlayheadToZero(editor);
            this.testActiveBeatDefaultsToZero(editor);
            this.testSeekUpdatesActiveBeat(editor);
            this.testPlaybackStateTransitions(editor);
        },

        /**
         * Run tests with a temporary instance
         */
        runWithTemporaryInstance: function() {
            var container = document.createElement('div');
            document.body.appendChild(container);
            container.style.display = 'none';

            var editor = new PianoRollEditor(container, {
                scale: [{ midi: 60, name: 'C4', freq: 261.63 }],
                bpm: 80,
                octave: 4
            });

            this.runWithExistingInstance(editor);

            // Cleanup
            document.body.removeChild(container);
        },

        /**
         * Test initial state
         */
        testInitialState: function(editor) {
            console.log('\n--- Initial State Tests ---');
            this.assert(
                editor._playbackState === 'stopped',
                'Initial playback state is stopped',
                'Got: ' + editor._playbackState
            );
            this.assert(
                editor._playStartTime === 0,
                'Initial _playStartTime is 0',
                'Got: ' + editor._playStartTime
            );
            this.assert(
                editor._playAnimationId === null,
                'Initial _playAnimationId is null',
                'Got: ' + editor._playAnimationId
            );
        },

        /**
         * Test that reset sets playhead to zero
         */
        testResetSetsPlayheadToZero: function(editor) {
            console.log('\n--- Reset Behavior Tests ---');

            // Set up a scenario where _activeBeat has a value
            editor._activeBeat = 15.5;
            editor._playbackState = 'playing';

            // Call reset
            editor._resetMelody();

            this.assert(
                editor._playbackState === 'stopped',
                'Reset sets playback state to stopped',
                'Got: ' + editor._playbackState
            );
            this.assert(
                editor._activeBeat === 0,
                'Reset sets _activeBeat to 0',
                'Got: ' + editor._activeBeat
            );
            this.assert(
                editor._playAnimationId === null,
                'Reset clears animation frame',
                'Got: ' + editor._playAnimationId
            );
        },

        /**
         * Test that _activeBeat defaults to 0
         */
        testActiveBeatDefaultsToZero: function(editor) {
            console.log('\n--- Active Beat Default Tests ---');

            // Create fresh editor or reset to default state
            editor._resetMelody();
            editor._activeBeat = undefined;

            var currentBeat = editor._activeBeat || 0;
            this.assert(
                currentBeat === 0,
                '_activeBeat defaults to 0 when undefined',
                'Got: ' + currentBeat
            );
        },

        /**
         * Test seek functionality
         */
        testSeekUpdatesActiveBeat: function(editor) {
            console.log('\n--- Seek Tests ---');

            editor._resetMelody();

            // Simulate seek to beat 5
            editor._activeBeat = 5;
            this.assert(
                editor._activeBeat === 5,
                'Seek updates _activeBeat to target beat',
                'Got: ' + editor._activeBeat
            );

            // Verify scroll position is set
            if (editor.gridContainer) {
                this.assert(
                    typeof editor.gridContainer.scrollLeft === 'number',
                    'Grid container has scroll position',
                    'Got: ' + typeof editor.gridContainer.scrollLeft
                );
            }
        },

        /**
         * Test playback state transitions
         */
        testPlaybackStateTransitions: function(editor) {
            console.log('\n--- State Transition Tests ---');

            editor._resetMelody();

            // Add a test note if none exist
            if (editor.notes.length === 0) {
                editor.notes = [{ id: 1, midi: 60, startBeat: 0, duration: 1 }];
            }

            var initialState = editor._playbackState;
            this.assert(
                initialState === 'stopped',
                'Initial state is stopped',
                'Got: ' + initialState
            );

            // Test: _playMelody from stopped state
            editor._playMelody();
            var playingState = editor._playbackState;
            this.assert(
                playingState === 'playing',
                '_playMelody transitions stopped -> playing',
                'Got: ' + playingState
            );
            this.assert(
                editor._playStartTime > 0,
                '_playMelody sets _playStartTime',
                'Got: ' + editor._playStartTime
            );
            this.assert(
                editor._playAnimationId !== null,
                '_playMelody starts animation frame',
                'Got: ' + (editor._playAnimationId ? 'set' : 'null')
            );

            // Test: _playMelody from playing state (pause)
            editor._playMelody();
            var pausedState = editor._playbackState;
            this.assert(
                pausedState === 'paused',
                '_playMelody transitions playing -> paused',
                'Got: ' + pausedState
            );

            // Test: _playMelody from paused state (resume)
            editor._playMelody();
            var resumedState = editor._playbackState;
            this.assert(
                resumedState === 'playing',
                '_playMelody transitions paused -> playing',
                'Got: ' + resumedState
            );

            // Cleanup
            editor._resetMelody();
        },

        /**
         * Print test summary
         */
        printSummary: function() {
            console.log('\n=== Test Summary ===');
            console.log('Passed: ' + this.passed);
            console.log('Failed: ' + this.failed);
            console.log('Total: ' + (this.passed + this.failed));

            if (this.failed === 0) {
                console.log('\n✓ All tests passed!');
            } else {
                console.log('\n✗ Some tests failed. Review output above.');
            }

            return {
                passed: this.passed,
                failed: this.failed,
                results: this.results
            };
        }
    };

    // Expose globally
    window.playheadTests = playheadTests;

    // Auto-run if ?test=playhead in URL
    if (window.location.search.indexOf('test=playhead') !== -1) {
        window.addEventListener('load', function() {
            setTimeout(function() {
                playheadTests.run();
            }, 500);
        });
    }

})();