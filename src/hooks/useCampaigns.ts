import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { campaignsApi } from '@/api';
import type { Campaign, CampaignNote, MasterDashboard, NoteCategory } from '@/api/types';
import { useSessionStore } from '@/store/session';

export const campaignKeys = {
  all: ['campaigns'] as const,
  catalog: (q: string) => ['campaigns', 'public', q] as const,
  detail: (id: number) => ['campaign', id] as const,
  dashboard: (id: number) => ['dashboard', id] as const,
  members: (id: number) => ['campaign-members', id] as const,
  notes: (id: number) => ['campaign-notes', id] as const,
  characters: (id: number) => ['campaign-characters', id] as const,
};

/** As mesas das quais o usuário participa — o que a aba Campanhas abre. */
export function useCampaigns() {
  return useQuery<Campaign[]>({
    queryKey: campaignKeys.all,
    queryFn: () => campaignsApi.list(),
    staleTime: 1000 * 60,
  });
}

/**
 * O catálogo aberto: mesas públicas de todo mundo.
 *
 * A busca vai ao servidor porque o catálogo devolve as mais recentes, e não a
 * base inteira — é assim que se acha uma campanha antiga.
 */
export function usePublicCampaigns(q = '') {
  return useQuery<Campaign[]>({
    queryKey: campaignKeys.catalog(q),
    queryFn: () => campaignsApi.list({ scope: 'public', q: q || undefined }),
    staleTime: 1000 * 30,
  });
}

export function useCampaign(id: number | null | undefined) {
  return useQuery<Campaign>({
    queryKey: campaignKeys.detail(id ?? 0),
    queryFn: () => campaignsApi.get(id as number),
    enabled: Boolean(id),
  });
}

/**
 * Painel do Mestre (briefing §5).
 *
 * O tempo real cuida das atualizações; o intervalo de refetch é a rede de
 * segurança para quando o WebSocket estiver fora. Enquanto o socket está
 * conectado, o intervalo fica desligado — nada de polling agressivo
 * (briefing §28).
 */
export function useMasterDashboard(campaignId: number | null | undefined) {
  const realtimeStatus = useSessionStore((state) => state.realtimeStatus);
  const realtimeIsUp = realtimeStatus === 'connected';

  return useQuery<MasterDashboard>({
    queryKey: campaignKeys.dashboard(campaignId ?? 0),
    queryFn: () => campaignsApi.dashboard(campaignId as number),
    enabled: Boolean(campaignId),
    staleTime: 1000 * 5,
    refetchInterval: realtimeIsUp ? false : 20_000,
    refetchOnWindowFocus: true,
  });
}

export function useCampaignCharacters(campaignId: number | null | undefined) {
  return useQuery({
    queryKey: campaignKeys.characters(campaignId ?? 0),
    queryFn: () => campaignsApi.characters(campaignId as number),
    enabled: Boolean(campaignId),
  });
}

export function useCampaignMembers(campaignId: number | null | undefined) {
  return useQuery({
    queryKey: campaignKeys.members(campaignId ?? 0),
    queryFn: () => campaignsApi.members(campaignId as number),
    enabled: Boolean(campaignId),
  });
}

export function useCampaignNotes(
  campaignId: number | null | undefined,
  filters?: { q?: string; category?: NoteCategory }
) {
  return useQuery({
    queryKey: [...campaignKeys.notes(campaignId ?? 0), filters?.q ?? '', filters?.category ?? ''],
    queryFn: () => campaignsApi.notes(campaignId as number, filters),
    enabled: Boolean(campaignId),
  });
}

export function useCreateCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: { name: string; description?: string }) => campaignsApi.create(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: campaignKeys.all });
    },
  });
}

/** Entrada livre numa mesa pública, sem código de convite. */
export function useJoinPublicCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => campaignsApi.joinPublic(id),
    onSuccess: (_result, id) => {
      void queryClient.invalidateQueries({ queryKey: campaignKeys.all });
      void queryClient.invalidateQueries({ queryKey: campaignKeys.detail(id) });
    },
  });
}

/** Edição da campanha pelo mestre — nome, descrição, visibilidade. */
export function useUpdateCampaign(id: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: Record<string, unknown>) => campaignsApi.update(id, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: campaignKeys.detail(id) });
      void queryClient.invalidateQueries({ queryKey: campaignKeys.all });
    },
  });
}

export function useJoinCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (code: string) => campaignsApi.join(code),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: campaignKeys.all });
      void queryClient.invalidateQueries({ queryKey: ['characters'] });
    },
  });
}

export function useCampaignNoteMutations(campaignId: number) {
  const queryClient = useQueryClient();
  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: campaignKeys.notes(campaignId) });
  };

  const create = useMutation({
    mutationFn: (payload: { title: string; body?: string; category?: NoteCategory; visibility?: string }) =>
      campaignsApi.createNote(campaignId, payload),
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: ({ id, ...payload }: { id: number } & Record<string, unknown>) =>
      campaignsApi.updateNote(campaignId, id, payload),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (id: number) => campaignsApi.removeNote(campaignId, id),
    onSuccess: invalidate,
  });

  return { create, update, remove };
}

export type { CampaignNote };
