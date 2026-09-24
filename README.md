# PROJECT 19X26

A lean, client-side retro pixel browser RPG built around buildcraft, automated basic combat, loot, and long-term progression.

This repository contains **Milestone 1: the Greenwood vertical slice** and **Milestone 2: system hardening**.

## Play locally

Requirements: Node.js 22.12 or newer. Node 24 is the recommended local runtime.

```bash
npm ci
npm run dev
```

Open the local URL printed by Vite.

## Verify and build

```bash
npm test
npm run build
npm run test:balance
```

The production-ready static site is written to `dist/`. Upload the contents of that directory to any ordinary static host, including DirectAdmin hosting.

This source repository is the `PROJECT-19X26-milestone-1` directory, even though its historical folder name predates Milestone 2. Open that directory—not the surrounding upload-ready folder—as the workspace in an IDE or local coding agent. Read `HANDOFF.md` before beginning new development.

## Included gameplay

- Level 1 character with spendable attribute points
- Six meaningful attributes with current/next-point explanations
- Detailed derived HP, mana, mitigation, attack, accuracy, Dodge, critical, regeneration, rarity, capacity, and Arcane statistics
- Real-time automatic Greatsword basic attacks
- Seeded player hit/crit rolls and enemy hit/Dodge rolls with clear miss logs
- Simulation-time mana regeneration
- Heavy Strike, Cleave, Execute, Potion, and contextual Brace actions
- Fixed six-room Greenwood dungeon
- Normal, minion, elite, and boss enemies
- Boss telegraph and brace interaction
- Seeded combat and loot randomness
- Common through Legendary equipment
- LUK-based, normalized Item Rarity weighting for normal, elite, and boss drops
- Equip, compare, discard, extract, retreat, sell, and death-loss flows
- Browser autosave and JSON export/import
- Shared strict save validation with field-specific import errors and a sequential migration boundary
- Unchanged v1 save compatibility; derived statistics remain runtime-only
- Validated JSON content catalog with starter items, monsters, skills, rooms, and events
- Deterministic 10,000-seed dungeon simulation and [balance report](BALANCE_REPORT.md)
- Keyboard shortcuts 1–5 in combat, labeled progress bars, visible focus, reduced-motion support, and an opt-in sound toggle
- Responsive retro pixel-RPG interface

## Scope boundary

This build intentionally proves the complete loop before adding breadth. Sword & Shield, Staff, skill trees, automation rules, crafting, settlement upgrades, and Levels 2–20 content belong to later milestones described in `MILESTONES.md`.

## Source of truth

- `GAME_RULES.md` — implemented rule decisions and ambiguity resolutions
- `DATA_MODEL.md` — runtime and save shapes
- `ARCHITECTURE.md` — code boundaries and extension rules
- `AGENTS.md` — instructions for future Codex work
- `HANDOFF.md` — current state, verification commands, invariants, known issues, and AI-agent startup instructions
- `MILESTONE_3_SPEC.md` — confirmed scope and unresolved product decisions for the next milestone
