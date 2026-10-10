import { apiRequest } from '../client';
import type { CampaignTreasury, Envelope } from '../types';

/**
 * O cofre do grupo: o dinheiro que a mesa guarda junta.
 *
 * `amount` positivo guarda, negativo retira. Toda resposta devolve o cofre
 * inteiro (saldo e histórico recente), e é com ela que a tela se atualiza.
 */
export const treasuryApi = {
  show: (campaignId: number) =>
    apiRequest<Envelope<CampaignTreasury>>(`/campaigns/${campaignId}/treasury`).then((r) => r.data),

  move: (campaignId: number, payload: { amount: number; description?: string | null }) =>
    apiRequest<Envelope<CampaignTreasury>>(`/campaigns/${campaignId}/treasury`, {
      method: 'POST',
      body: payload,
    }).then((r) => r.data),

  undo: (campaignId: number, entryId: number) =>
    apiRequest<Envelope<CampaignTreasury>>(`/campaigns/${campaignId}/treasury/${entryId}`, {
      method: 'DELETE',
    }).then((r) => r.data),
};
