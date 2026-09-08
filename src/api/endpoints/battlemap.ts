import { apiRequest, apiUpload } from '../client';
import type { AreaEffect, BattleMapState, Envelope, FogRegion, TokenEntityType } from '../types';

export type BattleMapUpdateInput = {
  name: string;
  grid_config?: { scale?: number; offset_x?: number; offset_y?: number };
  width_squares?: number;
  height_squares?: number;
  state?: 'preparing' | 'active' | 'paused';
};

export type AddTokenInput = {
  entity_type: TokenEntityType;
  entity_id?: number;
  position_x: number;
  position_y: number;
  size?: number;
  label?: string;
  is_visible?: boolean;
};

/** Ajustes do mestre numa peça já no tabuleiro. */
export type PatchTokenInput = {
  size?: number;
  label?: string;
  is_visible?: boolean;
  conditions?: string[];
};

export type AddAreaEffectInput = Omit<AreaEffect, 'id'>;

/**
 * Tabuleiro virtual.
 *
 * Toda rota devolve o tabuleiro inteiro, como a ordem de iniciativa: mover uma
 * peça não retorna "a peça", retorna o mapa. Isso apaga a pergunta de o que
 * fazer quando dois aparelhos mexem ao mesmo tempo — a última resposta manda,
 * inteira, e não há estado parcial para reconciliar na tela.
 *
 * O que volta já vem podado para quem pediu: o jogador não recebe token
 * escondido nem criatura sob a névoa (ver BattleMap::toState no backend).
 */
export const battleMapApi = {
  /**
   * O tabuleiro como quem pediu deve vê-lo.
   *
   * `comoMesa` pede a visão dos jogadores mesmo quando quem chama é o mestre —
   * é o que a tela de TV usa. Sem isso, a tela grande virada para a mesa
   * mostraria a emboscada e o que está sob a névoa, porque a conta logada
   * naquele aparelho costuma ser a do mestre.
   */
  state: (campaignId: number, comoMesa = false) =>
    apiRequest<Envelope<BattleMapState>>(`/campaigns/${campaignId}/battlemap`, {
      query: comoMesa ? { view: 'table' } : undefined,
    }).then((r) => r.data),

  update: (campaignId: number, data: BattleMapUpdateInput) =>
    apiRequest<Envelope<BattleMapState>>(`/campaigns/${campaignId}/battlemap`, {
      method: 'PUT',
      body: data,
    }).then((r) => r.data),

  uploadBackground: (campaignId: number, arquivo: FormData) =>
    apiUpload<Envelope<BattleMapState>>(`/campaigns/${campaignId}/battlemap/background`, arquivo).then(
      (r) => r.data
    ),

  addToken: (campaignId: number, data: AddTokenInput) =>
    apiRequest<Envelope<BattleMapState>>(`/campaigns/${campaignId}/battlemap/tokens`, {
      method: 'POST',
      body: data,
    }).then((r) => r.data),

  /** Põe no mapa as fichas da mesa que ainda não estão nele. */
  addParty: (campaignId: number) =>
    apiRequest<Envelope<BattleMapState>>(`/campaigns/${campaignId}/battlemap/tokens/party`, {
      method: 'POST',
    }).then((r) => r.data),

  moveToken: (campaignId: number, tokenId: number, x: number, y: number) =>
    apiRequest<Envelope<BattleMapState>>(`/campaigns/${campaignId}/battlemap/tokens/${tokenId}`, {
      method: 'PUT',
      body: { position_x: x, position_y: y },
    }).then((r) => r.data),

  patchToken: (campaignId: number, tokenId: number, data: PatchTokenInput) =>
    apiRequest<Envelope<BattleMapState>>(`/campaigns/${campaignId}/battlemap/tokens/${tokenId}`, {
      method: 'PATCH',
      body: data,
    }).then((r) => r.data),

  undoToken: (campaignId: number, tokenId: number) =>
    apiRequest<Envelope<BattleMapState>>(
      `/campaigns/${campaignId}/battlemap/tokens/${tokenId}/undo`,
      { method: 'POST' }
    ).then((r) => r.data),

  removeToken: (campaignId: number, tokenId: number) =>
    apiRequest<Envelope<BattleMapState>>(`/campaigns/${campaignId}/battlemap/tokens/${tokenId}`, {
      method: 'DELETE',
    }).then((r) => r.data),

  updateFog: (campaignId: number, fogRegions: FogRegion[]) =>
    apiRequest<Envelope<BattleMapState>>(`/campaigns/${campaignId}/battlemap/fog`, {
      method: 'PUT',
      body: { fog_regions: fogRegions },
    }).then((r) => r.data),

  addAreaEffect: (campaignId: number, data: AddAreaEffectInput) =>
    apiRequest<Envelope<BattleMapState>>(`/campaigns/${campaignId}/battlemap/area-effects`, {
      method: 'POST',
      body: data,
    }).then((r) => r.data),

  removeAreaEffect: (campaignId: number, effectId: string) =>
    apiRequest<Envelope<BattleMapState>>(`/campaigns/${campaignId}/battlemap/area-effects`, {
      method: 'DELETE',
      body: { effect_id: effectId },
    }).then((r) => r.data),

  end: (campaignId: number) =>
    apiRequest<Envelope<BattleMapState>>(`/campaigns/${campaignId}/battlemap`, {
      method: 'DELETE',
    }).then((r) => r.data),
};
