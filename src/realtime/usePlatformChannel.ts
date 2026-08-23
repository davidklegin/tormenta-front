import { useEffect, useRef } from 'react';
import type { ShowcaseEvent } from '@/api/types';
import { useAuthStore } from '@/store/auth';
import { useShowcaseStore } from '@/store/showcase';
import { getEcho } from './echo';

const CANAL = 'platform';

/**
 * Assina o canal de toda a plataforma e recolhe os "Exibir aos outros"
 * (briefing §21).
 *
 * Diferente do canal da campanha, este é assinado uma vez na área logada e
 * fica de pé enquanto durar a sessão — o aviso precisa alcançar o usuário
 * esteja ele na ficha, no painel do mestre ou no perfil.
 *
 * Quem exibiu não recebe o próprio aviso: ele está olhando o painel do item
 * neste exato momento, e uma notificação para abrir o que já está aberto só
 * atrapalharia. O filtro é por id do usuário, e não por socket, porque a mesma
 * conta pode estar aberta no celular e no navegador — e nesse caso o outro
 * aparelho deve receber.
 */
export function usePlatformChannel() {
  const receber = useShowcaseStore((estado) => estado.receber);
  const limpar = useShowcaseStore((estado) => estado.limpar);
  const meuId = useAuthStore((estado) => estado.user?.id ?? null);

  const echoRef = useRef<Awaited<ReturnType<typeof getEcho>>>(null);

  useEffect(() => {
    if (meuId === null) return;

    let cancelado = false;

    async function assinar() {
      const echo = await getEcho();
      if (!echo || cancelado) return;

      echoRef.current = echo;

      echo.private(CANAL).listen('.showcase.shared', (evento: ShowcaseEvent) => {
        if (evento.actor?.id === meuId) return;

        receber(evento);
      });
    }

    void assinar();

    return () => {
      cancelado = true;
      echoRef.current?.leave(CANAL);
      echoRef.current = null;

      // Trocar de conta ou sair leva junto o que a conta anterior recebeu: o
      // aviso é dirigido a uma pessoa, não ao aparelho.
      limpar();
    };
  }, [meuId, receber, limpar]);
}
