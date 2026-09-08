import type { BattleMapToken, CharacterSummary, CombatEntry } from '@/api/types';

/** O que a lista de peças mostra ao lado do nome. */
export type VitaisDaPeca = {
  pv: { atual: number; max: number; temp: number };
  /** Null para quem não tem mana — o goblin, o barril, o corpo caído. */
  pm: { atual: number; max: number } | null;
};

/**
 * O PV e o PM de uma peça do tabuleiro.
 *
 * A ordem das fontes é a resposta para o defeito que a mesa via na lista de
 * peças: a **ficha** primeiro, a linha da iniciativa depois.
 *
 * A ficha é a fonte da verdade do personagem, e ela muda por fora do combate o
 * tempo todo — a poção bebida no celular do jogador, os PM gastos na magia, o
 * dano que ele mesmo anotou. A linha da iniciativa também acompanha a ficha
 * (o servidor a casa em `CampaignCombat::ordemComAsFichas`), mas **só existe
 * durante o combate**: fora dele a lista de peças ficava com o nome do
 * personagem e nada ao lado, como se ele não tivesse vida nem mana.
 *
 * Para o NPC é o contrário, e por isso a segunda fonte não é um detalhe: o PV
 * dele não mora em ficha nenhuma — mora na linha da iniciativa, que é onde o
 * mestre o cadastrou e onde o dano é anotado.
 */
export function vitaisDaPeca(
  token: BattleMapToken,
  entrada: CombatEntry | null,
  fichas: CharacterSummary[]
): VitaisDaPeca | null {
  if (token.entity_type === 'player_character' && token.entity_id !== null) {
    const ficha = fichas.find((f) => f.id === token.entity_id);

    if (ficha) {
      return {
        pv: { atual: ficha.hp.current, max: ficha.hp.max, temp: ficha.hp.temp },
        pm: ficha.mp.max > 0 ? { atual: ficha.mp.current, max: ficha.mp.max } : null,
      };
    }
  }

  if (entrada) {
    return {
      pv: { atual: entrada.current_hp, max: entrada.max_hp, temp: entrada.temp_hp },
      pm:
        entrada.max_mp !== null && entrada.max_mp > 0
          ? { atual: entrada.current_mp ?? 0, max: entrada.max_mp }
          : null,
    };
  }

  return null;
}
