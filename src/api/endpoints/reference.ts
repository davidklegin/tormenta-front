import { apiRequest } from '../client';
import type { ReferenceData } from '../types';

/**
 * Catálogos de regras (perícias, condições, raças, classes, origens, deuses,
 * itens). Muda quando o backend roda um seeder, e é buscado a cada uso — ver
 * useReference().
 */
export const referenceApi = {
  bootstrap: () => apiRequest<ReferenceData>('/reference/bootstrap'),
};
