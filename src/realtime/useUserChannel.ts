import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { BattleMapState, CombatTurnEvent } from '@/api/types';
import { useAuthStore } from '@/store/auth';
import { useCombatAlertStore } from '@/store/combat';
import { getEcho } from './echo';

/**
 * Assina o canal pessoal do usuário (`user.{id}`).
 *
 * É o canal das coisas dirigidas a uma pessoa. Carrega o aviso de vez no
 * combate e o tabuleiro na versão do mestre — o mapa sem cortes, que não pode
 * andar pelo canal da campanha porque lá ele chegaria também aos jogadores,
 * com a emboscada dentro. Diferente do canal da campanha, este fica de pé
 * enquanto durar a sessão: quando chega a vez do jogador, ele quase nunca está
 * olhando a tela do combate — está na ficha contando PM, ou no grimório.
 */
export function useUserChannel() {
  const meuId = useAuthStore((estado) => estado.user?.id ?? null);
  const receber = useCombatAlertStore((estado) => estado.receber);
  const limpar = useCombatAlertStore((estado) => estado.limpar);
  const queryClient = useQueryClient();

  const echoRef = useRef<Awaited<ReturnType<typeof getEcho>>>(null);

  useEffect(() => {
    if (meuId === null) return;

    let cancelado = false;
    const canal = `user.${meuId}`;

    async function assinar() {
      const echo = await getEcho();
      if (!echo || cancelado) return;

      echoRef.current = echo;

      const assinatura = echo.private(canal);

      assinatura.listen('.combat.turn', (evento: CombatTurnEvent) => {
        receber(evento);
      });

      // O mapa inteiro, para quem mestra. Substitui o que o canal da campanha
      // acabou de escrever no mesmo cache — os dois eventos saem juntos do
      // servidor, e este é o que vale para o mestre.
      assinatura.listen(
        '.battlemap.master.updated',
        (evento: BattleMapState & { campaign_id: number }) => {
          const { campaign_id: campanhaId, ...estado } = evento;
          queryClient.setQueryData<BattleMapState>(['battlemap', campanhaId], estado);
        }
      );
    }

    void assinar();

    return () => {
      cancelado = true;
      echoRef.current?.leave(canal);
      echoRef.current = null;
      limpar();
    };
  }, [meuId, receber, limpar, queryClient]);
}
