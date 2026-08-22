import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { powersApi } from '@/api';
import type { CatalogPower, PowerCatalogFilters, PowerSearch } from '@/api/types';
import { useDebounced } from './useDebounced';

const POR_PAGINA = 50;

/**
 * Busca na biblioteca de poderes.
 *
 * São centenas de poderes espalhados por treze grupos — grandes demais para
 * baixar de uma vez —, então a lista vem paginada e o rolar pede a próxima
 * página. A digitação é represada antes de virar requisição.
 */
export function usePowerCatalog(search: Omit<PowerSearch, 'page' | 'per_page'>) {
  const termo = useDebounced(search.q?.trim() ?? '', 300);
  const filtros = { ...search, q: termo || undefined };

  const query = useInfiniteQuery({
    queryKey: ['powers', 'catalog', filtros],
    queryFn: ({ pageParam }) => powersApi.list({ ...filtros, page: pageParam, per_page: POR_PAGINA }),
    initialPageParam: 1,
    getNextPageParam: (ultima) =>
      ultima.meta.current_page < ultima.meta.last_page ? ultima.meta.current_page + 1 : undefined,
  });

  const powers: CatalogPower[] = query.data?.pages.flatMap((p) => p.data) ?? [];

  return {
    ...query,
    powers,
    total: query.data?.pages[0]?.meta.total ?? 0,
    /** true enquanto a busca digitada ainda não chegou ao servidor. */
    digitando: termo !== (search.q?.trim() ?? ''),
  };
}

/** Opções dos filtros (grupos, tipos, publicações) — mudam com o seeder. */
export function usePowerCatalogFilters() {
  return useQuery<PowerCatalogFilters>({
    queryKey: ['powers', 'filters'],
    queryFn: powersApi.filters,
  });
}
