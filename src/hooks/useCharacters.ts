import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { charactersApi, type CharacterPayload, type VitalsPayload } from '@/api';
import type { Character, CharacterSummary } from '@/api/types';

export const characterKeys = {
  all: ['characters'] as const,
  detail: (id: number) => ['character', id] as const,
  skills: (id: number) => ['character', id, 'skills'] as const,
  items: (id: number) => ['character', id, 'items'] as const,
  spells: (id: number) => ['character', id, 'spells'] as const,
  powers: (id: number) => ['character', id, 'powers'] as const,
  abilities: (id: number) => ['character', id, 'abilities'] as const,
  notes: (id: number) => ['character', id, 'notes'] as const,
  conditions: (id: number) => ['character', id, 'conditions'] as const,
  resources: (id: number) => ['character', id, 'resources'] as const,
};

/** Tela inicial do jogador (briefing §8). */
export function useCharacters() {
  return useQuery<CharacterSummary[]>({
    queryKey: characterKeys.all,
    queryFn: charactersApi.list,
    staleTime: 1000 * 30,
  });
}

export function useCharacter(id: number | null | undefined) {
  return useQuery<Character>({
    queryKey: characterKeys.detail(id ?? 0),
    queryFn: () => charactersApi.get(id as number),
    enabled: Boolean(id),
    staleTime: 1000 * 15,
  });
}

export function useCreateCharacter() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CharacterPayload) => charactersApi.create(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: characterKeys.all });
      void queryClient.invalidateQueries({ queryKey: ['campaigns'] });
    },
  });
}

export function useUpdateCharacter(id: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CharacterPayload) => charactersApi.update(id, payload),
    onSuccess: (character) => {
      queryClient.setQueryData(characterKeys.detail(id), character);
      void queryClient.invalidateQueries({ queryKey: characterKeys.all });
    },
  });
}

export function useDeleteCharacter() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => charactersApi.remove(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: characterKeys.all });
    },
  });
}

/**
 * Alteração de PV/PM durante a sessão (briefing §19).
 *
 * Aplica o valor no cache antes da resposta chegar, para o toque no botão
 * parecer instantâneo; se a requisição falhar, o valor anterior é restaurado.
 * O broadcast do servidor cuida de avisar o Painel do Mestre.
 */
export function useUpdateVitals(characterId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: VitalsPayload) => charactersApi.updateVitals(characterId, payload),

    onMutate: async (payload) => {
      await queryClient.cancelQueries({ queryKey: characterKeys.detail(characterId) });
      const previous = queryClient.getQueryData<Character>(characterKeys.detail(characterId));

      if (previous) {
        queryClient.setQueryData<Character>(characterKeys.detail(characterId), (draft) => {
          if (!draft) return draft;

          const next = { ...draft, hp: { ...draft.hp }, mp: { ...draft.mp } };

          // Só o piso é travado. PV e PM acima do máximo são aceitos, como no
          // servidor (ver CharacterVitalsService::clamp).
          const applyDelta = (field: 'current_hp' | 'current_mp' | 'temp_hp' | 'temp_mp', amount: number) => {
            if (field === 'current_hp') {
              next.hp.current = Math.max(next.hp.death_threshold, next.hp.current + amount);
            } else if (field === 'current_mp') {
              next.mp.current = Math.max(0, next.mp.current + amount);
            } else if (field === 'temp_hp') {
              next.hp.temp = Math.max(0, next.hp.temp + amount);
            } else {
              next.mp.temp = Math.max(0, next.mp.temp + amount);
            }
          };

          for (const [field, amount] of Object.entries(payload.deltas ?? {})) {
            applyDelta(field as never, Number(amount));
          }

          for (const [field, amount] of Object.entries(payload.absolutes ?? {})) {
            const value = Number(amount);
            if (field === 'current_hp') next.hp.current = value;
            if (field === 'current_mp') next.mp.current = value;
            if (field === 'temp_hp') next.hp.temp = value;
            if (field === 'temp_mp') next.mp.temp = value;
          }

          next.hp.is_down = next.hp.current + next.hp.temp <= 0;

          return next;
        });
      }

      return { previous };
    },

    onError: (_error, _payload, context) => {
      if (context?.previous) {
        queryClient.setQueryData(characterKeys.detail(characterId), context.previous);
      }
    },

    onSuccess: (result) => {
      // O servidor é a autoridade: aplica clamps e a precedência dos
      // pontos temporários (livro base, p. 106).
      queryClient.setQueryData<Character>(characterKeys.detail(characterId), (draft) => {
        if (!draft) return draft;

        return {
          ...draft,
          hp: { ...draft.hp, ...result.hp, is_down: result.is_down, is_dead: result.is_dead },
          mp: { ...draft.mp, ...result.mp },
        };
      });

      void queryClient.invalidateQueries({ queryKey: characterKeys.all });
    },
  });
}

export function useCharacterConditions(characterId: number) {
  const queryClient = useQueryClient();
  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: characterKeys.detail(characterId) });
    void queryClient.invalidateQueries({ queryKey: characterKeys.conditions(characterId) });
  };

  const add = useMutation({
    mutationFn: (payload: { key?: string; condition_id?: number; duration_note?: string }) =>
      charactersApi.addCondition(characterId, payload),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (conditionId: number) => charactersApi.removeCondition(characterId, conditionId),
    onSuccess: invalidate,
  });

  const clear = useMutation({
    mutationFn: () => charactersApi.clearConditions(characterId),
    onSuccess: invalidate,
  });

  return { add, remove, clear };
}
