# Data Model v1

## Durable save

```ts
GameState {
  version: 1
  character: Character
  equipment: { weapon: Item; armor: Item }
  inventory: Item[]
  gold: number
  enhancementStones: number
  expedition: Expedition | null
  records: Records
  message: string
}
```

Derived statistics are recalculated and are never persisted.

The save version remains `1` after Milestone 2 Task 1. Existing browser saves and exported v1 JSON therefore load without migration.

Milestone 2 Task 2 centralizes all save handling in `src/game/migrations.ts`. The v1 validator checks required and optional keys, primitive types, numeric ranges, content enums, item slot statistics, inventory identifiers, and active-expedition bounds. Unknown persisted fields—including derived statistics—are rejected. Valid v1 saves are reconstructed without changing their data or version.

There is no invented pre-v1 format. The sequential migration table is intentionally empty until a durable schema change requires version 2. Saves from a newer unsupported version are rejected instead of being guessed or partially loaded.

## Character

```ts
Character {
  name: string
  level: number
  xp: number              // progress within current level
  attributes: { str; dex; vit; int; wis; luk }
  unspentAttributePoints: number
  skillPoints: number
}
```

## Item

Every generated item has a unique `id`, one equipment `slot`, rarity, item level, weight, enhancement level, sale value, and optional slot-specific base statistic. Milestone 1 supports `weapon` and `armor`; later milestones expand armor into the final equipment slots.

Weapon `baseDamage` already includes its weapon-category factor. Damage calculation must not multiply the factor again.

## Expedition

An active expedition persists only at stable boundaries:

- current room and resolution state
- carried HP, mana, and potion charges
- earned-but-not-extracted gold
- dungeon backpack items
- RNG seed
- temporary blessing

Combat timers and enemy HP are not durable. Reloading restarts the room from the saved entry state.

## Runtime-only combat data

`DerivedStats` contains Max HP, Max Mana, Armor, same-level Physical mitigation, Arcane Resistance and mitigation, attack damage, attack-speed bonus and interval, Accuracy, Dodge, critical chance, mana regeneration, Item Rarity, carry capacity, and the future-facing Arcane damage multiplier. None are written to `GameState`.

`Enemy.dodge` is an optional runtime field. Newly created enemies explicitly use zero Dodge; combat also treats a missing value as zero so older runtime-shaped data remains safe. Combat state and enemies are not persisted.

## JSON content identifiers

Content IDs will use lowercase kebab-case and remain stable after release. A save stores item instances and content IDs, never display names as relational keys.

Validated content collections:

- `items.json`
- `affixes.json`
- `skills.json`
- `monsters.json`
- `dungeons.json`
- `events.json`
- `legendary-powers.json`

Milestone 2 now includes these seven JSON collections and a catalog schema. The loader resolves item bases, monster definitions, skill definitions, dungeon rooms, and events at startup. Affix and legendary-power collections are currently empty. Their definitions are content only; v1 saves still store item instances and the existing room-kind array, so no durable schema or save version changed.
