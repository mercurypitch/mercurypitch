# EARS Specification Tests

This directory contains EARS (Requirements-Driven Development) specifications for all MercuryPitch frontend features, along with corresponding Playwright E2E tests.

## Structure

```
tests/ears/
├── README.md                          # This file
├── playback-modes.md                   # Playback modes (once, repeat, session)
├── melody-library.md                  # Melody CRUD, favorites, sessions
├── presets-library.md                 # Preset management
├── settings-panel.md                  # App settings and preferences
├── session-editor.md                  # Drag-and-drop session timeline
├── metronome.md                       # Metronome functionality
├── focus-mode.md                      # Focus mode behavior
├── recording.md                       # Recording to piano roll
└── walkthroughs.md                    # Guided tutorials
```

## Format

Each EARS specification follows this structure:

1. **PURPOSE** - What the feature does
2. **SCOPE** - What's covered and what's excluded
3. **DEFINITIONS** - Key terms and concepts
4. **BEHAVIOR REQUIREMENTS** - Detailed requirements in tabular format
   - Requirement ID (e.g., ML-CREATE-01)
   - Description of expected behavior
   - Priority (High/Medium/Low)
5. **SUCCESS CRITERIA** - How to verify correct implementation
6. **NON-FUNCTIONAL REQUIREMENTS** - Performance, usability, reliability
7. **ASSUMPTIONS** - Known limitations and assumptions
8. **CHANGE HISTORY** - Version tracking

## Test Coverage

Each EARS spec has a corresponding e2e test file:

| Specification | Test File | Status |
|---------------|-----------|--------|
| playback-modes.md | src/e2e/playback.spec.ts | ✅ Complete |
| melody-library.md | src/e2e/melody-library.spec.ts | ✅ Complete |
| presets-library.md | src/e2e/comprehensive.spec.ts | ✅ Partial |
| settings-panel.md | src/e2e/settings.spec.ts | ✅ Complete |
| session-editor.md | src/e2e/session-editor.spec.ts | ✅ Complete |
| metronome.md | src/e2e/metronome.spec.ts | ✅ Complete |
| focus-mode.md | src/e2e/focus-mode.spec.ts | ✅ Complete |
| recording.md | 📝 Documentation only | 🔄 Pending |
| walkthroughs.md | src/e2e/walkthrough.spec.ts | ✅ Complete |

## Adding New Specifications

1. Create a new `.md` file in this directory following the format above
2. Add requirement IDs and priorities systematically
3. Create corresponding e2e test in `src/e2e/`
4. Update this README table

## Running Tests

```bash
# Run all E2E tests
npm test e2e

# Run specific test file
npx playwright test src/e2e/playback.spec.ts

# Run tests matching a spec
npx playwright test -g "Playback"

# Run in headed mode
npx playwright test --headed
```

## Verification Checklist

When reviewing EARS specs:

- [ ] All requirements have unique IDs
- [ ] Priorities are correctly assigned (High/Medium/Low)
- [ ] Success criteria are testable
- [ ] Non-functional requirements include performance metrics
- [ ] Assumptions are clearly stated
- [ ] Change history is maintained

## Notes

- E2E tests should verify requirements, not implementation details
- Tests should be idempotent and independent
- Test names should reference requirement IDs where possible
- Tests should be runnable in CI/CD pipeline

## Related Documentation

- Design docs: `docs/`
- API docs: Generated from TypeScript types
- Component docs: Inline JSDoc in component files
