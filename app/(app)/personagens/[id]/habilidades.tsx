import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { charactersApi } from '@/api';
import type { Character, CharacterClassAbility } from '@/api/types';
import { Button, Card, Chip, Input, Sheet, Text } from '@/components/ui';
import { SheetScreen } from '@/components/character/SheetScreen';
import { ShowcaseButton } from '@/components/showcase';
import { radius, spacing, useTheme } from '@/theme';

/**
 * Aba Habilidades de classe (briefing §13).
 *
 * Agrupadas por nível de aquisição, como as tabelas de classe do livro
 * apresentam ("Você ganha todas as habilidades do nível alcançado", p. 35).
 */
export default function ClassAbilitiesScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const characterId = Number(params.id);

  return (
    <SheetScreen characterId={characterId}>
      {(character) => <AbilitiesContent characterId={characterId} character={character} />}
    </SheetScreen>
  );
}

function AbilitiesContent({ characterId, character }: { characterId: number; character: Character }) {
  const { colors } = useTheme();

  const queryClient = useQueryClient();
  const canEdit = character.permissions.can_update;

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CharacterClassAbility | null>(null);
  const [detail, setDetail] = useState<CharacterClassAbility | null>(null);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['character', characterId] });
  };

  const removeAbility = useMutation({
    mutationFn: (id: number) => charactersApi.removeClassAbility(characterId, id),
    onSuccess: invalidate,
  });

  const byLevel = useMemo(() => {
    const groups = new Map<number, CharacterClassAbility[]>();

    for (const ability of character.class_abilities) {
      const list = groups.get(ability.level_acquired) ?? [];
      list.push(ability);
      groups.set(ability.level_acquired, list);
    }

    return [...groups.entries()].sort((a, b) => a[0] - b[0]);
  }, [character.class_abilities]);

  return (
    <View style={{ gap: spacing.md }}>
      <View style={{ flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap' }}>
        {character.classes.map((entry) => (
          <Chip key={entry.id} label={`${entry.name} ${entry.level}`} tone="gold" compact />
        ))}
      </View>

      {canEdit ? (
        <Button
          label="Adicionar habilidade"
          onPress={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        />
      ) : null}

      {byLevel.length === 0 ? (
        <Text variant="small" tone="muted">
          Nenhuma habilidade cadastrada. Consulte a tabela da sua classe no livro e adicione as do seu nível.
        </Text>
      ) : (
        byLevel.map(([level, abilities]) => (
          <Card key={level} title={`${level}º nível`} padded={false}>
            {abilities.map((ability, index) => (
              <Pressable
                key={ability.id}
                onPress={() => setDetail(ability)}
                style={({ pressed }) => ({
                  paddingVertical: spacing.md,
                  paddingHorizontal: spacing.lg,
                  borderBottomWidth: index === abilities.length - 1 ? 0 : 1,
                  borderBottomColor: colors.border,
                  backgroundColor: pressed ? colors.surfaceHover : 'transparent',
                  gap: 2,
                })}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                  <Text variant="body" style={{ flex: 1 }} numberOfLines={1}>
                    {ability.name}
                  </Text>
                  {ability.mp_cost ? <Chip label={ability.mp_cost} compact tone="primary" /> : null}
                </View>
                {ability.description ? (
                  <Text variant="small" tone="secondary" numberOfLines={2}>
                    {ability.description}
                  </Text>
                ) : null}
              </Pressable>
            ))}
          </Card>
        ))
      )}

      <Sheet visible={detail !== null} onClose={() => setDetail(null)} title={detail?.name ?? ''}>
        {detail ? (
          <>
            <View style={{ flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap' }}>
              <Chip label={`${detail.level_acquired}º nível`} compact tone="gold" />
              {detail.mp_cost ? <Chip label={detail.mp_cost} compact tone="primary" /> : null}
              {detail.game_class_name ? <Chip label={detail.game_class_name} compact /> : null}
            </View>

            <Text variant="body" tone="secondary">
              {detail.description || 'Sem descrição.'}
            </Text>

            <ShowcaseButton kind="class_ability" characterId={characterId} resourceId={detail.id} />

            {canEdit ? (
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <Button
                  label="Editar"
                  variant="secondary"
                  style={{ flex: 1 }}
                  onPress={() => {
                    setEditing(detail);
                    setDetail(null);
                    setFormOpen(true);
                  }}
                />
                <Button
                  label="Remover"
                  variant="danger"
                  style={{ flex: 1 }}
                  onPress={() => {
                    removeAbility.mutate(detail.id);
                    setDetail(null);
                  }}
                />
              </View>
            ) : null}
          </>
        ) : null}
      </Sheet>

      <AbilityForm
        key={editing?.id ?? 'nova'}
        visible={formOpen}
        onClose={() => setFormOpen(false)}
        characterId={characterId}
        ability={editing}
        onSaved={invalidate}
      />
    </View>
  );
}

function AbilityForm({
  visible,
  onClose,
  characterId,
  ability,
  onSaved,
}: {
  visible: boolean;
  onClose: () => void;
  characterId: number;
  ability: CharacterClassAbility | null;
  onSaved: () => void;
}) {
  const [name, setName] = useState(ability?.name ?? '');
  const [level, setLevel] = useState(String(ability?.level_acquired ?? 1));
  const [mpCost, setMpCost] = useState(ability?.mp_cost ?? '');
  const [description, setDescription] = useState(ability?.description ?? '');

  const save = useMutation({
    mutationFn: () => {
      const payload = {
        name: name.trim(),
        level_acquired: Math.min(20, Math.max(1, Number.parseInt(level, 10) || 1)),
        mp_cost: mpCost.trim() || undefined,
        description: description.trim() || undefined,
      };

      return ability
        ? charactersApi.updateClassAbility(characterId, ability.id, payload)
        : charactersApi.createClassAbility(characterId, payload);
    },
    onSuccess: () => {
      onSaved();
      onClose();
    },
  });

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={ability ? 'Editar habilidade' : 'Nova habilidade'}
      footer={
        <>
          <Button label="Cancelar" variant="ghost" onPress={onClose} style={{ flex: 1 }} />
          <Button label="Salvar" onPress={() => save.mutate()} loading={save.isPending} style={{ flex: 1 }} />
        </>
      }
    >
      <Input label="Nome" value={name} onChangeText={setName} placeholder="Fúria" />
      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        <Input
          label="Nível adquirido"
          value={level}
          onChangeText={setLevel}
          keyboardType="number-pad"
          containerStyle={{ flex: 1 }}
        />
        <Input
          label="Custo em PM"
          value={mpCost}
          onChangeText={setMpCost}
          placeholder="2 PM"
          containerStyle={{ flex: 1 }}
        />
      </View>
      <Input label="Descrição" value={description} onChangeText={setDescription} multiline />
    </Sheet>
  );
}
