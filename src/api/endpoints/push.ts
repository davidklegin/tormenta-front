import { apiRequest } from '../client';

type VapidKeyResponse = {
  data: {
    vapid_public_key: string;
  };
};

type SubscriptionResponse = {
  message: string;
  data: {
    id: number;
    created: boolean;
  };
};

/**
 * Web Push Notifications API.
 */
export const pushApi = {
  /** Retorna a chave pública VAPID para registrar no navegador. */
  getVapidKey: () => apiRequest<VapidKeyResponse>('/push/vapid-key').then((r) => r.data.vapid_public_key),

  /** Registra uma subscription do navegador no servidor. */
  subscribe: (subscription: PushSubscriptionJSON) =>
    apiRequest<SubscriptionResponse>('/push/subscriptions', {
      method: 'POST',
      body: subscription,
    }),

  /** Remove uma subscription. */
  unsubscribe: (endpoint: string) =>
    apiRequest<{ message: string }>('/push/subscriptions', {
      method: 'DELETE',
      body: { endpoint },
    }),
};
