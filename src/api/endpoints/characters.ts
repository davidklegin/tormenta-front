import { apiRequest, apiUpload } from '../client';
import type {
  Character,
  CharacterAttack,
  CharacterClassAbility,
  CharacterCondition,
  CharacterItem,
  CharacterNote,
  CharacterPower,
  CharacterResource,
  CharacterSkill,
  CharacterSpell,
  CharacterSummary,
  Envelope,
  Vitals,
} from '../types';

export type CharacterPayload = {
  name: string;
  campaign_id?: number | null;
  race_id?: number | null;
  race_variant?: string | null;
  racial_attribute_choices?: string[] | null;
  origin_id?: number | null;
  deity_id?: number | null;
  size?: string;
  base_displacement?: number;
  experience?: number;
  attributes?: Record<string, number>;
  classes?: { game_class_id?: number; key?: string; level?: number; is_primary?: boolean }[];
  defense_attribute?: string;
  defense_other_bonus?: number;
  spell_attribute?: string | null;
  proficiencies?: string | null;
  money_tibar?: number;
  version?: number;
  [key: string]: unknown;
};

export type VitalsPayload = {
  deltas?: Partial<Record<'current_hp' | 'current_mp' | 'temp_hp' | 'temp_mp', number>>;
  absolutes?: Partial<Record<'current_hp' | 'current_mp' | 'temp_hp' | 'temp_mp', number>>;
  reason?: string;
};

export type VitalsResponse = {
  hp: Vitals;
  mp: Vitals;
  is_down: boolean;
  is_dead: boolean;
  death_threshold: number;
  updated_at: string | null;
};

export const charactersApi = {
  list: () => apiRequest<Envelope<CharacterSummary[]>>('/characters').then((r) => r.data),

  get: (id: number) => apiRequest<Envelope<Character>>(`/characters/${id}`).then((r) => r.data),

  create: (payload: CharacterPayload) =>
    apiRequest<Envelope<Character>>('/characters', { method: 'POST', body: payload }).then((r) => r.data),

  update: (id: number, payload: CharacterPayload) =>
    apiRequest<Envelope<Character>>(`/characters/${id}`, { method: 'PUT', body: payload }).then(
      (r) => r.data
    ),

  remove: (id: number) => apiRequest<{ message: string }>(`/characters/${id}`, { method: 'DELETE' }),

  uploadAvatar: (id: number, file: FormData) =>
    apiUpload<Envelope<Character>>(`/characters/${id}/avatar`, file).then((r) => r.data),

  // --- controle de sessão ---
  updateVitals: (id: number, payload: VitalsPayload) =>
    apiRequest<VitalsResponse>(`/characters/${id}/vitals`, { method: 'PATCH', body: payload }),

  rest: (id: number, quality: 'ruim' | 'normal' | 'confortavel' | 'luxuosa' = 'normal') =>
    apiRequest<{ hp: Vitals; mp: Vitals; message: string }>(`/characters/${id}/rest`, {
      method: 'POST',
      body: { quality },
    }),

  history: (id: number) =>
    apiRequest<{ data: unknown[] }>(`/characters/${id}/vitals/history`).then((r) => r.data),

  // --- perícias ---
  skills: (id: number) =>
    apiRequest<{ data: CharacterSkill[] }>(`/characters/${id}/skills`).then((r) => r.data),

  updateSkill: (
    characterId: number,
    skillId: number,
    payload: {
      trained?: boolean;
      other_bonus?: number;
      manual_total?: number | null;
      attribute_override?: string | null;
    }
  ) =>
    apiRequest<{ data: CharacterSkill }>(`/characters/${characterId}/skills/${skillId}`, {
      method: 'PUT',
      body: payload,
    }).then((r) => r.data),

  addSkillSpecialization: (
    characterId: number,
    payload: { skill_id: number; specialization: string; trained?: boolean }
  ) =>
    apiRequest<{ data: CharacterSkill }>(`/characters/${characterId}/skills`, {
      method: 'POST',
      body: payload,
    }).then((r) => r.data),

  removeSkill: (characterId: number, skillId: number) =>
    apiRequest<{ message: string }>(`/characters/${characterId}/skills/${skillId}`, { method: 'DELETE' }),

  // --- ataques ---
  attacks: (id: number) =>
    apiRequest<{ data: CharacterAttack[] }>(`/characters/${id}/attacks`).then((r) => r.data),
  createAttack: (id: number, payload: Record<string, unknown>) =>
    apiRequest<{ data: CharacterAttack }>(`/characters/${id}/attacks`, {
      method: 'POST',
      body: payload,
    }).then((r) => r.data),
  updateAttack: (id: number, attackId: number, payload: Record<string, unknown>) =>
    apiRequest<{ data: CharacterAttack }>(`/characters/${id}/attacks/${attackId}`, {
      method: 'PUT',
      body: payload,
    }).then((r) => r.data),
  removeAttack: (id: number, attackId: number) =>
    apiRequest<{ message: string }>(`/characters/${id}/attacks/${attackId}`, { method: 'DELETE' }),

  // --- equipamento ---
  items: (id: number) =>
    apiRequest<{ data: CharacterItem[]; carry: Character['carry']; money_tibar: number }>(
      `/characters/${id}/items`
    ),
  createItem: (id: number, payload: Record<string, unknown>) =>
    apiRequest<{ data: CharacterItem; carry: Character['carry'] }>(`/characters/${id}/items`, {
      method: 'POST',
      body: payload,
    }),
  updateItem: (id: number, itemId: number, payload: Record<string, unknown>) =>
    apiRequest<{ data: CharacterItem; carry: Character['carry'] }>(`/characters/${id}/items/${itemId}`, {
      method: 'PUT',
      body: payload,
    }),
  removeItem: (id: number, itemId: number) =>
    apiRequest<{ message: string; carry: Character['carry'] }>(`/characters/${id}/items/${itemId}`, {
      method: 'DELETE',
    }),
  updateMoney: (id: number, moneyTibar: number) =>
    apiRequest<{ money_tibar: number; carry: Character['carry'] }>(`/characters/${id}/money`, {
      method: 'PUT',
      body: { money_tibar: moneyTibar },
    }),

  // --- poderes ---
  powers: (id: number, type?: string) =>
    apiRequest<{ data: CharacterPower[] }>(`/characters/${id}/powers`, { query: { type } }).then(
      (r) => r.data
    ),
  createPower: (id: number, payload: Record<string, unknown>) =>
    apiRequest<{ data: CharacterPower }>(`/characters/${id}/powers`, { method: 'POST', body: payload }).then(
      (r) => r.data
    ),
  updatePower: (id: number, powerId: number, payload: Record<string, unknown>) =>
    apiRequest<{ data: CharacterPower }>(`/characters/${id}/powers/${powerId}`, {
      method: 'PUT',
      body: payload,
    }).then((r) => r.data),
  removePower: (id: number, powerId: number) =>
    apiRequest<{ message: string }>(`/characters/${id}/powers/${powerId}`, { method: 'DELETE' }),

  // --- magias ---
  spells: (id: number, filters?: { q?: string; circle?: number; tradition?: string; school?: string }) =>
    apiRequest<{
      data: CharacterSpell[];
      by_circle: Record<string, number>;
      save_dc: Character['spellcasting'];
    }>(`/characters/${id}/spells`, { query: filters }),
  createSpell: (id: number, payload: Record<string, unknown>) =>
    apiRequest<{ data: CharacterSpell }>(`/characters/${id}/spells`, { method: 'POST', body: payload }).then(
      (r) => r.data
    ),
  updateSpell: (id: number, spellId: number, payload: Record<string, unknown>) =>
    apiRequest<{ data: CharacterSpell }>(`/characters/${id}/spells/${spellId}`, {
      method: 'PUT',
      body: payload,
    }).then((r) => r.data),
  removeSpell: (id: number, spellId: number) =>
    apiRequest<{ message: string }>(`/characters/${id}/spells/${spellId}`, { method: 'DELETE' }),
  /**
   * Adiciona de uma vez as magias marcadas na biblioteca. O backend ignora as
   * que o personagem já conhece e devolve quantas entraram e quantas pulou.
   */
  importSpells: (id: number, spellIds: number[]) =>
    apiRequest<{ data: CharacterSpell[]; added: number; skipped: number }>(
      `/characters/${id}/spells/import`,
      { method: 'POST', body: { spell_ids: spellIds } }
    ),

  // --- habilidades de classe ---
  classAbilities: (id: number) =>
    apiRequest<{ data: CharacterClassAbility[]; by_level: Record<string, number> }>(
      `/characters/${id}/class-abilities`
    ),
  createClassAbility: (id: number, payload: Record<string, unknown>) =>
    apiRequest<{ data: CharacterClassAbility }>(`/characters/${id}/class-abilities`, {
      method: 'POST',
      body: payload,
    }).then((r) => r.data),
  updateClassAbility: (id: number, abilityId: number, payload: Record<string, unknown>) =>
    apiRequest<{ data: CharacterClassAbility }>(`/characters/${id}/class-abilities/${abilityId}`, {
      method: 'PUT',
      body: payload,
    }).then((r) => r.data),
  removeClassAbility: (id: number, abilityId: number) =>
    apiRequest<{ message: string }>(`/characters/${id}/class-abilities/${abilityId}`, { method: 'DELETE' }),

  // --- condições ---
  conditions: (id: number) =>
    apiRequest<{ data: CharacterCondition[] }>(`/characters/${id}/conditions`).then((r) => r.data),
  addCondition: (
    id: number,
    payload: { key?: string; condition_id?: number; duration_note?: string; value?: number }
  ) =>
    apiRequest<{ data: CharacterCondition }>(`/characters/${id}/conditions`, {
      method: 'POST',
      body: payload,
    }).then((r) => r.data),
  removeCondition: (id: number, conditionId: number) =>
    apiRequest<{ message: string }>(`/characters/${id}/conditions/${conditionId}`, { method: 'DELETE' }),
  clearConditions: (id: number) =>
    apiRequest<{ message: string }>(`/characters/${id}/conditions/clear`, { method: 'POST' }),

  // --- buffs, debuffs e recursos ---
  resources: (id: number) =>
    apiRequest<{ data: CharacterResource[] }>(`/characters/${id}/resources`).then((r) => r.data),
  createResource: (id: number, payload: Record<string, unknown>) =>
    apiRequest<{ data: CharacterResource }>(`/characters/${id}/resources`, {
      method: 'POST',
      body: payload,
    }).then((r) => r.data),
  updateResource: (id: number, resourceId: number, payload: Record<string, unknown>) =>
    apiRequest<{ data: CharacterResource }>(`/characters/${id}/resources/${resourceId}`, {
      method: 'PUT',
      body: payload,
    }).then((r) => r.data),
  removeResource: (id: number, resourceId: number) =>
    apiRequest<{ message: string }>(`/characters/${id}/resources/${resourceId}`, { method: 'DELETE' }),

  // --- anotações pessoais ---
  notes: (id: number, q?: string) =>
    apiRequest<{ data: CharacterNote[] }>(`/characters/${id}/notes`, { query: { q } }).then((r) => r.data),
  createNote: (id: number, payload: { title: string; body?: string; pinned?: boolean }) =>
    apiRequest<{ data: CharacterNote }>(`/characters/${id}/notes`, { method: 'POST', body: payload }).then(
      (r) => r.data
    ),
  updateNote: (id: number, noteId: number, payload: { title?: string; body?: string; pinned?: boolean }) =>
    apiRequest<{ data: CharacterNote }>(`/characters/${id}/notes/${noteId}`, {
      method: 'PUT',
      body: payload,
    }).then((r) => r.data),
  removeNote: (id: number, noteId: number) =>
    apiRequest<{ message: string }>(`/characters/${id}/notes/${noteId}`, { method: 'DELETE' }),
};
