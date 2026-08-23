import { useEffect, useRef } from 'react';
import type { CombatTurnEvent } from '@/api/types';
import { useAuthStore } from '@/store/auth';
import { useCombatAlertStore } from '@/store/combat';
import { getEcho } from './echo';

/**
 * Assina o canal pessoal do usuário (`user.{id}`).
 *
 * É o canal das coisas dirigidas a uma pessoa, e hoje carrega o aviso de vez
 * no combate. Diferente do canal da campanha, este fica de pé enquanto durar a
 * sessão: quando chega a vez do jogador, ele quase nunca está olhando a tela do
 * combate — está na ficha contando PM, ou no grimório. O aviso precisa
 * alcançá-lo onde ele estiver.
 */
export function useUserChannel() {
  const meuId = useAuthStore((estado) => estado.user?.id ?? null);
  const receber = useCombatAlertStore((estado) => estado.receber);
  const limpar = useCombatAlertStore((estado) => estado.limpar);

  const echoRef = useRef<Awaited<ReturnType<typeof getEcho>>>(null);

  useEffect(() => {
    if (meuId === null) return;

    let cancelado = false;
    const canal = `user.${meuId}`;

    async function assinar() {
      const echo = await getEcho();
      if (!echo || cancelado) return;

      echoRef.current = echo;

      echo.private(canal).listen('.combat.turn', (evento: CombatTurnEvent) => {
        receber(evento);
      });
    }

    void assinar();

    return () => {
      cancelado = true;
      echoRef.current?.leave(canal);
      echoRef.current = null;
      limpar();
    };
  }, [meuId, receber, limpar]);
}
