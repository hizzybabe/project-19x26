import { describe, expect, it } from 'vitest'
import { simulateBalance, simulateDungeon } from './simulator'
import { validateGameState } from './migrations'

describe('deterministic dungeon simulator', () => {
  it('repeats identical outcomes for the same seed and returns valid v1 state', () => {
    const first = simulateDungeon(19026)
    expect(first).toEqual(simulateDungeon(19026))
    expect(validateGameState(first.finalState)).toEqual(first.finalState)
  })

  it('runs 10,000 seeded dungeons without invalid state', () => {
    const report = simulateBalance(10_000, 1)
    expect(report.runs).toBe(10_000)
    expect(report.clears + report.defeats).toBe(10_000)
    expect(report.clearRate).toBeGreaterThanOrEqual(0)
    expect(report.clearRate).toBeLessThanOrEqual(1)
    expect(report.averageFightSeconds.every(Number.isFinite)).toBe(true)
    expect(report.averageGold).toBeGreaterThanOrEqual(0)
    expect(report.averageLoot).toBeGreaterThanOrEqual(0)
    console.info('Greenwood 10,000-seed balance report:', JSON.stringify(report))
  }, 900_000)
})
