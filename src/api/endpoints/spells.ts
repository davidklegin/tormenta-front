import { apiRequest } from '../client';
import type { CatalogSpell, CatalogSpellDetail, SpellCatalogFilters, SpellSearch } from '../types';

/**
 * Biblioteca de magias — o grimório completo, de onde o jogador escolhe o que
 * o personagem conhece.
 *
 * Fora do reference/bootstrap de propósito: são centenas de magias com
 * descrição e aprimoramentos, então a lista vem paginada e filtrada pelo
 * servidor em vez de morar inteira no cliente.
 */
export const spellsApi = {
  list: (search: SpellSearch = {}) =>
    apiRequest<{ data: CatalogSpell[]; meta: { current_page: number; last_page: number; total: number } }>(
      '/spells',
      { query: search }
    ),
  show: (id: number) => apiRequest<{ data: CatalogSpellDetail }>(`/spells/${id}`).then((r) => r.data),
  filters: () => apiRequest<SpellCatalogFilters>('/spells/filters'),
};
