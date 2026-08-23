import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { sessionsApi, type SessionPayload } from '@/api';
import type { CampaignSession } from '@/api/types';

export const sessionKeys = {
  all: (campaignId: number) => ['campaign-sessions', campaignId] as const,
  month: (campaignId: number, from: string, to: string) =>
    ['campaign-sessions', campaignId, from, to] as const,
  upcoming: (campaignId: number) => ['campaign-sessions', campaignId, 'upcoming'] as const,
};

/** As sessões de um intervalo — o mês que o calendário está mostrando. */
export function useCampaignSessions(campaignId: number | null | undefined, from: string, to: string) {
  return useQuery<CampaignSession[]>({
    queryKey: sessionKeys.month(campaignId ?? 0, from, to),
    queryFn: () => sessionsApi.list(campaignId as number, { from, to }),
    enabled: Boolean(campaignId),
  });
}

/**
 * A próxima sessão da mesa.
 *
 * Consulta própria, e não um filtro sobre o mês: a resposta que a tela da
 * campanha precisa é "quando jogamos de novo", e ela pode estar no mês que
 * vem — ou em nenhum mês que o calendário esteja mostrando.
 */
export function useNextSession(campaignId: number | null | undefined) {
  return useQuery<CampaignSession[]>({
    queryKey: sessionKeys.upcoming(campaignId ?? 0),
    queryFn: () => sessionsApi.list(campaignId as number, { upcoming: true, limit: 3 }),
    enabled: Boolean(campaignId),
  });
}

export function useSessionMutations(campaignId: number) {
  const queryClient = useQueryClient();

  // Invalida a família inteira: marcar uma sessão muda o mês que está na tela,
  // a próxima sessão do card da campanha e, ao remarcar, dois meses de uma vez.
  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: sessionKeys.all(campaignId) });
  };

  const create = useMutation({
    mutationFn: (payload: SessionPayload) => sessionsApi.create(campaignId, payload),
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: ({ id, ...payload }: { id: number } & Partial<SessionPayload>) =>
      sessionsApi.update(campaignId, id, payload),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (id: number) => sessionsApi.remove(campaignId, id),
    onSuccess: invalidate,
  });

  return { create, update, remove, invalidate };
}
