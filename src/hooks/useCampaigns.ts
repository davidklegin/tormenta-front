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
  });
}

/**
 * O catálogo aberto: todas as mesas, de todo mundo.
 *
 * Usa `scope=all` e não `public` porque as mesas são abertas a todos — a
 * privada aparece aqui do mesmo jeito; o que ela não tem é vitrine própria. A
 * busca vai ao servidor porque o catálogo devolve as mais recentes, e não a
 * base inteira — é assim que se acha uma campanha antiga.
 */
export function useCampaignCatalog(q = '') {
  return useQuery<Campaign[]>({
    queryKey: campaignKeys.catalog(q),
    queryFn: () => campaignsApi.list({ scope: 'all', q: q || undefined }),
  });
}

/**
 * As mesas que o seletor da ficha oferece: qualquer uma serve.
 *
 * Vincular é livre, então a lista é o catálogo inteiro. As minhas entram por
 * cima porque o catálogo devolve só as mais recentes da base — sem isso, uma
 * mesa antiga em que jogo poderia não aparecer na própria ficha.
 */
export function useLinkableCampaigns() {
  const minhas = useCampaigns();
  const catalogo = useCampaignCatalog();

  const vistas = new Set<number>();
  const campaigns = [...(minhas.data ?? []), ...(catalogo.data ?? [])].filter((campaign) => {
    if (vistas.has(campaign.id)) return false;
    vistas.add(campaign.id);

    return true;
  });

  return { data: campaigns, isLoading: minhas.isLoading || catalogo.isLoading };
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
    refetchInterval: realtimeIsUp ? false : 20_000,
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

  /** O mestre libera a descrição de um NPC para a mesa, ou volta a velá-la. */
  const reveal = useMutation({
    mutationFn: ({ id, revealed }: { id: number; revealed: boolean }) =>
      campaignsApi.revealNote(campaignId, id, revealed),
    onSuccess: invalidate,
  });

  return { create, update, remove, reveal };
}

export type { CampaignNote };
