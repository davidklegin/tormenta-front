import { useQuery } from '@tanstack/react-query';
import { referenceApi } from '@/api';
import type { ReferenceData } from '@/api/types';

/**
 * Catálogos de regras (perícias, condições, raças, classes, origens, deuses,
 * itens).
 *
 * O conteúdo só muda quando o backend roda um seeder, então mantemos em cache
 * por bastante tempo — o app baixa uma vez e reaproveita durante a sessão
 * inteira (briefing §28).
 */
export function useReference() {
  return useQuery<ReferenceData>({
    queryKey: ['reference'],
    queryFn: referenceApi.bootstrap,
    staleTime: 1000 * 60 * 60 * 12,
    gcTime: 1000 * 60 * 60 * 24,
  });
}
