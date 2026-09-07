import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSessionStore } from '@/store/session';
import type {
  BattleMapState,
  CombatState,
  ConditionsUpdatedEvent,
  MasterDashboard,
  ResourcesUpdatedEvent,
  StageState,
  SummaryUpdatedEvent,
  VitalsUpdatedEvent,
} from '@/api/types';
import { disconnectEcho, getEcho } from './echo';

/**
 * Assina o canal privado da campanha e mantém o cache atualizado (briefing §6).
 *
 * Em vez de recarregar a tela inteira a cada evento, aplicamos a alteração
 * diretamente no cache do TanStack Query — o card do personagem afetado
 * re-renderiza sozinho e o resto do painel fica intocado (briefing §28).
 *
 * Se o socket não conectar, o `refetchInterval` do painel assume como rede de
 * segurança: a mesa continua funcionando, só com atualização mais lenta.
 */
export function useCampaignChannel(campaignId: number | null | undefined, enabled = true) {
  const queryClient = useQueryClient();
  const setRealtimeStatus = useSessionStore((state) => state.setRealtimeStatus);
  const markEventReceived = useSessionStore((state) => state.markEventReceived);

  // Guardamos a instância obtida no efeito para poder sair do canal na limpeza
  // sem chamar getEcho() de novo — que criaria uma conexão só para descartá-la.
  const echoRef = useRef<Awaited<ReturnType<typeof getEcho>>>(null);
  const channelRef = useRef<string | null>(null);

  useEffect(() => {
    if (!campaignId || !enabled) {
      setRealtimeStatus('idle');

      return;
    }

    let cancelled = false;
    const channelName = `campaign.${campaignId}`;

    const patchDashboard = (
      characterId: number,
      patch: (character: MasterDashboard['characters'][number]) => MasterDashboard['characters'][number]
    ) => {
      queryClient.setQueryData<MasterDashboard>(['dashboard', campaignId], (previous) => {
        if (!previous) return previous;

        return {
          ...previous,
          characters: previous.characters.map((character) =>
            character.id === characterId ? patch(character) : character
          ),
        };
      });
    };

    async function subscribe() {
      setRealtimeStatus('connecting');

      const echo = await getEcho();
      if (!echo || cancelled) {
        setRealtimeStatus('offline');

        return;
      }

      echoRef.current = echo;

      const connector = echo.connector as {
        pusher?: { connection?: { bind: (event: string, cb: () => void) => void } };
      };

      connector.pusher?.connection?.bind('connected', () => setRealtimeStatus('connected'));
      connector.pusher?.connection?.bind('connecting', () => setRealtimeStatus('reconnecting'));
      connector.pusher?.connection?.bind('unavailable', () => setRealtimeStatus('offline'));
      connector.pusher?.connection?.bind('failed', () => setRealtimeStatus('offline'));

      const channel = echo.private(channelName);
      channelRef.current = channelName;

      channel.listen('.character.vitals.updated', (event: VitalsUpdatedEvent) => {
        markEventReceived();

        patchDashboard(event.character_id, (character) => ({
          ...character,
          hp: {
            ...event.hp,
            ratio: event.hp.max > 0 ? Math.max(0, (event.hp.current + event.hp.temp) / event.hp.max) : 0,
          },
          mp: {
            ...event.mp,
            ratio: event.mp.max > 0 ? Math.max(0, (event.mp.current + event.mp.temp) / event.mp.max) : 0,
          },
          status: {
            ...character.status,
            is_down: event.is_down,
            severity: severityFromEvent(event),
          },
          updated_at: event.updated_at,
        }));

        // A ficha aberta, se houver, também precisa refletir o novo valor —
        // e a lista de fichas junto, que é de onde o marcador flutuante de
        // vida e mana tira os números em todas as outras telas.
        queryClient.invalidateQueries({ queryKey: ['character', event.character_id], exact: false });
        queryClient.invalidateQueries({ queryKey: ['characters'] });
      });

      channel.listen('.character.conditions.updated', (event: ConditionsUpdatedEvent) => {
        markEventReceived();
        patchDashboard(event.character_id, (character) => ({
          ...character,
          conditions: event.conditions,
        }));
        queryClient.invalidateQueries({ queryKey: ['character', event.character_id], exact: false });
      });

      channel.listen('.character.resources.updated', (event: ResourcesUpdatedEvent) => {
        markEventReceived();
        patchDashboard(event.character_id, (character) => ({
          ...character,
          resources: event.resources,
        }));
      });

      channel.listen('.character.summary.updated', (event: SummaryUpdatedEvent) => {
        markEventReceived();
        patchDashboard(event.character_id, (character) => ({
          ...character,
          name: event.name,
          avatar_url: event.avatar_url,
          level: event.level,
          class_label: event.class_label,
        }));
      });

      // O palco da mesa: o evento traz o estado inteiro, então ele substitui
      // o que está no cache. Vale para todo mundo que assina o canal — a TV
      // virada para os jogadores e o celular de cada um deles.
      channel.listen('.stage.updated', (event: StageState) => {
        markEventReceived();
        queryClient.setQueryData<StageState>(['stage', campaignId], event);
      });

      // A ordem de iniciativa: como o palco, o evento traz o estado inteiro.
      channel.listen('.combat.updated', (event: CombatState) => {
        markEventReceived();
        queryClient.setQueryData<CombatState>(['combat', campaignId], event);
      });

      // O tabuleiro virtual: como o palco e a iniciativa, o evento traz o estado
      // inteiro — com uma ressalva que os outros dois não têm.
      //
      // Este mapa sai do servidor em duas versões: a da mesa, por aqui, e a do
      // mestre, pelo canal pessoal dele (ver useUserChannel). São canais
      // diferentes, e a ordem entre canais não é garantida. Escrever a visão da
      // mesa por cima da do mestre apagava da tela dele os tokens escondidos e,
      // como a tela lê `is_master_view` para saber quem manda, levava junto os
      // botões de Névoa, Área e Tabuleiro: mover uma peça fazia a barra de
      // ferramentas do mestre encolher sozinha.
      //
      // Aqui a visão da mesa cede a vez. Revalidar em vez de simplesmente
      // ignorar é o que mantém o mestre em dia mesmo se o evento do canal
      // pessoal não chegar: o GET devolve a versão certa para quem perguntou.
      channel.listen('.battlemap.updated', (event: BattleMapState) => {
        markEventReceived();

        const atual = queryClient.getQueryData<BattleMapState>(['battlemap', campaignId]);

        if (atual?.is_master_view) {
          void queryClient.invalidateQueries({ queryKey: ['battlemap', campaignId] });

          return;
        }

        queryClient.setQueryData<BattleMapState>(['battlemap', campaignId], event);
      });

      // Anotações e membros mudam com pouca frequência: revalidar é suficiente.
      channel.listen('.campaign.note.created', () => {
        queryClient.invalidateQueries({ queryKey: ['campaign-notes', campaignId] });
      });
      channel.listen('.campaign.note.updated', () => {
        queryClient.invalidateQueries({ queryKey: ['campaign-notes', campaignId] });
      });
      channel.listen('.campaign.note.deleted', () => {
        queryClient.invalidateQueries({ queryKey: ['campaign-notes', campaignId] });
      });
      // Calendário: o aviso não traz a sessão, e sim o "algo mudou" — a lista
      // vem filtrada pelo mês que está na tela, e a sessão nova pode não ser
      // daquele mês.
      for (const acao of ['created', 'updated', 'deleted']) {
        channel.listen(`.campaign.session.${acao}`, () => {
          queryClient.invalidateQueries({ queryKey: ['campaign-sessions', campaignId] });
        });
      }

      channel.listen('.campaign.member.joined', () => {
        queryClient.invalidateQueries({ queryKey: ['campaign', campaignId] });
        queryClient.invalidateQueries({ queryKey: ['dashboard', campaignId] });
      });
      channel.listen('.campaign.member.removed', () => {
        queryClient.invalidateQueries({ queryKey: ['campaign', campaignId] });
        queryClient.invalidateQueries({ queryKey: ['dashboard', campaignId] });
      });
    }

    void subscribe();

    return () => {
      cancelled = true;

      if (echoRef.current && channelRef.current) {
        echoRef.current.leave(channelRef.current);
        channelRef.current = null;
      }

      setRealtimeStatus('idle');
    };
  }, [campaignId, enabled, queryClient, setRealtimeStatus, markEventReceived]);
}

function severityFromEvent(event: VitalsUpdatedEvent): 'ok' | 'warning' | 'critical' | 'down' {
  const current = event.hp.current + event.hp.temp;
  if (current <= 0) return 'down';
  if (event.hp.max <= 0) return 'ok';

  const ratio = current / event.hp.max;
  if (ratio <= 0.25) return 'critical';
  if (ratio <= 0.5) return 'warning';

  return 'ok';
}

/** Encerra a conexão — usado no logout. */
export function closeRealtime(): void {
  disconnectEcho();
}
