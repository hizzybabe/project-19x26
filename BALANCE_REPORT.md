# Greenwood balance baseline — Milestone 2

The deterministic simulator ran 10,000 consecutive seeds (`1` through `10000`) against the actual combat, content, and loot modules. Every run terminated within the 180-second per-fight guard, and every final v1 state passed save validation. Re-running with the same seed reproduces the same result.

| Metric | Result |
|---|---:|
| Dungeon clears | 99 / 10,000 (0.99%) |
| Defeats | 9,901 / 10,000 |
| Mean fight time, first normal room | 2.96 s |
| Mean fight time, wolf room | 3.78 s |
| Mean fight time, elite room | 15.33 s |
| Mean fight time, boss room | 66.33 s |
| Mean retained gold | 15.78 |
| Mean retained items | 0.92 |

The simulator uses an unallocated Level 1 starter character and no equipment changes. Its fixed test policy drinks a potion below 50% HP, braces telegraphs, and casts Cleave for multiple enemies or Heavy Strike for a single enemy when ready. It chooses the fountain heal and shrine damage blessing. It drops excess loot to obey carry capacity. The policy is a test harness, not player-facing automation or an optimal build. Mean fight times average across all runs, counting zero for rooms not reached, so they are not conditional fight durations.

The 0.99% clear rate is a tuning warning, not an invalid-state failure. It should inform the Level 20 MVP balance pass; this hardening task does not alter enemy strength, skill coefficients, or progression. Run `npm test -- --reporter=verbose` to reproduce the report printed by the 10,000-seed test.
