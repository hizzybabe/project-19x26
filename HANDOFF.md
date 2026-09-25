# PROJECT 19X26 — Development handoff

## Start here

Treat the directory containing this file as the repository root. In the current recovered workspace it is:

`E:\work\webmaster\PROJECT-19X26-upload-ready\PROJECT-19X26-milestone-1`

The surrounding `PROJECT-19X26-upload-ready` directory is a deployment container holding this source tree and the original recovery ZIP. An older upload-ready static bundle that it once contained has been retired, so this source tree is now the only copy of the built game; produce the deployable bundle with `npm run build`. Do not create a replacement scaffold.

For an AI coding agent, set this directory as the working directory and give it this instruction:

> Read `AGENTS.md`, `HANDOFF.md`, `ARCHITECTURE.md`, `GAME_RULES.md`, `DATA_MODEL.md`, `MILESTONES.md`, `BALANCE_REPORT.md`, and `MILESTONE_3_SPEC.md` completely before changing code. Preserve the current architecture and v1 saves. Run the baseline tests and build before editing, then run them again before finishing. Do not invent unresolved Milestone 3 balance or product rules; surface them for owner approval.

## Current status

- Build/package version: `0.2.0`.
- Milestone 1 Greenwood vertical slice: complete.
- Milestone 2 system hardening: complete.
- Next milestone: Milestone 3, Level 20 MVP. Its confirmed scope and unresolved decisions are in `MILESTONE_3_SPEC.md`.
- Durable save version: `1`. Do not increment it unless the persisted shape changes.
- No backend or account system exists or is planned in the current roadmap.

## Reproducible setup

Use Node.js 22.12+; `.nvmrc` records the tested Node 24.19 runtime. Dependencies are exact-version pinned and locked.

```bash
npm ci
npm test
npm run build
npm run test:balance
```

Expected baseline at handoff:

- 7 test files, 56 tests passing.
- Production build succeeds and writes `dist/`.
- The balance test completes 10,000 deterministic seeded Greenwood runs without invalid runtime or save state, and prints the canonical 0.97% baseline at the 100 ms step in about three minutes.
- `rg "Math\.random" src/game` returns no engine usage.

The local machine used to recover the project had an older system Node. When necessary, tests were run with a compatible Node 24 executable. On another machine, selecting the `.nvmrc` version avoids this issue.

Because the ZIP was extracted by a sandbox account, Git on this Windows machine may initially report “dubious ownership.” After verifying this path is the intended repository, the machine owner can trust it once with:

```bash
git config --global --add safe.directory E:/work/webmaster/PROJECT-19X26-upload-ready/PROJECT-19X26-milestone-1
```

Alternatively, keep using `git -c safe.directory=<path> ...` per command. This is an environment ownership warning, not repository corruption.

## Sources of truth

- `AGENTS.md`: permanent implementation constraints and completion checks.
- `MILESTONES.md`: delivered and future scope.
- `GAME_RULES.md`: authoritative implemented formulas and gameplay behavior.
- `DATA_MODEL.md`: persisted v1 and runtime shapes.
- `ARCHITECTURE.md`: module ownership and state flow.
- `src/game/data/catalog.schema.json`: portable JSON content schema.
- `BALANCE_REPORT.md`: simulator assumptions and measured Milestone 2 baseline.
- Tests: executable proof of formulas, determinism, validation, and the 10,000-run invariant.

If prose conflicts with tests or code, stop and reconcile the discrepancy explicitly. Do not silently choose one.

## Architecture map

- `src/App.tsx`: React orchestration and UI only. Do not put authoritative formulas here.
- `src/game/rules.ts`: derived statistics and pure formulas.
- `src/game/combat.ts`: deterministic combat transitions.
- `src/game/loot.ts`: deterministic rarity and item generation.
- `src/game/expedition.ts`: pure expedition transitions and the shared defeat-loss rule; React must not reimplement these.
- `src/game/rng.ts`: the only random-number source for game outcomes.
- `src/game/content-loader.ts` and `src/game/data/`: validated content and stable IDs.
- `src/game/content.ts`: resolves JSON definitions into runtime starter items and enemies.
- `src/game/state.ts`: new games, leveling, expedition start, local save/load.
- `src/game/migrations.ts`: strict save validation, serialization, and future sequential migrations.
- `src/game/simulator.ts`: deterministic non-player test policy using production combat and loot.
- `src/game/events.ts`: transient typed events and optional audio output.

## Non-negotiable invariants

1. All combat, encounter, and loot outcomes use the stored seeded RNG. Never use `Math.random()` in `src/game`.
2. Weapon-category factors are incorporated into generated/starter `baseDamage` exactly once.
3. Derived values such as Max HP, mitigation, DPS, and capacity are never persisted.
4. React components do not own gameplay formulas.
5. Saves occur at stable boundaries, never every combat tick.
6. Any persisted-shape change requires a version increment, a pure sequential migrator, validation updates, documentation, and old-save fixtures/tests.
7. Stable content IDs are lowercase kebab-case and are relational keys; display names are not identifiers.
8. New repeated content belongs in validated JSON rather than large UI conditionals.
9. Do not add a universal gear score. Present concrete stat differences.
10. Audio and visual feedback must never affect simulation state or determinism.

## Save compatibility procedure

Version 1 is current and valid saves round-trip losslessly. The migration table is empty because no earlier documented format exists.

When a future feature changes durable state:

1. Preserve the existing v1 validator and define the new type/version.
2. Add one pure `v1 -> v2` migration in `migrations.ts`—never skip versions.
3. Make migration deterministic and idempotent at the pipeline boundary.
4. Add saved v1 fixtures and verify every known field survives or is deliberately transformed.
5. Keep derived/runtime-only fields out of JSON.
6. Update `DATA_MODEL.md`, `GAME_RULES.md` if behavior changes, and this handoff.

## Known limitations and warnings

- The unallocated Level 1 starter build clears only 0.99% of simulated Greenwood runs under the fixed simulator policy. This is documented, not silently tuned. Define target rates before balancing.
- The simulator policy is test infrastructure, not player-facing automation and not necessarily optimal.
- Enemies support Dodge but currently use zero. Arcane statistics are ready, but no current enemy deals Arcane damage and Staff gameplay is not implemented.
- Affix and legendary-power JSON collections are intentionally empty.
- The folder name still says `milestone-1` for historical reasons; package/build version and documentation correctly reflect completed Milestone 2.
- The balance report is measured at the canonical 100 ms step, which is the same step the UI advances at. The 10,000-seed suite therefore takes about three minutes instead of about twenty seconds. Historic 1,000 ms figures are retained for comparison in `GAME_RULES.md` and `BALANCE_REPORT.md`.
- Combat is still single-category. `rules.ts` applies the Greatsword factor of 1.25 as a fallback when a weapon has no stored `baseDamage`, and the attack interval constant is the Greatsword interval. Generalizing this is Milestone 3 decision group 1.
- Region entry text (`Enemies emerge from the Greenwood.`) is hardcoded in `combat.ts`, and the extraction message says `Greenwood cleared!` in `expedition.ts`. A second region needs the dungeon identity in content and, because the expedition record does not store it, in durable state — which means save version 2.
- The original full design specification beyond the repository documents was not present in the supplied archive. Do not claim undocumented future formulas are authoritative.

## Post-handoff hardening pass

A review-and-hardening pass was applied after the Milestone 2 handoff, before any Milestone 3 work. It changed no balance rule and no durable state.

- Enemy telegraphs are now content data. `monsters.json` gained a required `glyph` and an optional `telegraph` object (`name`, `windupMs`, `damageMultiplier`, `intervalMs`, `firstDelayMs`), replacing `firstTelegraphMs`. `combat.ts` no longer hardcodes the boss telegraph name, windup, interval, or multiplier.
- `App.tsx` renders `enemy.glyph` instead of branching on `enemy.name.includes('Wolf')`. Display-name conditionals are gone from the UI.
- All expedition transitions moved into `src/game/expedition.ts` as pure functions: `resolveRoomVictory`, `resolveRoomDefeat`, `resolveRoomEvent`, `continueExpedition`, `retreatExpedition`. React no longer owns reward, loss, event, advance, or extraction logic. `defeatLoss` is shared with the simulator, so the death-loss rule has one implementation. This also makes the transitions safe for React to invoke twice, which it does while detecting impure render logic in development.
- `equipItem` refuses an item swap whose source entry is missing instead of calling `splice(-1)`, which previously overwrote the last pack entry or destroyed the replaced equipment when the source was empty.
- The canonical combat step is pinned to 100 ms as `COMBAT_TICK_MS`, used by both the UI and the simulator default. `simulateDungeon`/`simulateBalance` accept `{ tickMs, maxFightMs }`. The measured step sensitivity is recorded in `GAME_RULES.md` and `BALANCE_REPORT.md`.
- Because the canonical step changed from the 1,000 ms the Milestone 2 report used, the recorded baseline moved from 99 to 97 clears per 10,000 (0.99% to 0.97%) and short-room mean times changed by 8–14%. No formula, coefficient, enemy, or loot table changed. Two independent 100 ms runs, one before and one after the expedition refactor, produced identical reports.

Milestone 3 remains blocked on the decision gate in `MILESTONE_3_SPEC.md` (eight open groups; the simulation-step group is resolved). Do not implement weapon branches, skills, automation, Goblin Warrens, affixes, or save version 2 before those decisions are approved.

## Before accepting a change

- Confirm the request belongs to the active milestone.
- Read relevant content definitions and engine modules before editing UI.
- Add deterministic tests for formulas, RNG order, migrations, and simulations.
- Run `npm test` and `npm run build`.
- Run `npm run test:balance` for combat, content, loot, progression, or encounter changes.
- Search `src/game` for `Math.random`.
- Update rules, data model, architecture, milestone, balance, and handoff documents as applicable.

## Repository history

The source was supplied as `PROJECT-19X26-milestone-1.zip` without Git metadata. A new local Git history may therefore begin at the completed Milestone 2 handoff; it cannot reconstruct earlier authorship or commits. Keep the original ZIP outside the source directory as the recovery artifact.
