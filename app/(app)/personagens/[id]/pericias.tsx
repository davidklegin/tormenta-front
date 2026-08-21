import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { charactersApi } from '@/api';
import type { Character, CharacterSkill } from '@/api/types';
import { Card, Chip, HelpNote, Input, SegmentedControl, Sheet, Text } from '@/components/ui';
import { SheetScreen } from '@/components/character/SheetScreen';
import { signed } from '@/rules';
import { radius, spacing, useTheme } from '@/theme';

type Filter = 'todas' | 'treinadas' | 'usaveis';

/**
 * Aba Perícias (briefing §10).
 *
 * Mostra todas as perícias do sistema com o valor calculado e o detalhamento
 * (½ nível + atributo + treinamento + outros − penalidade de armadura). Marcar
 * "treinada" é um toque, porque é a alteração mais comum ao subir de nível.
 */
export default function SkillsScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const characterId = Number(params.id);

  return (
    <SheetScreen characterId={characterId}>
      {(character) => <SkillsContent characterId={characterId} character={character} />}
    </SheetScreen>
  );
}

/**
 * O conteúdo vive em um componente próprio, e não em uma função dentro do JSX:
 * assim os hooks são sempre chamados na mesma ordem, mesmo quando a ficha ainda
 * está carregando.
 */
function SkillsContent({ characterId, character }: { characterId: number; character: Character }) {
  const { colors } = useTheme();

  const queryClient = useQueryClient();

  const [filter, setFilter] = useState<Filter>('todas');
  const [query, setQuery] = useState('');
  const [detail, setDetail] = useState<CharacterSkill | null>(null);

  const updateSkill = useMutation({
    mutationFn: ({ skillId, payload }: { skillId: number; payload: Record<string, unknown> }) =>
      charactersApi.updateSkill(characterId, skillId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['character', characterId] });
    },
  });

  const canEdit = character.permissions.can_update;

  const skills = useMemo(() => {
    const term = query.trim().toLowerCase();

    return character.skills.filter((skill) => {
      if (term && !skill.name.toLowerCase().includes(term)) return false;
      if (filter === 'treinadas') return skill.trained;
      if (filter === 'usaveis') return skill.usable;

      return true;
    });
  }, [character.skills, filter, query]);

  const trainedCount = character.skills.filter((skill) => skill.trained).length;

  return (
    <View style={{ gap: spacing.md }}>
      <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center', flexWrap: 'wrap' }}>
        <Chip label={`${trainedCount} treinadas`} tone="primary" compact />
        <Chip label={`Bônus de treino ${signed(character.progression.training_bonus)}`} compact />
        <Chip label={`½ nível ${signed(character.progression.half_level)}`} compact />
      </View>

      <HelpNote collapsible source="Livro base, p. 114">
        Toque no quadradinho para marcar uma perícia como treinada — é o que a sua classe e sua origem
        concedem. Treinar soma um bônus ao valor. Toque no nome da perícia para ver de onde cada número vem.
      </HelpNote>

      <Input placeholder="Buscar perícia…" value={query} onChangeText={setQuery} autoCorrect={false} />

      <SegmentedControl
        value={filter}
        onChange={setFilter}
        segments={[
          { value: 'todas', label: 'Todas' },
          { value: 'treinadas', label: 'Treinadas' },
          { value: 'usaveis', label: 'Disponíveis' },
        ]}
      />

      <Card padded={false}>
        {skills.map((skill, index) => (
          <Pressable
            key={skill.id}
            onPress={() => setDetail(skill)}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.md,
              paddingVertical: spacing.md,
              paddingHorizontal: spacing.lg,
              borderBottomWidth: index === skills.length - 1 ? 0 : 1,
              borderBottomColor: colors.border,
              backgroundColor: pressed ? colors.surfaceHover : 'transparent',
              opacity: skill.usable ? 1 : 0.55,
            })}
          >
            {/* Marcador de treinamento: toque direto, sem abrir tela */}
            <Pressable
              disabled={!canEdit}
              onPress={() => updateSkill.mutate({ skillId: skill.id, payload: { trained: !skill.trained } })}
              hitSlop={8}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: skill.trained }}
              accessibilityLabel={`${skill.name} treinada`}
              style={{
                width: 22,
                height: 22,
                borderRadius: radius.sm,
                borderWidth: 1.5,
                borderColor: skill.trained ? colors.primary : colors.borderStrong,
                backgroundColor: skill.trained ? colors.primary : 'transparent',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {skill.trained ? (
                <Text variant="caption" style={{ color: colors.onPrimary }}>
                  ✓
                </Text>
              ) : null}
            </Pressable>

            <View style={{ flex: 1, minWidth: 0 }}>
              <Text variant="body" numberOfLines={1}>
                {skill.name}
              </Text>
              <Text variant="caption" tone="muted">
                {skill.attribute.toUpperCase()}
                {skill.only_trained ? ' · só treinada' : ''}
                {skill.armor_penalty_applies ? ' · armadura' : ''}
              </Text>
            </View>

            <Text variant="numeric" style={{ fontSize: 20 }} tone={skill.usable ? 'default' : 'muted'}>
              {signed(skill.total)}
            </Text>
          </Pressable>
        ))}

        {skills.length === 0 ? (
          <Text variant="small" tone="muted" style={{ padding: spacing.lg }}>
            Nenhuma perícia encontrada.
          </Text>
        ) : null}
      </Card>

      {/* Detalhe: mostra o cálculo e permite ajustar "outros" */}
      <Sheet visible={detail !== null} onClose={() => setDetail(null)} title={detail?.name ?? ''}>
        {detail ? (
          <>
            <View style={{ gap: spacing.xs }}>
              {detail.breakdown.map((part, index) => (
                <View key={index} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text variant="small" tone="secondary">
                    {part.label}
                  </Text>
                  <Text variant="smallStrong">{signed(part.value)}</Text>
                </View>
              ))}
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  borderTopWidth: 1,
                  borderTopColor: colors.border,
                  paddingTop: spacing.sm,
                  marginTop: spacing.xs,
                }}
              >
                <Text variant="bodyStrong">Total</Text>
                <Text variant="bodyStrong" tone="primary">
                  {signed(detail.total)}
                </Text>
              </View>
            </View>

            {detail.only_trained && !detail.trained ? (
              <Text variant="small" tone="warning">
                Esta perícia só pode ser usada por quem é treinado nela.
              </Text>
            ) : null}

            {canEdit ? (
              <OtherBonusEditor
                value={detail.other_bonus}
                onSave={(value) => {
                  updateSkill.mutate({ skillId: detail.id, payload: { other_bonus: value } });
                  setDetail(null);
                }}
              />
            ) : null}
          </>
        ) : null}
      </Sheet>
    </View>
  );
}

/** Campo de "outros modificadores": itens, poderes e bênçãos da mesa. */
function OtherBonusEditor({ value, onSave }: { value: number; onSave: (value: number) => void }) {
  const { colors } = useTheme();

  const [text, setText] = useState(String(value));

  return (
    <View style={{ gap: spacing.sm }}>
      <Input
        label="Outros modificadores"
        value={text}
        onChangeText={setText}
        keyboardType="numbers-and-punctuation"
        hint="Bônus de itens, poderes ou efeitos que não entram na fórmula padrão."
        onSubmitEditing={() => onSave(Number.parseInt(text, 10) || 0)}
        returnKeyType="done"
      />
      <Pressable
        onPress={() => onSave(Number.parseInt(text, 10) || 0)}
        style={({ pressed }) => ({
          height: 44,
          borderRadius: radius.md,
          backgroundColor: colors.primary,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: pressed ? 0.85 : 1,
        })}
      >
        <Text variant="bodyStrong" style={{ color: colors.onPrimary }}>
          Salvar
        </Text>
      </Pressable>
    </View>
  );
}
