import { apiRequest } from '../client';
import type { Envelope, ForgeItem } from '../types';

/**
 * A Forja: itens da mesa com bônus.
 *
 * Qualquer conta cria; todos veem (o item entra no catálogo do inventário);
 * só quem forjou e o MASTER editam ou apagam.
 */
export const forgeApi = {
  list: () => apiRequest<{ data: ForgeItem[] }>('/forge/items').then((r) => r.data),

  create: (payload: Record<string, unknown>) =>
    apiRequest<Envelope<ForgeItem>>('/forge/items', { method: 'POST', body: payload }).then((r) => r.data),

  update: (id: number, payload: Record<string, unknown>) =>
    apiRequest<Envelope<ForgeItem>>(`/forge/items/${id}`, { method: 'PUT', body: payload }).then((r) => r.data),

  remove: (id: number) => apiRequest<{ message: string }>(`/forge/items/${id}`, { method: 'DELETE' }),
};
