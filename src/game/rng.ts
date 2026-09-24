export function nextRandom(seed: number): [number, number] {
  let value = seed | 0
  value ^= value << 13
  value ^= value >>> 17
  value ^= value << 5
  const nextSeed = value >>> 0 || 0x6d2b79f5
  return [nextSeed / 4294967296, nextSeed]
}

export function randomInt(seed: number, min: number, max: number): [number, number] {
  const [roll, nextSeed] = nextRandom(seed)
  return [Math.floor(roll * (max - min + 1)) + min, nextSeed]
}
