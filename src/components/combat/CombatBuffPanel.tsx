import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { combatApi, type CombatBuffInput } from '@/api';
import type { ReferenceCondition } from '@/api/types';
import { Button, Card, Chip, Icon, Input, Loading, Sheet, Text } from '@/components/ui';
import { useReference } from '@/hooks/useReference';
import { useCombat } from '@/hooks/useCombat';
import { radius, spacing, useTheme } from '@/theme';
import { contemTermo, normalizar } from '@/utils/texto';

type TargetGroup = 'players' | 'enemies';

type ModifierKey = 'attack' | 'damage' | 'defense' | 'fortitude' | 'reflex' | 'will' | 'skills' | 'initiative';

const MODIFIER_LABELS: Record<ModifierKey, string> = {
  attack: 'Ataque',
  damage: 'Dano',
  defense: 'Defesa',
  fortitude: 'Fortitude',
  reflex: 'Reflexos',
  will: 'Vontade',
  skills: 'Perícias',
  initiative: 'Iniciativa',
};

/**
 * Painel para aplicar buffs e condições coletivamente durante combate.
 *
 * O mestre pode aplicar em "Jogadores" ou "Inimigos" de uma vez.
 * Suporta condições do livro ou efeitos customizados com modificadores.
 */
export function CombatBuffPanel({ campaignId }: { campaignId: number }) {
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const combat = useCombat(campaignId);
  const reference = useReference();

  const [target, setTarget] = useState<TargetGroup>('players');
  const [mode, setMode] = useState<'condition' | 'custom'>('custom');
  const [conditionSheetOpen, setConditionSheetOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Efeito customizado
  const [customName, setCustomName] = useState('');
  const [customDescription, setCustomDescription] = useState('');
  const [durationNote, setDurationNote] = useState('');
  const [modifiers, setModifiers] = useState<Partial<Record<ModifierKey, number>>>({});

  // Condição do sistema selecionada
  const [selectedCondition, setSelectedCondition] = useState<ReferenceCondition | null>(null);

  const conditions = reference.data?.conditions ?? [];

  const filteredConditions = useMemo(() => {
    const term = normalizar(searchTerm.trim());
    return term ? conditions.filter((c) => contemTermo(c.name, term)) : conditions;
  }, [conditions, searchTerm]);

  const applyBuff = useMutation({
    mutationFn: (input: CombatBuffInput) => combatApi.applyBuff(campaignId, input),
    onSuccess: () => {
      // Limpar formulário após sucesso
      setCustomName('');
      setCustomDescription('');
      setDurationNote('');
      setModifiers({});
      setSelectedCondition(null);
      // Invalidar queries de condições dos personagens se necessário
      queryClient.invalidateQueries({ queryKey: ['characters'] });
    },
  });

  const handleApply = () => {
    const input: CombatBuffInput = {
      targets: target,
      duration_note: durationNote || undefined,
    };

    if (mode === 'condition' && selectedCondition) {
      input.condition_id = selectedCondition.id;
    } else if (mode === 'custom' && customName.trim()) {
      input.custom_name = customName.trim();
      input.custom_description = customDescription.trim() || undefined;
      input.is_buff = true;

      // Adicionar modificadores não-zero
      if (modifiers.attack) input.mod_attack = modifiers.attack;
      if (modifiers.damage) input.mod_damage = modifiers.damage;
      if (modifiers.defense) input.mod_defense = modifiers.defense;
      if (modifiers.fortitude) input.mod_fortitude = modifiers.fortitude;
      if (modifiers.reflex) input.mod_reflex = modifiers.reflex;
      if (modifiers.will) input.mod_will = modifiers.will;
      if (modifiers.skills) input.mod_skills = modifiers.skills;
      if (modifiers.initiative) input.mod_initiative = modifiers.initiative;
    }

    applyBuff.mutate(input);
  };

  const canApply =
    mode === 'condition' ? selectedCondition !== null : customName.trim() !== '';

  const playerCount = combat.data?.entries.filter((e) => !e.is_npc).length ?? 0;
  const enemyCount = combat.data?.entries.filter((e) => e.is_npc).length ?? 0;

  if (!combat.data?.active) {
    return null;
  }

  return (
    <Card title="Aplicar Efeito" subtitle="Buff ou debuff em grupo">
      <View style={{ gap: spacing.md }}>
        {/* Seletor de alvo */}
        <View style={{ gap: spacing.sm }}>
          <Text variant="caption" tone="secondary" uppercase>
            Alvo
          </Text>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <TargetButton
              label={`Jogadores (${playerCount})`}
              selected={target === 'players'}
              onPress={() => setTarget('players')}
              disabled={playerCount === 0}
            />
            <TargetButton
              label={`Inimigos (${enemyCount})`}
              selected={target === 'enemies'}
              onPress={() => setTarget('enemies')}
              disabled={enemyCount === 0}
            />
          </View>
        </View>

        {/* Seletor de modo */}
        <View style={{ gap: spacing.sm }}>
          <Text variant="caption" tone="secondary" uppercase>
            Tipo de efeito
          </Text>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <TargetButton
              label="Efeito customizado"
              selected={mode === 'custom'}
              onPress={() => setMode('custom')}
            />
            <TargetButton
              label="Condição do livro"
              selected={mode === 'condition'}
              onPress={() => setMode('condition')}
            />
          </View>
        </View>

        {mode === 'custom' ? (
          <>
            {/* Nome do efeito */}
            <View style={{ gap: spacing.xs }}>
              <Text variant="caption" tone="secondary">
                Nome do efeito
              </Text>
              <Input
                placeholder="Ex: Bênção, Inspiração Bárdica"
                value={customName}
                onChangeText={setCustomName}
              />
            </View>

            {/* Descrição opcional */}
            <View style={{ gap: spacing.xs }}>
              <Text variant="caption" tone="secondary">
                Descrição (opcional)
              </Text>
              <Input
                placeholder="O que o efeito faz"
                value={customDescription}
                onChangeText={setCustomDescription}
                multiline
              />
            </View>

            {/* Modificadores */}
            <View style={{ gap: spacing.sm }}>
              <Text variant="caption" tone="secondary" uppercase>
                Modificadores
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                {(Object.keys(MODIFIER_LABELS) as ModifierKey[]).map((key) => (
                  <ModifierInput
                    key={key}
                    label={MODIFIER_LABELS[key]}
                    value={modifiers[key]}
                    onChange={(v) =>
                      setModifiers((prev) => ({ ...prev, [key]: v === 0 ? undefined : v }))
                    }
                  />
                ))}
              </View>
            </View>
          </>
        ) : (
          <>
            {/* Seletor de condição */}
            <Pressable
              onPress={() => setConditionSheetOpen(true)}
              style={({ pressed }) => ({
                padding: spacing.md,
                borderRadius: radius.md,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: pressed ? colors.surfaceHover : colors.surface,
              })}
            >
              {selectedCondition ? (
                <View style={{ gap: spacing.xs }}>
                  <Text variant="bodyStrong">{selectedCondition.name}</Text>
                  <Text variant="small" tone="muted" numberOfLines={2}>
                    {selectedCondition.description}
                  </Text>
                </View>
              ) : (
                <Text tone="muted">Toque para selecionar uma condição</Text>
              )}
            </Pressable>
          </>
        )}

        {/* Duração */}
        <View style={{ gap: spacing.xs }}>
          <Text variant="caption" tone="secondary">
            Duração (opcional)
          </Text>
          <Input
            placeholder="Ex: 5 rodadas, até fim do combate"
            value={durationNote}
            onChangeText={setDurationNote}
          />
        </View>

        {/* Botão de aplicar */}
        <Button
          label={`Aplicar em ${target === 'players' ? 'jogadores' : 'inimigos'}`}
          disabled={!canApply}
          loading={applyBuff.isPending}
          onPress={handleApply}
          fullWidth
        />

        {applyBuff.isError ? (
          <Text variant="small" tone="danger">
            Erro ao aplicar: {(applyBuff.error as Error).message}
          </Text>
        ) : null}

        {applyBuff.isSuccess ? (
          <Text variant="small" tone="success">
            {applyBuff.data.message}
          </Text>
        ) : null}
      </View>

      {/* Sheet de seleção de condição */}
      <Sheet
        visible={conditionSheetOpen}
        onClose={() => setConditionSheetOpen(false)}
        title="Selecionar condição"
        subtitle="As 35 condições do livro"
      >
        <Input
          placeholder="Buscar condição..."
          value={searchTerm}
          onChangeText={setSearchTerm}
          autoCorrect={false}
        />

        {reference.isLoading ? (
          <Loading inline label="Carregando condições..." />
        ) : (
          <ScrollView style={{ maxHeight: 400 }} keyboardShouldPersistTaps="handled">
            {filteredConditions.map((condition) => (
              <Pressable
                key={condition.id}
                onPress={() => {
                  setSelectedCondition(condition);
                  setConditionSheetOpen(false);
                  setSearchTerm('');
                }}
                style={({ pressed }) => ({
                  paddingVertical: spacing.md,
                  paddingHorizontal: spacing.md,
                  borderRadius: radius.md,
                  backgroundColor: pressed ? colors.surfaceHover : 'transparent',
                  gap: 2,
                })}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                  <Text variant="bodyStrong" style={{ flex: 1 }}>
                    {condition.name}
                  </Text>
                  {condition.effect_type !== 'nenhum' ? (
                    <Chip label={condition.effect_type_label} compact />
                  ) : null}
                </View>
                <Text variant="small" tone="muted" numberOfLines={2}>
                  {condition.description}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        )}
      </Sheet>
    </Card>
  );
}

function TargetButton({
  label,
  selected,
  onPress,
  disabled,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
}) {
  const { colors } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => ({
        flex: 1,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: selected ? colors.accent : colors.border,
        backgroundColor: selected
          ? colors.accentFill
          : pressed
          ? colors.surfaceHover
          : colors.surface,
        opacity: disabled ? 0.5 : 1,
      })}
    >
      <Text
        variant="small"
        tone={selected ? 'gold' : 'secondary'}
        style={{ textAlign: 'center' }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function ModifierInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | undefined;
  onChange: (v: number) => void;
}) {
  const { colors } = useTheme();

  return (
    <View style={{ width: 80, gap: 2 }}>
      <Text variant="caption" tone="muted" style={{ textAlign: 'center' }}>
        {label}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
        <Pressable
          onPress={() => onChange((value ?? 0) - 1)}
          style={{
            width: 24,
            height: 24,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: radius.sm,
            backgroundColor: colors.surfaceAlt,
          }}
        >
          <Icon name="menos" size={12} color={colors.textSubtle} />
        </Pressable>
        <Text
          variant="numeric"
          style={{ flex: 1, textAlign: 'center' }}
          tone={value ? (value > 0 ? 'success' : 'danger') : 'muted'}
        >
          {value !== undefined && value !== 0 ? (value > 0 ? `+${value}` : value) : '—'}
        </Text>
        <Pressable
          onPress={() => onChange((value ?? 0) + 1)}
          style={{
            width: 24,
            height: 24,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: radius.sm,
            backgroundColor: colors.surfaceAlt,
          }}
        >
          <Icon name="mais" size={12} color={colors.textSubtle} />
        </Pressable>
      </View>
    </View>
  );
}
