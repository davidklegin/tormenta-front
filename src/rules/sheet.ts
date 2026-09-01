import type { AttributeKey, Character, CharacterItem, ReferenceOrigin } from '@/api/types';
import { ITEM_SUBTYPE_LABELS } from './constants';
import { halfLevel, trainingBonus } from './progression';

/**
 * Cálculos da ficha replicados no cliente para dar resposta imediata.
 *
 * Espelham os Services em app/Services/Rules do backend. Toda escrita continua
 * sendo validada e recalculada no servidor.
 */

export const DEFENSE_BASE = 10;

type DefenseItem = Pick<CharacterItem, 'category' | 'equipped' | 'defense_bonus' | 'armor_weight'>;

/** Armadura pesada equipada — é ela que anula o atributo na Defesa (p. 152). */
export function wearsHeavyArmor(
  items: Pick<CharacterItem, 'category' | 'equipped' | 'armor_weight'>[]
): boolean {
  return items.some(
    (item) => item.equipped && item.category === 'armadura' && item.armor_weight === 'pesada'
  );
}

/**
 * Defesa = 10 + atributo + armadura + escudo (livro base, p. 106).
 *
 * O atributo aplicado é o escolhido na ficha; Destreza é o padrão do livro.
 * `blockedByHeavyArmor` avisa que a armadura pesada zerou essa parcela, para a
 * tela conseguir explicar o número em vez de só mostrá-lo.
 */
export function previewDefense(params: {
  attributeValue: number;
  items: DefenseItem[];
  otherBonus?: number;
}): { total: number; attributePart: number; fromItems: number; blockedByHeavyArmor: boolean } {
  const { attributeValue: value, items, otherBonus = 0 } = params;
  const equipped = items.filter((item) => item.equipped);

  // Armadura pesada anula o atributo na Defesa (p. 152), seja ele qual for —
  // as habilidades que trocam o atributo repetem a restrição. Mesma leitura do
  // DefenseCalculator no servidor.
  const blockedByHeavyArmor = wearsHeavyArmor(equipped);
  const attributePart = blockedByHeavyArmor ? 0 : value;

  const fromItems = equipped
    .filter((item) => item.category === 'armadura' || item.category === 'escudo')
    .reduce((total, item) => total + (item.defense_bonus ?? 0), 0);

  return {
    total: DEFENSE_BASE + attributePart + fromItems + otherBonus,
    attributePart,
    fromItems,
    blockedByHeavyArmor,
  };
}

/**
 * Valor de perícia = ½ nível + atributo + treinamento + outros − penalidade
 * de armadura (p. 114).
 */
export function previewSkillValue(params: {
  level: number;
  attributeValue: number;
  trained: boolean;
  otherBonus?: number;
  armorPenalty?: number;
  appliesArmorPenalty?: boolean;
}): number {
  const {
    level,
    attributeValue,
    trained,
    otherBonus = 0,
    armorPenalty = 0,
    appliesArmorPenalty = false,
  } = params;

  return (
    halfLevel(level) +
    attributeValue +
    (trained ? trainingBonus(level) : 0) +
    otherBonus +
    (appliesArmorPenalty ? armorPenalty : 0)
  );
}

/** Limite de carga = 10 + 2 por ponto de Força (−1 se negativa) — p. 141. */
export function previewCarryLimit(strength: number): number {
  return 10 + (strength >= 0 ? strength * 2 : strength);
}

/** Espaços ocupados; mil moedas ocupam 1 espaço (p. 141). */
export function previewCarryUsed(items: Pick<CharacterItem, 'slots' | 'quantity'>[], moneyTibar = 0): number {
  const fromItems = items.reduce((total, item) => total + item.slots * Math.max(1, item.quantity), 0);

  return Math.round((fromItems + Math.floor(moneyTibar / 1000)) * 10) / 10;
}

/** CD para resistir às magias do personagem: 10 + ½ nível + atributo (p. 170). */
export function previewSpellDc(level: number, attributeValue: number): number {
  return 10 + halfLevel(level) + attributeValue;
}

/** Custo em PM por círculo — Tabela 4-1 (p. 170). */
export const SPELL_CIRCLE_COST: Record<number, number> = { 1: 1, 2: 3, 3: 6, 4: 10, 5: 15 };

/**
 * Limiar de morte: –10 ou metade negativa dos PV totais, o que for mais baixo
 * (p. 236).
 */
export function deathThreshold(maxHp: number): number {
  return Math.min(-10, -Math.floor(maxHp / 2));
}

/** Faixa de urgência usada no destaque visual (briefing §7). */
export function severityFor(current: number, max: number): 'ok' | 'warning' | 'critical' | 'down' {
  if (current <= 0) return 'down';
  if (max <= 0) return 'ok';

  const ratio = current / max;
  if (ratio <= 0.25) return 'critical';
  if (ratio <= 0.5) return 'warning';

  return 'ok';
}

/** Busca um atributo da ficha pelo código. */
export function attributeValue(character: Character, key: AttributeKey): number {
  return character.attributes.find((attribute) => attribute.key === key)?.total ?? 0;
}

/** Formata modificadores com sinal, como a ficha faz: +4, −1, +0. */
export function signed(value: number): string {
  if (value > 0) return `+${value}`;
  if (value < 0) return `−${Math.abs(value)}`;

  return '+0';
}

/** Formata valores em T$ no padrão brasileiro. */
export function formatTibar(value: number): string {
  return `T$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

/** Espaços de carga: mostra "0,5" em vez de "0.5". */
export function formatSlots(value: number): string {
  return value.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
}

/**
 * A linha embaixo do nome da origem no seletor.
 *
 * As origens do livro base oferecem uma lista de perícias e poderes da qual o
 * jogador escolhe dois, e a lista já resume a origem. As regionais (Atlas de
 * Arton) não têm lista: o benefício é fixo e só o texto o descreve — sem ele a
 * tela mostraria um nome solto.
 */
export function describeOrigin(origin: ReferenceOrigin): string | undefined {
  if (origin.skills?.length) return origin.skills.join(', ');

  return origin.description ?? undefined;
}

/**
 * A linha embaixo do nome do item no catálogo do livro.
 *
 * Alquímicos e esotéricos chegam aos montes e com homônimos entre publicações
 * — dois "tomo do rancor", dois "ostensório santificado" —, então o grupo e o
 * livro entram junto com o tamanho: sem eles, duas linhas iguais na lista
 * deixam a escolha no chute.
 */
export function describeCatalogItem(item: {
  category: string;
  subtype?: string | null;
  source?: string | null;
  slots: number;
}): string {
  const grupo = item.subtype ? (ITEM_SUBTYPE_LABELS[item.subtype] ?? item.subtype) : item.category;

  return [grupo, item.source, `${formatSlots(item.slots)} espaço(s)`].filter(Boolean).join(' · ');
}
