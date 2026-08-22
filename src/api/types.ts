/**
 * Tipos do contrato da API.
 *
 * Espelham os API Resources do Laravel (app/Http/Resources). Quando um Resource
 * mudar no backend, este arquivo é o lugar correspondente a atualizar.
 */

export type AttributeKey = 'for' | 'des' | 'con' | 'int' | 'sab' | 'car';
export type CampaignRole = 'master' | 'player';
export type Severity = 'ok' | 'warning' | 'critical' | 'down';

export type Envelope<T> = { data: T };
export type Paginated<T> = {
  data: T[];
  meta: { current_page: number; last_page: number; per_page: number; total: number };
};

// ---------------------------------------------------------------- usuário

export type User = {
  id: number;
  name: string;
  nickname: string | null;
  email?: string;
  /**
   * Permissão MASTER da plataforma: acesso a todas as campanhas e fichas.
   *
   * Só vem preenchida para o próprio usuário (como o e-mail). Não confundir
   * com `Campaign.is_master`, que é o papel de mestre daquela mesa.
   */
  is_master?: boolean;
  bio: string | null;
  avatar_url: string | null;
  created_at: string | null;
};

export type AuthResponse = { token: string; user: User };

// -------------------------------------------------------------- campanhas

export type CampaignVisibility = 'public' | 'private';

/** Qual lista de campanhas pedir: as minhas, o catálogo aberto, ou as duas. */
export type CampaignScope = 'mine' | 'public' | 'all';

/** 'mine' são as minhas fichas; 'all' é a base inteira (a leitura é aberta). */
export type CharacterScope = 'mine' | 'all';

export type Campaign = {
  id: number;
  name: string;
  description: string | null;
  cover_url: string | null;
  status: 'active' | 'paused' | 'archived';
  status_label: string;
  /** Pública: qualquer usuário acha a mesa no catálogo, lê e entra sem código. */
  visibility: CampaignVisibility;
  visibility_label: string;
  invite_code?: string;
  settings?: Record<string, unknown> | null;
  master?: User;
  my_role: CampaignRole | null;
  is_master: boolean;
  is_member: boolean;
  /** Mesa pública da qual ainda não participo — vale o botão "Participar". */
  can_join: boolean;
  members?: CampaignMember[];
  members_count?: number;
  characters_count?: number;
  characters?: CharacterSummary[];
  created_at: string | null;
  updated_at: string | null;
};

export type CampaignMember = {
  id: number;
  campaign_id: number;
  user?: User;
  role: CampaignRole;
  role_label: string;
  status: 'invited' | 'active' | 'removed';
  joined_at: string | null;
};

export type NoteCategory =
  'npcs' | 'lugares' | 'missoes' | 'pistas' | 'itens' | 'organizacoes' | 'sessoes' | 'outros';

/**
 * Como o app deve exibir um anexo. Vem decidido do servidor: o MIME type é
 * mentiroso o suficiente para não valer a pena reinterpretar de novo aqui.
 */
export type AttachmentKind = 'image' | 'pdf' | 'video' | 'audio' | 'text' | 'archive' | 'document' | 'other';

/** Arquivo anexado a uma anotação — imagem, PDF, planilha, áudio da sessão. */
export type NoteAttachment = {
  id: number;
  url: string;
  name: string;
  mime_type: string | null;
  kind: AttachmentKind;
  kind_label: string;
  caption: string | null;
  size_bytes: number | null;
  sort_order: number;
};

export type CampaignNote = {
  id: number;
  campaign_id: number;
  title: string;
  body: string | null;
  attachments?: NoteAttachment[];
  category: NoteCategory;
  category_label: string;
  visibility: 'campaign' | 'master_only';
  pinned: boolean;
  author?: User;
  can_edit: boolean;
  created_at: string | null;
  updated_at: string | null;
};

// ------------------------------------------------------------ personagens

export type Vitals = { current: number; max: number; temp: number };

export type CharacterSummary = {
  id: number;
  name: string;
  avatar_url: string | null;
  race: { id: number; name: string } | null;
  class_label: string;
  level: number;
  campaign: { id: number; name: string } | null;
  player: { id: number; name: string } | null;
  hp: Vitals;
  mp: Vitals;
  is_owner: boolean;
  updated_at: string | null;
};

/** Um valor derivado e a explicação de como ele foi obtido. */
export type Calculation = {
  total: number;
  calculated?: number;
  overridden?: boolean;
  breakdown: { label: string; value: number }[];
};

export type CharacterAttribute = {
  key: AttributeKey;
  label: string;
  abbreviation: string;
  base: number;
  racial: number;
  bonus: number;
  temp: number;
  total: number;
};

export type CharacterSkill = {
  id: number;
  skill_id: number;
  key: string;
  name: string;
  specialization: string | null;
  only_trained: boolean;
  armor_penalty_applies: boolean;
  trained: boolean;
  usable: boolean;
  attribute: AttributeKey;
  other_bonus: number;
  manual_total: number | null;
  total: number;
  calculated: number;
  overridden: boolean;
  breakdown: { label: string; value: number }[];
};

export type CharacterAttack = {
  id: number;
  name: string;
  item_id: number | null;
  attack_type: 'corpo_a_corpo' | 'arremesso' | 'disparo';
  attack_type_label: string;
  skill_key: string;
  damage_type: string;
  damage_type_label: string;
  range_category: string;
  critical_range: number;
  critical_multiplier: number;
  attack_bonus_other?: number;
  damage_bonus_other?: number;
  notes: string | null;
  computed: {
    attack_bonus: number;
    attack_breakdown: { label: string; value: number }[];
    attack_overridden: boolean;
    damage: string;
    damage_breakdown: { label: string; value: string }[];
    damage_overridden: boolean;
    critical: string;
    range_meters: number | null;
  };
};

export type CharacterItem = {
  id: number;
  item_id: number | null;
  name: string;
  category: 'arma' | 'armadura' | 'escudo' | 'municao' | 'consumivel' | 'geral';
  category_label: string;
  quantity: number;
  slots: number;
  total_slots: number;
  equipped: boolean;
  description: string | null;
  price: number | null;
  defense_bonus: number | null;
  armor_penalty: number | null;
  armor_weight: string | null;
};

export type CharacterPower = {
  id: number;
  power_id: number | null;
  name: string;
  type: 'classe' | 'geral' | 'racial' | 'origem' | 'concedido' | 'tormenta' | 'outro';
  type_label: string;
  source: string | null;
  requirements: string | null;
  mp_cost: string | null;
  description: string | null;
};

/** Poder na biblioteca — o resumo que a lista de escolha exibe. */
export type CatalogPower = {
  id: number;
  key: string;
  name: string;
  type: CharacterPower['type'];
  type_label: string;
  /** Grupo da wiki: Combate, Destino, Escola de Combate, Concedido, Raça… */
  subtype: string | null;
  /** Publicação de origem: Tormenta 20, Dragão Brasil, Ruff Ghanor… */
  source: string | null;
  /** Divindades que concedem o poder — vazio nos que não são concedidos. */
  deities: string[];
  /** Raças que podem escolher o poder; "Várias" quando não há raça fixa. */
  races: string[];
  requirements: string | null;
  mp_cost: string | null;
};

/** Ficha completa do poder na biblioteca. */
export type CatalogPowerDetail = CatalogPower & {
  description: string;
};

export type PowerSearch = {
  q?: string;
  type?: CharacterPower['type'];
  subtype?: string;
  source?: string;
  deity?: string;
  race?: string;
  page?: number;
  per_page?: number;
};

export type PowerCatalogFilters = {
  types: { value: CharacterPower['type']; label: string }[];
  subtypes: { value: string; label: string; total: number }[];
  sources: string[];
  total: number;
};

/** Magia na biblioteca — o resumo que a lista do grimório exibe. */
export type CatalogSpell = {
  id: number;
  key: string;
  name: string;
  tradition: SpellTradition;
  circle: number;
  school: string;
  school_label: string;
  header: string;
  execution: string | null;
  range_text: string | null;
  /** Alvo, Área ou Efeito — o livro traz só um dos três por magia. */
  target_label: string | null;
  mp_cost: number;
  /** Publicação de origem: Edição Jogo do Ano, Deuses de Arton, Dragão Brasil… */
  source: string | null;
};

/** Ficha completa da magia na biblioteca. */
export type CatalogSpellDetail = CatalogSpell & {
  target: string | null;
  area: string | null;
  effect: string | null;
  duration: string | null;
  resistance: string | null;
  description: string;
  enhancements: SpellEnhancement[];
};

export type SpellSearch = {
  q?: string;
  circle?: number;
  tradition?: SpellTradition;
  school?: string;
  source?: string;
  page?: number;
  per_page?: number;
};

export type SpellCatalogFilters = {
  traditions: { value: SpellTradition; label: string }[];
  schools: { value: string; label: string; abbreviation: string }[];
  sources: string[];
  total: number;
};

/**
 * Magias universais valem para conjuradores arcanos e divinos (livro base,
 * p. 170), por isso são um tipo próprio e não uma variação dos outros dois.
 */
export type SpellTradition = 'arcana' | 'divina' | 'universal';

export type SpellEnhancement = {
  cost: string;
  text: string;
  /** Custo em PM já isolado do rótulo; 0 para aprimoramentos como "Truque". */
  mp?: number;
  /** Restrição do aprimoramento, quando existe: "Apenas Devotos de Marah". */
  requirement?: string | null;
};

export type CharacterSpell = {
  id: number;
  spell_id: number | null;
  name: string;
  tradition: SpellTradition;
  circle: number;
  school: string | null;
  school_label: string | null;
  header: string;
  execution: string | null;
  range_text: string | null;
  target: string | null;
  area: string | null;
  effect: string | null;
  duration: string | null;
  resistance: string | null;
  mp_cost: number;
  description: string | null;
  enhancements: SpellEnhancement[];
  is_favorite: boolean;
};

export type CharacterClassAbility = {
  id: number;
  name: string;
  game_class_id: number | null;
  game_class_name?: string | null;
  level_acquired: number;
  mp_cost: string | null;
  description: string | null;
};

export type CharacterCondition = {
  id: number;
  condition_id: number;
  key: string;
  name: string;
  description?: string | null;
  effect_type: string | null;
  severity: number;
  is_incapacitating: boolean;
  value: number | null;
  duration_note: string | null;
  notes?: string | null;
};

/** Onde um efeito incide. Sem escopo, vale para todas as perícias. */
export type EffectScope =
  | { scope: 'all'; keys?: never }
  | { scope: 'skills'; keys: string[] }
  | { scope: 'attribute'; keys: AttributeKey[] };

export type CharacterResource = {
  id: number;
  name: string;
  kind: 'buff' | 'debuff' | 'recurso';
  kind_label?: string;
  current_value: number | null;
  max_value: number | null;
  expires_note: string | null;
  description?: string | null;
  /** Bônus (ou penalidade) somado aos testes de perícia alcançados. */
  skill_bonus?: number | null;
  applies_to?: EffectScope | null;
  is_active?: boolean;
  affects_skills?: boolean;
};

export type CharacterNote = {
  id: number;
  title: string;
  body: string | null;
  pinned: boolean;
  attachments?: NoteAttachment[];
  created_at: string | null;
  updated_at: string | null;
};

export type Character = {
  id: number;
  name: string;
  avatar_url: string | null;
  version: number;
  player?: User;
  campaign: { id: number; name: string } | null;
  race: { id: number; key: string | null; name: string; variant?: string | null } | null;
  racial_attribute_choices: AttributeKey[] | null;
  origin: { id: number; key: string | null; name: string } | null;
  deity: { id: number; key: string | null; name: string } | null;
  level: number;
  experience: number;
  progression: {
    tier: string;
    xp_current_level: number;
    xp_next_level: number | null;
    xp_to_next_level: number | null;
    half_level: number;
    training_bonus: number;
  };
  classes: {
    id: number;
    game_class_id: number;
    key: string | null;
    name: string | null;
    level: number;
    is_primary: boolean;
  }[];
  class_label: string;
  attributes: CharacterAttribute[];
  size: { value: string; label: string; stealth_modifier: number; maneuver_modifier: number };
  displacement: { base: number; effective: number };
  hp: Vitals & {
    calculation: Calculation;
    is_down: boolean;
    is_dead: boolean;
    death_threshold: number;
  };
  mp: Vitals & { calculation: Calculation };
  /**
   * Atributo-chave da ficha, somado uma vez aos PM totais.
   *
   * `selected` é a escolha do jogador; quando nula, `value` traz o herdado da
   * classe primária e `inherited` fica verdadeiro.
   */
  key_attribute: {
    value: AttributeKey | null;
    label: string | null;
    abbreviation: string | null;
    selected: AttributeKey | null;
    inherited: boolean;
    suggested: AttributeKey[];
  };
  defense: Calculation & { attribute: AttributeKey; other_bonus: number };
  armor_penalty: number;
  carry: {
    limit: number;
    used: number;
    hard_limit: number;
    overloaded: boolean;
    over_hard_limit: boolean;
    money_slots: number;
  };
  money_tibar: number;
  proficiencies: string | null;
  spellcasting: {
    total: number | null;
    attribute: AttributeKey | null;
    overridden: boolean;
    breakdown: { label: string; value: number }[];
  };
  skills: CharacterSkill[];
  attacks: CharacterAttack[];
  items: CharacterItem[];
  powers: CharacterPower[];
  spells: CharacterSpell[];
  class_abilities: CharacterClassAbility[];
  conditions: CharacterCondition[];
  resources: CharacterResource[];
  background: {
    story: string | null;
    personality: string | null;
    appearance: string | null;
    goals: string | null;
    allies: string | null;
    enemies: string | null;
    organizations: string | null;
    notes: string | null;
  };
  permissions: {
    can_update: boolean;
    can_delete: boolean;
    can_update_vitals: boolean;
    can_view_private_notes: boolean;
  };
  created_at: string | null;
  updated_at: string | null;
};

// -------------------------------------------------- painel do mestre

export type DashboardCharacter = {
  id: number;
  name: string;
  avatar_url: string | null;
  player: { id: number | null; name: string | null; nickname: string | null };
  race: string | null;
  class_label: string;
  level: number;
  hp: Vitals & { ratio: number };
  mp: Vitals & { ratio: number };
  status: {
    is_down: boolean;
    is_dead: boolean;
    death_threshold: number;
    severity: Severity;
  };
  conditions: CharacterCondition[];
  resources: CharacterResource[];
  updated_at: string | null;
};

export type MasterDashboard = {
  campaign: {
    id: number;
    name: string;
    channel: string;
    master_can_edit_vitals: boolean;
  };
  characters: DashboardCharacter[];
  generated_at: string;
};

// ------------------------------------------------------------- catálogos

export type ReferenceSkill = {
  id: number;
  key: string;
  name: string;
  attribute: AttributeKey;
  only_trained: boolean;
  armor_penalty: boolean;
  allows_specialization: boolean;
  book_page: number | null;
};

export type ReferenceCondition = {
  id: number;
  key: string;
  name: string;
  description: string;
  effect_type: string;
  effect_type_label: string;
  escalates_to_id: number | null;
  severity: number;
  is_incapacitating: boolean;
};

/**
 * Uma escolha dentro de um passo de construção — e, quando ela mesma abre
 * outra escolha, as filhas ('Afinidade Elemental' → água, fogo, vegetação).
 *
 * Os campos numéricos só aparecem em quem os concede: o tamanho Minúsculo do
 * duende traz size, displacement e Força –1; um presente qualquer, nenhum.
 */
export type RaceBuildOption = {
  name: string;
  text?: string;
  choose?: number;
  options?: RaceBuildOption[];
  size?: string;
  displacement?: number;
  attribute_modifiers?: Partial<Record<AttributeKey, number>>;
  free_choices?: number;
  free_choice_bonus?: number;
};

/**
 * Passo de construção de uma raça montável (duende, p. 32 de Heróis de Arton).
 *
 * `choose` é quantas opções o passo pede (três presentes entre doze);
 * `grants_free_choices`, quantos atributos livres ele concede (os dois +1 do
 * passo de dons); `entries`, itens sem nome próprio — a lista de tabus.
 */
export type RaceBuildStep = {
  key: string;
  name: string;
  text?: string;
  choose?: number;
  grants_free_choices?: number;
  options?: RaceBuildOption[];
  entries?: string[];
};

export type ReferenceRace = {
  id: number;
  key: string;
  name: string;
  attribute_modifiers: Partial<Record<AttributeKey, number>> | null;
  free_choices: number;
  free_choice_bonus: number;
  /** Os +1 não podem empilhar no mesmo atributo (humano, duende). */
  distinct_choices: boolean;
  excluded_attributes: AttributeKey[] | null;
  variants: Record<
    string,
    { name: string; attribute_modifiers: Partial<Record<AttributeKey, number>> }
  > | null;
  /** Só raças montáveis: null para quem tem ficha fixa. */
  build_steps: RaceBuildStep[] | null;
  creature_type: string | null;
  default_size: string;
  /** Tamanho e deslocamento do duende saem do passo 2, não da ficha. */
  size_by_choice: boolean;
  default_displacement: number;
  displacement_by_choice: boolean;
  is_common: boolean;
  description: string | null;
};

export type ReferenceClass = {
  id: number;
  key: string;
  name: string;
  short_description: string | null;
  base_hp: number;
  hp_per_level: number;
  mp_per_level: number;
  key_attributes: AttributeKey[] | null;
  fixed_skills: string[] | null;
  extra_skills: number;
  proficiencies: string[] | null;
  spell_tradition: string | null;
  spell_attribute: AttributeKey | null;
};

export type ReferenceOrigin = {
  id: number;
  key: string;
  name: string;
  skills: string[] | null;
  powers: string[] | null;
  unique_power_name: string | null;
};

export type ReferenceDeity = {
  id: number;
  key: string;
  name: string;
  title: string | null;
  energy: string | null;
  granted_powers: string[] | null;
};

export type ReferenceItem = {
  id: number;
  key: string;
  name: string;
  category: CharacterItem['category'];
  price: number | null;
  slots: number;
  proficiency: string | null;
  grip: string | null;
  attack_type: string | null;
  damage: string | null;
  critical_range: number | null;
  critical_multiplier: number | null;
  damage_type: string | null;
  range_category: string | null;
  armor_weight: string | null;
  defense_bonus: number | null;
  armor_penalty: number | null;
};

export type ReferenceData = {
  attributes: { value: AttributeKey; label: string; abbreviation: string }[];
  sizes: {
    value: string;
    label: string;
    stealth_modifier: number;
    maneuver_modifier: number;
    space: number;
  }[];
  damage_types: { value: string; label: string; abbreviation: string }[];
  power_types: { value: string; label: string }[];
  item_categories: { value: string; label: string }[];
  note_categories: { value: NoteCategory; label: string }[];
  spell_schools: { value: string; label: string; abbreviation: string }[];
  spell_circle_costs: Record<string, number>;
  xp_table: Record<string, number>;
  skills: ReferenceSkill[];
  conditions: ReferenceCondition[];
  races: ReferenceRace[];
  classes: ReferenceClass[];
  origins: ReferenceOrigin[];
  deities: ReferenceDeity[];
  items: ReferenceItem[];
};

// ------------------------------------------------ eventos de tempo real

export type VitalsUpdatedEvent = {
  character_id: number;
  hp: Vitals;
  mp: Vitals;
  is_down: boolean;
  updated_at: string | null;
};

export type ConditionsUpdatedEvent = {
  character_id: number;
  conditions: CharacterCondition[];
};

export type ResourcesUpdatedEvent = {
  character_id: number;
  resources: CharacterResource[];
};

export type SummaryUpdatedEvent = {
  character_id: number;
  name: string;
  avatar_url: string | null;
  level: number;
  class_label: string;
};
