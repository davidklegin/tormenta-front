import { apiRequest } from '../client';
import type { CombatState, Envelope } from '../types';

/** O que a mesa de controle manda quando (re)define a ordem. */
export type CombatEntryInput = {
  name?: string;
  initiative: number;
  character_id?: number | null;
};

/**
 * Ordem de iniciativa.
 *
 * A ordem vai inteira a cada mudança, e não linha a linha: é como a mesa
 * funciona (rola-se iniciativa de todo mundo de uma vez) e resolve sozinho o
 * caso de duas telas editando ao mesmo tempo — a última a salvar manda.
 */
export const combatApi = {
  state: (campaignId: number) =>
    apiRequest<Envelope<CombatState>>(`/campaigns/${campaignId}/combat`).then((r) => r.data),

  set: (campaignId: number, entries: CombatEntryInput[], round?: number) =>
    apiRequest<Envelope<CombatState>>(`/campaigns/${campaignId}/combat`, {
      method: 'PUT',
      body: { entries, round },
    }).then((r) => r.data),

  next: (campaignId: number) =>
    apiRequest<Envelope<CombatState>>(`/campaigns/${campaignId}/combat/next`, { method: 'POST' }).then(
      (r) => r.data
    ),

  previous: (campaignId: number) =>
    apiRequest<Envelope<CombatState>>(`/campaigns/${campaignId}/combat/previous`, { method: 'POST' }).then(
      (r) => r.data
    ),

  end: (campaignId: number) =>
    apiRequest<Envelope<CombatState>>(`/campaigns/${campaignId}/combat`, { method: 'DELETE' }).then(
      (r) => r.data
    ),
};
