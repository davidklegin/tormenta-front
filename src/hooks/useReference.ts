import { useQuery } from '@tanstack/react-query';
import { referenceApi } from '@/api';
import type { ReferenceData } from '@/api/types';

/**
 * Catálogos de regras (perícias, condições, raças, classes, origens, deuses,
 * itens).
 *
 * Sem cache, como todo o resto: cada tela que precisa dos catálogos vai ao
 * servidor. O ETag de /reference/bootstrap segura o custo — quando nada mudou,
 * a resposta é um 304 sem corpo.
 */
export function useReference() {
  return useQuery<ReferenceData>({
    queryKey: ['reference'],
    queryFn: referenceApi.bootstrap,
  });
}
