import { apiRequest } from '../client';
import type { ReferenceData } from '../types';

/**
 * Catálogos de regras (perícias, condições, raças, classes, origens, deuses,
 * itens). Muda só quando o backend roda um seeder, então o cache no cliente é
 * longo — ver useReference().
 */
export const referenceApi = {
  bootstrap: () => apiRequest<ReferenceData>('/reference/bootstrap'),
};
