import { apiRequest } from '../client';
import type { CatalogPower, CatalogPowerDetail, PowerCatalogFilters, PowerSearch } from '../types';

/**
 * Biblioteca de poderes — de onde o jogador escolhe um poder pronto em vez de
 * digitar nome, pré-requisito e descrição na mão.
 *
 * Fora do reference/bootstrap pelo mesmo motivo do grimório: são centenas de
 * poderes com descrição, então a lista vem paginada e filtrada pelo servidor.
 */
export const powersApi = {
  list: (search: PowerSearch = {}) =>
    apiRequest<{ data: CatalogPower[]; meta: { current_page: number; last_page: number; total: number } }>(
      '/powers',
      { query: search }
    ),
  show: (id: number) => apiRequest<{ data: CatalogPowerDetail }>(`/powers/${id}`).then((r) => r.data),
  filters: () => apiRequest<PowerCatalogFilters>('/powers/filters'),
};
