import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  combatApi,
  type CombatEntryInput,
  type ApplyDamageInput,
  type UpdateStatsInput,
  type AddConditionInput,
  type RemoveConditionInput,
} from '@/api';
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

  const aplicarDano = useMutation({
    mutationFn: (input: ApplyDamageInput) => combatApi.applyDamage(campaignId, input),
    onSuccess: aplicar,
  });

  const desfazerDano = useMutation({
    mutationFn: () => combatApi.undoDamage(campaignId),
    onSuccess: aplicar,
  });

  /**
   * Reordenar mexe na lista que o dedo está arrastando, então a nova ordem
   * entra na tela antes da resposta: sem isso a linha solta volta ao lugar
   * antigo e pula para o novo quando o servidor responde.
   */
  const reordenar = useMutation({
    mutationFn: (entryIds: string[]) => combatApi.reorder(campaignId, entryIds),

    onMutate: async (entryIds) => {
      const chave = combatKeys.state(campaignId);
      await queryClient.cancelQueries({ queryKey: chave });
      const anterior = queryClient.getQueryData<CombatState>(chave);

      if (anterior) {
        const porId = new Map(anterior.entries.map((e) => [e.id, e]));
        const reordenadas = entryIds.flatMap((id) => porId.get(id) ?? []);
        const atual = anterior.entries[anterior.turn_index] ?? null;
        const novoIndice = atual ? reordenadas.findIndex((e) => e.id === atual.id) : -1;

        queryClient.setQueryData<CombatState>(chave, {
          ...anterior,
          entries: reordenadas,
          turn_index: novoIndice >= 0 ? novoIndice : anterior.turn_index,
        });
      }

      return { anterior };
    },

    onError: (_erro, _ids, contexto) => {
      if (contexto?.anterior) {
        queryClient.setQueryData(combatKeys.state(campaignId), contexto.anterior);
      }
    },

    onSuccess: aplicar,
  });

  const atualizarStats = useMutation({
    mutationFn: (input: UpdateStatsInput) => combatApi.updateStats(campaignId, input),
    onSuccess: aplicar,
  });

  const adicionarCondicao = useMutation({
    mutationFn: (input: AddConditionInput) => combatApi.addCondition(campaignId, input),
    onSuccess: aplicar,
  });

  const removerCondicao = useMutation({
    mutationFn: (input: RemoveConditionInput) => combatApi.removeCondition(campaignId, input),
    onSuccess: aplicar,
  });

  return {
    definir,
    proximo,
    anterior,
    encerrar,
    aplicarDano,
    desfazerDano,
    reordenar,
    atualizarStats,
    adicionarCondicao,
    removerCondicao,
  };
}
