# Delivery Milestones

## Milestone 1 — Greenwood vertical slice

Status: implemented.

- Static React/TypeScript foundation
- Greatsword combat and three skills
- Six-room short dungeon
- Loot, equipment, pack weight, retreat, death, extraction
- Browser save and JSON portability
- Formula and deterministic-combat tests

## Milestone 2 — System hardening

Status: implemented; balance tuning remains a later gameplay task.

- [x] Task 1: complete six-attribute effects, derived-stat panel, deterministic hit/dodge integration, combat mana regeneration, and Item Rarity weighting
- [x] Task 2: centralize strict v1 save validation, serialization, import errors, and the sequential migration framework
- [x] Task 3: JSON catalog schema, validated content loader, and starter-content migration
- [x] Task 4: deterministic dungeon simulator and 10,000-seed balance report
- [x] Task 5: keyboard controls and accessibility improvements
- [x] Task 6: typed game-event bus and opt-in audio adapter

Acceptance: 10,000 seeded dungeon simulations completed without invalid state; valid v1 saves validate and round-trip losslessly without a version change. The current v1 schema needs no migration.

## Milestone 3 — Level 20 MVP

- Sword & Shield, Greatsword, and Staff branches
- Skill allocation and free respec
- Combat automation with eight priority rules
- Greenwood and Goblin Warrens
- Six normal monsters, two elite archetypes, and two bosses
- Approximately 25 equipment bases and complete initial affix pool

Acceptance: each weapon branch can clear both regions; normal, elite, and boss fight times are within target ranges for median builds.

## Milestone 4 — Settlement economy

- Blacksmith enhancement through +5
- Affix rerolling where unlocked
- Market inventory and refresh
- Warehouse capacity
- First building upgrades and supplies
- Training Dummy and records

Acceptance: automated economy simulations reveal no infinite-gold or zero-cost optimization loops.

## Milestone 5 — Full normal progression

- Bow and Dagger branches
- Levels 1–100 and all seven regions
- Seven bosses, complete equipment slots, events, legendary powers
- Buildings through Level 10

Acceptance: fresh seeded characters can complete normal progression with multiple viable archetypes.

## Milestone 6 — Endgame and release

- Adventure Tiers II–V
- Endless Challenge Ranks
- Ascension and Legacy trees
- Full responsive polish, sound, onboarding, and settings
- Static-host deployment package

Acceptance: endgame remains numerically stable through Challenge Rank 100 and exports/imports retain full progress.
