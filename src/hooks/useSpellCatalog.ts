import { useEffect, useState } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { spellsApi } from '@/api';
import type { CatalogSpell, SpellCatalogFilters, SpellSearch } from '@/api/types';

const POR_PAGINA = 50;

/**
 * Busca na biblioteca de magias.
 *
 * São centenas de magias com descrição e aprimoramentos — grandes demais para
 * baixar de uma vez —, então a lista vem paginada e o rolar pede a próxima
 * página. A digitação é represada por 300ms antes de virar requisição: sem
 * isso, "bola de fogo" dispararia doze buscas.
 */
export function useSpellCatalog(search: Omit<SpellSearch, 'page' | 'per_page'>) {
  const termo = useDebounced(search.q?.trim() ?? '', 300);
  const filtros = { ...search, q: termo || undefined };

  const query = useInfiniteQuery({
    queryKey: ['spells', 'catalog', filtros],
    queryFn: ({ pageParam }) => spellsApi.list({ ...filtros, page: pageParam, per_page: POR_PAGINA }),
    initialPageParam: 1,
    getNextPageParam: (ultima) =>
      ultima.meta.current_page < ultima.meta.last_page ? ultima.meta.current_page + 1 : undefined,
    staleTime: 1000 * 60 * 30,
  });

  const spells: CatalogSpell[] = query.data?.pages.flatMap((p) => p.data) ?? [];

  return {
    ...query,
    spells,
    total: query.data?.pages[0]?.meta.total ?? 0,
    /** true enquanto a busca digitada ainda não chegou ao servidor. */
    digitando: termo !== (search.q?.trim() ?? ''),
  };
}

/** Opções dos filtros (traduções, escolas, publicações) — mudam com o seeder. */
export function useSpellCatalogFilters() {
  return useQuery<SpellCatalogFilters>({
    queryKey: ['spells', 'filters'],
    queryFn: spellsApi.filters,
    staleTime: 1000 * 60 * 60 * 12,
  });
}

function useDebounced<T>(value: T, delay: number): T {
  const [atrasado, setAtrasado] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setAtrasado(value), delay);

    return () => clearTimeout(timer);
  }, [value, delay]);

  return atrasado;
}
