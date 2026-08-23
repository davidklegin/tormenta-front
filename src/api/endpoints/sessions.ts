import { apiRequest } from '../client';
import type { CampaignSession, Envelope } from '../types';

export type SessionPayload = {
  title: string;
  /** ISO 8601 com fuso — o servidor converte para UTC. */
  starts_at: string;
  duration_minutes?: number | null;
  location?: string | null;
  notes?: string | null;
  status?: CampaignSession['status'];
};

/**
 * Calendário da campanha.
 *
 * A listagem vem filtrada por intervalo porque o calendário pede um mês por
 * vez: uma mesa de dois anos mandaria tudo a cada troca de mês, e o que a tela
 * desenha são 35 células.
 */
export const sessionsApi = {
  list: (campaignId: number, params?: { from?: string; to?: string; upcoming?: boolean; limit?: number }) =>
    apiRequest<Envelope<CampaignSession[]>>(`/campaigns/${campaignId}/sessions`, {
      query: params?.upcoming ? { ...params, upcoming: 1 } : params,
    }).then((r) => r.data),

  create: (campaignId: number, payload: SessionPayload) =>
    apiRequest<Envelope<CampaignSession>>(`/campaigns/${campaignId}/sessions`, {
      method: 'POST',
      body: payload,
    }).then((r) => r.data),

  update: (campaignId: number, sessionId: number, payload: Partial<SessionPayload>) =>
    apiRequest<Envelope<CampaignSession>>(`/campaigns/${campaignId}/sessions/${sessionId}`, {
      method: 'PUT',
      body: payload,
    }).then((r) => r.data),

  remove: (campaignId: number, sessionId: number) =>
    apiRequest<{ message: string }>(`/campaigns/${campaignId}/sessions/${sessionId}`, { method: 'DELETE' }),
};
