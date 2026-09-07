import { apiRequest, apiUpload } from '../client';
import type {
  Campaign,
  CampaignScope,
  CampaignMember,
  CampaignNote,
  CharacterSummary,
  Envelope,
  MasterDashboard,
  NoteAttachment,
  NoteCategory,
  Paginated,
} from '../types';

export const campaignsApi = {
  /**
   * `scope` escolhe a lista: 'mine' (padrão) são as mesas das quais participo,
   * 'public' é o catálogo aberto e 'all' junta os dois. `q` busca no catálogo.
   */
  list: (params?: { scope?: CampaignScope; q?: string }) =>
    apiRequest<Envelope<Campaign[]>>('/campaigns', { query: params }).then((r) => r.data),

  get: (id: number) => apiRequest<Envelope<Campaign>>(`/campaigns/${id}`).then((r) => r.data),

  create: (payload: { name: string; description?: string }) =>
    apiRequest<Envelope<Campaign>>('/campaigns', { method: 'POST', body: payload }).then((r) => r.data),

  update: (id: number, payload: Record<string, unknown>) =>
    apiRequest<Envelope<Campaign>>(`/campaigns/${id}`, { method: 'PUT', body: payload }).then((r) => r.data),

  remove: (id: number) => apiRequest<{ message: string }>(`/campaigns/${id}`, { method: 'DELETE' }),

  characters: (id: number) =>
    apiRequest<Envelope<CharacterSummary[]>>(`/campaigns/${id}/characters`).then((r) => r.data),

  /** Painel do Mestre — payload enxuto, feito para atualizar durante a sessão. */
  dashboard: (id: number) => apiRequest<MasterDashboard>(`/campaigns/${id}/dashboard`),

  join: (code: string) =>
    apiRequest<{ message: string; campaign: Campaign }>('/campaigns/join', {
      method: 'POST',
      body: { code },
    }),

  /** Entrada livre numa mesa pública — sem código. */
  joinPublic: (id: number) =>
    apiRequest<{ message: string; campaign: Campaign }>(`/campaigns/${id}/join`, { method: 'POST' }),

  leave: (id: number) => apiRequest<{ message: string }>(`/campaigns/${id}/leave`, { method: 'POST' }),

  regenerateInviteCode: (id: number) =>
    apiRequest<Envelope<Campaign>>(`/campaigns/${id}/invite-code/regenerate`, { method: 'POST' }).then(
      (r) => r.data
    ),

  members: (id: number) =>
    apiRequest<Envelope<CampaignMember[]>>(`/campaigns/${id}/members`).then((r) => r.data),

  invite: (id: number, email: string) =>
    apiRequest<{ message: string; member: CampaignMember }>(`/campaigns/${id}/members`, {
      method: 'POST',
      body: { email },
    }),

  removeMember: (id: number, memberId: number) =>
    apiRequest<{ message: string }>(`/campaigns/${id}/members/${memberId}`, { method: 'DELETE' }),

  notes: (id: number, filters?: { q?: string; category?: NoteCategory }) =>
    apiRequest<Paginated<CampaignNote>>(`/campaigns/${id}/notes`, { query: filters }),

  createNote: (
    id: number,
    payload: { title: string; body?: string; category?: NoteCategory; visibility?: string }
  ) =>
    apiRequest<Envelope<CampaignNote>>(`/campaigns/${id}/notes`, { method: 'POST', body: payload }).then(
      (r) => r.data
    ),

  updateNote: (id: number, noteId: number, payload: Record<string, unknown>) =>
    apiRequest<Envelope<CampaignNote>>(`/campaigns/${id}/notes/${noteId}`, {
      method: 'PUT',
      body: payload,
    }).then((r) => r.data),

  /** "Já podem ler": libera (ou volta a velar) a descrição. Só o mestre da mesa. */
  revealNote: (id: number, noteId: number, revealed: boolean) =>
    apiRequest<Envelope<CampaignNote>>(`/campaigns/${id}/notes/${noteId}/reveal`, {
      method: 'PATCH',
      body: { revealed },
    }).then((r) => r.data),

  removeNote: (id: number, noteId: number) =>
    apiRequest<{ message: string }>(`/campaigns/${id}/notes/${noteId}`, { method: 'DELETE' }),

  // Anexos das anotações — retratos de NPCs, mapas, PDFs, planilhas, áudios
  addNoteAttachment: (id: number, noteId: number, form: FormData) =>
    apiUpload<{ data: NoteAttachment }>(`/campaigns/${id}/notes/${noteId}/attachments`, form).then(
      (r) => r.data
    ),

  updateNoteAttachment: (id: number, noteId: number, attachmentId: number, payload: { caption?: string }) =>
    apiRequest<{ data: NoteAttachment }>(`/campaigns/${id}/notes/${noteId}/attachments/${attachmentId}`, {
      method: 'PUT',
      body: payload,
    }).then((r) => r.data),

  removeNoteAttachment: (id: number, noteId: number, attachmentId: number) =>
    apiRequest<{ message: string }>(`/campaigns/${id}/notes/${noteId}/attachments/${attachmentId}`, {
      method: 'DELETE',
    }),
};
