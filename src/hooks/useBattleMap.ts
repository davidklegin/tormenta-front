import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  battleMapApi,
  type AddAreaEffectInput,
  type AddTokenInput,
  type BattleMapUpdateInput,
  type PatchTokenInput,
} from '@/api';
import type { BattleMapState, FogRegion } from '@/api/types';
import { useSessionStore } from '@/store/session';

export const battleMapKeys = {
  state: (campaignId: number) => ['battlemap', campaignId] as const,
};

/**
 * O tabuleiro da mesa.
 *
 * Como o palco e a iniciativa, quem atualiza durante a sessão é o WebSocket
 * (ver useCampaignChannel); o intervalo é a rede de segurança para quando o
 * socket cai. O tabuleiro fica mais curto que os outros — dez segundos — porque
 * uma peça no lugar errado engana a mesa inteira sobre quem alcança quem.
 */
export function useBattleMap(campaignId: number | null | undefined, enabled = true) {
  const realtimeStatus = useSessionStore((state) => state.realtimeStatus);

  return useQuery<BattleMapState>({
    queryKey: battleMapKeys.state(campaignId ?? 0),
    queryFn: () => battleMapApi.state(campaignId as number),
    enabled: Boolean(campaignId) && enabled,
    refetchInterval: realtimeStatus === 'connected' ? false : 10_000,
  });
}

/**
 * Mover uma peça.
 *
 * A peça anda na tela antes de o servidor responder. Sem isso ela voltaria ao
 * lugar de origem no instante em que o dedo solta e só pularia para o destino
 * quando a resposta chegasse — num celular em rede de mesa de jogo, esse
 * pisca-pisca é a diferença entre um tabuleiro e uma tela travando.
 *
 * Se a requisição falhar, o estado anterior volta: a peça recua sozinha, que é
 * a leitura correta de "o servidor não aceitou esse movimento".
 */
export function useMoveToken(campaignId: number) {
  const queryClient = useQueryClient();
  const chave = battleMapKeys.state(campaignId);

  return useMutation({
    mutationFn: ({ tokenId, x, y }: { tokenId: number; x: number; y: number }) =>
      battleMapApi.moveToken(campaignId, tokenId, x, y),

    onMutate: async ({ tokenId, x, y }) => {
      await queryClient.cancelQueries({ queryKey: chave });
      const anterior = queryClient.getQueryData<BattleMapState>(chave);

      queryClient.setQueryData<BattleMapState>(chave, (atual) =>
        atual
          ? {
              ...atual,
              tokens: atual.tokens.map((token) =>
                token.id === tokenId ? { ...token, position: { x, y } } : token
              ),
            }
          : atual
      );

      return { anterior };
    },

    onError: (_erro, _variaveis, contexto) => {
      if (contexto?.anterior) {
        queryClient.setQueryData(chave, contexto.anterior);
      }
    },

    onSuccess: (estado) => queryClient.setQueryData(chave, estado),
  });
}

/** Desfazer o último movimento — o dedo escorregou. */
export function useUndoToken(campaignId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (tokenId: number) => battleMapApi.undoToken(campaignId, tokenId),
    onSuccess: (estado) => queryClient.setQueryData(battleMapKeys.state(campaignId), estado),
  });
}

/**
 * O que só o mestre faz: montar o mapa, pôr e tirar peças, cobrir com névoa,
 * marcar áreas no chão.
 */
export function useBattleMapControls(campaignId: number) {
  const queryClient = useQueryClient();
  const aplicar = (estado: BattleMapState) =>
    queryClient.setQueryData(battleMapKeys.state(campaignId), estado);

  return {
    salvarMapa: useMutation({
      mutationFn: (dados: BattleMapUpdateInput) => battleMapApi.update(campaignId, dados),
      onSuccess: aplicar,
    }),

    enviarFundo: useMutation({
      mutationFn: (arquivo: FormData) => battleMapApi.uploadBackground(campaignId, arquivo),
      onSuccess: aplicar,
    }),

    adicionarToken: useMutation({
      mutationFn: (dados: AddTokenInput) => battleMapApi.addToken(campaignId, dados),
      onSuccess: aplicar,
    }),

    adicionarGrupo: useMutation({
      mutationFn: () => battleMapApi.addParty(campaignId),
      onSuccess: aplicar,
    }),

    ajustarToken: useMutation({
      mutationFn: ({ tokenId, dados }: { tokenId: number; dados: PatchTokenInput }) =>
        battleMapApi.patchToken(campaignId, tokenId, dados),
      onSuccess: aplicar,
    }),

    removerToken: useMutation({
      mutationFn: (tokenId: number) => battleMapApi.removeToken(campaignId, tokenId),
      onSuccess: aplicar,
    }),

    salvarNevoa: useMutation({
      mutationFn: (regioes: FogRegion[]) => battleMapApi.updateFog(campaignId, regioes),
      onSuccess: aplicar,
    }),

    adicionarArea: useMutation({
      mutationFn: (dados: AddAreaEffectInput) => battleMapApi.addAreaEffect(campaignId, dados),
      onSuccess: aplicar,
    }),

    removerArea: useMutation({
      mutationFn: (effectId: string) => battleMapApi.removeAreaEffect(campaignId, effectId),
      onSuccess: aplicar,
    }),

    guardarTabuleiro: useMutation({
      mutationFn: () => battleMapApi.end(campaignId),
      onSuccess: aplicar,
    }),
  };
}
