export function normalizeSeed(seed: number | string): number {
  if (typeof seed === 'number') {
    return seed >>> 0;
  }

  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function nextRandom(seed: number): { seed: number; value: number } {
  let nextSeed = (seed + 0x6d2b79f5) >>> 0;
  let value = nextSeed;
  value = Math.imul(value ^ (value >>> 15), value | 1);
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61);

  return {
    seed: nextSeed,
    value: ((value ^ (value >>> 14)) >>> 0) / 4294967296,
  };
}

export function randomInt(seed: number, maxExclusive: number): { seed: number; value: number } {
  if (maxExclusive <= 0) {
    return { seed, value: 0 };
  }

  const next = nextRandom(seed);
  return {
    seed: next.seed,
    value: Math.floor(next.value * maxExclusive),
  };
}

export function shuffle<T>(items: T[], seed: number): { items: T[]; seed: number } {
  const shuffled = [...items];
  let currentSeed = seed;

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const random = randomInt(currentSeed, index + 1);
    currentSeed = random.seed;
    [shuffled[index], shuffled[random.value]] = [shuffled[random.value], shuffled[index]];
  }

  return { items: shuffled, seed: currentSeed };
}
