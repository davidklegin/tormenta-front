import { apiRequest, apiUpload } from '../client';
import type {
  CampaignNote,
  Envelope,
  NoteAttachment,
  StageItem,
  StageItemKind,
  StageState,
  StageSource,
} from '../types';

/**
 * Acervo do mestre e palco da sessão.
 *
 * O acervo (`items`) é do MASTER e só dele: o servidor recusa a listagem
 * inteira para qualquer outra conta, então não existe versão "sem os
 * segredos" desta resposta.
 *
 * O palco tem os dois lados. `state` é o que a tela de exibição lê — qualquer
 * membro da mesa —, e `show`/`clear` é a mesa de controle. Repare que `show`
 * manda só a referência do que exibir: o cartaz é montado no servidor, como no
 * "Exibir aos outros" da ficha.
 */
export const stageApi = {
  // ---------------------------------------------------------------- acervo
  items: (campaignId: number, filters?: { q?: string; kind?: StageItemKind }) =>
    apiRequest<Envelope<StageItem[]>>(`/campaigns/${campaignId}/stage-items`, { query: filters }).then(
      (r) => r.data
    ),

  createItem: (campaignId: number, payload: Record<string, unknown>) =>
    apiRequest<Envelope<StageItem>>(`/campaigns/${campaignId}/stage-items`, {
      method: 'POST',
      body: payload,
    }).then((r) => r.data),

  updateItem: (campaignId: number, itemId: number, payload: Record<string, unknown>) =>
    apiRequest<Envelope<StageItem>>(`/campaigns/${campaignId}/stage-items/${itemId}`, {
      method: 'PUT',
      body: payload,
    }).then((r) => r.data),

  removeItem: (campaignId: number, itemId: number) =>
    apiRequest<{ message: string }>(`/campaigns/${campaignId}/stage-items/${itemId}`, { method: 'DELETE' }),

  /**
   * Copia a peça para as anotações da campanha, onde a mesa inteira lê.
   *
   * Idempotente: chamar de novo atualiza a mesma anotação. Quem controla isso
   * é o servidor, pelo `published_note_id` da peça — o app só toca no botão.
   */
  publishItem: (campaignId: number, itemId: number) =>
    apiRequest<{ message: string; data: CampaignNote }>(
      `/campaigns/${campaignId}/stage-items/${itemId}/publish`,
      { method: 'POST' }
    ),

  addAttachment: (campaignId: number, itemId: number, form: FormData) =>
    apiUpload<{ data: NoteAttachment }>(
      `/campaigns/${campaignId}/stage-items/${itemId}/attachments`,
      form
    ).then((r) => r.data),

  updateAttachment: (
    campaignId: number,
    itemId: number,
    attachmentId: number,
    payload: { caption?: string }
  ) =>
    apiRequest<{ data: NoteAttachment }>(
      `/campaigns/${campaignId}/stage-items/${itemId}/attachments/${attachmentId}`,
      { method: 'PUT', body: payload }
    ).then((r) => r.data),

  removeAttachment: (campaignId: number, itemId: number, attachmentId: number) =>
    apiRequest<{ message: string }>(
      `/campaigns/${campaignId}/stage-items/${itemId}/attachments/${attachmentId}`,
      { method: 'DELETE' }
    ),

  // ----------------------------------------------------------------- palco
  state: (campaignId: number) =>
    apiRequest<Envelope<StageState>>(`/campaigns/${campaignId}/stage`).then((r) => r.data),

  show: (campaignId: number, source: StageSource) =>
    apiRequest<Envelope<StageState>>(`/campaigns/${campaignId}/stage`, {
      method: 'PUT',
      body: source,
    }).then((r) => r.data),

  /** Fecha a cortina: a tela da mesa volta ao estado de espera. */
  clear: (campaignId: number) =>
    apiRequest<Envelope<StageState>>(`/campaigns/${campaignId}/stage`, { method: 'DELETE' }).then(
      (r) => r.data
    ),

  /** Manda para as anotações da campanha o que está no ar agora. */
  publishLive: (campaignId: number) =>
    apiRequest<{ message: string; data: CampaignNote }>(`/campaigns/${campaignId}/stage/publish`, {
      method: 'POST',
    }),
};
