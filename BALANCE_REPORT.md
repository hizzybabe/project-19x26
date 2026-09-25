# Greenwood balance baseline

The deterministic simulator ran 10,000 consecutive seeds (`1` through `10000`) against the actual combat, content, and loot modules, at the canonical 100 ms combat step (`COMBAT_TICK_MS`). Every run terminated within the 180-second per-fight guard, and every final v1 state passed save validation. Re-running with the same seed reproduces the same result.

| Metric | Result |
|---|---:|
| Dungeon clears | 97 / 10,000 (0.97%) |
| Defeats | 9,903 / 10,000 |
| Mean fight time, first normal room | 2.55 s |
| Mean fight time, wolf room | 3.43 s |
| Mean fight time, elite room | 15.06 s |
| Mean fight time, boss room | 65.93 s |
| Mean retained gold | 15.77 |
| Mean retained items | 0.93 |

The simulator uses an unallocated Level 1 starter character and no equipment changes. Its fixed test policy drinks a potion below 50% HP, braces telegraphs, and casts Cleave for multiple enemies or Heavy Strike for a single enemy when ready. It chooses the fountain heal and shrine damage blessing. It drops excess loot to obey carry capacity. The policy is a test harness, not player-facing automation or an optimal build. Mean fight times average across all runs, counting zero for rooms not reached, so they are not conditional fight durations.

The 0.97% clear rate is a tuning warning, not an invalid-state failure. It should inform the Level 20 MVP balance pass; the hardening work to date does not alter enemy strength, skill coefficients, or progression. Run `npm test -- --reporter=verbose` to reproduce the report printed by the 10,000-seed test.

## Simulation-step sensitivity

The step is a measurement parameter, not a balance rule, but it moves short-fight results. The same 10,000 seeds were measured at a 1,000 ms step (`simulateBalance(10_000, 1, { tickMs: 1000 })`) before the canonical step was pinned to 100 ms:

| Step | Clears (of 10,000) | First room | Wolf room | Elite room | Boss room | Mean gold | Mean items |
|---|---:|---:|---:|---:|---:|---:|---:|
| 100 ms (canonical) | 97 | 2.55 s | 3.43 s | 15.06 s | 65.93 s | 15.77 | 0.93 |
| 1,000 ms | 99 | 2.96 s | 3.78 s | 15.33 s | 66.33 s | 15.78 | 0.92 |

Conclusions:

- Aggregate clear rate is step-insensitive within sampling noise (2 seeds per 10,000). The Milestone 2 figure described what a player experiences, not only an artifact of the test step, so pinning the canonical step to the UI's step did not invalidate the earlier measurement.
- Mean durations for the two short rooms move by roughly 8–14% between steps, because a step can apply at most one attack per combatant and short fights are dominated by that quantization. Elite and boss fights, which last many attack cycles, move by under 3%.
- Milestone 3 accepts numeric fight-time bands for normal, elite, and boss fights. Those bands must state the step they were measured at, or the same build can pass at one step and fail at another.
- The 10,000-seed suite now takes about three minutes instead of about twenty seconds, because ten times as many steps are simulated. That cost is accepted in exchange for one canonical number that matches the UI.

## History

The Milestone 2 baseline (99 clears, 0.99%, first room 2.96 s, boss room 66.33 s) was measured at a 1,000 ms step. It is retained above for comparison only. The current build's canonical figure is the 100 ms row.
