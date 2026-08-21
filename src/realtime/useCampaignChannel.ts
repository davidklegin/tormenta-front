import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSessionStore } from '@/store/session';
import type {
  ConditionsUpdatedEvent,
  MasterDashboard,
  ResourcesUpdatedEvent,
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

        // A ficha aberta, se houver, também precisa refletir o novo valor.
        queryClient.invalidateQueries({ queryKey: ['character', event.character_id], exact: false });
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
