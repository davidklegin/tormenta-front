import { Pressable, View } from 'react-native';
import type { ItemEffect, ItemEffectScope, ItemEffectTarget } from '@/api/types';
import { Button, Chip, Icon, Input, Select, Text } from '@/components/ui';
import { useReference } from '@/hooks/useReference';
import {
  ITEM_DAMAGE_TYPES,
  ITEM_EFFECT_SCOPES,
  ITEM_EFFECT_TARGETS,
  describeItemEffect,
  effectKeyNames,
} from '@/rules';
import { radius, spacing, stroke, useTheme } from '@/theme';

/**
 * Um bônus sendo editado.
 *
 * O número fica como texto enquanto o jogador digita — "−" sozinho, a meio
 * caminho de "−2", não é número nenhum, e convertê-lo a cada tecla apagaria o
 * sinal. A conversão acontece uma vez, em `draftsToEffects`, na hora de salvar.
 */
export type EffectDraft = {
  target: ItemEffectTarget;
  value: string;
  dice: string;
  key: string | null;
  scope: ItemEffectScope;
  damage_type: string | null;
  types: string[];
  text: string;
};

const DICE_TARGETS: ItemEffectTarget[] = ['damage', 'spell_damage'];

export function newEffectDraft(target: ItemEffectTarget = 'defense', scope: ItemEffectScope = 'all'): EffectDraft {
  return { target, value: '', dice: '', key: null, scope, damage_type: null, types: [], text: '' };
}

export function effectsToDrafts(effects: ItemEffect[] | null | undefined): EffectDraft[] {
  return (effects ?? []).map((effect) => ({
    target: effect.target,
    value: effect.value ? String(effect.value) : '',
    dice: effect.dice ?? '',
    key: effect.keys?.[0] ?? null,
    scope: effect.scope ?? 'all',
    damage_type: effect.damage_type ?? null,
    types: effect.types ?? [],
    text: effect.text ?? '',
  }));
}

function parseValue(raw: string): number {
  const parsed = Number.parseInt(raw.replace('−', '-').replace('+', ''), 10);
  return Number.isNaN(parsed) ? 0 : parsed;
}

/** Os rascunhos no formato que o servidor grava, só com o que cada alvo usa. */
export function draftsToEffects(drafts: EffectDraft[]): ItemEffect[] {
  return drafts.map((draft) => {
    const effect: ItemEffect = { target: draft.target };

    if (draft.target !== 'note') effect.value = parseValue(draft.value);
    if (DICE_TARGETS.includes(draft.target)) {
      if (draft.dice.trim()) effect.dice = draft.dice.trim().toLowerCase();
      if (draft.damage_type) effect.damage_type = draft.damage_type;
    }
    if ((draft.target === 'attribute' || draft.target === 'skill') && draft.key) effect.keys = [draft.key];
    if (draft.target === 'attack' || draft.target === 'damage') effect.scope = draft.scope;
    if (draft.target === 'damage_reduction' && draft.types.length) effect.types = draft.types;
    if (draft.text.trim()) effect.text = draft.text.trim();

    return effect;
  });
}

/**
 * A lista de bônus de um item: "o que ele dá".
 *
 * Cada linha escolhe primeiro **o quê** (Defesa, PV, dano…) e só então mostra
 * os campos que aquele alvo usa — dados só no dano, perícia só no bônus de
 * perícia. Embaixo de cada linha vai a frase pronta ("+1d6 de fogo no dano com
 * este item"), que é como o jogador confere se montou o que queria.
 */
export function ItemEffectsEditor({
  drafts,
  onChange,
  defaultScope = 'all',
  errors,
}: {
  drafts: EffectDraft[];
  onChange: (drafts: EffectDraft[]) => void;
  /** Arma nasce com "só com este item"; o resto, com "todos os ataques". */
  defaultScope?: ItemEffectScope;
  /** Erros do servidor, por posição ("effects.0.value"). */
  errors?: Record<string, string[] | undefined>;
}) {
  const { colors } = useTheme();
  const reference = useReference();
  const names = effectKeyNames(reference.data);

  const update = (index: number, patch: Partial<EffectDraft>) =>
    onChange(drafts.map((draft, i) => (i === index ? { ...draft, ...patch } : draft)));

  const remove = (index: number) => onChange(drafts.filter((_, i) => i !== index));

  return (
    <View style={{ gap: spacing.md }}>
      {drafts.length === 0 ? (
        <Text variant="small" tone="muted">
          Nenhum bônus ainda. Toque em “Adicionar bônus” para dizer o que o item dá.
        </Text>
      ) : null}

      {drafts.map((draft, index) => {
        const erro = (campo: string) => errors?.[`effects.${index}.${campo}`]?.[0];
        const [efeito] = draftsToEffects([draft]);
        // Sem número ainda, a frase diria "+0 na Defesa" — melhor não dizer nada.
        const preenchido = draft.target === 'note' ? draft.text.trim() !== '' : parseValue(draft.value) !== 0 || draft.dice.trim() !== '';
        const preview = efeito && preenchido ? describeItemEffect(efeito, names) : '';

        return (
          <View
            key={index}
            style={{
              gap: spacing.sm,
              padding: spacing.md,
              borderRadius: radius.md,
              borderWidth: stroke.hairline,
              borderColor: colors.border,
              backgroundColor: colors.surfaceAlt,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }}>
              <View style={{ flex: 1 }}>
                <Select
                  label={`Bônus ${index + 1}`}
                  value={draft.target}
                  searchable={false}
                  options={ITEM_EFFECT_TARGETS.map((target) => ({
                    value: target.value,
                    label: target.label,
                    description: target.description,
                  }))}
                  onChange={(target) =>
                    target &&
                    update(index, {
                      target,
                      key: null,
                      scope: target === 'attack' || target === 'damage' ? draft.scope : defaultScope,
                    })
                  }
                />
              </View>
              <Pressable
                onPress={() => remove(index)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={`Remover bônus ${index + 1}`}
                style={{ paddingTop: spacing.xl }}
              >
                <Icon name="excluir" size={20} color={colors.textSubtle} />
              </Pressable>
            </View>

            {draft.target === 'attribute' ? (
              <Select
                label="Qual atributo"
                value={draft.key}
                searchable={false}
                options={(reference.data?.attributes ?? []).map((a) => ({ value: a.value, label: a.label }))}
                onChange={(key) => update(index, { key })}
                error={erro('keys')}
              />
            ) : null}

            {draft.target === 'skill' ? (
              <Select
                label="Qual perícia"
                value={draft.key}
                options={(reference.data?.skills ?? []).map((s) => ({ value: s.key, label: s.name }))}
                onChange={(key) => update(index, { key })}
                error={erro('keys')}
              />
            ) : null}

            {draft.target !== 'note' ? (
              <View style={{ flexDirection: 'row', gap: spacing.md }}>
                <Input
                  label={DICE_TARGETS.includes(draft.target) ? 'Fixo' : 'Quanto'}
                  value={draft.value}
                  onChangeText={(value) => update(index, { value })}
                  keyboardType="numbers-and-punctuation"
                  placeholder={draft.target === 'displacement' ? '3' : '2'}
                  hint={draft.target === 'displacement' ? 'em metros; negativo tira' : 'negativo tira'}
                  error={erro('value')}
                  containerStyle={{ flex: 1 }}
                />
                {DICE_TARGETS.includes(draft.target) ? (
                  <Input
                    label="Dados extras"
                    value={draft.dice}
                    onChangeText={(dice) => update(index, { dice })}
                    autoCapitalize="none"
                    autoCorrect={false}
                    placeholder="1d6"
                    error={erro('dice')}
                    containerStyle={{ flex: 1 }}
                  />
                ) : null}
              </View>
            ) : null}

            {draft.target === 'attack' || draft.target === 'damage' ? (
              <Select
                label="Vale para"
                value={draft.scope}
                searchable={false}
                options={ITEM_EFFECT_SCOPES}
                onChange={(scope) => scope && update(index, { scope })}
                hint={
                  draft.scope === 'this'
                    ? 'Vincule o ataque a esta arma na aba Combate para o bônus entrar nele.'
                    : undefined
                }
              />
            ) : null}

            {DICE_TARGETS.includes(draft.target) ? (
              <Select
                label="Tipo do dano extra (opcional)"
                value={draft.damage_type}
                searchable={false}
                clearable
                options={ITEM_DAMAGE_TYPES.map((tipo) => ({ value: tipo, label: tipo }))}
                onChange={(damage_type) => update(index, { damage_type })}
              />
            ) : null}

            {draft.target === 'damage_reduction' ? (
              <View style={{ gap: spacing.xs }}>
                <Text variant="caption" tone="secondary">
                  Só contra (deixe vazio para valer contra todo dano)
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
                  {ITEM_DAMAGE_TYPES.map((tipo) => {
                    const marcado = draft.types.includes(tipo);
                    return (
                      <Chip
                        key={tipo}
                        label={tipo}
                        compact
                        selected={marcado}
                        onPress={() =>
                          update(index, {
                            types: marcado ? draft.types.filter((t) => t !== tipo) : [...draft.types, tipo],
                          })
                        }
                      />
                    );
                  })}
                </View>
              </View>
            ) : null}

            <Input
              label={draft.target === 'note' ? 'O que o item faz' : 'Observação (opcional)'}
              value={draft.text}
              onChangeText={(text) => update(index, { text })}
              placeholder={draft.target === 'note' ? 'Enxerga no escuro a 18 m' : 'só à noite, só contra mortos-vivos…'}
              error={erro('text')}
            />

            {preview ? (
              <Text variant="small" tone="gold">
                {preview}
              </Text>
            ) : null}
          </View>
        );
      })}

      <Button
        label="Adicionar bônus"
        variant="secondary"
        onPress={() => onChange([...drafts, newEffectDraft('defense', defaultScope)])}
      />
    </View>
  );
}
