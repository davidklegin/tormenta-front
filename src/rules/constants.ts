import type { AttributeKey, NoteCategory } from '@/api/types';

/** Rótulos dos atributos (livro base, p. 17). */
export const ATTRIBUTE_LABELS: Record<AttributeKey, { full: string; short: string }> = {
  for: { full: 'Força', short: 'For' },
  des: { full: 'Destreza', short: 'Des' },
  con: { full: 'Constituição', short: 'Con' },
  int: { full: 'Inteligência', short: 'Int' },
  sab: { full: 'Sabedoria', short: 'Sab' },
  car: { full: 'Carisma', short: 'Car' },
};

export const ATTRIBUTE_ORDER: AttributeKey[] = ['for', 'des', 'con', 'int', 'sab', 'car'];

/**
 * Abas da ficha (briefing §10 a §15).
 *
 * `hint` é o que a aba faz em uma linha — aparece na primeira vez que o
 * jogador abre a ficha, para quem nunca mexeu numa ficha de RPG saber o que
 * esperar de cada uma.
 */
export const SHEET_TABS = [
  { key: 'index', label: 'Combate', icon: 'resumo', hint: 'Vida, mana, condições e ataques' },
  { key: 'pericias', label: 'Perícias', icon: 'pericias', hint: 'O que seu personagem sabe fazer' },
  { key: 'equipamento', label: 'Mochila', icon: 'equipamento', hint: 'Itens, armas e dinheiro' },
  { key: 'poderes', label: 'Poderes', icon: 'poderes', hint: 'Talentos de classe, raça e origem' },
  { key: 'magias', label: 'Magias', icon: 'magias', hint: 'Suas magias, por círculo' },
  { key: 'habilidades', label: 'Habilidades', icon: 'habilidades', hint: 'O que a classe deu a cada nível' },
  { key: 'background', label: 'História', icon: 'historia', hint: 'Quem é o seu personagem' },
  { key: 'anotacoes', label: 'Anotações', icon: 'anotacoes', hint: 'Suas notas particulares' },
] as const;

export const NOTE_CATEGORY_LABELS: Record<NoteCategory, string> = {
  npcs: 'NPCs',
  lugares: 'Lugares',
  missoes: 'Missões',
  pistas: 'Pistas',
  itens: 'Itens',
  organizacoes: 'Organizações',
  sessoes: 'Sessões',
  outros: 'Outros',
};

/** Círculos de magia, do 1º ao 5º (p. 170). */
export const SPELL_CIRCLES = [1, 2, 3, 4, 5] as const;

/** Qualidade de descanso e o que cada uma recupera (p. 106). */
export const REST_QUALITIES = [
  { value: 'ruim', label: 'Ruim', description: 'Metade do nível — ao relento, sem acampamento' },
  { value: 'normal', label: 'Normal', description: 'Igual ao nível — estalagem comum' },
  { value: 'confortavel', label: 'Confortável', description: 'Dobro do nível' },
  { value: 'luxuosa', label: 'Luxuosa', description: 'Triplo do nível' },
] as const;

/** Ajustes rápidos de PV/PM no controle de sessão (briefing §19). */
export const QUICK_STEPS = [1, 5, 10] as const;

/**
 * Os grupos dos itens alquímicos e esotéricos da wiki.
 *
 * Ficam ao lado da categoria na tela de equipamento porque é o subtipo que
 * distingue um veneno de uma poção de cura — ambos são consumíveis, e a
 * categoria sozinha diria a mesma coisa dos dois.
 */
export const ITEM_SUBTYPE_LABELS: Record<string, string> = {
  preparado: 'Preparado',
  catalisador: 'Catalisador',
  veneno: 'Veneno',
  alquimia_mistica: 'Alquimia mística',
  esoterico: 'Esotérico',
  esoterico_especifico: 'Esotérico específico',
};
