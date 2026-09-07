import type { BattleMapToken, CombatEntry } from '@/api/types';

/**
 * Acha a linha da iniciativa que corresponde a uma peça do tabuleiro.
 *
 * As duas listas são montadas em momentos diferentes — a peça entra no mapa
 * quando o mestre prepara a cena, a linha entra na ordem quando se rola
 * iniciativa — e nada as amarra no banco. O casamento é reconstruído aqui, e é
 * o que permite bater no goblin tocando o goblin.
 *
 * A ordem das tentativas importa. Ficha de jogador casa por id e pronto: é
 * única. NPC precisa do nome junto, porque três goblins saem da mesma peça do
 * acervo e casariam todos com a primeira linha — e o mestre aplicaria dano no
 * goblin errado sem perceber, que é exatamente o engano que a tela existe para
 * evitar. Só quando existe UMA linha daquela peça é que o id sozinho basta.
 */
export function acharEntradaDoToken(
  token: BattleMapToken,
  entries: CombatEntry[]
): CombatEntry | null {
  if (token.entity_type === 'player_character' && token.entity_id !== null) {
    return entries.find((e) => e.character_id === token.entity_id) ?? null;
  }

  const nome = normalizar(token.name);

  if (token.entity_type === 'stage_item' && token.entity_id !== null) {
    const daPeca = entries.filter((e) => e.stage_item_id === token.entity_id);

    if (daPeca.length === 1) return daPeca[0] ?? null;

    const porNome = daPeca.find((e) => normalizar(e.name) === nome);

    if (porNome) return porNome;
  }

  const homonimos = entries.filter((e) => normalizar(e.name) === nome);

  return homonimos.length === 1 ? (homonimos[0] ?? null) : null;
}

function normalizar(texto: string): string {
  return texto.trim().toLowerCase();
}
