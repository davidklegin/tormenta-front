import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { combatApi, type CombatEntryInput } from '@/api';
import type { CombatState } from '@/api/types';
import { useSessionStore } from '@/store/session';

export const combatKeys = {
  state: (campaignId: number) => ['combat', campaignId] as const,
};

/**
 * A ordem de iniciativa da mesa.
 *
 * Como o palco, é o WebSocket que atualiza durante a sessão (ver
 * useCampaignChannel); o intervalo só entra quando o socket está fora. Numa
 * tela de combate, ficar uma rodada atrás sem perceber é pior que recarregar.
 */
export function useCombat(campaignId: number | null | undefined, enabled = true) {
  const realtimeStatus = useSessionStore((state) => state.realtimeStatus);

  return useQuery<CombatState>({
    queryKey: combatKeys.state(campaignId ?? 0),
    queryFn: () => combatApi.state(campaignId as number),
    enabled: Boolean(campaignId) && enabled,
    refetchInterval: realtimeStatus === 'connected' ? false : 15_000,
  });
}

/** Montar a ordem, andar com ela e encerrar — tudo do mestre. */
export function useCombatControls(campaignId: number) {
  const queryClient = useQueryClient();

  const aplicar = (estado: CombatState) => {
    queryClient.setQueryData(combatKeys.state(campaignId), estado);
  };

  const definir = useMutation({
    mutationFn: ({ entries, round }: { entries: CombatEntryInput[]; round?: number }) =>
      combatApi.set(campaignId, entries, round),
    onSuccess: aplicar,
  });

  const proximo = useMutation({
    mutationFn: () => combatApi.next(campaignId),
    onSuccess: aplicar,
  });

  const anterior = useMutation({
    mutationFn: () => combatApi.previous(campaignId),
    onSuccess: aplicar,
  });

  const encerrar = useMutation({
    mutationFn: () => combatApi.end(campaignId),
    onSuccess: aplicar,
  });

  return { definir, proximo, anterior, encerrar };
}
