---
name: ultra-review
description: Conducts a rigorous, multi-layered "ultra review" of a PR or codebase using adversarial subagents, EARS requirement verification, and persona-driven audits.
---

# Ultra Review: Advanced AI Code Review Tactics

This skill defines the standard procedure for reviewing code in this repository. AI agents must follow this multi-layered approach to ensure reviews are high-signal, objective, and tied to business requirements.

## When to use this skill
Use this skill whenever the user asks to "review this PR", "review my code", or "run an ultra review".

## The 5-Step Ultra Review Process

### 1. Layered Verification (Automate the Yes)
Before beginning the semantic review, ensure the basic deterministic gates pass.
- Run `pnpm pr:prepare` and `pnpm typecheck` (or the specific typecheck for the affected package as per `AGENTS.md`).
- If these checks fail, **stop the review** and report the failures. Do not waste tokens reviewing code that doesn't compile.

### 2. EARS Verification Loop
If the PR implements a specific feature documented in `docs/specs/*.ears.md`:
- Read the corresponding EARS file.
- For every EARS requirement (Event, Action, Result, State), find the exact lines of code or test assertions in the PR that satisfy it.
- **Rule:** If you cannot prove a requirement is met by pointing to specific code, flag it as a 🟡 Major miss.

### 3. The Persona Panel (Multi-Perspective Audit)
Do not do a "general" review. Instead, analyze the diff from three distinct adversarial perspectives:
- **Security Engineer:** Look strictly for auth bypasses, injection vectors, data leaks, and insecure defaults.
- **Database/Performance Architect:** Focus strictly on N+1 queries, missing indexes, render cycles (SolidJS synchronous signal reads), and heavy synchronous operations.
- **QA Engineer:** Look strictly for missed edge cases, race conditions, and unhandled promise rejections.

### 4. Separation of Concerns (Adversarial Subagent)
- **Never self-review.** If you (the current agent context) wrote the code, you have blind spots.
- You must use `invoke_subagent` (using the `research` or a custom role) to pass the diff and requirements to a fresh agent.
- Instruct the subagent to act as an adversarial critic using the Persona Panel and EARS Verification rules above.

### 5. Mandatory Severity Categorization & Blast Radius
Filter the noise before presenting the final report to the user. All findings must be categorized:
- 🔴 **Critical:** Production blocker, security vulnerability, data loss.
- 🟡 **Major:** Functional bug, severe performance degradation, EARS requirement miss.
- 🟢 **Minor:** Readability, naming, style (ideally suppressed if linters pass).

**Output Rule:** Only present 🔴 Critical and 🟡 Major issues to the user in your final review report. Do not surface 🟢 Minor style nits.

## Execution Guide for Agents
1. Pull the diff for the requested PR/branch.
2. Verify deterministic checks (Step 1).
3. Identify applicable EARS specs (Step 2).
4. Spawn an adversarial subagent (Step 4) providing it the diff, the EARS specs, and instructing it to run the Persona Panel (Step 3) and output findings with Severity Labels (Step 5).
5. Compile the subagent's findings into a structured markdown report and present it to the user.
