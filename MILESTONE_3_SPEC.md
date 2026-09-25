# Milestone 3 — Level 20 MVP specification gate

This document distinguishes confirmed roadmap scope from product decisions that are not present in the supplied design files. Future developers and AI agents must not invent unresolved rules and present them as authoritative. Resolve each decision with the project owner, record it in `GAME_RULES.md`, and add deterministic tests before implementation.

## Confirmed scope

- Level 20 MVP rather than Level 100 breadth.
- Sword & Shield, Greatsword, and Staff weapon branches.
- Skill allocation and free respec.
- Combat automation with eight priority rules.
- Greenwood and Goblin Warrens regions.
- Six normal monsters, two elite archetypes, and two bosses across the MVP.
- Approximately 25 equipment bases and a complete initial affix pool.
- Each branch must clear both regions.
- Normal, elite, and boss time-to-kill must remain within explicitly approved target ranges for median builds.
- Existing principles remain: client-only, build-focused, deterministic, data-driven, accessible, and versioned-save compatible.

## Decisions required before implementation

### 1. Weapon identities and formulas

For Sword & Shield, Greatsword, and Staff, approve:

- category base-damage factor and base attack interval;
- primary/secondary attribute scaling;
- physical versus Arcane damage type;
- block, defense, resource, or other branch-specific mechanics;
- basic-attack targeting behavior;
- intended strengths, weaknesses, and median damage/survival targets.

Greatsword currently uses stored base damage with its category factor already applied, STR scaling, and a 2.15-second base interval. Any generalized weapon model must preserve old v1 Greatsword instances correctly.

### 2. Skill system

Approve:

- number of active/passive skills per branch;
- unlock levels, point costs, prerequisites, and maximum ranks;
- exact coefficients, cooldowns, mana costs, targeting, damage types, and status effects;
- whether current Heavy Strike, Cleave, Execute, Brace, and Potion become allocated skills or baseline actions;
- free-respec location and whether respec is allowed during expeditions.

Persisted allocation will almost certainly require save version 2. Define the v1 default allocation deliberately rather than inferring it from UI state.

### 3. Automation rules

Define exactly eight rule types, their conditions, targets, ordering, tie-breaking, invalid-action fallback, and whether they execute on the existing simulation tick. Specify what is persisted and how manual input interacts with automation.

The Milestone 2 simulator’s fixed policy is test-only and must not be reused as the player automation feature without an approved design.

### 4. Goblin Warrens and encounter roster

Approve:

- dungeon room sequence and event/shrine choices;
- six normal monster identities and which region owns each;
- two elite archetypes and two bosses;
- levels, class multipliers or overrides, Dodge, damage types, attack intervals, telegraphs, rewards, and unique mechanics;
- whether Greenwood’s current four combat identities count toward the totals.

Add all approved definitions to JSON and validate cross-references. Avoid enemy behavior conditionals based on display names.

### 5. Equipment and affixes

Approve:

- final MVP equipment slots and carry weights;
- approximately 25 base items by slot, branch, level range, and drop source;
- affix families, tiers, item-level gates, ranges, weights, exclusions, and maximum affix counts by rarity;
- whether generated items store rolled affixes directly or stable affix IDs plus values;
- comparison presentation without a universal gear score.

Expanding slots or storing affixes changes durable state and therefore requires a designed v1-to-v2 migration.

### 6. Level 1–20 progression

The XP formula, four attribute points, and one skill point per level already exist. Approve:

- content level ranges and expected number of dungeon clears per level;
- whether enemies scale to player level or use fixed/limited ranges;
- level gates for regions, skills, item bases, and affix tiers;
- death, retreat, recovery, and reward tuning through Level 20;
- expected builds at Level 1, 10, and 20.

### 7. Balance acceptance targets

Before tuning, define numeric targets for:

- fresh and median-build dungeon clear rates;
- normal, elite, and boss fight-time bands;
- potion consumption and death rates;
- mana uptime by branch;
- item rarity and upgrade cadence;
- branch performance tolerance across both regions.

The Milestone 2 baseline is 0.99% clears for an unallocated starter build under the documented test policy. This is a warning and baseline, not a target.

### 8. Save version 2

List every new persisted decision: weapon/equipment slots, skill allocation, automation configuration, affix instances, unlocked content, and any new records. Then design the complete `GameStateV2` and explicit v1 defaults before writing its migrator.

### 9. Simulation step and measurement basis — resolved

Resolved by the owner after the Milestone 2 handoff, before any Milestone 3 implementation:

- The canonical step is **100 ms**, defined once as `COMBAT_TICK_MS` in `src/game/rules.ts`. The UI advances by it and `simulator.ts` defaults to it, so one number is shared by gameplay and measurement.
- `simulateDungeon`/`simulateBalance` still accept `{ tickMs, maxFightMs }` so any historical or alternative step can be reproduced, because the step visibly moves short-fight durations (8–14% on the two normal rooms).
- Every accepted target in group 7 must state the step it was measured at.
- The telegraphed-attack windup loses one step (see `GAME_RULES.md`). The owner chose to keep that as implemented and documented behavior instead of correcting it, because correcting it is a balance change. It is closed unless the balance pass reopens it.

## Recommended implementation order

1. Approve the eight open decision groups above (group 9 is resolved) and update `GAME_RULES.md`/`DATA_MODEL.md`.
2. Define v2 types, fixture saves, validator, and v1-to-v2 migration tests.
3. Extend JSON schemas and content loader for weapon categories, slots, skills, affixes, and enemy mechanics.
4. Generalize combat damage types and branch mechanics without duplicating formulas in React.
5. Implement skill allocation and free respec.
6. Implement automation as deterministic engine policy data.
7. Add Goblin Warrens and the complete MVP content catalog.
8. Extend the simulator to weapon/build matrices and both regions.
9. Tune only against approved acceptance targets.
10. Finish UI/accessibility, documentation, 10,000-seed matrices, and production build verification.

## Milestone 3 completion evidence

- Migration fixtures prove real v1 saves load losslessly into v2 defaults.
- Fixed seeds reproduce combat, automation, encounter, affix, and loot outcomes.
- Every branch clears Greenwood and Goblin Warrens in the approved build matrix.
- Aggregate simulations report target clear rates and time-to-kill bands by branch and encounter class.
- No invalid numeric/runtime/save states occur across the approved simulation count.
- `npm test`, `npm run build`, and the expanded balance suite pass.
- `rg "Math\\.random" src/game` returns no usages.
- Documentation contains no unresolved formula presented as implemented fact.
