/**
 * Progressão de nível — Tabela 1-4 (livro base, p. 35).
 *
 * Espelho da classe App\Services\Rules\ProgressionRules do backend. O servidor
 * continua sendo a fonte de verdade: isto existe para a interface responder na
 * hora, sem esperar a rede. Se as duas divergirem, o backend vence.
 */

export const MAX_LEVEL = 20;

export const XP_TABLE: Record<number, number> = {
  1: 0,
  2: 1_000,
  3: 3_000,
  4: 6_000,
  5: 10_000,
  6: 15_000,
  7: 21_000,
  8: 28_000,
  9: 36_000,
  10: 45_000,
  11: 55_000,
  12: 66_000,
  13: 78_000,
  14: 91_000,
  15: 105_000,
  16: 120_000,
  17: 136_000,
  18: 153_000,
  19: 171_000,
  20: 190_000,
};

/** Metade do nível, arredondada para baixo (p. 114). */
export function halfLevel(level: number): number {
  return Math.floor(Math.max(1, level) / 2);
}

/** +2 do 1º ao 6º, +4 do 7º ao 14º, +6 do 15º em diante (p. 114). */
export function trainingBonus(level: number): number {
  if (level >= 15) return 6;
  if (level >= 7) return 4;

  return 2;
}

export function levelForXp(xp: number): number {
  let level = 1;
  for (let i = 1; i <= MAX_LEVEL; i++) {
    if (xp >= (XP_TABLE[i] ?? 0)) level = i;
  }

  return level;
}

export function xpToNextLevel(level: number, currentXp: number): number | null {
  if (level >= MAX_LEVEL) return null;

  return Math.max(0, (XP_TABLE[level + 1] ?? 0) - currentXp);
}

/** Progresso 0..1 dentro do nível atual, para a barra de XP. */
export function levelProgress(level: number, currentXp: number): number {
  if (level >= MAX_LEVEL) return 1;

  const start = XP_TABLE[level] ?? 0;
  const end = XP_TABLE[level + 1] ?? start + 1;
  if (end <= start) return 1;

  return Math.max(0, Math.min(1, (currentXp - start) / (end - start)));
}

/** Patamares de jogo (p. 35). */
export function tier(level: number): string {
  if (level >= 17) return 'Lenda';
  if (level >= 11) return 'Campeão';
  if (level >= 5) return 'Veterano';

  return 'Iniciante';
}
