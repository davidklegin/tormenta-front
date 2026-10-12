import type { ItemEffect, ItemEffectScope, ItemEffectTarget } from '@/api/types';

/**
 * Os bônus de item em linguagem de mesa.
 *
 * O servidor guarda `{target: 'damage', dice: '1d6', damage_type: 'fogo',
 * scope: 'this'}`; o jogador precisa ler "+1d6 de fogo no dano deste item".
 * A mesma frase aparece na Forja, no inventário e no detalhe do item, então
 * ela mora aqui e não em cada tela.
 */

export const ITEM_EFFECT_TARGETS: { value: ItemEffectTarget; label: string; description: string }[] = [
  { value: 'attribute', label: 'Atributo', description: 'Força, Destreza… Muda tudo o que usa o atributo.' },
  { value: 'skill', label: 'Perícia', description: 'Inclui Fortitude, Reflexos, Vontade e Iniciativa.' },
  { value: 'defense', label: 'Defesa', description: 'Soma na Defesa da ficha.' },
  { value: 'hp', label: 'Pontos de Vida', description: 'Aumenta os PV máximos.' },
  { value: 'mp', label: 'Pontos de Mana', description: 'Aumenta os PM máximos.' },
  { value: 'displacement', label: 'Deslocamento', description: 'Em metros (3 m = 2 quadrados).' },
  { value: 'damage_reduction', label: 'Redução de dano', description: 'RD contra todo dano ou só alguns tipos.' },
  { value: 'attack', label: 'Teste de ataque', description: 'Bônus para acertar.' },
  { value: 'damage', label: 'Dano das armas', description: 'Número fixo e/ou dados extras.' },
  { value: 'spell_damage', label: 'Dano das magias', description: 'Mostrado na aba Magias.' },
  { value: 'spell_dc', label: 'CD das magias', description: 'Dificulta resistir às suas magias.' },
  { value: 'note', label: 'Outro efeito (texto)', description: 'Algo que não é número: visão no escuro, imunidade…' },
];

export const ITEM_EFFECT_SCOPES: { value: ItemEffectScope; label: string }[] = [
  { value: 'all', label: 'Todos os ataques' },
  { value: 'melee', label: 'Corpo a corpo' },
  { value: 'ranged', label: 'À distância' },
  { value: 'this', label: 'Só com este item' },
];

/** Os tipos de dano do livro (p. 230), como o servidor os aceita. */
export const ITEM_DAMAGE_TYPES = [
  'ácido',
  'corte',
  'eletricidade',
  'essência',
  'fogo',
  'frio',
  'impacto',
  'luz',
  'perfuração',
  'psíquico',
  'trevas',
];

const SCOPE_PHRASE: Record<ItemEffectScope, string> = {
  all: '',
  melee: ' corpo a corpo',
  ranged: ' à distância',
  this: ' com este item',
};

function sinal(value: number): string {
  return value >= 0 ? `+${value}` : `−${Math.abs(value)}`;
}

/** "+1d6+2", "−1"; vazio quando não há nada. */
export function formatEffectAmount(effect: Pick<ItemEffect, 'value' | 'dice'>): string {
  const partes: string[] = [];
  if (effect.dice) partes.push(`+${effect.dice}`);
  if (effect.value) partes.push(sinal(effect.value));
  return partes.join('');
}

/**
 * A frase de um bônus.
 *
 * `names` traduz as chaves de atributo e perícia para o nome do livro; sem
 * ele, a chave aparece crua, que ainda é melhor que nada.
 */
export function describeItemEffect(effect: ItemEffect, names: Record<string, string> = {}): string {
  if (effect.target === 'note') return effect.text ?? '';

  const quanto = formatEffectAmount(effect) || '+0';
  const alvos = (effect.keys ?? []).map((key) => names[key] ?? key).join(', ');
  const tipo = effect.damage_type ? ` de ${effect.damage_type}` : '';
  const escopo = SCOPE_PHRASE[effect.scope ?? 'all'];

  const frase = (() => {
    switch (effect.target) {
      case 'attribute':
        return `${quanto} em ${alvos}`;
      case 'skill':
        return `${quanto} em ${alvos}`;
      case 'defense':
        return `${quanto} na Defesa`;
      case 'hp':
        return `${quanto} PV máximos`;
      case 'mp':
        return `${quanto} PM máximos`;
      case 'displacement':
        return `${quanto} m de deslocamento`;
      case 'damage_reduction':
        return effect.types?.length
          ? `RD ${effect.value ?? 0} contra ${effect.types.join(', ')}`
          : `${quanto} de redução de dano`;
      case 'attack':
        return `${quanto} nos ataques${escopo}`;
      case 'damage':
        return `${quanto}${tipo} no dano${escopo}`;
      case 'spell_damage':
        return `${quanto}${tipo} no dano das magias`;
      case 'spell_dc':
        return `${quanto} na CD das magias`;
      default:
        return quanto;
    }
  })();

  return effect.text ? `${frase} (${effect.text})` : frase;
}

/** Nomes de atributo e perícia por chave, para `describeItemEffect`. */
export function effectKeyNames(reference?: {
  attributes: { value: string; label: string }[];
  skills: { key: string; name: string }[];
}): Record<string, string> {
  const names: Record<string, string> = {};
  for (const attribute of reference?.attributes ?? []) names[attribute.value] = attribute.label;
  for (const skill of reference?.skills ?? []) names[skill.key] = skill.name;
  return names;
}
