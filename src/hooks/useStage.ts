import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { stageApi } from '@/api';
import type { StageItem, StageItemKind, StageSource, StageState } from '@/api/types';
import { useSessionStore } from '@/store/session';
import { campaignKeys } from './useCampaigns';

export const stageKeys = {
  state: (campaignId: number) => ['stage', campaignId] as const,
  items: (campaignId: number) => ['stage-items', campaignId] as const,
};

/**
 * O que está no palco da mesa.
 *
 * O tempo real é quem atualiza durante a sessão (ver useCampaignChannel, que
 * escreve direto neste cache). O `refetchInterval` só entra quando o socket
 * está fora: numa tela que fica horas aberta na TV, ficar sem o WebSocket e
 * sem rede de segurança significaria a projeção congelar sem ninguém perceber.
 */
export function useStage(campaignId: number | null | undefined, enabled = true) {
  const realtimeStatus = useSessionStore((state) => state.realtimeStatus);

  return useQuery<StageState>({
    queryKey: stageKeys.state(campaignId ?? 0),
    queryFn: () => stageApi.state(campaignId as number),
    enabled: Boolean(campaignId) && enabled,
    refetchInterval: realtimeStatus === 'connected' ? false : 15_000,
  });
}

/** O acervo do mestre — a consulta falha com 403 para qualquer outra conta. */
export function useStageItems(
  campaignId: number | null | undefined,
  filters?: { q?: string; kind?: StageItemKind },
  enabled = true
) {
  return useQuery<StageItem[]>({
    queryKey: [...stageKeys.items(campaignId ?? 0), filters?.q ?? '', filters?.kind ?? ''],
    queryFn: () => stageApi.items(campaignId as number, filters),
    enabled: Boolean(campaignId) && enabled,
  });
}

export function useStageItemMutations(campaignId: number) {
  const queryClient = useQueryClient();
  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: stageKeys.items(campaignId) });
  };

  const create = useMutation({
    mutationFn: (payload: Record<string, unknown>) => stageApi.createItem(campaignId, payload),
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: ({ id, ...payload }: { id: number } & Record<string, unknown>) =>
      stageApi.updateItem(campaignId, id, payload),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (id: number) => stageApi.removeItem(campaignId, id),
    onSuccess: invalidate,
  });

  /**
   * "Enviar para a campanha".
   *
   * Invalida o acervo (a peça passa a ter `published_note_id`, e o botão muda
   * de rótulo) e as anotações, que acabaram de ganhar uma.
   */
  const publish = useMutation({
    mutationFn: (id: number) => stageApi.publishItem(campaignId, id),
    onSuccess: () => {
      invalidate();
      void queryClient.invalidateQueries({ queryKey: campaignKeys.notes(campaignId) });
    },
  });

  return { create, update, remove, publish, invalidate };
}

/**
 * Exibir e limpar.
 *
 * A resposta já traz o estado novo e ela mesma preenche o cache: o mestre vê a
 * prévia mudar no mesmo instante, sem esperar o evento dar a volta pelo
 * servidor de WebSocket — que, para ele, chegaria de qualquer jeito.
 */
export function useStageControls(campaignId: number) {
  const queryClient = useQueryClient();

  const aplicar = (estado: StageState) => {
    queryClient.setQueryData(stageKeys.state(campaignId), estado);
  };

  const show = useMutation({
    mutationFn: (source: StageSource) => stageApi.show(campaignId, source),
    onSuccess: aplicar,
  });

  const clear = useMutation({
    mutationFn: () => stageApi.clear(campaignId),
    onSuccess: aplicar,
  });

  const publishLive = useMutation({
    mutationFn: () => stageApi.publishLive(campaignId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: campaignKeys.notes(campaignId) });
      void queryClient.invalidateQueries({ queryKey: stageKeys.items(campaignId) });
    },
  });

  return { show, clear, publishLive };
}
