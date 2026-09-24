# PROJECT 19X26 — Agent Instructions

## Required reading and workspace

The directory containing this file is the source repository root. Read `HANDOFF.md`, `ARCHITECTURE.md`, `GAME_RULES.md`, `DATA_MODEL.md`, `MILESTONES.md`, and `BALANCE_REPORT.md` before changing code. Before Milestone 3 work, also read `MILESTONE_3_SPEC.md` and do not invent decisions that it marks unresolved.

## Product direction

PROJECT 19X26 is a build-focused, client-side browser RPG. Its core reward is becoming overpowered through better builds, equipment, upgrades, and automation. Difficulty should test build quality more than reflexes.

The presentation is a retro pixel RPG. Keep the interface readable, responsive, and fast. Do not introduce a backend, account system, online economy, or paid service without explicit approval.

## Required checks

Before completing any implementation task:

1. Run `npm test`.
2. Run `npm run build`.
3. Run `npm run test:balance` when combat, loot, content, progression, or encounters change.
4. Add or update deterministic tests for changed formulas or combat rules.
5. Update `GAME_RULES.md` when an ambiguity is resolved.
6. Update `DATA_MODEL.md` and the save migrator when persisted state changes.

## Architecture rules

- Keep simulation rules in `src/game/`; React components must not own game formulas.
- Use seeded randomness for combat, encounters, and loot.
- Never save derived values such as Max HP, DPS, mitigation, or carry capacity.
- Store content as data when multiple instances will exist; do not hardcode large content sets into UI components.
- Autosave at stable boundaries, never every combat tick.
- Preserve old saves through explicit version migrations.
- Prefer pure functions and tests over implicit component behavior.
- Weapon factors are incorporated into generated weapon base damage exactly once.
- Avoid a universal gear-score recommendation. Show concrete stat differences.

## Scope discipline

Implement one milestone at a time. Do not build the Level 100 endgame before the Level 20 MVP has been played and tuned. New features should reinforce:

`LEVEL → BUILD → LOOT → ENHANCE → BOSS → TIER → CHALLENGE → ASCEND`
